import { supabase } from './supabase'

export async function logAudit({ action_type, module, description, changed_by }) {
  try {
    const { error } = await supabase.from('audit_logs').insert({
      action_type: action_type || 'UNKNOWN',
      module: module || 'System',
      description: description || '',
      changed_by: changed_by || 'admin',
      created_at: new Date().toISOString()
    })
    if (error) console.error('Audit log insert error:', error)
  } catch (e) {
    console.error('Audit log failed:', e)
  }
}

export function getRiskFromScore(score) {
  if (score >= 650) return 'Low'
  if (score >= 550) return 'Medium'
  return 'High'
}

export function getLoyaltyBadge(cleanLoans) {
  if (cleanLoans >= 3) return 'VIP'
  if (cleanLoans >= 2) return 'Reliable'
  if (cleanLoans >= 1) return 'Trusted'
  return 'New'
}

export function getNextCutoffDate() {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()
  const day = today.getDate()

  if (day < 5) return new Date(year, month, 5)
  if (day < 20) return new Date(year, month, 20)
  return new Date(year, month + 1, 5)
}

export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(amount)
}

export function formatDate(dateStr) {
  if (!dateStr) return '—'
  // Parse as local date to avoid UTC timezone shift (e.g. Mar 20 showing as Mar 19)
  const [year, month, day] = String(dateStr).slice(0, 10).split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString('en-PH', {
    year: 'numeric', month: 'short', day: 'numeric'
  })
}

// ── Canonical installment date calculator ─────────────────────
// Single source of truth used by LoansPage, CollectionPage,
// BorrowerPortalPage, and LoanModal.
//
// Rules:
//   - Payments snap to the nearest upcoming 5th or 20th after release
//   - Release on the 1st–5th  → 1st payment on 20th same month
//   - Release on the 6th–20th → 1st payment on 5th next month
//   - Release on 21st–31st   → 1st payment on 5th next month
//   - Each subsequent payment alternates 5th ↔ 20th, rolling the month forward
//
// numInstallments: 4 for 2-month term, 6 for 3-month term (default 4)
// Returns an array of Date objects (local time, no UTC shift).
export function getInstallmentDates(releaseDateStr, numInstallments = 4) {
  if (!releaseDateStr) return []
  const [ry, rm, rd] = String(releaseDateStr).slice(0, 10).split('-').map(Number)
  const release = new Date(ry, rm - 1, rd)
  const dates = []
  let year = release.getFullYear()
  let month = release.getMonth()
  // Determine first cutoff after release
  let day
  if (release.getDate() <= 5) {
    day = 20
  } else {
    day = 5
    month += 1
    if (month > 11) { month = 0; year += 1 }
  }
  for (let i = 0; i < numInstallments; i++) {
    dates.push(new Date(year, month, day))
    // Advance to next cutoff
    if (day === 5) {
      day = 20
    } else {
      day = 5
      month += 1
      if (month > 11) { month = 0; year += 1 }
    }
  }
  return dates
}

// Helper: derive num_installments from loan_term months
// 2-month term → 4 installments, 3-month term → 6 installments
export function getNumInstallments(loanTerm) {
  return (Number(loanTerm) || 2) * 2
}

