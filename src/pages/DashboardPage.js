import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { CREDIT_CONFIG, getBadgeFromScore } from '../lib/creditSystem'
import { logAudit, formatCurrency, formatDate } from '../lib/helpers'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'
import { ClipboardList } from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import {
  TrendingUp, DollarSign, AlertTriangle, Clock,
  Users, CreditCard, Activity, Percent, CheckCircle,
  ArrowUpRight, ArrowDownRight, Calendar, Banknote,
  Trophy, ShieldAlert, ChevronRight, Eye
} from 'lucide-react'

// ─── Stat Card ────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, color, trend }) {
  return (
    <div className="card" style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: `${color}20`, border: `1px solid ${color}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <Icon size={18} color={color} />
        </div>
        {trend !== undefined && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, color: trend >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {trend >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
        <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 22, color: 'var(--text-primary)', lineHeight: 1.1 }}>{value}</div>
        {sub && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{sub}</div>}
      </div>
    </div>
  )
}

// ─── Collection Efficiency Card ───────────────────────────────
function EfficiencyCard({ rate, onTime, total }) {
  const color = rate >= 90 ? 'var(--green)' : rate >= 70 ? 'var(--gold)' : 'var(--red)'
  const label = rate >= 90 ? 'Excellent' : rate >= 70 ? 'Good' : 'Needs Attention'
  return (
    <div className="card" style={{ padding: '20px 22px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: `${color}20`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Percent size={18} color={color} />
        </div>
        <span style={{ fontSize: 11, color, background: `${color}15`, border: `1px solid ${color}30`, padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>{label}</span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Collection Efficiency</div>
      <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 22, color, lineHeight: 1.1, marginBottom: 4 }}>{rate.toFixed(1)}%</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{onTime} of {total} installments on time</div>
      {/* Mini bar */}
      <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, marginTop: 10, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${rate}%`, background: color, borderRadius: 2, transition: 'width 0.5s ease' }} />
      </div>
    </div>
  )
}

// ─── Cutoff Banner ────────────────────────────────────────────
function CutoffBanner({ loans, borrowers, onMarkPaid, onDismiss }) {
  const today = new Date()
  const day = today.getDate()
  const isCutoffDay = day === 5 || day === 20
  if (!isCutoffDay) return null

  const due = loans.filter(l => ['Active', 'Partially Paid'].includes(l.status))
  const total = due.reduce((sum, l) => sum + (l.installment_amount || 0), 0)

  return (
    <div style={{
      background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)',
      borderLeft: '4px solid var(--blue)', borderRadius: 12, padding: '18px 22px', marginBottom: 24
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Calendar size={18} color="var(--blue)" />
          <span style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 16 }}>
            📅 Today is a Cutoff Day — {today.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}
          </span>
        </div>
        <button onClick={onDismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12 }}>Dismiss</button>
      </div>

      {due.length === 0 ? (
        <p style={{ color: 'var(--green)', fontSize: 13 }}>✅ All payments collected for today!</p>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
            {due.map(loan => {
              const borrower = borrowers.find(b => b.id === loan.borrower_id)
              return (
                <div key={loan.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '10px 14px', flexWrap: 'wrap', gap: 8
                }}>
                  <div>
                    <span style={{ fontSize: 14, fontWeight: 500 }}>{borrower?.full_name}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>
                      Installment {loan.payments_made + 1} of {loan.num_installments || 4}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontFamily: 'Space Grotesk', fontWeight: 700, color: 'var(--blue)' }}>
                      {formatCurrency(loan.installment_amount)}
                    </span>
                    <button onClick={() => onMarkPaid(loan)}
                      style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                      ✅ Mark Paid
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', borderTop: '1px solid rgba(59,130,246,0.15)', paddingTop: 10 }}>
            Total to collect today: <span style={{ color: 'var(--blue)' }}>{formatCurrency(total)}</span>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Countdown Widget ─────────────────────────────────────────
function CountdownWidget({ loans, borrowers }) {
  const today = new Date()
  const day = today.getDate()
  const month = today.getMonth()
  const year = today.getFullYear()
  const isCutoffDay = day === 5 || day === 20
  if (isCutoffDay) return null

  let nextCutoff
  if (day < 5) nextCutoff = new Date(year, month, 5)
  else if (day < 20) nextCutoff = new Date(year, month, 20)
  else nextCutoff = new Date(year, month + 1, 5)

  const daysLeft = Math.ceil((nextCutoff - today) / (1000 * 60 * 60 * 24))
  const dueLoansList = loans.filter(l => ['Active', 'Partially Paid'].includes(l.status))
  const totalExpected = dueLoansList.reduce((sum, l) => sum + (l.installment_amount || 0), 0)

  return (
    <div className="card" style={{ padding: '20px 22px', marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <Clock size={18} color="var(--blue)" />
        <span style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 15 }}>
          ⏳ Next Cutoff in{' '}
          <span style={{ color: 'var(--blue)', fontSize: 20 }}>{daysLeft}</span>
          {' '}day{daysLeft !== 1 ? 's' : ''} — 
          {nextCutoff.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 20, marginBottom: 14, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Borrowers Due</div>
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 18, color: 'var(--text-primary)' }}>{dueLoansList.length}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Expected Collection</div>
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 18, color: 'var(--green)' }}>{formatCurrency(totalExpected)}</div>
        </div>
      </div>
      {dueLoansList.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {dueLoansList.slice(0, 3).map(loan => {
            const b = borrowers.find(x => x.id === loan.borrower_id)
            return (
              <div key={loan.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-label)' }}>
                <span>{b?.full_name}</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{formatCurrency(loan.installment_amount)}</span>
              </div>
            )
          })}
          {dueLoansList.length > 3 && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>+{dueLoansList.length - 3} more</div>}
        </div>
      )}
    </div>
  )
}

