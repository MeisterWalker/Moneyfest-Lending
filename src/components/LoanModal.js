import { useState, useEffect } from 'react'
import { X, DollarSign, Calendar, Zap, FileText } from 'lucide-react'
import { getNextCutoffDate, formatCurrency, getInstallmentDates, formatDateValue, getNumInstallments, QUICKLOAN_CONFIG, calcQuickLoanAccruedInterest, getQuickLoanDueDates } from '../lib/helpers'

function getNextTwoCutoffs() {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()
  const day = today.getDate()
  const cutoffs = []
  if (day < 5) {
    cutoffs.push(new Date(year, month, 5))
    cutoffs.push(new Date(year, month, 20))
  } else if (day < 20) {
    cutoffs.push(new Date(year, month, 20))
    cutoffs.push(new Date(year, month + 1, 5))
  } else {
    cutoffs.push(new Date(year, month + 1, 5))
    cutoffs.push(new Date(year, month + 1, 20))
  }
  return cutoffs
}

export default function LoanModal({ isOpen, onClose, onSave, loan, borrower, borrowers, settings, prefill }) {
  const isEdit = !!loan
  const nextCutoff = getNextCutoffDate()

  const [form, setForm] = useState({
    borrower_id: '',
    loan_type: 'regular',
    loan_amount: '',
    interest_rate: settings?.interest_rate || 0.07,
    loan_term: 2,
    release_date: formatDateValue(nextCutoff),
    agreement_confirmed: false,
    loan_purpose: '',
    notes: ''
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    if (loan) {
      setForm({
        borrower_id: loan.borrower_id || '',
        loan_type: loan.loan_type || 'regular',
        loan_amount: loan.loan_amount || '',
        interest_rate: loan.interest_rate || 0.07,
        loan_term: loan.loan_term || 2,
        release_date: loan.release_date || formatDateValue(nextCutoff),
        agreement_confirmed: loan.agreement_confirmed || false,
        loan_purpose: loan.loan_purpose || '',
        notes: loan.notes || ''
      })
    } else if (prefill) {
      setForm({
        borrower_id: prefill.borrower_id || '',
        loan_type: prefill.loan_type || 'regular',
        loan_amount: prefill.loan_amount || '',
        interest_rate: prefill.interest_rate || settings?.interest_rate || 0.07,
        loan_term: prefill.loan_term || 2,
        release_date: formatDateValue(nextCutoff),
        agreement_confirmed: false,
        loan_purpose: prefill.loan_purpose || '',
        notes: ''
      })
    } else {
      setForm({
        borrower_id: borrower?.id || '',
        loan_type: 'regular',
        loan_amount: '',
        interest_rate: settings?.interest_rate || 0.07,
        loan_term: 2,
        release_date: formatDateValue(nextCutoff),
        agreement_confirmed: false,
        loan_purpose: '',
        notes: ''
      })
    }
  }, [isOpen, loan, borrower, prefill])

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const isQuickLoan = form.loan_type === 'quickloan'
  const selectedBorrower = borrower || borrowers?.find(b => b.id === form.borrower_id)
  const maxLoan = isQuickLoan ? QUICKLOAN_CONFIG.MAX_AMOUNT : (selectedBorrower?.loan_limit || settings?.max_loan_amount || 10000)
  const minLoan = isQuickLoan ? 500 : 5000
  const amount = parseFloat(form.loan_amount) || 0

  // Installment loan calcs
  const rate = parseFloat(form.interest_rate) || 0.07
  const loanTerm = parseInt(form.loan_term) || 2
  const numInstallments = getNumInstallments(loanTerm)
  const totalRepayment = amount * (1 + rate * loanTerm)
  const installmentAmount = Math.ceil(totalRepayment / numInstallments)
  const adjustedTotal = installmentAmount * numInstallments
  const dueDate = form.release_date ? (() => {
    const dates = getInstallmentDates(form.release_date, numInstallments)
    return dates.length === numInstallments ? dates[numInstallments - 1] : null
  })() : null
  const cutoffs = getNextTwoCutoffs()

  // QuickLoan calcs
  const qlDailyInterest = parseFloat((amount * QUICKLOAN_CONFIG.DAILY_RATE).toFixed(2))
  const qlDay15Interest = calcQuickLoanAccruedInterest(amount, 15)
  const qlDay15Total = parseFloat((amount + qlDay15Interest).toFixed(2))
  const { day15, day30 } = form.release_date ? getQuickLoanDueDates(form.release_date) : { day15: null, day30: null }

  const handleSave = async () => {
    if (!form.borrower_id && !borrower) return alert('Please select a borrower')
    if (!form.loan_amount) return alert('Please enter a loan amount')
    if (amount < minLoan) return alert(`Minimum loan amount is ₱${minLoan.toLocaleString()}`)
    if (amount > maxLoan) return alert(`Maximum loan amount is ₱${maxLoan.toLocaleString()}`)
    if (!form.agreement_confirmed) return alert('Please confirm the loan agreement')
    setSaving(true)
    if (isQuickLoan) {
      await onSave({
        ...form,
        borrower_id: borrower?.id || form.borrower_id,
        loan_type: 'quickloan',
        loan_amount: amount,
        interest_rate: QUICKLOAN_CONFIG.MONTHLY_RATE,
        loan_term: null,
        num_installments: 1,
        total_repayment: qlDay15Total,
        installment_amount: qlDay15Total,
        due_date: day15 ? formatDateValue(day15) : null,
        remaining_balance: amount,
        loan_purpose: form.loan_purpose,
        extension_fee_charged: false,
        status: 'Pending'
      }, isEdit)
    } else {
      await onSave({
        ...form,
        borrower_id: borrower?.id || form.borrower_id,
        loan_type: 'regular',
        loan_amount: amount,
        interest_rate: rate,
        loan_term: loanTerm,
        num_installments: numInstallments,
        total_repayment: adjustedTotal,
        installment_amount: installmentAmount,
        due_date: dueDate ? formatDateValue(dueDate) : formatDateValue(new Date()),
        remaining_balance: adjustedTotal,
        loan_purpose: form.loan_purpose,
        status: 'Pending'
      }, isEdit)
    }
    setSaving(false)
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 580 }}>
        <div style={{ padding: '24px 28px 20px', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontFamily: 'Space Grotesk', fontSize: 18, fontWeight: 700 }}>
              {prefill ? '🔄 Renew Loan' : isEdit ? 'Edit Loan' : 'New Loan Application'}
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
              {selectedBorrower ? `Borrower: ${selectedBorrower.full_name}` : 'Fill in loan details below'}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
        </div>

        <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Loan Type Toggle */}
          {!isEdit && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-label)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Loan Type</div>
              <div style={{ display: 'flex', gap: 10 }}>
                {[
                  { value: 'regular', label: 'Installment Loan', desc: '2–3 month · semi-monthly payments' },
                  { value: 'quickloan', label: '⚡ QuickLoan', desc: 'Pay anytime · max ₱3,000 · daily interest' },
                ].map(opt => (
                  <div key={opt.value} onClick={() => set('loan_type', opt.value)} style={{
                    flex: 1, cursor: 'pointer', padding: '12px 14px', borderRadius: 10,
                    background: form.loan_type === opt.value ? (opt.value === 'quickloan' ? 'rgba(245,158,11,0.08)' : 'rgba(34,197,94,0.06)') : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${form.loan_type === opt.value ? (opt.value === 'quickloan' ? 'rgba(245,158,11,0.4)' : 'rgba(34,197,94,0.3)') : 'rgba(255,255,255,0.08)'}`,
                    transition: 'all 0.15s ease'
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: form.loan_type === opt.value ? (opt.value === 'quickloan' ? '#F59E0B' : 'var(--green)') : 'var(--text-primary)', marginBottom: 3 }}>{opt.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{opt.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Borrower selector */}
          {!borrower && !isEdit && (
            <div className="form-group">
              <label className="form-label">Borrower *</label>
              <select value={form.borrower_id} onChange={e => set('borrower_id', e.target.value)}>
                <option value="">Select borrower</option>
                {borrowers?.map(b => <option key={b.id} value={b.id}>{b.full_name}</option>)}
              </select>
            </div>
          )}

          {/* Loan details section */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              {isQuickLoan ? <Zap size={15} color="#F59E0B" /> : <DollarSign size={15} color="var(--green)" />}
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-label)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Loan Details</span>
            </div>

            {isQuickLoan ? (
              <div className="form-group">
                <label className="form-label">Loan Amount (₱) * <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>max ₱{QUICKLOAN_CONFIG.MAX_AMOUNT.toLocaleString()}</span></label>
                <input type="number" min={minLoan} max={maxLoan} step="100" placeholder={`₱${minLoan.toLocaleString()} – ₱${maxLoan.toLocaleString()}`} value={form.loan_amount} onChange={e => set('loan_amount', e.target.value)} />
                {amount > 0 && <div style={{ fontSize: 11, color: '#F59E0B', marginTop: 4 }}>Daily interest: {formatCurrency(qlDailyInterest)}/day &nbsp;·&nbsp; If paid on Day 15: {formatCurrency(qlDay15Total)}</div>}
              </div>
            ) : (
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Loan Amount (₱) *</label>
                  <input type="number" min={minLoan} max={maxLoan} step="500" placeholder={`₱${minLoan.toLocaleString()} – ₱${maxLoan.toLocaleString()}`} value={form.loan_amount} onChange={e => set('loan_amount', e.target.value)} />
                  {selectedBorrower && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                      Borrower limit: ₱{maxLoan.toLocaleString()} (Level {selectedBorrower.loan_limit_level})
                    </div>
                  )}
                  {prefill?.suggested_max > prefill?.loan_amount && (
                    <div style={{ fontSize: 11, color: 'var(--green)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 5, padding: '4px 8px', background: 'rgba(34,197,94,0.06)', borderRadius: 6, border: '1px solid rgba(34,197,94,0.15)' }}>
                      <span>💡 This borrower now qualifies for up to <strong>{formatCurrency(prefill.suggested_max)}</strong> based on their credit score.</span>
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">Interest Rate</label>
                  <input type="number" min="0" max="1" step="0.01" value={form.interest_rate} onChange={e => set('interest_rate', e.target.value)} />
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{(rate * 100).toFixed(0)}% per month (×{loanTerm} months)</div>
                </div>
                <div className="form-group">
                  <label className="form-label">Loan Term</label>
                  <select value={form.loan_term} onChange={e => set('loan_term', parseInt(e.target.value))}>
                    <option value={2}>2 months — 4 installments</option>
                    <option value={3}>3 months — 6 installments</option>
                  </select>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{loanTerm === 2 ? '14% total interest' : '21% total interest'}</div>
                </div>
              </div>
            )}
          </div>

          {/* Summary preview */}
          {amount >= minLoan && (
            isQuickLoan ? (
              <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 12, padding: '16px 18px' }}>
                <div style={{ fontSize: 12, color: '#F59E0B', fontWeight: 600, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>⚡ QuickLoan Summary</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[
                    { label: 'Principal', value: formatCurrency(amount) },
                    { label: 'Daily Interest', value: `${formatCurrency(qlDailyInterest)}/day` },
                    { label: 'If paid on Day 15', value: formatCurrency(qlDay15Total), highlight: true },
                    { label: 'Extension fee if missed', value: formatCurrency(QUICKLOAN_CONFIG.EXTENSION_FEE) },
                  ].map(item => (
                    <div key={item.label}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.label}</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: item.highlight ? '#F59E0B' : 'var(--text-primary)', fontFamily: 'Space Grotesk' }}>{item.value}</div>
                    </div>
                  ))}
                </div>
                {day15 && day30 && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(245,158,11,0.15)', fontSize: 12, color: 'var(--text-label)' }}>
                    Target due: {day15.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })} &nbsp;·&nbsp; Hard deadline: {day30.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })} &nbsp;·&nbsp; ₱25/day penalty after deadline
                  </div>
                )}
              </div>
            ) : (
              <div style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: 12, padding: '16px 18px' }}>
                <div style={{ fontSize: 12, color: 'var(--green)', fontWeight: 600, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>💰 Loan Summary</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[
                    { label: 'Principal', value: formatCurrency(amount) },
                    { label: 'Total Repayment', value: formatCurrency(adjustedTotal) },
                    { label: 'Per Installment', value: formatCurrency(installmentAmount), highlight: true },
                    { label: 'Interest', value: formatCurrency(adjustedTotal - amount) },
                  ].map(item => (
                    <div key={item.label}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.label}</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: item.highlight ? 'var(--green)' : 'var(--text-primary)', fontFamily: 'Space Grotesk' }}>{item.value}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(34,197,94,0.15)', fontSize: 12, color: 'var(--text-label)' }}>
                  {numInstallments} installments of {formatCurrency(installmentAmount)} each cutoff ({loanTerm}-month term)
                </div>
              </div>
            )
          )}

          {/* Schedule */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Calendar size={15} color="var(--blue)" />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-label)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Schedule</span>
            </div>
            <div className="form-grid">
              {isQuickLoan ? (
                <div className="form-group">
                  <label className="form-label">Release Date</label>
                  <input type="date" value={form.release_date} onChange={e => set('release_date', e.target.value)} />
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Can be any day for QuickLoan</div>
                </div>
              ) : (
                <div className="form-group">
                  <label className="form-label">Release Date (locked to cutoff)</label>
                  <select value={form.release_date} onChange={e => set('release_date', e.target.value)}>
                    {cutoffs.map(c => (
                      <option key={formatDateValue(c)} value={formatDateValue(c)}>
                        {c.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </option>
                    ))}
                  </select>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Only 5th and 20th of each month</div>
                </div>
              )}
              <div className="form-group">
                <label className="form-label">{isQuickLoan ? 'Day 15 Target Due' : 'Final Due Date'}</label>
                <input type="text" readOnly
                  value={isQuickLoan
                    ? (day15 ? day15.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }) : '—')
                    : (dueDate ? dueDate.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }) : '—')
                  }
                  style={{ opacity: 0.6, cursor: 'not-allowed' }}
                />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Auto-calculated</div>
              </div>
            </div>
          </div>

          {/* Purpose & Notes */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Loan Purpose *</label>
              <textarea rows={2} placeholder="e.g. Hospitalization, Tuition, etc." value={form.loan_purpose} onChange={e => set('loan_purpose', e.target.value)} style={{ resize: 'vertical' }} />
            </div>
            <div className="form-group">
              <label className="form-label">Notes (optional)</label>
              <textarea rows={2} placeholder="Any additional remarks..." value={form.notes} onChange={e => set('notes', e.target.value)} style={{ resize: 'vertical' }} />
            </div>
          </div>

          {/* Agreement */}
          <div onClick={() => set('agreement_confirmed', !form.agreement_confirmed)} style={{
            display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer',
            background: form.agreement_confirmed ? (isQuickLoan ? 'rgba(245,158,11,0.06)' : 'rgba(34,197,94,0.06)') : 'rgba(255,255,255,0.02)',
            border: `1px solid ${form.agreement_confirmed ? (isQuickLoan ? 'rgba(245,158,11,0.3)' : 'rgba(34,197,94,0.3)') : 'rgba(255,255,255,0.08)'}`,
            borderRadius: 10, padding: '14px 16px', transition: 'all 0.15s ease'
          }}>
            <div style={{
              width: 20, height: 20, borderRadius: 5, flexShrink: 0, marginTop: 1,
              background: form.agreement_confirmed ? (isQuickLoan ? '#F59E0B' : 'var(--green)') : 'transparent',
              border: `2px solid ${form.agreement_confirmed ? (isQuickLoan ? '#F59E0B' : 'var(--green)') : 'rgba(255,255,255,0.2)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s ease'
            }}>
              {form.agreement_confirmed && <span style={{ color: '#fff', fontSize: 12, fontWeight: 800 }}>✓</span>}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 2 }}>Loan Agreement Confirmed</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {isQuickLoan
                  ? amount >= minLoan
                    ? `Borrower agrees to repay ${formatCurrency(amount)} principal + ${formatCurrency(qlDailyInterest)}/day interest. Target due Day 15. Hard deadline Day 30. ₱100 extension fee if Day 15 missed. ₱25/day penalty after Day 30.`
                    : 'Borrower agrees to QuickLoan terms including daily interest and extension/penalty fees.'
                  : `Borrower agrees to repay ${amount >= minLoan ? formatCurrency(adjustedTotal) : 'the full amount'} in ${numInstallments} equal installments of ${amount >= minLoan ? formatCurrency(installmentAmount) : '—'} each cutoff (${loanTerm}-month term).`
                }
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding: '16px 28px 24px', borderTop: '1px solid var(--card-border)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} className="btn-cancel">Cancel</button>
          <button onClick={handleSave} disabled={saving || !form.agreement_confirmed} className="btn-primary"
            style={isQuickLoan ? { background: 'linear-gradient(135deg,#F59E0B,#D97706)', borderColor: 'transparent' } : {}}>
            {saving ? 'Saving...' : prefill ? '🔄 Renew Loan' : isEdit ? 'Save Changes' : isQuickLoan ? '⚡ Create QuickLoan' : 'Create Loan'}
          </button>
        </div>
      </div>
    </div>
  )
}