// Format a Date to a YYYY-MM-DD string (local time, no UTC shift)
export function formatDateValue(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// ── QuickLoan helpers ──────────────────────────────────────────
// Single source of truth for all QuickLoan interest, penalty,
// and date calculations.
//
// Rules:
//   - Monthly rate: 10% → daily rate = 10% / 30 = 0.3333%/day
//   - Interest accrues daily on outstanding principal
//   - Day 15 from release: target due date — collect accrued interest + ₱100 extension fee if missed
//   - Day 30 from release: hard deadline — after this, ₱25/day penalty accrues on top of daily interest
//   - Max loan: ₱3,000
//   - Pay anytime — interest stops on actual payment date

export const QUICKLOAN_CONFIG = {
  MONTHLY_RATE: 0.10,           // 10% per month
  DAILY_RATE: 0.10 / 30,        // 0.003333.../day
  MAX_AMOUNT: 3000,
  EXTENSION_FEE: 100,           // charged once when Day 15 is missed
  PENALTY_PER_DAY: 25,          // daily penalty after Day 30
  DAY15_THRESHOLD: 15,          // days from release to first due date
  DAY30_THRESHOLD: 30,          // days from release to hard deadline
}

// Calculate daily interest amount for a given principal
export function calcQuickLoanDailyInterest(principal) {
  return parseFloat((principal * QUICKLOAN_CONFIG.DAILY_RATE).toFixed(2))
}

// Calculate total accrued interest for N days on a principal
export function calcQuickLoanAccruedInterest(principal, days) {
  return parseFloat((principal * QUICKLOAN_CONFIG.DAILY_RATE * days).toFixed(2))
}

// Get Day 15 and Day 30 dates from a release date string
export function getQuickLoanDueDates(releaseDateStr) {
  if (!releaseDateStr) return { day15: null, day30: null }
  const [y, m, d] = String(releaseDateStr).slice(0, 10).split('-').map(Number)
  const release = new Date(y, m - 1, d)
  const day15 = new Date(release)
  day15.setDate(day15.getDate() + QUICKLOAN_CONFIG.DAY15_THRESHOLD)
  const day30 = new Date(release)
  day30.setDate(day30.getDate() + QUICKLOAN_CONFIG.DAY30_THRESHOLD)
  return { day15, day30 }
}

// Get number of days elapsed since release date (today or a specific date)
export function getQuickLoanDaysElapsed(releaseDateStr, asOfDateStr = null) {
  if (!releaseDateStr) return 0
  const [ry, rm, rd] = String(releaseDateStr).slice(0, 10).split('-').map(Number)
  const release = new Date(ry, rm - 1, rd)
  const asOf = asOfDateStr
    ? (() => { const [ay, am, ad] = String(asOfDateStr).slice(0, 10).split('-').map(Number); return new Date(ay, am - 1, ad) })()
    : new Date()
  // Use local date only (strip time)
  const releaseDay = new Date(release.getFullYear(), release.getMonth(), release.getDate())
  const asOfDay = new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate())
  const diff = Math.floor((asOfDay - releaseDay) / (1000 * 60 * 60 * 24))
  return Math.max(0, diff)
}

// Calculate the full current balance owed on a QuickLoan
// Returns: { principal, accruedInterest, extensionFee, penaltyAccrued, totalOwed, daysElapsed, phase }
// phase: 'active' | 'extended' | 'penalty'
export function calcQuickLoanBalance(loan, asOfDateStr = null) {
  const principal = parseFloat(loan.loan_amount) || 0
  const daysElapsed = getQuickLoanDaysElapsed(loan.release_date, asOfDateStr)
  const extensionFeeCharged = loan.extension_fee_charged || false

  let accruedInterest = calcQuickLoanAccruedInterest(principal, daysElapsed)
  let extensionFee = extensionFeeCharged ? QUICKLOAN_CONFIG.EXTENSION_FEE : 0
  let penaltyAccrued = 0
  let phase = 'active'

  if (daysElapsed > QUICKLOAN_CONFIG.DAY30_THRESHOLD) {
    phase = 'penalty'
    const penaltyDays = daysElapsed - QUICKLOAN_CONFIG.DAY30_THRESHOLD
    penaltyAccrued = parseFloat((penaltyDays * QUICKLOAN_CONFIG.PENALTY_PER_DAY).toFixed(2))
  } else if (daysElapsed > QUICKLOAN_CONFIG.DAY15_THRESHOLD) {
    phase = 'extended'
  }

  const totalOwed = parseFloat((principal + accruedInterest + extensionFee + penaltyAccrued).toFixed(2))
  return { principal, accruedInterest, extensionFee, penaltyAccrued, totalOwed, daysElapsed, phase }
}

// What the admin collects on Day 15 miss: accrued interest + extension fee
// Principal stays outstanding and rolls to Day 30
export function calcQuickLoanDay15Collection(loan) {
  const principal = parseFloat(loan.loan_amount) || 0
  const accruedInterest = calcQuickLoanAccruedInterest(principal, QUICKLOAN_CONFIG.DAY15_THRESHOLD)
  const extensionFee = QUICKLOAN_CONFIG.EXTENSION_FEE
  return {
    collectNow: parseFloat((accruedInterest + extensionFee).toFixed(2)),
    accruedInterest,
    extensionFee,
    principalRemaining: principal,
  }
}
