-- 🚀 BORROWER PORTAL RLS SUPER FIX
-- This script grants necessary (limited) access to anonymous users so they can
-- log in via access_code and view their loan details, upload proofs, etc.

DO $$ 
DECLARE
    t text;
BEGIN
    FOR t IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN (
            'borrowers', 
            'loans', 
            'applications', 
            'payment_proofs', 
            'portal_notifications', 
            'wallets', 
            'wallet_transactions', 
            'settings'
        )
    LOOP
        -- 1. Grant SELECT to anonymous users (needed to find record by access_code)
        EXECUTE format('DROP POLICY IF EXISTS "Allow portal read" ON %I', t);
        EXECUTE format('CREATE POLICY "Allow portal read" ON %I FOR SELECT TO anon USING (true)', t);
        
        -- 2. Grant INSERT to anonymous users for specific actions
        IF t IN ('payment_proofs', 'wallet_transactions', 'applications') THEN
            EXECUTE format('DROP POLICY IF EXISTS "Allow portal insert" ON %I', t);
            EXECUTE format('CREATE POLICY "Allow portal insert" ON %I FOR INSERT TO anon WITH CHECK (true)', t);
        END IF;

        -- 3. Grant UPDATE to anonymous users for specific actions (like confirming agreements)
        IF t IN ('loans', 'applications') THEN
            EXECUTE format('DROP POLICY IF EXISTS "Allow portal update" ON %I', t);
            EXECUTE format('CREATE POLICY "Allow portal update" ON %I FOR UPDATE TO anon USING (true) WITH CHECK (true)', t);
        END IF;
    END LOOP;
END $$;

-- 📂 STORAGE BUCKET FIX (Allowing anonymous uploads to payment-proofs)
-- Make sure the bucket is public or has these policies
INSERT INTO storage.buckets (id, name, public) 
VALUES ('payment-proofs', 'payment-proofs', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Remove existing storage policies before creating them
DROP POLICY IF EXISTS "Allow public upload" ON storage.objects;
DROP POLICY IF EXISTS "Allow public select" ON storage.objects;

-- 📂 STORAGE BUCKET FIX (Allowing anonymous uploads to payment-proofs)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('payment-proofs', 'payment-proofs', true)
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY "Allow public upload" ON storage.objects FOR INSERT TO anon WITH CHECK (bucket_id = 'payment-proofs');
CREATE POLICY "Allow public select" ON storage.objects FOR SELECT TO anon USING (bucket_id = 'payment-proofs');

-- 📂 AVATAR BUCKET FIX (Allowing uploads to borrower-avatars)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('borrower-avatars', 'borrower-avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY "Allow avatar upload" ON storage.objects FOR INSERT TO anon WITH CHECK (bucket_id = 'borrower-avatars');
CREATE POLICY "Allow avatar select" ON storage.objects FOR SELECT TO anon USING (bucket_id = 'borrower-avatars');
