import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { formatCurrency } from '../lib/helpers'
import {
  startOfMonth, endOfMonth, subMonths, format,
  eachDayOfInterval
} from 'date-fns'
import {
  Calendar, TrendingUp, ChevronDown, ChevronRight, ArrowUp, ArrowDown, History, Info
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend
} from 'recharts'

// ── Shared Helpers ────────────────────────────────────────────────
const PRESETS = [
  { key: 'this_month',  label: 'This Month'    },
  { key: 'last_month',  label: 'Last Month'    },
  { key: 'last_3',      label: 'Last 3 Months' },
  { key: 'last_6',      label: 'Last 6 Months' },
  { key: 'custom',      label: 'Custom Range'  },
]
const PH_OFFSET = 8

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
function monthKey(dateStr) {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function monthLabel(key) {
  const [y, m] = key.split('-')
  return new Date(parseInt(y), parseInt(m) - 1).toLocaleString('en-PH', { month: 'short', year: '2-digit' })
}

function aggregateFlow(rows = []) {
  let interest = 0, principal = 0, penalties = 0, disbursed = 0, expenses = 0, topups = 0
  for (const r of rows) {
    const cat = (r.category || '').toLowerCase()
    const amt  = parseFloat(r.amount) || 0
    if (cat.includes('interest profit'))                                           interest  += amt
    if (cat.includes('penalty'))                                                   penalties += amt
    
    if (r.type === 'CASH IN') {
      if (cat.includes('initial pool') || cat.includes('capital top-up')) {
        topups += amt
      } else if (cat.includes('loan principal return')) {
        principal += amt
      }
    }
    
    if (r.type === 'CASH OUT') {
      if (cat.includes('expense') || cat.includes('partner withdrawal') || cat.includes('rebate')) {
        expenses += amt
      } else {
        disbursed += amt
      }
    }
  }
  return { interest, principal, penalties, topups, disbursed, expenses, net: interest + principal + penalties + topups - disbursed - expenses }
}

// ── Shared UI ────────────────────────────────────────────────────
function StatCard({ label, value, color = 'var(--blue)', sub, delta, tooltip }) {
  return (
    <div className="card" style={{ padding: '14px 18px', textAlign: 'center', position: 'relative' }}>
      {tooltip && (
        <div style={{ position: 'absolute', top: 12, right: 12 }} title={tooltip}>
          <Info size={14} color="var(--text-muted)" style={{ cursor: 'help' }} />
        </div>
      )}
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
    </div>
  )
}

export default function LedgerPage() {
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

  const [flow,        setFlow]        = useState([])
  const [prevFlow,    setPrevFlow]    = useState([])
  const [histFlow,    setHistFlow]    = useState([])
  const [loading,     setLoading]     = useState(true)
  const [expanded,    setExpanded]    = useState({})

  useEffect(() => {
    setLoading(true)
    const prevRange = getPrevRange(dateRange)

    Promise.all([
      supabase.from('capital_flow').select('*')
        .gte('entry_date', format(dateRange.start, 'yyyy-MM-dd'))
        .lte('entry_date', format(dateRange.end,   'yyyy-MM-dd'))
        .order('entry_date', { ascending: true }),
      supabase.from('capital_flow').select('*')
        .gte('entry_date', format(prevRange.start, 'yyyy-MM-dd'))
        .lte('entry_date', format(prevRange.end,   'yyyy-MM-dd'))
        .order('entry_date', { ascending: true }),
      supabase.from('capital_flow').select('*')
        .order('entry_date', { ascending: true }) 
    ]).then(([{ data: curr }, { data: prev }, { data: all }]) => {
      setFlow(curr     || [])
      setPrevFlow(prev || [])
      setHistFlow(all  || [])
      setLoading(false)
    })
  }, [dateRange])

  const monthly = useMemo(() => {
    const map = {}
    for (const row of flow) {
      const k = monthKey(row.entry_date || row.created_at)
      if (!map[k]) map[k] = { month: k, label: monthLabel(k), interest: 0, principal: 0, penalties: 0, topups: 0, disbursed: 0, expenses: 0 }
      const cat = (row.category || '').toLowerCase()
      const amt  = parseFloat(row.amount) || 0
      if (cat.includes('interest profit'))                                         map[k].interest  += amt
      if (cat.includes('penalty'))                                                 map[k].penalties += amt
      
      if (row.type === 'CASH IN') {
        if (cat.includes('initial pool') || cat.includes('capital top-up')) {
          map[k].topups += amt
        } else if (cat.includes('loan principal return')) {
          map[k].principal += amt
        }
      }

      if (row.type === 'CASH OUT') {
        if (cat.includes('expense') || cat.includes('partner withdrawal') || cat.includes('rebate')) {
          map[k].expenses += amt
        } else {
          map[k].disbursed += amt
        }
      }
    }
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month))
  }, [flow])

  let runningBalance = 0
  const monthlyWithBalance = monthly.map(m => {
    let historicalNetBeforeThisMonth = 0
    for(const hr of histFlow) {
      if (monthKey(hr.entry_date || hr.created_at) < m.month) {
         historicalNetBeforeThisMonth += (hr.type === 'CASH IN' ? parseFloat(hr.amount)||0 : -(parseFloat(hr.amount)||0))
      }
    }
    runningBalance = historicalNetBeforeThisMonth + m.interest + m.principal + m.penalties + m.topups - m.disbursed - m.expenses
    return { ...m, balance: runningBalance }
  })

  const curr = aggregateFlow(flow)
  const prev = aggregateFlow(prevFlow)

  const monthlyHistory = useMemo(() => {
    const months = []
    for (let i = 5; i >= 0; i--) {
      const mStart = startOfMonth(subMonths(new Date(), i))
      const mEnd   = endOfMonth(subMonths(new Date(), i))
      const mk     = format(mStart, 'yyyy-MM')
      
      const mRows  = histFlow.filter(r => {
        const d = new Date(r.entry_date || r.created_at)
        return d >= mStart && d <= mEnd
      })
      const totals = aggregateFlow(mRows)
      
      let startingPoolBeforeMonth = 0
      for(const hr of histFlow) {
        if (format(new Date(hr.entry_date || hr.created_at), 'yyyy-MM') < mk) {
           startingPoolBeforeMonth += (hr.type === 'CASH IN' ? parseFloat(hr.amount)||0 : -(parseFloat(hr.amount)||0))
        }
      }
      
      const allDays = eachDayOfInterval({ start: mStart, end: mEnd })
      const days = allDays.map(d => {
        const dStr = format(d, 'yyyy-MM-dd')
        const dRows = mRows.filter(r => {
          const rowDt = new Date(r.entry_date || r.created_at)
          return format(rowDt, 'yyyy-MM-dd') === dStr
        })
        return {
          label: format(d, 'MMM d (EEE)'),
          ...aggregateFlow(dRows),
        }
      }).filter(d => d.interest + d.principal + d.penalties + d.disbursed > 0)
      
      const netMonthFlow = totals.interest + totals.principal + totals.penalties + totals.topups - totals.disbursed - totals.expenses
      const finalMonthlyPoolBalance = startingPoolBeforeMonth + netMonthFlow
      
      months.push({ key: mk, label: format(mStart, 'MMMM yyyy'), ...totals, days, runningBalance: finalMonthlyPoolBalance })
    }
    return months
  }, [histFlow])

  const customTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 10, padding: '12px 16px', fontSize: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>{label}</div>
        {payload.map(p => <div key={p.name} style={{ color: p.color, marginBottom: 3 }}>{p.name}: {formatCurrency(p.value)}</div>)}
      </div>
    )
  }

  return (
    <div style={{ padding: '32px 28px', maxWidth: 1100, margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Financial Ledger</h1>
          <p className="page-subtitle">Track capital flow, interest, and running balances over time</p>
        </div>
      </div>

      <PeriodSelector
        preset={preset}           onPresetChange={handlePresetChange}
        customFrom={customFrom}   onCustomFromChange={handleCustomFromChange}
        customTo={customTo}       onCustomToChange={handleCustomToChange}
      />

      {loading ? (
        <div className="empty-state"><p>Loading ledger data...</p></div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', gap: 14, marginBottom: 24 }}>
            <StatCard label="Interest Collected" value={formatCurrency(curr.interest)} color="var(--green)"
              tooltip="Total pure profit/interest collected from borrowers during this period."
              delta={<DeltaBadge current={curr.interest} previous={prev.interest} />} />
            <StatCard label="Principal Returned" value={formatCurrency(curr.principal)} color="var(--blue)"
              tooltip="Total loan capital that safely returned home from borrowers. (Excludes your own capital top-ups)"
              delta={<DeltaBadge current={curr.principal} previous={prev.principal} />} />
            <StatCard label="Penalties Charged"  value={formatCurrency(curr.penalties)} color="var(--red)"
              tooltip="Total late fees/penalties collected from borrowers."
              delta={<DeltaBadge current={curr.penalties} previous={prev.penalties} invertColors />} />
            <StatCard label="Total Disbursed"    value={formatCurrency(curr.disbursed)} color="var(--gold)"
              tooltip="Total actual physical cash sent out to borrowers for new loans. (Excludes partner withdrawals)"
              delta={<DeltaBadge current={curr.disbursed} previous={prev.disbursed} />} />
            <StatCard label="Net Capital Flow"   value={formatCurrency(curr.net)} color={curr.net >= 0 ? 'var(--green)' : 'var(--red)'}
              tooltip="Your operations cash flow. Negative means you are lending out cash faster than it's coming back (which is healthy for growth!)."
              delta={<DeltaBadge current={curr.net} previous={prev.net} />} />
          </div>

          {monthly.length > 0 && (
            <div className="card" style={{ padding: '24px', marginBottom: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 20, color: 'var(--text-secondary)' }}>Monthly Capital Flow</div>
              <ResponsiveContainer width="100%" height={260}>
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
          )}

          {monthly.length > 0 && (
            <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 28 }}>
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
          )}

          {monthly.length === 0 && (
            <div className="empty-state" style={{ marginBottom: 28 }}>
              <TrendingUp size={40} /><h3>No capital flow in this period</h3>
              <p>Try selecting a wider range</p>
            </div>
          )}

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--card-border)', fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <History size={14} /> Monthly History — Last 6 Months
            </div>
            {monthlyHistory.map(m => (
              <div key={m.key}>
                <div
                  onClick={() => setExpanded(e => ({ ...e, [m.key]: !e[m.key] }))}
                  style={{ display: 'grid', gridTemplateColumns: '32px 1.5fr 1fr 1fr 1fr 1fr', padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)', alignItems: 'center', cursor: 'pointer', transition: 'background 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <div>{expanded[m.key] ? <ChevronDown size={14} color="var(--text-muted)" /> : <ChevronRight size={14} color="var(--text-muted)" />}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{m.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--green)' }}>{formatCurrency(m.interest)}</div>
                  <div style={{ fontSize: 12, color: m.penalties > 0 ? 'var(--red)' : 'var(--text-muted)' }}>{formatCurrency(m.penalties)}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{m.days.length} entries</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: m.net >= 0 ? 'var(--green)' : 'var(--red)' }}>{formatCurrency(m.net)}</div>
                </div>

                {expanded[m.key] && (
                  <div style={{ background: 'rgba(255,255,255,0.01)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '32px 1.5fr 1fr 1fr 1fr 1fr', padding: '8px 20px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      {['', 'Date', 'Interest', 'Principal', 'Penalties', 'Net'].map(h => (
                        <div key={h} style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{h}</div>
                      ))}
                    </div>
                    {m.days.length === 0 ? (
                      <div style={{ padding: '12px 20px 12px 52px', fontSize: 12, color: 'var(--text-muted)' }}>No entries this month</div>
                    ) : m.days.map((d, di) => (
                      <div key={di} style={{ display: 'grid', gridTemplateColumns: '32px 1.5fr 1fr 1fr 1fr 1fr', padding: '10px 20px', borderBottom: di < m.days.length - 1 ? '1px solid rgba(255,255,255,0.02)' : 'none', alignItems: 'center' }}>
                        <div />
                        <div style={{ fontSize: 12, color: 'var(--text-label)' }}>{d.label}</div>
                        <div style={{ fontSize: 12, color: 'var(--green)' }}>{formatCurrency(d.interest)}</div>
                        <div style={{ fontSize: 12, color: 'var(--blue)' }}>{formatCurrency(d.principal)}</div>
                        <div style={{ fontSize: 12, color: d.penalties > 0 ? 'var(--red)' : 'var(--text-muted)' }}>{formatCurrency(d.penalties)}</div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: d.net >= 0 ? 'var(--green)' : 'var(--red)' }}>{formatCurrency(d.net)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div style={{ display: 'grid', gridTemplateColumns: '32px 1.5fr 1fr 1fr 1fr 1fr', padding: '8px 20px', background: 'rgba(255,255,255,0.015)' }}>
              {['', 'Month', 'Interest', 'Penalties', 'Entries', 'Net Flow'].map(h => (
                <div key={h} style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{h}</div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
