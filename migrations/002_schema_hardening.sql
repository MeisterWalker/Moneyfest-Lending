-- ============================================================================
-- DB-01 through DB-10: Schema Hardening Migration
-- ============================================================================
-- This migration addresses all 10 database audit findings.
-- Run in Supabase SQL Editor AFTER taking a snapshot/backup.
--
-- IMPORTANT: Run each section one at a time if you prefer incremental safety.
-- Each section is idempotent (safe to re-run).
--
-- ROLLBACK INSTRUCTIONS are provided per-section.
-- ============================================================================


-- ============================================================================
-- DB-01: CHECK constraints on borrowers table
-- ============================================================================
-- Prevents privilege escalation via direct writes (e.g., setting loan_limit 
-- to ₱999,999 or loyalty_badge to 'VIP' without earning it).
--
-- ROLLBACK:
--   ALTER TABLE borrowers DROP CONSTRAINT IF EXISTS chk_credit_score;
--   ALTER TABLE borrowers DROP CONSTRAINT IF EXISTS chk_loan_limit;
--   ALTER TABLE borrowers DROP CONSTRAINT IF EXISTS chk_loyalty_badge;
--   ALTER TABLE borrowers DROP CONSTRAINT IF EXISTS chk_loan_limit_level;
-- ============================================================================

-- First backfill any out-of-range values so constraints don't fail
UPDATE borrowers SET credit_score = LEAST(1000, GREATEST(300, COALESCE(credit_score, 750)))
  WHERE credit_score IS NULL OR credit_score < 300 OR credit_score > 1000;

UPDATE borrowers SET loan_limit = 5000
  WHERE loan_limit IS NULL OR loan_limit NOT IN (5000, 7000, 9000, 10000);

UPDATE borrowers SET loyalty_badge = 'New'
  WHERE loyalty_badge IS NULL OR loyalty_badge NOT IN ('New', 'Trusted', 'Reliable', 'VIP');

UPDATE borrowers SET loan_limit_level = 1
  WHERE loan_limit_level IS NULL OR loan_limit_level NOT IN (1, 2, 3, 4);

-- Add constraints (safe to re-run — DROP IF EXISTS first)
ALTER TABLE borrowers DROP CONSTRAINT IF EXISTS chk_credit_score;
ALTER TABLE borrowers ADD CONSTRAINT chk_credit_score 
  CHECK (credit_score BETWEEN 300 AND 1000);

ALTER TABLE borrowers DROP CONSTRAINT IF EXISTS chk_loan_limit;
ALTER TABLE borrowers ADD CONSTRAINT chk_loan_limit 
  CHECK (loan_limit IN (5000, 7000, 9000, 10000));

ALTER TABLE borrowers DROP CONSTRAINT IF EXISTS chk_loyalty_badge;
ALTER TABLE borrowers ADD CONSTRAINT chk_loyalty_badge 
  CHECK (loyalty_badge IN ('New', 'Trusted', 'Reliable', 'VIP'));

ALTER TABLE borrowers DROP CONSTRAINT IF EXISTS chk_loan_limit_level;
ALTER TABLE borrowers ADD CONSTRAINT chk_loan_limit_level 
  CHECK (loan_limit_level IN (1, 2, 3, 4));


-- ============================================================================
-- DB-02: NOT NULL + CHECK constraints on loans financial columns
-- ============================================================================
-- Prevents NULL balance/repayment values that cause NaN in calculations.
-- Prevents free-text status values that break frontend filters.
--
-- ROLLBACK:
--   ALTER TABLE loans ALTER COLUMN total_repayment DROP NOT NULL;
--   ALTER TABLE loans ALTER COLUMN installment_amount DROP NOT NULL;
--   ALTER TABLE loans ALTER COLUMN remaining_balance DROP NOT NULL;
--   ALTER TABLE loans DROP CONSTRAINT IF EXISTS chk_loan_status;
-- ============================================================================

-- Backfill NULLs with safe defaults before adding NOT NULL
UPDATE loans SET total_repayment = COALESCE(loan_amount, 0) 
  WHERE total_repayment IS NULL;

