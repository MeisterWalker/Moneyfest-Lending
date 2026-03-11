# 🏦 Loan Moneyfest

Private admin-only workplace micro-lending management system.

---

## 🚀 Quick Setup Guide

### Step 1 — Supabase Database Setup

1. Go to [supabase.com](https://supabase.com) and open your **loan-manifest** project
2. Click **SQL Editor** in the left sidebar
3. Paste the entire SQL from `src/lib/supabase.js` (the `SCHEMA_SQL` constant)
4. Click **Run** — this creates all your tables
5. Go to **Project Settings → API Keys**
6. Copy your **Project URL** and **anon/public key**

### Step 2 — Configure Environment Variables

1. Copy `.env.example` to `.env.local`
2. Fill in your Supabase credentials:
```
REACT_APP_SUPABASE_URL=https://your-project-ref.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key-here
```

### Step 3 — Run Locally

```bash
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000)

### Step 4 — Create Admin Account

On first launch, click **"First time? Create admin account"** and set your email and password.

---

## ☁️ Deploy to Vercel (Free)

1. Install Vercel CLI: `npm i -g vercel`
2. Run: `vercel` in this folder
3. Add environment variables in Vercel dashboard:
   - `REACT_APP_SUPABASE_URL`
   - `REACT_APP_SUPABASE_ANON_KEY`
4. Redeploy: `vercel --prod`

Or connect your GitHub repo to Vercel for automatic deploys.

---

## 📋 Build Phases

| Phase | Status | Contents |
|---|---|---|
| **Phase 1** | ✅ Complete | Auth, Borrower Management |
| **Phase 2** | 🔨 Next | Loans, Installments, Payment Recording |
| **Phase 3** | ⏳ Planned | Dashboard, Charts, Widgets |
| **Phase 4** | ⏳ Planned | Settings, Audit History, Reset |
| **Phase 5** | ⏳ Planned | Forecast, Collection Schedule, PDF Receipts |

---

## 🗄️ Database Schema

Run the SQL in `src/lib/supabase.js` to create:
- `borrowers` — borrower profiles
- `loans` — loan records
- `installments` — individual payment records
- `departments` — Minto Money, Greyhound + custom
- `settings` — app configuration
- `audit_logs` — permanent action history
- `capital_logs` — capital change records

---

## ⚙️ Business Rules

- Starting Capital: ₱30,000
- Interest: 8% flat per loan
- Loan Range: ₱5,000 – ₱10,000
- Repayment: 4 installments over 4 cutoffs (2 months)
- Cutoff dates: 5th and 20th of each month only
- One active loan per borrower
- Credit score starts at 750 for all new borrowers
"# Loan-Moneyfest" 
