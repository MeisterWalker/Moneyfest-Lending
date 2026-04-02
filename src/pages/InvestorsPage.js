import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { formatCurrency } from '../lib/helpers'
import { Users, TrendingUp, Wallet, Briefcase, ExternalLink } from 'lucide-react'

const TIER_RATES = { 'Starter': 0.07, 'Standard': 0.08, 'Premium': 0.09 }
const TIER_COLORS = { 'Premium': '#F59E0B', 'Standard': '#3B82F6', 'Starter': '#94A3B8' }

export default function InvestorsPage() {
  const [investors, setInvestors] = useState([])
  const [loans, setLoans] = useState([])
  const [borrowers, setBorrowers] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    const [{ data: inv }, { data: l }, { data: b }] = await Promise.all([
      supabase.from('investors').select('*').order('created_at', { ascending: false }),
      supabase.from('loans').select('*').order('created_at', { ascending: false }),
      supabase.from('borrowers').select('id, full_name, department, building')
    ])
    setInvestors(inv || [])
    setLoans(l || [])
    setBorrowers(b || [])
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
  const totalEarnings = paidInvestorLoans.reduce((s, l) => {
    const inv = investors.find(i => i.id === l.investor_id)
    const rate = TIER_RATES[inv?.tier] || 0.08
    return s + Number(l.loan_amount || 0) * rate
  }, 0)
  const deployedPct = totalCapital > 0 ? ((totalDeployed / totalCapital) * 100).toFixed(1) : '0.0'

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
          const invEarnings = invPaid.reduce((s, l) => s + Number(l.loan_amount || 0) * rate, 0)
          const tierColor = TIER_COLORS[inv.tier] || '#94A3B8'
          const invUtilPct = Number(inv.total_capital) > 0 ? ((invDeployed / Number(inv.total_capital)) * 100).toFixed(0) : '0'

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
