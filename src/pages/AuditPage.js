import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { formatCurrency } from '../lib/helpers'
import {
  startOfMonth, endOfMonth, subMonths, format,
  eachWeekOfInterval, endOfWeek
} from 'date-fns'
import {
  Search, Download, History, Filter, AlertTriangle,
  TrendingUp, Users, BarChart2, Shield,
  ChevronDown, ChevronRight, ArrowUp, ArrowDown, Calendar, DollarSign
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, ComposedChart, Line
} from 'recharts'

// ── Constants ───────────────────────────────────────────────────
const TABS = [
  { key: 'activity',       label: 'Activity Log',           icon: History      },
  { key: 'anomalies',      label: 'Anomaly Flags',           icon: AlertTriangle},
  { key: 'accountability', label: 'Admin Accountability',    icon: Shield       },
  { key: 'collection',     label: 'Collection Efficiency',   icon: BarChart2    },
]
const PRESETS = [
  { key: 'this_month',  label: 'This Month'    },
  { key: 'last_month',  label: 'Last Month'    },
  { key: 'last_3',      label: 'Last 3 Months' },
  { key: 'last_6',      label: 'Last 6 Months' },
  { key: 'custom',      label: 'Custom Range'  },
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
const MODULE_COLORS   = { Borrower: 'var(--blue)', Loan: 'var(--purple)', Settings: 'var(--gold)' }
const SEVERITY_CFG    = {
  High:   { color: 'var(--red)',  bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.25)'  },
  Medium: { color: 'var(--gold)', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)' },
  Info:   { color: 'var(--blue)', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.25)' },
}
const DESTRUCTIVE_ACTIONS = ['LOAN_DELETED', 'BORROWER_DELETED', 'DASHBOARD_RESET']
const SETTINGS_ACTIONS    = ['SETTINGS_UPDATED']
const PH_OFFSET    = 8
const WORKING_START = 6
const WORKING_END   = 21

// ── Date helpers ─────────────────────────────────────────────────
function getPresetRange(preset) {
  const now = new Date()
  switch (preset) {
    case 'this_month':  return { start: startOfMonth(now), end: endOfMonth(now) }
    case 'last_month': { const lm = subMonths(now, 1); return { start: startOfMonth(lm), end: endOfMonth(lm) } }
    case 'last_3':     return { start: startOfMonth(subMonths(now, 2)), end: endOfMonth(now) }
    case 'last_6':     return { start: startOfMonth(subMonths(now, 5)), end: endOfMonth(now) }
    default:           return { start: startOfMonth(now), end: endOfMonth(now) }
  }
}
function getPrevRange({ start, end }) {
  const duration = end.getTime() - start.getTime()
  const prevEnd   = new Date(start.getTime() - 1)
  const prevStart = new Date(prevEnd.getTime() - duration)
  return { start: prevStart, end: prevEnd }
}
function toPhHour(utcStr) {
  return (new Date(utcStr).getUTCHours() + PH_OFFSET) % 24
}
function monthKey(dateStr) {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function monthLabel(key) {
  const [y, m] = key.split('-')
  return new Date(parseInt(y), parseInt(m) - 1).toLocaleString('en-PH', { month: 'short', year: '2-digit' })
}



// ── UI Components ─────────────────────────────────────────────────
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
  return <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, color: c.color, background: c.bg }}>{severity}</span>
}
function StatCard({ label, value, color = 'var(--blue)', sub, delta }) {
  return (
    <div className="card" style={{ padding: '14px 18px', textAlign: 'center' }}>
      <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 22, color }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
      {sub   && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
      {delta && <div style={{ marginTop: 6 }}>{delta}</div>}
    </div>
  )
}
function DeltaBadge({ current, previous, invertColors = false }) {
  if (previous === undefined || previous === null) return null
  const delta = current - previous
  if (delta === 0 && previous === 0) return null
  const isUp   = delta >= 0
  const isGood = invertColors ? !isUp : isUp
  const pct    = previous !== 0 ? Math.abs((delta / previous) * 100).toFixed(1) : null
  const Icon   = isUp ? ArrowUp : ArrowDown
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, color: isGood ? 'var(--green)' : 'var(--red)' }}>
      <Icon size={10} />
      {pct !== null ? `${pct}%` : formatCurrency(Math.abs(delta))}
      <span style={{ color: 'var(--text-muted)', marginLeft: 1 }}>vs prev</span>
    </span>
  )
}

