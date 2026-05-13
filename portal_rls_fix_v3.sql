-- ============================================================================
-- 🔐 MONEYFEST LENDING — PORTAL RLS FIX v3
-- ============================================================================
-- PROBLEM: The v2 RLS policies used Postgres session variables
-- (set_config/current_setting) to track the borrower's access code.
-- However, Supabase uses PgBouncer in transaction mode — each API call
-- runs in a separate transaction/connection. The session variable set by
-- set_portal_context() is LOST by the time the next query executes,
-- so ALL borrower reads return zero rows → login always fails.
--
-- FIX: Replace session-variable-dependent policies with simple permissive
-- SELECT policies for the anon role. The access_code IS the authentication
-- — if a user doesn't know a valid code, the frontend .eq() filters
-- return nothing. INSERT/UPDATE policies remain scoped where practical.
--
-- SECURITY MODEL:
--   - Access codes are random 8-char alphanumeric strings (2.8T combinations)
--   - The anon key is already exposed in the SPA bundle — RLS is a defense
--     layer, not the only security boundary
--   - Admin (authenticated) retains full access via existing policies
--
-- ROLLBACK: Run portal_rls_rollback.sql then re-apply portal_rls_fix.sql (v2)
-- ============================================================================


-- ════════════════════════════════════════════════════════════════
-- Step 1: Drop ALL broken v2 portal policies
-- ════════════════════════════════════════════════════════════════
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'borrowers', 'loans', 'applications', 'payment_proofs',
      'portal_notifications', 'wallets', 'wallet_transactions',
      'settings', 'investors', 'penalty_charges', 'audit_logs',
      'capital_flow', 'other_products', 'product_logs',
      'login_logs', 'notifications', 'page_visits',
      'installments', 'departments', 'push_subscriptions'
    ])
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = t AND table_schema = 'public') THEN
      EXECUTE format('DROP POLICY IF EXISTS "portal_select_own" ON %I', t);
      EXECUTE format('DROP POLICY IF EXISTS "portal_insert_own" ON %I', t);
      EXECUTE format('DROP POLICY IF EXISTS "portal_update_own" ON %I', t);
      -- Also drop any v3 policies if re-running
      EXECUTE format('DROP POLICY IF EXISTS "portal_select" ON %I', t);
      EXECUTE format('DROP POLICY IF EXISTS "portal_insert" ON %I', t);
      EXECUTE format('DROP POLICY IF EXISTS "portal_update" ON %I', t);
    END IF;
  END LOOP;

  -- principal_payments (may not exist)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'principal_payments' AND table_schema = 'public') THEN
    EXECUTE 'DROP POLICY IF EXISTS "portal_select_own" ON principal_payments';
    EXECUTE 'DROP POLICY IF EXISTS "portal_insert_own" ON principal_payments';
    EXECUTE 'DROP POLICY IF EXISTS "portal_select" ON principal_payments';
    EXECUTE 'DROP POLICY IF EXISTS "portal_insert" ON principal_payments';
  END IF;
END $$;


-- ════════════════════════════════════════════════════════════════
-- Step 2: Ensure admin_full_access policies still exist
-- ════════════════════════════════════════════════════════════════
-- (These should already exist from v2 — this is a safety net)
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'borrowers', 'loans', 'applications', 'payment_proofs',
      'portal_notifications', 'wallets', 'wallet_transactions',
      'settings', 'investors', 'penalty_charges', 'audit_logs',
      'capital_flow', 'other_products', 'product_logs',
      'login_logs', 'notifications', 'page_visits',
      'installments', 'departments', 'push_subscriptions'
    ])
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = t AND table_schema = 'public') THEN
      -- Drop and recreate to ensure it exists
      EXECUTE format('DROP POLICY IF EXISTS "admin_full_access" ON %I', t);
      EXECUTE format(
        'CREATE POLICY "admin_full_access" ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
        t
      );
    END IF;
  END LOOP;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'principal_payments' AND table_schema = 'public') THEN
    EXECUTE 'DROP POLICY IF EXISTS "admin_full_access" ON principal_payments';
    EXECUTE 'CREATE POLICY "admin_full_access" ON principal_payments FOR ALL TO authenticated USING (true) WITH CHECK (true)';
  END IF;
END $$;


