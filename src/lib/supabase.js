import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || ''
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// SQL to run in Supabase SQL editor to create all tables:
export const SCHEMA_SQL = `
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Departments table
CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default departments (safe upsert)
INSERT INTO departments (name) VALUES ('Minto Money'), ('Greyhound')
ON CONFLICT (name) DO NOTHING;

-- Borrowers table
CREATE TABLE IF NOT EXISTS borrowers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name TEXT NOT NULL,
  department_id UUID REFERENCES departments(id),
  tenure_years NUMERIC(4,1) DEFAULT 0,
  address TEXT,
  phone TEXT,
  email TEXT,
  trustee_name TEXT,
  trustee_phone TEXT,
  trustee_relationship TEXT,
  credit_score INTEGER DEFAULT 750,
  risk_score TEXT DEFAULT 'Low',
  loyalty_badge TEXT DEFAULT 'New',
  loan_limit INTEGER DEFAULT 5000,
  loan_limit_level INTEGER DEFAULT 1,
  admin_notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Loans table
CREATE TABLE IF NOT EXISTS loans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  borrower_id UUID REFERENCES borrowers(id) ON DELETE CASCADE,
  loan_amount NUMERIC(10,2) NOT NULL,
  interest_rate NUMERIC(4,2) DEFAULT 0.07,
  total_repayment NUMERIC(10,2),
  installment_amount NUMERIC(10,2),
  release_date DATE NOT NULL,
  due_date DATE NOT NULL,
  payments_made INTEGER DEFAULT 0,
  remaining_balance NUMERIC(10,2),
  status TEXT DEFAULT 'Pending',
  agreement_confirmed BOOLEAN DEFAULT FALSE,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Installments table
CREATE TABLE IF NOT EXISTS installments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loan_id UUID REFERENCES loans(id) ON DELETE CASCADE,
  installment_number INTEGER NOT NULL,
  amount_due NUMERIC(10,2) NOT NULL,
  due_date DATE NOT NULL,
  paid_at TIMESTAMPTZ,
  is_paid BOOLEAN DEFAULT FALSE
);

-- Settings table
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  starting_capital NUMERIC(10,2) DEFAULT 30000,
  interest_rate NUMERIC(4,2) DEFAULT 0.07,
  max_loan_amount INTEGER DEFAULT 10000,
  reinvestment_mode BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT DEFAULT ''
);

-- Insert default settings
INSERT INTO settings (id, starting_capital, interest_rate, max_loan_amount, reinvestment_mode)
VALUES (1, 30000, 0.07, 10000, TRUE)
ON CONFLICT (id) DO NOTHING;

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action_type TEXT NOT NULL,
  module TEXT NOT NULL,
  description TEXT NOT NULL,
  changed_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Capital logs table
CREATE TABLE IF NOT EXISTS capital_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  amount NUMERIC(10,2) NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Applications table (public loan applications)
CREATE TABLE IF NOT EXISTS applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name TEXT NOT NULL,
  department TEXT,
  tenure_years NUMERIC(4,1) DEFAULT 0,
  phone TEXT,
  email TEXT,
  address TEXT,
  trustee_name TEXT,
  trustee_phone TEXT,
  trustee_relationship TEXT,
  loan_amount NUMERIC(10,2),
  loan_purpose TEXT,
  release_method TEXT,
  gcash_number TEXT,
  gcash_name TEXT,
  bank_name TEXT,
  bank_account_number TEXT,
  bank_account_holder TEXT,
  valid_id_path TEXT,
  valid_id_back_path TEXT,
  access_code TEXT,
  status TEXT DEFAULT 'Pending',
  rejection_reason TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment proofs table (borrower-uploaded screenshots)
CREATE TABLE IF NOT EXISTS payment_proofs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  borrower_id UUID REFERENCES borrowers(id) ON DELETE CASCADE,
  loan_id UUID REFERENCES loans(id) ON DELETE CASCADE,
  installment_number INTEGER NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT,
  notes TEXT,
  status TEXT DEFAULT 'Pending',
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Penalty charges table
CREATE TABLE IF NOT EXISTS penalty_charges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  borrower_id UUID REFERENCES borrowers(id) ON DELETE CASCADE,
  loan_id UUID REFERENCES loans(id) ON DELETE CASCADE,
  installment_number INTEGER NOT NULL,
  days_late INTEGER NOT NULL DEFAULT 0,
  penalty_per_day NUMERIC(10,2) DEFAULT 20,
  penalty_amount NUMERIC(10,2) NOT NULL,
  cap_applied BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Wallets table (rebate credits / security hold balance)
CREATE TABLE IF NOT EXISTS wallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  borrower_id UUID UNIQUE REFERENCES borrowers(id) ON DELETE CASCADE,
  balance NUMERIC(10,2) DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Wallet transactions table
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  borrower_id UUID REFERENCES borrowers(id) ON DELETE CASCADE,
  loan_id UUID REFERENCES loans(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'completed',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Portal notifications table (borrower-facing alerts)
CREATE TABLE IF NOT EXISTS portal_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  borrower_id UUID REFERENCES borrowers(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Login logs table (admin security tracking)
CREATE TABLE IF NOT EXISTS login_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT,
  ip_address TEXT,
  user_agent TEXT,
  status TEXT DEFAULT 'success',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications table (admin/system notifications)
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  target_user TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Push subscriptions table (web push notifications)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_email TEXT,
  subscription JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Other Products table (non-loan business capital tracking)
CREATE TABLE IF NOT EXISTS other_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  capital NUMERIC(10,2) DEFAULT 0,
  unit_price NUMERIC(10,2) DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add missing columns to loans table
ALTER TABLE loans ADD COLUMN IF NOT EXISTS security_hold NUMERIC(10,2) DEFAULT 0;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS security_hold_returned BOOLEAN DEFAULT FALSE;

-- Add missing column to borrowers table
ALTER TABLE borrowers ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE borrowers ADD COLUMN IF NOT EXISTS access_code TEXT;
ALTER TABLE borrowers ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Product Logs table (daily sales/expenses tracking)
CREATE TABLE IF NOT EXISTS product_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES other_products(id) ON DELETE CASCADE,
  sales_amount NUMERIC(15,2) DEFAULT 0,
  expense_amount NUMERIC(15,2) DEFAULT 0,
  items_sold INTEGER DEFAULT 0,
  items_prepared INTEGER DEFAULT 0,
  log_date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
`
