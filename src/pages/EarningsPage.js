import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { formatCurrency } from '../lib/helpers'
import {
  startOfMonth, endOfMonth, subMonths, format
} from 'date-fns'
import {
  Calendar, ArrowUp, ArrowDown, DollarSign
} from 'lucide-react'
import {
  Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, ComposedChart, Line
} from 'recharts'

// ── Shared Helpers ────────────────────────────────────────────────
const PRESETS = [
  { key: 'this_month',  label: 'This Month'    },
  { key: 'last_month',  label: 'Last Month'    },
  { key: 'last_3',      label: 'Last 3 Months' },
  { key: 'last_6',      label: 'Last 6 Months' },
  { key: 'custom',      label: 'Custom Range'  },
]

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

// ── Shared UI ────────────────────────────────────────────────────
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

// ── Earnings Logic ──────────────────────────────────────────────
// Capital constants — set to 0 since ALL contributions are tracked via capital_flow ledger
// JP: "Capital Top-up (JP)" entries = ₱10,200
// Charlou: "Initial Pool (Installment)" + "Capital Top-up (Charlou)" entries = ₱37,525
const JP_INITIAL      = 0
const CHARLOU_INITIAL = 0

function calcPartnerCapital(rows) {
  let jp      = JP_INITIAL
  let charlou = CHARLOU_INITIAL
  for (const r of rows) {
    const cat = r.category || ''
    const amt = parseFloat(r.amount) || 0
    if (r.type === 'CASH IN') {
      if (cat === 'Capital Top-up (JP)')      jp      += amt
      // Initial Pool entries are Charlou's original capital investment
      if (cat === 'Capital Top-up (Charlou)' || cat === 'Initial Pool (Installment)' || cat === 'Initial Pool (QuickLoan)') charlou += amt
    } else {
      if (cat === 'Partner Withdrawal (JP)')      jp      -= amt
      if (cat === 'Partner Withdrawal (Charlou)') charlou -= amt
    }
  }
  return { jp: Math.max(0, jp), charlou: Math.max(0, charlou) }
}