// ─── Top Borrowers Widget ─────────────────────────────────────
function TopBorrowersWidget({ borrowers, navigate }) {
  const sorted = [...borrowers].sort((a, b) => b.credit_score - a.credit_score)
  const top = sorted.slice(0, 3)
  const atRisk = [...borrowers].filter(b => b.credit_score < 600).sort((a, b) => a.credit_score - b.credit_score).slice(0, 3)

  const BADGE = { New: "🆕", Trusted: "✅", Reliable: "⭐", VIP: "👑" }

  return (
    <div className="card" style={{ padding: '20px 22px' }}>
      <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Borrower Insights</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--gold)', fontWeight: 600, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Trophy size={13} /> Top Borrowers
          </div>
          {top.length === 0 ? <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No borrowers yet</p> : top.map(b => (
            <div key={b.id} onClick={() => navigate('/borrowers')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--card-border)', cursor: 'pointer' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{b.full_name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{BADGE[b.loyalty_badge]} {b.loyalty_badge}</div>
              </div>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 15, color: 'var(--green)' }}>{b.credit_score}</div>
            </div>
          ))}
        </div>
        <div>
          <div style={{ fontSize: 12, color: 'var(--red)', fontWeight: 600, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <ShieldAlert size={13} /> At Risk
          </div>
          {atRisk.length === 0 ? <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No borrowers yet</p> : atRisk.map(b => (
            <div key={b.id} onClick={() => navigate('/borrowers')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--card-border)', cursor: 'pointer' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{b.full_name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{b.risk_score} Risk</div>
              </div>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 15, color: b.credit_score < 550 ? 'var(--red)' : 'var(--gold)' }}>{b.credit_score}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Audit Widget ─────────────────────────────────────────────
function AuditWidget({ logs }) {
  return (
    <div className="card" style={{ padding: '20px 22px' }}>
      <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 16, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        Recent Activity
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Sans', fontWeight: 400 }}>Last 10 actions</span>
      </div>
      {logs.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No activity yet</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {logs.map((log, i) => (
            <div key={log.id} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: i < logs.length - 1 ? '1px solid var(--card-border)' : 'none' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--blue)', marginTop: 6, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 2 }}>{log.description}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {log.changed_by} · {new Date(log.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Custom Tooltip ───────────────────────────────────────────
function CustomTooltip({ active, payload, label, prefix = "₱" }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#1E2640',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: 10,
      padding: '10px 14px',
      fontSize: 13,
      fontFamily: 'DM Sans, sans-serif',
      boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
    }}>
      <div style={{ color: '#7A8AAA', marginBottom: 6, fontSize: 12 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, fontWeight: 700, fontSize: 14 }}>
          {prefix}{typeof p.value === 'number' ? p.value.toLocaleString('en-PH', { minimumFractionDigits: 2 }) : p.value}
        </div>
      ))}
    </div>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────
export default function DashboardPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [loans, setLoans] = useState([])
  const [pendingApps, setPendingApps] = useState(0)
  const [borrowers, setBorrowers] = useState([])
  const [settings, setSettings] = useState(null)
  const [auditLogs, setAuditLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const [visitStats, setVisitStats] = useState({ total: 0, today: 0, pages: {} })
  const [dashTab, setDashTab] = useState('installment')
  const navigate = useNavigate()

  const fetchData = useCallback(async () => {
    try {
      const [{ data: l }, { data: b }, { data: s }, { data: a }, { data: apps }, { data: visits }] = await Promise.all([
        supabase.from('loans').select('*').order('created_at', { ascending: false }),
        supabase.from('borrowers').select('*'),
        supabase.from('settings').select('*').eq('id', 1).single(),
        supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(10),
        supabase.from('applications').select('id').eq('status', 'Pending'),
        supabase.from('page_visits').select('page, visited_at')
      ])
      setLoans(l || [])
      setBorrowers(b || [])
      setPendingApps((apps || []).length)
      setSettings(s)
      setAuditLogs(a || [])

      // Compute visitor stats
      const allVisits = visits || []
      const todayStr = new Date().toISOString().slice(0, 10)
      const todayVisits = allVisits.filter(v => v.visited_at?.slice(0, 10) === todayStr)
      const pages = {}
      allVisits.forEach(v => { pages[v.page] = (pages[v.page] || 0) + 1 })
      setVisitStats({ total: allVisits.length, today: todayVisits.length, pages })
    } catch (err) {
      console.error('Dashboard fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Real-time refresh when loans change
  useEffect(() => {
    const sub = supabase
      .channel('loans-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loans' }, () => fetchData())
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [fetchData])

  // ── Computed stats ──────────────────────────────────────────
  const capital = settings?.starting_capital || 30000
  const activeLoans = loans.filter(l => ['Active', 'Partially Paid'].includes(l.status))
  const amountLentOut = activeLoans.reduce((sum, l) => sum + (l.loan_amount || 0), 0)
  const paidLoans = loans.filter(l => l.status === 'Paid')

  // Total profit = fully paid loans interest + interest earned so far on active loans
  const paidProfit = paidLoans.reduce((sum, l) => sum + ((l.total_repayment || 0) - (l.loan_amount || 0)), 0)
  const activeProfit = activeLoans.reduce((sum, l) => {
    const installment = Math.ceil(l.installment_amount || 0)
    const paidSoFar = installment * (l.payments_made || 0)
    const interestRate = (l.interest_rate || 0.07) * (l.loan_term || 2)
    const totalInterest = (l.loan_amount || 0) * interestRate
    const interestEarned = totalInterest > 0 ? (paidSoFar / (l.total_repayment || 1)) * totalInterest : 0
    return sum + interestEarned
  }, 0)
  const totalProfit = paidProfit + activeProfit

  // ── QuickLoan stats ──────────────────────────────────────────
  const activeQuickLoans = loans.filter(l => l.loan_type === 'quickloan' && ['Active', 'Partially Paid', 'Overdue'].includes(l.status))
  const paidQuickLoans = loans.filter(l => l.loan_type === 'quickloan' && l.status === 'Paid')

  const qlTotalPrincipalOut = activeQuickLoans.reduce((sum, l) => sum + (l.loan_amount || 0), 0)

  const qlTotalInterestEarned = paidQuickLoans.reduce((sum, l) => {
    return sum + ((l.total_repayment || 0) - (l.loan_amount || 0))
  }, 0)

  const qlDay15Overdue = activeQuickLoans.filter(l => {
    if (!l.release_date) return false
    const days = Math.floor((new Date() - new Date(l.release_date)) / (1000 * 60 * 60 * 24))
    return days > 15 && !l.extension_fee_charged
  }).length

  const qlPastDeadline = activeQuickLoans.filter(l => {
    if (!l.release_date) return false
    const days = Math.floor((new Date() - new Date(l.release_date)) / (1000 * 60 * 60 * 24))
    return days > 30
  }).length

  const defaultedLoans = loans.filter(l => l.status === 'Defaulted')
  const defaultRate = loans.length > 0 ? (defaultedLoans.length / loans.length) * 100 : 0
  const availableLiquidity = capital - amountLentOut
  const roi = capital > 0 ? (totalProfit / capital) * 100 : 0

  // Profit this month — paid loans + active interest earned this month
  const now = new Date()
  const profitThisMonth = paidLoans
    .filter(l => new Date(l.updated_at).getMonth() === now.getMonth() && new Date(l.updated_at).getFullYear() === now.getFullYear())
    .reduce((sum, l) => sum + ((l.total_repayment || 0) - (l.loan_amount || 0)), 0)

  // Projected yearly — use avg loan term from portfolio
  const avgTerm = loans.length > 0
    ? loans.reduce((sum, l) => sum + (l.loan_term || 2), 0) / loans.length
    : 2
  const cyclesPerYear = 12 / avgTerm
  const projectedYearly = availableLiquidity * (settings?.interest_rate || 0.07) * avgTerm * cyclesPerYear

  // Redirect to Loans page to record payment
  const handleMarkPaid = (loan) => {
    toast('Recording payment — redirecting to Loans page for full processing.', 'info')
    navigate('/admin/loans')
  }

  // Collection efficiency - only count loans created after last reset
  const resetDate = settings?.last_reset_date ? new Date(settings.last_reset_date) : null
  const loansAfterReset = resetDate
    ? activeLoans.filter(l => new Date(l.created_at) >= resetDate)
    : activeLoans
  const totalInstallmentsDue = loansAfterReset.reduce((sum, l) => sum + l.payments_made, 0)
  const totalExpectedInstallments = loansAfterReset.reduce((sum, l) => sum + (l.num_installments || 4), 0)
  const efficiencyRate = totalExpectedInstallments > 0 ? (totalInstallmentsDue / totalExpectedInstallments) * 100 : 100

  // Monthly profit chart data (last 6 months, filtered by reset date)
  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - (5 - i))
    const profit = paidLoans
      .filter(l => {
        const updated = new Date(l.updated_at)
        const afterReset = resetDate ? updated >= resetDate : true
        return afterReset && updated.getMonth() === d.getMonth() && updated.getFullYear() === d.getFullYear()
      })
      .reduce((sum, l) => sum + ((l.total_repayment || 0) - (l.loan_amount || 0)), 0)
    return {
      month: d.toLocaleDateString('en-PH', { month: 'short' }),
      profit
    }
  })

  // Capital growth chart
  const capitalGrowthData = monthlyData.map((m, i) => ({
    month: m.month,
    capital: capital + monthlyData.slice(0, i + 1).reduce((sum, x) => sum + x.profit, 0)
  }))

  // ── QuickLoan dashboard stats ────────────────────────────────
  const qlResetDate = settings?.ql_last_reset_date ? new Date(settings.ql_last_reset_date) : null
  const qlCapital = settings?.ql_starting_capital || 0
  const qlAmountLentOut = activeQuickLoans.reduce((sum, l) => sum + (l.loan_amount || 0), 0)
  const qlAvailableLiquidity = qlCapital - qlAmountLentOut

  const qlPaidAfterReset = qlResetDate
    ? paidQuickLoans.filter(l => new Date(l.updated_at) >= qlResetDate)
    : paidQuickLoans
  const qlTotalProfitAllTime = paidQuickLoans.reduce((sum, l) => sum + Math.max(0, (l.total_repayment || 0) - (l.loan_amount || 0)), 0)

  const now2 = new Date()
  const qlProfitThisMonth = paidQuickLoans
    .filter(l => new Date(l.updated_at).getMonth() === now2.getMonth() && new Date(l.updated_at).getFullYear() === now2.getFullYear())
    .reduce((sum, l) => sum + Math.max(0, (l.total_repayment || 0) - (l.loan_amount || 0)), 0)

  // QuickLoan ROI — based on capital if set, otherwise based on principal deployed
  const qlRoi = qlCapital > 0 ? (qlTotalProfitAllTime / qlCapital) * 100 : 0
  // Projected: 2 cycles/month at 10%/month = 5% per cycle × 2 = 10%/month on deployed capital
  const qlProjectedYearly = qlAvailableLiquidity > 0 ? qlAvailableLiquidity * 0.10 * 12 : (qlCapital * 0.10 * 12)

  // QL collection efficiency — ratio of loans paid on time (day 15) vs extended/late
  const qlPaidOnDay15 = paidQuickLoans.filter(l => {
    if (!l.release_date) return false
    const days = Math.floor((new Date(l.updated_at) - new Date(l.release_date)) / (1000 * 60 * 60 * 24))
    return days <= 15
  }).length
  const qlEfficiency = paidQuickLoans.length > 0 ? (qlPaidOnDay15 / paidQuickLoans.length) * 100 : 100
  const donutData = [
    { name: 'Active', value: activeLoans.length, color: 'var(--blue)' },
    { name: 'Paid', value: paidLoans.length, color: 'var(--green)' },
    { name: 'Pending', value: loans.filter(l => l.status === 'Pending').length, color: 'var(--gray)' },
    { name: 'Overdue', value: loans.filter(l => l.status === 'Overdue').length, color: 'var(--gold)' },
    { name: 'Defaulted', value: defaultedLoans.length, color: 'var(--red)' },
  ].filter(d => d.value > 0)

  if (loading) return (
    <div style={{ padding: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Loading dashboard...</div>
    </div>
  )

  return (
    <div style={{ padding: '32px 28px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header with tab toggle */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {dashTab === 'installment' ? 'Dashboard' : '⚡ QuickLoan Dashboard'}
          </h1>
          <p className="page-subtitle">
            {new Date().toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        {/* Tab toggle */}
        <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 4 }}>
          {[
            { key: 'installment', label: '📅 Installment Loans' },
            { key: 'quickloan',   label: '⚡ QuickLoan' },
          ].map(tab => (
            <button key={tab.key} onClick={() => setDashTab(tab.key)}
              style={{
                padding: '8px 18px', borderRadius: 9, border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 600, transition: 'all 0.15s ease',
                background: dashTab === tab.key
                  ? tab.key === 'quickloan' ? 'rgba(245,158,11,0.2)' : 'rgba(59,130,246,0.2)'
                  : 'transparent',
                color: dashTab === tab.key
                  ? tab.key === 'quickloan' ? '#F59E0B' : 'var(--blue)'
                  : 'var(--text-muted)',
              }}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── INSTALLMENT LOAN DASHBOARD ── */}
      {dashTab === 'installment' && (
        <div>

      {/* Cutoff Banner */}
      {!bannerDismissed && (
        <CutoffBanner loans={loans} borrowers={borrowers} onMarkPaid={handleMarkPaid} onDismiss={() => setBannerDismissed(true)} />
      )}

      {/* Countdown Widget */}
      <CountdownWidget loans={loans} borrowers={borrowers} />

      {/* Overdue Escalation Alerts */}
      {loans.filter(l => l.status === 'Overdue').map(loan => {
        const b = borrowers.find(x => x.id === loan.borrower_id)
        return (
          <div key={loan.id} style={{
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
            borderLeft: '4px solid var(--red)', borderRadius: 12, padding: '16px 20px', marginBottom: 16,
            display: 'flex', alignItems: 'flex-start', gap: 14
          }}>
            <AlertTriangle size={20} color="var(--red)" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}><span style={{ display: "flex", alignItems: "center", gap: 6 }}><img src="/warning.png" alt="warning" style={{ width: 16, height: 16, objectFit: "contain" }} />Overdue — {b?.full_name}</span></div>
              <div style={{ fontSize: 13, color: 'var(--text-label)' }}>
                Loan of {formatCurrency(loan.loan_amount)} · {loan.payments_made} of {loan.num_installments || 4} paid · Balance {formatCurrency(loan.remaining_balance)}
              </div>
            </div>
          </div>
        )
      })}

      {/* Stat Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <StatCard label="Total Capital" value={formatCurrency(capital)} sub="Starting capital" icon={Banknote} color="var(--blue)" />
        <StatCard label="Amount Lent Out" value={formatCurrency(amountLentOut)} sub={`${activeLoans.length} active loans`} icon={CreditCard} color="var(--purple)" />
        <StatCard label="Total Profit" value={formatCurrency(totalProfit)} sub="All-time earnings" icon={TrendingUp} color="var(--green)" />
        <StatCard label="Profit This Month" value={formatCurrency(profitThisMonth)} icon={Activity} color="var(--teal)" />
        <StatCard label="Projected Yearly" value={formatCurrency(projectedYearly)} sub="Based on available capital" icon={ArrowUpRight} color="var(--blue)" />
        <StatCard label="Default Rate" value={`${defaultRate.toFixed(1)}%`} sub={`${defaultedLoans.length} defaulted`} icon={AlertTriangle} color={defaultRate > 10 ? 'var(--red)' : 'var(--gold)'} />
        <StatCard label="Available Liquidity" value={formatCurrency(availableLiquidity)} sub="Ready to lend" icon={Banknote} color="var(--green)" />
        <StatCard label="ROI" value={`${roi.toFixed(1)}%`} sub="Return on investment" icon={Percent} color="var(--purple)" />
        <StatCard label="Active Loans" value={activeLoans.length} sub={`${loans.length} total`} icon={Users} color="var(--blue)" />
      </div>

      {/* Collection Efficiency */}
      <div style={{ marginBottom: 24 }}>
        <EfficiencyCard rate={efficiencyRate} onTime={totalInstallmentsDue} total={totalExpectedInstallments || 1} />
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        {/* Capital Growth Line Chart */}
        <div className="card" style={{ padding: '20px 22px' }}>
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 15, marginBottom: 18 }}>📈 Capital Growth</div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={capitalGrowthData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `₱${(v/1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="capital" stroke="var(--teal)" strokeWidth={2.5} dot={{ fill: 'var(--teal)', r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Monthly Profit Bar Chart */}
        <div className="card" style={{ padding: '20px 22px' }}>
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 15, marginBottom: 18 }}><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><img src="/philippine-peso.png" alt="philippine-peso" style={{ width: 16, height: 16, objectFit: 'contain' }} />Monthly Profit</div></div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `₱${v}`} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="profit" fill="var(--green)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Donut Chart + Top Borrowers */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 20, marginBottom: 24 }}>
        {/* Loan Status Donut */}
        <div className="card" style={{ padding: '20px 22px' }}>
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Loan Status</div>
          {donutData.length === 0 ? (
            <div className="empty-state" style={{ padding: '30px 10px' }}>
              <CheckCircle size={32} />
              <p style={{ marginTop: 10, fontSize: 13 }}>No loans yet</p>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={donutData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                    {donutData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [value, name]}
                    contentStyle={{
                      background: '#1E2640',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: 10,
                      fontSize: 13,
                      fontFamily: 'DM Sans, sans-serif',
                      padding: '8px 14px',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
                    }}
                    itemStyle={{ color: '#F0F4FF', fontWeight: 600 }}
                    labelStyle={{ color: '#7A8AAA', fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                {donutData.map(d => (
                  <div key={d.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.color }} />
                      <span style={{ color: 'var(--text-label)' }}>{d.name}</span>
                    </div>
                    <span style={{ fontWeight: 600, color: d.color }}>{d.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Top Borrowers Widget */}
        <TopBorrowersWidget borrowers={borrowers} navigate={navigate} />
      </div>

      {/* Visitor Counter Widget */}
      <div className="card" style={{ padding: '20px 22px', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Eye size={16} color="var(--blue)" /> Public Page Visitors
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>All-time unique sessions</span>
        </div>

        {/* Summary row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Total Visits', value: visitStats.total, color: 'var(--blue)' },
            { label: 'Today', value: visitStats.today, color: 'var(--green)' },
            { label: 'Home', value: visitStats.pages['home'] || 0, color: 'var(--purple)' },
            { label: 'Apply', value: visitStats.pages['apply'] || 0, color: 'var(--teal)' },
            { label: 'Portal', value: visitStats.pages['portal'] || 0, color: 'var(--gold)' },
            { label: 'FAQ', value: visitStats.pages['faq'] || 0, color: 'var(--blue)' },
          ].map(item => (
            <div key={item.label} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--card-border)', borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 22, color: item.color, lineHeight: 1 }}>{item.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.label}</div>
            </div>
          ))}
        </div>

        {/* Per-page bar chart */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { page: 'home',   label: 'Home Page',       color: 'var(--purple)', icon: '🏠' },
            { page: 'apply',  label: 'Apply Page',      color: 'var(--teal)',   icon: '📝' },
            { page: 'portal', label: 'Borrower Portal', color: 'var(--gold)',   icon: '🏦' },
            { page: 'faq',    label: 'FAQ Page',        color: 'var(--blue)',   icon: '❓' },
          ].map(({ page, label, color, icon }) => {
            const count = visitStats.pages[page] || 0
            const max = Math.max(...Object.values(visitStats.pages), 1)
            const pct = (count / max) * 100
            return (
              <div key={page} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 14, flexShrink: 0 }}>{icon}</span>
                <div style={{ fontSize: 13, color: 'var(--text-label)', minWidth: 110, flexShrink: 0 }}>{label}</div>
                <div style={{ flex: 1, height: 8, background: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4, transition: 'width 0.5s ease' }} />
                </div>
                <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 13, color, minWidth: 32, textAlign: 'right' }}>{count}</div>
              </div>
            )
          })}
        </div>

        <div style={{ marginTop: 14, fontSize: 12, color: 'var(--text-muted)', borderTop: '1px solid var(--card-border)', paddingTop: 12 }}>
          📌 Each visit is counted once per browser session per page — refreshing does not inflate the count.
        </div>
      </div>

      {/* Audit History Widget */}
      <AuditWidget logs={auditLogs} />
        </div>
      )}

      {/* ── QUICKLOAN DASHBOARD ── */}
      {dashTab === 'quickloan' && (
        <div>
          {/* Stat cards — mirrors installment dashboard */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
            <StatCard label="Total Capital" value={qlCapital > 0 ? formatCurrency(qlCapital) : '—'} sub="QuickLoan capital pool" icon={Banknote} color="var(--blue)" />
            <StatCard label="Amount Lent Out" value={formatCurrency(qlAmountLentOut)} sub={`${activeQuickLoans.length} active loans`} icon={CreditCard} color="var(--purple)" />
            <StatCard label="Total Profit" value={formatCurrency(qlTotalProfitAllTime)} sub="All-time interest earned" icon={TrendingUp} color="var(--green)" />
            <StatCard label="Profit This Month" value={formatCurrency(qlProfitThisMonth)} sub="Paid QuickLoans this month" icon={Activity} color="var(--teal)" />
            <StatCard label="Projected Yearly" value={formatCurrency(qlProjectedYearly)} sub="10%/mo on available capital" icon={ArrowUpRight} color="var(--blue)" />
            <StatCard label="Day 15 Missed" value={qlDay15Overdue} sub="Extension fee pending" icon={AlertTriangle} color={qlDay15Overdue > 0 ? 'var(--gold)' : 'var(--text-muted)'} />
            <StatCard label="Available Liquidity" value={qlCapital > 0 ? formatCurrency(qlAvailableLiquidity) : '—'} sub="Ready to lend" icon={Banknote} color="var(--green)" />
            <StatCard label="ROI" value={qlCapital > 0 ? `${qlRoi.toFixed(1)}%` : '—'} sub="Return on capital" icon={Percent} color="var(--purple)" />
            <StatCard label="Active QuickLoans" value={activeQuickLoans.length} sub={`${paidQuickLoans.length} paid all-time`} icon={Users} color="#F59E0B" />
          </div>

          {/* Day 15 on-time rate */}
          {paidQuickLoans.length > 0 && (
            <div className="card" style={{ padding: '18px 22px', marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 14 }}>Day 15 On-Time Rate</span>
                <span style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 20, color: qlEfficiency >= 80 ? 'var(--green)' : qlEfficiency >= 50 ? 'var(--gold)' : 'var(--red)' }}>
                  {qlEfficiency.toFixed(1)}%
                </span>
              </div>
              <div style={{ height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${qlEfficiency}%`, background: qlEfficiency >= 80 ? 'var(--green)' : qlEfficiency >= 50 ? 'var(--gold)' : 'var(--red)', borderRadius: 4, transition: 'width 0.5s ease' }} />
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                {qlPaidOnDay15} of {paidQuickLoans.length} paid loans settled by Day 15
              </div>
            </div>
          )}

          {/* Live balance list */}
          <div className="card" style={{ padding: '20px 22px', marginBottom: 24, borderColor: 'rgba(245,158,11,0.15)' }}>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 15, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              ⚡ Active QuickLoans — Live Balance
            </div>
            {activeQuickLoans.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {activeQuickLoans.map(loan => {
                  const b = borrowers.find(x => x.id === loan.borrower_id)
                  const days = Math.max(0, Math.floor((new Date() - new Date(loan.release_date)) / (1000 * 60 * 60 * 24)))
                  const dailyInterest = parseFloat((loan.loan_amount * 0.1 / 30).toFixed(2))
                  const accruedInterest = parseFloat((dailyInterest * days).toFixed(2))
                  const extensionFee = loan.extension_fee_charged ? 100 : 0
                  const penaltyDays = Math.max(0, days - 30)
                  const penalty = penaltyDays * 25
                  const totalOwed = parseFloat((loan.loan_amount + accruedInterest + extensionFee + penalty).toFixed(2))
                  const phase = days > 30 ? 'penalty' : days > 15 ? 'extended' : 'active'
                  const phaseColor = phase === 'penalty' ? 'var(--red)' : phase === 'extended' ? '#F59E0B' : 'var(--green)'
                  const phaseBg = phase === 'penalty' ? 'rgba(239,68,68,0.06)' : phase === 'extended' ? 'rgba(245,158,11,0.06)' : 'rgba(34,197,94,0.04)'
                  const phaseBorder = phase === 'penalty' ? 'rgba(239,68,68,0.2)' : phase === 'extended' ? 'rgba(245,158,11,0.2)' : 'rgba(34,197,94,0.15)'
                  const phaseLabel = phase === 'penalty' ? '🔴 PENALTY' : phase === 'extended' ? '⚠️ Extended' : '✅ Active'
                  const releaseDate = new Date(loan.release_date)
                  const day15Date = new Date(releaseDate); day15Date.setDate(day15Date.getDate() + 15)
                  const day30Date = new Date(releaseDate); day30Date.setDate(day30Date.getDate() + 30)
                  const daysToDay15 = Math.max(0, Math.ceil((day15Date - new Date()) / (1000 * 60 * 60 * 24)))
                  const daysToDay30 = Math.max(0, Math.ceil((day30Date - new Date()) / (1000 * 60 * 60 * 24)))
                  return (
                    <div key={loan.id} style={{ background: phaseBg, border: `1px solid ${phaseBorder}`, borderRadius: 12, padding: '16px 18px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 14, color: '#F59E0B' }}>
                            {b?.full_name?.charAt(0) || '?'}
                          </div>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{b?.full_name || 'Unknown'}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{b?.department} · Released {new Date(loan.release_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: phaseBg, border: `1px solid ${phaseBorder}`, color: phaseColor }}>{phaseLabel}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Day {days}</span>
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10, marginBottom: 12 }}>
                        {[
                          { label: 'Principal', value: formatCurrency(loan.loan_amount), color: 'var(--text-primary)' },
                          { label: 'Accrued Interest', value: formatCurrency(accruedInterest), color: '#a78bfa' },
                          { label: 'Extension Fee', value: extensionFee > 0 ? formatCurrency(extensionFee) : '—', color: '#F59E0B' },
                          { label: 'Penalty', value: penalty > 0 ? formatCurrency(penalty) : '—', color: 'var(--red)' },
                          { label: 'Total Owed Now', value: formatCurrency(totalOwed), color: phaseColor },
                        ].map(item => (
                          <div key={item.label} style={{ background: 'rgba(0,0,0,0.15)', borderRadius: 8, padding: '8px 10px' }}>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{item.label}</div>
                            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 14, color: item.color }}>{item.value}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: days <= 15 ? 'var(--green)' : 'var(--red)', display: 'inline-block' }} />
                          Day 15: {day15Date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                          {days <= 15 ? ` · ${daysToDay15} day${daysToDay15 !== 1 ? 's' : ''} left` : ' · missed'}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: days <= 30 ? '#F59E0B' : 'var(--red)', display: 'inline-block' }} />
                          Day 30: {day30Date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                          {days <= 30 ? ` · ${daysToDay30} day${daysToDay30 !== 1 ? 's' : ''} left` : ' · PAST DEADLINE'}
                        </span>
                        <span>₱{dailyInterest.toFixed(2)}/day · {penalty > 0 ? '₱25/day penalty' : 'no penalty yet'}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                No active QuickLoans.
              </div>
            )}
          </div>

          {/* Paid QuickLoans history */}
          {paidQuickLoans.length > 0 && (
            <div className="card" style={{ padding: '20px 22px', borderColor: 'rgba(245,158,11,0.1)' }}>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 15, marginBottom: 14 }}>✅ Paid QuickLoans</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {paidQuickLoans.map(loan => {
                  const b = borrowers.find(x => x.id === loan.borrower_id)
                  const earned = parseFloat(((loan.total_repayment || 0) - (loan.loan_amount || 0)).toFixed(2))
                  return (
                    <div key={loan.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: 8 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{b?.full_name || 'Unknown'}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatCurrency(loan.loan_amount)} principal · Paid</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--green)' }}>+{formatCurrency(earned)}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>interest earned</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
