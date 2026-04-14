import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { formatCurrency } from '../lib/helpers'
import { differenceInDays, format, parseISO } from 'date-fns'
import { Shield, AlertTriangle, CheckCircle, Clock, TrendingDown, ArrowRight } from 'lucide-react'

// ── Status config ─────────────────────────────────────────────────
const STATUS_CFG = {
  Active:          { color: 'var(--blue)',   bg: 'rgba(59,130,246,0.12)',  label: 'Active'        },
  Overdue:         { color: 'var(--red)',    bg: 'rgba(239,68,68,0.12)',   label: 'Overdue'       },
  'Partially Paid':{ color: '#F59E0B',      bg: 'rgba(245,158,11,0.12)',  label: 'Partially Paid'},
  Paid:            { color: 'var(--green)',  bg: 'rgba(34,197,94,0.12)',   label: 'Paid'          },
}
const ACTIVE_STATUSES = ['Active', 'Overdue', 'Partially Paid']

// ── Helpers ───────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || { color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.06)', label: status }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
      color: cfg.color, background: cfg.bg, whiteSpace: 'nowrap'
    }}>
      {cfg.label}
    </span>
  )
}

function KpiCard({ label, value, color = 'var(--text-primary)', sub, icon: Icon, iconColor }) {
  return (
    <div className="card" style={{ padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
        {Icon && <Icon size={16} color={iconColor || 'var(--text-muted)'} />}
      </div>
      <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 800, fontSize: 24, color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

// Skeleton loader for KPI strip
function SkeletonCard() {
  return (
    <div className="card" style={{ padding: '18px 20px' }}>
      <div style={{ height: 11, background: 'rgba(255,255,255,0.06)', borderRadius: 4, width: '60%', marginBottom: 12 }} />
      <div style={{ height: 24, background: 'rgba(255,255,255,0.09)', borderRadius: 6, width: '80%', marginBottom: 8 }} />
      <div style={{ height: 11, background: 'rgba(255,255,255,0.04)', borderRadius: 4, width: '50%' }} />
    </div>
  )
}

// Hold depletion progress bar
function DepletionBar({ original, deducted }) {
  if (!original || original <= 0) return null
  const pct = Math.min((deducted / original) * 100, 100)
  const remaining = original - deducted
  const remainPct = 100 - pct

  let barColor = 'var(--green)'
  if (remainPct < 25) barColor = 'var(--red)'
  else if (remainPct < 50) barColor = '#F59E0B'

  return (
    <div style={{ marginTop: 6 }}>
      <div style={{
        height: 6, background: 'rgba(255,255,255,0.07)', borderRadius: 3, overflow: 'hidden', position: 'relative'
      }}>
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: `${pct}%`,
          background: 'var(--red)',
          borderRadius: 3,
          transition: 'width 0.4s ease'
        }} />
        <div style={{
          position: 'absolute', right: 0, top: 0, bottom: 0,
          width: `${remainPct}%`,
          background: barColor,
          borderRadius: 3,
          transition: 'width 0.4s ease'
        }} />
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>
        <span style={{ color: barColor, fontWeight: 600 }}>{formatCurrency(remaining)}</span>
        {' '}remaining of {formatCurrency(original)}
      </div>
    </div>
  )
}

const COL = '1.4fr 0.9fr 0.9fr 0.9fr 1.1fr 0.85fr 0.75fr'
const HEADER_COLS = ['Borrower', 'Loan Amount', 'Hold Collected', 'Penalties Deducted', 'Remaining Hold', 'Status', 'Days Out']

export default function HoldLedgerPage() {
  const [loans,        setLoans]        = useState([])
  const [penalties,    setPenalties]    = useState([]) // all penalty_charges rows
  const [realizedFlow, setRealizedFlow] = useState([]) // capital_flow with penalty settlement category
  const [borrowerMap,  setBorrowerMap]  = useState({}) // { [borrower_id]: full_name }
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)

  useEffect(() => {
    setLoading(true)
    setError(null)

    Promise.all([
      // Regular loans only — quickloans never have a security hold
      supabase
        .from('loans')
        .select('id, borrower_id, loan_amount, security_hold, status, release_date, due_date')
        .in('status', [...ACTIVE_STATUSES, 'Paid'])
        .eq('loan_type', 'regular'),

      // All penalty_charges (for per-loan deduction sums)
      supabase
        .from('penalty_charges')
        .select('id, loan_id, penalty_amount, created_at'),

      // Realized PnL entries from capital_flow
      supabase
        .from('capital_flow')
        .select('id, entry_date, category, type, amount')
        .eq('category', 'Penalty (Collected at Settlement)')
        .order('entry_date', { ascending: false }),

      // Borrower names
      supabase
        .from('borrowers')
        .select('id, full_name'),
    ]).then(([loansRes, penaltiesRes, flowRes, borrowersRes]) => {
      // Check for errors
      const errs = [loansRes, penaltiesRes, flowRes, borrowersRes].filter(r => r.error)
      if (errs.length > 0) {
        setError(errs[0].error.message || 'Failed to load hold ledger data.')
        setLoading(false)
        return
      }

      setLoans(loansRes.data         || [])
      setPenalties(penaltiesRes.data || [])
      setRealizedFlow(flowRes.data   || [])

      // Build borrower lookup map
      const map = {}
      for (const b of (borrowersRes.data || [])) map[b.id] = b.full_name
      setBorrowerMap(map)
      setLoading(false)
    }).catch(err => {
      setError(err.message || 'Unexpected error loading hold ledger.')
      setLoading(false)
    })
  }, [])

  // ── Derived data ────────────────────────────────────────────────

  // Per-loan penalty deduction sums
  const penaltyByLoan = useMemo(() => {
    const map = {}
    for (const p of penalties) {
      const amt = parseFloat(p.penalty_amount) || 0
      map[p.loan_id] = (map[p.loan_id] || 0) + amt
    }
    return map
  }, [penalties])

  // Split active vs paid loans
  const activeLoans = useMemo(() => loans.filter(l => ACTIVE_STATUSES.includes(l.status)), [loans])
  const paidLoans   = useMemo(() => loans.filter(l => l.status === 'Paid'), [loans])

  // KPI computations
  const kpi = useMemo(() => {
    const totalHoldLiability = activeLoans.reduce((s, l) => s + (parseFloat(l.security_hold) || 0), 0)
    const atRisk             = activeLoans.filter(l => l.status === 'Overdue')
                                          .reduce((s, l) => s + (parseFloat(l.security_hold) || 0), 0)
    const safe               = totalHoldLiability - atRisk
    const totalPenaltiesDeducted = penalties.reduce((s, p) => s + (parseFloat(p.penalty_amount) || 0), 0)
    const totalRealized      = realizedFlow.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
    const pending            = Math.max(totalPenaltiesDeducted - totalRealized, 0)
    return { totalHoldLiability, atRisk, safe, totalPenaltiesDeducted, totalRealized, pending }
  }, [activeLoans, penalties, realizedFlow])

  // Enrich active loans with computed fields
  const enrichedLoans = useMemo(() => {
    return activeLoans.map(l => {
      const loanAmt      = parseFloat(l.loan_amount)   || 0
      const secHold      = parseFloat(l.security_hold) || 0
      const holdOriginal = loanAmt * 0.10
      const deducted     = parseFloat(penaltyByLoan[l.id]) || 0
      const daysOut      = l.release_date
        ? differenceInDays(new Date(), parseISO(l.release_date))
        : null
      return { ...l, holdOriginal, deducted, secHold, daysOut, loanAmt, borrowerName: borrowerMap[l.borrower_id] || '—' }
    }).sort((a, b) => {
      // Sort: Overdue first, then Partially Paid, then Active
      const ORDER = { Overdue: 0, 'Partially Paid': 1, Active: 2 }
      return (ORDER[a.status] ?? 3) - (ORDER[b.status] ?? 3)
    })
  }, [activeLoans, penaltyByLoan, borrowerMap])

  // Realized PnL total
  const totalRealized = kpi.totalRealized

  // ── Render ───────────────────────────────────────────────────────
  return (
    <div style={{ padding: '32px 28px', maxWidth: 1200, margin: '0 auto' }}>

      {/* ── Page Header ─────────────────────────────────── */}
      <div className="page-header" style={{ marginBottom: 28 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, background: 'rgba(239,68,68,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Shield size={18} color="var(--red)" />
            </div>
            <h1 className="page-title" style={{ margin: 0 }}>Security Hold Ledger</h1>
          </div>
          <p className="page-subtitle" style={{ margin: 0 }}>
            Liability tracker — hold deposits are separate from the capital pool and are not Moneyfest income until realized at settlement.
          </p>
        </div>
        <div style={{
          padding: '8px 16px', borderRadius: 10,
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
          fontSize: 11, color: 'var(--red)', fontWeight: 700, letterSpacing: '0.06em',
          textTransform: 'uppercase', alignSelf: 'flex-start'
        }}>
          ⚠ Liability Bucket — Not Capital Pool
        </div>
      </div>

      {/* ── Error State ───────────────────────────────────── */}
      {error && (
        <div style={{
          padding: '16px 20px', borderRadius: 12, marginBottom: 24,
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
          color: 'var(--red)', fontSize: 13
        }}>
          <strong>Error loading data:</strong> {error}
        </div>
      )}

      {/* ── SECTION 1: KPI Strip ─────────────────────────── */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px,1fr))', gap: 14, marginBottom: 28 }}>
          {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px,1fr))', gap: 14, marginBottom: 28 }}>
          <KpiCard
            label="Total Hold Liability"
            value={formatCurrency(kpi.totalHoldLiability)}
            color="var(--text-primary)"
            sub="All active loan holds combined"
            icon={Shield}
            iconColor="var(--blue)"
          />
          <KpiCard
            label="At Risk (Overdue)"
            value={formatCurrency(kpi.atRisk)}
            color="var(--red)"
            sub="Holds on overdue loans"
            icon={AlertTriangle}
            iconColor="var(--red)"
          />
          <KpiCard
            label="Safe (Current)"
            value={formatCurrency(kpi.safe)}
            color="var(--green)"
            sub="Active + Partially Paid holds"
            icon={CheckCircle}
            iconColor="var(--green)"
          />
          <KpiCard
            label="Penalties Deducted (All Time)"
            value={formatCurrency(kpi.totalPenaltiesDeducted)}
            color="#F59E0B"
            sub="Total deducted from holds"
            icon={TrendingDown}
            iconColor="#F59E0B"
          />
          <KpiCard
            label="Total Realized into PnL"
            value={formatCurrency(kpi.totalRealized)}
            color="var(--green)"
            sub="Settled loans — entered capital_flow"
            icon={ArrowRight}
            iconColor="var(--green)"
          />
          <KpiCard
            label="Pending Realization"
            value={formatCurrency(kpi.pending)}
            color="var(--text-primary)"
            sub="Deducted but not yet settled"
            icon={Clock}
            iconColor="var(--text-muted)"
          />
        </div>
      )}

      {/* ── SECTION 2: Per-loan Hold Breakdown ───────────── */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
          Active Hold Positions
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>
          Showing {enrichedLoans.length} active loan{enrichedLoans.length !== 1 ? 's' : ''} · Paid loans excluded
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 32 }}>
        {/* Table header */}
        <div style={{
          display: 'grid', gridTemplateColumns: COL,
          padding: '12px 20px', borderBottom: '1px solid var(--card-border)',
          background: 'rgba(255,255,255,0.015)'
        }}>
          {HEADER_COLS.map(h => (
            <div key={h} style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {h}
            </div>
          ))}
        </div>

        {loading ? (
          // Skeleton rows
          [...Array(4)].map((_, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: COL, padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.03)', gap: 8 }}>
              {[...Array(7)].map((_, j) => (
                <div key={j} style={{ height: 14, background: 'rgba(255,255,255,0.06)', borderRadius: 4, width: j === 0 ? '70%' : '55%' }} />
              ))}
            </div>
          ))
        ) : enrichedLoans.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            <Shield size={36} style={{ marginBottom: 10, opacity: 0.3 }} /><br />
            No active hold positions found.
          </div>
        ) : (
          enrichedLoans.map((loan, i) => (
            <div
              key={loan.id}
              style={{
                display: 'grid', gridTemplateColumns: COL,
                padding: '14px 20px',
                borderBottom: i < enrichedLoans.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                alignItems: 'start',
                background: loan.status === 'Overdue' ? 'rgba(239,68,68,0.025)' : 'transparent',
                transition: 'background 0.15s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
              onMouseLeave={e => e.currentTarget.style.background = loan.status === 'Overdue' ? 'rgba(239,68,68,0.025)' : 'transparent'}
            >
              {/* Borrower Name */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{loan.borrowerName}</div>
                {loan.due_date && (
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                    Due: {format(parseISO(loan.due_date), 'MMM d, yyyy')}
                  </div>
                )}
              </div>

              {/* Loan Amount */}
              <div style={{ fontSize: 13, color: 'var(--text-label)' }}>
                {formatCurrency(loan.loanAmt)}
              </div>

              {/* Hold Collected (original = 10% of loan) */}
              <div style={{ fontSize: 13, color: 'var(--blue)' }}>
                {formatCurrency(loan.holdOriginal)}
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>10% of loan</div>
              </div>

              {/* Penalties Deducted */}
              <div>
                <div style={{ fontSize: 13, color: loan.deducted > 0 ? 'var(--red)' : 'var(--text-muted)' }}>
                  {formatCurrency(loan.deducted)}
                </div>
                {loan.deducted > 0 && loan.status === 'Overdue' && (
                  <DepletionBar original={loan.holdOriginal} deducted={loan.deducted} />
                )}
              </div>

              {/* Remaining Hold */}
              <div>
                <div style={{
                  fontSize: 13, fontWeight: 700,
                  color: loan.secHold <= 0 ? 'var(--red)' : loan.secHold < loan.holdOriginal * 0.25 ? '#F59E0B' : 'var(--green)'
                }}>
                  {formatCurrency(loan.secHold)}
                </div>
                {loan.secHold <= 0 && (
                  <div style={{ fontSize: 10, color: 'var(--red)', marginTop: 2 }}>Fully consumed</div>
                )}
              </div>

              {/* Status Badge */}
              <div>
                <StatusBadge status={loan.status} />
              </div>

              {/* Days Outstanding */}
              <div style={{ fontSize: 13, color: loan.daysOut !== null && loan.daysOut > 30 ? 'var(--red)' : 'var(--text-label)' }}>
                {loan.daysOut !== null ? `${loan.daysOut}d` : '—'}
              </div>
            </div>
          ))
        )}

        {/* Footer summary row */}
        {!loading && enrichedLoans.length > 0 && (
          <div style={{
            display: 'grid', gridTemplateColumns: COL,
            padding: '12px 20px', background: 'rgba(255,255,255,0.025)',
            borderTop: '2px solid var(--card-border)'
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
              Totals ({enrichedLoans.length} positions)
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-label)' }}>
              {formatCurrency(enrichedLoans.reduce((s, l) => s + l.loanAmt, 0))}
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--blue)' }}>
              {formatCurrency(enrichedLoans.reduce((s, l) => s + l.holdOriginal, 0))}
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--red)' }}>
              {formatCurrency(enrichedLoans.reduce((s, l) => s + l.deducted, 0))}
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)' }}>
              {formatCurrency(kpi.totalHoldLiability)}
            </div>
            <div />
            <div />
          </div>
        )}
      </div>

      {/* ── SECTION 3: Realized PnL from Settled Loans ───── */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
          Realized Penalty PnL — Settled Loans
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>
          Entries from <code style={{ fontSize: 10, background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: 4 }}>capital_flow</code> where category = "Penalty (Collected at Settlement)"
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 24 }}>
        {/* Header */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 2fr',
          padding: '12px 20px', borderBottom: '1px solid var(--card-border)',
          background: 'rgba(255,255,255,0.015)'
        }}>
          {['Entry Date', 'Amount Realized', 'Category / Notes'].map(h => (
            <div key={h} style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {h}
            </div>
          ))}
        </div>

        {loading ? (
          [...Array(3)].map((_, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.03)', gap: 8 }}>
              {[...Array(3)].map((_, j) => (
                <div key={j} style={{ height: 13, background: 'rgba(255,255,255,0.06)', borderRadius: 4, width: j === 2 ? '80%' : '50%' }} />
              ))}
            </div>
          ))
        ) : realizedFlow.length === 0 ? (
          <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            No realized penalty income yet. Entries appear here when settled loans are processed.
          </div>
        ) : (
          realizedFlow.map((row, i) => (
            <div
              key={row.id}
              style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr 2fr',
                padding: '13px 20px',
                borderBottom: i < realizedFlow.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                alignItems: 'center'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.015)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ fontSize: 13, color: 'var(--text-label)' }}>
                {row.entry_date ? format(parseISO(row.entry_date), 'MMM d, yyyy') : '—'}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--green)' }}>
                {formatCurrency(parseFloat(row.amount) || 0)}
              </div>
              <div>
                <span style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 20,
                  background: 'rgba(34,197,94,0.1)', color: 'var(--green)',
                  fontWeight: 600
                }}>
                  {row.category}
                </span>
              </div>
            </div>
          ))
        )}

        {/* Realized total footer */}
        {!loading && realizedFlow.length > 0 && (
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 2fr',
            padding: '14px 20px',
            background: 'rgba(34,197,94,0.06)',
            borderTop: '2px solid var(--card-border)'
          }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-secondary)' }}>
              Total Penalty Income Realized
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--green)' }}>
              {formatCurrency(totalRealized)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', alignSelf: 'center' }}>
              Across {realizedFlow.length} settlement event{realizedFlow.length !== 1 ? 's' : ''}
            </div>
          </div>
        )}
      </div>

      {/* ── Disclaimer footer ────────────────────────────── */}
      <div style={{
        padding: '14px 18px', borderRadius: 10,
        background: 'rgba(255,255,255,0.025)', border: '1px solid var(--card-border)',
        fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6
      }}>
        <strong style={{ color: 'var(--text-label)' }}>Important:</strong>{' '}
        Security hold deposits are a <strong>liability</strong> of Moneyfest — they belong to borrowers until a loan is settled.
        Hold balances shown above do <strong>not</strong> contribute to the capital pool balance or partner earnings calculations.
        Penalty income only enters the capital pool when a loan is fully settled and the capital_flow entry is created.
      </div>
    </div>
  )
}
