import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { CREDIT_CONFIG, calcSecurityHold } from '../lib/creditSystem'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'
import { logAudit } from '../lib/helpers'
import { sendApplicationApprovedEmail, sendApplicationRejectedEmail } from '../lib/emailService'
import { ClipboardList, Check, X, Clock, ChevronDown, ChevronUp, User, Phone, Mail, MapPin, Users, DollarSign, ExternalLink, Image } from 'lucide-react'

const STATUS_COLORS = {
  Pending: { bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)', text: '#F59E0B' },
  Approved: { bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.3)', text: '#22C55E' },
  Rejected: { bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)', text: '#EF4444' },
}

function IdViewer({ app }) {
  const [frontUrl, setFrontUrl] = useState(null)
  const [backUrl, setBackUrl] = useState(null)

  useEffect(() => {
    const load = async () => {
      if (app.valid_id_path) {
        const { data } = await supabase.storage.from('valid-ids').createSignedUrl(app.valid_id_path, 3600)
        if (data?.signedUrl) setFrontUrl(data.signedUrl)
      }
      if (app.valid_id_back_path) {
        const { data } = await supabase.storage.from('valid-ids').createSignedUrl(app.valid_id_back_path, 3600)
        if (data?.signedUrl) setBackUrl(data.signedUrl)
      }
    }
    load()
  }, [app.valid_id_path, app.valid_id_back_path])

  const renderCard = (url, path, label) => {
    if (!path) return null
    const isImage = /\.(jpg|jpeg|png)$/i.test(path)
    return (
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, color: '#4B5580', marginBottom: 6, fontWeight: 600 }}>{label}</div>
        {!url ? (
          <div style={{ height: 140, borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#4B5580' }}>
            Loading...
          </div>
        ) : isImage ? (
          <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
            <img src={url} alt={label} style={{ width: '100%', height: 140, objectFit: 'cover', display: 'block' }} />
            <a href={url} target="_blank" rel="noreferrer"
              style={{ position: 'absolute', bottom: 6, right: 6, display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 7, background: 'rgba(0,0,0,0.75)', color: '#fff', fontSize: 11, fontWeight: 600, textDecoration: 'none' }}>
              <ExternalLink size={10} /> View Full
            </a>
          </div>
        ) : (
          <a href={url} target="_blank" rel="noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '12px 14px', borderRadius: 10, background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', color: '#a78bfa', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
            <ExternalLink size={13} /> View PDF
          </a>
        )}
      </div>
    )
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#4B5580', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Image size={12} /> Valid ID Submitted
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        {renderCard(frontUrl, app.valid_id_path, 'Front')}
        {renderCard(backUrl, app.valid_id_back_path, 'Back')}
      </div>
    </div>
  )
}

