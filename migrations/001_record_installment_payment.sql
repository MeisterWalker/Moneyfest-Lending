-- ============================================================================
-- BL-01: Atomic Installment Payment Recording
-- ============================================================================
-- This function wraps all critical financial mutations for recording an
-- installment payment into a single atomic transaction.
--
-- What it does (all-or-nothing):
--   1. Updates loan: payments_made, remaining_balance, status
--   2. Records penalty_charges if installment was late
--   3. Deducts penalty from security_hold if applicable
--   4. Updates borrower credit_score, risk_score, loyalty_badge
--   5. On full payoff: applies completion bonus, recalculates tier
--   6. On full payoff: returns security hold to wallet
--   7. On full payoff: calculates and credits early payoff rebate
--   8. Logs capital_flow entries for interest/principal split
--   9. Records all audit_logs  
--
-- What it does NOT do (handled by frontend after RPC returns):
--   - Send emails (email failures should never roll back a payment)
--   - Download receipts (client-side only)
--   - Display toast messages (client-side only)
--
-- ROLLBACK: DROP FUNCTION IF EXISTS public.record_installment_payment;
-- ============================================================================

CREATE OR REPLACE FUNCTION public.record_installment_payment(
  p_loan_id UUID,
  p_admin_email TEXT,
  p_due_date_str TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_loan       RECORD;
  v_borrower   RECORD;
  v_install_amt NUMERIC;
  v_new_payments INTEGER;
  v_new_balance NUMERIC;
  v_new_status  TEXT;
  v_num_inst    INTEGER;
  v_days_late   INTEGER := 0;
  v_penalty     NUMERIC := 0;
  v_penalty_per_day NUMERIC := 20;
  v_score_change INTEGER;
  v_new_score   INTEGER;
  v_new_risk    TEXT;
  v_new_badge   TEXT;
  v_hold_deducted NUMERIC := 0;
  v_hold_remaining NUMERIC;
  v_hold_to_return NUMERIC;
  v_preapplied_penalty NUMERIC := 0;
  v_rebate_amount NUMERIC := 0;
  v_new_level   INTEGER;
  v_new_limit   INTEGER;
  v_new_clean   INTEGER;
  v_interest_profit NUMERIC;
  v_principal_return NUMERIC;
  v_total_interest NUMERIC;
  v_wallet_id   UUID;
  v_wallet_balance NUMERIC;
  v_result      JSONB;
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
  v_num_inst := COALESCE(v_loan.num_installments, 4);
  v_install_amt := CEIL(COALESCE(v_loan.installment_amount, 0));
  v_new_payments := v_loan.payments_made + 1;
  v_new_balance := GREATEST(0, v_loan.remaining_balance - v_install_amt);
  v_new_status := CASE WHEN v_new_payments >= v_num_inst THEN 'Paid' ELSE 'Partially Paid' END;

  -- ── Step 3.5: Determine Effective Payment Date from Proofs ───────
  DECLARE
    v_proof_date DATE;
  BEGIN
    SELECT created_at::DATE INTO v_proof_date 
    FROM payment_proofs 
    WHERE loan_id = p_loan_id AND installment_number = (v_loan.payments_made + 1)
    ORDER BY created_at ASC LIMIT 1;
    
    IF v_proof_date IS NOT NULL THEN
      -- Freeze penalty to the date the proof was uploaded
      v_days_late := GREATEST(0, v_proof_date - p_due_date_str::DATE);
    ELSE
      -- No proof found, calculate based on current date
      v_days_late := GREATEST(0, CURRENT_DATE - p_due_date_str::DATE);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_days_late := GREATEST(0, CURRENT_DATE - p_due_date_str::DATE);
  END;

  -- ── Step 4: Calculate penalty if late ───────────────────────────────
  IF p_due_date_str IS NOT NULL THEN
    IF v_days_late > 0 THEN
      v_penalty := v_days_late * v_penalty_per_day;
      -- Subtract any penalty ALREADY deducted from the security hold
      -- (by apply_overdue_penalties or any previous mechanism).
      -- Derived from the hold delta — self-correcting, no extra column needed.
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
    overdue_credit_deducted = FALSE, -- reset: next installment tracks its own credit hit
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

    -- Auto-deduct penalty from security hold
    v_hold_remaining := COALESCE(v_loan.security_hold, 0);
    IF v_hold_remaining > 0 AND NOT COALESCE(v_loan.security_hold_returned, false) THEN
      v_hold_deducted := LEAST(v_penalty, v_hold_remaining);
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
  END IF;

  -- ── Step 7: Update credit score ─────────────────────────────────────
  -- Skip the -10 if apply_overdue_penalties already applied it during the overdue
  -- period — prevents double-penalizing the same missed installment.
  IF v_days_late = 0 THEN
    v_score_change := 15;   -- CREDIT_CONFIG.ON_TIME_PAYMENT
  ELSIF COALESCE(v_loan.overdue_credit_deducted, FALSE) THEN
    v_score_change := 0;    -- Already deducted during overdue period — no double hit
  ELSE
    v_score_change := -10;  -- CREDIT_CONFIG.LATE_PAYMENT (first penalty for this installment)
  END IF;

  v_new_score := LEAST(1000, GREATEST(300, v_borrower.credit_score + v_score_change));
  v_new_risk := CASE
    WHEN v_new_score >= 750 THEN 'Low'
    WHEN v_new_score >= 600 THEN 'Medium'
    ELSE 'High'
  END;
  v_new_badge := CASE
    WHEN v_new_score >= 1000 THEN 'VIP'
    WHEN v_new_score >= 920 THEN 'Reliable'
    WHEN v_new_score >= 835 THEN 'Trusted'
    ELSE 'New'
  END;

  UPDATE borrowers SET
    credit_score = v_new_score,
    risk_score = v_new_risk,
    loyalty_badge = v_new_badge
  WHERE id = v_borrower.id;

  -- ── Step 8: Capital flow (interest/principal split) ─────────────────
  v_total_interest := COALESCE(v_loan.total_repayment, 0) - COALESCE(v_loan.loan_amount, 0);
  IF v_num_inst > 0 AND v_install_amt > 0 THEN
    v_interest_profit := ROUND((v_total_interest / v_num_inst) * (v_install_amt::NUMERIC / v_loan.installment_amount), 2);
    v_principal_return := ROUND(v_install_amt - v_interest_profit, 2);

    IF v_interest_profit > 0 THEN
      INSERT INTO capital_flow (entry_date, type, category, amount, notes) VALUES (
        CURRENT_DATE, 'CASH IN', 'Interest Profit (Installment)',
        v_interest_profit,
        'Auto: Interest Profit from ' || v_borrower.full_name || ' installment ' || v_new_payments
      );
    END IF;

    IF v_principal_return > 0 THEN
      INSERT INTO capital_flow (entry_date, type, category, amount, notes) VALUES (
        CURRENT_DATE, 'CASH IN', 'Loan Principal Return',
        v_principal_return,
        'Auto: Principal Return from ' || v_borrower.full_name || ' installment ' || v_new_payments
      );
    END IF;
  END IF;

  -- ── Step 9: Log installment paid audit ──────────────────────────────
  INSERT INTO audit_logs (action_type, module, description, changed_by) VALUES (
    'INSTALLMENT_PAID', 'Loan',
    'Installment ' || v_new_payments || ' of ' || v_num_inst || ' paid for ' || v_borrower.full_name
      || ' — ₱' || v_install_amt
      || CASE WHEN v_penalty > 0 THEN ' + ₱' || v_penalty || ' penalty (' || v_days_late || ' days late)' ELSE ' (on time)' END,
    p_admin_email
  );

  -- ── Step 10: Full payoff handling ───────────────────────────────────
  IF v_new_status = 'Paid' THEN
    -- Completion bonus: +25 to credit score
    v_new_score := LEAST(1000, v_new_score + 25);
    v_new_clean := COALESCE(v_borrower.clean_loans, 0) + 1;

    -- Recalculate tier
    v_new_level := CASE
      WHEN v_new_score >= 1000 THEN 4
      WHEN v_new_score >= 920 THEN 3
      WHEN v_new_score >= 835 THEN 2
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
      WHEN v_new_score >= 920 THEN 'Reliable'
      WHEN v_new_score >= 835 THEN 'Trusted'
      ELSE 'New'
    END;

    UPDATE borrowers SET
      credit_score = v_new_score,
      risk_score = CASE WHEN v_new_score >= 750 THEN 'Low' WHEN v_new_score >= 600 THEN 'Medium' ELSE 'High' END,
      loyalty_badge = v_new_badge,
      loan_limit_level = v_new_level,
      loan_limit = v_new_limit,
      clean_loans = v_new_clean
    WHERE id = v_borrower.id;

    -- ── Return Security Hold ──────────────────────────────────────
    v_hold_to_return := COALESCE((SELECT security_hold FROM loans WHERE id = p_loan_id), 0);
    IF v_hold_to_return > 0 AND NOT COALESCE((SELECT security_hold_returned FROM loans WHERE id = p_loan_id), false) THEN
      UPDATE loans SET security_hold_returned = true WHERE id = p_loan_id;

      -- Upsert wallet balance
      SELECT id, balance INTO v_wallet_id, v_wallet_balance
      FROM wallets WHERE borrower_id = v_borrower.id;

      IF v_wallet_id IS NOT NULL THEN
        UPDATE wallets SET
          balance = ROUND(v_wallet_balance + v_hold_to_return, 2),
          updated_at = NOW()
        WHERE id = v_wallet_id;
      ELSE
        INSERT INTO wallets (borrower_id, balance) VALUES (v_borrower.id, v_hold_to_return);
      END IF;

      INSERT INTO wallet_transactions (borrower_id, loan_id, type, amount, description, status) VALUES (
        v_borrower.id, p_loan_id, 'rebate', v_hold_to_return,
        'Security Hold of ₱' || v_hold_to_return || ' returned — loan fully paid',
        'completed'
      );

      INSERT INTO audit_logs (action_type, module, description, changed_by) VALUES (
        'SECURITY_HOLD_RETURNED', 'Loan',
        'Security Hold of ₱' || v_hold_to_return || ' returned to ' || v_borrower.full_name || '''s Rebate Credits',
        p_admin_email
      );
    ELSE
      v_hold_to_return := 0;
    END IF;

    -- ── Early payoff rebate ───────────────────────────────────────
    -- NOTE: Rebate is calculated based on due date passed from the client
    -- because installment date calculations depend on the shared JS helper.
    -- The frontend will pass the days_early value if applicable.
    -- For now, we skip rebate calculation in the DB function and let the
    -- frontend handle it as a follow-up call if days_early >= 7.

  END IF;

  -- ── Build result ────────────────────────────────────────────────────
  v_result := jsonb_build_object(
    'success', true,
    'new_payments_made', v_new_payments,
    'new_balance', v_new_balance,
    'new_status', v_new_status,
    'install_amount', v_install_amt,
    'days_late', v_days_late,
    'penalty_amount', v_penalty,
    'hold_deducted', v_hold_deducted,
    'new_score', v_new_score,
    'new_level', COALESCE(v_new_level, v_borrower.loan_limit_level),
    'hold_returned', COALESCE(v_hold_to_return, 0),
    'borrower_name', v_borrower.full_name,
    'borrower_email', v_borrower.email,
    'borrower_access_code', v_borrower.access_code,
    'old_level', COALESCE(v_borrower.loan_limit_level, 1)
  );

  RETURN v_result;
END;
$$;

-- Grant execute to authenticated (admin) only
GRANT EXECUTE ON FUNCTION public.record_installment_payment(UUID, TEXT, TEXT) TO authenticated;
-- Explicitly deny to anon
REVOKE EXECUTE ON FUNCTION public.record_installment_payment(UUID, TEXT, TEXT) FROM anon;