export default function EarningsPage() {
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

  const [allFlow,    setAllFlow]    = useState([])
  const [periodFlow, setPeriodFlow] = useState([])
  const [prevFlow,   setPrevFlow]   = useState([])
  const [histFlow,   setHistFlow]   = useState([])
  const [loading,    setLoading]    = useState(true)

  useEffect(() => {
    setLoading(true)
    const prevRange = getPrevRange(dateRange)
    const histStart = startOfMonth(subMonths(new Date(), 5))
    const histEnd   = endOfMonth(new Date())

    Promise.all([
      supabase.from('capital_flow').select('amount, category, type, entry_date'),
      supabase.from('capital_flow').select('amount, category, type, entry_date')
        .gte('entry_date', format(dateRange.start, 'yyyy-MM-dd'))
        .lte('entry_date', format(dateRange.end,   'yyyy-MM-dd')),
      supabase.from('capital_flow').select('amount, category, type, entry_date')
        .gte('entry_date', format(prevRange.start, 'yyyy-MM-dd'))
        .lte('entry_date', format(prevRange.end,   'yyyy-MM-dd')),
      supabase.from('capital_flow').select('amount, category, type, entry_date')
        .gte('entry_date', format(histStart, 'yyyy-MM-dd'))
        .lte('entry_date', format(histEnd,   'yyyy-MM-dd')),
    ]).then(([af, pf, pvf, hf]) => {
      setAllFlow(af.data    || [])
      setPeriodFlow(pf.data || [])
      setPrevFlow(pvf.data  || [])
      setHistFlow(hf.data   || [])
      setLoading(false)
    })
  }, [dateRange])

  const sumInterest  = (rows) => rows.reduce((s, r) => s + ((r.category || '').toLowerCase().includes('interest profit') ? parseFloat(r.amount) || 0 : 0), 0)
  const sumCapital   = (rows) => rows.reduce((s, r) => s + (((r.category || '').toLowerCase().includes('initial pool') || (r.category || '').toLowerCase().includes('capital top-up')) ? parseFloat(r.amount) || 0 : 0), 0)
  const sumPenalties = (rows) => rows.reduce((s, r) => s + ((r.category || '').toLowerCase().includes('penalty') ? parseFloat(r.amount) || 0 : 0), 0)
  const sumRebates   = (rows) => rows.reduce((s, r) => s + (((r.category || '').toLowerCase() === 'rebate issued' && r.type === 'CASH OUT') ? parseFloat(r.amount) || 0 : 0), 0)

  const atInterest  = sumInterest(allFlow)
  const atCapital   = sumCapital(allFlow)
  const atPenalties = sumPenalties(allFlow)
  const atRebates   = sumRebates(allFlow)
  const atNet       = atInterest + atPenalties - atRebates

  const perInterest  = sumInterest(periodFlow)
  const perPenalties = sumPenalties(periodFlow)
  const perRebates   = sumRebates(periodFlow)
  const perNet       = perInterest + perPenalties - perRebates

  const prevInterest  = sumInterest(prevFlow)
  const prevPenalties = sumPenalties(prevFlow)
  const prevRebates   = sumRebates(prevFlow)
  const prevNet       = prevInterest + prevPenalties - prevRebates

  const monthlyEarnings = useMemo(() => {
    const months = []
    for (let i = 5; i >= 0; i--) {
      const mStart    = startOfMonth(subMonths(new Date(), i))
      const mEnd      = endOfMonth(subMonths(new Date(), i))
      const mLabel    = format(mStart, 'MMM yyyy')
      const mFlowRows = histFlow.filter(r => { const d = new Date(r.entry_date); return d >= mStart && d <= mEnd })
      const interest  = sumInterest(mFlowRows)
      const penalties = sumPenalties(mFlowRows)
      const rebates   = sumRebates(mFlowRows)
      const topups    = sumCapital(mFlowRows)
      months.push({ label: mLabel, interest, penalties, rebates, income: interest + penalties - rebates, topups })
    }
    let running = 0
    return months.map(m => { running += m.income; return { ...m, cumulative: running } })
  }, [histFlow])

  const customTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 10, padding: '12px 16px', fontSize: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>{label}</div>
        {payload.map(p => <div key={p.name} style={{ color: p.color || 'var(--text-label)', marginBottom: 3 }}>{p.name}: {formatCurrency(p.value)}</div>)}
      </div>
    )
  }

  return (
    <div style={{ padding: '32px 28px', maxWidth: 1100, margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Earnings Report</h1>
          <p className="page-subtitle">Track incoming interest, penalties, and overall fund health</p>
        </div>
      </div>

      <PeriodSelector
        preset={preset}           onPresetChange={handlePresetChange}
        customFrom={customFrom}   onCustomFromChange={handleCustomFromChange}
        customTo={customTo}       onCustomToChange={handleCustomToChange}
      />

      {loading ? (
        <div className="empty-state"><p>Loading earnings data...</p></div>
      ) : (
        <>
          {/* 1. All-time KPI strip */}
          <div style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 10 }}>📊 All-Time Totals (no date filter)</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', gap: 14, marginBottom: 24 }}>
              <StatCard label="Total Interest Earned"    value={formatCurrency(atInterest)}  color="var(--green)" />
              <StatCard label="Penalties Collected"      value={formatCurrency(atPenalties)} color="var(--red)"   />
              <StatCard label="Rebates Paid Out"         value={`-${formatCurrency(atRebates)}`} color="var(--blue-light)" />
              <StatCard label="Capital in Pool"          value={formatCurrency(atCapital)}   color="var(--blue)"  />
              <StatCard label="Net Earnings (All-Time)"  value={formatCurrency(atNet)}       color="var(--teal)"  />
            </div>
          </div>

          {/* 2. Period earnings with delta */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 10 }}>📅 Selected Period</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', gap: 14 }}>
              <StatCard label="Interest Earned" value={formatCurrency(perInterest)}  color="var(--green)" delta={<DeltaBadge current={perInterest}  previous={prevInterest}  />} />
              <StatCard label="Penalties"       value={formatCurrency(perPenalties)} color="var(--red)"   delta={<DeltaBadge current={perPenalties} previous={prevPenalties} invertColors />} />
              <StatCard label="Rebates Paid Out" value={`-${formatCurrency(perRebates)}`} color="var(--blue-light)" delta={<DeltaBadge current={perRebates} previous={prevRebates} invertColors />} />
              <StatCard label="Net Earnings"    value={formatCurrency(perNet)}       color="var(--teal)"  delta={<DeltaBadge current={perNet}       previous={prevNet}       />} />
            </div>
          </div>

          {/* 4. Earnings growth chart */}
          {monthlyEarnings.length > 0 && (
            <div className="card" style={{ padding: '24px', marginBottom: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 20, color: 'var(--text-secondary)' }}>Earnings Growth — Last 6 Months</div>
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={monthlyEarnings} margin={{ top: 5, right: 50, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                  <YAxis yAxisId="left"  tickFormatter={v => `₱${(v/1000).toFixed(0)}k`} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                  <YAxis yAxisId="right" orientation="right" tickFormatter={v => `₱${(v/1000).toFixed(0)}k`} tick={{ fill: '#2DD4BF', fontSize: 11 }} />
                  <Tooltip content={customTooltip} />
                  <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-muted)' }} />
                  <Bar  yAxisId="left"  dataKey="interest"   name="Interest Earned" fill="#22C55E" radius={[3,3,0,0]} />
                  <Bar  yAxisId="left"  dataKey="penalties"  name="Penalties"       fill="#F59E0B" radius={[3,3,0,0]} />
                  <Line yAxisId="right" type="monotone" dataKey="cumulative" name="Cumulative Total" stroke="#2DD4BF" strokeWidth={2} dot={{ fill: '#2DD4BF', r: 4 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* 3. Month-by-month table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 28 }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--card-border)', fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>Month-by-Month Breakdown — Last 6 Months</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1fr 1.2fr', padding: '10px 20px', borderBottom: '1px solid var(--card-border)', background: 'rgba(255,255,255,0.015)' }}>
              {['Month', 'Interest', 'Penalties', 'Rebates', 'Net Earnings', 'Capital Top-ups', 'Running Total'].map(h => (
                <div key={h} style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{h}</div>
              ))}
            </div>
            {monthlyEarnings.map((m, i) => {
              const isLast = i === monthlyEarnings.length - 1
              return (
                <div key={m.label} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1fr 1.2fr', padding: '13px 20px', borderBottom: i < monthlyEarnings.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', alignItems: 'center', background: isLast ? 'rgba(255,255,255,0.02)' : 'transparent' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.015)'}
                  onMouseLeave={e => e.currentTarget.style.background = isLast ? 'rgba(255,255,255,0.02)' : 'transparent'}>
                  <div style={{ fontSize: 13, fontWeight: isLast ? 800 : 600, color: 'var(--text-primary)' }}>{m.label}</div>
                  <div style={{ fontSize: 13, fontWeight: isLast ? 700 : 400, color: 'var(--green)' }}>{formatCurrency(m.interest)}</div>
                  <div style={{ fontSize: 13, fontWeight: isLast ? 700 : 400, color: m.penalties > 0 ? 'var(--red)' : 'var(--text-muted)' }}>{formatCurrency(m.penalties)}</div>
                  <div style={{ fontSize: 13, fontWeight: isLast ? 700 : 400, color: m.rebates > 0 ? 'var(--blue-light)' : 'var(--text-muted)' }}>{m.rebates > 0 ? `-${formatCurrency(m.rebates)}` : formatCurrency(0)}</div>
                  <div style={{ fontSize: 13, fontWeight: isLast ? 700 : 400, color: 'var(--text-primary)' }}>{formatCurrency(m.income)}</div>
                  <div style={{ fontSize: 13, color: m.topups > 0 ? 'var(--blue)' : 'var(--text-muted)' }}>{formatCurrency(m.topups)}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--green)' }}>{formatCurrency(m.cumulative)}</div>
                </div>
              )
            })}
            {monthlyEarnings.length > 0 && (() => {
              const totInt = monthlyEarnings.reduce((s, m) => s + m.interest, 0)
              const totPen = monthlyEarnings.reduce((s, m) => s + m.penalties, 0)
              const totReb = monthlyEarnings.reduce((s, m) => s + m.rebates, 0)
              const totInc = monthlyEarnings.reduce((s, m) => s + m.income, 0)
              const totTop = monthlyEarnings.reduce((s, m) => s + m.topups, 0)
              const lastCu = monthlyEarnings[monthlyEarnings.length - 1]?.cumulative || 0
              return (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1fr 1.2fr', padding: '14px 20px', background: 'rgba(255,255,255,0.04)', borderTop: '2px solid var(--card-border)' }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>6-Month Total</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--green)' }}>{formatCurrency(totInt)}</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--red)' }}>{formatCurrency(totPen)}</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--blue-light)' }}>{totReb > 0 ? `-${formatCurrency(totReb)}` : formatCurrency(0)}</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>{formatCurrency(totInc)}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--blue)' }}>{formatCurrency(totTop)}</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--green)' }}>{formatCurrency(lastCu)}</div>
                </div>
              )
            })()}
          </div>

          {/* 5. Partner earnings split — fixed 50/50, capital from capital_flow */}
          {(() => {
            const { jp: jpCap, charlou: charlouCap } = calcPartnerCapital(allFlow)
            const share    = atNet * 0.50
            const partners = [
              { key: 'jp',      name: 'JP',      capital: jpCap,      color: 'var(--purple)' },
              { key: 'charlou', name: 'Charlou', capital: charlouCap, color: 'var(--teal)'   },
            ]
            return (
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 14 }}>🤝 Partner Earnings Split (All-Time · Fixed 50/50)</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  {partners.map(p => {
                    const roi = p.capital > 0 ? (share / p.capital) * 100 : 0
                    return (
                      <div key={p.key} className="card" style={{ padding: '24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 22, color: p.color }}>{p.name}</div>
                          <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', fontWeight: 600 }}>50% share</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Capital in Pool</div>
                            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--blue)' }}>{formatCurrency(p.capital)}</div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>Live from capital_flow · info only</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Earnings Share</div>
                            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--green)' }}>{formatCurrency(share)}</div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>Net Earnings × 50%</div>
                          </div>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>ROI on Capital</div>
                            <div style={{ fontSize: 22, fontWeight: 800, color: roi >= 0 ? 'var(--green)' : 'var(--red)' }}>{roi.toFixed(1)}%</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Profit split</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)' }}>50/50 Split</div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}
        </>
      )}
    </div>
  )
}
