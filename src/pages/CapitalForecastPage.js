import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { formatCurrency, getInstallmentDates, formatDateValue } from '../lib/helpers'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'
import { 
  Banknote, CreditCard, Calendar, TrendingUp, 
  Clock, AlertTriangle, ArrowRight, User 
} from 'lucide-react'

// ─── Stat Card Component ──────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, color }) {
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
      </div>
      <div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
        <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 24, color: 'var(--text-primary)', lineHeight: 1.1 }}>{value}</div>
        {sub && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{sub}</div>}
      </div>
    </div>
  )
}

export default function CapitalForecastPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  
  const [loading, setLoading] = useState(true)
  const [loans, setLoans] = useState([])
  const [capitalEntries, setCapitalEntries] = useState([])
  const [borrowers, setBorrowers] = useState([])
  const [settings, setSettings] = useState(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [{ data: l }, { data: cf }, { data: b }, { data: s }] = await Promise.all([
        supabase.from('loans').select('*'),
        supabase.from('capital_flow').select('*'),
        supabase.from('borrowers').select('id, full_name'),
        supabase.from('settings').select('*').eq('id', 1).single()
      ])
      
      setLoans(l || [])
      setCapitalEntries(cf || [])
      setBorrowers(b || [])
      setSettings(s)
    } catch (err) {
      console.error('Forecast fetch error:', err)
      toast('Failed to load forecast data', 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Calculations ──
  const activeInstallmentLoans = loans.filter(l => 
    l.loan_type !== 'quickloan' && 
    ['Active', 'Partially Paid', 'Overdue'].includes(l.status))

  const activeQuickLoans = loans.filter(l => 
    l.loan_type === 'quickloan' && 
    ['Active', 'Overdue'].includes(l.status))

  const totalCashIn = capitalEntries
    .filter(c => c.type === 'CASH IN')
    .reduce((sum, c) => sum + (c.amount || 0), 0)

  const totalCashOut = capitalEntries
    .filter(c => c.type === 'CASH OUT')
    .reduce((sum, c) => sum + (c.amount || 0), 0)

  const totalDeployed = 
    activeInstallmentLoans.reduce((sum, l) => sum + (l.loan_amount || 0), 0) +
    activeQuickLoans.reduce((sum, l) => sum + (l.loan_amount || 0), 0)

  const currentCashOnHand = totalCashIn - totalCashOut - totalDeployed

  // ── Next 4 Cutoff Dates ──
  const getNextCutoffs = () => {
    const today = new Date()
    const day = today.getDate()
    const month = today.getMonth()
    const year = today.getFullYear()
    const cutoffs = []
    
    let d = day < 5 ? 5 : day < 20 ? 20 : 5
    let m = (day >= 5 && day < 20) ? month : (day < 5 ? month : month + 1)
    let y = year
    if (m > 11) { m = 0; y += 1 }
    
    for (let i = 0; i < 4; i++) {
      cutoffs.push(new Date(y, m, d))
      if (d === 5) {
        d = 20
      } else {
        d = 5
        m += 1
        if (m > 11) { m = 0; y += 1 }
      }
    }
    return cutoffs
  }

  const nextCutoffs = getNextCutoffs()
  const nextCutoffDate = nextCutoffs[0]
  const nextCutoffStr = formatDateValue(nextCutoffDate)

  // Calculate Next Cutoff Totals (Optimistic vs Conservative)
  const nextCutoffLoans = activeInstallmentLoans.filter(l => {
    const dates = getInstallmentDates(l.release_date, l.num_installments || 4)
    const unpaidDates = dates.slice(l.payments_made || 0)
    return unpaidDates.some(d => formatDateValue(d) === nextCutoffStr)
  })
  
  const nextOptimisticTotal = nextCutoffLoans.reduce((sum, l) => sum + (l.installment_amount || 0), 0)
  const nextConservativeTotal = nextCutoffLoans
    .filter(l => l.status !== 'Overdue')
    .reduce((sum, l) => sum + (l.installment_amount || 0), 0)

  // QuickLoan Details
  const quickLoanData = activeQuickLoans.map(l => {
    const borrower = borrowers.find(b => b.id === l.borrower_id)
    const releaseDate = new Date(l.release_date)
    const daysElapsed = Math.floor((new Date() - releaseDate) / (1000 * 60 * 60 * 24))
    const principal = l.loan_amount || 0
    const interest = parseFloat((principal * 0.1 / 30 * daysElapsed).toFixed(2))
    const fee = l.extension_fee_charged ? 100 : 0
    const penalty = daysElapsed > 30 ? (daysElapsed - 30) * 25 : 0
    const totalOwed = principal + interest + fee + penalty
    
    const day15 = new Date(releaseDate)
    day15.setDate(day15.getDate() + 15)
    const day30 = new Date(releaseDate)
    day30.setDate(day30.getDate() + 30)

    let phase = 'Active'
    let phaseColor = 'var(--green)'
    if (daysElapsed > 30) { phase = 'Penalty'; phaseColor = 'var(--red)' }
    else if (daysElapsed > 15) { phase = 'Extended'; phaseColor = '#F59E0B' }

    return { 
      id: l.id, 
      name: borrower?.full_name || 'Unknown', 
      principal, daysElapsed, interest, fee, penalty, totalOwed, 
      day15, day30, phase, phaseColor 
    }
  })

  // Capacity calculations
  const capCash = Math.max(0, currentCashOnHand)
  
  // Re-lending capacity counts
  const getCapacity = (cash) => ({
    k5: Math.floor(cash / 5000),
    k3: Math.floor(cash / 3000),
    k7: Math.floor(cash / 7000)
  })

  if (loading) return (
    <div style={{ padding: 40, color: 'var(--text-muted)', textAlign: 'center' }}>
      Loading Forecast...
    </div>
  )

  return (
    <div style={{ padding: '32px 28px', maxWidth: 1200, margin: '0 auto', fontFamily: 'DM Sans, sans-serif' }}>
      <div className="page-header" style={{ marginBottom: 32 }}>
        <div>
          <h1 className="page-title" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Capital Flow Forecast</h1>
          <p className="page-subtitle">Projected liquidity and collection timeline</p>
        </div>
      </div>

      {/* SECTION 1 — CURRENT POOL SNAPSHOT */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20, marginBottom: 40 }}>
        <StatCard 
          label="Current Cash on Hand" 
          value={formatCurrency(capCash)} 
          sub={currentCashOnHand <= 0 ? 'Fully deployed' : 'Ready to lend'} 
          icon={Banknote} 
          color={currentCashOnHand > 0 ? 'var(--green)' : 'var(--red)'} 
        />
        <StatCard 
          label="Total Deployed" 
          value={formatCurrency(totalDeployed)} 
          sub={`${activeInstallmentLoans.length + activeQuickLoans.length} active loans total`} 
          icon={CreditCard} 
          color="var(--blue)" 
        />
        <StatCard 
          label="Next Collection" 
          value={formatCurrency(nextOptimisticTotal)} 
          sub={`Due ${nextCutoffDate.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}`} 
          icon={Calendar} 
          color="var(--gold)" 
        />
        <StatCard 
          label="Projected After Collection" 
          value={formatCurrency(capCash + nextConservativeTotal)} 
          sub={`Up to ${formatCurrency(capCash + nextOptimisticTotal)} if all pay`} 
          icon={TrendingUp} 
          color="var(--purple)" 
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: 32, alignItems: 'start' }}>
        
        {/* SECTION 2 — CUTOFF TIMELINE */}
        <div>
          <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 18, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Clock size={20} color="var(--blue)" />
            Collection Timeline (Next 4 Cutoffs)
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {(() => {
              let rollingConservativePool = capCash
              return nextCutoffs.map((cutoff, idx) => {
                const cutoffStr = formatDateValue(cutoff)
                const dueLoans = activeInstallmentLoans.filter(l => {
                  const dates = getInstallmentDates(l.release_date, l.num_installments || 4)
                  const unpaidDates = dates.slice(l.payments_made || 0)
                  return unpaidDates.some(d => formatDateValue(d) === cutoffStr)
                })
                
                const expectedOptimistic = dueLoans.reduce((sum, l) => sum + (l.installment_amount || 0), 0)
                const expectedConservative = dueLoans
                  .filter(l => l.status !== 'Overdue')
                  .reduce((sum, l) => sum + (l.installment_amount || 0), 0)
                
                const atRiskAmount = expectedOptimistic - expectedConservative
                const overdueLoans = dueLoans.filter(l => l.status === 'Overdue')
                
                rollingConservativePool += expectedConservative
                const fillPercent = Math.min(100, (rollingConservativePool / (totalDeployed || 1)) * 100)

                return (
                  <div key={idx} style={{ 
                    background: 'rgba(255,255,255,0.02)', 
                    border: '1px solid rgba(255,255,255,0.06)', 
                    borderRadius: 12, 
                    padding: '24px' 
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                      <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 16, color: 'var(--text-primary)' }}>
                        {cutoff.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--green)' }}>
                        +{formatCurrency(expectedOptimistic)}
                      </div>
                    </div>

                    {/* TWO SCENARIOS TABLE */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: 'rgba(255,255,255,0.06)', borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
                      <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px' }}>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>If all pay</div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--green)', fontFamily: 'Space Grotesk' }}>
                          {formatCurrency(capCash + expectedOptimistic)}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>Optimistic</div>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px' }}>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Excluding at-risk</div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--gold)', fontFamily: 'Space Grotesk' }}>
                          {formatCurrency(capCash + expectedConservative)}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>Conservative</div>
                      </div>
                    </div>

                    {atRiskAmount > 0 && (
                      <div style={{ fontSize: 12, color: '#F59E0B', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
                        <AlertTriangle size={14} />
                        {formatCurrency(atRiskAmount)} at risk from {overdueLoans.length} overdue borrower(s)
                      </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                      {dueLoans.length === 0 ? (
                        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No collections scheduled</div>
                      ) : (
                        dueLoans.map(loan => {
                          const b = borrowers.find(x => x.id === loan.borrower_id)
                          const isRisk = loan.status === 'Overdue'
                          return (
                            <div key={loan.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: isRisk ? '#F59E0B' : 'var(--text-label)' }}>
                                <User size={14} />
                                {b?.full_name}
                                {isRisk && (
                                  <span style={{ fontSize: 10, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>
                                    ⚠️ AT RISK
                                  </span>
                                )}
                              </div>
                              <div style={{ fontWeight: 600, color: isRisk ? '#F59E0B' : 'var(--text-primary)' }}>
                                {formatCurrency(loan.installment_amount)}
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>

                    <div style={{ paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.03)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 8 }}>
                        <span style={{ color: 'var(--text-muted)' }}>Running Projected Pool (Conservative)</span>
                        <span style={{ fontWeight: 800, color: 'var(--purple)' }}>{formatCurrency(rollingConservativePool)}</span>
                      </div>
                      <div style={{ height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${fillPercent}%`, background: 'var(--purple)', borderRadius: 2 }} />
                      </div>
                    </div>
                  </div>
                )
              })
            })()}
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          
          {/* SECTION 3 — QUICKLOAN RETURNS */}
          <div className="card" style={{ padding: 24 }}>
            <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 16, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
              <TrendingUp size={18} color="#F59E0B" />
              QuickLoan Returns
            </h3>
            {quickLoanData.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>No active QuickLoans — ₱0 outstanding</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {quickLoanData.map(ql => (
                  <div key={ql.id} style={{ paddingBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{ql.name}</div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: ql.phaseColor, background: `${ql.phaseColor}15`, padding: '2px 8px', borderRadius: 6 }}>
                        {ql.phase.toUpperCase()}
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                      <span>Principal: {formatCurrency(ql.principal)}</span>
                      <span>Owed: <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{formatCurrency(ql.totalOwed)}</span></span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      Due: {ql.day15.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })} (Day 15) · 
                      Elapsed: {ql.daysElapsed} days
                    </div>
                  </div>
                ))}
                <div style={{ paddingTop: 8, fontSize: 13 }}>
                  Total QL Deployed: <span style={{ fontWeight: 800 }}>{formatCurrency(quickLoanData.reduce((sum, q) => sum + q.principal, 0))}</span>
                </div>
              </div>
            )}
          </div>

          {/* SECTION 4 — RE-LENDING CAPACITY */}
          <div className="card" style={{ padding: 24 }}>
            <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 16, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
              <Banknote size={18} color="var(--green)" />
              Re-lending Capacity
            </h3>
            
            {capCash <= 0 && nextOptimisticTotal <= 0 ? (
              <div style={{ color: '#F59E0B', background: 'rgba(245,158,11,0.08)', padding: '16px', borderRadius: 8, fontSize: 14, fontWeight: 500 }}>
                All funds currently deployed — await next collection on {nextCutoffDate.toLocaleDateString('en-PH', { month: 'long', day: 'numeric' })}
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Current Capacity (Today)</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                    <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', padding: '12px 4px', borderRadius: 8 }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>{getCapacity(capCash).k5}</div>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>₱5k</div>
                    </div>
                    <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', padding: '12px 4px', borderRadius: 8 }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>{getCapacity(capCash).k3}</div>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>₱3k QL</div>
                    </div>
                    <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', padding: '12px 4px', borderRadius: 8 }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>{getCapacity(capCash).k7}</div>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>₱7k</div>
                    </div>
                  </div>
                </div>

                <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 12 }}>Projected After {nextCutoffDate.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}</div>
                  
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 10, color: 'var(--green)', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase' }}>Optimistic Capacity</div>
                    <div style={{ display: 'flex', gap: 20, fontSize: 13 }}>
                      <span>₱5k: <strong>{getCapacity(capCash + nextOptimisticTotal).k5}</strong></span>
                      <span>₱3k: <strong>{getCapacity(capCash + nextOptimisticTotal).k3}</strong></span>
                      <span>₱7k: <strong>{getCapacity(capCash + nextOptimisticTotal).k7}</strong></span>
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 10, color: 'var(--gold)', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase' }}>Conservative Capacity</div>
                    <div style={{ display: 'flex', gap: 20, fontSize: 13 }}>
                      <span>₱5k: <strong>{getCapacity(capCash + nextConservativeTotal).k5}</strong></span>
                      <span>₱3k: <strong>{getCapacity(capCash + nextConservativeTotal).k3}</strong></span>
                      <span>₱7k: <strong>{getCapacity(capCash + nextConservativeTotal).k7}</strong></span>
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 16, lineHeight: 1.4 }}>
                  Conservative capacity excludes <span style={{ color: 'var(--gold)' }}>{formatCurrency(nextOptimisticTotal - nextConservativeTotal)}</span> from overdue borrowers.
                </div>
              </>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
