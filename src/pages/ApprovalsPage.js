import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'
import { logAudit } from '../lib/helpers'
import { sendPaymentConfirmedEmail } from '../lib/emailService'
import { 
  ExternalLink, 
  Image, 
  CheckCircle, 
  XCircle, 
  Banknote, 
  Smartphone, 
  Building2, 
  CreditCard, 
  Printer, 
  PenTool,
  FileText
} from 'lucide-react'
import { SignaturePad } from '../components/SignaturePad'
import InvestorMoa from '../components/InvestorMoa'

// ── Notify borrower helper ────────────────────────────────────
async function notifyBorrower({ borrower_id, type, title, message }) {
  await supabase.from('portal_notifications').insert({ borrower_id, type, title, message })
}

// ── Principal Payments Panel ────────────────────────────────
function PrincipalPaymentsPanel({ user }) {
  const [payments, setPayments] = useState([])
  const [signedUrls, setSignedUrls] = useState({})
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const fetchPayments = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('principal_payments')
      .select('*, borrowers(full_name, access_code, email), loans(loan_amount, current_principal, release_date, interest_baseline_date, status)')
      .eq('status', 'Pending')
      .order('created_at', { ascending: false })
    setPayments(data || [])
    if (data && data.length > 0) {
      const urls = {}
      for (const p of data) {
        if (p.file_path) {
          const { data: signed } = await supabase.storage.from('payment-proofs').createSignedUrl(p.file_path, 3600)
          if (signed?.signedUrl) urls[p.id] = signed.signedUrl
        }
      }
      setSignedUrls(urls)
    }
    setLoading(false)
  }

  useEffect(() => { fetchPayments() }, [])

  const handleApprove = async (pmt) => {
    try {
      const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
      const newPrincipal = parseFloat(pmt.principal_after)
      const isFullyPaid = newPrincipal <= 0

      // 1. Confirm the principal_payment record
      await supabase.from('principal_payments').update({
        status: 'Confirmed',
        reviewed_by: user?.email,
        reviewed_at: new Date().toISOString()
      }).eq('id', pmt.id)

      // 2. Update the loan — reduce principal, reset interest baseline
      const loanUpdate = {
        current_principal: Math.max(0, newPrincipal),
        interest_baseline_date: today,
        updated_at: new Date().toISOString()
      }
      if (isFullyPaid) {
        loanUpdate.status = 'Paid'
        loanUpdate.remaining_balance = 0
      }
      await supabase.from('loans').update(loanUpdate).eq('id', pmt.loan_id)

      // 3. Notify borrower
      await notifyBorrower({
        borrower_id: pmt.borrower_id,
        type: 'principal_payment_confirmed',
        title: isFullyPaid ? '🎉 Loan Fully Paid!' : '✅ Principal Payment Confirmed',
        message: isFullyPaid
          ? `Your payment of ₱${Number(pmt.payment_amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })} has been confirmed. Your loan is now fully paid off! 🎉`
          : `Your principal payment of ₱${Number(pmt.payment_amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })} has been confirmed. ₱${Number(pmt.interest_portion).toLocaleString('en-PH', { minimumFractionDigits: 2 })} covered accrued interest and ₱${Number(pmt.principal_portion).toLocaleString('en-PH', { minimumFractionDigits: 2 })} reduced your principal. New principal: ₱${newPrincipal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}. Daily interest resets from today.`
      })

      // 4. Audit log
      await logAudit({
        action_type: isFullyPaid ? 'QUICKLOAN_PAID_VIA_PRINCIPAL_PAYMENT' : 'PRINCIPAL_PAYMENT_CONFIRMED',
        module: 'Approvals',
        description: `Principal payment confirmed for ${pmt.borrowers?.full_name} — ₱${pmt.payment_amount} paid (₱${pmt.interest_portion} interest + ₱${pmt.principal_portion} principal reduction). New principal: ₱${newPrincipal}${isFullyPaid ? ' — LOAN FULLY PAID' : ''}`,
        changed_by: user?.email
      })

      toast(isFullyPaid ? `🎉 Loan marked as Paid for ${pmt.borrowers?.full_name}` : 'Principal payment confirmed', 'success')
      fetchPayments()
    } catch (err) {
      console.error(err)
      toast('Failed to approve principal payment', 'error')
    }
  }

  const handleReject = async (pmt) => {
    await supabase.from('principal_payments').update({
      status: 'Rejected',
      reviewed_by: user?.email,
      reviewed_at: new Date().toISOString()
    }).eq('id', pmt.id)
    await logAudit({
      action_type: 'PRINCIPAL_PAYMENT_REJECTED',
      module: 'Approvals',
      description: `Principal payment rejected for ${pmt.borrowers?.full_name}`,
      changed_by: user?.email
    })
    await notifyBorrower({
      borrower_id: pmt.borrower_id,
      type: 'principal_payment_rejected',
      title: '❌ Principal Payment Rejected',
      message: 'Your principal payment proof was rejected. Please re-upload a clear screenshot and try again.'
    })
    toast('Principal payment rejected', 'info')
    fetchPayments()
  }

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 28 }}>
      {/* Header */}
      <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 18 }}>💳</span>
          </div>
          <div>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>Principal Payments</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Approve borrower payments that reduce QuickLoan principal</div>
          </div>
        </div>
        {payments.length > 0 && (
          <span style={{ background: '#6366F1', color: '#fff', fontSize: 11, fontWeight: 800, borderRadius: 20, padding: '3px 12px' }}>
            {payments.length} pending
          </span>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: '20px 24px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontSize: 13 }}>Loading...</div>
        ) : payments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <CheckCircle size={36} color="var(--green)" style={{ marginBottom: 12, opacity: 0.5 }} />
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 6 }}>All caught up!</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No principal payment requests pending review.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {payments.map(pmt => (
              <div key={pmt.id} style={{ background: 'rgba(99,102,241,0.03)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 14, padding: '16px 18px' }}>
                {/* Top row */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 3 }}>{pmt.borrowers?.full_name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>QuickLoan Principal Payment</div>
                    <div style={{ fontSize: 11, color: '#4B5580', marginTop: 4 }}>{new Date(pmt.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                    {pmt.notes && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, fontStyle: 'italic' }}>"{pmt.notes}"</div>}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 22, color: '#6366F1' }}>
                      ₱{Number(pmt.payment_amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total payment</div>
                  </div>
                </div>

                {/* Payment breakdown grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginBottom: 14 }}>
                  {[
                    { label: 'Interest Covered', value: `₱${Number(pmt.interest_portion).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`, color: '#F59E0B' },
                    { label: 'Principal Reduced', value: `₱${Number(pmt.principal_portion).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`, color: '#22C55E' },
                    { label: 'Principal Before', value: `₱${Number(pmt.principal_before).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`, color: 'var(--text-label)' },
                    { label: 'Principal After', value: `₱${Number(pmt.principal_after).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`, color: pmt.principal_after <= 0 ? '#22C55E' : '#60A5FA' },
                  ].map((item, i) => (
                    <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '8px 10px' }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{item.label}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: item.color }}>{item.value}</div>
                    </div>
                  ))}
                </div>

                {pmt.principal_after <= 0 && (
                  <div style={{ marginBottom: 12, padding: '8px 12px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 8, fontSize: 12, color: '#22C55E', fontWeight: 700 }}>
                    🎉 Approving this will mark the loan as fully PAID
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {signedUrls[pmt.id] ? (
                    <a href={signedUrls[pmt.id]} target="_blank" rel="noreferrer"
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', borderRadius: 8, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', color: '#3B82F6', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
                      <ExternalLink size={12} /> View Proof
                    </a>
                  ) : (
                    <span style={{ padding: '8px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', color: '#4B5580', fontSize: 12 }}>No proof</span>
                  )}
                  <button onClick={() => handleApprove(pmt)}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(34,197,94,0.3)', background: 'rgba(34,197,94,0.1)', color: '#22C55E', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    ✓ Approve
                  </button>
                  <button onClick={() => handleReject(pmt)}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: '#EF4444', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    ✗ Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Payment Proofs Panel ──────────────────────────────────────
function PaymentProofsPanel({ user }) {
  const [proofs, setProofs] = useState([])
  const [signedUrls, setSignedUrls] = useState({})
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const fetchProofs = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('payment_proofs')
      .select('*, borrowers(full_name, access_code, email), loans(loan_amount, installment_amount, num_installments, remaining_balance)')
      .eq('status', 'Pending')
      .order('created_at', { ascending: false })
    setProofs(data || [])
    // Generate signed URLs
    if (data && data.length > 0) {
      const urls = {}
      for (const proof of data) {
        if (proof.file_path) {
          const { data: signed } = await supabase.storage
            .from('payment-proofs')
            .createSignedUrl(proof.file_path, 3600)
          if (signed?.signedUrl) urls[proof.id] = signed.signedUrl
        }
      }
      setSignedUrls(urls)
    }
    setLoading(false)
  }

  useEffect(() => { fetchProofs() }, [])

  const handleConfirm = async (proof) => {
    await supabase.from('payment_proofs').update({
      status: 'Confirmed', reviewed_by: user?.email, reviewed_at: new Date().toISOString()
    }).eq('id', proof.id)
    await logAudit({ action_type: 'PAYMENT_PROOF_CONFIRMED', module: 'Approvals', description: `Payment proof confirmed for ${proof.borrowers?.full_name} — Installment ${proof.installment_number}`, changed_by: user?.email })
    await notifyBorrower({ borrower_id: proof.borrower_id, type: 'payment_confirmed', title: '✅ Payment Confirmed', message: `Your Installment ${proof.installment_number} payment of ₱${Number(proof.loans?.installment_amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })} has been confirmed by the admin.` })
    // Send payment confirmed email
    if (proof.borrowers?.email) {
      const numInstallments = proof.loans?.num_installments || 4
      const installAmt = Math.ceil(proof.loans?.installment_amount || 0)
      const remaining = Math.max(0, (proof.loans?.remaining_balance || 0) - installAmt)
      const loanFullyPaid = remaining <= 0 || proof.installment_number >= numInstallments
      sendPaymentConfirmedEmail({
        to: proof.borrowers.email,
        borrowerName: proof.borrowers.full_name,
        accessCode: proof.borrowers.access_code,
        installmentNum: proof.installment_number,
        numInstallments,
        amountPaid: installAmt,
        paymentDate: new Date().toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' }),
        remainingBalance: remaining,
        loanFullyPaid,
      }).catch(e => console.warn('Payment email failed:', e))
    }
    toast('Payment proof confirmed', 'success')
    fetchProofs()
  }

  const handleReject = async (proof) => {
    await supabase.from('payment_proofs').update({
      status: 'Rejected', reviewed_by: user?.email, reviewed_at: new Date().toISOString()
    }).eq('id', proof.id)
    await logAudit({ action_type: 'PAYMENT_PROOF_REJECTED', module: 'Approvals', description: `Payment proof rejected for ${proof.borrowers?.full_name} — Installment ${proof.installment_number}`, changed_by: user?.email })
    await notifyBorrower({ borrower_id: proof.borrower_id, type: 'payment_rejected', title: '❌ Payment Proof Rejected', message: `Your Installment ${proof.installment_number} payment proof was rejected. Please re-upload a clear screenshot and try again.` })
    toast('Payment proof rejected', 'info')
    fetchProofs()
  }

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 28 }}>
      {/* Header */}
      <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Image size={17} color="#F59E0B" />
          </div>
          <div>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>Payment Proofs</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Review and confirm borrower payment screenshots</div>
          </div>
        </div>
        {proofs.length > 0 && (
          <span style={{ background: '#F59E0B', color: '#000', fontSize: 11, fontWeight: 800, borderRadius: 20, padding: '3px 12px' }}>
            {proofs.length} pending
          </span>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: '20px 24px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontSize: 13 }}>Loading...</div>
        ) : proofs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <CheckCircle size={36} color="var(--green)" style={{ marginBottom: 12, opacity: 0.5 }} />
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 6 }}>All caught up!</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No payment proofs pending review.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {proofs.map(proof => (
              <div key={proof.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--card-border)', borderRadius: 12, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                {/* Info */}
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 3 }}>{proof.borrowers?.full_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Installment {proof.installment_number} of {proof.loans?.num_installments || 4} · ₱{Number(proof.loans?.installment_amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
                  {proof.notes && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, fontStyle: 'italic' }}>"{proof.notes}"</div>}
                  <div style={{ fontSize: 11, color: '#4B5580', marginTop: 4 }}>{new Date(proof.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                </div>
                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  {signedUrls[proof.id] ? (
                    <a href={signedUrls[proof.id]} target="_blank" rel="noreferrer"
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', borderRadius: 8, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', color: '#3B82F6', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
                      <ExternalLink size={12} /> View Proof
                    </a>
                  ) : (
                    <span style={{ padding: '8px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', color: '#4B5580', fontSize: 12 }}>Loading...</span>
                  )}
                  <button onClick={() => handleConfirm(proof)}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(34,197,94,0.3)', background: 'rgba(34,197,94,0.1)', color: '#22C55E', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    ✓ Confirm
                  </button>
                  <button onClick={() => handleReject(proof)}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: '#EF4444', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    ✗ Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Rebate Credits Withdrawals Panel ─────────────────────────
function WithdrawalsPanel({ user }) {
  const [withdrawals, setWithdrawals] = useState([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const fetchWithdrawals = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('wallet_transactions')
      .select('*, borrowers(full_name, access_code)')
      .eq('type', 'withdrawal').eq('status', 'pending')
      .order('created_at', { ascending: false })
    setWithdrawals(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchWithdrawals() }, [])

  const handleApprove = async (txn) => {
    const { data: creditsRecord } = await supabase.from('wallets').select('id, balance').eq('borrower_id', txn.borrower_id).single()
    if (creditsRecord) {
      const newBalance = Math.max(0, creditsRecord.balance - txn.amount)
      await supabase.from('wallets').update({ balance: newBalance, updated_at: new Date().toISOString() }).eq('id', creditsRecord.id)
    }
    await supabase.from('wallet_transactions').update({ status: 'completed' }).eq('id', txn.id)
    await logAudit({ action_type: 'CREDITS_WITHDRAWAL_APPROVED', module: 'Approvals', description: `Rebate Credits withdrawal of ₱${txn.amount} approved for ${txn.borrowers?.full_name}`, changed_by: user?.email })
    await notifyBorrower({ borrower_id: txn.borrower_id, type: 'withdrawal_approved', title: '✅ Withdrawal Approved', message: `Your Rebate Credits withdrawal of ₱${Number(txn.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })} has been approved. Please coordinate with your admin for payout.` })
    toast(`Withdrawal approved for ${txn.borrowers?.full_name}`, 'success')
    fetchWithdrawals()
  }

  const handleReject = async (txn) => {
    await supabase.from('wallet_transactions').update({ status: 'rejected' }).eq('id', txn.id)
    await logAudit({ action_type: 'CREDITS_WITHDRAWAL_REJECTED', module: 'Approvals', description: `Rebate Credits withdrawal of ₱${txn.amount} rejected for ${txn.borrowers?.full_name}`, changed_by: user?.email })
    await notifyBorrower({ borrower_id: txn.borrower_id, type: 'withdrawal_rejected', title: '❌ Withdrawal Rejected', message: `Your Rebate Credits withdrawal request was rejected. Please contact your admin for more details.` })
    toast('Withdrawal rejected', 'info')
    fetchWithdrawals()
  }

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
            <img src="/wallet.png" alt="wallet" style={{ width: 22, height: 22, objectFit: 'contain' }} />
          </div>
          <div>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>Rebate Credits Withdrawals</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Approve or reject borrower withdrawal requests</div>
          </div>
        </div>
        {withdrawals.length > 0 && (
          <span style={{ background: '#22C55E', color: '#000', fontSize: 11, fontWeight: 800, borderRadius: 20, padding: '3px 12px' }}>
            {withdrawals.length} pending
          </span>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: '20px 24px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontSize: 13 }}>Loading...</div>
        ) : withdrawals.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <CheckCircle size={36} color="var(--green)" style={{ marginBottom: 12, opacity: 0.5 }} />
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 6 }}>No pending withdrawals</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Withdrawal requests will appear here when borrowers submit them.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {withdrawals.map((txn, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--card-border)', borderRadius: 12, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 3 }}>{txn.borrowers?.full_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Full Rebate Credits balance withdrawal</div>
                  <div style={{ fontSize: 11, color: '#4B5580', marginTop: 4 }}>{new Date(txn.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                </div>
                <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 22, color: '#22C55E' }}>₱{Number(txn.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button onClick={() => handleApprove(txn)}
                    style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(34,197,94,0.3)', background: 'rgba(34,197,94,0.1)', color: '#22C55E', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    ✓ Approve
                  </button>
                  <button onClick={() => handleReject(txn)}
                    style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: '#EF4444', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    ✗ Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Investor Payout Requests Panel ──────────────────────────
function InvestorPayoutsPanel({ user }) {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const fetchRequests = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('investor_payout_requests')
      .select('*, investors(full_name, tier)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    setRequests(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchRequests() }, [])

  const handleApprove = async (req) => {
    try {
      await supabase.from('investor_payout_requests').update({
        status: 'approved', reviewed_by: user?.email, reviewed_at: new Date().toISOString()
      }).eq('id', req.id)
      
      await logAudit({ 
        action_type: 'INVESTOR_PAYOUT_APPROVED', 
        module: 'Approvals', 
        description: `Payout request approved for ${req.investors?.full_name} — Amount: ₱${req.requested_amount}`, 
        changed_by: user?.email 
      })
      
      toast(`Payout request approved for ${req.investors?.full_name}`, 'success')
      fetchRequests()
    } catch (err) {
      toast('Failed to approve payout', 'error')
    }
  }

  const handleReject = async (req) => {
    try {
      await supabase.from('investor_payout_requests').update({
        status: 'rejected', reviewed_by: user?.email, reviewed_at: new Date().toISOString()
      }).eq('id', req.id)

      await logAudit({ 
        action_type: 'INVESTOR_PAYOUT_REJECTED', 
        module: 'Approvals', 
        description: `Payout request rejected for ${req.investors?.full_name}`, 
        changed_by: user?.email 
      })

      toast('Payout request rejected', 'info')
      fetchRequests()
    } catch (err) {
      toast('Failed to reject payout', 'error')
    }
  }

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 28 }}>
      <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Banknote size={18} color="#3B82F6" />
          </div>
          <div>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>Investor Payouts</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Review capital payout requests from partners</div>
          </div>
        </div>
        {requests.length > 0 && (
          <span style={{ background: '#3B82F6', color: '#fff', fontSize: 11, fontWeight: 800, borderRadius: 20, padding: '3px 12px' }}>
            {requests.length} pending
          </span>
        )}
      </div>

      <div style={{ padding: '20px 24px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontSize: 13 }}>Loading...</div>
        ) : requests.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <CheckCircle size={36} color="var(--green)" style={{ marginBottom: 12, opacity: 0.5 }} />
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 6 }}>All caught up!</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No investor payout requests pending review.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {requests.map(req => (
              <div key={req.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--card-border)', borderRadius: 12, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 3 }}>{req.investors?.full_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{req.investors?.tier} Partner · Capital Payout Request</div>
                  <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                    <div style={{ padding: '4px 10px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, fontSize: 11, color: '#60A5FA', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {req.payout_method === 'GCash' ? <Smartphone size={12} /> : <Building2 size={12} />}
                      {req.payout_method}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <CreditCard size={12} /> {req.account_details}
                    </div>
                  </div>
                  <div style={{ fontSize: 10, color: '#4B5580', marginTop: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Requested {new Date(req.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                </div>
                <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 22, color: 'var(--text-primary)' }}>₱{Number(req.requested_amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button onClick={() => handleApprove(req)}
                    style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(34,197,94,0.3)', background: 'rgba(34,197,94,0.1)', color: '#22C55E', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    ✓ Approve
                  </button>
                  <button onClick={() => handleReject(req)}
                    style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: '#EF4444', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    ✗ Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Investor Agreements Panel ──────────────────────────────
function InvestorAgreementsPanel({ user }) {
  const [investors, setInvestors] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedInvestor, setSelectedInvestor] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const { toast } = useToast()

  const fetchInvestors = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('investors')
      .select('*')
      .not('signed_at', 'is', null) // Only those who signed
      .order('signed_at', { ascending: false })
    setInvestors(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchInvestors() }, [])

  const handleAdminSign = async (investorId, signatureData, slot) => {
    try {
      const updateData = slot === 1 
        ? { admin_signed_at: new Date().toISOString(), admin_signature_data: signatureData }
        : { admin2_signed_at: new Date().toISOString(), admin2_signature_data: signatureData }

      const { error } = await supabase
        .from('investors')
        .update(updateData)
        .eq('id', investorId)

      if (error) throw error
      toast(`MOA Slot ${slot} signed successfully!`, 'success')
      fetchInvestors()
      // Keep modal open so other admin can sign if needed, or update local state
      const updated = investors.map(i => i.id === investorId ? { ...i, ...updateData } : i)
      setInvestors(updated)
      setSelectedInvestor({ ...selectedInvestor, ...updateData })
    } catch (err) {
      toast('Failed to save signature', 'error')
    }
  }

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 28 }}>
      <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FileText size={18} color="#8B5CF6" />
          </div>
          <div>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>Investor Agreements</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Review and counter-sign partner MOAs</div>
          </div>
        </div>
        {investors.filter(i => !i.admin_signed_at).length > 0 && (
          <span style={{ background: '#8B5CF6', color: '#fff', fontSize: 11, fontWeight: 800, borderRadius: 20, padding: '3px 12px' }}>
            {investors.filter(i => !i.admin_signed_at).length} awaiting your signature
          </span>
        )}
      </div>

      <div style={{ padding: '20px 24px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontSize: 13 }}>Loading...</div>
        ) : investors.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <FileText size={36} color="var(--text-muted)" style={{ marginBottom: 12, opacity: 0.5 }} />
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 6 }}>No signed agreements</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Agreements will appear here once partners sign them.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {investors.map(inv => (
              <div key={inv.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--card-border)', borderRadius: 12, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{inv.full_name}</div>
                    <div style={{ padding: '2px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.05)', fontSize: 10, color: 'var(--text-muted)' }}>{inv.tier}</div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Partner Signed: {new Date(inv.signed_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {inv.admin_signed_at ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--green)', fontSize: 12, fontWeight: 700 }}>
                      <CheckCircle size={14} /> Counter-signed
                    </div>
                  ) : (
                    <div style={{ color: '#F59E0B', fontSize: 12, fontWeight: 700 }}>Awaiting Admin</div>
                  )}
                  
                  <button onClick={() => { setSelectedInvestor(inv); setShowModal(true) }}
                    style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(139,92,246,0.3)', background: 'rgba(139,92,246,0.1)', color: '#a78bfa', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <PenTool size={14} /> {inv.admin_signed_at ? 'View MOA' : 'Review & Sign'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && selectedInvestor && (
        <AdminAgreementModal 
          investor={selectedInvestor} 
          onClose={() => setShowModal(false)} 
          onAdminSign={handleAdminSign}
        />
      )}
    </div>
  )
}

function AdminAgreementModal({ investor, onClose, onAdminSign }) {
  const [showPad, setShowPad] = useState(false)
  const [activeSlot, setActiveSlot] = useState(null)

  const handleTriggerSign = (slot) => {
    setActiveSlot(slot)
    setShowPad(true)
  }

  return (
    <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(12px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 0' }}>
      <div style={{ position: 'relative', width: '95%', maxWidth: 900, maxHeight: '95vh', overflowY: 'auto', background: '#fff', borderRadius: 12 }}>
        <div style={{ position: 'sticky', top: 0, right: 0, padding: 15, display: 'flex', justifyContent: 'flex-end', zIndex: 10, background: 'rgba(255,255,255,0.9)' }} className="no-print">
          <button onClick={onClose} style={{ background: '#000', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: 'pointer', fontWeight: 600 }}>Close Review</button>
        </div>
        
        <InvestorMoa 
          investor={investor} 
          isAdmin={true} 
          currentAdminSlot={(!investor.admin_signature_data ? 1 : !investor.admin2_signature_data ? 2 : null)}
          onSign={handleTriggerSign} 
        />
      </div>

      {showPad && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <SignaturePad 
            onSave={(data) => { onAdminSign(investor.id, data, activeSlot); setShowPad(false) }}
            onCancel={() => setShowPad(false)}
          />
        </div>
      )}
    </div>
  )
}

// ── Main ApprovalsPage ────────────────────────────────────────
export default function ApprovalsPage() {
  const { user } = useAuth()

  return (
    <div style={{ padding: '32px 28px', maxWidth: 900, margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Approvals</h1>
          <p className="page-subtitle">Review MOAs, payouts, and withdrawal requests</p>
        </div>
      </div>

      <InvestorAgreementsPanel user={user} />
      <InvestorPayoutsPanel user={user} />
      <PrincipalPaymentsPanel user={user} />
      <PaymentProofsPanel user={user} />
      <WithdrawalsPanel user={user} />
    </div>
  )
}
