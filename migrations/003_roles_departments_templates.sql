-- ============================================================================
-- 003: Dynamic Departments + Email Templates
-- ============================================================================
-- Run in Supabase SQL Editor. Each section is idempotent (safe to re-run).
-- ============================================================================


-- ============================================================================
-- PART A: Dynamic Departments
-- ============================================================================

CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Real departments sourced from applications table (normalized — trimmed spaces + proper casing)
INSERT INTO departments (name, sort_order) VALUES
  ('Essential Lending', 1),
  ('Gallery Furniture', 2),
  ('605 Lending', 3),
  ('Shared Group', 4),
  ('Admin', 5),
  ('Allied One Source', 6),
  ('Answering Service', 7),
  ('Caliber', 8),
  ('CashLink USA', 9),
  ('Centrinex Shared Group SG1', 10),
  ('Centrinex: Shared Group: Mindpath Health', 11),
  ('Credit Serve', 12),
  ('CSR', 13),
  ('Greyhound', 14),
  ('JnJ', 15),
  ('Minto Money', 16),
  ('Pine Lending', 17),
  ('RV Depot', 18)
ON CONFLICT (name) DO NOTHING;

ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_departments" ON departments;
CREATE POLICY "public_read_departments" ON departments
  FOR SELECT USING (active = TRUE);

DROP POLICY IF EXISTS "admin_all_departments" ON departments;
CREATE POLICY "admin_all_departments" ON departments
  FOR ALL USING (auth.role() = 'authenticated');


-- ============================================================================
-- PART B: Email Templates
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  subject TEXT NOT NULL,
  html_body TEXT NOT NULL,
  variables JSONB DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO email_templates (type, label, subject, html_body, variables) VALUES
  ('loan_approved',     'Loan Approval',     'Your MoneyfestLending Loan Has Been Approved! 🎉',       '__DEFAULT__', '["borrowerName","loanAmount","accessCode","releaseDate","loanType","installmentAmount","totalRepayment","loanTerm","numInstallments"]'),
  ('loan_rejected',     'Loan Rejection',    'Update on Your MoneyfestLending Application',            '__DEFAULT__', '["borrowerName","loanAmount","loanType","reason"]'),
  ('payment_confirmed', 'Payment Confirmed', '✅ Payment Confirmed — Installment {{installmentNum}}',  '__DEFAULT__', '["borrowerName","installmentNum","numInstallments","amountPaid","paymentDate","remainingBalance","loanFullyPaid","accessCode"]'),
  ('payment_reminder',  'Payment Reminder',  '⏰ Payment Reminder — {{borrowerName}}',                 '__DEFAULT__', '["borrowerName","dueDate","amount","accessCode"]'),
  ('tier_upgrade',      'Tier Upgrade',      '🎉 You''ve Been Upgraded — {{borrowerName}}',            '__DEFAULT__', '["borrowerName","newBadge","newLimit","accessCode"]')
ON CONFLICT (type) DO NOTHING;

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_templates" ON email_templates;
CREATE POLICY "admin_all_templates" ON email_templates
  FOR ALL USING (auth.role() = 'authenticated');


-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- SELECT * FROM departments ORDER BY sort_order;
-- SELECT type, label, subject FROM email_templates;



-- ============================================================================
-- PART A: Dynamic Departments
-- ============================================================================

CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed departments (update names to match your company)
INSERT INTO departments (name, sort_order) VALUES
  ('Minto Money', 1),
  ('Greyhound', 2),
  ('Operations', 3),
  ('Finance', 4),
  ('HR', 5),
  ('IT', 6)
ON CONFLICT (name) DO NOTHING;

ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_departments" ON departments;
CREATE POLICY "public_read_departments" ON departments
  FOR SELECT USING (active = TRUE);

DROP POLICY IF EXISTS "admin_all_departments" ON departments;
CREATE POLICY "admin_all_departments" ON departments
  FOR ALL USING (auth.role() = 'authenticated');


-- ============================================================================
-- PART B: Email Templates
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  subject TEXT NOT NULL,
  html_body TEXT NOT NULL,
  variables JSONB DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed with current template subjects (html_body will be populated by the app)
INSERT INTO email_templates (type, label, subject, html_body, variables) VALUES
  ('loan_approved',     'Loan Approval',        'Your MoneyfestLending Loan Has Been Approved! 🎉',  '__DEFAULT__', '["borrowerName","loanAmount","accessCode","releaseDate","loanType","installmentAmount","totalRepayment","loanTerm","numInstallments"]'),
  ('loan_rejected',     'Loan Rejection',        'Update on Your MoneyfestLending Application',       '__DEFAULT__', '["borrowerName","loanAmount","loanType","reason"]'),
  ('payment_confirmed', 'Payment Confirmed',     '✅ Payment Confirmed — Installment {{installmentNum}}', '__DEFAULT__', '["borrowerName","installmentNum","numInstallments","amountPaid","paymentDate","remainingBalance","loanFullyPaid","accessCode"]'),
  ('payment_reminder',  'Payment Reminder',      '⏰ Payment Reminder — {{borrowerName}}',            '__DEFAULT__', '["borrowerName","dueDate","amount","accessCode"]'),
  ('tier_upgrade',      'Tier Upgrade',          '🎉 Congratulations! You''ve Been Upgraded — {{borrowerName}}', '__DEFAULT__', '["borrowerName","newBadge","newLimit","accessCode"]')
ON CONFLICT (type) DO NOTHING;

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_templates" ON email_templates;
CREATE POLICY "admin_all_templates" ON email_templates
  FOR ALL USING (auth.role() = 'authenticated');


-- ============================================================================
-- PART C: Role-Based Permissions
-- ============================================================================

CREATE TABLE IF NOT EXISTS admin_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

ALTER TABLE admin_roles DROP CONSTRAINT IF EXISTS chk_admin_role;
ALTER TABLE admin_roles ADD CONSTRAINT chk_admin_role
  CHECK (role IN ('superadmin', 'approver', 'collector', 'viewer'));

ALTER TABLE admin_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_read_roles" ON admin_roles;
CREATE POLICY "admin_read_roles" ON admin_roles
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "superadmin_manage_roles" ON admin_roles;
CREATE POLICY "superadmin_manage_roles" ON admin_roles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM admin_roles
      WHERE user_id = auth.uid() AND role = 'superadmin'
    )
  );

-- ============================================================================
-- SEED: Your account as superadmin (UID confirmed from your session)
-- ============================================================================
INSERT INTO admin_roles (user_id, role)
VALUES ('5fd216c0-20f6-4d43-acb0-999eac4b71df', 'superadmin')
ON CONFLICT (user_id) DO UPDATE SET role = 'superadmin';


-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- SELECT * FROM departments ORDER BY sort_order;
-- SELECT type, label, subject FROM email_templates;
-- SELECT user_id, role FROM admin_roles;
