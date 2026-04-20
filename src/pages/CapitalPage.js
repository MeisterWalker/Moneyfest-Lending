import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { logAudit, formatCurrency, formatDate } from '../lib/helpers'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Legend 
} from 'recharts'
import { 
  TrendingUp, ArrowUpRight, ArrowDownRight, Plus, Trash2, 
  Wallet, Users, PieChart as PieIcon, History, Calendar,
  ArrowRightCircle
} from 'lucide-react'

// Constants
const JP_INITIAL = 0
const CHARLOU_INITIAL = 0
const TOTAL_INITIAL = JP_INITIAL + CHARLOU_INITIAL

export default function CapitalPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  
  // Form State
  const [formData, setFormData] = useState({
    entry_date: new Date().toISOString().slice(0, 10),
    type: 'CASH IN',
    category: 'Interest Profit',
    amount: '',
    notes: ''
  })

  const fetchData = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('capital_flow')
        .select('*')
        .order('entry_date', { ascending: true })
      
      if (error) throw error
      setEntries(data || [])
    } catch (err) {
      console.error('Fetch error:', err)
      toast('Failed to load ledger', 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { fetchData() }, [fetchData])

  // Calculations
  const processLedger = () => {
    let runningTotal = 0
    let jpCapital = JP_INITIAL
    let charlouCapital = CHARLOU_INITIAL
    
    const ledger = entries.map(entry => {
      const isCashIn = entry.type === 'CASH IN'
      const amount = parseFloat(entry.amount)
      
      if (isCashIn) {
        runningTotal += amount
        if (entry.category === 'Capital Top-up (JP)') jpCapital += amount
        if (entry.category === 'Capital Top-up (Charlou)') charlouCapital += amount
      } else {
        runningTotal -= amount
        if (entry.category === 'Partner Withdrawal (JP)') jpCapital -= amount
        if (entry.category === 'Partner Withdrawal (Charlou)') charlouCapital -= amount
      }

      return {
        ...entry,
        runningTotal,
        jpCapital,
        charlouCapital
      }
    })

    const currentTotal = runningTotal
    const jpShare = (jpCapital / (jpCapital + charlouCapital || 1)) * 100
    const charlouShare = (charlouCapital / (jpCapital + charlouCapital || 1)) * 100

    const totalIncome = entries
      .filter(e => e.type === 'CASH IN' && ['Interest Profit (Installment)', 'Interest Profit (QuickLoan)', 'Interest Profit', 'Other Income'].includes(e.category))
      .reduce((sum, e) => sum + parseFloat(e.amount), 0)
    
    const totalExpenses = entries
      .filter(e => e.type === 'CASH OUT' && ['Subscription / Hosting', 'Operating Expense', 'Rebate Issued'].includes(e.category))
      .reduce((sum, e) => sum + parseFloat(e.amount), 0)

    return { ledger, jpCapital, charlouCapital, currentTotal, jpShare, charlouShare, totalIncome, totalExpenses }
  }

  const { ledger, jpCapital, charlouCapital, currentTotal, jpShare, charlouShare, totalIncome, totalExpenses } = processLedger()

  // Chart Data
  const chartData = ledger.map(item => ({
    date: formatDate(item.entry_date),
    JP: item.jpCapital,
    Charlou: item.charlouCapital,
    Total: item.runningTotal
  }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.amount || formData.amount <= 0) return toast('Enter a valid amount', 'error')
    
    setAdding(true)
    try {
      const { data, error } = await supabase
        .from('capital_flow')
        .insert({
          entry_date: formData.entry_date,
          type: formData.type,
          category: formData.category,
          amount: parseFloat(formData.amount),
          notes: formData.notes,
          created_by: user?.email || 'admin'
        })
        .select()

      if (error) throw error

      toast('Entry added successfully', 'success')
      logAudit({
        action_type: 'CREATE',
        module: 'Capital',
        description: `Added ${formData.type}: ${formData.category} - ${formatCurrency(formData.amount)}`,
        changed_by: user?.email
      })
      
      setFormData({
        entry_date: new Date().toISOString().slice(0, 10),
        type: 'CASH IN',
        category: 'Interest Profit (Installment)',
        amount: '',
        notes: ''
      })
      fetchData()
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setAdding(false)
    }
  }

  const handleReconcileData = async () => {
    // v2.0 Audit Fix - Ensuring ₱49,500.00 total
    const msg = "Finalize Ledger Audit (v2.0)?\n\nThis will:\n1. Add April 5 Profits: ₱1,175 (James/Installments)\n2. Add April 8-11 Profits: ₱600 (Sheena Payoff + Ria/Mary Extensions)\n3. Add JP Top-up: ₱200 (Unrecorded Juico/James release)\n4. Add Charlou Top-up: ₱3,525\n\nResult: Total Pool = ₱49,500.00 (Verified Business Value)."
    if (!window.confirm(msg)) return;
    
    setLoading(true)
    try {
      // 1. Delete bad entry (if exists from previous tests)
      await supabase.from('capital_flow').delete().eq('category', 'Interest Profit').eq('amount', 5000)
      
      // 2. Insert Profit & Top-ups
      const { error } = await supabase.from('capital_flow').insert([
        { 
          entry_date: '2026-04-05', 
          type: 'CASH IN', 
          category: 'Interest Profit (Installment)', 
          amount: 1175, 
          notes: 'Audited Interest Profit (incl. James ₱50 rebate)',
          created_by: user?.email || 'admin'
        },
        { 
          entry_date: '2026-04-11', 
          type: 'CASH IN', 
          category: 'Interest Profit (QuickLoan)', 
          amount: 600, 
          notes: 'Combined Profit: Sheena Payoff (₱100) + Ria/Mary Extensions (₱500)',
          created_by: user?.email || 'admin'
        },
        { 
          entry_date: '2026-04-05', 
          type: 'CASH IN', 
          category: 'Capital Top-up (JP)', 
          amount: 200, 
          notes: 'Manual top-up for Juico/James unrecorded release',
          created_by: user?.email || 'admin'
        },
        { 
          entry_date: '2026-04-05', 
          type: 'CASH IN', 
          category: 'Capital Top-up (Charlou)', 
          amount: 3525, 
          notes: 'Reconciled Top-up to fund April 2026 expansion',
          created_by: user?.email || 'admin'
        }
      ])

      if (error) throw error
      
      await logAudit({ action_type: 'LEDGER_RECONCILED_V2', module: 'Capital', description: 'Admin corrected ledger to reach \u20b149,500 total business value (v2.0)', changed_by: user?.email })
      toast('Ledger reconciled perfectly (v2.0)!', 'success')
      fetchData()
    } catch (err) {
      toast('Failed to reconcile: ' + err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id, cat, amt) => {
    if (cat === 'Initial Pool') return toast('Cannot delete baseline capital', 'warning')
    if (!window.confirm('Delete this entry?')) return

    try {
      const { error } = await supabase.from('capital_flow').delete().eq('id', id)
      if (error) throw error

      toast('Entry deleted', 'info')
      logAudit({
        action_type: 'DELETE',
        module: 'Capital',
        description: `Deleted entry: ${cat} (${formatCurrency(amt)})`,
        changed_by: user?.email
      })
      fetchData()
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  if (loading) return <div style={{ padding: 40, color: 'var(--text-muted)' }}>Loading records...</div>

  return (
    <div style={{ padding: '32px 28px', maxWidth: 1200, margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Capital & Cash Flow</h1>
          <p className="page-subtitle">Track ownership shares, capital top-ups, and business liquidity</p>
        </div>
        <button onClick={handleReconcileData} style={{ fontSize: 12, padding: '7px 14px', borderRadius: 8, border: '1px solid rgba(34,197,94,0.3)', background: 'rgba(34,197,94,0.1)', color: 'var(--green)', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
          ✨ Finalize Ledger Audit (v2.0)
        </button>
      </div>

      {/* Ownership Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 30 }}>
        <div className="card" style={{ padding: 24, display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ width: 50, height: 50, borderRadius: 12, background: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={24} color="#3B82F6" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>JP (John Paul)</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <div style={{ fontFamily: 'Space Grotesk', fontSize: 28, fontWeight: 800 }}>{formatCurrency(jpCapital)}</div>
              <div style={{ color: 'var(--blue)', fontWeight: 600 }}>{jpShare.toFixed(1)}%</div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Managing Partner</div>
          </div>
        </div>

        <div className="card" style={{ padding: 24, display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ width: 50, height: 50, borderRadius: 12, background: 'rgba(168,85,247,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={24} color="#A855F7" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Charlou</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <div style={{ fontFamily: 'Space Grotesk', fontSize: 28, fontWeight: 800 }}>{formatCurrency(charlouCapital)}</div>
              <div style={{ color: '#A855F7', fontWeight: 600 }}>{charlouShare.toFixed(1)}%</div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Primary Investor</div>
          </div>
        </div>
      </div>

      {/* Profit Summary Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 30 }}>
        <div className="card" style={{ padding: '16px 20px', borderLeft: '4px solid var(--green)' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Total Income (Profit)</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--green)', fontFamily: 'Space Grotesk' }}>{formatCurrency(totalIncome)}</div>
        </div>
        <div className="card" style={{ padding: '16px 20px', borderLeft: '4px solid var(--red)' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Total Expenses</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--red)', fontFamily: 'Space Grotesk' }}>{formatCurrency(totalExpenses)}</div>
        </div>
        <div className="card" style={{ padding: '16px 20px', borderLeft: '4px solid var(--blue)' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Net Business Profit</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--blue)', fontFamily: 'Space Grotesk' }}>{formatCurrency(totalIncome - totalExpenses)}</div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: 24, alignItems: 'start' }}>
        
        {/* Entry Form */}
        <div className="card" style={{ padding: 24, position: 'sticky', top: 20 }}>
          <h3 style={{ marginBottom: 20, fontSize: 16 }}>Add New Entry</h3>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-label)', marginBottom: 6 }}>Date</label>
              <input 
                type="date"
                required
                className="input"
                style={{ width: '100%' }}
                value={formData.entry_date}
                onChange={e => setFormData({ ...formData, entry_date: e.target.value })}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-label)', marginBottom: 6 }}>Type</label>
              <select 
                className="input" 
                style={{ width: '100%' }}
                value={formData.type}
                onChange={e => {
                  const newType = e.target.value
                  setFormData({ 
                    ...formData, 
                    type: newType,
                    category: newType === 'CASH IN' ? 'Interest Profit (Installment)' : 'Subscription / Hosting' 
                  })
                }}
              >
                <option value="CASH IN">CASH IN (+)</option>
                <option value="CASH OUT">CASH OUT (-)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-label)', marginBottom: 6 }}>Category</label>
              <select 
                className="input" 
                style={{ width: '100%' }}
                value={formData.category}
                onChange={e => setFormData({ ...formData, category: e.target.value })}
              >
                {formData.type === 'CASH IN' ? (
                  <>
                    <option value="Interest Profit (Installment)">Interest Profit (Installment)</option>
                    <option value="Interest Profit (QuickLoan)">Interest Profit (QuickLoan)</option>
                    <option value="Loan Principal Return">Loan Principal Return</option>
                    <option value="Capital Top-up (JP)">Capital Top-up (JP)</option>
                    <option value="Capital Top-up (Charlou)">Capital Top-up (Charlou)</option>
                  </>
                ) : (
                  <>
                    <option value="Loan Disbursed">Loan Disbursed</option>
                    <option value="Loan Disbursed QL">Loan Disbursed QL</option>
                    <option value="Subscription / Hosting">Subscription / Hosting</option>
                    <option value="Partner Withdrawal (JP)">Partner Withdrawal (JP)</option>
                    <option value="Partner Withdrawal (Charlou)">Partner Withdrawal (Charlou)</option>
                    <option value="Operating Expense">Operating Expense</option>
                    <option value="Other Expense">Other Expense</option>
                  </>
                )}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-label)', marginBottom: 6 }}>Amount (₱)</label>
              <input 
                type="number"
                step="0.01"
                required
                placeholder="0.00"
                className="input"
                style={{ width: '100%' }}
                value={formData.amount}
                onChange={e => setFormData({ ...formData, amount: e.target.value })}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-label)', marginBottom: 6 }}>Notes (Optional)</label>
              <textarea 
                className="input"
                style={{ width: '100%', minHeight: 80, resize: 'vertical' }}
                value={formData.notes}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>

            <button 
              type="submit" 
              disabled={adding}
              className="btn btn-primary"
              style={{ width: '100%', marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              {adding ? 'Adding...' : <><Plus size={18} /> Add Entry</>}
            </button>
          </form>
        </div>

        {/* Ledger Table */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 16 }}>Cash Flow Ledger</h3>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Current Pool Balance</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--green)', fontFamily: 'Space Grotesk' }}>{formatCurrency(currentTotal)}</div>
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 600 }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--card-border)' }}>
                    <th style={{ padding: '14px 24px', fontSize: 12, color: 'var(--text-label)', fontWeight: 600 }}>Date</th>
                    <th style={{ padding: '14px 24px', fontSize: 12, color: 'var(--text-label)', fontWeight: 600 }}>Category</th>
                    <th style={{ padding: '14px 24px', fontSize: 12, color: 'var(--text-label)', fontWeight: 600 }}>Amount</th>
                    <th style={{ padding: '14px 24px', fontSize: 12, color: 'var(--text-label)', fontWeight: 600 }}>Notes</th>
                    <th style={{ padding: '14px 24px', fontSize: 12, color: 'var(--text-label)', fontWeight: 600 }}>Total Pool</th>
                    <th style={{ padding: '14px 24px', fontSize: 12, color: 'var(--text-label)', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((item, idx) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--card-border)', transition: 'background 0.2s' }}>
                      <td style={{ padding: '16px 24px', fontSize: 13, color: 'var(--text-muted)' }}>{formatDate(item.entry_date)}</td>
                      <td style={{ padding: '16px 24px' }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{item.category}</div>
                        <div style={{ fontSize: 11, color: item.type === 'CASH IN' ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>{item.type}</div>
                      </td>
                      <td style={{ padding: '16px 24px', fontSize: 15, fontWeight: 700, color: item.type === 'CASH IN' ? 'var(--green)' : 'var(--red)' }}>
                        {item.type === 'CASH IN' ? '+' : '-'}{formatCurrency(item.amount)}
                      </td>
                      <td 
                        title={item.notes}
                        style={{ padding: '16px 24px', fontSize: 13, color: 'var(--text-muted)', maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: item.notes ? 'help' : 'default' }}
                      >
                        {item.notes || '—'}
                      </td>
                      <td style={{ padding: '16px 24px', fontSize: 14, fontWeight: 800, fontFamily: 'Space Grotesk' }}>
                        {formatCurrency(item.runningTotal)}
                      </td>
                      <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                        {item.category !== 'Initial Pool' && (
                          <button 
                            onClick={() => handleDelete(item.id, item.category, item.amount)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(239,68,68,0.5)', transition: 'color 0.2s' }}
                            onMouseEnter={e => e.currentTarget.style.color = 'var(--red)'}
                            onMouseLeave={e => e.currentTarget.style.color = 'rgba(239,68,68,0.5)'}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Visualization Charts */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 24 }}>
            {/* Individual Capital Tracking */}
            <div className="card" style={{ padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <TrendingUp size={20} color="var(--blue)" />
                <h3 style={{ fontSize: 16 }}>Partner Capital Growth (JP vs Charlou)</h3>
              </div>
              <div style={{ height: 350 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={12} tickLine={false} />
                    <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} tickFormatter={v => `₱${(v/1000).toFixed(0)}k`} />
                    <Tooltip 
                      contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10 }}
                      formatter={(value) => formatCurrency(value)}
                    />
                    <Legend />
                    <Line name="JP (Managed)" type="monotone" dataKey="JP" stroke="#3B82F6" strokeWidth={3} dot={{ r: 4, fill: '#3B82F6' }} activeDot={{ r: 8 }} />
                    <Line name="Charlou (Invested)" type="monotone" dataKey="Charlou" stroke="#A855F7" strokeWidth={3} dot={{ r: 4, fill: '#A855F7' }} activeDot={{ r: 8 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Total Pool Tracking */}
            <div className="card" style={{ padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <Wallet size={20} color="var(--green)" />
                <h3 style={{ fontSize: 16 }}>Total Liquidity Pool over Time</h3>
              </div>
              <div style={{ height: 350 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={12} tickLine={false} />
                    <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} tickFormatter={v => `₱${(v/1000).toFixed(0)}k`} />
                    <Tooltip 
                      contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10 }}
                      formatter={(value) => formatCurrency(value)}
                    />
                    <Line name="Combined Pool" type="monotone" dataKey="Total" stroke="#22C55E" strokeWidth={3} fillOpacity={1} fill="url(#colorPool)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
