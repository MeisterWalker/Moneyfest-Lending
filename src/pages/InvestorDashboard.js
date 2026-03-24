import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { formatCurrency } from '../lib/helpers'
import { 
  TrendingUp, Wallet, ArrowUpRight, 
  BarChart3, RefreshCw, LayoutDashboard, Info, LogOut
} from 'lucide-react'
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer
} from 'recharts'

const TIER_RATES = {
  'Starter': 0.105,  // 7% * 1.5 cycles
  'Standard': 0.12,  // 8% * 1.5 cycles
  'Premium': 0.135   // 9% * 1.5 cycles
}

function StatCard({ title, value, subtitle, icon: Icon, trend, color = 'blue' }) {
  const colors = {
    blue: { bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.2)', icon: '#3B82F6' },
    green: { bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.2)', icon: '#22C55E' },
    purple: { bg: 'rgba(139,92,246,0.1)', border: 'rgba(139,92,246,0.2)', icon: '#8B5CF6' },
    gold: { bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.2)', icon: '#F59E0B' }
  }
  const c = colors[color] || colors.blue

  return (
    <div className="card" style={{ 
      padding: '20px 24px', 
      background: 'rgba(255,255,255,0.02)', 
      border: `1px solid ${c.border}`,
      position: 'relative',
      overflow: 'hidden'
    }}>
      <div style={{ position: 'absolute', top: -10, right: -10, opacity: 0.1 }}>
        <Icon size={80} style={{ color: c.icon }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{title}</div>
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 24, color: 'var(--text-primary)', marginBottom: 4 }}>{value}</div>
          <div style={{ fontSize: 11, color: trend > 0 ? 'var(--green)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
            {trend > 0 && <ArrowUpRight size={12} />}
            {subtitle}
          </div>
        </div>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: c.bg, border: `1px solid ${c.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={20} style={{ color: c.icon }} />
        </div>
      </div>
    </div>
  )
}

export default function InvestorDashboard() {
  const [investor, setInvestor] = useState(null)
  const [loans, setLoans] = useState([])
  const [loading, setLoading] = useState(true)
  const [forecastData, setForecastData] = useState([])

  const fetchData = useCallback(async () => {
    const partnerCode = localStorage.getItem('lm_partner_code')
    if (!partnerCode) {
      setLoading(false)
      return
    }

    const { data: inv, error: invErr } = await supabase
      .from('investors')
      .select('*')
      .eq('access_code', partnerCode)
      .single()

    if (invErr || !inv) {
      setLoading(false)
      return
    }

    setInvestor(inv)

    // Fetch loans funded by this investor
    const { data: lData } = await supabase
      .from('loans')
      .select('*, borrowers(full_name, department, building)')
      .eq('investor_id', inv.id)
      .order('created_at', { ascending: false })

    setLoans(lData || [])

    // Generate forecast (12 months compounding quarterly)
    const rate = TIER_RATES[inv.tier] || 0.12
    const capital = Number(inv.total_capital || 0)
    const months = Array.from({ length: 13 }, (_, i) => {
      // Compounding happens every 3 months (payout reinvestment)
      const quarters = Math.floor(i / 3)
      const projected = capital * Math.pow(1 + rate, quarters)
      return {
        month: i === 0 ? 'Now' : `Month ${i}`,
        value: Math.round(projected),
        earnings: Math.round(projected - capital)
      }
    })
    setForecastData(months)

    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>

  if (!investor) return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <h2 style={{ color: 'var(--text-primary)' }}>Access Denied</h2>
      <p style={{ color: 'var(--text-muted)' }}>Please log in via the partner portal.</p>
      <a href="/portal" className="btn-primary" style={{ marginTop: 20, display: 'inline-block', textDecoration: 'none' }}>Go to Portal</a>
    </div>
  )

  const activeCapital = loans
    .filter(l => ['Active', 'Partially Paid', 'Overdue'].includes(l.status))
    .reduce((sum, l) => sum + Number(l.loan_amount), 0)

  const totalEarned = loans
    .filter(l => l.status === 'Paid')
    .reduce((sum, l) => sum + (Number(l.loan_amount) * (TIER_RATES[investor.tier] || 0.12)), 0)

  return (
    <div className="page-container" style={{ padding: '24px 32px' }}>
      <header style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ padding: '6px 12px', background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 20, fontSize: 11, fontWeight: 700, color: '#8B5CF6', textTransform: 'uppercase' }}>
              {investor.tier} Partner
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>ID: {investor.access_code}</span>
          </div>
          <h1 style={{ fontFamily: 'Space Grotesk', fontSize: 32, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Welcome back, <span style={{ background: 'linear-gradient(90deg,#3B82F6,#8B5CF6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{investor.full_name.split(' ')[0]}</span>
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-secondary" onClick={fetchData} style={{ padding: '8px 14px' }}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button className="btn-secondary" 
            onClick={() => { localStorage.removeItem('lm_partner_code'); window.location.href = '/portal' }} 
            style={{ 
              padding: '8px 14px',
              background: 'rgba(239,68,68,0.08)',
              borderColor: 'rgba(239,68,68,0.15)',
              color: '#EF4444'
            }}>
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </header>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24, marginBottom: 32 }}>
        <StatCard 
          title="Total Capital" 
          value={formatCurrency(investor.total_capital)} 
          subtitle="Total investment pool" 
          icon={Wallet} 
          color="purple" 
        />
        <StatCard 
          title="Active Deployment" 
          value={formatCurrency(activeCapital)} 
          subtitle={`${((activeCapital / investor.total_capital) * 100).toFixed(1)}% utilization`}
          icon={TrendingUp} 
          color="blue" 
          trend={1}
        />
        <StatCard 
          title="Accumulated Returns" 
          value={formatCurrency(totalEarned)} 
          subtitle={`Net profit to date`}
          icon={ArrowUpRight} 
          color="green" 
          trend={1}
        />
        <StatCard 
          title="Yield Forecast (90d)" 
          value={((TIER_RATES[investor.tier] || 0.08) * 100).toFixed(0) + '%'} 
          subtitle="Fixed return per cycle" 
          icon={BarChart3} 
          color="gold" 
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start' }}>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div>
                <h3 style={{ fontFamily: 'Space Grotesk', fontWeight: 800, margin: 0 }}>Earnings Forecast</h3>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>12-month compounded growth projection (assuming reinvestment)</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Year 1 Target</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--green)' }}>
                  {formatCurrency(forecastData[12]?.value || 0)}
                </div>
              </div>
            </div>
            
            <div style={{ height: 300, width: '100%', marginTop: 20 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={forecastData}>
                  <defs>
                    <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `₱${v/1000}k`} />
                  <Tooltip 
                    contentStyle={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }}
                    itemStyle={{ color: '#F0F4FF' }}
                    formatter={(val) => [`₱${val.toLocaleString()}`, 'Projected Capital']}
                  />
                  <Area type="monotone" dataKey="value" stroke="#8B5CF6" strokeWidth={3} fillOpacity={1} fill="url(#colorVal)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontFamily: 'Space Grotesk', fontWeight: 800, margin: 0 }}>Deployed Capital</h3>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{loans.length} active borrower assignments</div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--card-border)' }}>
                    <th style={{ padding: '14px 24px', fontSize: 11, color: 'var(--text-label)', textTransform: 'uppercase' }}>Borrower</th>
                    <th style={{ padding: '14px 24px', fontSize: 11, color: 'var(--text-label)', textTransform: 'uppercase' }}>Building</th>
                    <th style={{ padding: '14px 24px', fontSize: 11, color: 'var(--text-label)', textTransform: 'uppercase' }}>Capital Lent</th>
                    <th style={{ padding: '14px 24px', fontSize: 11, color: 'var(--text-label)', textTransform: 'uppercase' }}>Your Share</th>
                    <th style={{ padding: '14px 24px', fontSize: 11, color: 'var(--text-label)', textTransform: 'uppercase' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loans.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No capital deployed yet. Your funds are in the standing pool.</td>
                    </tr>
                  ) : loans.map((loan, i) => {
                    const share = Number(loan.loan_amount) * (TIER_RATES[investor.tier] || 0.12)
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', fontSize: 14 }}>
                        <td style={{ padding: '16px 24px' }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{loan.borrowers?.full_name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{loan.borrowers?.department}</div>
                        </td>
                        <td style={{ padding: '16px 24px' }}>
                          <span style={{ padding: '3px 8px', borderRadius: 4, background: 'rgba(59,130,246,0.1)', color: '#60A5FA', fontSize: 11, fontWeight: 700 }}>
                            {loan.borrowers?.building || 'Main'}
                          </span>
                        </td>
                        <td style={{ padding: '16px 24px', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {formatCurrency(loan.loan_amount)}
                        </td>
                        <td style={{ padding: '16px 24px', fontWeight: 700, color: 'var(--green)' }}>
                          +{formatCurrency(share)}
                        </td>
                        <td style={{ padding: '16px 24px' }}>
                          <span style={{ fontSize: 12, color: loan.status === 'Paid' ? 'var(--green)' : 'var(--blue)' }}>
                            {loan.status}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div className="card" style={{ padding: 24, background: 'linear-gradient(135deg,#1e1b4b,#0E1320)' }}>
            <h4 style={{ fontFamily: 'Syne', fontWeight: 800, margin: '0 0 16px', fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
              <LayoutDashboard size={18} /> Portfolio Insights
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Risk Level</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  Low-Risk (Secured) <Info size={12} />
                </div>
              </div>
              <div style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Next Distribution</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {new Date(new Date().getTime() + 15 * 24 * 60 * 60 * 1000).toLocaleDateString()}
                </div>
              </div>
              <div style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Partner Tier</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#F59E0B' }}>
                  {investor.tier} Benefits Active
                </div>
              </div>
            </div>
            <button className="btn-primary" style={{ width: '100%', marginTop: 24, fontSize: 13, height: 42 }}>
              Request Capital Payout
            </button>
          </div>

          <div className="card" style={{ padding: 20, borderStyle: 'dashed' }}>
            <h5 style={{ margin: '0 0 8px', fontSize: 13 }}>💡 Partner Support</h5>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
              Need to increase your capital or change your payout methods? Contact Moneyfest Lending admin directly through the portal info.
            </p>
          </div>
        </div>

      </div>
    </div>
  )
}
