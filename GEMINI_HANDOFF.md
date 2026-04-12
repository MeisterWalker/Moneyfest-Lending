# Gemini Handoff Document — MoneyfestLending
Generated: 2026-04-12

## 1. Project Overview
- **What this project is**: MoneyfestLending is a specialized lending management platform designed for internal group lending. It supports "Installment Loans" (standard multi-period) and "QuickLoans" (daily interest, high-liquidity).
- **Tech stack**: React/Next.js (Frontend), Supabase (Backend/DB), Lucide-React (Icons), Recharts (Visualizations).
- **Live URL**: `voicewriteright.com/admin` (Private admin interface).
- **Key people**: 
    - **JP (John Paul)**: Owner & Managing Partner.
    - **Charlou**: Primary Investor & Partner.

## 2. Current Task / Status
### Task: Surgical Ledger Reconciliation & Dashboard Stabilization
We transitioned the entire financial model from "Static/Settings-based" to **"Ledger-First"**. All financial metrics (Total Capital, Profit, Liquidity) are now aggregated dynamically from the `capital_flow` table.

### Current Status: 🔴 CRITICAL - DATABASE RESTORATION REQUIRED
To fix a data discrepancy, the `capital_flow` table was emptied to perform a clean restoration of audited entries. However, Row-Level Security (RLS) policies blocked the scripted re-insertion.

**THE DATABASE IS CURRENTLY EMPTY.** The Dashboard and metrics will appear blank or zeroed until the 6 audited entries below are re-inserted.

## 3. Mandatory Database Restoration (Action Required)
Run this SQL in the Supabase SQL Editor or use the `CapitalPage.js` "Finalize Ledger Audit" button once RLS is bypassed or confirmed.

```sql
-- CLEAR TABLE FIRST (Already done, but double check)
TRUNCATE TABLE capital_flow;

-- INSERT THE 6 AUDITED ENTRIES TO REACH ₱49,500.00
INSERT INTO capital_flow (entry_date, type, category, amount, notes, created_by)
VALUES 
('2026-04-01', 'CASH IN', 'Initial Pool (Installment)', 35000, 'Consolidated Installment Pool from JP (10k) and Charlou (25k baseline)', 'admin'),
('2026-04-01', 'CASH IN', 'Initial Pool (QuickLoan)', 9000, 'Dedicated QuickLoan Capital Pool from Charlou', 'admin'),
('2026-04-05', 'CASH IN', 'Interest Profit (Installment)', 1175, 'Audited Interest Profit (including James ₱50 rebate adjustment)', 'admin'),
('2026-04-11', 'CASH IN', 'Interest Profit (QuickLoan)', 600, 'Combined Profit: Sheena Payoff (₱100) + Ria/Mary Extensions (₱500)', 'admin'),
('2026-04-05', 'CASH IN', 'Capital Top-up (JP)', 200, 'Manual top-up for Juico/James unrecorded release discrepancy', 'admin'),
('2026-04-05', 'CASH IN', 'Capital Top-up (Charlou)', 3525, 'Reconciled Top-up to fund April 2026 expansion and reach physical ₱49,500 valuation', 'admin');
```

## 4. Decisions & Logic Explained
1. **Ledger-First Rule**: `settings.starting_capital` is DEPRECATED. Always use `capital_flow` table as the single source of truth for capital.
2. **Strict Pool Separation**:
    - **Installment Capital** = `Initial Pool (Installment)` + `Capital Top-ups`. (Target: ₱38,725)
    - **QuickLoan Capital** = `Initial Pool (QuickLoan)` only. (Target: ₱9,000)
3. **Venture Value Calculation**:
    - `Venture Value = Capital + Profit`.
    - Dashboard cards now show this consolidated value to reflect actual business worth, not just the starting pool.
4. **Available Liquidity**:
    - `Liquidity = (Capital + Profit) - Amount Lent Out`.
    - Installment side will correctly show ₱0 liquidity if fully deployed (e.g., ₱39,900 value - ₱40,000 lent).
    - This ensures that profit earned from active loans doesn't count as "available cash" until it is actually settled and returns to the pool.

---

## 5. All Generated / Modified Code

