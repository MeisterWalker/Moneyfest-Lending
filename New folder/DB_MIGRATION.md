# QuickLoan — Supabase Migration

Run these SQL statements in your Supabase SQL editor before deploying.

## 1. Add new columns to the `loans` table

```sql
ALTER TABLE loans
  ADD COLUMN IF NOT EXISTS loan_type TEXT DEFAULT 'regular',
  ADD COLUMN IF NOT EXISTS extension_fee_charged BOOLEAN DEFAULT false;
```

## 2. Add new column to the `loan_applications` table

```sql
ALTER TABLE loan_applications
  ADD COLUMN IF NOT EXISTS loan_type TEXT DEFAULT 'regular';
```

## 3. Backfill existing records (safe — sets everything to 'regular')

```sql
UPDATE loans SET loan_type = 'regular' WHERE loan_type IS NULL;
UPDATE loan_applications SET loan_type = 'regular' WHERE loan_type IS NULL;
UPDATE loans SET extension_fee_charged = false WHERE extension_fee_charged IS NULL;
```

## 4. (Optional) Add index for faster filtering

```sql
CREATE INDEX IF NOT EXISTS idx_loans_loan_type ON loans(loan_type);
```

That's it. No existing data is touched or broken.