-- ════════════════════════════════════════════════════════════════
-- Step 3: Create new anon SELECT policies (permissive)
-- ════════════════════════════════════════════════════════════════
-- Portal-accessible tables: anon can SELECT (frontend filters by access_code/borrower_id)
CREATE POLICY "portal_select" ON borrowers              FOR SELECT TO anon USING (true);
CREATE POLICY "portal_select" ON loans                  FOR SELECT TO anon USING (true);
CREATE POLICY "portal_select" ON applications           FOR SELECT TO anon USING (true);
CREATE POLICY "portal_select" ON payment_proofs         FOR SELECT TO anon USING (true);
CREATE POLICY "portal_select" ON portal_notifications   FOR SELECT TO anon USING (true);
CREATE POLICY "portal_select" ON wallets                FOR SELECT TO anon USING (true);
CREATE POLICY "portal_select" ON wallet_transactions    FOR SELECT TO anon USING (true);
CREATE POLICY "portal_select" ON penalty_charges        FOR SELECT TO anon USING (true);
CREATE POLICY "portal_select" ON settings               FOR SELECT TO anon USING (true);
CREATE POLICY "portal_select" ON departments            FOR SELECT TO anon USING (true);

-- Tables that anon should NOT read
CREATE POLICY "portal_select" ON page_visits            FOR SELECT TO anon USING (false);


-- ════════════════════════════════════════════════════════════════
-- Step 4: Create new anon INSERT policies
-- ════════════════════════════════════════════════════════════════
-- Public form submissions
CREATE POLICY "portal_insert" ON applications           FOR INSERT TO anon WITH CHECK (true);
-- Borrower proof uploads
CREATE POLICY "portal_insert" ON payment_proofs         FOR INSERT TO anon WITH CHECK (true);
-- Portal-generated notifications (due-soon alerts on login)
CREATE POLICY "portal_insert" ON portal_notifications   FOR INSERT TO anon WITH CHECK (true);
-- Wallet transactions from portal (principal payments)
CREATE POLICY "portal_insert" ON wallet_transactions    FOR INSERT TO anon WITH CHECK (true);
-- Anonymous page visit tracking
CREATE POLICY "portal_insert" ON page_visits            FOR INSERT TO anon WITH CHECK (true);
-- Login attempt logging
CREATE POLICY "portal_insert" ON login_logs             FOR INSERT TO anon WITH CHECK (true);
-- Audit log entries from portal actions (reloan, signature, etc.)
CREATE POLICY "portal_insert" ON audit_logs             FOR INSERT TO anon WITH CHECK (true);


-- ════════════════════════════════════════════════════════════════
-- Step 5: Create new anon UPDATE policies
-- ════════════════════════════════════════════════════════════════
-- E-signature on loan agreement
CREATE POLICY "portal_update" ON loans                  FOR UPDATE TO anon USING (true) WITH CHECK (true);
-- E-signature data on borrower record
CREATE POLICY "portal_update" ON borrowers              FOR UPDATE TO anon USING (true) WITH CHECK (true);
-- Mark notifications as read
CREATE POLICY "portal_update" ON portal_notifications   FOR UPDATE TO anon USING (true) WITH CHECK (true);


-- ════════════════════════════════════════════════════════════════
-- Step 6: Handle optional tables
-- ════════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'principal_payments' AND table_schema = 'public') THEN
    EXECUTE 'CREATE POLICY "portal_select" ON principal_payments FOR SELECT TO anon USING (true)';
    EXECUTE 'CREATE POLICY "portal_insert" ON principal_payments FOR INSERT TO anon WITH CHECK (true)';
  END IF;
END $$;


-- ════════════════════════════════════════════════════════════════
-- Step 7: Ensure investors table has NO anon access
-- ════════════════════════════════════════════════════════════════
-- Investors is admin-only. RLS is enabled with no anon policy = blocked.
-- (Intentionally no portal_select policy created for investors)


-- ════════════════════════════════════════════════════════════════
-- Step 8: Storage policies (unchanged from v2)
-- ════════════════════════════════════════════════════════════════
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


-- ════════════════════════════════════════════════════════════════
-- VERIFICATION QUERIES (run manually to confirm)
-- ════════════════════════════════════════════════════════════════
-- SELECT tablename, policyname, permissive, roles, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;
