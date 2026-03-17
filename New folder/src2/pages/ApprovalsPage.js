import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'
import { logAudit } from '../lib/helpers'
import { ExternalLink, Image, CheckCircle, XCircle } from 'lucide-react'

// ── Notify borrower helper ────────────────────────────────────
async function notifyBorrower({ borrower_id, type, title, message }) {
  await supabase.from('portal_notifications').insert({ borrower_id, type, title, message })
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
      .select('*, borrowers(full_name, access_code), loans(loan_amount, installment_amount)')
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
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Installment {proof.installment_number} of 4 · ₱{Number(proof.loans?.installment_amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
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

// ── Main ApprovalsPage ────────────────────────────────────────
export default function ApprovalsPage() {
  const { user } = useAuth()

  return (
    <div style={{ padding: '32px 28px', maxWidth: 900, margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Approvals</h1>
          <p className="page-subtitle">Review payment proofs and Rebate Credits withdrawal requests</p>
        </div>
      </div>

      <PaymentProofsPanel user={user} />
      <WithdrawalsPanel user={user} />
    </div>
  )
}
