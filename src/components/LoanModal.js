import { useState, useEffect } from 'react'
import { X, DollarSign, Calendar, FileText, CheckSquare } from 'lucide-react'
import { getNextCutoffDate, formatCurrency, getInstallmentDates, formatDateValue } from '../lib/helpers'

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
    loan_amount: '',
    interest_rate: settings?.interest_rate || 0.07,
    release_date: formatDateValue(nextCutoff),
    agreement_confirmed: false,
    notes: ''
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    if (loan) {
      setForm({
        borrower_id: loan.borrower_id || '',
        loan_amount: loan.loan_amount || '',
        interest_rate: loan.interest_rate || 0.07,
        release_date: loan.release_date || formatDateValue(nextCutoff),
        agreement_confirmed: loan.agreement_confirmed || false,
        notes: loan.notes || ''
      })
    } else if (prefill) {
      setForm({
        borrower_id: prefill.borrower_id || '',
        loan_amount: prefill.loan_amount || '',
        interest_rate: prefill.interest_rate || settings?.interest_rate || 0.07,
        release_date: formatDateValue(nextCutoff),
        agreement_confirmed: false,
        notes: ''
      })
    } else {
      setForm({
        borrower_id: borrower?.id || '',
        loan_amount: '',
        interest_rate: settings?.interest_rate || 0.07,
        release_date: formatDateValue(nextCutoff),
        agreement_confirmed: false,
        notes: ''
      })
    }
  }, [isOpen, loan, borrower, prefill])

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const selectedBorrower = borrower || borrowers?.find(b => b.id === form.borrower_id)
  const maxLoan = selectedBorrower?.loan_limit || settings?.max_loan_amount || 10000
  const minLoan = 5000
  const amount = parseFloat(form.loan_amount) || 0
  const rate = parseFloat(form.interest_rate) || 0.07
  const totalRepayment = amount * (1 + rate)
  const installmentAmount = totalRepayment / 4
  const dueDate = form.release_date ? (() => {
    const dates = getInstallmentDates(form.release_date)
    return dates.length === 4 ? dates[3] : null
  })() : null
  const cutoffs = getNextTwoCutoffs()

  const handleSave = async () => {
    if (!form.borrower_id && !borrower) return alert('Please select a borrower')
    if (!form.loan_amount) return alert('Please enter a loan amount')
    if (amount < minLoan) return alert(`Minimum loan amount is ₱${minLoan.toLocaleString()}`)
    if (amount > maxLoan) return alert(`Maximum loan amount for this borrower is ₱${maxLoan.toLocaleString()}`)
    if (!form.agreement_confirmed) return alert('Please confirm the loan agreement')
    setSaving(true)
    await onSave({
      ...form,
      borrower_id: borrower?.id || form.borrower_id,
      loan_amount: amount,
      interest_rate: rate,
      total_repayment: totalRepayment,
      installment_amount: installmentAmount,
      due_date: dueDate ? formatDateValue(dueDate) : formatDateValue(new Date()),
      remaining_balance: totalRepayment,
      status: 'Pending'
    }, isEdit)
    setSaving(false)
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 580 }}>
        {/* Header */}
        <div style={{ padding: '24px 28px 20px', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontFamily: 'Space Grotesk', fontSize: 18, fontWeight: 700 }}>
              {prefill ? "🔄 Renew Loan" : isEdit ? 'Edit Loan' : 'New Loan Application'}
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
              {selectedBorrower ? `Borrower: ${selectedBorrower.full_name}` : 'Fill in loan details below'}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Borrower selector (only if no borrower pre-selected) */}
          {!borrower && !isEdit && (
            <div className="form-group">
              <label className="form-label">Borrower *</label>
              <select value={form.borrower_id} onChange={e => set('borrower_id', e.target.value)}>
                <option value="">Select borrower</option>
                {borrowers?.map(b => <option key={b.id} value={b.id}>{b.full_name}</option>)}
              </select>
            </div>
          )}

          {/* Loan amount */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <DollarSign size={15} color="var(--green)" />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-label)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Loan Details</span>
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Loan Amount (₱) *</label>
                <input
                  type="number"
                  min={minLoan}
                  max={maxLoan}
                  step="500"
                  placeholder={`₱${minLoan.toLocaleString()} – ₱${maxLoan.toLocaleString()}`}
                  value={form.loan_amount}
                  onChange={e => set('loan_amount', e.target.value)}
                />
                {selectedBorrower && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    Borrower limit: ₱{maxLoan.toLocaleString()} (Level {selectedBorrower.loan_limit_level})
                  </div>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">Interest Rate</label>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.01"
                  value={form.interest_rate}
                  onChange={e => set('interest_rate', e.target.value)}
                />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  {(rate * 100).toFixed(0)}% flat rate
                </div>
              </div>
            </div>
          </div>

          {/* Calculated preview */}
          {amount >= minLoan && (
            <div style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: 12, padding: '16px 18px' }}>
              <div style={{ fontSize: 12, color: 'var(--green)', fontWeight: 600, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                💰 Loan Summary
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { label: 'Principal', value: formatCurrency(amount) },
                  { label: 'Total Repayment', value: formatCurrency(totalRepayment) },
                  { label: 'Per Installment', value: formatCurrency(installmentAmount), highlight: true },
                  { label: 'Interest', value: formatCurrency(totalRepayment - amount) },
                ].map(item => (
                  <div key={item.label}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.label}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: item.highlight ? 'var(--green)' : 'var(--text-primary)', fontFamily: 'Space Grotesk' }}>
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(34,197,94,0.15)', fontSize: 12, color: 'var(--text-label)' }}>
                4 installments of {formatCurrency(installmentAmount)} each cutoff
              </div>
            </div>
          )}

          {/* Release date */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Calendar size={15} color="var(--blue)" />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-label)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Schedule</span>
            </div>
            <div className="form-grid">
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
              <div className="form-group">
                <label className="form-label">Final Due Date</label>
                <input
                  type="text"
                  readOnly
                  value={dueDate ? dueDate.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }) : "—"}
                  style={{ opacity: 0.6, cursor: 'not-allowed' }}
                />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Auto-calculated</div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="form-group">
            <label className="form-label">Notes (optional)</label>
            <textarea rows={2} placeholder="Any additional remarks..." value={form.notes} onChange={e => set('notes', e.target.value)} style={{ resize: 'vertical' }} />
          </div>

          {/* Agreement */}
          <div
            onClick={() => set('agreement_confirmed', !form.agreement_confirmed)}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer',
              background: form.agreement_confirmed ? 'rgba(34,197,94,0.06)' : 'rgba(255,255,255,0.02)',
              border: `1px solid ${form.agreement_confirmed ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: 10, padding: '14px 16px', transition: 'all 0.15s ease'
            }}
          >
            <div style={{
              width: 20, height: 20, borderRadius: 5, flexShrink: 0, marginTop: 1,
              background: form.agreement_confirmed ? 'var(--green)' : 'transparent',
              border: `2px solid ${form.agreement_confirmed ? 'var(--green)' : 'rgba(255,255,255,0.2)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s ease'
            }}>
              {form.agreement_confirmed && <span style={{ color: '#fff', fontSize: 12, fontWeight: 800 }}>✓</span>}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 2 }}>
                Loan Agreement Confirmed
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Borrower has agreed to repay {amount >= minLoan ? formatCurrency(totalRepayment) : 'the full amount'} in 4 equal installments of {amount >= minLoan ? formatCurrency(installmentAmount) : "—"} each cutoff date.
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 28px 24px', borderTop: '1px solid var(--card-border)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} className="btn-cancel">Cancel</button>
          <button onClick={handleSave} disabled={saving || !form.agreement_confirmed} className="btn-primary">
            {saving ? 'Saving...' : prefill ? "🔄 Renew Loan" : isEdit ? 'Save Changes' : 'Create Loan'}
          </button>
        </div>
      </div>
    </div>
  )
}
