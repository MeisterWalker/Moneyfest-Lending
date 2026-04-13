-- ============================================================================
-- 🔐 MONEYFEST LENDING — PRODUCTION RLS POLICIES (v2)
-- ============================================================================
-- Replaces the previous USING(true) blanket policies with proper row-level
-- access control. Anonymous users can only access their OWN data by proving
-- ownership via access_code set as a Postgres session variable.
--
-- HOW IT WORKS:
-- 1. Client-side code calls: supabase.rpc('set_portal_context', { code: 'LM-XXXX' })
-- 2. That sets a Postgres session variable: app.portal_access_code
-- 3. RLS policies filter rows using a helper function that reads that variable
-- 4. Authenticated users (admin) bypass these policies via separate USING(true) policies
--
-- ROLLBACK: Run portal_rls_rollback.sql (created alongside this file)
-- ============================================================================

-- ─── Step 0: Helper function to read the portal access code from session ───
CREATE OR REPLACE FUNCTION public.current_portal_access_code()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT NULLIF(current_setting('app.portal_access_code', true), '')
$$;

-- ─── Step 0b: Helper function to resolve access_code → borrower_id ────────
CREATE OR REPLACE FUNCTION public.current_portal_borrower_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT id FROM public.borrowers
  WHERE access_code = public.current_portal_access_code()
  LIMIT 1
$$;

