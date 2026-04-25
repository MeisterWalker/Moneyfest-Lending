import re

with open('src/pages/LoansPage.js', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Add X to lucide-react imports if it's missing
if "X," not in code and " X " not in code:
    code = code.replace("import {\n  Plus,", "import {\n  Plus, X,")

# 2. Add StatusPill
status_pill_code = """
// ─── Status Pill ──────────────────────────────────────────────
function StatusPill({ status }) {
  let bg = 'rgba(255,255,255,0.05)'
  let color = 'var(--text-muted)'
  let label = status

  switch (status) {
    case 'Active':
      bg = 'rgba(34,197,94,0.15)'
      color = 'var(--green)'
      break
    case 'Partially Paid':
      bg = 'rgba(59,130,246,0.15)'
      color = 'var(--blue)'
      break
    case 'Overdue':
      bg = 'rgba(239,68,68,0.15)'
      color = 'var(--red)'
      break
    case 'Extended':
      bg = 'rgba(245,158,11,0.15)'
      color = 'var(--gold)'
      break
    case 'Pending':
      bg = 'rgba(156,163,175,0.15)'
      color = '#9CA3AF'
      break
    case 'Paid':
    case 'Paid Off':
      bg = 'rgba(16,185,129,0.1)'
      color = '#10B981'
      label = 'Paid'
      break
  }

  return (
    <span style={{
      display: 'inline-block',
      padding: '4px 8px',
      borderRadius: '6px',
      fontSize: '11px',
      fontWeight: '700',
      background: bg,
      color: color,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      whiteSpace: 'nowrap'
    }}>
      {label}
    </span>
  )
}
"""
if "function StatusPill" not in code:
    insert_pos = code.find("export default function LoansPage")
    code = code[:insert_pos] + status_pill_code + "\n" + code[insert_pos:]

# 3. Add selectedLoanId state to LoansPage
state_insert_pos = code.find("const [applications, setApplications] = useState([])")
if "const [selectedLoanId, setSelectedLoanId] = useState(null)" not in code:
    code = code[:state_insert_pos] + "const [selectedLoanId, setSelectedLoanId] = useState(null)\n  " + code[state_insert_pos:]

# 4. Modify the render block to use the split layout
render_start = code.find("      ) : (\n        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>\n          {filtered.map(loan => (")
render_end = code.find("          ))}\n        </div>\n      )}\n    </div>\n  )\n}")

if render_end == -1:
    render_end = code.find("          ))}\r\n        </div>\r\n      )}\r\n    </div>\r\n  )\r\n}")

new_render_block = """      ) : (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: selectedLoanId ? '1fr 300px' : '1fr', 
          gap: 20, 
          alignItems: 'start' 
        }}>
          {/* Table Container */}
          <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead style={{ background: 'rgba(255,255,255,0.02)', color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: 11 }}>
                <tr>
                  <th style={{ textAlign: 'left', padding: '12px 20px', fontWeight: 600 }}>Borrower</th>
                  <th style={{ textAlign: 'left', padding: '12px 10px', fontWeight: 600 }}>Type</th>
                  <th style={{ textAlign: 'right', padding: '12px 10px', fontWeight: 600 }}>Amount</th>
                  <th style={{ textAlign: 'right', padding: '12px 10px', fontWeight: 600 }}>Remaining</th>
                  <th style={{ textAlign: 'center', padding: '12px 10px', fontWeight: 600 }}>Progress</th>
                  <th style={{ textAlign: 'right', padding: '12px 10px', fontWeight: 600 }}>Next Due</th>
                  <th style={{ textAlign: 'right', padding: '12px 20px', fontWeight: 600 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(loan => {
                  const b = borrowers.find(x => x.id === loan.borrower_id)
                  const isSelected = selectedLoanId === loan.id
                  const isQuick = loan.loan_type === 'quickloan'
                  
                  // Progress & Due logic
                  let progressDisplay = '-'
                  let dueDisplay = '-'
                  let dueColor = 'var(--text-muted)'
                  let balColor = 'var(--text-label)'
                  
                  if (loan.status === 'Overdue') {
                    balColor = 'var(--red)'
                    dueColor = 'var(--red)'
                  } else if (loan.status === 'Active' && loan.extension_fee_charged) {
                    balColor = 'var(--gold)'
                  }
                  
                  if (isQuick) {
                    const days = getQuickLoanDaysElapsed(loan.release_date)
                    progressDisplay = loan.status === 'Pending' ? '-' : `Day ${days}`
                    const dueDates = loan.release_date ? getQuickLoanDueDates(loan.release_date) : null
                    if (dueDates) {
                      dueDisplay = new Date(dueDates.day30).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
                      const daysUntilDue = Math.ceil((new Date(dueDates.day30) - new Date()) / (1000 * 60 * 60 * 24))
                      if (daysUntilDue <= 1 && daysUntilDue >= 0 && loan.status === 'Active') dueColor = 'var(--gold)'
                    }
                  } else {
                    const numInst = loan.num_installments || 4
                    progressDisplay = `${loan.payments_made || 0}/${numInst}`
                    if (loan.release_date && loan.status !== 'Pending') {
                      const dates = getInstallmentDates(loan.release_date, numInst)
                      const nextIdx = loan.payments_made || 0
                      if (nextIdx < dates.length) {
                        dueDisplay = new Date(dates[nextIdx]).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
                        const daysUntilDue = Math.ceil((new Date(dates[nextIdx]) - new Date()) / (1000 * 60 * 60 * 24))
                        if (daysUntilDue <= 1 && daysUntilDue >= 0 && loan.status === 'Active') dueColor = 'var(--gold)'
                      }
                    }
                  }

                  let displayStatus = loan.status
                  if (isQuick && loan.status === 'Active' && loan.extension_fee_charged) {
                    displayStatus = 'Extended'
                  }

                  return (
                    <tr 
                      key={loan.id} 
                      onClick={() => setSelectedLoanId(loan.id)}
                      style={{ 
                        borderBottom: '1px solid var(--card-border)', 
                        background: isSelected ? 'rgba(59,130,246,0.05)' : 'transparent',
                        cursor: 'pointer',
                        transition: 'background 0.2s ease'
                      }}
                    >
                      <td style={{ padding: '14px 20px', fontWeight: 600 }}>{b?.full_name || 'Unknown'}</td>
                      <td style={{ padding: '14px 10px' }}>
                        <span style={{ 
                          fontSize: 10, fontWeight: 700, padding: '3px 6px', borderRadius: 4, 
                          background: isQuick ? 'rgba(139,92,246,0.1)' : 'rgba(59,130,246,0.1)',
                          color: isQuick ? 'var(--purple)' : 'var(--blue)', textTransform: 'uppercase'
                        }}>
                          {isQuick ? 'QuickLoan' : 'Installment'}
                        </span>
                      </td>
                      <td style={{ padding: '14px 10px', textAlign: 'right' }}>{formatCurrency(loan.loan_amount)}</td>
                      <td style={{ padding: '14px 10px', textAlign: 'right', fontWeight: 600, color: balColor }}>
                        {formatCurrency(loan.remaining_balance)}
                      </td>
                      <td style={{ padding: '14px 10px', textAlign: 'center', color: 'var(--text-label)' }}>{progressDisplay}</td>
                      <td style={{ padding: '14px 10px', textAlign: 'right', color: dueColor, fontWeight: dueColor !== 'var(--text-muted)' ? 600 : 400 }}>{dueDisplay}</td>
                      <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                        <StatusPill status={displayStatus} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Hidden LoanCards for React to not complain if they are mapped elsewhere, but we don't render them */}
          <div style={{ display: 'none' }}>
             {filtered.map(loan => (
              <LoanCard
                key={loan.id}
                loan={loan}
                borrowers={borrowers}
                applications={applications}
                investors={investors}
                onEdit={l => { setEditingLoan(l); setPrefillLoan(null); setModalOpen(true) }}
                onDelete={setDeleteTarget}
                onDefault={setDefaultTarget}
                onRecordPayment={handleRecordPayment}
                onFullPayoff={handleFullPayoff}
                onRenew={handleRenew}
                onConfirmRelease={handleConfirmRelease}
                onQuickLoanPayoff={handleQuickLoanPayoff}
                onQuickLoanDay15Missed={handleQuickLoanDay15Missed}
                onRecordPrincipalPayment={handleRecordPrincipalPayment}
                onAssignInvestor={handleAssignInvestor}
              />
            ))}
          </div>

          {/* Detail Panel */}
          {selectedLoanId && (() => {
            const loan = filtered.find(l => l.id === selectedLoanId)
            if (!loan) return null
            const b = borrowers.find(x => x.id === loan.borrower_id)
            const isQuick = loan.loan_type === 'quickloan'
            let displayStatus = loan.status
            if (isQuick && loan.status === 'Active' && loan.extension_fee_charged) displayStatus = 'Extended'

            return (
              <div className="card" style={{ 
                padding: 0, 
                position: 'sticky', 
                top: 24,
                display: 'flex',
                flexDirection: 'column',
                height: 'fit-content'
              }}>
                {/* Header */}
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--card-border)', background: 'rgba(255,255,255,0.02)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700 }}>{b?.full_name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                        {isQuick ? 'QuickLoan' : 'Installment'} · {loan.release_date ? new Date(loan.release_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Pending'}
                      </div>
                    </div>
                    <button onClick={() => setSelectedLoanId(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}>
                      <X size={16} />
                    </button>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
                    <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'Space Grotesk' }}>{formatCurrency(loan.loan_amount)}</div>
                    <StatusPill status={displayStatus} />
                  </div>
                </div>

                {/* Progress */}
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--card-border)' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Progress</div>
                  {isQuick ? (
                    <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 6, height: 6, width: '100%', overflow: 'hidden' }}>
                      <div style={{ 
                        height: '100%', 
                        background: 'var(--purple)', 
                        width: `${Math.min(100, Math.max(0, (getQuickLoanDaysElapsed(loan.release_date) / 30) * 100))}%` 
                      }} />
                    </div>
                  ) : (
                    <InstallmentProgressBar current={loan.payments_made || 0} total={loan.num_installments || 4} />
                  )}
                </div>

                {/* Key Fields */}
                <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10, borderBottom: '1px solid var(--card-border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{isQuick ? 'Total Owed' : 'Installment'}</span>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{isQuick ? formatCurrency(calcQuickLoanBalance(loan).balance) : formatCurrency(loan.installment_amount)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Total Repayment</span>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{formatCurrency(loan.total_repayment)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Interest Rate</span>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{loan.interest_rate}%</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Security Hold</span>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{formatCurrency(loan.security_hold)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Purpose</span>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{loan.loan_purpose || 'N/A'}</span>
                  </div>
                </div>

                {/* Status Banners */}
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--card-border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {loan.signature_status === 'Signed' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--green)', fontSize: 12, fontWeight: 600 }}>
                      <CheckCircle size={14} /> Contract Signed
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--gold)', fontSize: 12, fontWeight: 600 }}>
                      <AlertTriangle size={14} /> Pending Signature
                    </div>
                  )}

                  {loan.status === 'Overdue' && (() => {
                    let penalty = 0
                    if (isQuick) {
                      const details = calcQuickLoanBalance(loan)
                      penalty = details.penalty
                    } else {
                      const dates = getInstallmentDates(loan.release_date, loan.num_installments || 4)
                      const nextIdx = loan.payments_made || 0
                      if (dates[nextIdx]) {
                        const dueDate = new Date(dates[nextIdx])
                        const daysLate = Math.floor((new Date() - dueDate) / (1000 * 60 * 60 * 24))
                        if (daysLate > 0) {
                          penalty = (loan.installment_amount * 0.05) * daysLate
                        }
                      }
                    }
                    if (penalty > 0) {
                      return (
                        <div style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--red)', padding: '8px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                          <AlertTriangle size={14} /> +{formatCurrency(penalty)} penalty accrued
                        </div>
                      )
                    }
                    return null
                  })()}
                </div>

                {/* Actions */}
                <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {/* Contextual Buttons */}
                  {loan.status === 'Pending' && (
                    <button className="btn-primary" style={{ width: '100%', display: 'flex', justifyContent: 'center' }} onClick={() => handleConfirmRelease(loan)}>
                      Confirm Release
                    </button>
                  )}
                  
                  {isQuick && loan.status === 'Active' && !loan.extension_fee_charged && (
                    <button className="btn-primary" style={{ width: '100%', display: 'flex', justifyContent: 'center' }} onClick={() => handleQuickLoanPayoff(loan)}>
                      Record Full Payoff
                    </button>
                  )}
                  {isQuick && loan.status === 'Active' && !loan.extension_fee_charged && (
                    <button className="btn-primary" style={{ width: '100%', background: 'rgba(245,158,11,0.1)', color: 'var(--gold)', border: '1px solid rgba(245,158,11,0.3)', display: 'flex', justifyContent: 'center' }} onClick={() => handleQuickLoanDay15Missed(loan)}>
                      Record Extension
                    </button>
                  )}
                  
                  {isQuick && loan.status === 'Active' && loan.extension_fee_charged && (
                    <button className="btn-primary" style={{ width: '100%', display: 'flex', justifyContent: 'center' }} onClick={() => handleQuickLoanPayoff(loan)}>
                      Record Full Payoff
                    </button>
                  )}

                  {isQuick && loan.status === 'Overdue' && (
                    <button className="btn-primary" style={{ width: '100%', display: 'flex', justifyContent: 'center' }} onClick={() => handleQuickLoanPayoff(loan)}>
                      Record Full Payoff
                    </button>
                  )}

                  {!isQuick && ['Active', 'Partially Paid'].includes(loan.status) && (
                    <>
                      <button className="btn-primary" style={{ width: '100%', display: 'flex', justifyContent: 'center' }} onClick={() => handleRecordPayment(loan)}>
                        Record Payment
                      </button>
                      <button className="btn-primary" style={{ width: '100%', background: 'rgba(34,197,94,0.1)', color: 'var(--green)', border: '1px solid rgba(34,197,94,0.3)', display: 'flex', justifyContent: 'center' }} onClick={() => handleFullPayoff(loan)}>
                        Full Payoff
                      </button>
                    </>
                  )}
                  
                  {!isQuick && loan.status === 'Overdue' && (
                    <>
                      <button className="btn-primary" style={{ width: '100%', display: 'flex', justifyContent: 'center' }} onClick={() => handleRecordPayment(loan)}>
                        Record Payment
                      </button>
                    </>
                  )}

                  {/* Common Actions */}
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <button className="btn-secondary" style={{ flex: 1, display: 'flex', justifyContent: 'center' }} onClick={() => { setEditingLoan(loan); setPrefillLoan(null); setModalOpen(true) }}>
                      Edit
                    </button>
                    {['Active', 'Partially Paid', 'Overdue'].includes(loan.status) && (
                      <button className="btn-secondary" style={{ flex: 1, display: 'flex', justifyContent: 'center', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.3)' }} onClick={() => setDefaultTarget(loan)}>
                        Default
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })()}

        </div>
"""

# Implement the CSS Grid responsive stacking (<640px)
# We can do this inline by injecting a <style> tag or using a media query class if available.
# We'll inject a small style tag right before the grid.
responsive_style = """
        <style>{`
          .split-layout {
            display: grid;
            gap: 20px;
            align-items: start;
          }
          @media (min-width: 800px) {
            .split-layout {
              grid-template-columns: ${selectedLoanId ? '1fr 300px' : '1fr'};
            }
          }
          @media (max-width: 799px) {
            .split-layout {
              grid-template-columns: 1fr;
              display: flex;
              flex-direction: column;
            }
          }
        `}</style>
        <div className="split-layout">
"""
new_render_block = new_render_block.replace("<div style={{ \n          display: 'grid', \n          gridTemplateColumns: selectedLoanId ? '1fr 300px' : '1fr', \n          gap: 20, \n          alignItems: 'start' \n        }}>", responsive_style)

code = code[:render_start] + new_render_block + code[render_end:]

with open('src/pages/LoansPage.js', 'w', encoding='utf-8') as f:
    f.write(code)

print("LoansPage.js rewritten successfully.")
