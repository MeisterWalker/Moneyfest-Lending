import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { formatCurrency } from '../lib/helpers'
import { Users, TrendingUp, Wallet, Briefcase, ExternalLink, Landmark, ArrowUpRight, Clock } from 'lucide-react'

const TIER_RATES = { 'Starter': 0.07, 'Standard': 0.08, 'Premium': 0.09 }
const TIER_COLORS = { 'Premium': '#F59E0B', 'Standard': '#3B82F6', 'Starter': '#94A3B8' }

export default function InvestorsPage() {
  const [investors, setInvestors] = useState([])
  const [loans, setLoans] = useState([])
  const [borrowers, setBorrowers] = useState([])
  const [settings, setSettings] = useState(null)
  const [adminCapitalState, setAdminCapitalState] = useState(30000)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    const [{ data: inv }, { data: l }, { data: b }, { data: s }, { data: cf }] = await Promise.all([
      supabase.from('investors').select('*').order('created_at', { ascending: false }),
      supabase.from('loans').select('*').order('created_at', { ascending: false }),
      supabase.from('borrowers').select('id, full_name, department, building'),
      supabase.from('settings').select('*').eq('id', 1).single(),
      supabase.from('capital_flow').select('*')
    ])
    setInvestors(inv || [])
    setLoans(l || [])
    setBorrowers(b || [])
    setSettings(s)
    
    // Calculate dynamic ledger capital for admin
    let dynamicAdminCapital = 35000
    if (cf) {
      dynamicAdminCapital = cf
        .filter(c => c.type === 'CASH IN' && (
          c.category === 'Initial Pool (Installment)' ||
          c.category === 'Capital Top-up (JP)' || 
          c.category === 'Capital Top-up (Charlou)'
        ))
        .reduce((sum, c) => sum + (c.amount || 0), 0)
    }
    setAdminCapitalState(dynamicAdminCapital)
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>

  // Derived metrics
  const installmentLoans = loans.filter(l => l.loan_type !== 'quickloan')
  const investorLoans = installmentLoans.filter(l => l.investor_id)
  const activeInvestorLoans = investorLoans.filter(l => ['Active', 'Partially Paid', 'Overdue'].includes(l.status))
  const paidInvestorLoans = investorLoans.filter(l => l.status === 'Paid')
  
  const totalCapital = investors.reduce((s, i) => s + Number(i.total_capital || 0), 0)
  const totalDeployed = activeInvestorLoans.reduce((s, l) => s + Number(l.loan_amount || 0), 0)
  
  // Calculate Live Accrual (matching InvestorDashboard logic)
  const now = new Date()
  const secondsInDay = (now.getHours() * 3600) + (now.getMinutes() * 60) + now.getSeconds()
  const dayProgress = secondsInDay / 86400
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const activeAccrual = activeInvestorLoans.reduce((s, l) => {
    const inv = investors.find(i => i.id === l.investor_id)
    const quarterlyRate = TIER_RATES[inv?.tier] || 0.08
    const dailyRate = quarterlyRate / 90
    return s + (Number(l.loan_amount || 0) * dailyRate * dayProgress)
  }, 0)

  const realizedEarnings = paidInvestorLoans.reduce((s, l) => {
    const inv = investors.find(i => i.id === l.investor_id)
    const rate = TIER_RATES[inv?.tier] || 0.08
    return s + Number(l.loan_amount || 0) * rate
  }, 0)

  const totalEarnings = realizedEarnings + activeAccrual
  const deployedPct = totalCapital > 0 ? ((totalDeployed / totalCapital) * 100).toFixed(1) : '0.0'

  // ── ADMIN EARNINGS ──
  // Admin-funded loans = loans NOT linked to any investor
  const adminLoans = installmentLoans.filter(l => !l.investor_id)
  const adminActiveLoans = adminLoans.filter(l => ['Active', 'Partially Paid', 'Overdue'].includes(l.status))
  const adminPaidLoans = adminLoans.filter(l => l.status === 'Paid')
  const adminCapital = adminCapitalState
  const adminInterestRate = Number(settings?.interest_rate || 0.07)

  // Admin profit from paid loans (fully collected interest)
  const adminPaidProfit = adminPaidLoans.reduce((s, l) => s + ((l.total_repayment || 0) - (l.loan_amount || 0)), 0)

  // Admin active interest earned so far (installments paid on active loans)
  const adminActiveProfit = adminActiveLoans.reduce((s, l) => {
    const installment = Math.ceil(l.installment_amount || 0)
    const paidSoFar = installment * (l.payments_made || 0)
    const interestRate = (l.interest_rate || 0.07) * (l.loan_term || 2)
    const totalInterest = (l.loan_amount || 0) * interestRate
    return s + (totalInterest > 0 ? (paidSoFar / (l.total_repayment || 1)) * totalInterest : 0)
  }, 0)

  const adminTotalProfit = adminPaidProfit + adminActiveProfit

  // Admin daily accrual — based on admin's active deployed capital
  const adminDeployed = adminActiveLoans.reduce((s, l) => s + Number(l.loan_amount || 0), 0)
  const adminDailyRate = adminInterestRate / 90  // same quarterly logic
  const adminDailyProfit = adminDeployed * adminDailyRate
  const adminTodayAccrual = adminDailyProfit * dayProgress

  // Admin yesterday accrual
  const adminYesterdayCapital = adminActiveLoans
    .filter(l => {
      const deployDate = l.release_date ? new Date(l.release_date) : new Date(l.created_at)
      return deployDate < todayStart
    })
    .reduce((s, l) => s + Number(l.loan_amount || 0), 0)
  const adminYesterdayAccrual = adminYesterdayCapital * adminDailyRate

  // Admin overall accrual
  let adminOverallAccrual = 0
  adminActiveLoans.forEach(l => {
    const deployDate = l.release_date ? new Date(l.release_date) : new Date(l.created_at)
    const daysActive = Math.max(0, Math.floor((todayStart - deployDate) / 86400000))
    adminOverallAccrual += Number(l.loan_amount) * adminDailyRate * daysActive
  })
  adminOverallAccrual += adminTodayAccrual

  return (
    <div style={{ padding: '32px 28px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Investors</h1>
          <p className="page-subtitle">{investors.length} registered investor{investors.length !== 1 ? 's' : ''} · Capital deployment & earnings overview</p>
        </div>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
        {[
          { label: 'Total Capital', value: formatCurrency(totalCapital), sub: `${investors.length} investor${investors.length !== 1 ? 's' : ''}`, icon: Wallet, color: 'var(--purple)' },
          { label: 'Funds Deployed', value: formatCurrency(totalDeployed), sub: `${activeInvestorLoans.length} active loan${activeInvestorLoans.length !== 1 ? 's' : ''}`, icon: TrendingUp, color: 'var(--green)' },
          { label: 'Total Earnings', value: formatCurrency(totalEarnings), sub: 'Interest earned on paid loans', icon: Briefcase, color: 'var(--blue)' },
          { label: 'Utilization', value: `${deployedPct}%`, sub: 'Capital deployment rate', icon: Users, color: parseFloat(deployedPct) >= 80 ? 'var(--green)' : 'var(--gold)' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: `${s.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <s.icon size={18} style={{ color: s.color }} />
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</span>
            </div>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 26, color: s.color, marginBottom: 2 }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* ── ADMIN EARNINGS CARD ── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 28, border: '1px solid rgba(16,185,129,0.2)' }}>
        <div style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(16,185,129,0.03))', padding: '20px 24px', borderBottom: '1px solid rgba(16,185,129,0.15)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Landmark size={18} style={{ color: '#10B981' }} />
            </div>
            <div>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 16, color: 'var(--text-primary)' }}>Admin / Business Earnings</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Interest earned from your own capital pool ({adminActiveLoans.length} active admin-funded loans)</div>
            </div>
          </div>
        </div>

        {/* Admin stat metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderBottom: '1px solid var(--card-border)' }}>
          {[
            { label: 'Admin Capital', val: formatCurrency(adminCapital), col: 'var(--blue)' },
            { label: 'Admin Deployed', val: formatCurrency(adminDeployed), col: adminDeployed > 0 ? 'var(--purple)' : 'var(--text-muted)' },
            { label: 'Admin Total Profit', val: formatCurrency(adminTotalProfit), col: adminTotalProfit > 0 ? 'var(--green)' : 'var(--text-muted)' },
            { label: 'Admin ROI', val: adminCapital > 0 ? `${((adminTotalProfit / adminCapital) * 100).toFixed(1)}%` : '0%', col: 'var(--teal)' },
          ].map((m, i) => (
            <div key={i} style={{ padding: '14px 16px', textAlign: 'center', borderLeft: i > 0 ? '1px solid var(--card-border)' : 'none' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{m.label}</div>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 16, color: m.col }}>{m.val}</div>
            </div>
          ))}
        </div>

        {/* Admin Daily Accrual Breakdown */}
        <div style={{ background: 'rgba(16,185,129,0.03)' }}>
          {[
            { label: "Today's Live Accrual", value: adminTodayAccrual, color: 'var(--green)', live: true },
            { label: "Yesterday's Accrual", value: adminYesterdayAccrual, color: '#F59E0B', live: false },
            { label: 'Overall Accrued Interest', value: adminOverallAccrual, color: 'var(--blue)', live: false },
          ].map((row, i) => (
            <div key={i} style={{ padding: '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: i > 0 ? '1px solid var(--card-border)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {row.live ? (
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: row.color, boxShadow: `0 0 8px ${row.color}` }} />
                ) : (
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: row.color, opacity: 0.7 }} />
                )}
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>{row.label}</span>
              </div>
              <span style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: i === 2 ? 16 : 14, color: row.color }}>+{formatCurrency(row.value)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── INVESTOR CAPITAL SECTION HEADER ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <Wallet size={18} style={{ color: 'var(--purple)' }} />
        <span style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>Investor Capital Overview</span>
      </div>

      {/* Utilization Progress */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Capital Utilization</span>
          <span style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 14, color: parseFloat(deployedPct) >= 80 ? 'var(--green)' : 'var(--gold)' }}>{deployedPct}%</span>
        </div>
        <div style={{ height: 10, borderRadius: 5, background: 'rgba(139,92,246,0.1)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.min(100, parseFloat(deployedPct))}%`, borderRadius: 5, background: 'linear-gradient(90deg, #7C3AED, #22C55E)', transition: 'width 0.5s ease' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>
          <span>₱0</span>
          <span>{formatCurrency(totalCapital)}</span>
        </div>
      </div>

      {/* Per-Investor Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {investors.map(inv => {
          const invLoans = installmentLoans.filter(l => l.investor_id === inv.id)
          const invActive = invLoans.filter(l => ['Active', 'Partially Paid', 'Overdue'].includes(l.status))
          const invPaid = invLoans.filter(l => l.status === 'Paid')
          const invDeployed = invActive.reduce((s, l) => s + Number(l.loan_amount || 0), 0)
          const rate = TIER_RATES[inv.tier] || 0.08
          const dailyRate = rate / 90
          
          const invRealized = invPaid.reduce((s, l) => s + Number(l.loan_amount || 0) * rate, 0)
          const invAccrual = invActive.reduce((s, l) => s + (Number(l.loan_amount || 0) * dailyRate * dayProgress), 0)
          const invEarnings = invRealized + invAccrual
          const tierColor = TIER_COLORS[inv.tier] || '#94A3B8'
          const invUtilPct = Number(inv.total_capital) > 0 ? ((invDeployed / Number(inv.total_capital)) * 100).toFixed(0) : '0'

          // Per-investor accrual breakdown
          const invDailyProfit = invDeployed * dailyRate
          const invTodayAccrual = invDailyProfit * dayProgress
          const invYesterdayCapital = invActive
            .filter(l => {
              const deployDate = l.release_date ? new Date(l.release_date) : new Date(l.created_at)
              return deployDate < todayStart
            })
            .reduce((s, l) => s + Number(l.loan_amount || 0), 0)
          const invYesterdayAccrual = invYesterdayCapital * dailyRate
          let invOverallAccrual = 0
          invActive.forEach(l => {
            const deployDate = l.release_date ? new Date(l.release_date) : new Date(l.created_at)
            const daysActive = Math.max(0, Math.floor((todayStart - deployDate) / 86400000))
            invOverallAccrual += Number(l.loan_amount) * dailyRate * daysActive
          })
          invOverallAccrual += invTodayAccrual

          return (
            <div key={inv.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {/* Investor header */}
              <div style={{ padding: '16px 22px', display: 'flex', alignItems: 'center', gap: 14, borderBottom: '1px solid var(--card-border)' }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: `${tierColor}15`, border: `1px solid ${tierColor}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>👤</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', marginBottom: 2 }}>{inv.full_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ color: tierColor, fontWeight: 700, fontSize: 11, padding: '1px 8px', borderRadius: 20, background: `${tierColor}15`, border: `1px solid ${tierColor}30` }}>{inv.tier}</span>
                    <span>Code: {inv.access_code}</span>
                    {inv.email && <span>· {inv.email}</span>}
                    {inv.signed_at && <span style={{ color: 'var(--green)', fontWeight: 600 }}>✓ MOA Signed</span>}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 20, color: 'var(--purple)' }}>{formatCurrency(inv.total_capital)}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total Capital</div>
                </div>
              </div>

              {/* Metrics row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderBottom: '1px solid var(--card-border)' }}>
                {[
                  { label: 'Deployed', val: formatCurrency(invDeployed), col: invDeployed > 0 ? 'var(--green)' : 'var(--text-muted)' },
                  { label: 'Earnings', val: formatCurrency(invEarnings), col: invEarnings > 0 ? 'var(--green)' : 'var(--text-muted)' },
                  { label: 'Utilization', val: `${invUtilPct}%`, col: parseFloat(invUtilPct) >= 80 ? 'var(--green)' : 'var(--gold)' },
                  { label: 'Rate', val: `${(rate * 100).toFixed(0)}%/cycle`, col: 'var(--blue)' },
                ].map((m, i) => (
                  <div key={i} style={{ padding: '12px 16px', textAlign: 'center', borderLeft: i > 0 ? '1px solid var(--card-border)' : 'none' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>{m.label}</div>
                    <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 15, color: m.col }}>{m.val}</div>
                  </div>
                ))}
              </div>

              {/* Per-investor accrual breakdown */}
              {invActive.length > 0 && (
                <div style={{ borderBottom: '1px solid var(--card-border)', background: 'rgba(34,197,94,0.03)' }}>
                  {[
                    { label: "Today's Accrual", value: invTodayAccrual, color: 'var(--green)', live: true },
                    { label: "Yesterday's Accrual", value: invYesterdayAccrual, color: '#F59E0B', live: false },
                    { label: 'Overall Accrued', value: invOverallAccrual, color: tierColor, live: false },
                  ].map((row, ri) => (
                    <div key={ri} style={{ padding: '8px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: ri > 0 ? '1px solid var(--card-border)' : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {row.live ? (
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: row.color, boxShadow: `0 0 6px ${row.color}` }} />
                        ) : (
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: row.color, opacity: 0.6 }} />
                        )}
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{row.label}</span>
                      </div>
                      <span style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 13, color: row.color }}>+{formatCurrency(row.value)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Active loans list */}
              {invActive.length > 0 ? (
                <div style={{ padding: '10px 22px 16px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                    Active Loans ({invActive.length})
                  </div>
                  {invActive.map((loan, i) => {
                    const b = borrowers.find(x => x.id === loan.borrower_id)
                    return (
                      <div key={loan.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderTop: i > 0 ? '1px solid var(--card-border)' : 'none' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{b?.full_name || '—'}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{b?.department} · {loan.payments_made || 0}/{loan.num_installments || 4} paid</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{formatCurrency(loan.loan_amount)}</div>
                          <div style={{ fontSize: 11, color: loan.status === 'Active' ? 'var(--blue)' : loan.status === 'Partially Paid' ? 'var(--purple)' : 'var(--gold)', fontWeight: 600 }}>{loan.status}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div style={{ padding: '16px 22px', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
                  No active loans assigned to this investor
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Empty state */}
      {investors.length === 0 && (
        <div className="empty-state">
          <Briefcase size={48} />
          <h3>No Investors Yet</h3>
          <p>Investors will appear here once they register through the portal.</p>
        </div>
      )}
    </div>
  )
}
