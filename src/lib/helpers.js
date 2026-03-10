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
  return new Date(dateStr).toLocaleDateString('en-PH', {
    year: 'numeric', month: 'short', day: 'numeric'
  })
}
