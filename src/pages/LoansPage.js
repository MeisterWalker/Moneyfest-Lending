import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { CREDIT_CONFIG, getBadgeFromScore, getBadgeFromCleanLoans, calcSecurityHold, getSecurityHoldRate } from '../lib/creditSystem'
import { logAudit, formatCurrency, formatDate } from '../lib/helpers'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'
import LoanModal from '../components/LoanModal'
import InstallmentProgressBar from '../components/InstallmentProgressBar'
import {
  Plus, Search, FileText, Trash2, Edit2,
  AlertTriangle, CheckCircle, Clock, XCircle,
  RefreshCw, ChevronDown, ChevronUp, User
} from 'lucide-react'

function generateReceiptHTML({ loan, borrower, installmentNum, amount, date }) {
  const totalPaid = installmentNum * amount
  const remaining = loan.total_repayment - totalPaid
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8" />
      <title>Payment Receipt</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=DM+Sans:wght@400;500;600&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'DM Sans', sans-serif; background: #fff; color: #1a1a2e; padding: 40px; max-width: 600px; margin: 0 auto; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 2px solid #e8ecf5; }
        .logo { font-family: 'Space Grotesk', sans-serif; font-weight: 800; font-size: 22px; color: #1a1a2e; }
        .logo span { background: linear-gradient(135deg, #3B82F6, #8B5CF6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .receipt-label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #7A8AAA; margin-bottom: 4px; }
        .receipt-num { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 14px; color: #1a1a2e; }
        .title { font-family: 'Space Grotesk', sans-serif; font-weight: 800; font-size: 28px; margin-bottom: 4px; }
        .subtitle { font-size: 14px; color: #7A8AAA; margin-bottom: 28px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 28px; }
        .info-item label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: #7A8AAA; display: block; margin-bottom: 4px; }
        .info-item span { font-size: 14px; font-weight: 500; color: #1a1a2e; }
        .amount-box { background: linear-gradient(135deg, #f0f4ff, #e8f5e9); border: 1px solid #c8d8f0; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 28px; }
        .amount-label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: #7A8AAA; margin-bottom: 8px; }
        .amount-value { font-family: 'Space Grotesk', sans-serif; font-weight: 800; font-size: 36px; color: #22C55E; }
        .progress { margin-bottom: 28px; }
        .progress-label { font-size: 13px; font-weight: 600; margin-bottom: 10px; }
        .progress-bar { height: 10px; background: #e8ecf5; border-radius: 5px; overflow: hidden; }
        .progress-fill { height: 100%; background: linear-gradient(90deg, #8B5CF6, #22C55E); border-radius: 5px; }
        .progress-steps { display: flex; justify-content: space-between; margin-top: 8px; }
        .step { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; }
        .step.done { background: #22C55E; color: #fff; }
        .step.pending { background: #e8ecf5; color: #7A8AAA; }
        .summary { background: #f8faff; border-radius: 10px; padding: 18px; margin-bottom: 28px; }
        .summary-row { display: flex; justify-content: space-between; font-size: 13px; padding: 5px 0; border-bottom: 1px solid #e8ecf5; }
        .summary-row:last-child { border-bottom: none; font-weight: 700; font-size: 14px; }
        .footer { text-align: center; font-size: 12px; color: #7A8AAA; border-top: 1px solid #e8ecf5; padding-top: 20px; }
        .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; background: #e8f5e9; color: #16a34a; font-size: 12px; font-weight: 600; margin-bottom: 8px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo">Moneyfest<span>Lending</span></div>
        <div style="text-align:right">
          <div class="receipt-label">Receipt No.</div>
          <div class="receipt-num">LM-${Date.now().toString().slice(-8)}</div>
          <div style="font-size:12px;color:#7A8AAA;margin-top:4px">${date}</div>
        </div>
      </div>

      <div class="badge">✅ Payment Confirmed</div>
      <div class="title">Payment Receipt</div>
      <div class="subtitle">Installment ${installmentNum} of 4 — ${borrower?.full_name || 'Borrower'}</div>

      <div class="info-grid">
        <div class="info-item"><label>Borrower</label><span>${borrower?.full_name || "—"}</span></div>
        <div class="info-item"><label>Department</label><span>${borrower?.department || "—"}</span></div>
        <div class="info-item"><label>Payment Date</label><span>${date}</span></div>
        <div class="info-item"><label>Loan Amount</label><span>₱${loan.loan_amount?.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span></div>
      </div>

      <div class="amount-box">
        <div class="amount-label">Amount Paid This Installment</div>
        <div class="amount-value">₱${amount?.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
      </div>

      <div class="progress">
        <div class="progress-label">Repayment Progress — ${installmentNum} of 4 installments paid</div>
        <div class="progress-bar"><div class="progress-fill" style="width:${(installmentNum / 4) * 100}%"></div></div>
        <div class="progress-steps">
          ${[1,2,3,4].map(i => `<div class="step ${i <= installmentNum ? 'done' : 'pending'}">${i <= installmentNum ? "✓" : i}</div>`).join('')}
        </div>
      </div>

      <div class="summary">
        <div class="summary-row"><span>Loan Principal</span><span>₱${loan.loan_amount?.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span></div>
        <div class="summary-row"><span>Total Repayment (incl. interest)</span><span>₱${loan.total_repayment?.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span></div>
        <div class="summary-row"><span>Amount Paid to Date</span><span>₱${totalPaid?.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span></div>
        <div class="summary-row" style="color:${remaining <= 0 ? '#22C55E' : '#1a1a2e'}">
          <span>${remaining <= 0 ? "🎉 Fully Paid!" : 'Remaining Balance'}</span>
          <span>₱${Math.max(0, remaining)?.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
        </div>
      </div>

      <div class="footer">
        <p>Generated by <strong>Moneyfest Lending</strong> · Private workplace lending system</p>
        <p style="margin-top:4px">This serves as official proof of payment for installment ${installmentNum} of 4</p>
      </div>
    </body>
    </html>
  `
}

function downloadReceiptPDF({ loan, borrower, installmentNum, amount }) {
  const date = new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
  const html = generateReceiptHTML({ loan, borrower, installmentNum, amount, date })
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const name = borrower?.full_name?.replace(/\s+/g, '') || 'Borrower'
  const a = document.createElement('a')
  a.href = url
  a.download = `MoneyfestLending_Receipt_${name}_Installment${installmentNum}_${dateStr}.html`
  a.click()
  URL.revokeObjectURL(url)
}

const STATUS_CONFIG = {
  Pending:        { color: 'var(--gray)',   bg: 'rgba(107,114,128,0.15)', border: 'rgba(107,114,128,0.3)' },
  Active:         { color: 'var(--blue)',   bg: 'rgba(59,130,246,0.15)',  border: 'rgba(59,130,246,0.3)' },
  'Partially Paid':{ color: 'var(--purple)', bg: 'rgba(139,92,246,0.15)', border: 'rgba(139,92,246,0.3)' },
  Paid:           { color: 'var(--green)',  bg: 'rgba(34,197,94,0.15)',   border: 'rgba(34,197,94,0.3)' },
  Overdue:        { color: 'var(--gold)',   bg: 'rgba(245,158,11,0.15)',  border: 'rgba(245,158,11,0.3)' },
  Defaulted:      { color: 'var(--red)',    bg: 'rgba(239,68,68,0.15)',   border: 'rgba(239,68,68,0.3)' },
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.Pending
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
      color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`
    }}>
      {status}
    </span>
  )
}

function LoanCard({ loan, borrowers, onEdit, onDelete, onRecordPayment, onDefault, onRenew, onStatusUpdate }) {
  const [expanded, setExpanded] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const borrower = borrowers.find(b => b.id === loan.borrower_id)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Check and update status based on release date
  useEffect(() => {
    if (loan.status === 'Pending') {
      const releaseDate = new Date(loan.release_date)
      releaseDate.setHours(0, 0, 0, 0)
      if (today >= releaseDate) {
        onStatusUpdate(loan.id, 'Active')
      }
    }
  }, [loan.id, loan.status, loan.release_date])

  const nextInstallment = loan.payments_made + 1
  const canPay = loan.status === 'Active' || loan.status === 'Partially Paid'
  const isPaid = loan.status === 'Paid'
  const daysUntilDue = loan.release_date
    ? Math.ceil((new Date(loan.release_date) - today) / (1000 * 60 * 60 * 24))
    : null

  // Get next installment due date
  const getNextInstallmentDue = () => {
    if (!loan.release_date) return null
    const release = new Date(loan.release_date)
    const installmentNum = loan.payments_made
    let date = new Date(release)
    for (let i = 0; i <= installmentNum; i++) {
      if (date.getDate() === 5) date = new Date(date.getFullYear(), date.getMonth(), 20)
      else date = new Date(date.getFullYear(), date.getMonth() + 1, 5)
    }
    return date
  }
  const nextDue = getNextInstallmentDue()

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Card header */}
      <div style={{ padding: '20px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 18, color: 'var(--text-primary)' }}>
                {formatCurrency(loan.loan_amount)}
              </span>
              <StatusBadge status={loan.status} />
              {loan.status === 'Overdue' && (
                <span style={{ fontSize: 11, color: 'var(--gold)', display: 'flex', alignItems: 'center', gap: 3 }}>
                  <AlertTriangle size={12} /> Overdue
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-label)' }}>
              <User size={13} />
              <span style={{ fontWeight: 500 }}>{borrower?.full_name || 'Unknown'}</span>
              <span style={{ color: 'var(--text-muted)' }}>•</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Released {formatDate(loan.release_date)}
              </span>
            </div>
          </div>

          {/* Right side - total repayment */}
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>Total Repayment</div>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>
              {formatCurrency(loan.total_repayment)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {(loan.interest_rate * 100).toFixed(0)}% interest
            </div>
          </div>
        </div>

        {/* Progress bar */}
        {(canPay || isPaid) && (
          <InstallmentProgressBar
            paid={loan.payments_made}
            total={4}
            remainingBalance={loan.remaining_balance}
            nextDueDate={nextDue}
          />
        )}

        {/* Live penalty counter for overdue installments */}
        {(loan.status === 'Active' || loan.status === 'Partially Paid' || loan.status === 'Overdue') && nextDue && (() => {
          const todayP = new Date(); todayP.setHours(0,0,0,0)
          const dueDateP = new Date(nextDue); dueDateP.setHours(0,0,0,0)
          const daysLateP = Math.max(0, Math.ceil((todayP - dueDateP) / (1000 * 60 * 60 * 24)))
          if (daysLateP <= 0) return null
          const cap = loan.installment_amount * 0.20
          const penalty = Math.min(daysLateP * 20, cap)
          return (
            <div style={{ marginTop: 10, padding: '10px 14px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, fontSize: 12, color: 'var(--red)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <span><AlertTriangle size={12} style={{ display: 'inline', marginRight: 6 }} />Installment {loan.payments_made + 1} is <strong>{daysLateP} day{daysLateP > 1 ? 's' : ''} overdue</strong></span>
              <span style={{ fontFamily: 'Space Grotesk', fontWeight: 700 }}>Accrued penalty: ₱{penalty.toLocaleString('en-PH', { minimumFractionDigits: 2 })}{penalty === cap ? ' (capped)' : ''}</span>
            </div>
          )
        })()}

        {/* Pending status info */}
        {loan.status === 'Pending' && (
          <div style={{ marginTop: 10, padding: '10px 14px', background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 8, fontSize: 12, color: 'var(--blue)' }}>
            <Clock size={12} style={{ display: 'inline', marginRight: 6 }} />
            Loan releases on {formatDate(loan.release_date)}
            {daysUntilDue > 0 && ` (in ${daysUntilDue} day${daysUntilDue !== 1 ? 's' : ''})`}
            {daysUntilDue <= 0 && " — activating today"}
          </div>
        )}
      </div>

      {/* Expanded details */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--card-border)', padding: '16px 22px', background: 'rgba(255,255,255,0.01)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 14 }}>
            {[
              { label: 'Installment', value: formatCurrency(loan.installment_amount) },
              { label: 'Payments Made', value: `${loan.payments_made} of 4` },
              { label: 'Remaining', value: formatCurrency(loan.remaining_balance) },
              { label: 'Final Due', value: formatDate(loan.due_date) },
            ].map(item => (
              <div key={item.label}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.label}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{item.value}</div>
              </div>
            ))}
          </div>
          {loan.notes && (
            <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, fontSize: 13, color: 'var(--text-label)' }}>
              📝 {loan.notes}
            </div>
          )}
        </div>
      )}

      {/* Footer actions */}
      <div style={{ borderTop: '1px solid var(--card-border)', padding: '12px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <button
          onClick={() => setExpanded(!expanded)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
        >
          {expanded ? <><ChevronUp size={14} /> Less</> : <><ChevronDown size={14} /> Details</>}
        </button>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {/* Record Payment */}
          {canPay && !confirming && (
            <button
              onClick={() => setConfirming(true)}
              className="btn-primary"
              style={{ fontSize: 12, padding: '6px 14px' }}
            >
              <CheckCircle size={13} /> Record Payment {nextInstallment} of 4
            </button>
          )}

          {/* Payment confirmation inline */}
          {confirming && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, padding: '6px 12px', fontSize: 12 }}>
              <span style={{ color: 'var(--text-label)' }}>
                Confirm {formatCurrency(loan.installment_amount)} — Installment {nextInstallment} of 4?
              </span>
              <button onClick={() => { onRecordPayment(loan); setConfirming(false) }}
                style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                Yes
              </button>
              <button onClick={() => setConfirming(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12 }}>
                Cancel
              </button>
            </div>
          )}

          {/* Renew loan button (paid loans) */}
          {isPaid && (
            <button onClick={() => onRenew(loan)} className="btn-primary" style={{ fontSize: 12, padding: '6px 14px', background: 'rgba(20,184,166,0.2)', color: 'var(--teal)' }}>
              <RefreshCw size={13} /> Renew Loan
            </button>
          )}

          {/* Edit */}
          {!isPaid && loan.status !== 'Defaulted' && (
            <button className="btn-edit" onClick={() => onEdit(loan)} style={{ fontSize: 12, padding: '6px 12px' }}>
              <Edit2 size={13} /> Edit
            </button>
          )}

          {/* Mark Defaulted */}
          {(loan.status === 'Active' || loan.status === 'Partially Paid' || loan.status === 'Overdue') && (
            <button className="btn-delete" onClick={() => onDefault(loan)} style={{ fontSize: 12, padding: '6px 12px' }}>
              <XCircle size={13} /> Default
            </button>
          )}

          {/* Delete */}
          <button className="btn-delete" onClick={() => onDelete(loan)} style={{ fontSize: 12, padding: '6px 12px' }}>
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}

export default function LoansPage() {
  const [loans, setLoans] = useState([])
  const [borrowers, setBorrowers] = useState([])
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingLoan, setEditingLoan] = useState(null)
  const [prefillLoan, setPrefillLoan] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [defaultTarget, setDefaultTarget] = useState(null)
  const { user } = useAuth()
  const { toast } = useToast()

  const fetchData = useCallback(async () => {
    const [{ data: l }, { data: b }, { data: s }] = await Promise.all([
      supabase.from('loans').select('*').order('created_at', { ascending: false }),
      supabase.from('borrowers').select('*'),
      supabase.from('settings').select('*').eq('id', 1).single()
    ])
    setLoans(l || [])
    setBorrowers(b || [])
    setSettings(s)
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSave = async (form, isEdit) => {
    if (isEdit) {
      const { error } = await supabase.from('loans').update({
        loan_amount: form.loan_amount,
        interest_rate: form.interest_rate,
        total_repayment: form.total_repayment,
        installment_amount: form.installment_amount,
        notes: form.notes,
        updated_at: new Date().toISOString()
      }).eq('id', editingLoan.id)
      if (error) { toast('Failed to update loan', 'error'); return }
      const editedBorrower = borrowers.find(b => b.id === form.borrower_id)
      await logAudit({ action_type: 'LOAN_EDITED', module: 'Loan', description: `Loan edited for ${editedBorrower?.full_name || 'Unknown'} — ₱${form.loan_amount?.toLocaleString()}`, changed_by: user?.email })
      toast('Loan updated', 'success')
    } else {
      // Check for existing active loan
      const activeLoan = loans.find(l =>
        l.borrower_id === form.borrower_id &&
        ['Pending', 'Active', 'Partially Paid', 'Overdue'].includes(l.status)
      )
      if (activeLoan) { toast('This borrower already has an active loan', 'error'); return }

      const { error } = await supabase.from('loans').insert({
        borrower_id: form.borrower_id,
        loan_amount: form.loan_amount,
        interest_rate: form.interest_rate,
        total_repayment: form.total_repayment,
        installment_amount: form.installment_amount,
        release_date: form.release_date,
        due_date: form.due_date,
        remaining_balance: form.total_repayment,
        payments_made: 0,
        status: 'Pending',
        agreement_confirmed: form.agreement_confirmed,
        notes: form.notes
      })
      if (error) { toast('Failed to create loan', 'error'); return }

      const borrower = borrowers.find(b => b.id === form.borrower_id)
      await logAudit({
        action_type: prefillLoan ? 'LOAN_RENEWED' : 'LOAN_CREATED',
        module: 'Loan',
        description: `${prefillLoan ? 'Loan renewed' : 'New loan created'} for ${borrower?.full_name} — ₱${form.loan_amount.toLocaleString()}`,
        changed_by: user?.email
      })
      toast(`Loan created for ${borrower?.full_name}`, 'success')
    }
    setModalOpen(false)
    setEditingLoan(null)
    setPrefillLoan(null)
    fetchData()
  }

  const handleRecordPayment = async (loan) => {
    const newPaymentsMade = loan.payments_made + 1
    const newBalance = loan.remaining_balance - loan.installment_amount
    const newStatus = newPaymentsMade >= 4 ? 'Paid' : 'Partially Paid'

    const { error } = await supabase.from('loans').update({
      payments_made: newPaymentsMade,
      remaining_balance: Math.max(0, newBalance),
      status: newStatus,
      updated_at: new Date().toISOString()
    }).eq('id', loan.id)

    if (error) { toast('Failed to record payment', 'error'); return }

    // ── Penalty calculation ─────────────────────────────────────
    const borrower = borrowers.find(b => b.id === loan.borrower_id)
    const PENALTY_PER_DAY = 20
    const PENALTY_CAP_RATE = 0.20
    let penaltyAmount = 0
    let daysLate = 0

    // Recalculate next due date here (can't use LoanCard's nextDue — different scope)
    if (loan.release_date) {
      const release = new Date(loan.release_date)
      const installmentNum = loan.payments_made // current installment being paid
      let dueDate = new Date(release)
      for (let i = 0; i <= installmentNum; i++) {
        if (dueDate.getDate() === 5) dueDate = new Date(dueDate.getFullYear(), dueDate.getMonth(), 20)
        else dueDate = new Date(dueDate.getFullYear(), dueDate.getMonth() + 1, 5)
      }
      const today2 = new Date(); today2.setHours(0,0,0,0)
      dueDate.setHours(0,0,0,0)
      daysLate = Math.max(0, Math.ceil((today2 - dueDate) / (1000 * 60 * 60 * 24)))
      if (daysLate > 0) {
        const cap = loan.installment_amount * PENALTY_CAP_RATE
        penaltyAmount = Math.min(daysLate * PENALTY_PER_DAY, cap)
        penaltyAmount = parseFloat(penaltyAmount.toFixed(2))
      }
    }

    if (penaltyAmount > 0) {
      // Log penalty transaction
      await supabase.from('penalty_charges').insert({
        borrower_id: loan.borrower_id,
        loan_id: loan.id,
        installment_number: newPaymentsMade,
        days_late: daysLate,
        penalty_per_day: PENALTY_PER_DAY,
        penalty_amount: penaltyAmount,
        cap_applied: penaltyAmount < (daysLate * PENALTY_PER_DAY),
        created_at: new Date().toISOString()
      })

      // ── Auto-deduct penalty from Security Hold ───────────
      const currentHold = parseFloat(loan.security_hold || 0)
      if (currentHold > 0 && !loan.security_hold_returned) {
        const deductAmt = Math.min(penaltyAmount, currentHold)
        const newHold = parseFloat((currentHold - deductAmt).toFixed(2))
        await supabase.from('loans').update({ security_hold: newHold }).eq('id', loan.id)
        await logAudit({
          action_type: 'PENALTY_DEDUCTED_FROM_HOLD',
          module: 'Loan',
          description: `₱${deductAmt} penalty auto-deducted from Security Hold for ${borrower?.full_name} — Hold reduced from ₱${currentHold} to ₱${newHold}`,
          changed_by: user?.email
        })
        toast(`⚠️ Late penalty of ₱${penaltyAmount} auto-deducted from Security Hold (${daysLate} days late)`, 'error')
      } else {
        toast(`⚠️ Late penalty of ₱${penaltyAmount} applied (${daysLate} days late)`, 'error')
      }

      await logAudit({
        action_type: 'PENALTY_CHARGED',
        module: 'Loan',
        description: `Late penalty of ₱${penaltyAmount} charged to ${borrower?.full_name} — Installment ${newPaymentsMade} was ${daysLate} day${daysLate > 1 ? 's' : ''} late`,
        changed_by: user?.email
      })
    }

    // Update credit score (+15 on-time, -10 if late)
    if (borrower) {
      const scoreChange = daysLate > 0 ? CREDIT_CONFIG.latePenalty : CREDIT_CONFIG.onTimeBonus
      const newScore = Math.min(CREDIT_CONFIG.max, Math.max(CREDIT_CONFIG.min, borrower.credit_score + scoreChange))
      const newRisk = CREDIT_CONFIG.riskFromScore(newScore)
      const cleanLoans = loans.filter(l => l.borrower_id === borrower.id && l.status === 'Paid').length
      const newBadgeTemp = getBadgeFromScore(newScore)
      await supabase.from('borrowers').update({
        credit_score: newScore,
        risk_score: newRisk,
        loyalty_badge: newBadgeTemp
      }).eq('id', borrower.id)
    }

    await logAudit({
      action_type: 'INSTALLMENT_PAID',
      module: 'Loan',
      description: `Installment ${newPaymentsMade} of 4 paid for ${borrower?.full_name} — ₱${loan.installment_amount?.toLocaleString('en-PH', { minimumFractionDigits: 2 })}${penaltyAmount > 0 ? ` + ₱${penaltyAmount} penalty (${daysLate} days late)` : ' (on time)'}`,
      changed_by: user?.email
    })

    if (newStatus === 'Paid') {
      // Update borrower loan limit progression
      if (borrower) {
        const newLevel = Math.min(4, (borrower.loan_limit_level || 1) + 1)
        const limitMap = { 1: 5000, 2: 7000, 3: 9000, 4: 10000 }
        const newLimit = limitMap[newLevel]
        const cleanLoans = loans.filter(l =>
          l.borrower_id === borrower.id && l.status === 'Paid' && l.id !== loan.id
        ).length + 1
        // Use already-updated score from payment recording above
        const { data: freshBorrower } = await supabase.from('borrowers').select('credit_score').eq('id', borrower.id).single()
        const currentScore = freshBorrower?.credit_score || borrower.credit_score
        const bonusScore = Math.min(CREDIT_CONFIG.max, currentScore + (cleanLoans % 2 === 0 ? CREDIT_CONFIG.fullPayBonus : 0))
        const newBadge = getBadgeFromScore(bonusScore)
        await supabase.from('borrowers').update({
          loan_limit_level: newLevel, loan_limit: newLimit,
          loyalty_badge: newBadge, credit_score: bonusScore,
          risk_score: CREDIT_CONFIG.riskFromScore(bonusScore)
        }).eq('id', borrower.id)
      }

      // ── Return Security Hold to borrower portal ─────────────
      if (loan.security_hold && loan.security_hold > 0 && !loan.security_hold_returned) {
        // Credit security hold back to borrower's rebate credits / security hold balance
        await supabase.from('loans').update({ security_hold_returned: true }).eq('id', loan.id)

        // Log as a special wallet transaction so borrower can see it
        const { data: existingCredits } = await supabase
          .from('wallets').select('id, balance').eq('borrower_id', borrower.id).single()
        const holdAmount = parseFloat(loan.security_hold)
        if (existingCredits) {
          await supabase.from('wallets').update({
            balance: parseFloat((existingCredits.balance + holdAmount).toFixed(2)),
            updated_at: new Date().toISOString()
          }).eq('id', existingCredits.id)
        } else {
          await supabase.from('wallets').insert({ borrower_id: borrower.id, balance: holdAmount })
        }
        await supabase.from('wallet_transactions').insert({
          borrower_id: borrower.id,
          loan_id: loan.id,
          type: 'rebate',
          amount: holdAmount,
          description: `Security Hold of ₱${holdAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })} returned — loan fully paid`,
          status: 'completed'
        })
        await logAudit({
          action_type: 'SECURITY_HOLD_RETURNED',
          module: 'Loan',
          description: `Security Hold of ₱${holdAmount} returned to ${borrower.full_name}'s Rebate Credits`,
          changed_by: user?.email
        })
      }

      // ── Early payoff rebate (only on final installment) ──────
      if (loan.due_date) {
        const today = new Date(); today.setHours(0,0,0,0)
        const finalDue = new Date(loan.due_date); finalDue.setHours(0,0,0,0)
        const daysEarly = Math.ceil((finalDue - today) / (1000 * 60 * 60 * 24))

        // Fixed 1% rebate regardless of how early
        const rebateRate = daysEarly >= 1 ? 0.01 : 0

        if (rebateRate > 0) {
          const rebateAmount = parseFloat((loan.loan_amount * rebateRate).toFixed(2))
          const rebateLabel = `Early payoff rebate (1% — \${daysEarly} day\${daysEarly !== 1 ? 's' : ''} early)`

          // Upsert Rebate Credits
          const { data: existingCredits } = await supabase
            .from('wallets').select('id, balance').eq('borrower_id', borrower.id).single()

          if (existingCredits) {
            await supabase.from('wallets').update({
              balance: parseFloat((existingCredits.balance + rebateAmount).toFixed(2)),
              updated_at: new Date().toISOString()
            }).eq('id', existingCredits.id)
          } else {
            await supabase.from('wallets').insert({
              borrower_id: borrower.id,
              balance: rebateAmount
            })
          }

          // Log transaction
          await supabase.from('wallet_transactions').insert({
            borrower_id: borrower.id,
            loan_id: loan.id,
            type: 'rebate',
            amount: rebateAmount,
            description: rebateLabel,
            status: 'completed'
          })

          await logAudit({
            action_type: 'CREDITS_REBATE',
            module: 'Loan',
            description: `Early payoff rebate of ₱\${rebateAmount} credited to \${borrower.full_name}'s Rebate Credits (\${rebateLabel})`,
            changed_by: user?.email
          })

          toast(`🎉 Loan fully paid by \${borrower?.full_name}! Early rebate of ₱\${rebateAmount} added to Rebate Credits!`, 'success')
        } else {
          toast(`🎉 Loan fully paid by \${borrower?.full_name}!`, 'success')
        }
      } else {
        toast(`🎉 Loan fully paid by \${borrower?.full_name}!`, 'success')
      }
    } else {
      toast(`✅ Installment ${newPaymentsMade} of 4 recorded for ${borrower?.full_name}`, 'success')
    }

    // Download receipt
    downloadReceiptPDF({ loan, borrower, installmentNum: newPaymentsMade, amount: loan.installment_amount })
    fetchData()
  }

  const handleStatusUpdate = async (loanId, newStatus) => {
    await supabase.from('loans').update({ status: newStatus }).eq('id', loanId)
    const loan = loans.find(l => l.id === loanId)
    const borrower = borrowers.find(b => b.id === loan?.borrower_id)
    await logAudit({
      action_type: 'LOAN_STATUS_CHANGED',
      module: 'Loan',
      description: `Loan status manually changed to "${newStatus}" for ${borrower?.full_name || 'Unknown'}`,
      changed_by: user?.email
    })
    fetchData()
  }

  const handleDefault = async (loan) => {
    const borrower = borrowers.find(b => b.id === loan.borrower_id)
    await supabase.from('loans').update({ status: 'Defaulted', updated_at: new Date().toISOString() }).eq('id', loan.id)
    // Deduct credit score -150 for default
    if (borrower) {
      const newScore = Math.max(CREDIT_CONFIG.min, borrower.credit_score + CREDIT_CONFIG.defaultPenalty)
      await supabase.from('borrowers').update({
        credit_score: newScore,
        risk_score: CREDIT_CONFIG.riskFromScore(newScore)
      }).eq('id', borrower.id)
    }
    await logAudit({ action_type: 'LOAN_DEFAULTED', module: 'Loan', description: `Loan marked as defaulted for ${borrower?.full_name}`, changed_by: user?.email })
    toast(`Loan marked as defaulted`, 'warning')
    setDefaultTarget(null)
    fetchData()
  }

  const handleDelete = async (loan) => {
    const borrower = borrowers.find(b => b.id === loan.borrower_id)
    // Delete child records first to avoid FK constraint violations
    await supabase.from('payment_proofs').delete().eq('loan_id', loan.id)
    await supabase.from('penalty_charges').delete().eq('loan_id', loan.id)
    await supabase.from('wallet_transactions').delete().eq('loan_id', loan.id)
    const { error } = await supabase.from('loans').delete().eq('id', loan.id)
    if (error) { toast('Failed to delete loan: ' + error.message, 'error'); return }
    await logAudit({ action_type: 'LOAN_DELETED', module: 'Loan', description: `Loan deleted for ${borrower?.full_name}`, changed_by: user?.email })
    toast('Loan deleted', 'info')
    setDeleteTarget(null)
    setLoans(prev => prev.filter(l => l.id !== loan.id))
  }

  const handleRenew = (loan) => {
    setPrefillLoan({ borrower_id: loan.borrower_id, loan_amount: loan.loan_amount, interest_rate: loan.interest_rate })
    setEditingLoan(null)
    setModalOpen(true)
  }

  const statuses = ['All', 'Pending', 'Active', 'Partially Paid', 'Paid', 'Overdue', 'Defaulted']
  const filtered = loans.filter(l => {
    const borrower = borrowers.find(b => b.id === l.borrower_id)
    const matchSearch = borrower?.full_name?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'All' || l.status === statusFilter
    return matchSearch && matchStatus
  })

  const stats = {
    active: loans.filter(l => ['Active', 'Partially Paid'].includes(l.status)).length,
    pending: loans.filter(l => l.status === 'Pending').length,
    paid: loans.filter(l => l.status === 'Paid').length,
    overdue: loans.filter(l => l.status === 'Overdue').length,
    defaulted: loans.filter(l => l.status === 'Defaulted').length,
  }

  return (
    <div style={{ padding: '32px 28px', maxWidth: 960, margin: '0 auto' }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Loans</h1>
          <p className="page-subtitle">{loans.length} total loan{loans.length !== 1 ? 's' : ''}</p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="search-bar">
            <Search size={15} />
            <input placeholder="Search by borrower..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button className="btn-primary" onClick={() => { setEditingLoan(null); setPrefillLoan(null); setModalOpen(true) }} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Plus size={16} /> New Loan
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 14, marginBottom: 22 }}>
        {[
          { label: 'Active', value: stats.active, color: 'var(--blue)' },
          { label: 'Pending', value: stats.pending, color: 'var(--gray)' },
          { label: 'Paid', value: stats.paid, color: 'var(--green)' },
          { label: 'Overdue', value: stats.overdue, color: 'var(--gold)' },
          { label: 'Defaulted', value: stats.defaulted, color: 'var(--red)' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '14px 18px', textAlign: 'center', cursor: 'pointer', border: statusFilter === s.label ? `1px solid ${s.color}` : undefined }} onClick={() => setStatusFilter(statusFilter === s.label ? 'All' : s.label)}>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 24, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Status filter pills */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 22, flexWrap: 'wrap' }}>
        {statuses.map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            style={{
              padding: '5px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500,
              background: statusFilter === s ? 'var(--blue)' : 'rgba(255,255,255,0.05)',
              color: statusFilter === s ? '#fff' : 'var(--text-label)',
              transition: 'all 0.15s ease'
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Loan cards */}
      {loading ? (
        <div className="empty-state"><p>Loading loans...</p></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <FileText size={48} />
          <h3>{search || statusFilter !== 'All' ? 'No results found' : 'No loans yet'}</h3>
          <p style={{ marginBottom: 20 }}>{search ? 'Try a different search' : statusFilter !== 'All' ? `No ${statusFilter} loans` : 'Create the first loan to get started'}</p>
          {!search && statusFilter === 'All' && (
            <button className="btn-primary" onClick={() => setModalOpen(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Plus size={16} /> New Loan</button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {filtered.map(loan => (
            <LoanCard
              key={loan.id}
              loan={loan}
              borrowers={borrowers}
              onEdit={l => { setEditingLoan(l); setPrefillLoan(null); setModalOpen(true) }}
              onDelete={setDeleteTarget}
              onDefault={setDefaultTarget}
              onRecordPayment={handleRecordPayment}
              onRenew={handleRenew}
              onStatusUpdate={handleStatusUpdate}
            />
          ))}
        </div>
      )}

      {/* Loan Modal */}
      <LoanModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditingLoan(null); setPrefillLoan(null) }}
        onSave={handleSave}
        loan={editingLoan}
        borrowers={borrowers}
        settings={settings}
        prefill={prefillLoan}
      />

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: 400, padding: 28 }}>
            <h2 style={{ fontFamily: 'Space Grotesk', fontSize: 18, marginBottom: 10 }}>Delete Loan?</h2>
            <p style={{ color: 'var(--text-label)', fontSize: 14, marginBottom: 24 }}>
              This will permanently delete this loan record. This cannot be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn-cancel" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn-delete" onClick={() => handleDelete(deleteTarget)}><Trash2 size={14} /> Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Default Confirmation */}
      {defaultTarget && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: 420, padding: 28 }}>
            <h2 style={{ fontFamily: 'Space Grotesk', fontSize: 18, marginBottom: 10 }}>Mark as Defaulted?</h2>
            <p style={{ color: 'var(--text-label)', fontSize: 14, marginBottom: 8 }}>
              This will mark the loan as <strong style={{ color: 'var(--red)' }}>Defaulted</strong> and deduct <strong style={{ color: 'var(--red)' }}>150 points</strong> from the borrower's credit score.
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 24 }}>This action cannot be undone.</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn-cancel" onClick={() => setDefaultTarget(null)}>Cancel</button>
              <button className="btn-delete" onClick={() => handleDefault(defaultTarget)}><XCircle size={14} /> Mark Defaulted</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