// ── Period Selector (always visible) ────────────────────────────
function PeriodSelector({ preset, onPresetChange, customFrom, customTo, onCustomFromChange, onCustomToChange }) {
  const sel = {
    background: 'var(--card)', border: '1px solid var(--card-border)',
    color: 'var(--text-primary)', borderRadius: 8, padding: '8px 12px', fontSize: 13, cursor: 'pointer',
  }
  const inp = {
    background: 'var(--card)', border: '1px solid var(--card-border)',
    color: 'var(--text-primary)', borderRadius: 8, padding: '8px 12px', fontSize: 13,
    colorScheme: 'dark',
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '14px 18px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--card-border)', borderRadius: 12, marginBottom: 20 }}>
      <Calendar size={14} color="var(--text-muted)" />
      <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Period</span>
      <select value={preset} onChange={e => onPresetChange(e.target.value)} style={sel}>
        {PRESETS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
      </select>
      {preset === 'custom' && (
        <>
          <input type="date" value={customFrom} onChange={e => onCustomFromChange(e.target.value)} style={inp} />
          <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>to</span>
          <input type="date" value={customTo}   onChange={e => onCustomToChange(e.target.value)}   style={inp} />
        </>
      )}
      {preset !== 'custom' && (
        <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 4 }}>
          Showing data filtered to this period across all tabs
        </span>
      )}
    </div>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TAB 1 — Activity Log (unchanged logic, receives pre-filtered logs)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function ActivityTab({ logs, loading, onFilterJump }) {
  const [search, setSearch]             = useState('')
  const [moduleFilter, setModuleFilter] = useState('All')
  const [actionFilter, setActionFilter] = useState('All')
  const [page, setPage]                 = useState(0)
  const PER_PAGE = 25

  const modules = ['All', ...new Set(logs.map(l => l.module).filter(Boolean))]
  const actions  = ['All', ...new Set(logs.map(l => l.action_type).filter(Boolean))]

  const filtered = logs.filter(l => {
    const matchSearch = !search ||
      l.description?.toLowerCase().includes(search.toLowerCase()) ||
      l.changed_by?.toLowerCase().includes(search.toLowerCase()) ||
      l.action_type?.toLowerCase().includes(search.toLowerCase())
    return matchSearch && (moduleFilter === 'All' || l.module === moduleFilter) && (actionFilter === 'All' || l.action_type === actionFilter)
  })
  const paginated  = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE)
  const totalPages = Math.ceil(filtered.length / PER_PAGE)

  useEffect(() => { if (onFilterJump) onFilterJump({ setSearch, setModuleFilter, setActionFilter, setPage }) }, [onFilterJump])

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
        <div className="empty-state"><History size={48} /><h3>No records found</h3><p>{search ? 'Try a different search term' : 'No activity in this period'}</p></div>
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
                <div><span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6, color: MODULE_COLORS[log.module] || 'var(--text-label)', background: 'rgba(255,255,255,0.04)' }}>{log.module}</span></div>
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


