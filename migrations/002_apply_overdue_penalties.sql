-- ============================================================================
-- 004_apply_overdue_penalties.sql — Real-Time Overdue Penalty System
-- ============================================================================
-- Problem: Penalties were only computed when a payment was recorded.
-- A borrower 11 days late had zero credit score hit and zero security hold
-- deduction until they paid — which could be weeks later.
--
-- Root fix: Store `security_hold_original` (the hold at loan creation).
-- The diff (original − current) tells us exactly how much has already been
-- deducted by ANY mechanism — so re-running is always safe and idempotent.
--
-- Changes:
--   loans.security_hold_original  NUMERIC  — initial hold; set at creation
--   loans.overdue_credit_deducted BOOLEAN  — was -10 applied this installment
--
-- apply_overdue_penalties(loan_id, due_date, installment_num, admin_email):
--   - already_charged  = security_hold_original − security_hold (current)
--   - gross_penalty    = days_late × ₱20
--   - net_new_penalty  = MAX(0, gross − already_charged)
--   - deducts net from security_hold
--   - applies -10 credit score ONCE per missed installment
--
-- record_installment_payment (BL-01) — companion update in 001_*.sql:
--   - subtracts pre-applied amount so payment time never double-charges
--   - resets overdue_credit_deducted after payment (for next installment)
--
-- ROLLBACK:
--   DROP FUNCTION IF EXISTS public.apply_overdue_penalties;
--   ALTER TABLE loans
--     DROP COLUMN IF EXISTS security_hold_original,
--     DROP COLUMN IF EXISTS overdue_credit_deducted;
-- ============================================================================

