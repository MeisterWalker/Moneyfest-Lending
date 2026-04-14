import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { formatCurrency } from '../lib/helpers'
import {
  Search, Download, History, Filter, AlertTriangle,
  TrendingUp, Users, BarChart2, Shield
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend
} from 'recharts'

// ── Constants ───────────────────────────────────────────────────
const TABS = [
  { key: 'activity',    label: 'Activity Log',          icon: History },
  { key: 'ledger',      label: 'Financial Ledger',       icon: TrendingUp },
  { key: 'anomalies',   label: 'Anomaly Flags',          icon: AlertTriangle },
  { key: 'accountability', label: 'Admin Accountability', icon: Shield },
  { key: 'collection',  label: 'Collection Efficiency',  icon: BarChart2 },
]

const ACTION_COLORS = {
  BORROWER_ADDED:   { color: 'var(--green)',  bg: 'rgba(34,197,94,0.12)'  },
  BORROWER_EDITED:  { color: 'var(--blue)',   bg: 'rgba(59,130,246,0.12)' },
  BORROWER_DELETED: { color: 'var(--red)',    bg: 'rgba(239,68,68,0.12)'  },
  LOAN_CREATED:     { color: 'var(--purple)', bg: 'rgba(139,92,246,0.12)' },
  LOAN_EDITED:      { color: 'var(--blue)',   bg: 'rgba(59,130,246,0.12)' },
  LOAN_DELETED:     { color: 'var(--red)',    bg: 'rgba(239,68,68,0.12)'  },
  LOAN_RENEWED:     { color: 'var(--teal)',   bg: 'rgba(20,184,166,0.12)' },
  LOAN_DEFAULTED:   { color: 'var(--red)',    bg: 'rgba(239,68,68,0.12)'  },
  INSTALLMENT_PAID: { color: 'var(--green)',  bg: 'rgba(34,197,94,0.12)'  },
  SETTINGS_UPDATED: { color: 'var(--gold)',   bg: 'rgba(245,158,11,0.12)' },
  DEPT_ADDED:       { color: 'var(--teal)',   bg: 'rgba(20,184,166,0.12)' },
  DEPT_DELETED:     { color: 'var(--red)',    bg: 'rgba(239,68,68,0.12)'  },
  DASHBOARD_RESET:  { color: 'var(--red)',    bg: 'rgba(239,68,68,0.12)'  },
}
const ACTION_ICONS = {
  BORROWER_ADDED: '👤', BORROWER_EDITED: '✏️', BORROWER_DELETED: '🗑️',
  LOAN_CREATED: '📄', LOAN_EDITED: '✏️', LOAN_DELETED: '🗑️',
  LOAN_RENEWED: '🔄', LOAN_DEFAULTED: '❌', INSTALLMENT_PAID: '✅',
  SETTINGS_UPDATED: '⚙️', DEPT_ADDED: '🏢', DEPT_DELETED: '🏢',
  DASHBOARD_RESET: '⚠️',
}
const MODULE_COLORS = { Borrower: 'var(--blue)', Loan: 'var(--purple)', Settings: 'var(--gold)' }
const SEVERITY_CFG = {
  High:   { color: 'var(--red)',    bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.25)'   },
  Medium: { color: 'var(--gold)',   bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.25)'  },
  Info:   { color: 'var(--blue)',   bg: 'rgba(59,130,246,0.08)',  border: 'rgba(59,130,246,0.25)'  },
}
const PH_OFFSET = 8 // UTC+8
const WORKING_START = 6   // 6 AM PH
const WORKING_END   = 21  // 9 PM PH

// ── Helpers ──────────────────────────────────────────────────────
function toPhHour(utcStr) {
  const d = new Date(utcStr)
  return (d.getUTCHours() + PH_OFFSET) % 24
}
function monthKey(dateStr) {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function monthLabel(key) {
  const [y, m] = key.split('-')
  return new Date(parseInt(y), parseInt(m) - 1).toLocaleString('en-PH', { month: 'short', year: '2-digit' })
}
function pct(n, d) { return d > 0 ? ((n / d) * 100).toFixed(1) + '%' : '—' }

// ── Sub-components ────────────────────────────────────────────────
function ActionBadge({ action }) {
  const cfg = ACTION_COLORS[action] || { color: 'var(--text-label)', bg: 'rgba(255,255,255,0.06)' }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, color: cfg.color, background: cfg.bg, whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.4 }}>
      {ACTION_ICONS[action] || '•'} {action?.replace(/_/g, ' ') || action}
    </span>
  )
}

