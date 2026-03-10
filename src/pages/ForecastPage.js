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
    <div style={{ background: '#1E2640', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '10px 14px', fontSize: 13, fontFamily: 'DM Sans, sans-serif', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
      <div style={{ color: '#7A8AAA', marginBottom: 6, fontSize: 12 }}>{label}</div>
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

  // Forecast inputs — independent from dashboard
  const [capital, setCapital] = useState(30000)
  const [rate, setRate] = useState(8)
  const [defaultRate, setDefaultRate] = useState(0)
  const [reinvest, setReinvest] = useState(true)
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
      setRate(Math.round((s.interest_rate || 0.08) * 100))
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Core calculation ───────────────────────────────────────
  // 26 pay periods/year → 13 loan cycles/year (each loan = 2 cutoffs release + 4 cutoffs repay = ~2 months)
  // Each cycle: capital * rate * (1 - defaultRate)
  const rateDecimal = rate / 100
  const defaultDecimal = defaultRate / 100
  const effectiveRate = rateDecimal * (1 - defaultDecimal)

  // Compute monthly projection with or without reinvestment
  const buildProjection = (months) => {
    const data = []
    let currentCapital = capital
    let totalProfit = 0
    // ~2 months per loan cycle (released on cutoff, 4 installments = 2 months)
    // So per month we get roughly 0.5 cycle worth of returns
    const profitPerMonth = reinvest
      ? null // will recalculate each month
      : capital * effectiveRate / 2

    for (let m = 1; m <= months; m++) {
      const monthProfit = reinvest
        ? currentCapital * effectiveRate / 2
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
  const proj3 = proj12[2]
  const proj6 = proj12[5]
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
  const realProfit = loans.filter(l => l.status === 'Paid').reduce((sum, l) => sum + ((l.total_repayment || 0) - (l.loan_amount || 0)), 0)

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
        <button onClick={fetchData} className="btn-edit" style={{ gap: 6 }}>
          <RefreshCw size={14} /> Reset to Actuals
        </button>
      </div>

      {/* Info banner */}
      <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 10, padding: '12px 18px', marginBottom: 24, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <Info size={15} color="var(--blue)" style={{ flexShrink: 0, marginTop: 1 }} />
        <p style={{ fontSize: 13, color: 'var(--text-label)', margin: 0 }}>
          Forecast capital is <strong>independent</strong> from the dashboard. Adjust the sliders below to simulate different scenarios without affecting your live data.
        </p>
      </div>

      {/* Forecast Controls */}
      <div className="card" style={{ padding: '22px 24px', marginBottom: 24 }}>
        <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 15, marginBottom: 18 }}>⚙️ Simulation Parameters</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 20 }}>
          <div className="form-group">
            <label className="form-label">Starting Capital (₱)</label>
            <input type="number" min="1000" step="1000" value={capital} onChange={e => setCapital(parseFloat(e.target.value) || 0)} />
          </div>
          <div className="form-group">
            <label className="form-label">Interest Rate (%)</label>
            <input type="number" min="1" max="50" step="1" value={rate} onChange={e => setRate(parseFloat(e.target.value) || 0)} />
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Flat rate per loan</div>
          </div>
          <div className="form-group">
            <label className="form-label">Default Rate (%)</label>
            <input type="number" min="0" max="100" step="1" value={defaultRate} onChange={e => setDefaultRate(parseFloat(e.target.value) || 0)} />
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Estimated bad loans</div>
          </div>
          <div>
            <label className="form-label">Reinvestment</label>
            <div
              onClick={() => setReinvest(!reinvest)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                marginTop: 8, padding: '10px 14px',
                background: reinvest ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${reinvest ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.1)'}`,
                borderRadius: 8, transition: 'all 0.15s ease'
              }}
            >
              <div style={{
                width: 36, height: 20, borderRadius: 10,
                background: reinvest ? 'var(--green)' : 'rgba(255,255,255,0.1)',
                position: 'relative', transition: 'all 0.2s ease', flexShrink: 0
              }}>
                <div style={{
                  width: 14, height: 14, borderRadius: '50%', background: '#fff',
                  position: 'absolute', top: 3,
                  left: reinvest ? 19 : 3,
                  transition: 'left 0.2s ease'
                }} />
              </div>
              <span style={{ fontSize: 13, color: reinvest ? 'var(--green)' : 'var(--text-muted)', fontWeight: 500 }}>
                {reinvest ? 'Reinvesting profits' : 'No reinvestment'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 24 }}>
        <StatBox label="3-Month Profit" value={formatCurrency(proj3?.profit)} sub={`Capital: ${formatCurrency(proj3?.capital)}`} color="var(--blue)" />
        <StatBox label="6-Month Profit" value={formatCurrency(proj6?.profit)} sub={`Capital: ${formatCurrency(proj6?.capital)}`} color="var(--purple)" />
        <StatBox label="12-Month Profit" value={formatCurrency(proj12end?.profit)} sub={`Capital: ${formatCurrency(proj12end?.capital)}`} color="var(--green)" highlight />
        <StatBox label="Monthly Average" value={formatCurrency(proj12end?.profit / 12)} sub="Avg profit/month" color="var(--teal)" />
        <StatBox label="Actual Profit" value={formatCurrency(realProfit)} sub="From real paid loans" color="var(--gold)" />
      </div>

      {/* Break-even */}
      {breakEvenMonth && (
        <div style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 10, padding: '14px 20px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 20 }}>🎯</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Capital Doubles in Month {breakEvenMonth}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              With {reinvest ? 'reinvestment' : 'no reinvestment'} at {rate}% rate and {defaultRate}% default rate
            </div>
          </div>
        </div>
      )}

      {/* Growth Chart */}
      <div className="card" style={{ padding: '22px 24px', marginBottom: 24 }}>
        <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 15, marginBottom: 18 }}>📈 12-Month Growth Projection</div>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={proj12}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
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

      {/* Compounding Table */}
      <div className="card" style={{ padding: '22px 24px', marginBottom: 24 }}>
        <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 15, marginBottom: 18 }}>📊 5-Year Compounding Table</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr>
                {['Year', 'Total Capital', 'Cumulative Profit', 'ROI'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 16px', borderBottom: '1px solid var(--card-border)', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {yearlyTable.map((row, i) => (
                <tr key={row.year} style={{ borderBottom: i < 4 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.015)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '13px 16px', fontFamily: 'Space Grotesk', fontWeight: 700 }}>{row.year}</td>
                  <td style={{ padding: '13px 16px', color: 'var(--teal)', fontWeight: 600 }}>{formatCurrency(row.capital)}</td>
                  <td style={{ padding: '13px 16px', color: 'var(--green)', fontWeight: 600 }}>{formatCurrency(row.profit)}</td>
                  <td style={{ padding: '13px 16px' }}>
                    <span style={{ color: parseFloat(row.roi) >= 100 ? 'var(--gold)' : 'var(--text-primary)', fontWeight: 700 }}>
                      {row.roi}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Break-even analysis */}
      <div className="card" style={{ padding: '22px 24px' }}>
        <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 15, marginBottom: 16 }}>🔍 Break-Even Analysis</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          {[
            { label: 'Months to break even', value: breakEvenMonth ? `${breakEvenMonth} months` : '>12 months', color: 'var(--blue)' },
            { label: 'Profit per loan cycle', value: formatCurrency(capital * effectiveRate), color: 'var(--green)' },
            { label: 'Cycles per year', value: '~6', sub: '2 months each', color: 'var(--purple)' },
            { label: 'Effective annual yield', value: `${(effectiveRate * 6 * 100).toFixed(1)}%`, color: 'var(--teal)' },
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
  )
}
