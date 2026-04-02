-- ============================================================
-- Moneyfest Lending — Principal Payment Feature Migration
-- Run this ONCE in your Supabase SQL Editor
-- Fully idempotent — safe to re-run multiple times
-- ============================================================

-- ── 1. Add new columns to the loans table ───────────────────
ALTER TABLE loans
  ADD COLUMN IF NOT EXISTS current_principal NUMERIC DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS interest_baseline_date DATE DEFAULT NULL;

-- Backfill existing QuickLoan rows
UPDATE loans
SET
  current_principal      = loan_amount,
  interest_baseline_date = release_date
WHERE loan_type = 'quickloan'
  AND release_date IS NOT NULL
  AND current_principal IS NULL;


-- ── 2. Create the principal_payments table ───────────────────
CREATE TABLE IF NOT EXISTS principal_payments (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  loan_id             TEXT NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  borrower_id         TEXT NOT NULL REFERENCES borrowers(id) ON DELETE CASCADE,

  payment_amount      NUMERIC NOT NULL,
  interest_portion    NUMERIC NOT NULL,
  principal_portion   NUMERIC NOT NULL,
  principal_before    NUMERIC NOT NULL,
  principal_after     NUMERIC NOT NULL,

  days_elapsed        INTEGER NOT NULL DEFAULT 0,
  accrued_interest    NUMERIC NOT NULL DEFAULT 0,

  file_path           TEXT,
  file_url            TEXT,
  notes               TEXT,

  status              TEXT NOT NULL DEFAULT 'Pending'
                        CHECK (status IN ('Pending', 'Confirmed', 'Rejected')),
  reviewed_by         TEXT,
  reviewed_at         TIMESTAMPTZ,

  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. Indexes ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_pp_loan_id     ON principal_payments(loan_id);
CREATE INDEX IF NOT EXISTS idx_pp_borrower_id ON principal_payments(borrower_id);
CREATE INDEX IF NOT EXISTS idx_pp_status      ON principal_payments(status);

-- ── 4. Row Level Security + Policies ────────────────────────
ALTER TABLE principal_payments ENABLE ROW LEVEL SECURITY;

-- Use DO blocks so policies can be safely created or recreated
DO $$
BEGIN
  -- INSERT policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'principal_payments'
      AND policyname = 'Borrowers can insert principal payments'
  ) THEN
    EXECUTE 'CREATE POLICY "Borrowers can insert principal payments"
      ON principal_payments FOR INSERT WITH CHECK (true)';
  END IF;

  -- SELECT policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'principal_payments'
      AND policyname = 'Anyone can read principal payments'
  ) THEN
    EXECUTE 'CREATE POLICY "Anyone can read principal payments"
      ON principal_payments FOR SELECT USING (true)';
  END IF;

  -- UPDATE policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'principal_payments'
      AND policyname = 'Anyone can update principal payments'
  ) THEN
    EXECUTE 'CREATE POLICY "Anyone can update principal payments"
      ON principal_payments FOR UPDATE USING (true)';
  END IF;
END $$;


-- ── 5. Verify ─────────────────────────────────────────────────
-- These SELECTs confirm everything ran correctly:

-- Should return 2 rows (current_principal, interest_baseline_date):
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'loans'
  AND column_name IN ('current_principal', 'interest_baseline_date');

-- Should return 1 row (principal_payments):
SELECT table_name FROM information_schema.tables
WHERE table_name = 'principal_payments';

-- Should return 0 (no unfilled quickloans with a release_date):
SELECT COUNT(*) AS unfilled_quickloans
FROM loans
WHERE loan_type = 'quickloan'
  AND release_date IS NOT NULL
  AND current_principal IS NULL;