-- ── Step 1: New columns ────────────────────────────────────────────────────
ALTER TABLE loans
  ADD COLUMN IF NOT EXISTS security_hold_original  NUMERIC(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS overdue_credit_deducted BOOLEAN NOT NULL DEFAULT FALSE;

-- ── Step 2: Seed security_hold_original for existing loans ─────────────────
--
-- Logic: getBadgeStatus(score) → 'New' for score < 835, else Trusted/Reliable/VIP
-- Hold rates (from creditSystem.js SECURITY_HOLD_TIERS):
--   'New'      → minScore 750 → 10%   (any score < 835 uses badge 'New')
--   'Trusted'  → minScore 835 → 8%
--   'Reliable' → minScore 920 → 6%
--   'VIP'      → minScore 1000 → 5%
--
-- NOTE: We use the BORROWER'S CURRENT credit_score for the best estimate.
-- Since all scores below 835 resolve to 'New' badge (10%), scores that have
-- dropped slightly (e.g., 750 → 720) still give the same 10% rate.
-- QuickLoans always have security_hold = 0, so they are excluded.
UPDATE loans l SET
  security_hold_original = ROUND(l.loan_amount::NUMERIC * (
    SELECT CASE
      WHEN b.credit_score >= 1000 THEN 0.05   -- VIP
      WHEN b.credit_score >= 920  THEN 0.06   -- Reliable
      WHEN b.credit_score >= 835  THEN 0.08   -- Trusted
      ELSE                             0.10   -- New (any score < 835)
    END
    FROM borrowers b WHERE b.id = l.borrower_id
  ), 2)
FROM borrowers b2
WHERE b2.id = l.borrower_id
  AND l.loan_type IS DISTINCT FROM 'quickloan'
  AND l.security_hold_original IS NULL;

-- ── Step 3: Create apply_overdue_penalties function ─────────────────────────
CREATE OR REPLACE FUNCTION public.apply_overdue_penalties(
  p_loan_id         TEXT,
  p_due_date_str    TEXT,      -- YYYY-MM-DD: due date of the missed installment
  p_installment_num INTEGER,   -- 1-based; = loan.payments_made + 1
  p_admin_email     TEXT DEFAULT 'system'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_loan             RECORD;
  v_borrower         RECORD;
  v_due_date         DATE;
  v_days_late        INTEGER;
  v_daily_penalty    NUMERIC := 20;
  v_already_charged  NUMERIC;
  v_gross_penalty    NUMERIC;
  v_net_penalty      NUMERIC;
  v_hold_before      NUMERIC;
  v_hold_after       NUMERIC;
  v_hold_deducted    NUMERIC := 0;
  v_score_change     INTEGER := 0;
  v_new_score        INTEGER;
  v_new_risk         TEXT;
  v_new_badge        TEXT;
BEGIN
  -- ── Lock and load loan ─────────────────────────────────────────────
  SELECT * INTO v_loan FROM loans WHERE id = p_loan_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Loan not found');
  END IF;

  IF v_loan.status IN ('Paid', 'Defaulted') THEN
    RETURN jsonb_build_object('success', true, 'skipped', true, 'reason', 'Loan is closed');
  END IF;

  IF v_loan.loan_type = 'quickloan' THEN
    RETURN jsonb_build_object('success', true, 'skipped', true, 'reason', 'QuickLoan uses separate penalty logic');
  END IF;

  -- ── Lock and load borrower ────────────────────────────────────────────
  SELECT * INTO v_borrower FROM borrowers WHERE id = v_loan.borrower_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Borrower not found');
  END IF;

  v_due_date  := p_due_date_str::DATE;
  v_days_late := GREATEST(0, CURRENT_DATE - v_due_date);

  IF v_days_late = 0 THEN
    RETURN jsonb_build_object('success', true, 'skipped', true, 'reason', 'Not yet overdue', 'days_late', 0);
  END IF;

  -- ── Penalty: derive what's already been charged from security hold delta ──
  --
  -- This is the key insight: (original − current) = total already deducted,
  -- regardless of which mechanism (manual edit, old system, etc.) did it.
  -- This makes the function self-correcting and safe to call repeatedly.
  --
  -- Example — Fritz:
  --   security_hold_original = ₱500
  --   security_hold (current) = ₱320   ← ₱180 already deducted (9 days)
  --   days_late = 11 → gross = ₱220
  --   already_charged = ₱180
  --   net_new = ₱220 − ₱180 = ₱40  ✓  (only 2 days charged today)
  v_hold_before     := COALESCE(v_loan.security_hold, 0);
  v_already_charged := GREATEST(0,
    COALESCE(v_loan.security_hold_original, v_hold_before) - v_hold_before
  );
  v_gross_penalty   := v_days_late * v_daily_penalty;
  v_net_penalty     := GREATEST(0, v_gross_penalty - v_already_charged);

  IF v_net_penalty > 0 THEN
    v_hold_after    := GREATEST(0, v_hold_before - v_net_penalty);
    v_hold_deducted := v_hold_before - v_hold_after;

    UPDATE loans SET
      security_hold = v_hold_after,
      status        = 'Overdue',
      updated_at    = NOW()
    WHERE id = p_loan_id;

    -- Log incremental penalty charge (new days × ₱20 only)
    INSERT INTO penalty_charges (
      borrower_id, loan_id, installment_number,
      days_late, penalty_per_day, penalty_amount, cap_applied
    ) VALUES (
      v_loan.borrower_id, p_loan_id, p_installment_num,
      ROUND(v_net_penalty / v_daily_penalty), v_daily_penalty, v_net_penalty, false
    );

    INSERT INTO audit_logs (action_type, module, description, changed_by) VALUES (
      'OVERDUE_PENALTY_APPLIED', 'Loan',
      'Overdue penalty ₱' || v_net_penalty || ' applied (' ||
      ROUND(v_net_penalty / v_daily_penalty) || ' new day(s) × ₱' || v_daily_penalty ||
      ', ' || v_days_late || ' total days late) for ' || v_borrower.full_name ||
      '. Security Hold: ₱' || v_hold_before || ' → ₱' || v_hold_after,
      p_admin_email
    );
  ELSE
    -- No new penalty, but ensure status reflects overdue state
    UPDATE loans SET
      status     = 'Overdue',
      updated_at = NOW()
    WHERE id = p_loan_id AND status NOT IN ('Overdue', 'Paid', 'Defaulted');
  END IF;

  -- ── Credit score: -10 ONCE per missed installment ───────────────────
  IF NOT COALESCE(v_loan.overdue_credit_deducted, FALSE) THEN
    v_score_change := -10;
    v_new_score    := GREATEST(300, LEAST(1000, v_borrower.credit_score + v_score_change));
    v_new_risk     := CASE
      WHEN v_new_score >= 750 THEN 'Low'
      WHEN v_new_score >= 600 THEN 'Medium'
      ELSE 'High'
    END;
    v_new_badge    := CASE
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

    UPDATE loans SET overdue_credit_deducted = TRUE WHERE id = p_loan_id;

    INSERT INTO audit_logs (action_type, module, description, changed_by) VALUES (
      'OVERDUE_CREDIT_DEDUCTED', 'Loan',
      'Credit score -10 for missed Installment ' || p_installment_num || '. ' ||
      v_borrower.full_name || ': ' || v_borrower.credit_score || ' → ' || v_new_score,
      p_admin_email
    );
  END IF;

  RETURN jsonb_build_object(
    'success',          true,
    'days_late',        v_days_late,
    'already_charged',  v_already_charged,
    'net_penalty',      v_net_penalty,
    'hold_deducted',    v_hold_deducted,
    'score_change',     v_score_change,
    'borrower_name',    v_borrower.full_name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_overdue_penalties(TEXT, TEXT, INTEGER, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_overdue_penalties(TEXT, TEXT, INTEGER, TEXT) FROM anon;