function SeverityBadge({ severity }) {
  const c = SEVERITY_CFG[severity] || SEVERITY_CFG.Info
  return (
    <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, color: c.color, background: c.bg }}>
      {severity}
    </span>
  )
}

function StatCard({ label, value, color = 'var(--blue)', sub }) {
  return (
    <div className="card" style={{ padding: '14px 18px', textAlign: 'center' }}>
      <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 22, color }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TAB 1 — Activity Log (original, fully intact)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function ActivityTab({ logs, loading, onFilterJump }) {
  const [search, setSearch] = useState('')
  const [moduleFilter, setModuleFilter] = useState('All')
  const [actionFilter, setActionFilter] = useState('All')
  const [page, setPage] = useState(0)
  const PER_PAGE = 25

  const modules = ['All', ...new Set(logs.map(l => l.module).filter(Boolean))]
  const actions  = ['All', ...new Set(logs.map(l => l.action_type).filter(Boolean))]

  const filtered = logs.filter(l => {
    const matchSearch = !search ||
      l.description?.toLowerCase().includes(search.toLowerCase()) ||
      l.changed_by?.toLowerCase().includes(search.toLowerCase()) ||
      l.action_type?.toLowerCase().includes(search.toLowerCase())
    const matchModule = moduleFilter === 'All' || l.module === moduleFilter
    const matchAction = actionFilter === 'All' || l.action_type === actionFilter
    return matchSearch && matchModule && matchAction
  })

  const paginated = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE)
  const totalPages = Math.ceil(filtered.length / PER_PAGE)

  // Expose filter jump for anomaly tab "View logs" button
  useEffect(() => {
    if (onFilterJump) onFilterJump({ setSearch, setModuleFilter, setActionFilter, setPage })
  }, [onFilterJump])

  return (
    <>
      <div style={{ display: 'flex', gap: 12, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="search-bar" style={{ flex: 1, minWidth: 200 }}>
          <Search size={15} />
          <input placeholder="Search description, user, action..." value={search} onChange={e => { setSearch(e.target.value); setPage(0) }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Filter size={14} color="var(--text-muted)" />
          <select value={moduleFilter} onChange={e => { setModuleFilter(e.target.value); setPage(0) }} style={{ background: 'var(--card)', border: '1px solid var(--card-border)', color: 'var(--text-primary)', borderRadius: 8, padding: '8px 12px', fontSize: 13 }}>
            {modules.map(m => <option key={m} value={m}>{m === 'All' ? 'All Modules' : m}</option>)}
          </select>
          <select value={actionFilter} onChange={e => { setActionFilter(e.target.value); setPage(0) }} style={{ background: 'var(--card)', border: '1px solid var(--card-border)', color: 'var(--text-primary)', borderRadius: 8, padding: '8px 12px', fontSize: 13 }}>
            {actions.map(a => <option key={a} value={a}>{a === 'All' ? 'All Actions' : a.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="empty-state"><p>Loading audit history...</p></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <History size={48} />
          <h3>No records found</h3>
          <p>{search ? 'Try a different search term' : 'Actions will appear here as they happen'}</p>
        </div>
      ) : (
        <>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 100px 150px', padding: '12px 22px', borderBottom: '1px solid var(--card-border)', background: 'rgba(255,255,255,0.015)' }}>
              {['Action', 'Description', 'Module', 'Timestamp'].map(h => (
                <div key={h} style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{h}</div>
              ))}
            </div>
            {paginated.map((log, i) => (
              <div key={log.id} style={{ display: 'grid', gridTemplateColumns: '220px 1fr 100px 150px', padding: '14px 22px', borderBottom: i < paginated.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none', alignItems: 'start' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.015)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <div style={{ paddingRight: 12, paddingTop: 2 }}><ActionBadge action={log.action_type} /></div>
                <div style={{ paddingRight: 16 }}>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 3, lineHeight: 1.4 }}>{log.description}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>by {log.changed_by || 'system'}</div>
                </div>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6, color: MODULE_COLORS[log.module] || 'var(--text-label)', background: 'rgba(255,255,255,0.04)' }}>{log.module}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {new Date(log.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                  <div style={{ fontSize: 11, marginTop: 2 }}>{new Date(log.created_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              </div>
            ))}
          </div>
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 20 }}>
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--card-border)', borderRadius: 8, padding: '6px 16px', cursor: page === 0 ? 'not-allowed' : 'pointer', color: 'var(--text-label)', opacity: page === 0 ? 0.4 : 1, fontSize: 13 }}>← Prev</button>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Page {page + 1} of {totalPages} · {filtered.length} records</span>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--card-border)', borderRadius: 8, padding: '6px 16px', cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer', color: 'var(--text-label)', opacity: page >= totalPages - 1 ? 0.4 : 1, fontSize: 13 }}>Next →</button>
            </div>
          )}
        </>
      )}
    </>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TAB 2 — Financial Ledger
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function LedgerTab() {
  const [flow, setFlow] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('capital_flow').select('*').order('created_at', { ascending: true })
      .then(({ data }) => { setFlow(data || []); setLoading(false) })
  }, [])

  const monthly = useMemo(() => {
    const map = {}
    for (const row of flow) {
      const k = monthKey(row.created_at)
      if (!map[k]) map[k] = { month: k, label: monthLabel(k), interest: 0, principal: 0, penalties: 0, disbursed: 0 }
      const type = (row.type || '').toLowerCase()
      const amt = parseFloat(row.amount) || 0
      if (type.includes('interest'))   map[k].interest  += amt
      if (type.includes('principal'))  map[k].principal += amt
      if (type.includes('penalty'))    map[k].penalties  += amt
      if (type.includes('disburs'))    map[k].disbursed  += amt
    }
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month))
  }, [flow])

  // Running balance
  let runningBalance = 0
  const monthlyWithBalance = monthly.map(m => {
    runningBalance += (m.interest + m.principal + m.penalties - m.disbursed)
    return { ...m, balance: runningBalance }
  })

  const totalInterest  = monthly.reduce((s, m) => s + m.interest, 0)
  const totalPrincipal = monthly.reduce((s, m) => s + m.principal, 0)
  const totalPenalties = monthly.reduce((s, m) => s + m.penalties, 0)
  const totalDisbursed = monthly.reduce((s, m) => s + m.disbursed, 0)

  const customTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 10, padding: '12px 16px', fontSize: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>{label}</div>
        {payload.map(p => (
          <div key={p.name} style={{ color: p.color, marginBottom: 3 }}>{p.name}: {formatCurrency(p.value)}</div>
        ))}
      </div>
    )
  }

  if (loading) return <div className="empty-state"><p>Loading ledger data...</p></div>
  if (monthly.length === 0) return <div className="empty-state"><TrendingUp size={40} /><h3>No capital_flow data yet</h3><p>Data will appear as payments are recorded</p></div>

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))', gap: 14, marginBottom: 24 }}>
        <StatCard label="Total Interest Collected" value={formatCurrency(totalInterest)} color="var(--green)" />
        <StatCard label="Total Principal Returned" value={formatCurrency(totalPrincipal)} color="var(--blue)" />
        <StatCard label="Total Penalties Charged" value={formatCurrency(totalPenalties)} color="var(--red)" />
        <StatCard label="Total Disbursed" value={formatCurrency(totalDisbursed)} color="var(--gold)" />
      </div>

      <div className="card" style={{ padding: '24px', marginBottom: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 20, color: 'var(--text-secondary)' }}>Monthly Capital Flow</div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={monthlyWithBalance} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
            <YAxis tickFormatter={v => `₱${(v/1000).toFixed(0)}k`} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
            <Tooltip content={customTooltip} />
            <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-muted)' }} />
            <Bar dataKey="interest"  name="Interest Collected" fill="#22C55E" radius={[3,3,0,0]} />
            <Bar dataKey="principal" name="Principal Returned"  fill="#3B82F6" radius={[3,3,0,0]} />
            <Bar dataKey="penalties" name="Penalties"           fill="#EF4444" radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Tabular breakdown */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1fr', padding: '12px 22px', borderBottom: '1px solid var(--card-border)', background: 'rgba(255,255,255,0.015)' }}>
          {['Month', 'Interest', 'Principal', 'Penalties', 'Disbursed', 'Running Balance'].map(h => (
            <div key={h} style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{h}</div>
          ))}
        </div>
        {monthlyWithBalance.map((m, i) => (
          <div key={m.month} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1fr', padding: '13px 22px', borderBottom: i < monthlyWithBalance.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none', alignItems: 'center' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.015)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{m.label}</div>
            <div style={{ fontSize: 13, color: 'var(--green)' }}>{formatCurrency(m.interest)}</div>
            <div style={{ fontSize: 13, color: 'var(--blue)' }}>{formatCurrency(m.principal)}</div>
            <div style={{ fontSize: 13, color: m.penalties > 0 ? 'var(--red)' : 'var(--text-muted)' }}>{formatCurrency(m.penalties)}</div>
            <div style={{ fontSize: 13, color: 'var(--gold)' }}>{formatCurrency(m.disbursed)}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: m.balance >= 0 ? 'var(--green)' : 'var(--red)' }}>{formatCurrency(m.balance)}</div>
          </div>
        ))}
      </div>
    </>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TAB 3 — Anomaly Flags
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function AnomalyTab({ logs, onViewLogs }) {
  const [proofs, setProofs]       = useState([])
  const [capitalFlow, setCapitalFlow] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('payment_proofs').select('id, loan_id, installment_number, created_at'),
      supabase.from('capital_flow').select('id, loan_id, type, created_at, amount'),
    ]).then(([{ data: p }, { data: cf }]) => {
      setProofs(p || [])
      setCapitalFlow(cf || [])
      setLoading(false)
    })
  }, [])

  const flags = useMemo(() => {
    const results = []

    // (a) DASHBOARD_RESET or BORROWER_DELETED outside 6AM–9PM PH
    const afterHours = logs.filter(l =>
      ['DASHBOARD_RESET', 'BORROWER_DELETED', 'LOAN_DELETED'].includes(l.action_type) &&
      (toPhHour(l.created_at) < WORKING_START || toPhHour(l.created_at) >= WORKING_END)
    )
    for (const log of afterHours) {
      const hour = toPhHour(log.created_at)
      results.push({
        id: `ah-${log.id}`,
        severity: 'High',
        title: `After-hours destructive action: ${log.action_type.replace(/_/g, ' ')}`,
        detail: `Performed at ${hour}:${String(new Date(log.created_at).getUTCMinutes()).padStart(2,'0')} PH time (outside 6AM–9PM) by ${log.changed_by || 'unknown'}`,
        logSearch: log.description?.slice(0, 40),
        timestamp: log.created_at,
      })
    }

    // (b) Penalty in audit_logs with no matching capital_flow on same date
    const penaltyLogs = logs.filter(l => l.action_type === 'PENALTY_CHARGED' || (l.description || '').toLowerCase().includes('penalty'))
    for (const log of penaltyLogs) {
      const logDate = new Date(log.created_at).toISOString().slice(0, 10)
      const hasMatch = capitalFlow.some(cf => {
        const cfDate = new Date(cf.created_at).toISOString().slice(0, 10)
        return cfDate === logDate && (cf.type || '').toLowerCase().includes('penalty')
      })
      if (!hasMatch) {
        results.push({
          id: `pen-${log.id}`,
          severity: 'Medium',
          title: 'Penalty log with no capital_flow entry',
          detail: `Audit log recorded a penalty on ${logDate} but no matching capital_flow entry found. ${log.description || ''}`,
          logSearch: log.description?.slice(0, 40),
          timestamp: log.created_at,
        })
      }
    }

    // (c) Duplicate payment proofs (same loan_id + installment_number)
    const proofMap = {}
    for (const p of proofs) {
      const key = `${p.loan_id}-${p.installment_number}`
      proofMap[key] = (proofMap[key] || 0) + 1
    }
    for (const [key, count] of Object.entries(proofMap)) {
      if (count > 1) {
        const [loanId, instNum] = key.split('-')
        results.push({
          id: `dup-${key}`,
          severity: 'Medium',
          title: `Duplicate payment proofs detected`,
          detail: `Loan ${loanId?.slice(0, 8)}… has ${count} proofs for installment #${instNum}. Possible double-upload or double-processing.`,
          logSearch: loanId?.slice(0, 8),
          timestamp: null,
        })
      }
    }

    // (d) DASHBOARD_RESET actions (always flagged for review)
    const resets = logs.filter(l => l.action_type === 'DASHBOARD_RESET')
    for (const log of resets) {
      const alreadyFlagged = results.find(r => r.id === `ah-${log.id}`)
      if (!alreadyFlagged) {
        results.push({
          id: `rst-${log.id}`,
          severity: 'Info',
          title: 'Dashboard reset performed',
          detail: `${log.description || ''} — by ${log.changed_by || 'unknown'} at ${new Date(log.created_at).toLocaleString('en-PH')}`,
          logSearch: log.description?.slice(0, 40),
          timestamp: log.created_at,
        })
      }
    }

    return results.sort((a, b) => {
      const order = { High: 0, Medium: 1, Info: 2 }
      return order[a.severity] - order[b.severity]
    })
  }, [logs, proofs, capitalFlow])

  if (loading) return <div className="empty-state"><p>Running anomaly detection...</p></div>

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px,1fr))', gap: 14, marginBottom: 24 }}>
        <StatCard label="Total Flags" value={flags.length} color="var(--text-primary)" />
        <StatCard label="High Severity" value={flags.filter(f => f.severity === 'High').length} color="var(--red)" />
        <StatCard label="Medium Severity" value={flags.filter(f => f.severity === 'Medium').length} color="var(--gold)" />
        <StatCard label="Info" value={flags.filter(f => f.severity === 'Info').length} color="var(--blue)" />
      </div>

      {flags.length === 0 ? (
        <div className="empty-state">
          <Shield size={40} color="var(--green)" />
          <h3 style={{ color: 'var(--green)' }}>No anomalies detected</h3>
          <p>All financial records appear consistent</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {flags.map(flag => {
            const c = SEVERITY_CFG[flag.severity] || SEVERITY_CFG.Info
            return (
              <div key={flag.id} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <SeverityBadge severity={flag.severity} />
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{flag.title}</span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-label)', lineHeight: 1.6 }}>{flag.detail}</div>
                  {flag.timestamp && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                      {new Date(flag.timestamp).toLocaleString('en-PH')}
                    </div>
                  )}
                </div>
                {flag.logSearch && (
                  <button
                    onClick={() => onViewLogs(flag.logSearch)}
                    style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${c.border}`, background: 'rgba(255,255,255,0.04)', color: c.color, fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    View logs →
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TAB 4 — Admin Accountability
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const DESTRUCTIVE_ACTIONS = ['LOAN_DELETED', 'BORROWER_DELETED', 'DASHBOARD_RESET']
const SETTINGS_ACTIONS    = ['SETTINGS_UPDATED']

function AccountabilityTab({ logs }) {
  const now = new Date()
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2,'0')}`

  const monthLogs = logs.filter(l => monthKey(l.created_at) === thisMonth)

  const byAdmin = useMemo(() => {
    const map = {}
    for (const log of monthLogs) {
      const admin = log.changed_by || 'system'
      if (!map[admin]) map[admin] = { admin, total: 0, deletions: 0, settings: 0, destructiveActions: [] }
      map[admin].total++
      if (DESTRUCTIVE_ACTIONS.includes(log.action_type)) {
        map[admin].deletions++
        map[admin].destructiveActions.push(log)
      }
      if (SETTINGS_ACTIONS.includes(log.action_type)) map[admin].settings++
    }
    return Object.values(map).sort((a, b) => b.total - a.total)
  }, [monthLogs])

  const actionBreakdown = useMemo(() => {
    const map = {}
    for (const log of monthLogs) {
      map[log.action_type] = (map[log.action_type] || 0) + 1
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [monthLogs])

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px,1fr))', gap: 14, marginBottom: 24 }}>
        <StatCard label="Total Actions This Month" value={monthLogs.length} color="var(--blue)" />
        <StatCard label="Active Admins" value={byAdmin.length} color="var(--purple)" />
        <StatCard label="Destructive Actions" value={monthLogs.filter(l => DESTRUCTIVE_ACTIONS.includes(l.action_type)).length} color="var(--red)" />
        <StatCard label="Settings Changes" value={monthLogs.filter(l => SETTINGS_ACTIONS.includes(l.action_type)).length} color="var(--gold)" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* Per-admin breakdown */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--card-border)', fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>
            <Users size={14} style={{ marginRight: 7, verticalAlign: 'middle' }} />Per Admin — {now.toLocaleString('en-PH', { month: 'long', year: 'numeric' })}
          </div>
          {byAdmin.length === 0 ? (
            <div style={{ padding: 24, color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>No actions this month</div>
          ) : byAdmin.map((a, i) => (
            <div key={a.admin} style={{ padding: '14px 20px', borderBottom: i < byAdmin.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.015)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{a.admin}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    {a.total} actions · {a.deletions} destructive · {a.settings} settings
                  </div>
                </div>
                {a.deletions > 0 && (
                  <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, color: 'var(--red)', background: 'rgba(239,68,68,0.1)' }}>
                    ⚠️ Destructive
                  </span>
                )}
              </div>
              {a.deletions > 0 && (
                <div style={{ background: 'rgba(239,68,68,0.05)', borderRadius: 8, padding: '8px 12px', fontSize: 11, color: 'var(--text-label)' }}>
                  {a.destructiveActions.slice(0, 3).map((d, i) => (
                    <div key={i} style={{ marginBottom: 2 }}>• {d.action_type.replace(/_/g, ' ')} — {new Date(d.created_at).toLocaleDateString('en-PH')}</div>
                  ))}
                  {a.destructiveActions.length > 3 && <div>…and {a.destructiveActions.length - 3} more</div>}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Action type breakdown */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--card-border)', fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>
            Action Breakdown This Month
          </div>
          {actionBreakdown.length === 0 ? (
            <div style={{ padding: 24, color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>No actions this month</div>
          ) : actionBreakdown.map(([action, count], i) => {
            const cfg = ACTION_COLORS[action] || { color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.06)' }
            const maxCount = actionBreakdown[0][1]
            return (
              <div key={action} style={{ padding: '12px 20px', borderBottom: i < actionBreakdown.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <ActionBadge action={action} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: cfg.color }}>{count}</span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 4, height: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${(count / maxCount) * 100}%`, height: '100%', background: cfg.color, borderRadius: 4, transition: 'width 0.4s ease' }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TAB 5 — Collection Efficiency
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function CollectionTab() {
  const [loans, setLoans]         = useState([])
  const [installments, setInst]   = useState([])
  const [penalties, setPenalties] = useState([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('loans').select('id, loan_amount, status, due_date, release_date, payments_made, num_installments, remaining_balance').not('status', 'eq', 'Cancelled'),
      supabase.from('installments').select('id, loan_id, status, due_date, paid_at, amount_due'),
      supabase.from('penalty_charges').select('id, loan_id, amount, created_at').catch(() => ({ data: [] })),
    ]).then(([{ data: l }, { data: inst }, { data: pen }]) => {
      setLoans(l || [])
      setInst(inst || [])
      setPenalties((pen?.data ?? pen) || [])
      setLoading(false)
    })
  }, [])

  const metrics = useMemo(() => {
    if (!loans.length || !installments.length) return null

    const today = new Date()

    // On-time payment rate: paid installments where paid_at <= due_date
    const paidInst = installments.filter(i => i.status === 'Paid')
    const onTime   = paidInst.filter(i => i.paid_at && i.due_date && new Date(i.paid_at) <= new Date(i.due_date))
    const onTimeRate = paidInst.length > 0 ? (onTime.length / paidInst.length) * 100 : 0

    // Average days overdue: overdue installments
    const overdueInst = installments.filter(i => (i.status === 'Overdue' || (i.status === 'Pending' && new Date(i.due_date) < today)))
    const avgDaysOverdue = overdueInst.length > 0
      ? overdueInst.reduce((sum, i) => sum + Math.max(0, (today - new Date(i.due_date)) / 86400000), 0) / overdueInst.length
      : 0

    // Recovery rate: overdue loans that have been paid off
    const loansEverOverdue = loans.filter(l => {
      const instForLoan = installments.filter(i => i.loan_id === l.id)
      return instForLoan.some(i => i.status === 'Overdue')
    })
    const recovered = loansEverOverdue.filter(l => l.status === 'Paid')
    const recoveryRate = loansEverOverdue.length > 0 ? (recovered.length / loansEverOverdue.length) * 100 : 0

    // Default rate
    const defaultedLoans = loans.filter(l => l.status === 'Defaulted')
    const defaultRate = loans.length > 0 ? (defaultedLoans.length / loans.length) * 100 : 0

    return { onTimeRate, avgDaysOverdue, recoveryRate, defaultRate, defaultedLoans, loansEverOverdue, paidInst, overdueInst }
  }, [loans, installments])

  // Default rate by department
  const deptBreakdown = useMemo(() => {
    if (!loans.length) return []
    const map = {}
    for (const loan of loans) {
      const dept = loan.department || 'Unknown'
      if (!map[dept]) map[dept] = { dept, total: 0, defaulted: 0 }
      map[dept].total++
      if (loan.status === 'Defaulted') map[dept].defaulted++
    }
    return Object.values(map).filter(d => d.total > 0).sort((a, b) => (b.defaulted / b.total) - (a.defaulted / a.total))
  }, [loans])

  if (loading) return <div className="empty-state"><p>Loading collection data...</p></div>
  if (!metrics) return <div className="empty-state"><BarChart2 size={40} /><h3>Insufficient data</h3><p>Collection metrics will appear as loans are processed</p></div>

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))', gap: 14, marginBottom: 24 }}>
        <StatCard label="On-Time Payment Rate" value={`${metrics.onTimeRate.toFixed(1)}%`} color={metrics.onTimeRate >= 80 ? 'var(--green)' : metrics.onTimeRate >= 60 ? 'var(--gold)' : 'var(--red)'} sub={`${metrics.paidInst.length} paid installments`} />
        <StatCard label="Avg Days Overdue" value={metrics.avgDaysOverdue.toFixed(1)} color={metrics.avgDaysOverdue < 7 ? 'var(--green)' : metrics.avgDaysOverdue < 14 ? 'var(--gold)' : 'var(--red)'} sub={`${metrics.overdueInst.length} overdue installments`} />
        <StatCard label="Recovery Rate" value={`${metrics.recoveryRate.toFixed(1)}%`} color={metrics.recoveryRate >= 70 ? 'var(--green)' : metrics.recoveryRate >= 40 ? 'var(--gold)' : 'var(--red)'} sub={`${metrics.loansEverOverdue.length} loans ever overdue`} />
        <StatCard label="Default Rate" value={`${metrics.defaultRate.toFixed(1)}%`} color={metrics.defaultRate < 5 ? 'var(--green)' : metrics.defaultRate < 10 ? 'var(--gold)' : 'var(--red)'} sub={`${metrics.defaultedLoans.length} of ${loans.length} loans`} />
      </div>

      {/* Default rate by department */}
      {deptBreakdown.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--card-border)', fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>
            Default Rate by Department
          </div>
          {deptBreakdown.map((d, i) => {
            const rate = (d.defaulted / d.total) * 100
            const color = rate === 0 ? 'var(--green)' : rate < 10 ? 'var(--gold)' : 'var(--red)'
            return (
              <div key={d.dept} style={{ display: 'grid', gridTemplateColumns: '200px 1fr 80px 80px', padding: '13px 20px', borderBottom: i < deptBreakdown.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', alignItems: 'center', gap: 12 }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.015)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.dept}</div>
                <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, rate || 0)}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.5s ease' }} />
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'right' }}>{d.total} loans</div>
                <div style={{ fontSize: 13, fontWeight: 700, color, textAlign: 'right' }}>{rate.toFixed(1)}%</div>
              </div>
            )
          })}
        </div>
      )}

      {/* Penalties summary */}
      {penalties.length > 0 && (
        <div className="card" style={{ padding: '20px 22px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 14 }}>Penalty Charges Summary</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px,1fr))', gap: 14 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Total Penalty Records</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--red)' }}>{penalties.length}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Total Penalties Charged</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--red)' }}>
                {formatCurrency(penalties.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Unique Loans Penalized</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--gold)' }}>
                {new Set(penalties.map(p => p.loan_id)).size}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN PAGE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export default function AuditPage() {
  const [activeTab, setActiveTab] = useState('activity')
  const [logs, setLogs]   = useState([])
  const [loading, setLoading] = useState(true)
  const [activityRef, setActivityRef] = useState(null)

  const fetchLogs = useCallback(async () => {
    const { data } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false })
    setLogs(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  // Called from AnomalyTab "View logs" button — jumps to activity tab + filters
  const handleViewLogs = useCallback((searchTerm) => {
    setActiveTab('activity')
    if (activityRef?.setSearch) activityRef.setSearch(searchTerm)
  }, [activityRef])

  const exportCSV = () => {
    const headers = ['Timestamp', 'Action', 'Module', 'Description', 'Changed By']
    const rows = logs.map(l => [
      new Date(l.created_at).toLocaleString('en-PH'),
      l.action_type, l.module, `"${(l.description || '').replace(/"/g, '""')}"`, l.changed_by
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `MoneyfestLending_Audit_${new Date().toISOString().slice(0,10)}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  const tabStyle = (key) => ({
    display: 'flex', alignItems: 'center', gap: 7,
    padding: '9px 18px', borderRadius: 9, border: 'none', cursor: 'pointer',
    fontSize: 13, fontWeight: activeTab === key ? 700 : 500,
    background: activeTab === key ? 'rgba(255,255,255,0.1)' : 'transparent',
    color: activeTab === key ? 'var(--text-primary)' : 'var(--text-muted)',
    transition: 'all 0.15s ease',
  })

  return (
    <div style={{ padding: '32px 28px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Audit History</h1>
          <p className="page-subtitle">{logs.length} total records — permanent, read-only</p>
        </div>
        <button onClick={exportCSV} className="btn-edit" style={{ gap: 6 }}>
          <Download size={15} /> Export CSV
        </button>
      </div>

      {/* Stats row (always visible) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 14, marginBottom: 22 }}>
        {[
          { label: 'Total Actions',      value: logs.length,                                                       color: 'var(--blue)'   },
          { label: 'Loan Actions',        value: logs.filter(l => l.module === 'Loan').length,                    color: 'var(--purple)' },
          { label: 'Borrower Actions',    value: logs.filter(l => l.module === 'Borrower').length,                color: 'var(--green)'  },
          { label: 'Payments Recorded',   value: logs.filter(l => l.action_type === 'INSTALLMENT_PAID').length,   color: 'var(--teal)'   },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '14px 18px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 22, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 5, flexWrap: 'wrap' }}>
        {TABS.map(tab => {
          const Icon = tab.icon
          return (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={tabStyle(tab.key)}>
              <Icon size={14} />{tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      {activeTab === 'activity' && (
        <ActivityTab logs={logs} loading={loading} onFilterJump={setActivityRef} />
      )}
      {activeTab === 'ledger' && <LedgerTab />}
      {activeTab === 'anomalies' && <AnomalyTab logs={logs} onViewLogs={handleViewLogs} />}
      {activeTab === 'accountability' && <AccountabilityTab logs={logs} />}
      {activeTab === 'collection' && <CollectionTab />}
    </div>
  )
}
