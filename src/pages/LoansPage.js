import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { CREDIT_CONFIG, getBadgeStatus, calcSecurityHold, getSecurityHoldRate } from '../lib/creditSystem'

import { logAudit, formatCurrency, formatDate, getInstallmentDates, getNumInstallments, calcQuickLoanBalance, getQuickLoanDueDates, QUICKLOAN_CONFIG, getQuickLoanDaysElapsed, formatDateValue } from '../lib/helpers'
import { notifyBorrower } from '../lib/portalNotifications'
import { sendFundsReleasedEmail, sendPaymentConfirmedEmail, sendTierUpgradeEmail } from '../lib/emailService'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'
import { logAutomatedPayment } from '../lib/accounting'
import LoanModal from '../components/LoanModal'
import InstallmentProgressBar from '../components/InstallmentProgressBar'
import {
  Plus, Search, FileText, Trash2, Edit2,
  AlertTriangle, CheckCircle, Clock, XCircle,
  RefreshCw, ChevronDown, ChevronUp, User
} from 'lucide-react'

function generateReceiptHTML({ loan, borrower, installmentNum, amount, date }) {
  const numInstallments = loan.num_installments || 4
  const roundedAmount = Math.ceil(amount)
  const totalPaid = installmentNum * roundedAmount
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
      <div class="subtitle">Installment ${installmentNum} of ${numInstallments} — ${borrower?.full_name || 'Borrower'}</div>

      <div class="info-grid">
        <div class="info-item"><label>Borrower</label><span>${borrower?.full_name || "—"}</span></div>
        <div class="info-item"><label>Department</label><span>${borrower?.department || "—"}</span></div>
        <div class="info-item"><label>Payment Date</label><span>${date}</span></div>
        <div class="info-item"><label>Loan Amount</label><span>₱${loan.loan_amount?.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span></div>
      </div>

      <div class="amount-box">
        <div class="amount-label">Amount Paid This Installment</div>
        <div class="amount-value">₱${roundedAmount?.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
      </div>

      <div class="progress">
        <div class="progress-label">Repayment Progress — ${installmentNum} of ${numInstallments} installments paid</div>
        <div class="progress-bar"><div class="progress-fill" style="width:${(installmentNum / numInstallments) * 100}%"></div></div>
        <div class="progress-steps">
          ${Array.from({length: numInstallments}, (_,i) => i+1).map(i => `<div class="step ${i <= installmentNum ? 'done' : 'pending'}">${i <= installmentNum ? "✓" : i}</div>`).join('')}
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
        <p style="margin-top:4px">This serves as official proof of payment for installment ${installmentNum} of ${numInstallments}</p>
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

function LoanCard({ loan: rawLoan, borrowers, applications, investors, onEdit, onDelete, onRecordPayment, onDefault, onRenew, onQuickLoanPayoff, onQuickLoanDay15Missed, onConfirmRelease, onRecordPrincipalPayment, onAssignInvestor, onFullPayoff }) {
  const [expanded, setExpanded] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [confirmingFullPayoff, setConfirmingFullPayoff] = useState(false)
  const [confirmingExtension, setConfirmingExtension] = useState(false)
  const [confirmingPrincipal, setConfirmingPrincipal] = useState(false)
  const [confirmingRenew, setConfirmingRenew] = useState(false)
  const [principalInput, setPrincipalInput] = useState('')
  const [paymentCashLocation, setPaymentCashLocation] = useState('hand')
  const [showInvestorPicker, setShowInvestorPicker] = useState(false)
  // Normalize installment to whole peso — handles loans created before rounding was added
  const loan = {
    ...rawLoan,
    installment_amount: Math.ceil(rawLoan.installment_amount || 0),
    remaining_balance: rawLoan.remaining_balance != null
      ? Math.ceil(rawLoan.remaining_balance)
      : rawLoan.remaining_balance
  }
  const borrower = borrowers.find(b => b.id === loan.borrower_id)
  const app = (applications || []).find(a => a.email === borrower?.email)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const isQuickLoan = loan.loan_type === 'quickloan'

  const nextInstallment = loan.payments_made + 1
  const canPay = loan.status === 'Active' || loan.status === 'Partially Paid' || loan.status === 'Overdue'
  const isPaid = loan.status === 'Paid'
  const daysUntilDue = loan.release_date
    ? Math.ceil((new Date(loan.release_date) - today) / (1000 * 60 * 60 * 24))
    : null

  // QuickLoan live balance
  const qlBalance = isQuickLoan && loan.release_date && loan.status !== 'Paid'
    ? calcQuickLoanBalance(loan)
    : null

  // Get next installment due date using shared helper
  const allDates = getInstallmentDates(loan.release_date, loan.num_installments || 4)
  const nextDue = allDates[loan.payments_made] || null

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', borderColor: isQuickLoan ? 'rgba(245,158,11,0.2)' : undefined }}>
      {/* Card header */}
      <div style={{ padding: '20px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 18, color: 'var(--text-primary)' }}>
                {formatCurrency(loan.loan_amount)}
              </span>
              <StatusBadge status={loan.status} />
              {isQuickLoan && (
                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', color: '#F59E0B' }}>
                  ⚡ QuickLoan
                </span>
              )}
              {loan.status === 'Overdue' && (
                <span style={{ fontSize: 11, color: 'var(--gold)', display: 'flex', alignItems: 'center', gap: 3 }}>
                  <AlertTriangle size={12} /> Overdue
                </span>
              )}
              {/* Investor assignment badge */}
              {loan.investor_id && (() => {
                const inv = (investors || []).find(i => i.id === loan.investor_id)
                return inv ? (
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.3)', color: '#A78BFA', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    👤 {inv.full_name} ({inv.tier})
                  </span>
                ) : null
              })()}
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
              {(loan.interest_rate * 100).toFixed(0)}%/mo interest
            </div>
          </div>
        </div>

        {/* Progress bar */}
        {(canPay || isPaid) && !isQuickLoan && (
          <InstallmentProgressBar
            paid={loan.payments_made}
            total={loan.num_installments || 4}
            remainingBalance={loan.remaining_balance}
            nextDueDate={nextDue}
          />
        )}

        {/* Live penalty counter for overdue installments */}
        {(loan.status === 'Active' || loan.status === 'Partially Paid' || loan.status === 'Overdue') && !isQuickLoan && nextDue && (() => {
          const todayP = new Date(); todayP.setHours(0,0,0,0)
          const dueDateP = new Date(nextDue); dueDateP.setHours(0,0,0,0)
          const daysLateP = Math.max(0, Math.ceil((todayP - dueDateP) / (1000 * 60 * 60 * 24)))
          if (daysLateP <= 0) return null
          const penalty = daysLateP * 20
          return (
            <div style={{ marginTop: 10, padding: '10px 14px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, fontSize: 12, color: 'var(--red)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <span><AlertTriangle size={12} style={{ display: 'inline', marginRight: 6 }} />Installment {loan.payments_made + 1} is <strong>{daysLateP} day{daysLateP > 1 ? 's' : ''} overdue</strong></span>
              <span style={{ fontFamily: 'Space Grotesk', fontWeight: 700 }}>Accrued penalty: ₱{penalty.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
            </div>
          )
        })()}

        {/* Pending status info */}
        {loan.status === 'Pending' && (
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ padding: '10px 14px', background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 8, fontSize: 12, color: 'var(--blue)' }}>
              <Clock size={12} style={{ display: 'inline', marginRight: 6 }} />
              Scheduled release date: {formatDate(loan.release_date)} — awaiting admin confirmation
            </div>
            {/* LA Signature status */}
            {loan.e_signature_name ? (
              <div style={{ padding: '10px 14px', background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, fontSize: 12, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle size={13} />
                <span>Loan Agreement signed by <strong>{loan.e_signature_name}</strong> on {loan.e_signature_date ? new Date(loan.e_signature_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'} — ready for fund release</span>
              </div>
            ) : (
              <div style={{ padding: '10px 14px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 8, fontSize: 12, color: 'var(--gold)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={13} />
                <span>⚠️ Loan Agreement <strong>not yet signed</strong> — borrower must sign via portal before funds can be released</span>
              </div>
            )}
            {app?.release_method && (
              <div style={{ padding: '10px 14px', background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 8, fontSize: 12, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{ fontSize: 15 }}>
                  {app.release_method === 'GCash' ? '📱' : app.release_method === 'Physical Cash' ? '💵' : '🏦'}
                </span>
                <div>
                  <div style={{ color: '#A78BFA', fontWeight: 700, marginBottom: 3 }}>
                    Release via {app.release_method}{app.bank_name ? ` — ${app.bank_name}` : ''}
                  </div>
                  {app.release_method === 'GCash' && (
                    <div style={{ color: '#7A8AAA' }}>
                      {app.gcash_number && <span>📞 {app.gcash_number}</span>}
                      {app.gcash_name && <span style={{ marginLeft: 10 }}>👤 {app.gcash_name}</span>}
                    </div>
                  )}
                  {(app.release_method === 'RCBC' || app.release_method === 'Other Bank Transfer') && app.bank_account_number && (
                    <div style={{ color: '#7A8AAA' }}>
                      {app.bank_account_holder && <span>👤 {app.bank_account_holder} · </span>}
                      <span>Acct# {app.bank_account_number}</span>
                    </div>
                  )}
                  {app.release_method === 'Physical Cash' && (
                    <div style={{ color: '#7A8AAA' }}>Hand over cash directly to borrower</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Expanded details */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--card-border)', padding: '16px 22px', background: 'rgba(255,255,255,0.01)' }}>
          {isQuickLoan && qlBalance ? (
            /* ── QuickLoan live balance panel ── */
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 14, marginBottom: 14 }}>
                {[
                  { label: 'Principal', value: formatCurrency(qlBalance.principal) },
                  { label: 'Days Elapsed', value: `${qlBalance.daysElapsed} days` },
                  { label: 'Accrued Interest', value: formatCurrency(qlBalance.accruedInterest), color: 'var(--gold)' },
                  { label: 'Total Owed Now', value: formatCurrency(qlBalance.totalOwed), color: qlBalance.phase === 'penalty' ? 'var(--red)' : 'var(--gold)' },
                  { label: 'Extension Fee', value: qlBalance.extensionFee > 0 ? formatCurrency(qlBalance.extensionFee) : '—' },
                  { label: 'Penalty Accrued', value: qlBalance.penaltyAccrued > 0 ? formatCurrency(qlBalance.penaltyAccrued) : '—', color: qlBalance.penaltyAccrued > 0 ? 'var(--red)' : undefined },
                ].map(item => (
                  <div key={item.label}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.label}</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: item.color || 'var(--text-primary)' }}>{item.value}</div>
                  </div>
                ))}
              </div>
              {/* Phase indicator */}
              <div style={{
                padding: '10px 14px', borderRadius: 8, fontSize: 12, display: 'flex', alignItems: 'center', gap: 8,
                background: qlBalance.phase === 'penalty' ? 'rgba(239,68,68,0.06)' : qlBalance.phase === 'extended' ? 'rgba(245,158,11,0.06)' : 'rgba(34,197,94,0.06)',
                border: `1px solid ${qlBalance.phase === 'penalty' ? 'rgba(239,68,68,0.25)' : qlBalance.phase === 'extended' ? 'rgba(245,158,11,0.25)' : 'rgba(34,197,94,0.2)'}`,
                color: qlBalance.phase === 'penalty' ? 'var(--red)' : qlBalance.phase === 'extended' ? 'var(--gold)' : 'var(--green)'
              }}>
                {qlBalance.phase === 'penalty' && <><AlertTriangle size={13} /><span>⚠️ Past Day 30 hard deadline — ₱25/day penalty accruing on top of daily interest</span></>}
                {qlBalance.phase === 'extended' && <><AlertTriangle size={13} /><span>Day 15 missed — extension period active. ₱100 extension fee {loan.extension_fee_charged ? 'charged' : 'pending'}. Hard deadline: {loan.release_date ? (() => { const { day30 } = getQuickLoanDueDates(loan.release_date); return day30?.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) })() : '—'}</span></>}
                {qlBalance.phase === 'active' && <><CheckCircle size={13} /><span>Active — Day 15 target: {loan.release_date ? (() => { const { day15 } = getQuickLoanDueDates(loan.release_date); return day15?.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) })() : '—'} · ₱{parseFloat((loan.loan_amount * QUICKLOAN_CONFIG.DAILY_RATE).toFixed(2)).toLocaleString()}/day accruing</span></>}
              </div>
            </div>
          ) : (
            /* ── Installment loan details ── */
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 14 }}>
              {[
                { label: 'Installment', value: formatCurrency(loan.installment_amount) },
                { label: 'Payments Made', value: `${loan.payments_made} of ${loan.num_installments || 4}` },
                { label: 'Remaining', value: formatCurrency(loan.remaining_balance) },
                { label: 'Final Due', value: (() => { try { const d = loan.release_date ? (() => { const [y,m,dy] = loan.release_date.split('-').map(Number); const rel = new Date(y,m-1,dy); let fd = new Date(rel); for(let i=1;i<=4;i++){if(rel.getDate()<=5){fd=new Date(rel.getFullYear(),rel.getMonth()+Math.floor((i-1)/2),i%2===1?20:5);if(i%2===0)fd.setMonth(fd.getMonth()+1)}else{fd=new Date(rel.getFullYear(),rel.getMonth()+Math.ceil(i/2),i%2===1?5:20)}} return fd.toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'}) })() : '—'; return d } catch(e){return '—'} })() },
                { label: 'Security Hold', value: loan.security_hold > 0 ? `${formatCurrency(loan.security_hold)} ${loan.security_hold_returned ? '(returned)' : '(held)'}` : '—' },
              ].map(item => (
                <div key={item.label}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{item.value}</div>
                </div>
              ))}
            </div>
          )}
          {/* LA Signature status row */}
          <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 8, fontSize: 12, display: 'flex', alignItems: 'center', gap: 8,
            background: loan.e_signature_name ? 'rgba(34,197,94,0.05)' : 'rgba(245,158,11,0.05)',
            border: `1px solid ${loan.e_signature_name ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.2)'}`,
            color: loan.e_signature_name ? 'var(--green)' : 'var(--gold)'
          }}>
            {loan.e_signature_name
              ? <><CheckCircle size={13} /><span>Loan Agreement signed by <strong>{loan.e_signature_name}</strong> · {loan.e_signature_date ? new Date(loan.e_signature_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</span></>
              : <><AlertTriangle size={13} /><span>Loan Agreement <strong>not yet signed</strong> by borrower — remind them to sign via portal</span></>
            }
          </div>
          <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, fontSize: 13, color: 'var(--text-label)' }}>
            🎯 Purpose: <strong>{loan.loan_purpose || 'Not specified'}</strong>
          </div>
          {loan.notes && (
            <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, fontSize: 13, color: 'var(--text-label)' }}>
              📝 Notes: {loan.notes}
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
          {/* QuickLoan pay button */}
          {isQuickLoan && canPay && !confirming && (
              <button
                onClick={() => setConfirming(true)}
                className="btn-primary"
                style={{ fontSize: 12, padding: '6px 14px', background: 'linear-gradient(135deg,#F59E0B,#D97706)', border: 'none' }}
              >
                ⚡ Record Full Payoff
              </button>
            )}

          {/* QuickLoan Record Extension button (Manual) */}
          {isQuickLoan && !loan.extension_fee_charged && canPay && !confirming && !confirmingExtension && !confirmingPrincipal && (
            <button
              onClick={() => setConfirmingExtension(true)}
              style={{ fontSize: 12, padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(245,158,11,0.35)', background: 'rgba(245,158,11,0.08)', color: '#F59E0B', cursor: 'pointer', fontWeight: 600 }}
            >
              ⚡ Record Extension
            </button>
          )}

          {/* QuickLoan Record Principal Payment button */}
          {isQuickLoan && canPay && !confirming && !confirmingExtension && !confirmingPrincipal && (
            <button
              onClick={() => { setConfirmingPrincipal(true); setPrincipalInput('') }}
              style={{ fontSize: 12, padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(99,102,241,0.4)', background: 'rgba(99,102,241,0.08)', color: '#a78bfa', cursor: 'pointer', fontWeight: 600 }}
            >
              💳 Record Principal Payment
            </button>
          )}

            {/* Confirm Release button for Pending loans */}
            {loan.status === 'Pending' && (
              <button
                onClick={() => onConfirmRelease(loan)}
                className="btn-primary"
                style={{ fontSize: 12, padding: '6px 14px', background: 'linear-gradient(135deg,#22C55E,#16A34A)', border: 'none' }}
              >
                <CheckCircle size={13} /> Confirm Funds Released
              </button>
            )}

            {/* Installment loan record payment button */}
            {!isQuickLoan && canPay && !confirming && !confirmingFullPayoff && (
              <button
                onClick={() => setConfirming(true)}
                className="btn-primary"
                style={{ fontSize: 12, padding: '6px 14px' }}
              >
                <CheckCircle size={13} /> Record Payment {nextInstallment} of {loan.num_installments || 4}
              </button>
            )}

            {/* Full Payoff button — only for installment loans with remaining installments */}
            {!isQuickLoan && canPay && !confirming && !confirmingFullPayoff && (
              <button
                onClick={() => setConfirmingFullPayoff(true)}
                style={{
                  fontSize: 12, padding: '6px 14px', borderRadius: 8,
                  border: '1px solid rgba(34,197,94,0.4)',
                  background: 'rgba(34,197,94,0.1)',
                  color: '#4ADE80', cursor: 'pointer', fontWeight: 600,
                  display: 'inline-flex', alignItems: 'center', gap: 5
                }}
              >
                💰 Full Payoff
              </button>
            )}

            {/* Full Payoff confirmation inline */}
            {confirmingFullPayoff && (() => {
              const numInst = loan.num_installments || 4
              const remaining = numInst - loan.payments_made
              const holdAmt = loan.security_hold || 0
              const holdLabel = holdAmt > 0 && !loan.security_hold_returned ? ` + ₱${holdAmt} hold returned` : ''
              const remainingBalance = Math.ceil(loan.remaining_balance ?? 0)
              return (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                  background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)',
                  borderRadius: 8, padding: '8px 12px', fontSize: 12, width: '100%'
                }}>
                  <span style={{ color: 'var(--text-label)', flex: 1 }}>
                    💰 Record full payoff of {formatCurrency(remainingBalance)}{holdLabel}?
                    <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>
                      ({remaining} installment{remaining !== 1 ? 's' : ''} remaining)
                    </span>
                  </span>
                  <button
                    onClick={() => { onFullPayoff(loan); setConfirmingFullPayoff(false) }}
                    style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setConfirmingFullPayoff(false)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12 }}
                  >
                    Cancel
                  </button>
                </div>
              )
            })()}

          {/* Payment confirmation inline */}
          {confirming && (
            isQuickLoan ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 8, padding: '6px 12px', fontSize: 12 }}>
                <span style={{ color: 'var(--text-label)' }}>
                  Collect {qlBalance ? formatCurrency(qlBalance.totalOwed) : '—'} (day {qlBalance?.daysElapsed})?
                </span>
                <select value={paymentCashLocation} onChange={e => setPaymentCashLocation(e.target.value)}
                  style={{ background: 'var(--card)', color: 'var(--text-primary)', border: '1px solid var(--card-border)', borderRadius: 6, padding: '3px 6px', fontSize: 11 }}>
                  <option value="hand">Hand</option>
                  <option value="maribank">Maribank</option>
                </select>
                <button onClick={() => { onQuickLoanPayoff(loan, paymentCashLocation); setConfirming(false) }}
                  style={{ background: '#F59E0B', color: '#000', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                  Yes
                </button>
                <button onClick={() => setConfirming(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12 }}>
                  Cancel
                </button>
              </div>
            ) : (() => {
              const numInst = loan.num_installments || 4
              const isFinalInstallment = nextInstallment === numInst
              const holdAmt = loan.security_hold || 0
              const shouldNet = isFinalInstallment && holdAmt > 0 && !loan.security_hold_returned
              const collectAmount = shouldNet
                ? Math.ceil(loan.installment_amount) - holdAmt
                : Math.ceil(loan.installment_amount)
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, padding: '6px 12px', fontSize: 12 }}>
                  <span style={{ color: 'var(--text-label)' }}>
                    {shouldNet ? (
                      <>
                        Collect {formatCurrency(collectAmount)} — Final Installment {nextInstallment}/{numInst}
                        <span style={{ color: 'var(--text-muted)', fontSize: 10, marginLeft: 4 }}>
                          (₱{holdAmt} hold netted)
                        </span>
                      </>
                    ) : (
                      <>Confirm {formatCurrency(loan.installment_amount)} — Installment {nextInstallment} of {numInst}?</>
                    )}
                  </span>
                  <select value={paymentCashLocation} onChange={e => setPaymentCashLocation(e.target.value)}
                    style={{ background: 'var(--card)', color: 'var(--text-primary)', border: '1px solid var(--card-border)', borderRadius: 6, padding: '3px 6px', fontSize: 11 }}>
                    <option value="hand">Hand</option>
                    <option value="maribank">Maribank</option>
                  </select>
                  <button onClick={() => { onRecordPayment(loan, paymentCashLocation); setConfirming(false) }}
                    style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                    Yes
                  </button>
                  <button onClick={() => setConfirming(false)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12 }}>
                    Cancel
                  </button>
                </div>
              )
            })()
          )}

          {/* QuickLoan Record Extension confirmation */}
          {confirmingExtension && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 8, padding: '6px 12px', fontSize: 12 }}>
              <span style={{ color: 'var(--text-label)' }}>
                Record ₱{QUICKLOAN_CONFIG.EXTENSION_FEE + parseFloat((loan.loan_amount * QUICKLOAN_CONFIG.DAILY_RATE * QUICKLOAN_CONFIG.DAY15_THRESHOLD).toFixed(2))} (Fee + Day 15 Interest)?
              </span>
              <select value={paymentCashLocation} onChange={e => setPaymentCashLocation(e.target.value)}
                style={{ background: 'var(--card)', color: 'var(--text-primary)', border: '1px solid var(--card-border)', borderRadius: 6, padding: '3px 6px', fontSize: 11 }}>
                <option value="hand">Hand</option>
                <option value="maribank">Maribank</option>
              </select>
              <button onClick={() => { onQuickLoanDay15Missed(loan, paymentCashLocation); setConfirmingExtension(false) }}
                style={{ background: '#F59E0B', color: '#000', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                Yes
              </button>
              <button onClick={() => setConfirmingExtension(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12 }}>
                Cancel
              </button>
            </div>
          )}

          {/* QuickLoan Principal Payment inline form */}
          {confirmingPrincipal && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 8, padding: '8px 12px', fontSize: 12, flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--text-label)', fontWeight: 600 }}>Principal reduction amount:</span>
              <input
                type="number"
                min="1"
                max={parseFloat(loan.current_principal ?? loan.loan_amount)}
                placeholder="e.g. 500"
                value={principalInput}
                onChange={e => setPrincipalInput(e.target.value)}
                style={{ width: 100, padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(99,102,241,0.35)', background: 'rgba(0,0,0,0.3)', color: '#F0F4FF', fontSize: 12 }}
              />
              <button
                disabled={!principalInput || parseFloat(principalInput) <= 0}
                onClick={() => { onRecordPrincipalPayment(loan, parseFloat(principalInput)); setConfirmingPrincipal(false); setPrincipalInput('') }}
                style={{ background: '#6366F1', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 700, opacity: (!principalInput || parseFloat(principalInput) <= 0) ? 0.5 : 1 }}
              >
                Confirm
              </button>
              <button onClick={() => { setConfirmingPrincipal(false); setPrincipalInput('') }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12 }}
              >
                Cancel
              </button>
            </div>
          )}

          {/* Assign to Investor — only for installment loans without an investor */}
          {!isQuickLoan && !loan.investor_id && (loan.status === 'Active' || loan.status === 'Partially Paid') && (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowInvestorPicker(p => !p)}
                style={{ fontSize: 12, padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(139,92,246,0.3)', background: 'rgba(139,92,246,0.1)', color: '#A78BFA', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}
              >
                👤 Assign Investor
              </button>
              {showInvestorPicker && (
                <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 50, background: 'var(--card-bg, #141B2D)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 10, padding: 8, minWidth: 220, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '4px 8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Select Investor</div>
                  {(investors || []).length === 0 && (
                    <div style={{ padding: '8px', fontSize: 12, color: 'var(--text-muted)' }}>No investors available</div>
                  )}
                  {(investors || []).map(inv => (
                    <button key={inv.id} onClick={() => { onAssignInvestor(loan, inv.id); setShowInvestorPicker(false) }}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--text-primary, #F0F4FF)', cursor: 'pointer', fontSize: 13, fontWeight: 500, textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(139,92,246,0.12)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <span>{inv.full_name}</span>
                      <span style={{ fontSize: 11, color: '#A78BFA', fontWeight: 700 }}>{inv.tier}</span>
                    </button>
                  ))}
                  <button onClick={() => setShowInvestorPicker(false)}
                    style={{ width: '100%', padding: '6px', borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 11, marginTop: 4 }}>
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Unassign investor button */}
          {!isQuickLoan && loan.investor_id && (loan.status === 'Active' || loan.status === 'Partially Paid') && (
            <button
              onClick={() => onAssignInvestor(loan, null)}
              style={{ fontSize: 12, padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: '#FCA5A5', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}
            >
              ✕ Unassign Investor
            </button>
          )}

          {/* Renew loan button (paid loans) */}
          {isPaid && !confirmingRenew && (
            <button onClick={() => setConfirmingRenew(true)} className="btn-primary" style={{ fontSize: 12, padding: '6px 14px', background: 'rgba(20,184,166,0.2)', color: 'var(--teal)' }}>
              <RefreshCw size={13} /> Renew Loan
            </button>
          )}

          {/* Renew Confirmation Banner */}
          {confirmingRenew && (() => {
            const level = borrower?.loan_limit_level || 1
            const limitMap = { 4: 10000, 3: 9000, 2: 7000, 1: 5000 }
            const tierMap = { 4: '👑 VIP', 3: '🤝 Reliable', 2: '⭐ Trusted', 1: '🌱 New' }
            
            const newMax = limitMap[level] || 5000
            const tierName = tierMap[level] || '🌱 New'
            const increased = newMax > loan.loan_amount
            
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, background: 'rgba(20,184,166,0.06)', border: '1px solid rgba(20,184,166,0.25)', borderRadius: 10, padding: '12px 14px', width: '100%', marginTop: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: 13 }}>
                    <span style={{ fontWeight: 700, color: 'var(--teal)' }}>{tierName} Tier Upgrade</span>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      Credit Score: <strong>{borrower?.credit_score || 0}</strong> · {' '}
                      {increased 
                        ? <span>Eligible limit increased to <strong style={{ color: 'var(--green)' }}>{formatCurrency(newMax)}</strong>!</span>
                        : <span>Eligible for renewal up to {formatCurrency(newMax)}</span>
                      }
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button 
                      onClick={() => { onRenew(loan, newMax); setConfirmingRenew(false) }}
                      style={{ background: 'var(--teal)', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}
                    >
                      Confirm Renewal
                    </button>
                    <button 
                      onClick={() => setConfirmingRenew(false)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12 }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )
          })()}

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
  const processingRef = useRef(false)
  const [loans, setLoans] = useState([])
  const [borrowers, setBorrowers] = useState([])
  const [investors, setInvestors] = useState([])
  const [settings, setSettings] = useState(null)
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingLoan, setEditingLoan] = useState(null)
  const [prefillLoan, setPrefillLoan] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [defaultTarget, setDefaultTarget] = useState(null)
  const [principalPayTarget, setPrincipalPayTarget] = useState(null)
  const [loanTypeTab, setLoanTypeTab] = useState('all')
  const { user } = useAuth()
  const { toast } = useToast()
  const overdueAppliedRef = useRef(false)
  const [syncingPenalties, setSyncingPenalties] = useState(false)
  const [systemStatus, setSystemStatus] = useState('loading') // loading, healthy, failing
  const fetchData = useCallback(async () => {
    const [{ data: l }, { data: b }, { data: s }, { data: apps }, { data: inv }, { data: lastAudit }] = await Promise.all([
      supabase.from('loans').select('*').order('created_at', { ascending: false }),
      supabase.from('borrowers').select('*'),
      supabase.from('settings').select('*').eq('id', 1).single(),
      supabase.from('applications').select('id,release_method,gcash_number,gcash_name,bank_account_number,bank_name,bank_account_holder,full_name,email').eq('status', 'Approved').order('created_at', { ascending: false }),
      supabase.from('investors').select('id,full_name,tier,total_capital,access_code'),
      supabase.from('audit_logs').select('created_at').in('action_type', ['PENALTY_CHARGED', 'INSTALLMENT_PAID']).order('created_at', { ascending: false }).limit(1)
    ])
    setLoans(l || [])
    setBorrowers(b || [])
    setInvestors(inv || [])
    setSettings(s)
    setApplications(apps || [])

    // Heartbeat Logic
    const overdueLoans = (l || []).filter(loan => loan.status === 'Overdue')
    if (overdueLoans.length > 0) {
      if (!lastAudit || lastAudit.length === 0) {
        setSystemStatus('failing')
      } else {
        const lastRun = new Date(lastAudit[0].created_at)
        const diffHours = (new Date() - lastRun) / (1000 * 60 * 60)
        setSystemStatus(diffHours > 24 ? 'failing' : 'healthy')
      }
    } else {
      setSystemStatus('healthy')
    }

    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Auto-apply overdue penalties once per page visit ────────────────
  // Fires after the first data load. Scans all active installment loans and
  // calls apply_overdue_penalties for any installment that is past its due date.
  // Idempotent: same-day calls are no-ops in the SQL function (zero delta days).
  useEffect(() => {
    if (!loading && !overdueAppliedRef.current && loans.length > 0) {
      overdueAppliedRef.current = true
      handleSyncOverduePenalties({ silent: true })
    }
  }, [loading])

  // ── Sync overdue penalties for all active installment loans ─────────
  const handleSyncOverduePenalties = async ({ silent = false } = {}) => {
    if (syncingPenalties) return
    setSyncingPenalties(true)
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const candidates = loans.filter(l =>
      ['Active', 'Partially Paid', 'Overdue'].includes(l.status) &&
      l.loan_type !== 'quickloan' &&
      l.release_date
    )
    let penaltyCount = 0
    let scoreCount = 0
    for (const loan of candidates) {
      const numInst = loan.num_installments || 4
      const allDates = getInstallmentDates(loan.release_date, numInst)
      const nextDueDate = allDates[loan.payments_made] // 0-indexed = next unpaid
      if (!nextDueDate) continue
      nextDueDate.setHours(0, 0, 0, 0)
      if (nextDueDate >= today) continue // not yet overdue
      const dueDateStr = formatDateValue(nextDueDate) // YYYY-MM-DD (local time, no UTC shift)
      const instNum = loan.payments_made + 1
      const { data } = await supabase.rpc('apply_overdue_penalties', {
        p_loan_id:         loan.id,
        p_due_date_str:    dueDateStr,
        p_installment_num: instNum,
        p_admin_email:     user?.email || 'system'
      })
      if (data?.success && !data?.skipped) {
        if ((data.net_penalty || 0) > 0) penaltyCount++
        if ((data.score_change || 0) < 0) scoreCount++
      }
    }
    setSyncingPenalties(false)
    if (!silent && (penaltyCount > 0 || scoreCount > 0)) {
      toast(`⚠️ Penalties synced: ${penaltyCount} loan(s) charged, ${scoreCount} credit score(s) updated`, 'info')
    } else if (!silent) {
      toast('Penalties up to date — no new charges', 'success')
    }
    if (penaltyCount > 0 || scoreCount > 0) fetchData()
  }

  const handleSave = async (form, isEdit) => {
    if (isEdit) {
      const { error } = await supabase.from('loans').update({
        loan_amount: form.loan_amount,
        interest_rate: form.interest_rate,
        total_repayment: form.total_repayment,
        installment_amount: form.installment_amount,
        loan_purpose: form.loan_purpose,
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

      const borrower = borrowers.find(b => b.id === form.borrower_id)
      const { hold, released } = calcSecurityHold(form.loan_amount, borrower?.credit_score)

      const { error } = await supabase.from('loans').insert({
        borrower_id: form.borrower_id,
        loan_type: form.loan_type || 'regular',
        loan_amount: form.loan_amount,
        interest_rate: form.interest_rate,
        total_repayment: form.total_repayment,
        installment_amount: form.installment_amount,
        loan_term: form.loan_term || null,
        num_installments: form.num_installments,
        release_date: form.release_date,
        due_date: form.due_date,
        remaining_balance: form.loan_type === 'quickloan' ? form.loan_amount : form.total_repayment,
        payments_made: 0,
        status: 'Pending',
        agreement_confirmed: form.agreement_confirmed,
        loan_purpose: form.loan_purpose,
        notes: form.notes,
        security_hold: form.loan_type === 'quickloan' ? 0 : hold,
        security_hold_original: form.loan_type === 'quickloan' ? 0 : hold, // ← tracks original for penalty delta calc
        funds_released: form.loan_type === 'quickloan' ? form.loan_amount : released,
        security_hold_returned: false,
        extension_fee_charged: false
      })
      if (error) { toast('Failed to create loan', 'error'); return }

      await logAudit({
        action_type: prefillLoan ? 'LOAN_RENEWED' : 'LOAN_CREATED',
        module: 'Loan',
        description: `${prefillLoan ? 'Loan renewed' : 'New loan created'} for ${borrower?.full_name} — ₱${form.loan_amount.toLocaleString()} (Security Hold: ₱${hold})`,
        changed_by: user?.email
      })
      toast(`Loan created for ${borrower?.full_name}`, 'success')
    }
    setModalOpen(false)
    setEditingLoan(null)
    setPrefillLoan(null)
    fetchData()
  }

  const handleRecordPrincipalPayment = async (loan, amount) => {
    const borrower = borrowers.find(b => b.id === loan.borrower_id)
    const today = new Date()
    const todayStr = today.getFullYear() + '-' + String(today.getMonth()+1).padStart(2,'0') + '-' + String(today.getDate()).padStart(2,'0')
    const currentPrincipal = parseFloat(loan.current_principal ?? loan.loan_amount)
    const newPrincipal = Math.max(0, parseFloat((currentPrincipal - amount).toFixed(2)))

    // Insert into principal_payments table
    const { error: ppErr } = await supabase.from('principal_payments').insert({
      loan_id: loan.id,
      borrower_id: loan.borrower_id,
      amount_paid: amount,
      principal_before: currentPrincipal,
      principal_after: newPrincipal,
      status: 'approved',
      paid_date: todayStr,
      approved_at: today.toISOString(),
      notes: `Admin-recorded principal reduction of ₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
    })
    if (ppErr) { toast('Failed to insert principal payment: ' + ppErr.message, 'error'); return }

    // Update loan: new current_principal + reset interest baseline
    const { error: lErr } = await supabase.from('loans').update({
      current_principal: newPrincipal,
      interest_baseline_date: todayStr
    }).eq('id', loan.id)
    if (lErr) { toast('Failed to update loan principal: ' + lErr.message, 'error'); return }

    await logAudit({
      action_type: 'PRINCIPAL_PAYMENT_RECORDED',
      module: 'Loan',
      description: `Principal reduced by ₱${amount} for ${borrower?.full_name}. New principal: ₱${newPrincipal}`,
      changed_by: user?.email
    })

    // Direct capital_flow insert for mid-loan principal returns
    await supabase.from('capital_flow').insert({
      entry_date: todayStr,
      type: 'CASH IN',
      category: 'Loan Principal Return',
      amount: amount,
      notes: `Auto: Principal payment from ${borrower?.full_name || 'Borrower'} — ₱${amount} toward QuickLoan principal (reduced from ₱${currentPrincipal} to ₱${newPrincipal})`
    })

    toast(`✅ Principal reduced by ₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })} for ${borrower?.full_name}`, 'success')
    fetchData()
  }

  // ── Shared early-rebate helper ──────────────────────────────────────
  // Returns true if a rebate was applied. Call after the loan reaches Paid status.
  const applyEarlyRebate = async (loan, resultBorrowerName, isFullPayoff = false) => {
    if (!loan.release_date) return false
    const numInst = loan.num_installments || 4
    const dates = getInstallmentDates(loan.release_date, numInst)
    const finalDue = dates[numInst - 1]
    if (!finalDue) return false
    const today = new Date(); today.setHours(0, 0, 0, 0)
    finalDue.setHours(0, 0, 0, 0)
    const daysEarly = Math.ceil((finalDue - today) / (1000 * 60 * 60 * 24))
    if (daysEarly < 7) return false

    const rebateAmount = 50 // Flat ₱50 rebate regardless of loan amount
    const { data: walletData } = await supabase
      .from('wallets').select('id, balance').eq('borrower_id', loan.borrower_id).maybeSingle()

    if (walletData) {
      await supabase.from('wallets').update({
        balance: parseFloat((walletData.balance + rebateAmount).toFixed(2)),
        updated_at: new Date().toISOString()
      }).eq('id', walletData.id)
    } else {
      await supabase.from('wallets').insert({ borrower_id: loan.borrower_id, balance: rebateAmount })
    }

    await supabase.from('wallet_transactions').insert({
      borrower_id: loan.borrower_id,
      loan_id: loan.id,
      type: 'rebate',
      amount: rebateAmount,
      description: `Early payoff rebate (1% — ${daysEarly} days early)`,
      status: 'completed'
    })

    if (loan.loan_type !== 'quickloan') {
      const notes = isFullPayoff
        ? `1% early completion rebate (full payoff) — ${resultBorrowerName} (₱${loan.loan_amount?.toLocaleString()} loan, ${daysEarly} days early)`
        : `1% early completion rebate — ${resultBorrowerName} (₱${loan.loan_amount?.toLocaleString()} loan, ${daysEarly} days early)`

      await supabase.from('capital_flow').insert({
        entry_date: new Date().toISOString().slice(0, 10),
        type: 'CASH OUT',
        category: 'Rebate Issued',
        amount: rebateAmount,
        notes
      })
    }

    await logAudit({
      action_type: 'CREDITS_REBATE',
      module: 'Loan',
      description: `Early payoff rebate of ₱${rebateAmount} credited to ${resultBorrowerName}'s Rebate Credits`,
      changed_by: user?.email
    })

    return { rebateAmount, daysEarly }
  }

  const handleRecordPayment = async (loan, cashLocation = 'hand') => {
    const borrower = borrowers.find(b => b.id === loan.borrower_id)
    const numInstallments = loan.num_installments || 4

    // Calculate due date for penalty assessment (must happen client-side because
    // getInstallmentDates is a shared JS helper not available in Postgres)
    let dueDateStr = null
    if (loan.release_date) {
      const allDates = getInstallmentDates(loan.release_date, numInstallments)
      const dueDate = allDates[loan.payments_made]
      if (dueDate) {
        dueDateStr = formatDateValue(dueDate)  // YYYY-MM-DD (local time, no UTC shift)
      }
    }

    // Determine if hold netting applies on this final installment
    const nextInstNum = loan.payments_made + 1
    const isFinal = nextInstNum >= numInstallments
    const shouldNet = isFinal && (loan.security_hold || 0) > 0 && !loan.security_hold_returned

    // ── BL-01 FIX: Single atomic RPC call for all financial mutations ──
    const { data: result, error } = await supabase.rpc('record_installment_payment', {
      p_loan_id: loan.id,
      p_admin_email: user?.email || 'system',
      p_due_date_str: dueDateStr,
      p_net_hold: shouldNet   // TRUE only on final installment when hold exists and not yet returned
    })

    if (error || !result?.success) {
      toast(result?.error || error?.message || 'Failed to record payment', 'error')
      return
    }

    // ── Auto-log to capital_flow ledger ──
    await logAutomatedPayment(loan, result.install_amount || Math.ceil(loan.installment_amount), cashLocation)

    // ── Non-transactional side effects (safe to fail independently) ──

    // Penalty toast
    if (result.penalty_amount > 0) {
      if (result.hold_deducted > 0) {
        toast(`⚠️ Late penalty of ₱${result.penalty_amount} auto-deducted from Security Hold (${result.days_late} days late)`, 'error')
      } else {
        toast(`⚠️ Late penalty of ₱${result.penalty_amount} applied (${result.days_late} days late)`, 'error')
      }
    }

    if (result.new_status === 'Paid') {
      // ── Early payoff rebate (client-side, non-critical) ──
      const rebateResult = await applyEarlyRebate(loan, result.borrower_name)
      const earlyRebateApplied = !!rebateResult
      if (earlyRebateApplied) {
        toast(`🎉 Loan fully paid by ${result.borrower_name}! Early rebate of ₱${rebateResult.rebateAmount} added to Rebate Credits!`, 'success')
      }

      if (!earlyRebateApplied) {
        if (result.hold_netted) {
          toast(
            `🎉 Loan fully paid by ${result.borrower_name}! ₱${result.hold_for_netting} hold netted & redeployed. Rebate credit posted to wallet.`,
            'success'
          )
        } else {
          toast(`🎉 Loan fully paid by ${result.borrower_name}!`, 'success')
        }
      }

      // Send tier upgrade email if level increased
      const oldLevel = result.old_level || 1
      const newLevel = result.new_level || 1
      if (result.borrower_email && newLevel > oldLevel) {
        const tierNames = { 1: 'New', 2: 'Trusted', 3: 'Reliable', 4: 'VIP' }
        const limitMap = { 1: 5000, 2: 7000, 3: 9000, 4: 10000 }
        try {
          await sendTierUpgradeEmail({
            to: result.borrower_email,
            borrowerName: result.borrower_name,
            accessCode: result.borrower_access_code,
            oldTier: tierNames[oldLevel],
            newTier: tierNames[newLevel],
            newLimit: limitMap[newLevel],
          })
        } catch (e) {
          console.warn('Tier upgrade email failed:', e)
        }
      }
    } else {
      toast(`✅ Installment ${result.new_payments_made} of ${numInstallments} recorded for ${result.borrower_name}`, 'success')
    }

    // Download receipt
    downloadReceiptPDF({ loan, borrower, installmentNum: result.new_payments_made, amount: result.install_amount })

    // Send payment confirmed email
    if (result.borrower_email) {
      const paymentDate = new Date().toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })
      const loanFullyPaid = result.new_status === 'Paid'
      try {
        await sendPaymentConfirmedEmail({
          to: result.borrower_email,
          borrowerName: result.borrower_name,
          accessCode: result.borrower_access_code,
          installmentNum: result.new_payments_made,
          numInstallments: loan.num_installments || 4,
          amountPaid: result.install_amount,
          paymentDate,
          remainingBalance: result.new_balance,
          loanFullyPaid,
        })
      } catch (e) {
        console.warn('Payment confirmed email failed:', e)
        toast('Failed to send payment confirmation email.', 'error')
      }
    }

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
      const newScore = Math.max(CREDIT_CONFIG.MIN_SCORE, borrower.credit_score + CREDIT_CONFIG.LOAN_DEFAULT)
      const newBadge = getBadgeStatus(newScore, borrower.clean_loans || 0)
      await supabase.from('borrowers').update({
        credit_score: newScore,
        risk_score: CREDIT_CONFIG.riskFromScore(newScore),
        loyalty_badge: newBadge
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

  const handleRenew = (loan, suggestedMax) => {
    setPrefillLoan({ 
      borrower_id: loan.borrower_id, 
      loan_amount: loan.loan_amount, 
      interest_rate: loan.interest_rate, 
      loan_type: loan.loan_type,
      suggested_max: suggestedMax
    })
    setEditingLoan(null)
    setModalOpen(true)
  }

  // ── Assign / Unassign Investor ──────────────────────────────
  const handleAssignInvestor = async (loan, investorId) => {
    const borrower = borrowers.find(b => b.id === loan.borrower_id)
    const investor = investors.find(i => i.id === investorId)
    const { error } = await supabase.from('loans').update({
      investor_id: investorId,
      updated_at: new Date().toISOString()
    }).eq('id', loan.id)
    if (error) { toast('Failed to assign investor: ' + error.message, 'error'); return }
    if (investorId) {
      await logAudit({ action_type: 'INVESTOR_ASSIGNED', module: 'Loan', description: `Loan for ${borrower?.full_name || 'Unknown'} (₱${loan.loan_amount?.toLocaleString()}) assigned to investor ${investor?.full_name || investorId}`, changed_by: user?.email })
      toast(`Loan assigned to ${investor?.full_name}`, 'success')
    } else {
      await logAudit({ action_type: 'INVESTOR_UNASSIGNED', module: 'Loan', description: `Investor unassigned from loan for ${borrower?.full_name || 'Unknown'}`, changed_by: user?.email })
      toast('Investor unassigned from loan', 'info')
    }
    fetchData()
  }

  // ── Installment Loan: Full Payoff (all remaining installments in one go) ──
  const handleFullPayoff = async (loan) => {
    const borrower = borrowers.find(b => b.id === loan.borrower_id)
    const numInstallments = loan.num_installments || 4
    const allDates = getInstallmentDates(loan.release_date, numInstallments)
    const remaining = numInstallments - loan.payments_made
    const holdAmt = loan.security_hold || 0
    const holdNotReturned = !loan.security_hold_returned

    let lastResult = null
    // Process each remaining installment sequentially
    for (let i = 0; i < remaining; i++) {
      const installmentIndex = loan.payments_made + i // 0-based index into allDates
      const dueDate = allDates[installmentIndex]
      const dueDateStr = dueDate ? formatDateValue(dueDate) : null

      // p_net_hold = true only on the very last installment when hold has not yet been returned
      const isLast = i === remaining - 1
      const shouldNet = isLast && holdAmt > 0 && holdNotReturned

      const { data: result, error } = await supabase.rpc('record_installment_payment', {
        p_loan_id: loan.id,
        p_admin_email: user?.email || 'system',
        p_due_date_str: dueDateStr,
        p_net_hold: shouldNet
      })

      if (error || !result?.success) {
        toast(result?.error || error?.message || `Failed at installment ${installmentIndex + 1}`, 'error')
        fetchData()
        return
      }

      lastResult = result
    }

    if (!lastResult) return

    // ── Early rebate check (same logic as per-installment path) ──
    const rebateResult = await applyEarlyRebate(loan, lastResult.borrower_name || borrower?.full_name, true)

    // ── Tier upgrade email ──
    const oldLevel = lastResult.old_level || 1
    const newLevel = lastResult.new_level || 1
    if (lastResult.borrower_email && newLevel > oldLevel) {
      const tierNames = { 1: 'New', 2: 'Trusted', 3: 'Reliable', 4: 'VIP' }
      const limitMap = { 1: 5000, 2: 7000, 3: 9000, 4: 10000 }
      try {
        await sendTierUpgradeEmail({
          to: lastResult.borrower_email,
          borrowerName: lastResult.borrower_name,
          accessCode: lastResult.borrower_access_code,
          oldTier: tierNames[oldLevel],
          newTier: tierNames[newLevel],
          newLimit: limitMap[newLevel],
        })
      } catch (e) {
        console.warn('Tier upgrade email failed:', e)
      }
    }

    // ── Send payment confirmed email for final installment ──
    if (lastResult.borrower_email) {
      const paymentDate = new Date().toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })
      try {
        await sendPaymentConfirmedEmail({
          to: lastResult.borrower_email,
          borrowerName: lastResult.borrower_name,
          accessCode: lastResult.borrower_access_code,
          installmentNum: numInstallments,
          numInstallments,
          amountPaid: lastResult.install_amount,
          paymentDate,
          remainingBalance: 0,
          loanFullyPaid: true,
        })
      } catch (e) {
        console.warn('Payment confirmed email failed:', e)
      }
    }

    // ── Audit log ──
    await logAudit({
      action_type: 'FULL_PAYOFF_RECORDED',
      module: 'Loan',
      description: `Full payoff recorded for ${borrower?.full_name} — ${remaining} installment(s) processed.${holdAmt > 0 && holdNotReturned ? ` ₱${holdAmt} security hold returned.` : ''}${rebateResult ? ` Early rebate ₱${rebateResult.rebateAmount} credited.` : ''}`,
      changed_by: user?.email
    })

    // ── Single success toast ──
    const parts = []
    if (holdAmt > 0 && holdNotReturned) parts.push('Hold returned')
    if (rebateResult) parts.push(`₱${rebateResult.rebateAmount} rebate credited`)
    toast(
      `✅ Full payoff recorded for ${borrower?.full_name}!${parts.length ? ' ' + parts.join(' + ') + '.' : ''}`,
      'success'
    )

    fetchData()
  }

  // ── QuickLoan full payoff ─────────────────────────────────────
  // Collects everything owed today: principal + accrued interest + extension fee + any penalty
  const handleConfirmRelease = async (loan) => {
    const borrower = borrowers.find(b => b.id === loan.borrower_id)
    const today = new Date()
    const todayStr = today.getFullYear() + '-' + String(today.getMonth()+1).padStart(2,'0') + '-' + String(today.getDate()).padStart(2,'0')

    const { error } = await supabase.from('loans').update({
      status: 'Active',
      release_date: todayStr,
      updated_at: new Date().toISOString()
    }).eq('id', loan.id)

    if (error) { toast('Failed to confirm release', 'error'); return }

    // BL-08 FIX: Log the exact physical CASH OUT (funds actually handed to borrower)
    const amountReleased = loan.funds_released || loan.loan_amount || 0;
    if (amountReleased > 0) {
      await supabase.from('capital_flow').insert({
        entry_date: todayStr,
        type: 'CASH OUT',
        category: 'Loan Disbursed',
        amount: amountReleased,
        notes: `Loan Disbursed — ${borrower?.full_name || 'Borrower'} (${loan.loan_type === 'quickloan' ? 'QuickLoan' : 'Installment'})`
      });
    }

    await notifyBorrower({
      borrower_id: loan.borrower_id,
      type: 'funds_released',
      title: '💸 Your funds have been released!',
      message: `Your loan of ${formatCurrency(loan.loan_amount)} has been released today (${todayStr}). Check your payment schedule in the portal for your installment due dates.`
    })

    // Send funds released email
    // FIX 4: Catch email failures and show toast instead of silently swallowing errors
    if (borrower?.email) {
      const numInstallments = loan.num_installments || 4
      const allDates = getInstallmentDates(todayStr, numInstallments)
      const firstDueDate = allDates[0]?.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' }) || '—'
      const releaseDateFormatted = today.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })
      try {
        await sendFundsReleasedEmail({
          to: borrower.email,
          borrowerName: borrower.full_name,
          accessCode: borrower.access_code,
          loanAmount: loan.loan_amount,
          loanType: loan.loan_type === 'quickloan' ? 'QuickLoan' : 'Installment Loan',
          releaseDate: releaseDateFormatted,
          firstDueDate,
          numInstallments,
          installmentAmount: Math.ceil(loan.installment_amount),
        })
      } catch (e) {
        console.warn('Funds released email failed:', e)
        toast('Failed to send funds released email.', 'error')
      }
    }

    await logAudit({
      action_type: 'LOAN_FUNDS_RELEASED',
      module: 'Loan',
      description: `Funds confirmed released for ${borrower?.full_name} — ${formatCurrency(loan.loan_amount)} on ${todayStr}. Loan is now Active.`,
      changed_by: user?.email
    })

    toast(`✅ Funds released — ${borrower?.full_name}'s loan is now Active`, 'success')
    fetchData()
  }

  const handleQuickLoanPayoff = async (loan, cashLocation = 'hand') => {
    if (processingRef.current) return
    processingRef.current = true
    try {
      const balance = calcQuickLoanBalance(loan)
    const borrower = borrowers.find(b => b.id === loan.borrower_id)
    const totalCollected = balance.totalOwed

    const { error } = await supabase.from('loans').update({
      status: 'Paid',
      payments_made: 1,
      remaining_balance: 0,
      total_repayment: totalCollected,
      updated_at: new Date().toISOString()
    }).eq('id', loan.id)

    if (error) { toast('Failed to record QuickLoan payoff', 'error'); return }

    // Log Automated Accounting Movement
    await logAutomatedPayment(loan, totalCollected, cashLocation)

    // Log penalty if in penalty phase
    if (balance.penaltyAccrued > 0) {
      const penaltyDays = balance.daysElapsed - QUICKLOAN_CONFIG.DAY30_THRESHOLD
      await supabase.from('penalty_charges').insert({
        borrower_id: loan.borrower_id,
        loan_id: loan.id,
        installment_number: 1,
        days_late: penaltyDays,
        penalty_per_day: QUICKLOAN_CONFIG.PENALTY_PER_DAY,
        penalty_amount: balance.penaltyAccrued,
        cap_applied: false,
        created_at: new Date().toISOString()
      })
    }

    // +25 credit score completion bonus + badge update
    if (borrower) {
      const currentPoints = borrower.credit_score || CREDIT_CONFIG.STARTING_SCORE
      const newScore = Math.min(CREDIT_CONFIG.MAX_SCORE, currentPoints + CREDIT_CONFIG.FULL_LOAN_COMPLETE)
      const newRisk = CREDIT_CONFIG.riskFromScore(newScore)
      const newCleanLoans = (borrower.clean_loans || 0) + 1
      const newBadge = getBadgeStatus(newScore, newCleanLoans) 
      const newLevel = newScore >= 1000 ? 4 : newScore >= 920 ? 3 : newScore >= 835 ? 2 : 1
      const newLimit = newLevel === 4 ? 10000 : newLevel === 3 ? 9000 : newLevel === 2 ? 7000 : 5000
      
      await supabase.from('borrowers').update({
        credit_score: newScore,
        risk_score: newRisk,
        loyalty_badge: newBadge,
        clean_loans: newCleanLoans,
        loan_limit_level: newLevel,
        loan_limit: newLimit
      }).eq('id', borrower.id)
    }



    await logAudit({
      action_type: 'QUICKLOAN_PAID',
      module: 'Loan',
      description: `QuickLoan fully paid by ${borrower?.full_name} — ${formatCurrency(totalCollected)} collected (principal ${formatCurrency(balance.principal)} + interest ${formatCurrency(balance.accruedInterest)}${balance.extensionFee > 0 ? ` + ext fee ${formatCurrency(balance.extensionFee)}` : ''}${balance.penaltyAccrued > 0 ? ` + penalty ${formatCurrency(balance.penaltyAccrued)}` : ''}) on day ${balance.daysElapsed}. Credit score +${CREDIT_CONFIG.FULL_LOAN_COMPLETE}.`,
      changed_by: user?.email
    })

      toast(`✅ QuickLoan paid — ${formatCurrency(totalCollected)} collected · Credit score +${CREDIT_CONFIG.FULL_LOAN_COMPLETE}`, 'success')
      fetchData()
    } finally {
      processingRef.current = false
    }
  }

  // ── QuickLoan Day 15 missed: collect interest + extension fee, roll principal ──
  const handleQuickLoanDay15Missed = async (loan, cashLocation = 'hand') => {
    if (loan.extension_fee_charged) { toast('Extension fee already charged', 'info'); return }
    const { EXTENSION_FEE, DAY15_THRESHOLD, DAILY_RATE } = QUICKLOAN_CONFIG
    const accruedInterest = parseFloat((loan.loan_amount * DAILY_RATE * DAY15_THRESHOLD).toFixed(2))
    const collectNow = parseFloat((accruedInterest + EXTENSION_FEE).toFixed(2))
    const borrower = borrowers.find(b => b.id === loan.borrower_id)

    const todayStr = formatDateValue(new Date())
    const { error } = await supabase.from('loans').update({
      extension_fee_charged: true,
      status: 'Active',
      interest_baseline_date: todayStr,
      updated_at: new Date().toISOString()
    }).eq('id', loan.id)

    if (error) { toast('Failed to record extension', 'error'); return }

    // Log Automated Accounting Movement (Interest + Extension Fee)
    await logAutomatedPayment(loan, collectNow, cashLocation)

    await logAudit({
      action_type: 'QUICKLOAN_DAY15_MISSED',
      module: 'Loan',
      description: `QuickLoan Day 15 missed for ${borrower?.full_name} — Collected ₱${collectNow} (₱${accruedInterest} interest + ₱${EXTENSION_FEE} extension fee). Principal ₱${loan.loan_amount} rolls to Day 30.`,
      changed_by: user?.email
    })

    toast(`⚡ Collected ${formatCurrency(collectNow)} — principal rolls to Day 30`, 'success')
    fetchData()
  }

  const statuses = ['All', 'Pending', 'Active', 'Paid', 'Overdue', 'Defaulted']
  const filtered = loans.filter(l => {
    const borrower = borrowers.find(b => b.id === l.borrower_id)
    const matchSearch = borrower?.full_name?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'All' 
      ? true 
      : statusFilter === 'Active' 
        ? ['Active', 'Partially Paid'].includes(l.status) 
        : l.status === statusFilter
    const matchType = loanTypeTab === 'all' || l.loan_type === loanTypeTab || (!l.loan_type && loanTypeTab === 'regular')
    return matchSearch && matchStatus && matchType
  })

  const tabLoans = (tab) => loans.filter(l => tab === 'all' || l.loan_type === tab || (!l.loan_type && tab === 'regular'))

  const stats = {
    active: filtered.filter(l => ['Active', 'Partially Paid'].includes(l.status)).length,
    pending: filtered.filter(l => l.status === 'Pending').length,
    paid: filtered.filter(l => l.status === 'Paid').length,
    overdue: filtered.filter(l => l.status === 'Overdue').length,
    defaulted: filtered.filter(l => l.status === 'Defaulted').length,
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
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 9, border: '1px solid rgba(255,255,255,0.05)'
          }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: systemStatus === 'healthy' ? 'var(--green)' : systemStatus === 'failing' ? 'var(--red)' : '#ccc',
              boxShadow: systemStatus === 'healthy' ? '0 0 8px var(--green)' : systemStatus === 'failing' ? '0 0 8px var(--red)' : 'none'
            }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {systemStatus === 'healthy' ? 'System Live' : systemStatus === 'failing' ? 'Cron Failure' : 'Checking...'}
            </span>
          </div>
          <button
            onClick={() => { overdueAppliedRef.current = true; handleSyncOverduePenalties({ silent: false }) }}
            disabled={syncingPenalties}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 9, fontSize: 13, fontWeight: 600,
              border: syncingPenalties ? '1px solid rgba(59,130,246,0.3)' : '1px solid var(--blue)',
              background: syncingPenalties ? 'rgba(59,130,246,0.05)' : 'var(--blue)',
              color: syncingPenalties ? 'var(--blue)' : '#fff', cursor: syncingPenalties ? 'not-allowed' : 'pointer',
              opacity: syncingPenalties ? 0.6 : 1, transition: 'all 0.15s'
            }}
          >
            <RefreshCw size={14} className={syncingPenalties ? 'spin' : ''} />
            {syncingPenalties ? 'Syncing...' : 'Sync Financials'}
          </button>
          <button className="btn-primary" onClick={() => { setEditingLoan(null); setPrefillLoan(null); setModalOpen(true) }} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Plus size={16} /> New Loan
          </button>
        </div>
      </div>

      {/* Loan type tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 22, background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 4, width: 'fit-content' }}>
        {[
          { key: 'all', label: 'All Loans', count: loans.length },
          { key: 'regular', label: 'Installment', count: tabLoans('regular').length },
          { key: 'quickloan', label: '⚡ QuickLoan', count: tabLoans('quickloan').length },
        ].map(tab => (
          <button key={tab.key} onClick={() => { setLoanTypeTab(tab.key); setStatusFilter('All') }}
            style={{
              padding: '7px 16px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: loanTypeTab === tab.key
                ? tab.key === 'quickloan' ? 'rgba(245,158,11,0.15)' : 'rgba(59,130,246,0.15)'
                : 'transparent',
              color: loanTypeTab === tab.key
                ? tab.key === 'quickloan' ? '#F59E0B' : 'var(--blue)'
                : 'var(--text-muted)',
              transition: 'all 0.15s ease', display: 'flex', alignItems: 'center', gap: 7
            }}>
            {tab.label}
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 20,
              background: loanTypeTab === tab.key
                ? tab.key === 'quickloan' ? 'rgba(245,158,11,0.2)' : 'rgba(59,130,246,0.2)'
                : 'rgba(255,255,255,0.06)',
              color: loanTypeTab === tab.key
                ? tab.key === 'quickloan' ? '#F59E0B' : 'var(--blue)'
                : 'var(--text-muted)'
            }}>{tab.count}</span>
          </button>
        ))}
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
