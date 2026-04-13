# AGENTS.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project overview
- MoneyfestLending is a React 18 single-page app (Create React App) backed by Supabase.
- It serves two primary surfaces:
  - Public borrower flows (`/`, `/apply`, `/portal`, content pages)
  - Authenticated admin dashboard routes under `/admin/*`
- Core business logic is implemented in frontend `src/lib/*` modules and persisted to Supabase Postgres + Storage.

## Essential commands
Run all commands from the repository root.

- Install dependencies:
  - `npm install`
- Start local development server:
  - `npm start`
- Create production build:
  - `npm run build`
- Run test suite (CRA/Jest interactive mode):
  - `npm test`
- Run tests once in CI/non-watch mode:
  - `npm test -- --watchAll=false`
- Run a single test file:
  - `npm test -- src/path/to/file.test.js --watchAll=false`
- Run tests matching a test name pattern:
  - `npm test -- --testNamePattern="your test name" --watchAll=false`

Notes:
- There is currently no dedicated lint script in `package.json`.
- No test files are currently present in the repository (`*.test.*` / `*.spec.*`), but the CRA test runner is configured.

## Environment and external services
- Frontend env vars (from README and app usage):
  - `REACT_APP_SUPABASE_URL`
  - `REACT_APP_SUPABASE_ANON_KEY`
  - `REACT_APP_PORTAL_URL`
  - `REACT_APP_EMAIL_FUNCTION_SECRET` (used by `src/lib/emailService.js` when invoking Supabase function `send-email`)
- Supabase is the system of record for:
  - Postgres tables (borrowers, loans, installments, applications, approvals/notifications/logging tables, etc.)
  - Storage buckets (`payment-proofs`, `valid-ids`, avatars bucket)
  - Edge functions in `supabase/functions/*`

## High-level architecture
### 1) App shell, routing, and auth boundaries
- Entry point is `src/index.js`, which renders `src/App.js`.
- `App.js` is the composition root:
  - Wraps app in `ThemeProvider`, `AuthProvider`, `ToastProvider`
  - Defines all routes with React Router v6
  - Uses route-level lazy loading (`React.lazy` + `Suspense`) for page components
- Access control pattern:
  - `ProtectedRoute` checks `useAuth()` from `src/context/AuthContext.js`
  - Unauthenticated users are redirected to `/admin`
  - Admin pages are rendered inside `AppLayout` (sidebar + notification bell + auto-logout hook)

### 2) Supabase integration pattern
- `src/lib/supabase.js` exports a singleton Supabase client used across the app.
- The same file includes `SCHEMA_SQL`, which documents/bootstraps table creation and some default seed records.
- Most page-level data operations directly call Supabase from page/components (no separate backend API layer for core CRUD).
- `AuthContext` uses Supabase Auth session + auth state subscription as the canonical admin auth state.

### 3) Domain logic placement
- Business rules are centralized in utility modules under `src/lib`:
  - `creditSystem.js`: score changes, badge tiers, security hold calculations
  - `emailService.js`: email templates + invocation of Supabase `send-email` function
  - `portalNotifications.js`: helper for borrower in-app notifications
  - `helpers.js`, `accounting.js`, etc. for cross-page calculations/formatting
- Keep business-rule changes in these modules when possible, instead of duplicating logic across pages.

### 4) Key user flows and where they live
- Public application flow:
  - `src/pages/PublicApplyPage.js`
  - Handles multi-step form, ID uploads to Supabase storage, insert into `applications`, access-code generation, and applicant/admin email triggers.
- Admin application review + loan lifecycle:
  - `src/pages/ApplicationsPage.js`, `src/pages/LoansPage.js`, `src/pages/ApprovalsPage.js`, `src/pages/CollectionPage.js`
  - These pages drive approval, disbursement, payment confirmation, and collection operations against Supabase tables.
- Borrower self-service portal:
  - `src/pages/BorrowerPortalPage.js`
  - Reads borrower/loan/installment/proof state and exposes borrower actions (proof uploads, status visibility, etc.).

### 5) Edge functions responsibilities
- `supabase/functions/send-email/index.ts`
  - SMTP send pipeline (Zoho), with authorization checks (`service_role` or `x-function-secret`).
- `supabase/functions/chat-assistant/index.ts`
  - Chat assistant proxy to Groq chat completions with a large domain-specific system prompt.
- `supabase/functions/zoho-inbox/index.ts`
  - Zoho mail API integration via OAuth refresh token.

## Implementation guidance for future agents
- For any change touching lending rules (interest, penalties, scoring, hold rates), first inspect:
  - `src/lib/creditSystem.js`
  - `src/pages/PublicApplyPage.js`
  - `src/pages/LoansPage.js` and related admin lifecycle pages
- For any change touching borrower/admin communications, inspect:
  - `src/lib/emailService.js`
  - `supabase/functions/send-email/index.ts`
  - `src/lib/portalNotifications.js`
- For schema/data-shape changes, update both:
  - Supabase schema/migrations (source reflected in `src/lib/supabase.js` `SCHEMA_SQL`)
  - Frontend queries/inserts consuming those fields