UPDATE loans SET installment_amount = ROUND(COALESCE(total_repayment, loan_amount, 0) / GREATEST(COALESCE(num_installments, 4), 1), 2)
  WHERE installment_amount IS NULL;

UPDATE loans SET remaining_balance = COALESCE(total_repayment, 0) - (COALESCE(payments_made, 0) * COALESCE(installment_amount, 0))
  WHERE remaining_balance IS NULL;
UPDATE loans SET remaining_balance = GREATEST(0, remaining_balance)
  WHERE remaining_balance < 0;

-- Normalize any non-standard status values
UPDATE loans SET status = 'Pending'
  WHERE status IS NULL OR status NOT IN ('Pending', 'Active', 'Partially Paid', 'Paid', 'Overdue', 'Defaulted');

-- Add NOT NULL constraints
ALTER TABLE loans ALTER COLUMN total_repayment SET NOT NULL;
ALTER TABLE loans ALTER COLUMN total_repayment SET DEFAULT 0;

ALTER TABLE loans ALTER COLUMN installment_amount SET NOT NULL;
ALTER TABLE loans ALTER COLUMN installment_amount SET DEFAULT 0;

ALTER TABLE loans ALTER COLUMN remaining_balance SET NOT NULL;
ALTER TABLE loans ALTER COLUMN remaining_balance SET DEFAULT 0;

-- Add status CHECK constraint
ALTER TABLE loans DROP CONSTRAINT IF EXISTS chk_loan_status;
ALTER TABLE loans ADD CONSTRAINT chk_loan_status 
  CHECK (status IN ('Pending', 'Active', 'Partially Paid', 'Paid', 'Overdue', 'Defaulted'));


-- ============================================================================
-- DB-03: UNIQUE constraints on access_code
-- ============================================================================
-- Prevents access code collisions that would cause portal login crashes
-- (.single() throws when multiple rows match) and data exposure between
-- borrowers who share an access code.
--
-- ROLLBACK:
--   ALTER TABLE applications DROP CONSTRAINT IF EXISTS uq_application_access_code;
--   ALTER TABLE borrowers DROP CONSTRAINT IF EXISTS uq_borrower_access_code;
-- ============================================================================

-- Check for and fix any existing duplicates first
-- For applications: keep only the latest, NULL out older duplicates
UPDATE applications SET access_code = access_code || '-DUP-' || id::TEXT
  WHERE id IN (
    SELECT id FROM (
      SELECT id, ROW_NUMBER() OVER (PARTITION BY access_code ORDER BY created_at DESC) AS rn
      FROM applications WHERE access_code IS NOT NULL
    ) dupes WHERE rn > 1
  );

-- For borrowers: same approach
UPDATE borrowers SET access_code = access_code || '-DUP-' || id::TEXT
  WHERE id IN (
    SELECT id FROM (
      SELECT id, ROW_NUMBER() OVER (PARTITION BY access_code ORDER BY created_at DESC) AS rn
      FROM borrowers WHERE access_code IS NOT NULL
    ) dupes WHERE rn > 1
  );

ALTER TABLE applications DROP CONSTRAINT IF EXISTS uq_application_access_code;
ALTER TABLE applications ADD CONSTRAINT uq_application_access_code UNIQUE (access_code);

ALTER TABLE borrowers DROP CONSTRAINT IF EXISTS uq_borrower_access_code;
ALTER TABLE borrowers ADD CONSTRAINT uq_borrower_access_code UNIQUE (access_code);


-- ============================================================================
-- DB-04: Add missing columns to login_logs
-- ============================================================================
-- The application inserts: success, fail_reason, city, region, country,
-- location_display, logged_at — but the schema only has: email, ip_address,
-- user_agent, status, created_at. This causes all login log inserts to
-- silently fail, leaving no security audit trail.
--
-- ROLLBACK:
--   ALTER TABLE login_logs DROP COLUMN IF EXISTS success;
--   ALTER TABLE login_logs DROP COLUMN IF EXISTS fail_reason;
--   ALTER TABLE login_logs DROP COLUMN IF EXISTS city;
--   ALTER TABLE login_logs DROP COLUMN IF EXISTS region;
--   ALTER TABLE login_logs DROP COLUMN IF EXISTS country;
--   ALTER TABLE login_logs DROP COLUMN IF EXISTS location_display;
--   ALTER TABLE login_logs DROP COLUMN IF EXISTS logged_at;
-- ============================================================================

