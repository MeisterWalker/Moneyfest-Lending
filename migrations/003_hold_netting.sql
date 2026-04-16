-- Migration 003: Security Hold Netting
-- Safe to run with active loans.
-- Only adds new table and columns. Zero rows are modified.
-- Run date: 2026-04

-- ── Operation 1: Create hold_redeployments table ───────────────────────────
-- Tracks when a paid loan's security hold is redeployed to fund the next loan
-- rather than being returned to the capital pool.
--
-- NOTE: source_loan_id / destination_loan_id use TEXT to match loans.id type
-- in this Supabase project (loans.id is TEXT, not UUID).
CREATE TABLE IF NOT EXISTS hold_redeployments (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_loan_id       TEXT REFERENCES loans(id),
  destination_loan_id  TEXT REFERENCES loans(id),  -- nullable: filled in when next loan is created
  amount               NUMERIC(10,2) NOT NULL,
  redeployed_at        TIMESTAMPTZ DEFAULT NOW(),
  redeployed_by        TEXT,                        -- admin email who confirmed the final installment
  notes                TEXT
);

-- ── Operation 2: Add 3 columns to loans ────────────────────────────────────
-- hold_netted:         TRUE when this loan's security hold was sourced from
--                      a previous loan's released hold (not from capital).
-- hold_source:         'capital' (default) or 'hold_redeployment'
-- hold_source_loan_id: which prior loan's hold funded this one (if redeployed)
--
-- Existing active loans automatically receive:
--   hold_netted = FALSE  (from column default — correct, capital-funded)
--   hold_source = 'capital' (from column default — correct)
ALTER TABLE loans
  ADD COLUMN IF NOT EXISTS hold_netted         BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS hold_source         TEXT    DEFAULT 'capital',
  ADD COLUMN IF NOT EXISTS hold_source_loan_id TEXT    REFERENCES loans(id);
