# 🏦 MoneyfestLending

> A full-stack workplace micro-lending management system built for internal employee lending programs. Includes a borrower-facing portal, public loan application, admin dashboard, and automated credit scoring — all powered by React and Supabase.

**Live:** [loanmoneyfest.vercel.app](https://loanmoneyfest.vercel.app)

---

## 📌 Overview

MoneyfestLending is a private, internal lending platform designed for workplace lending programs. It handles the full loan lifecycle — from public application to approval, fund release, installment tracking, credit scoring, and borrower self-service — through a clean admin panel and a borrower-facing portal.

Built for two departments: **Minto Money** and **Greyhound**.

---

## ✨ Features

### 👤 Borrower Side
- **Public Apply Page** (`/apply`) — Multi-step loan application with ID upload, loan amount selection, payment method preference, and e-signature on Terms & Conditions
- **Borrower Portal** (`/portal`) — Access via unique code. View loan status, installment schedule, credit score, security hold, upload payment proofs, download Loan Agreement PDF, and manage Rebate Credits
- **FAQ Page** — Full program explainer covering eligibility, tiers, penalties, and rebates
- **Terms & Privacy Pages** — RA 3765, RA 10173, RA 8792 compliant

### 🔐 Admin Panel (`/admin`)
- **Dashboard** — Live stats: capital deployed, profit, ROI, default rate, collection efficiency. Cutoff day banners, overdue alerts, 6-month charts, borrower insights
- **Borrowers** — Full CRUD with credit score tracking, badge tiers, loan limit progression, portal access code management
- **Loans** — Create, edit, record payments, mark defaulted, renew. Auto-activation on release date. Live overdue penalty counter. Receipt download on every payment
- **Collection Schedule** — Calendar and list view of all installment due dates. Bulk email reminders via Supabase Edge Functions
- **Applications** — Review incoming applications, view submitted IDs, approve/reject with automated email notifications
- **Approvals** — Review borrower-uploaded payment proofs, confirm or reject with portal notifications
- **Forecast** — Simulate capital growth with adjustable rate, default rate, and reinvestment toggle. 12-month chart and 5-year compounding table
- **Audit History** — Permanent, read-only log of every admin action. Filterable, searchable, CSV exportable
- **Settings** — Configure capital, interest rate, loan limits, departments, auto-logout timer, and email templates
- **Investor Pitch** — Internal pitch deck page
- **Login Logs** — Admin access tracking with IP and location

---

## 🧠 Credit System

| Event | Score Change |
|---|---|
| On-time payment | +15 |
| Late payment | -10 |
| Loan fully paid | +25 bonus |
| Loan defaulted | -150 |

| Badge | Score | Loan Limit | Security Hold |
|---|---|---|---|
| 🌱 New | 750 (start) | ₱5,000 | 10% |
| ⭐ Trusted | 835+ | ₱7,000 | 8% |
| 🤝 Reliable | 920+ | ₱9,000 | 6% |
| 👑 VIP | 1000 (max) | ₱10,000 | 5% |

---

## 💰 Business Rules

| Rule | Value |
|---|---|
| Interest rate | 7% flat per loan (configurable) |
| Loan range | ₱5,000 – ₱10,000 |
| Repayment | 4 installments over 2 months |
| Cutoff dates | 5th and 20th of each month |
| Late penalty | ₱20/day, uncapped |
| Early payoff rebate | 1% of principal (final installment only) |
| Security hold | 5%–10% depending on credit score, returned after 4th payment |
| Max loans per borrower | 1 active at a time |

---

## 🗄️ Database

Built on **Supabase** (PostgreSQL). 19 tables:

| Table | Purpose |
|---|---|
| `borrowers` | Borrower profiles, credit scores, badges, access codes |
| `loans` | Loan records with status, installments, security hold, e-signature |
| `installments` | Individual installment schedules |
| `applications` | Public loan applications with ID uploads |
| `payment_proofs` | Borrower-uploaded payment screenshots |
| `penalty_charges` | Late payment penalty records |
| `wallets` | Rebate Credits balance per borrower |
| `wallet_transactions` | Rebate and withdrawal history |
| `portal_notifications` | In-app notifications for borrowers |
| `audit_logs` | Permanent admin action history |
| `departments` | Department list (Minto Money, Greyhound, etc.) |
| `settings` | Global app configuration |
| `capital_logs` | Capital movement records |
| `login_logs` | Admin login tracking with location |
| `notifications` | System notifications |
| `push_subscriptions` | Web push subscriptions |
| `profit_records` | Historical profit snapshots |
| `sessions` | Session management |
| `users` | Admin user accounts |

**Storage buckets:**
- `payment-proofs` — private, borrower payment screenshots
- `valid-ids` — private, government ID uploads
- `Borrower-avatars` — public, profile photos

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, React Router v6, Create React App |
| Backend / DB | Supabase (PostgreSQL + Auth + Storage + Edge Functions) |
| Charts | Recharts |
| PDF / Receipts | HTML → browser download |
| Email | Supabase Edge Function via Resend |
| Icons | Lucide React |
| Dates | date-fns |
| Deployment | Vercel |

---

## 🚀 Local Setup

### Prerequisites
- Node.js 18+
- A Supabase project

### 1. Clone and install
```bash
git clone https://github.com/MeisterWalker/Moneyfest-Lending.git
cd Moneyfest-Lending
npm install
```

### 2. Configure environment
```bash
cp .env.example .env.local
```

Fill in `.env.local`:
```env
REACT_APP_SUPABASE_URL=https://your-project-ref.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key-here
REACT_APP_PORTAL_URL=https://your-domain.com/portal
```

### 3. Set up Supabase database
- Go to **Supabase Dashboard → SQL Editor**
- Run the schema SQL from `src/lib/supabase.js` (the `SCHEMA_SQL` constant)
- Create two storage buckets: `payment-proofs` (private) and `valid-ids` (private)

### 4. Run locally
```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000)

### 5. Create admin account
Go to `/admin` → click **"First time? Create admin account"** → set your email and password.

---

## ☁️ Deploy to Vercel

1. Push to GitHub
2. Connect repo to [Vercel](https://vercel.com)
3. Add environment variables in Vercel Dashboard:
   - `REACT_APP_SUPABASE_URL`
   - `REACT_APP_SUPABASE_ANON_KEY`
   - `REACT_APP_PORTAL_URL`
4. Deploy — Vercel auto-deploys on every push to `main`

---

## 📁 Project Structure

```
src/
├── components/
│   ├── BorrowerAvatar.js
│   ├── BorrowerModal.js
│   ├── InstallmentProgressBar.js
│   ├── LoanModal.js
│   ├── LoadingScreen.js
│   ├── NotificationBell.js
│   ├── Sidebar.js
│   └── Toast.js
├── context/
│   └── AuthContext.js
├── hooks/
│   └── useAutoLogout.js
├── lib/
│   ├── creditSystem.js         # Credit score, badges, security hold logic
│   ├── emailService.js         # Reminder, approval, and pending emails
│   ├── helpers.js              # formatCurrency, formatDate, getInstallmentDates
│   ├── portalNotifications.js
│   └── supabase.js             # Supabase client + full schema SQL
├── pages/
│   ├── ApplicationsPage.js
│   ├── ApprovalsPage.js
│   ├── AuditPage.js
│   ├── BorrowerPortalPage.js
│   ├── BorrowersPage.js
│   ├── CollectionPage.js
│   ├── DashboardPage.js
│   ├── FAQPage.js
│   ├── ForecastPage.js
│   ├── HomePage.js
│   ├── InvestorPitchPage.js
│   ├── LoginLogsPage.js
│   ├── LoginPage.js
│   ├── LoansPage.js
│   ├── PrivacyPage.js
│   ├── PublicApplyPage.js
│   ├── SettingsPage.js
│   └── TermsPage.js
└── App.js
```

---

## 🔒 Security

- Supabase Auth for admin authentication
- Auto-logout on inactivity (configurable timeout)
- Login attempt logging with IP and location
- Row-level security on Supabase tables
- Private storage buckets for sensitive documents
- Environment variables for all credentials — never committed to git

---

## 📄 Legal Compliance

Built in compliance with Philippine law:
- **RA 3765** — Truth in Lending Act (disclosure statement on every loan agreement)
- **RA 10173** — Data Privacy Act of 2012
- **RA 8792** — E-Commerce Act (electronic signatures)
- **RA 9474** — Lending Company Regulation Act

---

## 📞 Contact

For questions about the program:
- **John Paul Lacaron** — Admin · Microsoft Teams
- **Charlou June Ramil** — Admin · Microsoft Teams

---

*MoneyfestLending is a private workplace lending program and is not a bank, quasi-bank, or BSP-supervised financial institution.*