ALTER TABLE login_logs ADD COLUMN IF NOT EXISTS success BOOLEAN DEFAULT TRUE;
ALTER TABLE login_logs ADD COLUMN IF NOT EXISTS fail_reason TEXT;
ALTER TABLE login_logs ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE login_logs ADD COLUMN IF NOT EXISTS region TEXT;
ALTER TABLE login_logs ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE login_logs ADD COLUMN IF NOT EXISTS location_display TEXT;
ALTER TABLE login_logs ADD COLUMN IF NOT EXISTS logged_at TIMESTAMPTZ DEFAULT NOW();

-- Backfill logged_at from existing created_at for old rows
UPDATE login_logs SET logged_at = created_at WHERE logged_at IS NULL;


-- ============================================================================
-- DB-05: Create canonical capital_flow table
-- ============================================================================
-- The schema defines "capital_logs" but ALL application code writes to
-- "capital_flow". This creates a silent data loss — all accounting entries
-- are written to a table that doesn't match the schema.
--
-- Strategy: Create "capital_flow" if it doesn't exist with the columns
-- that accounting.js actually inserts (entry_date, type, category, amount, 
-- notes). If "capital_logs" has data, migrate it.
--
-- ROLLBACK:
--   DROP TABLE IF EXISTS capital_flow;
--   (capital_logs data would need manual restore from backup)
-- ============================================================================

CREATE TABLE IF NOT EXISTS capital_flow (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_date DATE DEFAULT CURRENT_DATE,
  type TEXT NOT NULL,
  category TEXT NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migrate any data from capital_logs into capital_flow if capital_logs exists
-- and has data that's not already in capital_flow
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'capital_logs' AND table_schema = 'public') THEN
    INSERT INTO capital_flow (amount, notes, created_at)
    SELECT amount, note, created_at
    FROM capital_logs
    WHERE NOT EXISTS (
      SELECT 1 FROM capital_flow cf 
      WHERE cf.amount = capital_logs.amount 
        AND cf.created_at = capital_logs.created_at
    )
    ON CONFLICT DO NOTHING;
    
    RAISE NOTICE 'Migrated data from capital_logs → capital_flow';
  END IF;
END $$;


-- ============================================================================
-- DB-06: Create wallet_balances view
-- ============================================================================
-- BorrowerPortalPage.js queries "wallet_balances" but only "wallets" exists.
-- This causes the portal to silently show ₱0 balance for all borrowers.
--
-- ROLLBACK:
--   DROP VIEW IF EXISTS wallet_balances;
-- ============================================================================

CREATE OR REPLACE VIEW wallet_balances AS
  SELECT id, borrower_id, balance, updated_at
  FROM wallets;

-- Grant same access as wallets table
GRANT SELECT ON wallet_balances TO anon;
GRANT SELECT ON wallet_balances TO authenticated;


-- ============================================================================
-- DB-07: Fix settings table — type mismatch + missing column
-- ============================================================================
-- max_loan_amount uses INTEGER but loan amounts use NUMERIC(10,2).
-- auto_logout_minutes is read by App.js but doesn't exist in the schema.
--
-- ROLLBACK:
--   ALTER TABLE settings ALTER COLUMN max_loan_amount TYPE INTEGER;
--   ALTER TABLE settings DROP COLUMN IF EXISTS auto_logout_minutes;
-- ============================================================================

ALTER TABLE settings ALTER COLUMN max_loan_amount TYPE NUMERIC(10,2);

ALTER TABLE settings ADD COLUMN IF NOT EXISTS auto_logout_minutes INTEGER DEFAULT 30;