// TAB 3 — Anomaly Flags (receives filtered logs + dateRange for sub-queries)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function AnomalyTab({ logs, onViewLogs, dateRange }) {
  const [proofs,      setProofs]      = useState([])
  const [capitalFlow, setCapitalFlow] = useState([])
  const [loading,     setLoading]     = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      supabase.from('payment_proofs').select('id, loan_id, installment_number, created_at')
        .gte('created_at', dateRange.start.toISOString())
        .lte('created_at', dateRange.end.toISOString()),
      supabase.from('capital_flow').select('id, loan_id, type, entry_date, amount')
        .gte('entry_date', format(dateRange.start, 'yyyy-MM-dd'))
        .lte('entry_date', format(dateRange.end,   'yyyy-MM-dd')),
    ]).then(([{ data: p }, { data: cf }]) => {
      setProofs(p   || [])
      setCapitalFlow(cf || [])
      setLoading(false)
    })
  }, [dateRange])

  const flags = useMemo(() => {
    const results = []

    // (a) Destructive actions outside 6AM–9PM PH
    for (const log of logs.filter(l => ['DASHBOARD_RESET','BORROWER_DELETED','LOAN_DELETED'].includes(l.action_type))) {
      const hour = toPhHour(log.created_at)
      if (hour < WORKING_START || hour >= WORKING_END) {
        results.push({
          id: `ah-${log.id}`, severity: 'High',
          title: `After-hours destructive action: ${log.action_type.replace(/_/g, ' ')}`,
          detail: `Performed at ${hour}:${String(new Date(log.created_at).getUTCMinutes()).padStart(2,'0')} PH time (outside 6AM–9PM) by ${log.changed_by || 'unknown'}`,
          logSearch: log.description?.slice(0, 40), timestamp: log.created_at,
        })
      }
    }

    // (b) Penalty in audit_logs with no matching capital_flow on same date
    for (const log of logs.filter(l => l.action_type === 'PENALTY_CHARGED' || (l.description || '').toLowerCase().includes('penalty'))) {
      const logDate = new Date(log.created_at).toISOString().slice(0, 10)
      const hasMatch = capitalFlow.some(cf => (cf.entry_date || '').slice(0,10) === logDate && (cf.category || '').toLowerCase().includes('penalty'))
      if (!hasMatch) {
        results.push({
          id: `pen-${log.id}`, severity: 'Medium',
          title: 'Penalty log with no capital_flow entry',
          detail: `Audit log recorded a penalty on ${logDate} but no matching capital_flow entry found. ${log.description || ''}`,
          logSearch: log.description?.slice(0, 40), timestamp: log.created_at,
        })
      }
    }

    // (c) Duplicate payment proofs
    const proofMap = {}
    for (const p of proofs) {
      const key = `${p.loan_id}-${p.installment_number}`
      proofMap[key] = (proofMap[key] || 0) + 1
    }
    for (const [key, count] of Object.entries(proofMap)) {
      if (count > 1) {
        const [loanId, instNum] = key.split('-')
        results.push({
          id: `dup-${key}`, severity: 'Medium',
          title: 'Duplicate payment proofs detected',
          detail: `Loan ${loanId?.slice(0,8)}… has ${count} proofs for installment #${instNum}. Possible double-upload or double-processing.`,
          logSearch: loanId?.slice(0, 8), timestamp: null,
        })
      }
    }

    // (d) Dashboard resets (not already flagged as after-hours)
    for (const log of logs.filter(l => l.action_type === 'DASHBOARD_RESET')) {
      if (!results.find(r => r.id === `ah-${log.id}`)) {
        results.push({
          id: `rst-${log.id}`, severity: 'Info',
          title: 'Dashboard reset performed',
          detail: `${log.description || ''} — by ${log.changed_by || 'unknown'} at ${new Date(log.created_at).toLocaleString('en-PH')}`,
          logSearch: log.description?.slice(0, 40), timestamp: log.created_at,
        })
      }
    }

    return results.sort((a, b) => ({ High: 0, Medium: 1, Info: 2 }[a.severity] - { High: 0, Medium: 1, Info: 2 }[b.severity]))
  }, [logs, proofs, capitalFlow])

  if (loading) return <div className="empty-state"><p>Running anomaly detection...</p></div>
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px,1fr))', gap: 14, marginBottom: 24 }}>
        <StatCard label="Total Flags"     value={flags.length}                                    color="var(--text-primary)" />
        <StatCard label="High Severity"   value={flags.filter(f => f.severity === 'High').length}   color="var(--red)"  />
        <StatCard label="Medium Severity" value={flags.filter(f => f.severity === 'Medium').length} color="var(--gold)" />
        <StatCard label="Info"            value={flags.filter(f => f.severity === 'Info').length}   color="var(--blue)" />
      </div>
      {flags.length === 0 ? (
        <div className="empty-state"><Shield size={40} color="var(--green)" /><h3 style={{ color: 'var(--green)' }}>No anomalies detected</h3><p>All financial records in this period appear consistent</p></div>
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
                  {flag.timestamp && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>{new Date(flag.timestamp).toLocaleString('en-PH')}</div>}
                </div>
                {flag.logSearch && (
                  <button onClick={() => onViewLogs(flag.logSearch)} style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${c.border}`, background: 'rgba(255,255,255,0.04)', color: c.color, fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>View logs →</button>
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
// TAB 4 — Admin Accountability (uses already-filtered logs)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function AccountabilityTab({ logs }) {
  const byAdmin = useMemo(() => {
    const map = {}
    for (const log of logs) {
      const admin = log.changed_by || 'system'
      if (!map[admin]) map[admin] = { admin, total: 0, deletions: 0, settings: 0, destructiveActions: [] }
      map[admin].total++
      if (DESTRUCTIVE_ACTIONS.includes(log.action_type)) { map[admin].deletions++; map[admin].destructiveActions.push(log) }
      if (SETTINGS_ACTIONS.includes(log.action_type)) map[admin].settings++
    }
    return Object.values(map).sort((a, b) => b.total - a.total)
  }, [logs])

  const actionBreakdown = useMemo(() => {
    const map = {}
    for (const log of logs) map[log.action_type] = (map[log.action_type] || 0) + 1
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [logs])

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px,1fr))', gap: 14, marginBottom: 24 }}>
        <StatCard label="Total Actions"       value={logs.length}                                                       color="var(--blue)"   />
        <StatCard label="Active Admins"        value={byAdmin.length}                                                    color="var(--purple)" />
        <StatCard label="Destructive Actions"  value={logs.filter(l => DESTRUCTIVE_ACTIONS.includes(l.action_type)).length} color="var(--red)"  />
        <StatCard label="Settings Changes"     value={logs.filter(l => SETTINGS_ACTIONS.includes(l.action_type)).length}    color="var(--gold)" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--card-border)', fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>
            <Users size={14} style={{ marginRight: 7, verticalAlign: 'middle' }} />Per Admin — Selected Period
          </div>
          {byAdmin.length === 0 ? (
            <div style={{ padding: 24, color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>No admin actions in this period</div>
          ) : byAdmin.map((a, i) => (
            <div key={a.admin} style={{ padding: '14px 20px', borderBottom: i < byAdmin.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.015)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{a.admin}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{a.total} actions · {a.deletions} destructive · {a.settings} settings</div>
                </div>
                {a.deletions > 0 && <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, color: 'var(--red)', background: 'rgba(239,68,68,0.1)' }}>⚠️ Destructive</span>}
              </div>
              {a.deletions > 0 && (
                <div style={{ background: 'rgba(239,68,68,0.05)', borderRadius: 8, padding: '8px 12px', fontSize: 11, color: 'var(--text-label)' }}>
                  {a.destructiveActions.slice(0, 3).map((d, j) => <div key={j} style={{ marginBottom: 2 }}>• {d.action_type.replace(/_/g, ' ')} — {new Date(d.created_at).toLocaleDateString('en-PH')}</div>)}
                  {a.destructiveActions.length > 3 && <div>…and {a.destructiveActions.length - 3} more</div>}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--card-border)', fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>Action Breakdown</div>
          {actionBreakdown.length === 0 ? (
            <div style={{ padding: 24, color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>No actions in this period</div>
          ) : actionBreakdown.map(([action, count], i) => {
            const cfg = ACTION_COLORS[action] || { color: 'var(--text-muted)' }
            const max = actionBreakdown[0][1]
            return (
              <div key={action} style={{ padding: '12px 20px', borderBottom: i < actionBreakdown.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <ActionBadge action={action} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: cfg.color }}>{count}</span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 4, height: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${(count / max) * 100}%`, height: '100%', background: cfg.color, borderRadius: 4, transition: 'width 0.4s ease' }} />
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
// TAB 5 — Collection Efficiency (receives dateRange → filters installments/penalties)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function CollectionTab({ dateRange }) {
  const [loans,       setLoans]       = useState([])
  const [installments, setInst]       = useState([])
  const [penalties,   setPenalties]   = useState([])
  const [loading,     setLoading]     = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      supabase.from('loans').select('id, loan_amount, status, due_date, release_date, payments_made, num_installments, remaining_balance, department').not('status', 'eq', 'Cancelled'),
      supabase.from('installments').select('id, loan_id, status, due_date, paid_at, amount_due')
        .gte('due_date', format(dateRange.start, 'yyyy-MM-dd'))
        .lte('due_date', format(dateRange.end,   'yyyy-MM-dd')),
      supabase.from('penalty_charges').select('id, loan_id, amount, created_at')
        .gte('created_at', dateRange.start.toISOString())
        .lte('created_at', dateRange.end.toISOString())
        .then(r => r).catch(() => ({ data: [] })),
    ]).then(([{ data: l }, { data: inst }, penResult]) => {
      setLoans(l        || [])
      setInst(inst      || [])
      setPenalties((penResult?.data ?? penResult) || [])
      setLoading(false)
    })
  }, [dateRange])

  const metrics = useMemo(() => {
    if (!installments.length) return null
    const today = new Date()
    const paidInst    = installments.filter(i => i.status === 'Paid')
    const onTime      = paidInst.filter(i => i.paid_at && i.due_date && new Date(i.paid_at) <= new Date(i.due_date))
    const onTimeRate  = paidInst.length > 0 ? (onTime.length / paidInst.length) * 100 : 0
    const overdueInst = installments.filter(i => i.status === 'Overdue' || (i.status === 'Pending' && new Date(i.due_date) < today))
    const avgDaysOverdue = overdueInst.length > 0
      ? overdueInst.reduce((s, i) => s + Math.max(0, (today - new Date(i.due_date)) / 86400000), 0) / overdueInst.length
      : 0
    const loansEverOverdue = loans.filter(l => installments.some(i => i.loan_id === l.id && i.status === 'Overdue'))
    const recovered     = loansEverOverdue.filter(l => l.status === 'Paid')
    const recoveryRate  = loansEverOverdue.length > 0 ? (recovered.length / loansEverOverdue.length) * 100 : 0
    const defaultedLoans = loans.filter(l => l.status === 'Defaulted')
    const defaultRate   = loans.length > 0 ? (defaultedLoans.length / loans.length) * 100 : 0
    return { onTimeRate, avgDaysOverdue, recoveryRate, defaultRate, defaultedLoans, loansEverOverdue, paidInst, overdueInst }
  }, [loans, installments])

  const deptBreakdown = useMemo(() => {
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
  if (!metrics) return (
    <div className="empty-state">
      <BarChart2 size={40} /><h3>No installments due in this period</h3>
      <p>Try selecting a wider date range</p>
    </div>
  )

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))', gap: 14, marginBottom: 24 }}>
        <StatCard label="On-Time Payment Rate"  value={`${metrics.onTimeRate.toFixed(1)}%`}     color={metrics.onTimeRate >= 80 ? 'var(--green)' : metrics.onTimeRate >= 60 ? 'var(--gold)' : 'var(--red)'}     sub={`${metrics.paidInst.length} paid installments`} />
        <StatCard label="Avg Days Overdue"       value={metrics.avgDaysOverdue.toFixed(1)}        color={metrics.avgDaysOverdue < 7 ? 'var(--green)' : metrics.avgDaysOverdue < 14 ? 'var(--gold)' : 'var(--red)'} sub={`${metrics.overdueInst.length} overdue`} />
        <StatCard label="Recovery Rate"          value={`${metrics.recoveryRate.toFixed(1)}%`}    color={metrics.recoveryRate >= 70 ? 'var(--green)' : metrics.recoveryRate >= 40 ? 'var(--gold)' : 'var(--red)'} sub={`${metrics.loansEverOverdue.length} ever overdue`} />
        <StatCard label="Default Rate"           value={`${metrics.defaultRate.toFixed(1)}%`}     color={metrics.defaultRate < 5 ? 'var(--green)' : metrics.defaultRate < 10 ? 'var(--gold)' : 'var(--red)'}     sub={`${metrics.defaultedLoans.length} of ${loans.length} loans`} />
      </div>

      {deptBreakdown.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--card-border)', fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>Default Rate by Department</div>
          {deptBreakdown.map((d, i) => {
            const rate  = (d.defaulted / d.total) * 100
            const color = rate === 0 ? 'var(--green)' : rate < 10 ? 'var(--gold)' : 'var(--red)'
            return (
              <div key={d.dept} style={{ display: 'grid', gridTemplateColumns: '200px 1fr 80px 80px', padding: '13px 20px', borderBottom: i < deptBreakdown.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', alignItems: 'center', gap: 12 }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.015)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.dept}</div>
                <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, rate)}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.5s ease' }} />
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'right' }}>{d.total} loans</div>
                <div style={{ fontSize: 13, fontWeight: 700, color, textAlign: 'right' }}>{rate.toFixed(1)}%</div>
              </div>
            )
          })}
        </div>
      )}

      {penalties.length > 0 && (
        <div className="card" style={{ padding: '20px 22px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 14 }}>Penalty Charges — Selected Period</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px,1fr))', gap: 14 }}>
            <div><div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Total Penalty Records</div><div style={{ fontSize: 20, fontWeight: 800, color: 'var(--red)' }}>{penalties.length}</div></div>
            <div><div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Total Penalties Charged</div><div style={{ fontSize: 20, fontWeight: 800, color: 'var(--red)' }}>{formatCurrency(penalties.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0))}</div></div>
            <div><div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Unique Loans Penalized</div><div style={{ fontSize: 20, fontWeight: 800, color: 'var(--gold)' }}>{new Set(penalties.map(p => p.loan_id)).size}</div></div>
          </div>
        </div>
      )}
    </>
  )
}


