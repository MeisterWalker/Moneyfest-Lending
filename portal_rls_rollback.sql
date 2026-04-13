-- ============================================================================
-- 🔙 ROLLBACK: Revert portal_rls_fix.sql v2 back to v1 (blanket policies)
-- ============================================================================
-- WARNING: This restores the INSECURE USING(true) policies. Only use this
-- if the new policies break portal functionality and you need to restore
-- service temporarily while debugging.
-- ============================================================================

-- Drop new policies
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
    EXECUTE format('DROP POLICY IF EXISTS "admin_full_access" ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS "portal_select_own" ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS "portal_insert_own" ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS "portal_update_own" ON %I', t);
  END LOOP;
END $$;

-- Drop helper functions
DROP FUNCTION IF EXISTS public.set_portal_context(TEXT);
DROP FUNCTION IF EXISTS public.current_portal_borrower_id();
DROP FUNCTION IF EXISTS public.current_portal_access_code();

-- NOTE: After running this rollback, you must re-apply the old portal_rls_fix.sql
-- (v1) if you want portal access to work. Without any policies, anon will have
-- NO access to any table (which is the safest default).