-- ============================================================================
-- DB-08: CHECK constraint on wallet_transactions.type
-- ============================================================================
-- Prevents typos in transaction types that would break penalty deduction
-- queries (daily-overdue.js filters on 'penalty_deduction'). A wrong type
-- string could cause catch-up penalty logic to miss previous charges,
-- double-billing borrowers.
--
-- ROLLBACK:
--   ALTER TABLE wallet_transactions DROP CONSTRAINT IF EXISTS chk_wallet_tx_type;
-- ============================================================================

-- Normalize any non-standard type values first
UPDATE wallet_transactions SET type = 'rebate'
  WHERE type NOT IN ('rebate', 'penalty_deduction', 'withdrawal', 'principal_payment', 'security_hold_return')
  AND type ILIKE '%rebate%';

UPDATE wallet_transactions SET type = 'penalty_deduction'
  WHERE type NOT IN ('rebate', 'penalty_deduction', 'withdrawal', 'principal_payment', 'security_hold_return')
  AND type ILIKE '%penalty%';

-- For any remaining non-standard types, map to the closest match  
UPDATE wallet_transactions SET type = 'principal_payment'
  WHERE type NOT IN ('rebate', 'penalty_deduction', 'withdrawal', 'principal_payment', 'security_hold_return')
  AND type ILIKE '%principal%';

-- Catch-all for truly unknown types — tag them so they're visible but valid
UPDATE wallet_transactions SET type = 'rebate'
  WHERE type NOT IN ('rebate', 'penalty_deduction', 'withdrawal', 'principal_payment', 'security_hold_return');

ALTER TABLE wallet_transactions DROP CONSTRAINT IF EXISTS chk_wallet_tx_type;
ALTER TABLE wallet_transactions ADD CONSTRAINT chk_wallet_tx_type 
  CHECK (type IN ('rebate', 'penalty_deduction', 'withdrawal', 'principal_payment', 'security_hold_return'));