// MAIN PAGE — owns dateRange state, lifts it to all tabs
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export default function AuditPage() {
  const [activeTab, setActiveTab]   = useState('activity')
  const [logs,      setLogs]        = useState([])
  const [loading,   setLoading]     = useState(true)
  const [activityRef, setActivityRef] = useState(null)

  // ── Period selector state ──
  const [preset,     setPreset]     = useState('this_month')
  const [customFrom, setCustomFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [customTo,   setCustomTo]   = useState(format(endOfMonth(new Date()),   'yyyy-MM-dd'))
  const [dateRange,  setDateRange]  = useState(() => getPresetRange('this_month'))

  const handlePresetChange = (p) => {
    setPreset(p)
    if (p !== 'custom') setDateRange(getPresetRange(p))
  }
  const handleCustomFromChange = (v) => {
    setCustomFrom(v)
    if (v && customTo && v <= customTo) {
      setDateRange({ start: new Date(v + 'T00:00:00'), end: new Date(customTo + 'T23:59:59') })
    }
  }
  const handleCustomToChange = (v) => {
    setCustomTo(v)
    if (customFrom && v && customFrom <= v) {
      setDateRange({ start: new Date(customFrom + 'T00:00:00'), end: new Date(v + 'T23:59:59') })
    }
  }

  // ── fetch audit_logs filtered by dateRange ──
  const fetchLogs = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('audit_logs')
      .select('*')
      .gte('created_at', dateRange.start.toISOString())
      .lte('created_at', dateRange.end.toISOString())
      .order('created_at', { ascending: false })
    setLogs(data || [])
    setLoading(false)
  }, [dateRange])

  useEffect(() => { fetchLogs() }, [fetchLogs])

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
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a'); a.href = url
    a.download = `MoneyfestLending_Audit_${format(dateRange.start, 'yyyyMMdd')}_${format(dateRange.end, 'yyyyMMdd')}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  const tabStyle = (key) => ({
    display: 'flex', alignItems: 'center', gap: 7,
    padding: '9px 16px', borderRadius: 9, border: 'none', cursor: 'pointer',
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
          <p className="page-subtitle">{logs.length} records · {format(dateRange.start, 'MMM d, yyyy')} – {format(dateRange.end, 'MMM d, yyyy')}</p>
        </div>
        <button onClick={exportCSV} className="btn-edit" style={{ gap: 6 }}>
          <Download size={15} /> Export CSV
        </button>
      </div>

      {/* ── Period Selector — always visible ── */}
      <PeriodSelector
        preset={preset}           onPresetChange={handlePresetChange}
        customFrom={customFrom}   onCustomFromChange={handleCustomFromChange}
        customTo={customTo}       onCustomToChange={handleCustomToChange}
      />

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px,1fr))', gap: 14, marginBottom: 22 }}>
        {[
          { label: 'Total Actions',    value: logs.length,                                                     color: 'var(--blue)'   },
          { label: 'Loan Actions',     value: logs.filter(l => l.module === 'Loan').length,                   color: 'var(--purple)' },
          { label: 'Borrower Actions', value: logs.filter(l => l.module === 'Borrower').length,               color: 'var(--green)'  },
          { label: 'Payments Recorded',value: logs.filter(l => l.action_type === 'INSTALLMENT_PAID').length,  color: 'var(--teal)'   },
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
          return <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={tabStyle(tab.key)}><Icon size={14} />{tab.label}</button>
        })}
      </div>

      {/* Tab content — all tabs receive dateRange */}
      {activeTab === 'activity'       && <ActivityTab       logs={logs} loading={loading} onFilterJump={setActivityRef} />}
      {activeTab === 'anomalies'      && <AnomalyTab        logs={logs} onViewLogs={handleViewLogs} dateRange={dateRange} />}
      {activeTab === 'accountability' && <AccountabilityTab logs={logs} />}
      {activeTab === 'collection'     && <CollectionTab     dateRange={dateRange} />}
    </div>
  )
}