function ApplicationCard({ app, onApprove, onReject }) {
  const [expanded, setExpanded] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectInput, setShowRejectInput] = useState(false)
  const [loading, setLoading] = useState(false)
  const s = STATUS_COLORS[app.status] || STATUS_COLORS.Pending

  const handleApprove = async () => {
    setLoading(true)
    await onApprove(app)
    setLoading(false)
  }

  const handleReject = async () => {
    if (!rejectReason.trim()) return
    setLoading(true)
    await onReject(app, rejectReason)
    setLoading(false)
  }

  return (
    <div style={{ background: '#141B2D', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, overflow: 'hidden', marginBottom: 12 }}>
      {/* Header row */}
      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }} onClick={() => setExpanded(e => !e)}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg,#3B82F6,#8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Space Grotesk', fontWeight: 800, color: '#fff', fontSize: 15, flexShrink: 0 }}>
          {app.full_name?.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 15, color: '#F0F4FF' }}>{app.full_name}</div>
          <div style={{ fontSize: 12, color: '#7A8AAA', marginTop: 2 }}>{app.department} · {new Date(app.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
        </div>
        <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 18, color: '#22C55E', flexShrink: 0 }}>
          ₱{app.loan_amount?.toLocaleString()}
        </div>
        <div style={{ padding: '4px 12px', borderRadius: 20, background: s.bg, border: `1px solid ${s.border}`, fontSize: 12, fontWeight: 700, color: s.text, flexShrink: 0 }}>
          {app.status}
        </div>
        {expanded ? <ChevronUp size={16} color="#4B5580" /> : <ChevronDown size={16} color="#4B5580" />}
      </div>

      {/* Expanded details */}
      {expanded && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
            {/* Personal */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#4B5580', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}><span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><img src="/list.png" alt="info" style={{ width: 13, height: 13, objectFit: 'contain', marginRight: 5, verticalAlign: 'middle' }} />Personal Info</span></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { icon: <Phone size={13} />, label: app.phone },
                  { icon: <Mail size={13} />, label: app.email },
                  { icon: <MapPin size={13} />, label: app.address || 'Not provided' },
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#CBD5F0' }}>
                    <span style={{ color: '#4B5580' }}>{item.icon}</span>
                    {item.label}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Loan details */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '14px 16px', marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 11, color: '#4B5580', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Requested Amount</div>
                <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 24, color: '#22C55E' }}>₱{app.loan_amount?.toLocaleString()}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                {app.loan_type === 'quickloan' ? (
                  <>
                    <div style={{ marginBottom: 4 }}><span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: 'rgba(245,158,11,0.15)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.3)' }}>⚡ QuickLoan</span></div>
                    <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 15, color: '#F0F4FF' }}>₱{(app.loan_amount * 0.1 / 30).toFixed(2)}/day interest</div>
                    <div style={{ fontSize: 11, color: '#4B5580' }}>Day 15 target · max ₱3,000</div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 11, color: '#4B5580', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Est. Installment · {app.loan_term || 2}-month term</div>
                    <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 18, color: '#F0F4FF' }}>₱{Math.ceil(app.loan_amount * (1 + 0.07 * (app.loan_term || 2)) / ((app.loan_term || 2) * 2)).toLocaleString('en-PH')}/cutoff</div>
                  </>
                )}
              </div>
            </div>
            {app.loan_purpose && (
              <div style={{ marginTop: 10, fontSize: 13, color: '#7A8AAA' }}>
                Purpose: <span style={{ color: '#CBD5F0' }}>{app.loan_purpose}</span>
              </div>
            )}
            {app.release_method ? (
              <div style={{ marginTop: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: (app.gcash_number || app.bank_account_number) ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                  <img
                    src={app.release_method === 'GCash' ? '/gcash-logo.png' : app.release_method === 'RCBC' ? '/rcbc-logo.png' : app.release_method === 'Other Bank Transfer' ? '/bank-logo.png' : '/cash-logo.png'}
                    alt={app.release_method}
                    style={{ width: 32, height: 32, objectFit: 'contain', flexShrink: 0 }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: '#4B5580', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Preferred Release Method</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#F0F4FF', marginTop: 2 }}>
                      {app.release_method}{app.bank_name ? ` — ${app.bank_name}` : ''}
                    </div>
                  </div>
                  {(app.release_method === 'Physical Cash' || app.release_method === 'RCBC') ? (
                    <span style={{ fontSize: 11, color: '#22C55E', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 20, padding: '3px 10px', whiteSpace: 'nowrap' }}>✓ No fee</span>
                  ) : (
                    <span style={{ fontSize: 11, color: '#F59E0B', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 20, padding: '3px 10px', whiteSpace: 'nowrap' }}>Fee applies</span>
                  )}
                </div>
                {app.release_method === 'GCash' && (app.gcash_number || app.gcash_name) && (
                  <div style={{ padding: '10px 14px', display: 'flex', gap: 24 }}>
                    {app.gcash_number && <div><div style={{ fontSize: 11, color: '#4B5580' }}>GCash Number</div><div style={{ fontSize: 13, color: '#60B8FF', fontWeight: 600, marginTop: 2 }}>{app.gcash_number}</div></div>}
                    {app.gcash_name && <div><div style={{ fontSize: 11, color: '#4B5580' }}>GCash Name</div><div style={{ fontSize: 13, color: '#F0F4FF', fontWeight: 600, marginTop: 2 }}>{app.gcash_name}</div></div>}
                  </div>
                )}
                {(app.release_method === 'RCBC' || app.release_method === 'Other Bank Transfer') && app.bank_account_number && (
                  <div style={{ padding: '10px 14px' }}>
                    <div style={{ fontSize: 11, color: '#4B5580' }}>Account Number</div>
                    <div style={{ fontSize: 13, color: '#F0F4FF', fontWeight: 600, marginTop: 2 }}>{app.bank_account_number}</div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ marginTop: 10, padding: '10px 14px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 10, fontSize: 12, color: '#EF4444' }}>
                <img src="/warning.png" alt="warning" style={{ width: 14, height: 14, objectFit: 'contain', verticalAlign: 'middle', marginRight: 4 }} />No release method specified
              </div>
            )}
          </div>

          {/* Valid ID - Front & Back */}
          {(app.valid_id_path || app.valid_id_back_path) && (
            <IdViewer app={app} />
          )}

          {/* Reject reason if rejected */}
          {app.status === 'Rejected' && app.reject_reason && (
            <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, fontSize: 13, color: '#EF4444', marginBottom: 16 }}>
              Rejection reason: {app.reject_reason}
            </div>
          )}

          {/* Actions for pending */}
          {app.status === 'Pending' && (
            <div>
              {!showRejectInput ? (
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={handleApprove} disabled={loading} style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: 'rgba(34,197,94,0.15)', color: '#22C55E', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, border: '1px solid rgba(34,197,94,0.3)' }}>
                    <Check size={15} /> Approve & Create Loan
                  </button>
                  <button onClick={() => setShowRejectInput(true)} style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: '#EF4444', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                    <X size={15} /> Reject
                  </button>
                </div>
              ) : (
                <div>
                  <input
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                    placeholder="Enter rejection reason..."
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 9, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.05)', color: '#F0F4FF', fontSize: 13, boxSizing: 'border-box', marginBottom: 10 }}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={handleReject} disabled={!rejectReason.trim() || loading} style={{ flex: 1, padding: '10px', borderRadius: 9, border: 'none', background: '#EF4444', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                      Confirm Reject
                    </button>
                    <button onClick={() => { setShowRejectInput(false); setRejectReason('') }} style={{ padding: '10px 16px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#7A8AAA', fontSize: 13, cursor: 'pointer' }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}


function ProofReviewSection({ supabase, user, logAudit }) {
  const [proofs, setProofs] = useState([])
  const [expanded, setExpanded] = useState(false)
  const [signedUrls, setSignedUrls] = useState({})
  const { toast } = useToast()

  const fetchProofs = async () => {
    const { data } = await supabase
      .from('payment_proofs')
      .select('*, borrowers(full_name, access_code), loans(loan_amount, installment_amount)')
      .eq('status', 'Pending')
      .order('created_at', { ascending: false })
    setProofs(data || [])
    // Generate signed URLs for all proofs
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
  }

  useEffect(() => { fetchProofs() }, [])

  const handleConfirm = async (proof) => {
    await supabase.from('payment_proofs').update({ status: 'Confirmed', reviewed_by: user?.email, reviewed_at: new Date().toISOString() }).eq('id', proof.id)
    await logAudit({ action_type: 'PAYMENT_PROOF_CONFIRMED', module: 'Applications', description: `Payment proof confirmed for ${proof.borrowers?.full_name} — Installment ${proof.installment_number}`, changed_by: user?.email })
    if (proof.borrower_id) {
      await notifyBorrower({
        borrower_id: proof.borrower_id,
        type: 'payment_confirmed',
        title: '✅ Payment Confirmed',
        message: `Your Installment ${proof.installment_number} payment of ₱${Number(proof.loans?.installment_amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })} has been confirmed by the admin.`
      })
    }
    toast('Payment proof confirmed', 'success')
    fetchProofs()
  }

  const handleReject = async (proof) => {
    await supabase.from('payment_proofs').update({ status: 'Rejected', reviewed_by: user?.email, reviewed_at: new Date().toISOString() }).eq('id', proof.id)
    await logAudit({ action_type: 'PAYMENT_PROOF_REJECTED', module: 'Applications', description: `Payment proof rejected for ${proof.borrowers?.full_name} — Installment ${proof.installment_number}`, changed_by: user?.email })
    if (proof.borrower_id) {
      await notifyBorrower({
        borrower_id: proof.borrower_id,
        type: 'payment_rejected',
        title: '❌ Payment Proof Rejected',
        message: `Your Installment ${proof.installment_number} payment proof was rejected. Please re-upload a clear screenshot and try again.`
      })
    }
    toast('Payment proof rejected', 'success')
    fetchProofs()
  }



  if (proofs.length === 0) return null

  return (
    <div style={{ background: '#141B2D', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 14, padding: '18px 20px', marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => setExpanded(e => !e)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Image size={15} color="#F59E0B" />
          </div>
          <div>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 14, color: '#F0F4FF' }}>Payment Proofs to Review</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{proofs.length} pending confirmation</div>
          </div>
          <span style={{ background: '#F59E0B', color: '#000', fontSize: 11, fontWeight: 800, borderRadius: 20, padding: '2px 10px' }}>{proofs.length}</span>
        </div>
        <div style={{ color: 'var(--text-muted)' }}>{expanded ? "▲" : "▼"}</div>
      </div>

      {expanded && (
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {proofs.map(proof => (
            <div key={proof.id} style={{ background: '#0B0F1A', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#F0F4FF' }}>{proof.borrowers?.full_name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Installment {proof.installment_number} of {proof.loans?.num_installments || 4} · ₱{Number(proof.loans?.installment_amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
                {proof.notes && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, fontStyle: 'italic' }}>"{proof.notes}"</div>}
                <div style={{ fontSize: 11, color: '#4B5580', marginTop: 4 }}>{new Date(proof.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                {signedUrls[proof.id] ? (
                  <a href={signedUrls[proof.id]} target="_blank" rel="noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', color: '#3B82F6', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
                    <ExternalLink size={12} /> View
                  </a>
                ) : (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', color: '#4B5580', fontSize: 12 }}>
                    Loading...
                  </span>
                )}
                <button onClick={() => handleConfirm(proof)}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, border: 'none', background: 'rgba(34,197,94,0.15)', color: '#22C55E', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  ✓ Confirm
                </button>
                <button onClick={() => handleReject(proof)}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, border: 'none', background: 'rgba(239,68,68,0.1)', color: '#EF4444', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  ✗ Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


function WithdrawalPanel({ supabase, user, logAudit }) {
  const [withdrawals, setWithdrawals] = useState([])
  const [expanded, setExpanded] = useState(false)
  const { toast } = useToast()

  const fetchWithdrawals = async () => {
    const { data } = await supabase
      .from('wallet_transactions')
      .select('*, borrowers(full_name, access_code)')
      .eq('type', 'withdrawal').eq('status', 'pending')
      .order('created_at', { ascending: false })
    setWithdrawals(data || [])
  }

  useEffect(() => { fetchWithdrawals() }, [])

  const handleApprove = async (txn) => {
    // Deduct from Rebate Credits
    const { data: creditsRecord } = await supabase.from('wallets').select('id, balance').eq('borrower_id', txn.borrower_id).single()
    if (creditsRecord) {
      const newBalance = Math.max(0, rebateCredits.balance - txn.amount)
      await supabase.from('wallets').update({ balance: newBalance, updated_at: new Date().toISOString() }).eq('id', creditsRecord.id)
    }
    await supabase.from('wallet_transactions').update({ status: 'completed' }).eq('id', txn.id)
    await logAudit({ action_type: 'CREDITS_WITHDRAWAL_APPROVED', module: 'Applications', description: `Withdrawal of ₱${txn.amount} approved for ${txn.borrowers?.full_name}`, changed_by: user?.email })
    toast(`Withdrawal approved for ${txn.borrowers?.full_name}`, 'success')
    fetchWithdrawals()
  }

  const handleReject = async (txn) => {
    await supabase.from('wallet_transactions').update({ status: 'rejected' }).eq('id', txn.id)
    await logAudit({ action_type: 'CREDITS_WITHDRAWAL_REJECTED', module: 'Applications', description: `Withdrawal of ₱${txn.amount} rejected for ${txn.borrowers?.full_name}`, changed_by: user?.email })
    toast(`Withdrawal rejected`, 'info')
    fetchWithdrawals()
  }

  return (
    <div style={{ background: '#141B2D', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 14, padding: '18px 20px', marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => setExpanded(e => !e)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(34,197,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>💸</div>
          <div>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 14, color: '#F0F4FF' }}>Rebate Credits Withdrawals</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{withdrawals.length === 0 ? 'No pending requests' : withdrawals.length + ' pending approval'}</div>
          </div>
          {withdrawals.length > 0 && <span style={{ background: '#22C55E', color: '#000', fontSize: 11, fontWeight: 800, borderRadius: 20, padding: '2px 10px' }}>{withdrawals.length}</span>}
        </div>
        <div style={{ color: 'var(--text-muted)' }}>{expanded ? '▲' : '▼'}</div>
      </div>

      {expanded && (
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {withdrawals.length === 0 && (
            <div style={{ textAlign: 'center', padding: '24px 20px', fontSize: 13, color: '#4B5580' }}>
              💸 No pending Rebate Credits withdrawal requests right now.
            </div>
          )}
          {withdrawals.map((txn, i) => (
            <div key={i} style={{ background: '#0B0F1A', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#F0F4FF' }}>{txn.borrowers?.full_name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Requesting full Rebate Credits balance</div>
                <div style={{ fontSize: 11, color: '#4B5580', marginTop: 4 }}>{new Date(txn.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
              </div>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 20, color: '#22C55E' }}>₱{Number(txn.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => handleApprove(txn)}
                  style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: 'rgba(34,197,94,0.15)', color: '#22C55E', fontSize: 12, fontWeight: 700, cursor: 'pointer', border: '1px solid rgba(34,197,94,0.3)' }}>
                  ✓ Approve
                </button>
                <button onClick={() => handleReject(txn)}
                  style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: '#EF4444', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  ✗ Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ApplicationsPage() {
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('Pending')
  const { user } = useAuth()
  const { toast } = useToast()

  const fetchData = useCallback(async () => {
    const { data } = await supabase.from('applications').select('*').order('created_at', { ascending: false })
    setApplications(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleApprove = async (app) => {
    try {
      // 1. Generate access code
      const accessCode = app.access_code || ('LM-' + Math.random().toString(36).substring(2, 6).toUpperCase())

      // 2. Check if borrower already exists
      const { data: existingBorrower } = await supabase.from('borrowers')
        .select('id, access_code, credit_score').eq('email', app.email).maybeSingle()

      let borrowerId = existingBorrower?.id
      const finalCode = existingBorrower?.access_code || accessCode

      if (!existingBorrower) {
        // Create borrower
        const { data: newB, error: bErr } = await supabase.from('borrowers').insert({
          full_name: app.full_name,
          department: app.department || '',
          tenure_years: app.tenure_years || 0,
          phone: app.phone || '',
          email: app.email || '',
          address: app.address || '',
          credit_score: 750,
          risk_score: 'Low',
          loan_limit: 5000,
          loan_limit_level: 1,
          loan_limit_override: false,
          clean_loans: 0,
          loyalty_badge: 'New',
          at_risk: false,
          access_code: finalCode,
          admin_notes: 'Applied via loan application form.'
        }).select('id').single()
        if (bErr) { toast('Failed to create borrower: ' + bErr.message, 'error'); return }
        borrowerId = newB.id
      }

      // 3. Check if loan already exists for this borrower
      const { data: existingLoan } = await supabase.from('loans')
        .select('id').eq('borrower_id', borrowerId)
        .in('status', ['Pending', 'Active', 'Partially Paid']).maybeSingle()

      if (!existingLoan) {
        // 4. Calculate release date
        const today = new Date()
        const day = today.getDate()
        let releaseDate
        if (day <= 5) releaseDate = new Date(today.getFullYear(), today.getMonth(), 5)
        else if (day <= 20) releaseDate = new Date(today.getFullYear(), today.getMonth(), 20)
        else releaseDate = new Date(today.getFullYear(), today.getMonth() + 1, 5)
        const releaseDateStr = releaseDate.getFullYear() + '-' + String(releaseDate.getMonth()+1).padStart(2,'0') + '-' + String(releaseDate.getDate()).padStart(2,'0')

        // 5. Create loan — use only confirmed existing columns
        const loanAmount = Number(app.loan_amount) || 5000
        const loanTerm = Number(app.loan_term) || 2
        const numInstallments = loanTerm * 2
        // Interest rate stored as monthly rate (e.g. 0.07 = 7% per month).
        // Total interest = rate × loan_term months
        const { data: rateSettings } = await supabase.from('settings').select('interest_rate').eq('id', 1).single()
        const monthlyRate = Number(rateSettings?.interest_rate) || 0.07
        const rate = monthlyRate
        const total = loanAmount * (1 + monthlyRate * loanTerm)
        const installment = Math.ceil(total / numInstallments)
        const adjustedTotal = installment * numInstallments

        // Security hold rate based on borrower's credit score
        const { data: borrowerData } = await supabase.from('borrowers').select('credit_score').eq('id', borrowerId).single()
        const creditScore = borrowerData?.credit_score || 750
        const holdRate = creditScore >= 1000 ? 0.05
          : creditScore >= 920 ? 0.06
          : creditScore >= 835 ? 0.08
          : creditScore >= 750 ? 0.10
          : creditScore >= 500 ? 0.15
          : 0.20
        const holdAmt = parseFloat((loanAmount * holdRate).toFixed(2))
        const released = loanAmount - holdAmt

        const { error: lErr } = await supabase.from('loans').insert({
          borrower_id: borrowerId,
          loan_amount: loanAmount,
          interest_rate: rate,
          loan_term: loanTerm,
          num_installments: numInstallments,
          total_repayment: adjustedTotal,
          installment_amount: installment,
          remaining_balance: adjustedTotal,
          payments_made: 0,
          release_date: releaseDateStr,
          status: 'Pending',
          security_hold: holdAmt,
          funds_released: released,
          security_hold_returned: false
        })

        if (lErr) {
          toast('Loan creation failed: ' + lErr.message, 'error')
          console.error('LOAN ERROR:', lErr)
          // Still update application status even if loan failed
        }
      }

      // 6. Update application status — always runs
      await supabase.from('applications').update({ status: 'Approved' }).eq('id', app.id)

      // 7. Log audit
      await logAudit({
        action_type: 'APPLICATION_APPROVED',
        module: 'Applications',
        description: `Application approved for ${app.full_name} — ₱${Number(app.loan_amount).toLocaleString('en-PH')} ${app.loan_type === 'quickloan' ? 'QuickLoan' : 'Installment Loan'}. Access code: ${finalCode}.`,
        changed_by: user?.email
      })

      // 8. Send approval email
      if (app.email) {
        const loanAmount = Number(app.loan_amount) || 5000
        const loanTerm   = Number(app.loan_term) || 2
        const numInstallments = loanTerm * 2
        const totalRepayment = Math.ceil(loanAmount * (1 + 0.07 * loanTerm))
        const installmentAmount = Math.ceil(totalRepayment / numInstallments)
        const today = new Date()
        const day = today.getDate()
        let rel
        if (day <= 5) rel = new Date(today.getFullYear(), today.getMonth(), 5)
        else if (day <= 20) rel = new Date(today.getFullYear(), today.getMonth(), 20)
        else rel = new Date(today.getFullYear(), today.getMonth() + 1, 5)
        const releaseDateStr = rel.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })
        const loanType = app.loan_type === 'quickloan' ? 'QuickLoan' : 'Installment Loan'
        sendApplicationApprovedEmail({
          to: app.email,
          borrowerName: app.full_name,
          accessCode: finalCode,
          loanAmount,
          loanType,
          releaseDate: releaseDateStr,
          installmentAmount,
          totalRepayment,
          loanTerm,
          numInstallments,
        }).catch(e => console.warn('Approval email failed:', e))
      }

      // 9. Update UI immediately
      setApplications(prev => prev.map(a => a.id === app.id ? { ...a, status: 'Approved' } : a))
      toast(`✅ ${app.full_name} approved! Code: ${finalCode}`, 'success')

    } catch (err) {
      console.error('APPROVE ERROR:', err)
      toast('Error: ' + err.message, 'error')
    }
  }

  const handleReject = async (app, reason) => {
    await supabase.from('applications').update({ status: 'Rejected', reject_reason: reason }).eq('id', app.id)
    await logAudit({ action_type: 'APPLICATION_REJECTED', module: 'Applications', description: `Application rejected for ${app.full_name}. Reason: ${reason}`, changed_by: user?.email })
    // Send rejection email
    if (app.email) {
      sendApplicationRejectedEmail({
        to: app.email,
        borrowerName: app.full_name,
        loanAmount: app.loan_amount,
        loanType: app.loan_type === 'quickloan' ? 'QuickLoan' : 'Installment Loan',
        reason,
      }).catch(e => console.warn('Rejection email failed:', e))
    }
    toast(`Application rejected`, 'success')
    setApplications(prev => prev.map(a => a.id === app.id ? { ...a, status: 'Rejected', reject_reason: reason } : a))
  }

  const filtered = applications.filter(a => filter === 'All' ? true : a.status === filter)
  const pendingCount = applications.filter(a => a.status === 'Pending').length

  if (loading) return (
    <div style={{ padding: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div style={{ color: '#4B5580' }}>Loading applications...</div>
    </div>
  )

  return (
    <div style={{ padding: '32px 28px', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 28, color: '#F0F4FF', margin: 0 }}>Applications</h1>
          <p style={{ color: '#4B5580', fontSize: 14, marginTop: 4 }}>Review and manage loan applications</p>
        </div>
        {pendingCount > 0 && (
          <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 10, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clock size={15} color="#F59E0B" />
            <span style={{ fontSize: 13, fontWeight: 700, color: '#F59E0B' }}>{pendingCount} pending review</span>
          </div>
        )}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 4, marginBottom: 24, width: 'fit-content' }}>
        {/* Payment Proofs Section */}


      {['Pending', 'Approved', 'Rejected', 'All'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: '7px 16px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: filter === f ? '#3B82F6' : 'transparent', color: filter === f ? '#fff' : '#4B5580', transition: 'all 0.15s' }}>
            {f} {f === 'Pending' && pendingCount > 0 ? `(${pendingCount})` : ''}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#4B5580' }}>
          <ClipboardList size={40} style={{ marginBottom: 16, opacity: 0.4 }} />
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 18, marginBottom: 8 }}>No {filter.toLowerCase()} applications</div>
          <div style={{ fontSize: 14 }}>Share the application link with your employees to get started</div>
        </div>
      ) : (
        filtered.map(app => (
          <ApplicationCard key={app.id} app={app} onApprove={handleApprove} onReject={handleReject} />
        ))
      )}
    </div>
  )
}
