import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { formatCurrency } from '../lib/helpers'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Legend
} from 'recharts'
import { TrendingUp, RefreshCw, Info } from 'lucide-react'

function CustomTooltip({ active, payload, label }) {
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
        <div key={i} style={{ color: p.color, fontWeight: 700, fontSize: 13 }}>
          {p.name}: {formatCurrency(p.value)}
        </div>
      ))}
    </div>
  )
}

function StatBox({ label, value, sub, color = 'var(--blue)', highlight }) {
  return (
    <div className="card" style={{
      padding: '18px 22px',
      background: highlight ? `${color}10` : undefined,
      border: highlight ? `1px solid ${color}30` : undefined
    }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 22, color, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

export default function ForecastPage() {
  const [settings, setSettings] = useState(null)
  const [loans, setLoans] = useState([])
  const [forecastTab, setForecastTab] = useState('installment')

  // Installment loan forecast inputs
  const [capital, setCapital] = useState(30000)
  const [rate, setRate] = useState(8)
  const [defaultRate, setDefaultRate] = useState(0)
  const [reinvest, setReinvest] = useState(true)

  // QuickLoan forecast inputs
  const [qlCapital, setQlCapital] = useState(10000)
  const [qlCyclesPerMonth, setQlCyclesPerMonth] = useState(2)
  const [qlDefaultRate, setQlDefaultRate] = useState(0)
  const [qlReinvest, setQlReinvest] = useState(true)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    const [{ data: s }, { data: l }] = await Promise.all([
      supabase.from('settings').select('*').eq('id', 1).single(),
      supabase.from('loans').select('*')
    ])
    setSettings(s)
    setLoans(l || [])
    if (s) {
      setCapital(s.starting_capital || 30000)
      setRate(Math.round((s.interest_rate || 0.07) * 100))
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Core calculation ───────────────────────────────────────
  // Only use Installment loans for forecast — QuickLoans have different math
  const installmentLoans = loans.filter(l => l.loan_type !== 'quickloan')
  const quickLoans = loans.filter(l => l.loan_type === 'quickloan')

  // Portfolio may contain 2-month (4 installments) and 3-month (6 installments) loans
  // Monthly rate stored in DB (e.g. 0.07 = 7%/month)
  // 2-month cycle earns: capital × rate × 2 (6 cycles/year)
  // 3-month cycle earns: capital × rate × 3 (4 cycles/year)
  // Per month equivalent: capital × rate (same regardless of term)
  const rateDecimal = rate / 100

  // Derive avg cycles/year from actual installment loan portfolio (default assumes 2-month)
  const avgCyclesPerYear = installmentLoans.length > 0
    ? installmentLoans.reduce((sum, l) => sum + (12 / (l.loan_term || 2)), 0) / installmentLoans.length
    : 6
  const avgTermMonths = installmentLoans.length > 0
    ? installmentLoans.reduce((sum, l) => sum + (l.loan_term || 2), 0) / installmentLoans.length
    : 2
  const defaultDecimal = defaultRate / 100
  const effectiveRate = rateDecimal * (1 - defaultDecimal)

  // Compute monthly projection with or without reinvestment
  const buildProjection = (months) => {
    const data = []
    let currentCapital = capital
    let totalProfit = 0
    // rate is monthly; profit per month = capital × effectiveRate
    const profitPerMonth = reinvest
      ? null // will recalculate each month
      : capital * effectiveRate

    for (let m = 1; m <= months; m++) {
      const monthProfit = reinvest
        ? currentCapital * effectiveRate
        : profitPerMonth
      totalProfit += monthProfit
      if (reinvest) currentCapital += monthProfit
      data.push({
        month: `Mo ${m}`,
        capital: Math.round(reinvest ? currentCapital : capital + totalProfit),
        profit: Math.round(totalProfit),
        monthly: Math.round(monthProfit)
      })
    }
    return data
  }

  const proj12 = buildProjection(12)
  const proj2   = proj12[1]
  const proj4   = proj12[3]
  const proj6   = proj12[5]
  const proj8   = proj12[7]
  const proj12end = proj12[11]

  // Break-even: how many months to double capital
  let breakEvenMonth = null
  for (let i = 0; i < proj12.length; i++) {
    if (proj12[i].profit >= capital) { breakEvenMonth = i + 1; break }
  }

  // Compounding table (yearly for 5 years)
  const yearlyTable = Array.from({ length: 5 }, (_, i) => {
    const yearData = buildProjection((i + 1) * 12)
    const end = yearData[yearData.length - 1]
    return {
      year: `Year ${i + 1}`,
      capital: end.capital,
      profit: end.profit,
      roi: ((end.profit / capital) * 100).toFixed(1)
    }
  })

  // Real data comparison
  const realProfit = installmentLoans.filter(l => l.status === 'Paid').reduce((sum, l) => sum + ((l.total_repayment || 0) - (l.loan_amount || 0)), 0)

  // ── QuickLoan forecast ─────────────────────────────────────
  // QuickLoan: 10%/month = ₱10/day per ₱3,000
  // Assumes capital is deployed in ₱3,000 chunks, each cycling every ~15 days
  // qlCyclesPerMonth = how many full cycles per month (default 2 = every 15 days)
  const qlRatePerCycle = 0.10 / 2 // 5% per 15-day cycle (half of monthly 10%)
  const qlDefaultDecimal = qlDefaultRate / 100
  const qlEffectiveRate = qlRatePerCycle * (1 - qlDefaultDecimal)

  const buildQlProjection = (months) => {
    const data = []
    let currentCapital = qlCapital
    let totalProfit = 0
    for (let m = 1; m <= months; m++) {
      const cycleProfit = currentCapital * qlEffectiveRate * qlCyclesPerMonth
      totalProfit += cycleProfit
      if (qlReinvest) currentCapital += cycleProfit
      data.push({
        month: `Mo ${m}`,
        capital: Math.round(qlReinvest ? currentCapital : qlCapital + totalProfit),
        profit: Math.round(totalProfit),
        monthly: Math.round(cycleProfit)
      })
    }
    return data
  }

  const qlProj12 = buildQlProjection(12)
  const qlProj12end = qlProj12[11]
  const qlRealProfit = quickLoans.filter(l => l.status === 'Paid').reduce((sum, l) => sum + ((l.total_repayment || 0) - (l.loan_amount || 0)), 0)

  const qlYearlyTable = Array.from({ length: 5 }, (_, i) => {
    const yearData = buildQlProjection((i + 1) * 12)
    const end = yearData[yearData.length - 1]
    return { year: `Year ${i + 1}`, capital: end.capital, profit: end.profit, roi: ((end.profit / qlCapital) * 100).toFixed(1) }
  })

  if (loading) return (
    <div style={{ padding: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div style={{ color: 'var(--text-muted)' }}>Loading forecast...</div>
    </div>
  )

  return (
    <div style={{ padding: '32px 28px', maxWidth: 1000, margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Profit Forecast</h1>
          <p className="page-subtitle">Simulate growth based on your lending parameters</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Tab toggle */}
          <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 4 }}>
            {[
              { key: 'installment', label: '📅 Installment' },
              { key: 'quickloan',   label: '⚡ QuickLoan' },
            ].map(tab => (
              <button key={tab.key} onClick={() => setForecastTab(tab.key)}
                style={{
                  padding: '7px 16px', borderRadius: 9, border: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: 600, transition: 'all 0.15s ease',
                  background: forecastTab === tab.key
                    ? tab.key === 'quickloan' ? 'rgba(245,158,11,0.2)' : 'rgba(59,130,246,0.2)'
                    : 'transparent',
                  color: forecastTab === tab.key
                    ? tab.key === 'quickloan' ? '#F59E0B' : 'var(--blue)'
                    : 'var(--text-muted)',
                }}>
                {tab.label}
              </button>
            ))}
          </div>
          <button onClick={fetchData} className="btn-edit" style={{ gap: 6 }}>
            <RefreshCw size={14} /> Reset
          </button>
        </div>
      </div>

      {/* ── INSTALLMENT LOAN FORECAST ── */}
      {forecastTab === 'installment' && (
        <div>
          <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 10, padding: '12px 18px', marginBottom: 24, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <Info size={15} color="var(--blue)" style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 13, color: 'var(--text-label)', margin: 0 }}>
              Forecast is <strong>independent</strong> from the dashboard. Adjust sliders to simulate scenarios. Only Installment Loans are included here — QuickLoan has its own tab.
            </p>
          </div>

          <div className="card" style={{ padding: '22px 24px', marginBottom: 24 }}>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 15, marginBottom: 18 }}><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><img src="/calculator.png" alt="calculator" style={{ width: 18, height: 18, objectFit: 'contain' }} />Simulation Parameters</div></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 20 }}>
              <div className="form-group">
                <label className="form-label">Starting Capital (₱)</label>
                <input type="number" min="1000" step="1000" value={capital} onChange={e => setCapital(parseFloat(e.target.value) || 0)} />
              </div>
              <div className="form-group">
                <label className="form-label">Interest Rate (%)</label>
                <input type="number" min="1" max="50" step="1" value={rate} onChange={e => setRate(parseFloat(e.target.value) || 0)} />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Monthly rate per borrower</div>
              </div>
              <div className="form-group">
                <label className="form-label">Default Rate (%)</label>
                <input type="number" min="0" max="100" step="1" value={defaultRate} onChange={e => setDefaultRate(parseFloat(e.target.value) || 0)} />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Estimated bad loans</div>
              </div>
              <div>
                <label className="form-label">Reinvestment</label>
                <div onClick={() => setReinvest(!reinvest)} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginTop: 8, padding: '10px 14px', background: reinvest ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.03)', border: `1px solid ${reinvest ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.1)'}`, borderRadius: 8, transition: 'all 0.15s ease' }}>
                  <div style={{ width: 36, height: 20, borderRadius: 10, background: reinvest ? 'var(--green)' : 'rgba(255,255,255,0.1)', position: 'relative', transition: 'all 0.2s ease', flexShrink: 0 }}>
                    <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: reinvest ? 19 : 3, transition: 'left 0.2s ease' }} />
                  </div>
                  <span style={{ fontSize: 13, color: reinvest ? 'var(--green)' : 'var(--text-muted)', fontWeight: 500 }}>{reinvest ? 'Reinvesting profits' : 'No reinvestment'}</span>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 24 }}>
            <StatBox label="2-Month Profit"  value={formatCurrency(proj2?.profit)}     sub={`Capital: ${formatCurrency(proj2?.capital)}`}     color="var(--blue)"   />
            <StatBox label="4-Month Profit"  value={formatCurrency(proj4?.profit)}     sub={`Capital: ${formatCurrency(proj4?.capital)}`}     color="var(--teal)"   />
            <StatBox label="6-Month Profit"  value={formatCurrency(proj6?.profit)}     sub={`Capital: ${formatCurrency(proj6?.capital)}`}     color="var(--purple)" />
            <StatBox label="8-Month Profit"  value={formatCurrency(proj8?.profit)}     sub={`Capital: ${formatCurrency(proj8?.capital)}`}     color="var(--gold)"   />
            <StatBox label="12-Month Profit" value={formatCurrency(proj12end?.profit)} sub={`Capital: ${formatCurrency(proj12end?.capital)}`} color="var(--green)"  highlight />
            <StatBox label="Monthly Average" value={formatCurrency(proj12end?.profit / 12)} sub="Avg profit/month" color="var(--teal)" />
            <StatBox label="Actual Profit"   value={formatCurrency(realProfit)}        sub="From real paid loans"                            color="var(--gold)"   />
          </div>

          {breakEvenMonth && (
            <div style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 10, padding: '14px 20px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
              <img src="/calculator.png" alt="calculator" style={{ width: 24, height: 24, objectFit: 'contain' }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>Capital Doubles in Month {breakEvenMonth}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>With {reinvest ? 'reinvestment' : 'no reinvestment'} at {rate}% rate and {defaultRate}% default rate</div>
              </div>
            </div>
          )}

          <div className="card" style={{ padding: '22px 24px', marginBottom: 24 }}>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 15, marginBottom: 18 }}>📈 12-Month Growth Projection</div>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={proj12}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `₱${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-label)', paddingTop: 12 }} />
                <ReferenceLine y={capital} stroke="rgba(255,255,255,0.1)" strokeDasharray="4 4" label={{ value: 'Starting Capital', fill: 'var(--text-muted)', fontSize: 11 }} />
                <Line type="monotone" dataKey="capital" name="Total Capital" stroke="var(--teal)" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="profit" name="Cumulative Profit" stroke="var(--green)" strokeWidth={2} dot={false} activeDot={{ r: 5 }} strokeDasharray="5 3" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="card" style={{ padding: '22px 24px', marginBottom: 24 }}>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 15, marginBottom: 18 }}><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><img src="/summary-check.png" alt="" style={{ width: 16, height: 16, objectFit: 'contain' }} />5-Year Compounding Table</div></div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead><tr>{['Year', 'Total Capital', 'Cumulative Profit', 'ROI'].map(h => <th key={h} style={{ textAlign: 'left', padding: '10px 16px', borderBottom: '1px solid var(--card-border)', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{h}</th>)}</tr></thead>
                <tbody>
                  {yearlyTable.map((row, i) => (
                    <tr key={row.year} style={{ borderBottom: i < 4 ? '1px solid rgba(255,255,255,0.03)' : 'none' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.015)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: '13px 16px', fontFamily: 'Space Grotesk', fontWeight: 700 }}>{row.year}</td>
                      <td style={{ padding: '13px 16px', color: 'var(--teal)', fontWeight: 600 }}>{formatCurrency(row.capital)}</td>
                      <td style={{ padding: '13px 16px', color: 'var(--green)', fontWeight: 600 }}>{formatCurrency(row.profit)}</td>
                      <td style={{ padding: '13px 16px' }}><span style={{ color: parseFloat(row.roi) >= 100 ? 'var(--gold)' : 'var(--text-primary)', fontWeight: 700 }}>{row.roi}%</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card" style={{ padding: '22px 24px' }}>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 15, marginBottom: 16 }}><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><img src="/summary-check.png" alt="" style={{ width: 16, height: 16, objectFit: 'contain' }} />Break-Even Analysis</div></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
              {[
                { label: 'Months to break even', value: breakEvenMonth ? `${breakEvenMonth} months` : '>12 months', color: 'var(--blue)' },
                { label: 'Profit per avg loan cycle', value: formatCurrency(capital * effectiveRate * avgTermMonths), color: 'var(--green)' },
                { label: 'Avg cycles per year', value: `~${Math.round(avgCyclesPerYear)}`, sub: `${avgTermMonths.toFixed(1)}-mo avg term`, color: 'var(--purple)' },
                { label: 'Effective annual yield', value: `${(effectiveRate * 12 * 100).toFixed(1)}%`, color: 'var(--teal)' },
              ].map(item => (
                <div key={item.label} style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--card-border)', borderRadius: 10 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.label}</div>
                  <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 20, color: item.color }}>{item.value}</div>
                  {item.sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{item.sub}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── QUICKLOAN FORECAST ── */}
      {forecastTab === 'quickloan' && (
        <div>
          <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, padding: '12px 18px', marginBottom: 24, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <Info size={15} color="#F59E0B" style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 13, color: 'var(--text-label)', margin: 0 }}>
              QuickLoan earns <strong>10%/month</strong> via daily interest (₱10/day per ₱3,000). Each cycle is ~15 days. Capital deployed twice a month earns ~5% per cycle. Penalty income is not modeled here.
            </p>
          </div>

          {/* QuickLoan controls */}
          <div className="card" style={{ padding: '22px 24px', marginBottom: 24, borderColor: 'rgba(245,158,11,0.2)' }}>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 15, marginBottom: 18 }}>⚡ QuickLoan Parameters</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 20 }}>
              <div className="form-group">
                <label className="form-label">Capital Deployed (₱)</label>
                <input type="number" min="1000" step="500" value={qlCapital} onChange={e => setQlCapital(parseFloat(e.target.value) || 0)} />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Max ₱3,000 per borrower</div>
              </div>
              <div className="form-group">
                <label className="form-label">Cycles per Month</label>
                <input type="number" min="1" max="4" step="1" value={qlCyclesPerMonth} onChange={e => setQlCyclesPerMonth(parseFloat(e.target.value) || 1)} />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>2 = every 15 days (default)</div>
              </div>
              <div className="form-group">
                <label className="form-label">Default Rate (%)</label>
                <input type="number" min="0" max="100" step="1" value={qlDefaultRate} onChange={e => setQlDefaultRate(parseFloat(e.target.value) || 0)} />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Estimated bad loans</div>
              </div>
              <div>
                <label className="form-label">Reinvestment</label>
                <div onClick={() => setQlReinvest(!qlReinvest)} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginTop: 8, padding: '10px 14px', background: qlReinvest ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.03)', border: `1px solid ${qlReinvest ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.1)'}`, borderRadius: 8, transition: 'all 0.15s ease' }}>
                  <div style={{ width: 36, height: 20, borderRadius: 10, background: qlReinvest ? '#F59E0B' : 'rgba(255,255,255,0.1)', position: 'relative', transition: 'all 0.2s ease', flexShrink: 0 }}>
                    <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: qlReinvest ? 19 : 3, transition: 'left 0.2s ease' }} />
                  </div>
                  <span style={{ fontSize: 13, color: qlReinvest ? '#F59E0B' : 'var(--text-muted)', fontWeight: 500 }}>
                    {qlReinvest ? 'Reinvesting profits' : 'No reinvestment'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* QuickLoan summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 24 }}>
            {[
              { label: 'Per Cycle (15 days)', value: formatCurrency(qlCapital * qlEffectiveRate), color: '#F59E0B' },
              { label: 'Per Month', value: formatCurrency(qlCapital * qlEffectiveRate * qlCyclesPerMonth), color: '#F59E0B' },
              { label: '3-Month Profit', value: formatCurrency(qlProj12[2]?.profit), sub: `Capital: ${formatCurrency(qlProj12[2]?.capital)}`, color: 'var(--blue)' },
              { label: '6-Month Profit', value: formatCurrency(qlProj12[5]?.profit), sub: `Capital: ${formatCurrency(qlProj12[5]?.capital)}`, color: 'var(--purple)' },
              { label: '12-Month Profit', value: formatCurrency(qlProj12end?.profit), sub: `Capital: ${formatCurrency(qlProj12end?.capital)}`, color: 'var(--green)', highlight: true },
              { label: 'Actual QL Earned', value: formatCurrency(qlRealProfit), sub: 'From real paid QuickLoans', color: 'var(--gold)' },
            ].map(s => (
              <StatBox key={s.label} label={s.label} value={s.value} sub={s.sub} color={s.color} highlight={s.highlight} />
            ))}
          </div>

          {/* QuickLoan growth chart */}
          <div className="card" style={{ padding: '22px 24px', marginBottom: 24, borderColor: 'rgba(245,158,11,0.15)' }}>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 15, marginBottom: 18 }}>⚡ 12-Month QuickLoan Growth</div>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={qlProj12}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `₱${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-label)', paddingTop: 12 }} />
                <ReferenceLine y={qlCapital} stroke="rgba(245,158,11,0.2)" strokeDasharray="4 4" label={{ value: 'Starting Capital', fill: 'var(--text-muted)', fontSize: 11 }} />
                <Line type="monotone" dataKey="capital" name="Total Capital" stroke="#F59E0B" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="profit" name="Cumulative Profit" stroke="var(--green)" strokeWidth={2} dot={false} activeDot={{ r: 5 }} strokeDasharray="5 3" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* QuickLoan 5-year table */}
          <div className="card" style={{ padding: '22px 24px', borderColor: 'rgba(245,158,11,0.1)' }}>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 15, marginBottom: 18 }}>5-Year QuickLoan Compounding</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead><tr>{['Year', 'Total Capital', 'Cumulative Profit', 'ROI'].map(h => <th key={h} style={{ textAlign: 'left', padding: '10px 16px', borderBottom: '1px solid var(--card-border)', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{h}</th>)}</tr></thead>
                <tbody>
                  {qlYearlyTable.map((row, i) => (
                    <tr key={row.year} style={{ borderBottom: i < 4 ? '1px solid rgba(255,255,255,0.03)' : 'none' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.015)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: '13px 16px', fontFamily: 'Space Grotesk', fontWeight: 700 }}>{row.year}</td>
                      <td style={{ padding: '13px 16px', color: '#F59E0B', fontWeight: 600 }}>{formatCurrency(row.capital)}</td>
                      <td style={{ padding: '13px 16px', color: 'var(--green)', fontWeight: 600 }}>{formatCurrency(row.profit)}</td>
                      <td style={{ padding: '13px 16px' }}><span style={{ color: parseFloat(row.roi) >= 100 ? 'var(--gold)' : 'var(--text-primary)', fontWeight: 700 }}>{row.roi}%</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