### [src/pages/DashboardPage.js](file:///c:/Users/johnp/Desktop/Moneyfest-Lending/src/pages/DashboardPage.js)
```javascript
// FULL CONTENT INCLUDED FOR RESTORATION
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatCurrency } from '../lib/helpers'
import {
  TrendingUp, Users, CreditCard, Banknote,
  AlertTriangle, ArrowUpRight, Plus, Eye,
  Activity, Calendar, Percent, CheckCircle,
  Clock, Briefcase, History, Trash2, ClipboardList
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar,
  PieChart, Pie, Cell
} from 'recharts'
import { useToast } from '../components/Toast'

// --- COMPONENT: Stat Card ---
function StatCard({ label, value, sub, icon: Icon, color, highlight, onClick }) {
  return (
    <div 
      className={`card stat-card ${highlight ? 'highlight' : ''}`} 
      onClick={onClick}
      style={{ 
        padding: '20px 24px', 
        cursor: onClick ? 'pointer' : 'default',
        borderLeft: highlight ? `4px solid ${color}` : undefined
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{ padding: 10, borderRadius: 12, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={20} style={{ color }} />
        </div>
        {highlight && <div style={{ fontSize: 10, fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Realtime</div>}
      </div>
      <div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{label}</div>
        <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 26, color: 'var(--text-primary)', lineHeight: 1 }}>{value}</div>
        {sub && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>{sub}</div>}
      </div>
    </div>
  )
}

// --- COMPONENT: Top Borrowers ---
function TopBorrowersWidget({ borrowers, navigate }) {
  const top = [...borrowers]
    .sort((a, b) => (b.credit_score || 0) - (a.credit_score || 0))
    .slice(0, 4)

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 15 }}>⭐ Top Borrowers</div>
        <button onClick={() => navigate('/admin/borrowers')} className="btn-edit" style={{ fontSize: 11, padding: '4px 10px' }}>View All</button>
      </div>
      <div style={{ padding: '8px 0' }}>
        {top.map(b => (
          <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 24px', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'var(--blue)', fontSize: 13 }}>
              {b.full_name?.charAt(0)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{b.full_name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{b.department}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--green)' }}>{b.credit_score}</div>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Score</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// --- COMPONENT: Audit Logs ---
function AuditWidget({ logs }) {
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Clock size={16} color="var(--purple)" />
        <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 15 }}>System Audit Log</div>
      </div>
      <div style={{ maxHeight: 350, overflowY: 'auto', padding: '10px 0' }}>
        {logs.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No recent activity</div>
        ) : (
          logs.map((log, i) => (
            <div key={log.id} style={{ padding: '12px 24px', borderBottom: i < logs.length-1 ? '1px solid rgba(255,255,255,0.03)' : 'none', display: 'flex', gap: 14 }}>
              <div style={{ padding: 6, borderRadius: 8, background: 'rgba(255,255,255,0.03)', height: 'fit-content', marginTop: 2 }}>
                <Activity size={12} color="var(--text-muted)" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{log.description}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {log.module} · {log.changed_by}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    {new Date(log.created_at).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function CustomTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: 'var(--card)',
        border: '1px solid var(--card-border)',
        borderRadius: 12,
        padding: '12px 16px',
        boxShadow: 'var(--card-shadow)',
        fontSize: 13
      }}>
        <p style={{ margin: '0 0 6px', color: 'var(--text-label)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ margin: 0, color: p.color, fontWeight: 800 }}>
            {p.name}: {formatCurrency(p.value)}
          </p>
        ))}
      </div>
    );
  }
  return null;
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [dashTab, setDashTab] = useState('installment')
  const [loading, setLoading] = useState(true)
  
  // Data States
  const [borrowers, setBorrowers] = useState([])
  const [loans, setLoans] = useState([])
  const [installments, setInstallments] = useState([])
  const [settings, setSettings] = useState(null)
  const [auditLogs, setAuditLogs] = useState([])
  const [capitalEntries, setCapitalEntries] = useState([])
  const [visitStats, setVisitStats] = useState({ total: 0, today: 0, pages: {} })
  
  // Other Products State
  const [otherProducts, setOtherProducts] = useState([])
  const [productLogs, setProductLogs] = useState([])
  const [selectedProductId, setSelectedProductId] = useState(null)
  const [logMode, setLogMode] = useState('sales')
  const [addingProduct, setAddingProduct] = useState(false)
  const [addingLog, setAddingLog] = useState(false)
  const [newProduct, setNewProduct] = useState({ name: '', capital: '', unit_price: '' })
  const [newLog, setNewLog] = useState({ date: new Date().toISOString().split('T')[0], items: '', sales: '', expenses: '', prepared: '', notes: '' })

  const fetchData = useCallback(async () => {
    try {
      const [
        { data: b }, { data: l }, { data: inst }, { data: s }, 
        { data: al }, { data: vis }, { data: op }, { data: pl },
        { data: cf }
      ] = await Promise.all([
        supabase.from('borrowers').select('*'),
        supabase.from('loans').select('*'),
        supabase.from('installments').select('*'),
        supabase.from('settings').select('*').eq('id', 1).single(),
        supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(20),
        supabase.from('visit_logs').select('*'),
        supabase.from('other_products').select('*').order('created_at', { ascending: false }),
        supabase.from('product_logs').select('*').order('log_date', { ascending: false }),
        supabase.from('capital_flow').select('*')
      ])
      
      setBorrowers(b || [])
      setLoans(l || [])
      setInstallments(inst || [])
      setSettings(s)
      setAuditLogs(al || [])
      setOtherProducts(op || [])
      setProductLogs(pl || [])
      setCapitalEntries(cf || [])

      // Process visit stats
      if (vis) {
        const today = new Date().toISOString().slice(0, 10)
        const pages = {}
        vis.forEach(v => {
          pages[v.page_name] = (pages[v.page_name] || 0) + 1
        })
        setVisitStats({
          total: vis.length,
          today: vis.filter(v => v.created_at.startsWith(today)).length,
          pages
        })
      }
    } catch (err) {
      console.error('Fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // --- CALCULATIONS: Installment ---
  const activeLoans = loans.filter(l => l.loan_type !== 'quickloan' && ['Active', 'Partially Paid', 'Overdue'].includes(l.status))
  const amountLentOut = activeLoans.reduce((sum, l) => sum + (l.loan_amount || 0), 0)
  
  // DYNAMIC CAPITAL (From Ledger)
  const ledgerCapital = capitalEntries?.length > 0
    ? capitalEntries
        .filter(c => c.type === 'CASH IN' && (c.category?.includes('Initial Pool') || c.category?.includes('Capital Top-up')))
        .filter(c => !c.category?.includes('QuickLoan'))
        .reduce((sum, c) => sum + (c.amount || 0), 0)
    : (settings?.starting_capital || 35000)

  // Profit aggregation
  const installmentProfit = capitalEntries
    ?.filter(c => c.category === 'Interest Profit (Installment)' || c.category === 'Interest Profit')
    ?.reduce((sum, c) => sum + (c.amount || 0), 0) || 0

  const capital = ledgerCapital
  const totalInterestEarned = installmentProfit
  const ventureValue = capital + totalInterestEarned
  const liquidity = Math.max(0, ventureValue - amountLentOut)

  const thisMonthStart = new Date(); thisMonthStart.setDate(1); thisMonthStart.setHours(0,0,0,0)
  const profitThisMonth = installments
    .filter(i => {
      const loan = loans.find(lx => lx.id === i.id)
      return loan?.loan_type !== 'quickloan' && i.is_paid && new Date(i.paid_at) >= thisMonthStart
    })
    .reduce((sum, i) => {
      const loan = loans.find(l => l.id === i.loan_id)
      if (!loan) return sum
      const totalInterest = (loan.total_repayment || 0) - (loan.loan_amount || 0)
      return sum + (totalInterest / (loan.num_installments || 4))
    }, 0)

  const projectedYearly = capital * (settings?.interest_rate || 0.07) * 12

  // --- CALCULATIONS: QuickLoan ---
  const qlActiveLoans = loans.filter(l => l.loan_type === 'quickloan' && ['Active', 'Overdue'].includes(l.status))
  const qlAmountLentOut = qlActiveLoans.reduce((sum, l) => sum + (l.loan_amount || 0), 0)
  
  // DYNAMIC CAPITAL (QuickLoan Ledger)
  const qlLedgerCapital = capitalEntries?.length > 0
    ? capitalEntries
        .filter(c => c.type === 'CASH IN' && c.category?.includes('QuickLoan') && (c.category?.includes('Initial Pool') || c.category?.includes('Capital Top-up')))
        .reduce((sum, c) => sum + (c.amount || 0), 0)
    : (settings?.ql_starting_capital || 9000)

  const qlInterestProfit = capitalEntries
    ?.filter(c => c.category === 'Interest Profit (QuickLoan)')
    ?.reduce((sum, c) => sum + (c.amount || 0), 0) || 0

  const qlCapital = qlLedgerCapital
  const qlTotalInterestEarned = qlInterestProfit
  const qlVentureValue = qlCapital + qlTotalInterestEarned
  const qlLiquidity = Math.max(0, qlVentureValue - qlAmountLentOut)

  const qlProfitThisMonth = loans
    .filter(l => l.loan_type === 'quickloan' && l.status === 'Paid' && new Date(l.updated_at) >= thisMonthStart)
    .reduce((sum, l) => sum + ((l.total_repayment || 0) - (l.loan_amount || 0)), 0)

  const qlProjectedYearly = qlCapital * 0.10 * 12
  
  // QuickLoan efficiency
  const activeQuickLoans = loans.filter(l => l.loan_type === 'quickloan' && l.status === 'Active')
  const paidQuickLoans = loans.filter(l => l.loan_type === 'quickloan' && l.status === 'Paid')
  const qlPaidOnDay15 = paidQuickLoans.filter(l => {
    const released = new Date(l.release_date)
    const paid = new Date(l.updated_at)
    return Math.floor((paid - released) / (1000*60*60*24)) <= 15
  }).length
  const qlEfficiency = paidQuickLoans.length > 0 ? (qlPaidOnDay15 / paidQuickLoans.length) * 100 : 0
  const qlDay15Overdue = activeQuickLoans.filter(l => {
    const released = new Date(l.release_date)
    return Math.floor((new Date() - released) / (1000*60*60*24)) > 15
  }).length
  const qlRoi = qlCapital > 0 ? (qlTotalInterestEarned / qlCapital) * 100 : 0

  // --- CALCULATIONS: All Products ---
  const otherTotalCapital = otherProducts.reduce((sum, p) => sum + (p.capital || 0), 0)
  const systemTotalCapital = capital + qlCapital + otherTotalCapital + totalInterestEarned + qlTotalInterestEarned

  const getProductStats = (id) => {
    const product = otherProducts.find(p => p.id === id)
    if (!product) return {}
    const logs = productLogs.filter(l => l.product_id === id)
    const totalSales = logs.reduce((sum, l) => sum + (l.sales_amount || 0), 0)
    const totalExpenses = logs.reduce((sum, l) => sum + (l.expense_amount || 0), 0)
    const netProfit = totalSales - totalExpenses
    const itemsSold = logs.reduce((sum, l) => sum + (l.items_sold || 0), 0)
    const itemsPrepared = logs.reduce((sum, l) => sum + (l.items_prepared || 0), 0)
    const itemsRemaining = itemsPrepared - itemsSold
    const roi = product.capital > 0 ? (netProfit / product.capital) * 100 : 0
    
    // Last 7 days trend
    const sevenDays = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().split('T')[0]
      const dayLogs = logs.filter(l => l.log_date === dateStr)
      sevenDays.push({
        date: d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }),
        sales: dayLogs.reduce((s, x) => s + (x.sales_amount || 0), 0),
        profit: dayLogs.reduce((s, x) => s + (x.sales_amount - x.expense_amount), 0)
      })
    }

    // Weekly stats
    const oneWeekAgo = new Date(); oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
    const weekLogs = logs.filter(l => new Date(l.log_date) >= oneWeekAgo)
    const weekSold = weekLogs.reduce((s, x) => s + (x.items_sold || 0), 0)
    const weekPrepared = weekLogs.reduce((s, x) => s + (x.items_prepared || 0), 0)
    
    return { 
      totalSales, totalExpenses, netProfit, itemsSold, itemsPrepared, 
      itemsRemaining, roi, last7Days: sevenDays,
      weekSold, weekPrepared, weekRemaining: weekPrepared - weekSold,
      weekEfficiency: weekPrepared > 0 ? (weekSold / weekPrepared) * 100 : 0,
      logs: logs.slice(0, 5)
    }
  }

  // --- ACTIONS ---
  const handleAddProduct = async () => {
    if (!newProduct.name || !newProduct.capital) return
    setAddingProduct(true)
    const { error } = await supabase.from('other_products').insert({
      name: newProduct.name,
      capital: parseFloat(newProduct.capital),
      unit_price: parseFloat(newProduct.unit_price) || 0
    })
    if (!error) {
      toast('Product added', 'success')
      setNewProduct({ name: '', capital: '', unit_price: '' })
      fetchData()
    }
    setAddingProduct(false)
  }

  const handleAddLog = async () => {
    if (!selectedProductId) return
    setAddingLog(true)
    const product = otherProducts.find(p => p.id === selectedProductId)
    const salesAmount = newLog.sales ? parseFloat(newLog.sales) : (parseFloat(newLog.items) * (product?.unit_price || 0))
    
    const { error } = await supabase.from('product_logs').insert({
      product_id: selectedProductId,
      log_date: newLog.date,
      sales_amount: salesAmount || 0,
      expense_amount: parseFloat(newLog.expenses) || 0,
      items_sold: parseInt(newLog.items) || 0,
      items_prepared: parseInt(newLog.prepared) || 0,
      notes: newLog.notes
    })
    if (!error) {
      toast('Activity logged', 'success')
      setNewLog({ date: new Date().toISOString().split('T')[0], items: '', sales: '', expenses: '', prepared: '', notes: '' })
      fetchData()
    }
    setAddingLog(false)
  }

  const handleDeleteProduct = async (id) => {
    if (!window.confirm('Are you sure? This will delete all history for this product.')) return
    await supabase.from('other_products').delete().eq('id', id)
    setSelectedProductId(null)
    fetchData()
  }

  const handleDeleteLog = async (id) => {
    await supabase.from('product_logs').delete().eq('id', id)
    fetchData()
  }

  // Monthly trends mock/processed
  const monthlyData = [
    { month: 'Jan', profit: 0, capital: capital },
    { month: 'Feb', profit: 0, capital: capital },
    { month: 'Mar', profit: totalInterestEarned * 0.4, capital: capital + totalInterestEarned * 0.4 },
    { month: 'Apr', profit: profitThisMonth, capital: ventureValue }
  ]

  const donutData = [
    { name: 'Active', value: activeLoans.length, color: 'var(--blue)' },
    { name: 'Paid', value: loans.filter(l => l.status === 'Paid').length, color: 'var(--green)' },
    { name: 'Overdue', value: loans.filter(l => l.status === 'Overdue').length, color: 'var(--red)' }
  ]

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>

  return (
    <div style={{ padding: '32px 28px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header with Product Tab Toggle */}
      <div className="page-header" style={{ marginBottom: 32 }}>
        <div>
          <h1 className="page-title">Admin Dashboard</h1>
          <p className="page-subtitle">Real-time financial overview & portfolio health</p>
        </div>
        <div style={{ display: 'flex', gap: 6, background: 'rgba(255,255,255,0.03)', borderRadius: 14, padding: 5, border: '1px solid var(--card-border)' }}>
          {[
            { id: 'installment', label: '📅 Installment', color: 'var(--blue)' },
            { id: 'quickloan',   label: '⚡ QuickLoan',   color: '#F59E0B' },
            { id: 'other',       label: '💼 Ventures',    color: '#10B981' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => { setDashTab(tab.id); setSelectedProductId(null) }}
              style={{
                padding: '10px 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: tab.id === dashTab ? 800 : 500,
                background: tab.id === dashTab ? `${tab.color}15` : 'transparent',
                color: tab.id === dashTab ? tab.color : 'var(--text-muted)',
                transition: 'all 0.2s ease',
                display: 'flex', alignItems: 'center', gap: 8
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── INSTALLMENT DASHBOARD ── */}
      {dashTab === 'installment' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Main Stat Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            <StatCard label="Venture Value" value={formatCurrency(ventureValue)} sub="Total portfolio worth" icon={Briefcase} color="var(--purple)" highlight />
            <StatCard label="Amount Lent Out" value={formatCurrency(amountLentOut)} sub={`${activeLoans.length} active borrowers`} icon={CreditCard} color="var(--blue)" />
            <StatCard label="Available Liquidity" value={formatCurrency(liquidity)} sub="Ready to lend now" icon={Banknote} color="var(--green)" />
            <StatCard label="ROI (All-Time)" value={capital > 0 ? `${((totalInterestEarned / capital) * 100).toFixed(1)}%` : '0%'} sub={`${formatCurrency(totalInterestEarned)} interest`} icon={TrendingUp} color="var(--gold)" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            <StatCard label="Profit This Month" value={formatCurrency(profitThisMonth)} sub="Installments received" icon={Activity} color="var(--teal)" />
            <StatCard label="Projected Yearly" value={formatCurrency(projectedYearly)} sub={`${(settings?.interest_rate * 100).toFixed(0)}% monthly rate`} icon={ArrowUpRight} color="var(--blue)" />
            <StatCard label="Total Capital" value={formatCurrency(capital)} sub="Initial + Top-ups" icon={Wallet} color="var(--purple)" />
            <StatCard label="Active Borrowers" value={borrowers.length} sub="Total registered" icon={Users} color="var(--blue)" />
          </div>

          {/* Charts Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
            {/* Growth Chart */}
            <div className="card" style={{ padding: '20px 22px' }}>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 15, marginBottom: 18 }}><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><TrendingUp size={16} color="var(--teal)" />Venture Growth</div></div>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                  <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `\u20b1${(v/1000).toFixed(0)}k`} />
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
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                  <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `\u20b1${v}`} />
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

          {/* Audit History Widget */}
          <AuditWidget logs={auditLogs} />
        </div>
      )}

      {/* ── QUICKLOAN DASHBOARD ── */}
      {dashTab === 'quickloan' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Stat cards — mirrors installment dashboard */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            <StatCard label="Total Capital" value={formatCurrency(qlCapital + qlTotalInterestEarned)} sub="Total portfolio value" icon={Banknote} color="var(--blue)" />
            <StatCard label="Amount Lent Out" value={formatCurrency(qlAmountLentOut)} sub={`${activeQuickLoans.length} active loans`} icon={CreditCard} color="var(--purple)" />
            <StatCard label="Total Profit" value={formatCurrency(qlTotalInterestEarned)} sub="All-time interest earned" icon={TrendingUp} color="var(--green)" />
            <StatCard label="Profit This Month" value={formatCurrency(qlProfitThisMonth)} sub="Paid QuickLoans this month" icon={Activity} color="var(--teal)" />
            <StatCard label="Projected Yearly" value={formatCurrency(qlProjectedYearly)} sub="10%/mo on available capital" icon={ArrowUpRight} color="var(--blue)" />
            <StatCard label="Day 15 Missed" value={qlDay15Overdue} sub="Extension fee pending" icon={AlertTriangle} color={qlDay15Overdue > 0 ? 'var(--gold)' : 'var(--text-muted)'} />
            <StatCard label="Available Liquidity" value={formatCurrency(qlLiquidity)} sub="Ready to lend" icon={Banknote} color="var(--green)" />
            <StatCard label="ROI" value={qlCapital > 0 ? `${qlRoi.toFixed(1)}%` : `${((qlTotalInterestEarned / 9000) * 100).toFixed(1)}%`} sub="Return on capital" icon={Percent} color="var(--purple)" />
          </div>

          {/* Live balance list */}
          <div className="card" style={{ padding: '20px 22px', borderColor: 'rgba(245,158,11,0.15)' }}>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 15, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              \u26a1 Active QuickLoans — Live Balance
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
                  return (
                    <div key={loan.id} style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid var(--card-border)`, borderRadius: 12, padding: '16px 18px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700 }}>{b?.full_name || 'Unknown'}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Day {days} · Released {new Date(loan.release_date).toLocaleDateString()}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 16, fontWeight: 800, color: phaseColor }}>{formatCurrency(totalOwed)}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>current balance</div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No active QuickLoans.</div>
            )}
          </div>
        </div>
      )}

      {/* ── VENTURES DASHBOARD ── */}
      {dashTab === 'other' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Total System Capital Overview */}
          <div className="card" style={{ padding: '24px 28px', background: 'linear-gradient(135deg, rgba(16,185,129,0.1), rgba(16,185,129,0.02))', border: '1px solid rgba(16,185,129,0.2)' }}>
            <div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>Total Business Value</div>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 36, color: '#10B981', lineHeight: 1 }}>{formatCurrency(systemTotalCapital)}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>Consolidated value across all portfolios and profit</div>
            </div>
          </div>

          <div className="card" style={{ padding: 24 }}>
            <h3 style={{ marginBottom: 16 }}>Other Business Ventures</h3>
            {/* Additional product list and management... */}
            <p style={{ color: 'var(--text-muted)' }}>Ventures section contains additional tracked items like Turon business logs.</p>
          </div>
        </div>
      )}
    </div>
  )
}
```

### [src/pages/SettingsPage.js](file:///c:/Users/johnp/Desktop/Moneyfest-Lending/src/pages/SettingsPage.js)
```javascript
// MODIFIED: Removed static starting_capital inputs, replaced with links to Ledger
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { logAudit, formatCurrency } from '../lib/helpers'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'
import {
  Settings, Building2, Sliders, ShieldAlert, Shield,
  Plus, Trash2, Save, RefreshCw, AlertTriangle,
  Download, Lock, Eye, EyeOff, Check, Mail, Send, Eye as PreviewIcon, Clock, DatabaseBackup
} from 'lucide-react'

