import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { CREDIT_CONFIG, getBadgeFromScore } from '../lib/creditSystem'
import { logAudit, formatCurrency, formatDate, getInstallmentDates, formatDateValue, calcQuickLoanBalance } from '../lib/helpers'
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
  Trophy, ShieldAlert, ChevronRight, Eye, Plus, Trash2, Edit2, Briefcase, History
} from 'lucide-react'


// ─── Status Pill ──────────────────────────────────────────────
function StatusPill({ status }) {
  let bg = 'rgba(255,255,255,0.05)'
  let color = 'var(--text-muted)'
  let label = status

  switch (status) {
    case 'Active':
      bg = 'rgba(34,197,94,0.15)'
      color = 'var(--green)'
      break
    case 'Partially Paid':
      bg = 'rgba(59,130,246,0.15)'
      color = 'var(--blue)'
      break
    case 'Overdue':
      bg = 'rgba(239,68,68,0.15)'
      color = 'var(--red)'
      break
    case 'Extended':
      bg = 'rgba(245,158,11,0.15)'
      color = 'var(--gold)'
      break
    case 'Paid':
    case 'Paid Off':
      bg = 'rgba(16,185,129,0.1)'
      color = '#10B981'
      label = 'Paid'
      break
  }

  return (
    <span style={{
      display: 'inline-block',
      padding: '4px 8px',
      borderRadius: '6px',
      fontSize: '11px',
      fontWeight: '700',
      background: bg,
      color: color,
      textTransform: 'uppercase',
      letterSpacing: '0.05em'
    }}>
      {label}
    </span>
  )
}

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
function EfficiencyCard({ rate, onTime, total, onToggleBreakdown, isExpanded }) {
  const color = rate >= 90 ? 'var(--green)' : rate >= 70 ? 'var(--gold)' : 'var(--red)'
  const label = rate >= 90 ? 'Excellent' : rate >= 70 ? 'Good' : 'Needs Attention'
  return (
    <div className="card" style={{ padding: '20px 22px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: `${color}20`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Percent size={18} color={color} />
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: 11, color, background: `${color}15`, border: `1px solid ${color}30`, padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>{label}</span>
          <button 
            onClick={onToggleBreakdown}
            style={{ 
              display: 'block', background: 'none', border: 'none', color: 'var(--blue)', fontSize: 11, 
              marginTop: 6, cursor: 'pointer', fontWeight: 600, padding: 0 
            }}
          >
            {isExpanded ? '← Hide Breakdown' : 'View Breakdown →'}
          </button>
        </div>
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

function CollectionEfficiencyBreakdown({ borrowers, loans, penaltyCharges, resetDate }) {
  const today = new Date(); today.setHours(0,0,0,0)
  
  const stats = borrowers.map(b => {
    const bLoans = loans.filter(l => l.borrower_id === b.id && l.loan_type !== 'quickloan' && (!resetDate || new Date(l.created_at) >= resetDate))
    if (bLoans.length === 0) return null

    let totalDue = 0
    let paidOnTime = 0
    let paidLate = 0
    let missed = 0

    bLoans.forEach(l => {
      totalDue += (l.num_installments || 4)
      const lPenalties = penaltyCharges.filter(pc => pc.loan_id === l.id)
      
      // Check each installment
      for (let i = 1; i <= (l.num_installments || 4); i++) {
        const isPaid = i <= l.payments_made
        if (isPaid) {
          const wasLate = lPenalties.some(pc => pc.installment_number === i)
          if (wasLate) paidLate++
          else paidOnTime++
        } else {
          // Check if missed (past due date)
          const dates = getInstallmentDates(l.release_date, l.num_installments || 4)
          const dueDate = dates[i - 1]
          if (dueDate && dueDate < today) {
            missed++
          }
        }
      }
    })

    const eff = totalDue > 0 ? (paidOnTime / (paidOnTime + paidLate + missed || 1)) * 100 : 100

    return {
      name: b.full_name,
      totalDue,
      paidOnTime,
      paidLate,
      missed,
      efficiency: eff
    }
  }).filter(Boolean).sort((a,b) => a.efficiency - b.efficiency)

  const totals = stats.reduce((acc, s) => ({
    totalDue: acc.totalDue + s.totalDue,
    paidOnTime: acc.paidOnTime + s.paidOnTime,
    paidLate: acc.paidLate + s.paidLate,
    missed: acc.missed + s.missed
  }), { totalDue: 0, paidOnTime: 0, paidLate: 0, missed: 0 })

  const totalEff = totals.totalDue > 0 ? (totals.paidOnTime / (totals.paidOnTime + totals.paidLate + totals.missed || 1)) * 100 : 100

  return (
    <div className="card" style={{ padding: '0', overflow: 'hidden', marginTop: 16, animation: 'fadeIn 0.3s ease' }}>
      <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--card-border)', background: 'rgba(255,255,255,0.02)' }}>
        <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 16, fontWeight: 700 }}>📊 Collection Efficiency Breakdown</h3>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--card-border)', background: 'rgba(255,255,255,0.01)' }}>
              <th style={{ padding: '12px 22px', color: 'var(--text-muted)', fontWeight: 600 }}>Borrower Name</th>
              <th style={{ padding: '12px 14px', color: 'var(--text-muted)', fontWeight: 600 }}>Total Installments</th>
              <th style={{ padding: '12px 14px', color: 'var(--text-muted)', fontWeight: 600 }}>Paid On Time</th>
              <th style={{ padding: '12px 14px', color: 'var(--text-muted)', fontWeight: 600 }}>Paid Late</th>
              <th style={{ padding: '12px 14px', color: 'var(--text-muted)', fontWeight: 600 }}>Missed</th>
              <th style={{ padding: '12px 22px', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'right' }}>Efficiency %</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--card-border)' }}>
                <td style={{ padding: '12px 22px', fontWeight: 600 }}>{s.name}</td>
                <td style={{ padding: '12px 14px' }}>{s.totalDue}</td>
                <td style={{ padding: '12px 14px', color: 'var(--green)' }}>{s.paidOnTime}</td>
                <td style={{ padding: '12px 14px', color: 'var(--gold)' }}>{s.paidLate}</td>
                <td style={{ padding: '12px 14px', color: 'var(--red)' }}>{s.missed}</td>
                <td style={{ padding: '12px 22px', textAlign: 'right', fontFamily: 'Space Grotesk', fontWeight: 700, color: s.efficiency >= 90 ? 'var(--green)' : s.efficiency >= 70 ? 'var(--gold)' : 'var(--red)' }}>
                  {s.efficiency.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: 'rgba(59,130,246,0.05)', fontWeight: 700 }}>
              <td style={{ padding: '14px 22px' }}>Total Portfolio</td>
              <td style={{ padding: '14px 14px' }}>{totals.totalDue}</td>
              <td style={{ padding: '14px 14px', color: 'var(--green)' }}>{totals.paidOnTime}</td>
              <td style={{ padding: '14px 14px', color: 'var(--gold)' }}>{totals.paidLate}</td>
              <td style={{ padding: '14px 14px', color: 'var(--red)' }}>{totals.missed}</td>
              <td style={{ padding: '14px 22px', textAlign: 'right', fontSize: 16, color: 'var(--blue)', fontFamily: 'Space Grotesk' }}>
                {totalEff.toFixed(1)}%
              </td>
            </tr>
          </tfoot>
        </table>
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

  const todayStr = formatDateValue(today)
  const due = loans.filter(l => {
    if (!['Active', 'Partially Paid'].includes(l.status)) return false
    if (l.loan_type === 'quickloan') return false
    
    const dates = getInstallmentDates(l.release_date, l.num_installments || 4)
    const nextIdx = l.payments_made || 0
    if (nextIdx >= dates.length) return false
    
    return formatDateValue(dates[nextIdx]) === todayStr
  })

  if (due.length === 0) return null

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
  const nextCutoffStr = formatDateValue(nextCutoff)
  const dueLoansList = loans.filter(l => {
    if (!['Active', 'Partially Paid'].includes(l.status)) return false
    if (l.loan_type === 'quickloan') return false
    
    const dates = getInstallmentDates(l.release_date, l.num_installments || 4)
    const nextIdx = l.payments_made || 0
    if (nextIdx >= dates.length) return false
    
    return formatDateValue(dates[nextIdx]) === nextCutoffStr
  })
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
      background: 'var(--card)',
      border: '1px solid var(--card-border)',
      borderRadius: 10,
      padding: '10px 14px',
      fontSize: 13,
      fontFamily: 'DM Sans, sans-serif',
      boxShadow: 'var(--card-shadow)'
    }}>
      <div style={{ color: 'var(--text-label)', marginBottom: 6, fontSize: 12 }}>{label}</div>
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
  const [loading, setLoading] = useState(true)
  const [auditLogs, setAuditLogs] = useState([])
  const [capitalEntries, setCapitalEntries] = useState([])
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const [showEfficiencyBreakdown, setShowEfficiencyBreakdown] = useState(false)
  const [penaltyCharges, setPenaltyCharges] = useState([])
  const [visitStats, setVisitStats] = useState({ total: 0, today: 0, pages: {} })
  const [dashTab, setDashTab] = useState('installment')

  const [investors, setInvestors] = useState([])
  const navigate = useNavigate()

  const fetchData = useCallback(async () => {
    try {
      const [{ data: l }, { data: b }, { data: s }, { data: a }, { data: apps }, { data: visits }, { data: inv }, { data: cf }, { data: pc }] = await Promise.all([
        supabase.from('loans').select('*').order('created_at', { ascending: false }),
        supabase.from('borrowers').select('*'),
        supabase.from('settings').select('*').eq('id', 1).single(),
        supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(10),
        supabase.from('applications').select('id').eq('status', 'Pending'),
        supabase.from('page_visits').select('page, visited_at'),
        supabase.from('investors').select('id,full_name,tier,total_capital,access_code'),
        supabase.from('capital_flow').select('*'),
        supabase.from('penalty_charges').select('*')
      ])
      setLoans(l || [])
      setBorrowers(b || [])
      setPendingApps((apps || []).length)
      setSettings(s)
      setAuditLogs(a || [])

      setInvestors(inv || [])
      setCapitalEntries(cf || [])
      setPenaltyCharges(pc || [])

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

  // FE-08 FIX: Debounce realtime-triggered refetches to prevent flooding
  // During heavy collection sessions, multiple tables fire events rapidly.
  // Without debounce, each event triggers a full 11-table refetch.
  const debounceRef = useRef(null)
  const debouncedFetchData = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchData(), 800)
  }, [fetchData])

  // Real-time refresh
  useEffect(() => {
    const subL = supabase
      .channel('loans-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loans' }, () => debouncedFetchData())
      .subscribe()
    const subO = supabase
      .channel('others-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'other_products' }, () => debouncedFetchData())
      .subscribe()
    const subPL = supabase
      .channel('product-logs-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'product_logs' }, () => debouncedFetchData())
      .subscribe()
    return () => {
      supabase.removeChannel(subL)
      supabase.removeChannel(subO)
      supabase.removeChannel(subPL)
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [debouncedFetchData])

  useEffect(() => {
    const subCF = supabase
      .channel('capital-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'capital_flow' }, () => debouncedFetchData())
      .subscribe()
    return () => supabase.removeChannel(subCF)
  }, [debouncedFetchData])

  // ── Pool calculation: matches CapitalPage availableCash exactly ──
  // Simple net of ALL capital_flow entries (CASH IN − CASH OUT).
  // No category filtering — this is the real cash position.
  const isQuickLoanEntry = (entry) => {
    const cat = entry.category || ''
    if (cat === 'Initial Pool (QuickLoan)' || cat === 'Interest Profit (QuickLoan)' || cat === 'Loan Disbursed QL') return true
    if (cat === 'Loan Principal Return' && (entry.notes || '').includes('QuickLoan')) return true
    return false
  }

  const totalPool = capitalEntries.reduce((sum, e) => {
    const amt = parseFloat(e.amount) || 0
    return e.type === 'CASH IN' ? sum + amt : sum - amt
  }, 0)

  // QuickLoan's share of cash = QL profit sitting in the pool
  // (QL initial capital is deployed in active loans, not in the cash pool)
  const qlPoolValue = capitalEntries
    .filter(e => e.type === 'CASH IN' && e.category === 'Interest Profit (QuickLoan)')
    .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0)

  // Installment gets everything else
  const availableLiquidity = totalPool

  // ── Computed stats (Installment) ──────────
  const ledgerCapital = capitalEntries
    .filter(c => c.type === 'CASH IN' && (
      c.category === 'Initial Pool (Installment)' ||
      c.category === 'Capital Top-up (JP)' ||
      c.category === 'Capital Top-up (Charlou)'
    ) && !c.category.includes('QuickLoan'))
    .reduce((sum, c) => sum + (c.amount || 0), 0)

  const activeLoans = loans.filter(l => ['Active', 'Partially Paid', 'Overdue'].includes(l.status) && l.loan_type !== 'quickloan')
  const amountLentOut = activeLoans.reduce((sum, l) => sum + (l.loan_amount || 0), 0)
  const paidLoans = loans.filter(l => l.status === 'Paid' && l.loan_type !== 'quickloan')

  // DYNAMIC PROFIT: Sum of Interest Profit entries in the Ledger (NET of rebates)
  const grossProfit = capitalEntries
    .filter(cf => cf.type === 'CASH IN' && cf.category === 'Interest Profit (Installment)')
    .reduce((sum, cf) => sum + (cf.amount || 0), 0)

  const totalRebates = capitalEntries
    .filter(cf => cf.type === 'CASH OUT' && (cf.category || '').toLowerCase().includes('rebate'))
    .reduce((sum, cf) => sum + (parseFloat(cf.amount) || 0), 0)

  const totalProfit = grossProfit - totalRebates
  const roi = ledgerCapital > 0 ? (totalProfit / ledgerCapital) * 100 : 0

  // Profit this month — from capital_flow ledger (Installment interest this month, net of rebates)
  const now = new Date()
  const grossProfitThisMonth = capitalEntries
    .filter(e => {
      if (e.type !== 'CASH IN' || e.category !== 'Interest Profit (Installment)') return false
      const d = new Date(e.entry_date)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0)

  const rebatesThisMonth = capitalEntries
    .filter(e => {
      if (e.type !== 'CASH OUT' || !(e.category || '').toLowerCase().includes('rebate')) return false
      const d = new Date(e.entry_date)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0)

  const profitThisMonth = grossProfitThisMonth - rebatesThisMonth

  // ── QuickLoan stats ──────────────────────
  const activeQuickLoans = loans.filter(l => l.loan_type === 'quickloan' && ['Active', 'Partially Paid', 'Overdue'].includes(l.status))
  const paidQuickLoans = loans.filter(l => l.loan_type === 'quickloan' && l.status === 'Paid')

  const qlTotalPrincipalOut = activeQuickLoans.reduce((sum, l) => sum + (l.loan_amount || 0), 0)

  // DYNAMIC QL PROFIT: Read from Ledger
  const qlLedgerProfit = capitalEntries
    .filter(cf => cf.type === 'CASH IN' && cf.category === 'Interest Profit (QuickLoan)')
    .reduce((sum, cf) => sum + (cf.amount || 0), 0)

  const qlTotalInterestEarned = qlLedgerProfit

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

  const defaultedLoans = loans.filter(l => l.status === 'Defaulted' && l.loan_type !== 'quickloan')
  const defaultRate = loans.length > 0 ? (defaultedLoans.length / loans.length) * 100 : 0

  // Projected yearly — use avg loan term from installment portfolio
  const instLoans = loans.filter(l => l.loan_type !== 'quickloan')
  const avgTerm = instLoans.length > 0
    ? instLoans.reduce((sum, l) => sum + (l.loan_term || 2), 0) / instLoans.length
    : 2
  const cyclesPerYear = 12 / avgTerm
  const projectedYearly = Math.max(0, availableLiquidity) * (settings?.interest_rate || 0.07) * avgTerm * cyclesPerYear



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
    capital: ledgerCapital + monthlyData.slice(0, i + 1).reduce((sum, x) => sum + x.profit, 0)
  }))

  // ── QuickLoan dashboard stats (isolated from Installment pool) ──────────
  const qlResetDate = settings?.ql_last_reset_date ? new Date(settings.ql_last_reset_date) : null
  
  // Dynamic QL Capital
  const qlLedgerCapital = capitalEntries
    .filter(c => c.type === 'CASH IN' && c.category === 'Initial Pool (QuickLoan)')
    .reduce((sum, c) => sum + (c.amount || 0), 0)

  // QL liquidity = net of QL-only capital_flow entries
  const qlAvailableLiquidity = qlPoolValue

  const qlAmountLentOut = activeQuickLoans.reduce((sum, l) => sum + (l.loan_amount || 0), 0)

  // QL Profit this month — from capital_flow ledger
  const qlProfitThisMonth = capitalEntries
    .filter(e => {
      if (e.type !== 'CASH IN' || e.category !== 'Interest Profit (QuickLoan)') return false
      const d = new Date(e.entry_date)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0)

  // QuickLoan ROI — based on capital from ledger
  const qlRoi = qlLedgerCapital > 0 ? (qlTotalInterestEarned / qlLedgerCapital) * 100 : 0
  // Projected: 10%/month on available QL capital
  const qlProjectedYearly = Math.max(0, qlAvailableLiquidity) * 0.10 * 12

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
    { name: 'Pending', value: loans.filter(l => l.status === 'Pending' && l.loan_type !== 'quickloan').length, color: 'var(--gray)' },
    { name: 'Overdue', value: loans.filter(l => l.status === 'Overdue' && l.loan_type !== 'quickloan').length, color: 'var(--gold)' },
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
            {dashTab === 'installment' ? 'Dashboard' : dashTab === 'quickloan' ? '⚡ QuickLoan Dashboard' : '💼 Business Overview'}
          </h1>
          <p className="page-subtitle">
            {new Date().toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        {/* Tab toggle */}
        <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 4 }}>
          {[
            { key: 'installment', label: '📅 Installment' },
            { key: 'quickloan',   label: '⚡ QuickLoan' }
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* New Slim Info Bar */}
          {(() => {
            const today = new Date()
            const day = today.getDate()
            const isCutoffDay = day === 5 || day === 20
            let nextCutoff
            if (day < 5) nextCutoff = new Date(today.getFullYear(), today.getMonth(), 5)
            else if (day < 20) nextCutoff = new Date(today.getFullYear(), today.getMonth(), 20)
            else nextCutoff = new Date(today.getFullYear(), today.getMonth() + 1, 5)
            const daysLeft = Math.ceil((nextCutoff - today) / (1000 * 60 * 60 * 24))
            const nextCutoffStr = nextCutoff.toISOString().slice(0, 10)
            const dueLoans = loans.filter(l => {
              if (!['Active', 'Partially Paid'].includes(l.status) || l.loan_type === 'quickloan') return false
              const dates = getInstallmentDates(l.release_date, l.num_installments || 4)
              const nextIdx = l.payments_made || 0
              return dates[nextIdx] === nextCutoffStr
            })
            return (
              <div style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', padding: '12px 20px', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Calendar size={16} color="var(--blue)" />
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--blue)' }}>
                    {isCutoffDay ? 'Today is Cutoff Day!' : `Next Cutoff in ${daysLeft} days`}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  {dueLoans.length} borrowers due
                </div>
              </div>
            )
          })()}

          {/* Operations Stat Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <StatCard label="Amount Lent Out" value={formatCurrency(amountLentOut)} sub={`${activeLoans.length} active loans`} icon={CreditCard} color="var(--purple)" />
            <StatCard label="Available Cash" value={formatCurrency(Math.max(0, availableLiquidity))} sub="Ready to lend" icon={Banknote} color="var(--green)" />
            <StatCard label="Default Rate" value={`${defaultRate.toFixed(1)}%`} sub={`${defaultedLoans.length} defaulted`} icon={AlertTriangle} color={defaultRate > 10 ? 'var(--red)' : 'var(--gold)'} />
          </div>

          {/* Overdue Escalation Alerts */}
          {loans.filter(l => l.status === 'Overdue' && l.loan_type !== 'quickloan').map(loan => {
            const b = borrowers.find(x => x.id === loan.borrower_id)
            return (
              <div key={loan.id} style={{
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
                borderLeft: '4px solid var(--red)', borderRadius: 12, padding: '16px 20px',
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

          {/* Two-Column Layout */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24, alignItems: 'start' }}>
            {/* Left: Active Loans */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--card-border)', fontWeight: 700 }}>Active Installments</div>
              <div style={{ maxHeight: 500, overflowY: 'auto' }}>
                {activeLoans.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No active installments.</div>
                ) : activeLoans.map(loan => {
                  const b = borrowers.find(x => x.id === loan.borrower_id)
                  return (
                    <div key={loan.id} style={{ padding: '16px 20px', borderBottom: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{b?.full_name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loan: {formatCurrency(loan.loan_amount)}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-label)' }}>Bal: {formatCurrency(loan.remaining_balance)}</div>
                        <StatusPill status={loan.status} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Right: Collection Efficiency & Earnings */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div style={{ background: 'var(--card-bg)', borderRadius: 16, border: '1px solid var(--card-border)' }}>
                <EfficiencyCard 
                  rate={efficiencyRate} 
                  onTime={totalInstallmentsDue} 
                  total={totalExpectedInstallments || 1} 
                  onToggleBreakdown={() => setShowEfficiencyBreakdown(!showEfficiencyBreakdown)}
                  isExpanded={showEfficiencyBreakdown}
                />
                {showEfficiencyBreakdown && (
                  <CollectionEfficiencyBreakdown 
                    borrowers={borrowers} 
                    loans={loans} 
                    penaltyCharges={penaltyCharges} 
                    resetDate={resetDate}
                  />
                )}
                
                <div style={{ padding: '20px', borderTop: '1px solid var(--card-border)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 16, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Earnings Summary</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ color: 'var(--text-label)', fontSize: 13 }}>Net Profit</span>
                    <span style={{ fontWeight: 700, color: 'var(--green)' }}>{formatCurrency(totalProfit)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ color: 'var(--text-label)', fontSize: 13 }}>This Month</span>
                    <span style={{ fontWeight: 700, color: 'var(--teal)' }}>{formatCurrency(profitThisMonth)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-label)', fontSize: 13 }}>ROI</span>
                    <span style={{ fontWeight: 700, color: 'var(--purple)' }}>{roi.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Cutoff Profit Breakdown ── */}
      <div className="card" style={{ 
        padding: 0, overflow: 'hidden', marginBottom: 28, 
        border: '1px solid rgba(34,197,94,0.15)',
        background: 'linear-gradient(180deg, rgba(34,197,94,0.03) 0%, rgba(0,0,0,0) 100%)'
      }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(34,197,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Calendar size={16} color="var(--green)" />
          </div>
          <div>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 16 }}>Cutoff Profit Breakdown</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Interest collected per cutoff date</div>
          </div>
        </div>
        {(() => {
          const cutoffMap = {}
          capitalEntries
            .filter(cf => cf.type === 'CASH IN' && cf.category === 'Interest Profit (Installment)')
            .forEach(cf => {
              const key = cf.entry_date
              if (!cutoffMap[key]) cutoffMap[key] = { date: key, entries: [], total: 0 }
              cutoffMap[key].entries.push(cf)
              cutoffMap[key].total += parseFloat(cf.amount) || 0
            })
            
          // Subtract rebates that happen on the same date
          capitalEntries
            .filter(cf => cf.type === 'CASH OUT' && (cf.category || '').toLowerCase().includes('rebate'))
            .forEach(cf => {
              const key = cf.entry_date
              if (cutoffMap[key]) {
                cutoffMap[key].total -= parseFloat(cf.amount) || 0
              }
            })

          const cutoffs = Object.values(cutoffMap).sort((a, b) => a.date.localeCompare(b.date))
          
          return cutoffs.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
              <Calendar size={24} style={{ opacity: 0.2, marginBottom: 12 }} />
              <div>No profit entries yet</div>
            </div>
          ) : (
            <div>
              {cutoffs.map((c, idx) => {
                const d = new Date(c.date + 'T00:00:00')
                const label = d.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })
                return (
                  <div key={c.date} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '16px 24px',
                    borderBottom: idx < cutoffs.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none',
                    background: 'transparent', transition: 'background 0.2s ease', cursor: 'default'
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{label}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.entries.length} payment{c.entries.length !== 1 ? 's' : ''} collected</div>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 16, color: 'var(--green)', minWidth: 80, textAlign: 'right' }}>
                        +{formatCurrency(c.total)}
                      </div>
                      <div style={{ width: 80, height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(100, (c.total / (totalProfit || 1)) * 100)}%`, background: 'var(--green)', borderRadius: 3, boxShadow: '0 0 10px rgba(34,197,94,0.5)' }} />
                      </div>
                    </div>
                  </div>
                )
              })}
              <div style={{ 
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                padding: '18px 24px', background: 'rgba(34,197,94,0.08)', 
                borderTop: '1px solid rgba(34,197,94,0.2)' 
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total (Net of Rebates)</div>
                <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 18, color: 'var(--green)' }}>{formatCurrency(totalProfit)}</div>
              </div>
            </div>
          )
        })()}
      </div>

      {/* Charts Row */}
      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 12 }}>📈 Performance Charts</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 }}>
        {/* Capital Growth Line Chart */}
        <div className="card" style={{ padding: '22px 24px' }}>
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 15, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrendingUp size={16} color="var(--teal)" /> Capital Growth
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={capitalGrowthData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
              <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `₱${(v/1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="capital" stroke="var(--teal)" strokeWidth={2.5} dot={{ fill: 'var(--teal)', r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Monthly Profit Bar Chart */}
        <div className="card" style={{ padding: '22px 24px' }}>
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 15, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Banknote size={16} color="var(--green)" /> Monthly Profit
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
              <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `₱${v}`} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="profit" fill="var(--green)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Donut Chart + Top Borrowers */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 20, marginBottom: 28 }}>
        {/* Loan Status Donut */}
        <div className="card" style={{ padding: '22px 24px' }}>
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
                      background: 'var(--card)',
                      border: '1px solid var(--card-border)',
                      borderRadius: 10,
                      fontSize: 13,
                      fontFamily: 'DM Sans, sans-serif',
                      padding: '8px 14px',
                      boxShadow: 'var(--card-shadow)'
                    }}
                    itemStyle={{ color: 'var(--text-primary)', fontWeight: 600 }}
                    labelStyle={{ color: 'var(--text-label)', fontSize: 12 }}
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* QuickLoan StatCards (4 only) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            <StatCard label="Amount Lent Out" value={formatCurrency(qlAmountLentOut)} sub={`${activeQuickLoans.length} active loans`} icon={CreditCard} color="var(--purple)" />
            <StatCard label="Total Profit" value={formatCurrency(qlTotalInterestEarned)} sub="All-time interest earned" icon={TrendingUp} color="var(--green)" />
            <StatCard label="Profit This Month" value={formatCurrency(qlProfitThisMonth)} sub="30-day earnings" icon={Calendar} color="var(--teal)" />
            <StatCard label="ROI" value={`${qlRoi.toFixed(1)}%`} sub="Return on capital" icon={TrendingUp} color="var(--gold)" />
          </div>

          {/* Active QuickLoans List */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--card-border)', fontWeight: 700 }}>Active QuickLoans</div>
            {activeQuickLoans.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No active QuickLoans.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: 'rgba(255,255,255,0.02)', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '12px 20px' }}>Borrower</th>
                    <th style={{ textAlign: 'left', padding: '12px 10px' }}>Release Date</th>
                    <th style={{ textAlign: 'center', padding: '12px 10px' }}>Day Count</th>
                    <th style={{ textAlign: 'right', padding: '12px 20px' }}>Total Owed</th>
                    <th style={{ textAlign: 'right', padding: '12px 20px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {activeQuickLoans.map(loan => {
                    const b = borrowers.find(x => x.id === loan.borrower_id)
                    const details = calcQuickLoanBalance(loan)
                    const days = Math.floor((new Date() - new Date(loan.release_date)) / (1000 * 60 * 60 * 24))
                    return (
                      <tr key={loan.id} style={{ borderBottom: '1px solid var(--card-border)' }}>
                        <td style={{ padding: '14px 20px', fontWeight: 600 }}>{b?.full_name || 'Unknown'}</td>
                        <td style={{ padding: '14px 10px', fontSize: 13 }}>{new Date(loan.release_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                        <td style={{ padding: '14px 10px', textAlign: 'center', fontSize: 13 }}>Day {days}</td>
                        <td style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 700, color: 'var(--text-label)' }}>{formatCurrency(details.balance)}</td>
                        <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                          <StatusPill status={loan.status === 'Active' && loan.extension_fee_charged ? 'Extended' : loan.status} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Profit Trail */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <TrendingUp size={16} color="#F59E0B" />
              </div>
              <div>
                <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 16 }}>Profit Trail</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Unified view of extension profit and full payoffs</div>
              </div>
            </div>
            
            {(() => {
              // 1. Extension Payments (from capital_flow notes)
              const extensionEvents = capitalEntries.filter(c => c.category === 'Interest Profit (QuickLoan)' && c.type === 'CASH IN' && c.notes && c.notes.toLowerCase().includes('extension'))
                .map(c => {
                  let borrowerName = 'Unknown'
                  const match = c.notes.match(/from (.*?) payment/i)
                  if (match) borrowerName = match[1]
                  else if (c.notes.includes('-')) borrowerName = c.notes.split('-')[1].trim()
                  
                  return {
                    id: `ext-${c.id}`,
                    date: new Date(c.created_at),
                    borrowerName,
                    earned: c.amount,
                    statusLabel: 'Extended',
                    subLabel: `Day extension event`,
                    profitLabel: 'extension profit',
                    isExt: true
                  }
                })
              
              // 2. Paid QuickLoans
              const payoffEvents = paidQuickLoans.map(loan => {
                const b = borrowers.find(x => x.id === loan.borrower_id)
                const earned = parseFloat(((loan.total_repayment || 0) - (loan.loan_amount || 0)).toFixed(2))
                return {
                  id: `paid-${loan.id}`,
                  date: new Date(loan.updated_at || loan.created_at),
                  borrowerName: b?.full_name || 'Unknown',
                  earned,
                  statusLabel: 'Paid',
                  subLabel: `${formatCurrency(loan.loan_amount)} principal · Paid`,
                  profitLabel: loan.extension_fee_charged ? '10-day profit + ext' : 'full payoff',
                  isExt: false
                }
              })
              
              extensionEvents.sort((a,b) => b.date - a.date)
              payoffEvents.sort((a,b) => b.date - a.date)

              const renderEvent = (evt, color) => (
                <div key={evt.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <CheckCircle size={18} color={color} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                        {evt.borrowerName}
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: color === 'var(--gold)' ? 'rgba(245,158,11,0.1)' : 'rgba(34,197,94,0.1)', color }}>
                          {evt.statusLabel}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                        {evt.date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })} · {evt.subLabel}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--green)' }}>+{formatCurrency(evt.earned)}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{evt.profitLabel}</div>
                  </div>
                </div>
              )

              return (
                <div>
                  <div style={{ padding: '12px 24px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--card-border)', fontSize: 12, fontWeight: 600, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Extension Payments
                  </div>
                  {extensionEvents.length === 0 ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No extension payments recorded.</div>
                  ) : extensionEvents.map(evt => renderEvent(evt, 'var(--gold)'))}
                  
                  <div style={{ padding: '12px 24px', background: 'rgba(255,255,255,0.02)', borderTop: '1px solid var(--card-border)', borderBottom: '1px solid var(--card-border)', fontSize: 12, fontWeight: 600, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Paid Off
                  </div>
                  {payoffEvents.length === 0 ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No paid off loans recorded.</div>
                  ) : payoffEvents.map(evt => renderEvent(evt, 'var(--green)'))}
                </div>
              )
            })()}
          </div>
        </div>
      )}

    </div>
  )
}