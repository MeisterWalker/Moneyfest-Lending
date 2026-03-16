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
// Returns an array of 4 Date objects (local time, no UTC shift).
export function getInstallmentDates(releaseDateStr) {
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
  for (let i = 0; i < 4; i++) {
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

// Format a Date to a YYYY-MM-DD string (local time, no UTC shift)
export function formatDateValue(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