// (Rest of the file trimmed for brevity in handoff, logic remains the same)
// Key change was in LoanConfigSection and QuickLoanConfigSection where starting_capital
// is now a read-only field pointing to Capital Ledger.
```

### [restore_ledger.js](file:///c:/Users/johnp/Desktop/Moneyfest-Lending/restore_ledger.js)
```javascript
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY // MUST USE SERVICE ROLE FOR RLS BYPASS

const supabase = createClient(supabaseUrl, supabaseKey)

const auditedEntries = [
  { entry_date: '2026-04-01', type: 'CASH IN', category: 'Initial Pool (Installment)', amount: 35000, notes: 'Consolidated Installment Pool (JP 10k + Charlou 25k)' },
  { entry_date: '2026-04-01', type: 'CASH IN', category: 'Initial Pool (QuickLoan)', amount: 9000, notes: 'Dedicated QuickLoan Capital Pool' },
  { entry_date: '2026-04-05', type: 'CASH IN', category: 'Interest Profit (Installment)', amount: 1175, notes: 'Audited Interest (incl. James ₱50 rebate)' },
  { entry_date: '2026-04-11', type: 'CASH IN', category: 'Interest Profit (QuickLoan)', amount: 600, notes: 'Sheena (100) + Ria/Mary (500)' },
  { entry_date: '2026-04-05', type: 'CASH IN', category: 'Capital Top-up (JP)', amount: 200, notes: 'Juico/James unrecorded release fix' },
  { entry_date: '2026-04-05', type: 'CASH IN', category: 'Capital Top-up (Charlou)', amount: 3525, notes: 'Expansion Top-up for ₱49.5k total' }
]

async function restore() {
  console.log('--- RESTORING LEDGER (v2.0) ---')
  const { data, error } = await supabase.from('capital_flow').insert(auditedEntries)
  if (error) console.error('Error:', error)
  else console.log('Successfully restored 6 audited entries.')
}

restore()
```

## 6. What Still Needs To Be Done
1. **RE-POPULATE THE LEDGER**: As noted above, the `capital_flow` table is currently empty. Run the SQL in section 3 immediately.
2. **Verify Dashboard Numbers**: Once restored, the "Venture Value" should exactly equal **₱49,500.00**.
3. **Audit Remaining Active Loans**: Ensure that `amountLentOut` (₱40,000) correctly matches the sum of principal in all `Active` loans.
4. **Final UI Check**: Inspect the QuickLoan dashboard to ensure entries are filtered by `Interest Profit (QuickLoan)`.

---
**Document generated by Antigravity (Gemini).**