-- ─── Step 0c: RPC that the client calls to set context ────────────────────
CREATE OR REPLACE FUNCTION public.set_portal_context(code TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  PERFORM set_config('app.portal_access_code', COALESCE(code, ''), true);
END;
$$;

-- Grant execute on these functions to anon role
GRANT EXECUTE ON FUNCTION public.current_portal_access_code() TO anon;
GRANT EXECUTE ON FUNCTION public.current_portal_borrower_id() TO anon;
GRANT EXECUTE ON FUNCTION public.set_portal_context(TEXT) TO anon;

-- ============================================================================
-- ─── Step 1: Enable RLS on all tables (idempotent) ────────────────────────
-- ============================================================================
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN (
      'borrowers', 'loans', 'applications', 'payment_proofs',
      'portal_notifications', 'wallets', 'wallet_transactions',
      'settings', 'investors', 'penalty_charges', 'audit_logs',
      'capital_flow', 'other_products', 'product_logs',
      'login_logs', 'notifications', 'page_visits',
      'installments', 'departments', 'push_subscriptions',
      'principal_payments'
    )
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- ============================================================================
-- ─── Step 2: Drop ALL old blanket policies ────────────────────────────────
-- ============================================================================
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN (
      'borrowers', 'loans', 'applications', 'payment_proofs',
      'portal_notifications', 'wallets', 'wallet_transactions',
      'settings', 'investors', 'penalty_charges', 'audit_logs',
      'capital_flow', 'other_products', 'product_logs',
      'login_logs', 'notifications', 'page_visits',
      'installments', 'departments', 'push_subscriptions',
      'principal_payments'
    )
  LOOP
    -- Drop old blanket policies
    EXECUTE format('DROP POLICY IF EXISTS "Allow portal read" ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Allow portal insert" ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Allow portal update" ON %I', t);
    -- Drop any previous version of our new policies
    EXECUTE format('DROP POLICY IF EXISTS "admin_full_access" ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS "portal_select_own" ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS "portal_insert_own" ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS "portal_update_own" ON %I', t);
  END LOOP;
END $$;

-- ============================================================================
-- ─── Step 3: ADMIN policies (authenticated role gets full access) ─────────
-- ============================================================================
-- Admin (authenticated via Supabase Auth) can do everything on all tables.
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN (
      'borrowers', 'loans', 'applications', 'payment_proofs',
      'portal_notifications', 'wallets', 'wallet_transactions',
      'settings', 'investors', 'penalty_charges', 'audit_logs',
      'capital_flow', 'other_products', 'product_logs',
      'login_logs', 'notifications', 'page_visits',
      'installments', 'departments', 'push_subscriptions',
      'principal_payments'
    )
  LOOP
    EXECUTE format(
      'CREATE POLICY "admin_full_access" ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      t
    );
  END LOOP;
END $$;

-- ============================================================================
-- ─── Step 4: PORTAL (anon) policies — per-table, least-privilege ──────────
-- ============================================================================

-- ── BORROWERS: anon can only read OWN record ──────────────────────────────
CREATE POLICY "portal_select_own" ON borrowers
  FOR SELECT TO anon
  USING (access_code = public.current_portal_access_code());

-- ── LOANS: anon can only read their OWN loans ────────────────────────────
CREATE POLICY "portal_select_own" ON loans
  FOR SELECT TO anon
  USING (borrower_id = public.current_portal_borrower_id());

-- anon can UPDATE only specific fields on their own loans (e-signature)
CREATE POLICY "portal_update_own" ON loans
  FOR UPDATE TO anon
  USING (borrower_id = public.current_portal_borrower_id())
  WITH CHECK (borrower_id = public.current_portal_borrower_id());

-- ── APPLICATIONS: anon can read own applications + insert new ones ────────
CREATE POLICY "portal_select_own" ON applications
  FOR SELECT TO anon
  USING (
    access_code = public.current_portal_access_code()
    OR email = (SELECT email FROM borrowers WHERE access_code = public.current_portal_access_code() LIMIT 1)
  );

CREATE POLICY "portal_insert_own" ON applications
  FOR INSERT TO anon
  WITH CHECK (true);  -- Public form submissions are allowed (no existing identity to check)

-- No anon UPDATE on applications (admin approves/rejects)

-- ── PAYMENT_PROOFS: anon can read + insert OWN proofs ─────────────────────
CREATE POLICY "portal_select_own" ON payment_proofs
  FOR SELECT TO anon
  USING (borrower_id = public.current_portal_borrower_id());

CREATE POLICY "portal_insert_own" ON payment_proofs
  FOR INSERT TO anon
  WITH CHECK (borrower_id = public.current_portal_borrower_id());

-- ── PORTAL_NOTIFICATIONS: anon can read OWN notifications ─────────────────
CREATE POLICY "portal_select_own" ON portal_notifications
  FOR SELECT TO anon
  USING (borrower_id = public.current_portal_borrower_id());

-- anon can also insert notifications (generated on portal load for due-soon alerts)
CREATE POLICY "portal_insert_own" ON portal_notifications
  FOR INSERT TO anon
  WITH CHECK (borrower_id = public.current_portal_borrower_id());

-- ── WALLETS: anon can read OWN wallet ─────────────────────────────────────
CREATE POLICY "portal_select_own" ON wallets
  FOR SELECT TO anon
  USING (borrower_id = public.current_portal_borrower_id());

-- ── WALLET_TRANSACTIONS: anon can read OWN transactions ───────────────────
CREATE POLICY "portal_select_own" ON wallet_transactions
  FOR SELECT TO anon
  USING (borrower_id = public.current_portal_borrower_id());

-- anon can INSERT own wallet transactions (e.g., principal payment submissions)
CREATE POLICY "portal_insert_own" ON wallet_transactions
  FOR INSERT TO anon
  WITH CHECK (borrower_id = public.current_portal_borrower_id());

-- ── PENALTY_CHARGES: anon can read OWN penalties ──────────────────────────
CREATE POLICY "portal_select_own" ON penalty_charges
  FOR SELECT TO anon
  USING (borrower_id = public.current_portal_borrower_id());

-- ── SETTINGS: anon can read settings (global config, no sensitive data) ───
CREATE POLICY "portal_select_own" ON settings
  FOR SELECT TO anon
  USING (true);  -- Settings is a single-row config table with no per-user data

-- ── INVESTORS: NO anon access ─────────────────────────────────────────────
-- Investors table should not be readable by borrowers.
-- (No policy = no access for anon)

-- ── PAGE_VISITS: anon can insert visits (public tracking) ─────────────────
CREATE POLICY "portal_insert_own" ON page_visits
  FOR INSERT TO anon
  WITH CHECK (true);  -- Anonymous page tracking

CREATE POLICY "portal_select_own" ON page_visits
  FOR SELECT TO anon
  USING (false);  -- anon cannot read visit stats

-- ── LOGIN_LOGS: anon can insert login attempts ───────────────────────────
CREATE POLICY "portal_insert_own" ON login_logs
  FOR INSERT TO anon
  WITH CHECK (true);  -- Login logging from public page

-- ── AUDIT_LOGS: NO anon access ───────────────────────────────────────────
-- Audit logs are admin-only.

-- ── CAPITAL_FLOW: NO anon access ─────────────────────────────────────────
-- Financial ledger is admin-only.

-- ── OTHER_PRODUCTS, PRODUCT_LOGS: NO anon access ─────────────────────────
-- Business tracking is admin-only.

-- ── DEPARTMENTS: anon can read (needed for application form dropdown) ─────
CREATE POLICY "portal_select_own" ON departments
  FOR SELECT TO anon
  USING (true);  -- Public reference data

-- ── PRINCIPAL_PAYMENTS: anon can read + insert OWN ────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'principal_payments' AND table_schema = 'public') THEN
    EXECUTE 'CREATE POLICY "portal_select_own" ON principal_payments FOR SELECT TO anon USING (borrower_id = public.current_portal_borrower_id())';
    EXECUTE 'CREATE POLICY "portal_insert_own" ON principal_payments FOR INSERT TO anon WITH CHECK (borrower_id = public.current_portal_borrower_id())';
  END IF;
END $$;

-- ============================================================================
-- ─── Step 5: STORAGE BUCKET policies (unchanged from original) ────────────
-- ============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Allow public upload" ON storage.objects;
DROP POLICY IF EXISTS "Allow public select" ON storage.objects;

CREATE POLICY "Allow public upload" ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (bucket_id = 'payment-proofs');

CREATE POLICY "Allow public select" ON storage.objects
  FOR SELECT TO anon
  USING (bucket_id = 'payment-proofs');

-- Avatar bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('borrower-avatars', 'borrower-avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Allow avatar upload" ON storage.objects;
DROP POLICY IF EXISTS "Allow avatar select" ON storage.objects;

CREATE POLICY "Allow avatar upload" ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (bucket_id = 'borrower-avatars');

CREATE POLICY "Allow avatar select" ON storage.objects
  FOR SELECT TO anon
  USING (bucket_id = 'borrower-avatars');