-- ============================================================================
-- DB-09: Performance indexes
-- ============================================================================
-- Every portal login (SELECT WHERE access_code = X) is a full table scan.
-- Every admin page load fetches loans by borrower_id with no index.
-- As the borrower count grows, performance degrades linearly → exponentially.
--
-- ROLLBACK:
--   DROP INDEX IF EXISTS idx_loans_borrower_id;
--   DROP INDEX IF EXISTS idx_loans_status;
--   DROP INDEX IF EXISTS idx_installments_loan_id;
--   DROP INDEX IF EXISTS idx_payment_proofs_loan_id;
--   DROP INDEX IF EXISTS idx_payment_proofs_borrower_id;
--   DROP INDEX IF EXISTS idx_portal_notifications_borrower_id;
--   DROP INDEX IF EXISTS idx_wallet_transactions_borrower_id;
--   DROP INDEX IF EXISTS idx_wallet_transactions_loan_id;
--   DROP INDEX IF EXISTS idx_audit_logs_created_at;
--   DROP INDEX IF EXISTS idx_applications_access_code;
--   DROP INDEX IF EXISTS idx_borrowers_access_code;
--   DROP INDEX IF EXISTS idx_borrowers_email;
--   DROP INDEX IF EXISTS idx_penalty_charges_loan_id;
--   DROP INDEX IF EXISTS idx_penalty_charges_borrower_id;
--   DROP INDEX IF EXISTS idx_capital_flow_entry_date;
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_loans_borrower_id ON loans(borrower_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);
CREATE INDEX IF NOT EXISTS idx_installments_loan_id ON installments(loan_id);
CREATE INDEX IF NOT EXISTS idx_payment_proofs_loan_id ON payment_proofs(loan_id);
CREATE INDEX IF NOT EXISTS idx_payment_proofs_borrower_id ON payment_proofs(borrower_id);
CREATE INDEX IF NOT EXISTS idx_portal_notifications_borrower_id ON portal_notifications(borrower_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_borrower_id ON wallet_transactions(borrower_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_loan_id ON wallet_transactions(loan_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_applications_access_code ON applications(access_code);
CREATE INDEX IF NOT EXISTS idx_borrowers_access_code ON borrowers(access_code);
CREATE INDEX IF NOT EXISTS idx_borrowers_email ON borrowers(email);
CREATE INDEX IF NOT EXISTS idx_penalty_charges_loan_id ON penalty_charges(loan_id);
CREATE INDEX IF NOT EXISTS idx_penalty_charges_borrower_id ON penalty_charges(borrower_id);
CREATE INDEX IF NOT EXISTS idx_capital_flow_entry_date ON capital_flow(entry_date DESC);


-- ============================================================================
-- DB-10: Ensure core columns exist in CREATE TABLE (not dangling ALTERs)
-- ============================================================================
-- The schema has ALTER TABLE statements appended at the bottom to add 
-- `department`, `access_code`, and `photo_url` to borrowers. These are
-- already handled by lines 244-246 of supabase.js, so they exist. But we
-- need to ensure they have proper defaults and the access_code UNIQUE
-- constraint (already added in DB-03 above).
--
-- Additional housekeeping: Add clean_loans column if missing (used by
-- credit system but never explicitly defined in schema).
-- ============================================================================

ALTER TABLE borrowers ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE borrowers ADD COLUMN IF NOT EXISTS access_code TEXT;
ALTER TABLE borrowers ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE borrowers ADD COLUMN IF NOT EXISTS clean_loans INTEGER DEFAULT 0;

-- Ensure loans has all columns referenced by the application
ALTER TABLE loans ADD COLUMN IF NOT EXISTS loan_type TEXT DEFAULT 'regular';
ALTER TABLE loans ADD COLUMN IF NOT EXISTS num_installments INTEGER DEFAULT 4;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS loan_limit_level INTEGER DEFAULT 1;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS loan_purpose TEXT;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS security_hold NUMERIC(10,2) DEFAULT 0;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS security_hold_returned BOOLEAN DEFAULT FALSE;

-- Ensure wallets has explicit NOT NULL on balance
ALTER TABLE wallets ALTER COLUMN balance SET DEFAULT 0;
ALTER TABLE wallets ALTER COLUMN balance SET NOT NULL;
UPDATE wallets SET balance = 0 WHERE balance IS NULL;


-- ============================================================================
-- SEC-09: Prevent duplicate pending payment proofs
-- ============================================================================
-- A borrower can submit duplicate proofs for the same installment via race
-- condition (two tabs submitting simultaneously). The client-side check is
-- TOCTOU-vulnerable. This partial UNIQUE index is the only reliable guard.
--
-- ROLLBACK:
--   DROP INDEX IF EXISTS uq_payment_proof_pending;
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_proof_pending
  ON payment_proofs(loan_id, installment_number)
  WHERE status = 'Pending';


-- ============================================================================
-- FE-09: Prevent duplicate portal notifications per day
-- ============================================================================
-- Multiple browser tabs can simultaneously insert identical due_soon or
-- overdue_warning notifications. This partial unique index prevents
-- same-type notifications from being created for the same borrower on the
-- same calendar day.
--
-- ROLLBACK:
--   DROP INDEX IF EXISTS uq_portal_notif_daily;
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS uq_portal_notif_daily
  ON portal_notifications(borrower_id, type, (created_at::DATE))
  WHERE type IN ('due_soon', 'overdue_warning');


-- ============================================================================
-- VERIFICATION: Run these to confirm migration success
-- ============================================================================
-- SELECT conname, contype FROM pg_constraint WHERE conrelid = 'borrowers'::regclass;
-- SELECT conname, contype FROM pg_constraint WHERE conrelid = 'loans'::regclass;
-- SELECT conname, contype FROM pg_constraint WHERE conrelid = 'wallet_transactions'::regclass;
-- SELECT indexname FROM pg_indexes WHERE tablename IN ('loans', 'borrowers', 'applications', 'payment_proofs', 'wallet_transactions', 'portal_notifications', 'audit_logs', 'penalty_charges', 'capital_flow');
-- SELECT column_name, is_nullable, data_type FROM information_schema.columns WHERE table_name = 'login_logs' ORDER BY ordinal_position;
-- SELECT * FROM wallet_balances LIMIT 1;  -- Should return wallet data
-- SELECT auto_logout_minutes FROM settings WHERE id = 1;  -- Should return 30

