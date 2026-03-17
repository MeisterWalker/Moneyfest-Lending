// ── LoanMoneyfest Credit System ───────────────────────────────
// Single source of truth for all credit score, badge, risk, and security hold logic
//
// Score journey (perfect borrower):
//   Start:          750
//   Per on-time:    +15 x 4 = +60
//   Loan complete:  +25
//   After 1 loan:   835  -> Trusted
//   After 2 loans:  920  -> Reliable
//   After 3 loans:  1000 -> VIP (capped)

export const CREDIT_CONFIG = {
  MIN_SCORE: 300,
  MAX_SCORE: 1000,
  STARTING_SCORE: 750,
  ON_TIME_PAYMENT: 15,
  LATE_PAYMENT: -10,
  FULL_LOAN_COMPLETE: 25,
  LOAN_DEFAULT: -150,

  riskFromScore: (score) => {
    if (score >= 750) return 'Low'      // 750+ = Low (starting score and above)
    if (score >= 600) return 'Medium'   // 600–749 = Medium (some late payments)
    return 'High'                        // below 600 = High Risk
  },

  labelFromScore: (score) => {
    if (score >= 1000) return 'VIP'
    if (score >= 920)  return 'Excellent'
    if (score >= 835)  return 'Good'
    if (score >= 750)  return 'Fair'
    if (score >= 500)  return 'Caution'
    return 'High Risk'
  },

  colorFromScore: (score) => {
    if (score >= 1000) return '#8B5CF6'
    if (score >= 920)  return '#22C55E'
    if (score >= 835)  return '#3B82F6'
    if (score >= 750)  return '#60A5FA'
    if (score >= 500)  return '#F59E0B'
    return '#EF4444'
  },
}

export const BADGE_TIERS = [
  { id: 'New',      emoji: '🌱', label: 'New Borrower',     color: '#7A8AAA', bg: 'rgba(122,138,170,0.08)',  border: 'rgba(122,138,170,0.2)',  minScore: 0,    cleanLoans: 0, desc: 'Starting tier' },
  { id: 'Trusted',  emoji: '⭐', label: 'Trusted Borrower',  color: '#F59E0B', bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.3)',   minScore: 835,  cleanLoans: 1, desc: 'After 1 clean loan' },
  { id: 'Reliable', emoji: '🤝', label: 'Reliable Borrower', color: '#3B82F6', bg: 'rgba(59,130,246,0.08)',  border: 'rgba(59,130,246,0.3)',   minScore: 920,  cleanLoans: 2, desc: 'After 2 clean loans' },
  { id: 'VIP',      emoji: '👑', label: 'VIP Borrower',      color: '#8B5CF6', bg: 'rgba(139,92,246,0.1)',   border: 'rgba(139,92,246,0.4)',   minScore: 1000, cleanLoans: 3, desc: 'After 3 clean loans' },
]

export const getBadgeFromScore = (score) => {
  if (score >= 1000) return 'VIP'
  if (score >= 920)  return 'Reliable'
  if (score >= 835)  return 'Trusted'
  return 'New'
}

export const getBadgeFromCleanLoans = (cleanLoans) => {
  if (cleanLoans >= 3) return 'VIP'
  if (cleanLoans >= 2) return 'Reliable'
  if (cleanLoans >= 1) return 'Trusted'
  return 'New'
}

export const getBadgeConfig = (badgeId) =>
  BADGE_TIERS.find(b => b.id === badgeId) || BADGE_TIERS[0]

export const SECURITY_HOLD_TIERS = [
  { minScore: 1000, badge: 'VIP',      rate: 0.05, label: '5%',  color: '#8B5CF6', perk: '👑 VIP — lowest hold rate!' },
  { minScore: 920,  badge: 'Reliable', rate: 0.06, label: '6%',  color: '#3B82F6', perk: '🤝 Reliable borrower perk' },
  { minScore: 835,  badge: 'Trusted',  rate: 0.08, label: '8%',  color: '#F59E0B', perk: '⭐ Trusted borrower benefit' },
  { minScore: 750,  badge: 'New',      rate: 0.10, label: '10%', color: '#7A8AAA', perk: '🌱 Standard rate' },
  { minScore: 500,  badge: 'Caution',  rate: 0.15, label: '15%', color: '#F97316', perk: '⚠️ Caution — improve your score' },
  { minScore: 0,    badge: 'HighRisk', rate: 0.20, label: '20%', color: '#EF4444', perk: '🔴 High risk — max hold applied' },
]

export const getSecurityHoldRate = (creditScore) => {
  const score = creditScore || CREDIT_CONFIG.STARTING_SCORE
  for (const tier of SECURITY_HOLD_TIERS) {
    if (score >= tier.minScore) return tier
  }
  return SECURITY_HOLD_TIERS[SECURITY_HOLD_TIERS.length - 1]
}

export const calcSecurityHold = (loanAmount, creditScore) => {
  const tier = getSecurityHoldRate(creditScore)
  const hold = parseFloat((loanAmount * tier.rate).toFixed(2))
  const released = parseFloat((loanAmount - hold).toFixed(2))
  return { hold, released, tier }
}
