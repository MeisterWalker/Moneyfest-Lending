-- ============================================================================
-- BL-01 v2: Atomic Installment Payment Recording with Hold Netting
-- ============================================================================
-- Changes from v1:
--   p_loan_id UUID → TEXT  (loans.id is TEXT in this project, not UUID)
--   p_net_hold BOOLEAN DEFAULT FALSE  (new: hold netting on final installment)
--   Ghost money rule: held amount bypasses capital_flow → hold_redeployments
--   Borrower always gets rebate credit regardless of netting path
--   Step 4: pre-applied overdue penalties subtracted (no double-deduction)
--   Step 5: overdue_credit_deducted reset after payment
--   Step 7: credit score -10 skipped if already applied during overdue period
--
-- ROLLBACK: DROP FUNCTION IF EXISTS public.record_installment_payment(TEXT, TEXT, TEXT, BOOLEAN);
--           DROP FUNCTION IF EXISTS public.record_installment_payment(UUID, TEXT, TEXT);
-- ============================================================================

-- Drop old UUID-signature function so it doesn't shadow the new TEXT one
DROP FUNCTION IF EXISTS public.record_installment_payment(UUID, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.record_installment_payment(
  p_loan_id      TEXT,
  p_admin_email  TEXT,
  p_due_date_str TEXT    DEFAULT NULL,
  p_net_hold     BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_loan             RECORD;
  v_borrower         RECORD;
  v_install_amt      NUMERIC;
  v_new_payments     INTEGER;
  v_new_balance      NUMERIC;
  v_new_status       TEXT;
  v_num_inst         INTEGER;
  v_days_late        INTEGER := 0;
  v_penalty          NUMERIC := 0;
  v_penalty_per_day  NUMERIC := 20;
  v_score_change     INTEGER;
  v_new_score        INTEGER;
  v_new_risk         TEXT;
  v_new_badge        TEXT;
  v_hold_deducted    NUMERIC := 0;
  v_hold_remaining   NUMERIC;
  v_hold_to_return   NUMERIC;
  v_preapplied_penalty NUMERIC := 0;
  v_rebate_amount    NUMERIC := 0;
  v_new_level        INTEGER;
  v_new_limit        INTEGER;
  v_new_clean        INTEGER;
  v_interest_profit  NUMERIC;
  v_principal_return NUMERIC;
  v_total_interest   NUMERIC;
  v_wallet_id        UUID;
  v_wallet_balance   NUMERIC;
  v_result           JSONB;
  v_hold_for_netting NUMERIC := 0;
  v_cash_collected   NUMERIC := 0;
  v_is_final         BOOLEAN := FALSE;
BEGIN
  -- ── Step 1: Lock and read the loan ──────────────────────────────────
  SELECT * INTO v_loan FROM loans WHERE id = p_loan_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Loan not found');
  END IF;

  IF v_loan.status NOT IN ('Active', 'Partially Paid', 'Overdue') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Loan is not in a payable status: ' || v_loan.status);
  END IF;

  IF v_loan.loan_type = 'quickloan' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Use quickloan payoff for QuickLoan type');
  END IF;

  -- ── Step 2: Lock and read the borrower ──────────────────────────────
  SELECT * INTO v_borrower FROM borrowers WHERE id = v_loan.borrower_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Borrower not found');
  END IF;

  -- ── Step 3: Calculate payment amounts ───────────────────────────────
  v_num_inst     := COALESCE(v_loan.num_installments, 4);
  v_install_amt  := CEIL(COALESCE(v_loan.installment_amount, 0));
  v_new_payments := v_loan.payments_made + 1;
  v_new_balance  := GREATEST(0, v_loan.remaining_balance - v_install_amt);
  v_new_status   := CASE WHEN v_new_payments >= v_num_inst THEN 'Paid' ELSE 'Partially Paid' END;

  -- ── Step 3b: Determine if hold netting applies ───────────────────────
  -- p_net_hold TRUE = admin collected (installment − hold) in cash only.
  -- The hold offsets the final installment; borrower still gets rebate credit.
  -- Only valid on the final installment when hold exists and hasn't been returned.
  v_is_final         := (v_new_payments >= v_num_inst);
  v_hold_for_netting := 0;
  IF p_net_hold AND v_is_final THEN
    IF COALESCE(v_loan.security_hold, 0) > 0
       AND NOT COALESCE(v_loan.security_hold_returned, false) THEN
      v_hold_for_netting := COALESCE(v_loan.security_hold, 0);
    END IF;
  END IF;
  -- Cash actually collected from borrower in hand
  v_cash_collected := v_install_amt - v_hold_for_netting;

  -- ── Step 3.5: Determine effective payment date from proofs ───────────
  DECLARE
    v_proof_date DATE;
  BEGIN
    SELECT created_at::DATE INTO v_proof_date
    FROM payment_proofs
    WHERE loan_id = p_loan_id
      AND installment_number = (v_loan.payments_made + 1)
    ORDER BY created_at ASC LIMIT 1;

    IF v_proof_date IS NOT NULL AND p_due_date_str IS NOT NULL THEN
      v_days_late := GREATEST(0, v_proof_date - p_due_date_str::DATE);
    ELSIF p_due_date_str IS NOT NULL THEN
      v_days_late := GREATEST(0, CURRENT_DATE - p_due_date_str::DATE);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    IF p_due_date_str IS NOT NULL THEN
      v_days_late := GREATEST(0, CURRENT_DATE - p_due_date_str::DATE);
    END IF;
  END;

  -- ── Step 4: Calculate penalty if late ───────────────────────────────
  IF p_due_date_str IS NOT NULL THEN
    IF v_days_late > 0 THEN
      v_penalty := v_days_late * v_penalty_per_day;
      -- Subtract penalty already pre-applied by apply_overdue_penalties.
      -- Derived from (original_hold − current_hold) — self-correcting; no double-deduction.
      v_preapplied_penalty := GREATEST(0,
        COALESCE(v_loan.security_hold_original, v_loan.security_hold, 0) -
        COALESCE(v_loan.security_hold, 0)
      );
      v_penalty := GREATEST(0, v_penalty - v_preapplied_penalty);
    END IF;
  END IF;

  -- ── Step 5: Update the loan ─────────────────────────────────────────
  UPDATE loans SET
    payments_made           = v_new_payments,
    remaining_balance       = v_new_balance,
    status                  = v_new_status,
    overdue_credit_deducted = FALSE,  -- reset: next installment tracks its own credit hit
    updated_at              = NOW()
  WHERE id = p_loan_id;

  -- ── Step 6: Record penalty if applicable ────────────────────────────
  IF v_penalty > 0 THEN
    INSERT INTO penalty_charges (
      borrower_id, loan_id, installment_number,
      days_late, penalty_per_day, penalty_amount, cap_applied
    ) VALUES (
      v_loan.borrower_id, p_loan_id, v_new_payments,
      v_days_late, v_penalty_per_day, v_penalty, false
    );

    v_hold_remaining := COALESCE(v_loan.security_hold, 0);
    IF v_hold_remaining > 0 AND NOT COALESCE(v_loan.security_hold_returned, false) THEN
      v_hold_deducted  := LEAST(v_penalty, v_hold_remaining);
      v_hold_remaining := ROUND(v_hold_remaining - v_hold_deducted, 2);
      UPDATE loans SET security_hold = v_hold_remaining WHERE id = p_loan_id;

      INSERT INTO audit_logs (action_type, module, description, changed_by) VALUES (
        'PENALTY_DEDUCTED_FROM_HOLD', 'Loan',
        '₱' || v_hold_deducted || ' penalty auto-deducted from Security Hold for ' || v_borrower.full_name,
        p_admin_email
      );
    END IF;

    INSERT INTO audit_logs (action_type, module, description, changed_by) VALUES (
      'PENALTY_CHARGED', 'Loan',
      'Late penalty of ₱' || v_penalty || ' charged to ' || v_borrower.full_name
        || ' — Installment ' || v_new_payments || ' was ' || v_days_late || ' day(s) late',
      p_admin_email
    );
    -- NOTE: penalty NOT written to capital_flow (see apply_overdue_penalties for rationale).
  END IF;

  -- ── Step 7: Update credit score ─────────────────────────────────────
  -- Skip -10 if apply_overdue_penalties already applied it (no double hit).
  IF v_days_late = 0 THEN
    v_score_change := 15;   -- CREDIT_CONFIG.ON_TIME_PAYMENT
  ELSIF COALESCE(v_loan.overdue_credit_deducted, FALSE) THEN
    v_score_change := 0;    -- already deducted during overdue period
  ELSE
    v_score_change := -10;  -- CREDIT_CONFIG.LATE_PAYMENT (first penalty for this installment)
  END IF;

  v_new_score := LEAST(1000, GREATEST(300, v_borrower.credit_score + v_score_change));
  v_new_risk  := CASE
    WHEN v_new_score >= 750 THEN 'Low'
    WHEN v_new_score >= 600 THEN 'Medium'
    ELSE 'High'
  END;
  v_new_badge := CASE
    WHEN v_new_score >= 1000 THEN 'VIP'
    WHEN v_new_score >= 920  THEN 'Reliable'
    WHEN v_new_score >= 835  THEN 'Trusted'
    ELSE 'New'
  END;

  UPDATE borrowers SET
    credit_score  = v_new_score,
    risk_score    = v_new_risk,
    loyalty_badge = v_new_badge
  WHERE id = v_borrower.id;

  -- ── Step 8: Capital flow (interest/principal split) ──────────────────
  -- GHOST MONEY RULE: Only log what was physically collected in cash.
  -- v_hold_for_netting bypasses capital_flow entirely → hold_redeployments only.
  -- When NOT netting, v_cash_collected = v_install_amt (unchanged behavior).
  v_total_interest := COALESCE(v_loan.total_repayment, 0) - COALESCE(v_loan.loan_amount, 0);
  IF v_num_inst > 0 AND v_cash_collected > 0 THEN
    v_interest_profit := ROUND(v_total_interest / v_num_inst, 2);
    -- If netting: scale interest down proportionally to cash collected
    IF v_hold_for_netting > 0 AND v_install_amt > 0 THEN
      v_interest_profit := ROUND(
        v_interest_profit * (v_cash_collected::NUMERIC / v_install_amt), 2
      );
    END IF;
    v_principal_return := ROUND(v_cash_collected - v_interest_profit, 2);

    IF v_interest_profit > 0 THEN
      INSERT INTO capital_flow (entry_date, type, category, amount, notes) VALUES (
        CURRENT_DATE, 'CASH IN', 'Interest Profit (Installment)',
        v_interest_profit,
        'Auto: Interest Profit from ' || v_borrower.full_name || ' installment ' || v_new_payments
          || CASE WHEN v_hold_for_netting > 0
               THEN ' (hold netted ₱' || v_hold_for_netting || ')'
               ELSE '' END
      );
    END IF;

    IF v_principal_return > 0 THEN
      INSERT INTO capital_flow (entry_date, type, category, amount, notes) VALUES (
        CURRENT_DATE, 'CASH IN', 'Loan Principal Return',
        v_principal_return,
        'Auto: Principal Return from ' || v_borrower.full_name || ' installment ' || v_new_payments
          || CASE WHEN v_hold_for_netting > 0
               THEN ' (hold netted ₱' || v_hold_for_netting || ')'
               ELSE '' END
      );
    END IF;
  END IF;

  -- ── Step 9: Log installment paid audit ──────────────────────────────
  INSERT INTO audit_logs (action_type, module, description, changed_by) VALUES (
    'INSTALLMENT_PAID', 'Loan',
    'Installment ' || v_new_payments || ' of ' || v_num_inst || ' paid for ' || v_borrower.full_name
      || ' — ₱' || v_install_amt
      || CASE WHEN v_hold_for_netting > 0
           THEN ' (₱' || v_cash_collected || ' cash + ₱' || v_hold_for_netting || ' netted hold)'
           ELSE '' END
      || CASE WHEN v_penalty > 0
           THEN ' + ₱' || v_penalty || ' penalty (' || v_days_late || ' days late)'
           ELSE ' (on time)' END,
    p_admin_email
  );

  -- ── Step 10: Full payoff handling ───────────────────────────────────
  IF v_new_status = 'Paid' THEN
    v_new_score := LEAST(1000, v_new_score + 25);
    v_new_clean := COALESCE(v_borrower.clean_loans, 0) + 1;

    v_new_level := CASE
      WHEN v_new_score >= 1000 THEN 4
      WHEN v_new_score >= 920  THEN 3
      WHEN v_new_score >= 835  THEN 2
      ELSE 1
    END;
    v_new_limit := CASE v_new_level
      WHEN 4 THEN 10000
      WHEN 3 THEN 9000
      WHEN 2 THEN 7000
      ELSE 5000
    END;
    v_new_badge := CASE
      WHEN v_new_score >= 1000 THEN 'VIP'
      WHEN v_new_score >= 920  THEN 'Reliable'
      WHEN v_new_score >= 835  THEN 'Trusted'
      ELSE 'New'
    END;

    UPDATE borrowers SET
      credit_score     = v_new_score,
      risk_score       = CASE WHEN v_new_score >= 750 THEN 'Low'
                              WHEN v_new_score >= 600 THEN 'Medium'
                              ELSE 'High' END,
      loyalty_badge    = v_new_badge,
      loan_limit_level = v_new_level,
      loan_limit       = v_new_limit,
      clean_loans      = v_new_clean
    WHERE id = v_borrower.id;

    -- ── Return / Redeploy Security Hold ───────────────────────────────
    v_hold_to_return := COALESCE(
      (SELECT security_hold FROM loans WHERE id = p_loan_id), 0
    );
    IF v_hold_to_return > 0
       AND NOT COALESCE(
         (SELECT security_hold_returned FROM loans WHERE id = p_loan_id), false
       ) THEN

      UPDATE loans SET security_hold_returned = true WHERE id = p_loan_id;

      -- ALWAYS post rebate credit (T&C honored regardless of netting path)
      SELECT id, balance INTO v_wallet_id, v_wallet_balance
      FROM wallets WHERE borrower_id = v_borrower.id;

      IF v_wallet_id IS NOT NULL THEN
        UPDATE wallets SET
          balance    = ROUND(v_wallet_balance + v_hold_to_return, 2),
          updated_at = NOW()
        WHERE id = v_wallet_id;
      ELSE
        INSERT INTO wallets (borrower_id, balance)
        VALUES (v_borrower.id, v_hold_to_return);
      END IF;

      INSERT INTO wallet_transactions (
        borrower_id, loan_id, type, amount, description, status
      ) VALUES (
        v_borrower.id, p_loan_id, 'rebate', v_hold_to_return,
        CASE
          WHEN v_hold_for_netting > 0
            THEN 'Security Hold of ₱' || v_hold_to_return || ' credited — final installment netted'
          ELSE
            'Security Hold of ₱' || v_hold_to_return || ' returned — loan fully paid'
        END,
        'completed'
      );

      IF v_hold_for_netting > 0 THEN
        -- NETTING PATH: mark loan, log to hold_redeployments, skip capital_flow
        UPDATE loans SET hold_netted = TRUE WHERE id = p_loan_id;

        INSERT INTO hold_redeployments (source_loan_id, amount, redeployed_by, notes)
        VALUES (
          p_loan_id,
          v_hold_for_netting,
          p_admin_email,
          'Hold netted on final installment for ' || v_borrower.full_name
            || ' — available for next loaner'
        );

        INSERT INTO audit_logs (action_type, module, description, changed_by) VALUES (
          'HOLD_NETTED', 'Loan',
          'Security Hold of ₱' || v_hold_for_netting || ' netted on final installment for '
            || v_borrower.full_name
            || '. Rebate credit posted to wallet. Redeployment logged.',
          p_admin_email
        );

      ELSE
        -- STANDARD PATH: unchanged behavior
        INSERT INTO audit_logs (action_type, module, description, changed_by) VALUES (
          'SECURITY_HOLD_RETURNED', 'Loan',
          'Security Hold of ₱' || v_hold_to_return || ' returned to '
            || v_borrower.full_name || '''s Rebate Credits',
          p_admin_email
        );
      END IF;

    ELSE
      v_hold_to_return := 0;
    END IF;
  END IF;

  v_result := jsonb_build_object(
    'success',            true,
    'new_payments_made',  v_new_payments,
    'new_balance',        v_new_balance,
    'new_status',         v_new_status,
    'install_amount',     v_install_amt,
    'days_late',          v_days_late,
    'penalty_amount',     v_penalty,
    'hold_deducted',      v_hold_deducted,
    'new_score',          v_new_score,
    'new_level',          COALESCE(v_new_level, v_borrower.loan_limit_level),
    'hold_returned',      COALESCE(v_hold_to_return, 0),
    'borrower_name',      v_borrower.full_name,
    'borrower_email',     v_borrower.email,
    'borrower_access_code', v_borrower.access_code,
    'old_level',          COALESCE(v_borrower.loan_limit_level, 1),
    'hold_netted',        v_hold_for_netting > 0,
    'hold_for_netting',   v_hold_for_netting,
    'cash_collected',     v_cash_collected
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_installment_payment(TEXT, TEXT, TEXT, BOOLEAN) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.record_installment_payment(TEXT, TEXT, TEXT, BOOLEAN) FROM anon;

-- ROLLBACK: DROP FUNCTION IF EXISTS public.record_installment_payment(TEXT, TEXT, TEXT, BOOLEAN);
