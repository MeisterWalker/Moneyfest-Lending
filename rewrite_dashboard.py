import re

with open('src/pages/DashboardPage.js', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. INSTALLMENT TAB
install_start = code.find("{/* ── INSTALLMENT LOAN DASHBOARD ── */}")
install_end = code.find("{/* ── QUICKLOAN DASHBOARD ── */}")

install_block = code[install_start:install_end]

new_install_block = """{/* ── INSTALLMENT LOAN DASHBOARD ── */}
      {dashTab === 'installment' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* New Slim Info Bar */}
          {(() => {
            const today = new Date()
            const day = today.getDate()
            const isCutoffDay = day === 5 || day === 20
            let nextCutoff
            if (day < 5) nextCutoff = new Date(today.getFullYear(), today.getMonth(), 5)
            else if (day < 20) nextCutoff = new Date(today.getFullYear(), today.getMonth(), 20)
            else nextCutoff = new Date(today.getFullYear(), today.getMonth() + 1, 5)
            const daysLeft = Math.ceil((nextCutoff - today) / (1000 * 60 * 60 * 24))
            const nextCutoffStr = nextCutoff.toISOString().slice(0, 10)
            const dueLoans = loans.filter(l => {
              if (!['Active', 'Partially Paid'].includes(l.status) || l.loan_type === 'quickloan') return false
              const dates = getInstallmentDates(l.release_date, l.num_installments || 4)
              const nextIdx = l.payments_made || 0
              return dates[nextIdx] === nextCutoffStr
            })
            return (
              <div style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', padding: '12px 20px', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Calendar size={16} color="var(--blue)" />
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--blue)' }}>
                    {isCutoffDay ? 'Today is Cutoff Day!' : `Next Cutoff in ${daysLeft} days`}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  {dueLoans.length} borrowers due
                </div>
              </div>
            )
          })()}

          {/* Operations Stat Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <StatCard label="Amount Lent Out" value={formatCurrency(amountLentOut)} sub={`${activeLoans.length} active loans`} icon={CreditCard} color="var(--purple)" />
            <StatCard label="Available Liquidity" value={formatCurrency(Math.max(0, availableLiquidity))} sub="Ready to lend" icon={Banknote} color="var(--green)" />
            <StatCard label="Default Rate" value={`${defaultRate.toFixed(1)}%`} sub={`${defaultedLoans.length} defaulted`} icon={AlertTriangle} color={defaultRate > 10 ? 'var(--red)' : 'var(--gold)'} />
          </div>

          {/* Overdue Escalation Alerts */}
          {loans.filter(l => l.status === 'Overdue' && l.loan_type !== 'quickloan').map(loan => {
            const b = borrowers.find(x => x.id === loan.borrower_id)
            return (
              <div key={loan.id} style={{
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
                borderLeft: '4px solid var(--red)', borderRadius: 12, padding: '16px 20px',
                display: 'flex', alignItems: 'flex-start', gap: 14
              }}>
                <AlertTriangle size={20} color="var(--red)" style={{ flexShrink: 0, marginTop: 2 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}><span style={{ display: "flex", alignItems: "center", gap: 6 }}><img src="/warning.png" alt="warning" style={{ width: 16, height: 16, objectFit: "contain" }} />Overdue — {b?.full_name}</span></div>
                  <div style={{ fontSize: 13, color: 'var(--text-label)' }}>
                    Loan of {formatCurrency(loan.loan_amount)} · {loan.payments_made} of {loan.num_installments || 4} paid · Balance {formatCurrency(loan.remaining_balance)}
                  </div>
                </div>
              </div>
            )
          })}

          {/* Two-Column Layout */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24, alignItems: 'start' }}>
            {/* Left: Active Loans */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--card-border)', fontWeight: 700 }}>Active Installments</div>
              <div style={{ maxHeight: 500, overflowY: 'auto' }}>
                {activeLoans.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No active installments.</div>
                ) : activeLoans.map(loan => {
                  const b = borrowers.find(x => x.id === loan.borrower_id)
                  return (
                    <div key={loan.id} style={{ padding: '16px 20px', borderBottom: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{b?.full_name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loan: {formatCurrency(loan.loan_amount)}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-label)' }}>Bal: {formatCurrency(loan.remaining_balance)}</div>
                        <StatusPill status={loan.status} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Right: Collection Efficiency & Earnings */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div style={{ background: 'var(--card-bg)', borderRadius: 16, border: '1px solid var(--card-border)' }}>
                <EfficiencyCard 
                  rate={efficiencyRate} 
                  onTime={totalInstallmentsDue} 
                  total={totalExpectedInstallments || 1} 
                  onToggleBreakdown={() => setShowEfficiencyBreakdown(!showEfficiencyBreakdown)}
                  isExpanded={showEfficiencyBreakdown}
                />
                {showEfficiencyBreakdown && (
                  <CollectionEfficiencyBreakdown 
                    borrowers={borrowers} 
                    loans={loans} 
                    penaltyCharges={penaltyCharges} 
                    resetDate={resetDate}
                  />
                )}
                
                <div style={{ padding: '20px', borderTop: '1px solid var(--card-border)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 16, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Earnings Summary</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ color: 'var(--text-label)', fontSize: 13 }}>Net Profit</span>
                    <span style={{ fontWeight: 700, color: 'var(--green)' }}>{formatCurrency(totalProfit)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ color: 'var(--text-label)', fontSize: 13 }}>This Month</span>
                    <span style={{ fontWeight: 700, color: 'var(--teal)' }}>{formatCurrency(profitThisMonth)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-label)', fontSize: 13 }}>ROI</span>
                    <span style={{ fontWeight: 700, color: 'var(--purple)' }}>{roi.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
"""

cutoff_start = install_block.find("{/* ── Cutoff Profit Breakdown ── */}")
cutoff_end = install_block.find("        </div>\n      )}")
if cutoff_end == -1:
    cutoff_end = install_block.find("        </div>\r\n      )}")

if cutoff_start != -1 and cutoff_end != -1:
    cutoff_block = install_block[cutoff_start:cutoff_end]
    new_install_block += "\n          " + cutoff_block + "\n        </div>\n      )}\n\n"

code = code[:install_start] + new_install_block + code[install_end:]

# 2. QUICKLOAN TAB
ql_start = code.find("{/* ── QUICKLOAN DASHBOARD ── */}")
ql_end = code.rfind("</div>\n  )\n}")

if ql_end == -1:
    ql_end = code.rfind("</div>\r\n  )\r\n}")

new_ql_block = """{/* ── QUICKLOAN DASHBOARD ── */}
      {dashTab === 'quickloan' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* QuickLoan StatCards (4 only) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            <StatCard label="Amount Lent Out" value={formatCurrency(qlAmountLentOut)} sub={`${activeQuickLoans.length} active loans`} icon={CreditCard} color="var(--purple)" />
            <StatCard label="Total Profit" value={formatCurrency(qlTotalInterestEarned)} sub="All-time interest earned" icon={TrendingUp} color="var(--green)" />
            <StatCard label="Profit This Month" value={formatCurrency(qlProfitThisMonth)} sub="30-day earnings" icon={Calendar} color="var(--teal)" />
            <StatCard label="ROI" value={`${qlRoi.toFixed(1)}%`} sub="Return on capital" icon={TrendingUp} color="var(--gold)" />
          </div>

          {/* Active QuickLoans List */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--card-border)', fontWeight: 700 }}>Active QuickLoans</div>
            {activeQuickLoans.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No active QuickLoans.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: 'rgba(255,255,255,0.02)', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '12px 20px' }}>Borrower</th>
                    <th style={{ textAlign: 'left', padding: '12px 10px' }}>Release Date</th>
                    <th style={{ textAlign: 'center', padding: '12px 10px' }}>Day Count</th>
                    <th style={{ textAlign: 'right', padding: '12px 20px' }}>Total Owed</th>
                    <th style={{ textAlign: 'right', padding: '12px 20px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {activeQuickLoans.map(loan => {
                    const b = borrowers.find(x => x.id === loan.borrower_id)
                    const details = calcQuickLoanBalance(loan)
                    const days = Math.floor((new Date() - new Date(loan.release_date)) / (1000 * 60 * 60 * 24))
                    return (
                      <tr key={loan.id} style={{ borderBottom: '1px solid var(--card-border)' }}>
                        <td style={{ padding: '14px 20px', fontWeight: 600 }}>{b?.full_name || 'Unknown'}</td>
                        <td style={{ padding: '14px 10px', fontSize: 13 }}>{new Date(loan.release_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                        <td style={{ padding: '14px 10px', textAlign: 'center', fontSize: 13 }}>Day {days}</td>
                        <td style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 700, color: 'var(--text-label)' }}>{formatCurrency(details.balance)}</td>
                        <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                          <StatusPill status={loan.status === 'Active' && loan.extension_fee_charged ? 'Extended' : loan.status} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Profit Trail */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <TrendingUp size={16} color="#F59E0B" />
              </div>
              <div>
                <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 16 }}>Profit Trail</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Unified view of extension profit and full payoffs</div>
              </div>
            </div>
            
            {(() => {
              // 1. Extension Payments (from capital_flow notes)
              const extensionEvents = capitalEntries.filter(c => c.category === 'Interest Profit (QuickLoan)' && c.type === 'CASH IN' && c.notes && c.notes.toLowerCase().includes('extension'))
                .map(c => {
                  let borrowerName = 'Unknown'
                  const match = c.notes.match(/from (.*?) payment/i)
                  if (match) borrowerName = match[1]
                  else if (c.notes.includes('-')) borrowerName = c.notes.split('-')[1].trim()
                  
                  return {
                    id: `ext-${c.id}`,
                    date: new Date(c.created_at),
                    borrowerName,
                    earned: c.amount,
                    statusLabel: 'Extended',
                    subLabel: `Day extension event`,
                    profitLabel: 'extension profit',
                    isExt: true
                  }
                })
              
              // 2. Paid QuickLoans
              const payoffEvents = paidQuickLoans.map(loan => {
                const b = borrowers.find(x => x.id === loan.borrower_id)
                const earned = parseFloat(((loan.total_repayment || 0) - (loan.loan_amount || 0)).toFixed(2))
                return {
                  id: `paid-${loan.id}`,
                  date: new Date(loan.updated_at || loan.created_at),
                  borrowerName: b?.full_name || 'Unknown',
                  earned,
                  statusLabel: 'Paid',
                  subLabel: `${formatCurrency(loan.loan_amount)} principal · Paid`,
                  profitLabel: loan.extension_fee_charged ? '10-day profit + ext' : 'full payoff',
                  isExt: false
                }
              })
              
              extensionEvents.sort((a,b) => b.date - a.date)
              payoffEvents.sort((a,b) => b.date - a.date)

              const renderEvent = (evt, color) => (
                <div key={evt.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <CheckCircle2 size={18} color={color} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                        {evt.borrowerName}
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: color === 'var(--gold)' ? 'rgba(245,158,11,0.1)' : 'rgba(34,197,94,0.1)', color }}>
                          {evt.statusLabel}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                        {evt.date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })} · {evt.subLabel}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--green)' }}>+{formatCurrency(evt.earned)}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{evt.profitLabel}</div>
                  </div>
                </div>
              )

              return (
                <div>
                  <div style={{ padding: '12px 24px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--card-border)', fontSize: 12, fontWeight: 600, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Extension Payments
                  </div>
                  {extensionEvents.length === 0 ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No extension payments recorded.</div>
                  ) : extensionEvents.map(evt => renderEvent(evt, 'var(--gold)'))}
                  
                  <div style={{ padding: '12px 24px', background: 'rgba(255,255,255,0.02)', borderTop: '1px solid var(--card-border)', borderBottom: '1px solid var(--card-border)', fontSize: 12, fontWeight: 600, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Paid Off
                  </div>
                  {payoffEvents.length === 0 ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No paid off loans recorded.</div>
                  ) : payoffEvents.map(evt => renderEvent(evt, 'var(--green)'))}
                </div>
              )
            })()}
          </div>
        </div>
      )}
"""

code = code[:ql_start] + new_ql_block + "\n    </div>\n  )\n}\n\nexport default DashboardPage"

with open('src/pages/DashboardPage.js', 'w', encoding='utf-8') as f:
    f.write(code)

print("Dashboard successfully rewritten.")
