import { useState, useEffect, useCallback, useRef } from 'react'
import { CREDIT_CONFIG, BADGE_TIERS, SECURITY_HOLD_TIERS, getBadgeConfig, getBadgeFromScore, getSecurityHoldRate } from '../lib/creditSystem'
import { supabase } from '../lib/supabase'
import { usePageVisit } from '../hooks/usePageVisit'
import { getInstallmentDates, formatDateValue, logAudit } from '../lib/helpers'
import { sendLoanAgreementSignedAdminEmail } from '../lib/emailService'
import {
  Lock, CheckCircle, Clock, AlertCircle, Upload,
  FileText, Calendar, CreditCard, User, Wallet, ChevronDown, ChevronUp, X
} from 'lucide-react'

function formatDate(str) {
  if (!str) return "—"
  const [y, m, d] = str.split('-')
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })
}

function getDueDates(releaseDate, paymentsMade, numInstallments = 4) {
  if (!releaseDate) return []
  const dates = getInstallmentDates(releaseDate, numInstallments)
  return dates.map((cutoff, idx) => {
    const i = idx + 1
    return {
      num: i,
      date: cutoff,
      dateStr: cutoff.getFullYear() + '-' + String(cutoff.getMonth() + 1).padStart(2, '0') + '-' + String(cutoff.getDate()).padStart(2, '0'),
      paid: i <= paymentsMade,
      current: i === paymentsMade + 1
    }
  })
}

function StatusBadge({ status }) {
  const map = {
    Active: { bg: 'rgba(59,130,246,0.15)', color: '#3B82F6', label: 'Active' },
    'Partially Paid': { bg: 'rgba(245,158,11,0.15)', color: '#F59E0B', label: 'Partially Paid' },
    Paid: { bg: 'rgba(34,197,94,0.15)', color: '#22C55E', label: 'Fully Paid' },
    Pending: { bg: 'rgba(139,92,246,0.15)', color: '#8B5CF6', label: 'Pending Release' },
    Overdue: { bg: 'rgba(239,68,68,0.15)', color: '#EF4444', label: 'Overdue' },
    Defaulted: { bg: 'rgba(239,68,68,0.15)', color: '#EF4444', label: 'Defaulted' },
  }
  const s = map[status] || map.Pending
  return (
    <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.color}40`, borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
      {s.label}
    </span>
  )
}

function UploadModal({ installmentNum, loan, borrower, onClose, onUploaded }) {
  const [file, setFile] = useState(null)
  const [notes, setNotes] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const handleUpload = async () => {
    if (!file) { setError('Please select a file'); return }
    if (file.size > 5 * 1024 * 1024) { setError('File must be under 5MB'); return }
    const { data: existing } = await supabase.from('payment_proofs').select('id').eq('loan_id', loan.id).eq('installment_number', installmentNum).eq('status', 'Pending').single()
    if (existing) { setError('A proof is already pending review for this installment.'); return }
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `${borrower.access_code}/${Date.now()}-installment${installmentNum}.${ext}`
    const { error: upErr } = await supabase.storage.from('payment-proofs').upload(path, file, { upsert: false })
    if (upErr) { setError('Upload failed: ' + upErr.message); setUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from('payment-proofs').getPublicUrl(path)
    const { error: dbErr } = await supabase.from('payment_proofs').insert({
      borrower_id: borrower.id, loan_id: loan.id,
      installment_number: installmentNum, file_path: path,
      file_url: publicUrl, notes: notes.trim() || null, status: 'Pending'
    })
    if (dbErr) { setError('Failed to save proof: ' + dbErr.message); setUploading(false); return }
    await supabase.from('portal_notifications').insert({
      borrower_id: borrower.id, type: 'payment_submitted',
      title: '✅ Proof Submitted',
      message: `Your payment proof for installment ${installmentNum} has been submitted and is awaiting admin review.`
    })
    setUploading(false)
    onUploaded()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 440, background: '#0E1320', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, overflow: 'hidden', boxShadow: '0 40px 80px rgba(0,0,0,0.6)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 16, color: '#F0F4FF' }}>Upload Payment Proof</div>
            <div style={{ fontSize: 12, color: '#4B5580', marginTop: 2 }}>Installment {installmentNum}</div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#7A8AAA', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
        <div style={{ padding: 24 }}>
          <label style={{
            display: 'block', border: `2px dashed ${file ? '#22C55E' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: 14, padding: '28px 20px', textAlign: 'center', cursor: 'pointer',
            background: file ? 'rgba(34,197,94,0.05)' : 'rgba(255,255,255,0.02)', marginBottom: 14, transition: 'all 0.2s'
          }}>
            <input type="file" accept="image/*,.pdf" onChange={e => setFile(e.target.files[0])} style={{ display: 'none' }} />
            <div style={{ fontSize: 28, marginBottom: 8 }}>{file ? '✅' : '📎'}</div>
            <div style={{ fontSize: 13, color: file ? '#22C55E' : '#7A8AAA', fontWeight: 600 }}>
              {file ? file.name : 'Click to select screenshot or PDF'}
            </div>
            <div style={{ fontSize: 11, color: '#4B5580', marginTop: 4 }}>JPG, PNG, PDF · Max 5MB</div>
          </label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional note for admin..." rows={2}
            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, color: '#F0F4FF', fontSize: 13, resize: 'none', outline: 'none', fontFamily: 'DM Sans, sans-serif', marginBottom: 14 }} />
          {error && <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, fontSize: 13, color: '#EF4444', marginBottom: 14 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: '#7A8AAA', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleUpload} disabled={uploading || !file}
              style={{ flex: 2, padding: '12px', borderRadius: 10, border: 'none', background: uploading ? 'rgba(34,197,94,0.3)' : 'linear-gradient(135deg,#22C55E,#16a34a)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: uploading ? 'not-allowed' : 'pointer', fontFamily: 'Syne, sans-serif' }}>
              {uploading ? 'Uploading...' : '⬆ Submit Proof'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function PenaltySection({ loanId, supabase }) {
  const [penalties, setPenalties] = useState([])
  useEffect(() => {
    if (!loanId) return
    supabase.from('penalty_charges').select('*').eq('loan_id', loanId).order('created_at', { ascending: false })
      .then(({ data }) => setPenalties(data || []))
  }, [loanId, supabase])
  if (!penalties.length) return null
  const total = penalties.reduce((s, p) => s + (p.amount || 0), 0)
  return (
    <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 14, padding: '16px 18px', marginTop: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, color: '#EF4444' }}>⚠ Late Payment Penalties</div>
        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 15, color: '#EF4444' }}>₱{total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
      </div>
      {penalties.map((p, i) => (
        <div key={i} style={{ fontSize: 12, color: '#8892B0', display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
          <span>Installment {p.installment_number} · {p.days_late} days late</span>
          <span style={{ color: '#EF4444', fontWeight: 700 }}>₱{(p.amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
        </div>
      ))}
    </div>
  )
}

function LottieHourglass() {
  const [dots, setDots] = useState(0)
  useEffect(() => { const t = setInterval(() => setDots(d => (d + 1) % 4), 500); return () => clearInterval(t) }, [])
  return <span style={{ fontFamily: 'monospace' }}>{'⏳'}{'.'.repeat(dots)}</span>
}

// ── E-Signature Modal ─────────────────────────────────────────
function SignatureModal({ borrower, loan, onSave, onClose }) {
  const canvasRef = useRef(null)
  const [drawing, setDrawing] = useState(false)
  const [typedName, setTypedName] = useState('')
  const [hasDrawn, setHasDrawn] = useState(false)
  const [tab, setTab] = useState('draw')

  const startDraw = (e) => {
    const c = canvasRef.current; if (!c) return
    const r = c.getBoundingClientRect()
    const x = (e.touches?.[0]?.clientX ?? e.clientX) - r.left
    const y = (e.touches?.[0]?.clientY ?? e.clientY) - r.top
    const ctx = c.getContext('2d')
    ctx.beginPath(); ctx.moveTo(x, y)
    setDrawing(true); setHasDrawn(true)
  }
  const draw = (e) => {
    if (!drawing) return
    e.preventDefault()
    const c = canvasRef.current; if (!c) return
    const r = c.getBoundingClientRect()
    const x = (e.touches?.[0]?.clientX ?? e.clientX) - r.left
    const y = (e.touches?.[0]?.clientY ?? e.clientY) - r.top
    const ctx = c.getContext('2d')
    ctx.strokeStyle = '#F0F4FF'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'
    ctx.lineTo(x, y); ctx.stroke()
  }
  const stopDraw = () => setDrawing(false)
  const clearCanvas = () => {
    const c = canvasRef.current; if (!c) return
    c.getContext('2d').clearRect(0, 0, c.width, c.height)
    setHasDrawn(false)
  }
  const handleSave = () => {
    if (!typedName.trim()) return
    let signatureImage = null
    if (tab === 'draw' && hasDrawn && canvasRef.current) {
      signatureImage = canvasRef.current.toDataURL('image/png')
    }
    onSave({ typedName: typedName.trim(), signatureImage, signedAt: new Date().toISOString() })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 500, background: '#0E1320', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 20, overflow: 'hidden', boxShadow: '0 40px 80px rgba(0,0,0,0.6)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 16, color: '#F0F4FF' }}>Sign Loan Agreement</div>
            <div style={{ fontSize: 12, color: '#4B5580', marginTop: 2 }}>
              {loan.loan_type === 'quickloan'
                ? `₱${Number(loan.loan_amount).toLocaleString('en-PH')} QuickLoan · daily interest · pay off by Day 15 or Day 30`
                : `₱${Number(loan.loan_amount).toLocaleString('en-PH')} loan · repayable in ${loan.num_installments || 4} installments of ₱${Math.ceil(Number(loan.installment_amount)).toLocaleString('en-PH')} each`}
            </div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#7A8AAA', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
        <div style={{ padding: 24 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11, color: '#4B5580', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6, fontWeight: 700 }}>Full Name (as it appears on ID)</label>
            <input value={typedName} onChange={e => setTypedName(e.target.value)} placeholder={borrower.full_name}
              style={{ width: '100%', boxSizing: 'border-box', padding: '11px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#F0F4FF', fontSize: 14, fontWeight: 600, outline: 'none', fontFamily: 'DM Sans, sans-serif' }} />
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {['draw', 'type'].map(t => (
              <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: '8px', borderRadius: 8, border: `1px solid ${tab === t ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.06)'}`, background: tab === t ? 'rgba(99,102,241,0.15)' : 'transparent', color: tab === t ? '#a78bfa' : '#7A8AAA', fontSize: 12, fontWeight: 700, cursor: 'pointer', textTransform: 'capitalize' }}>{t} Signature</button>
            ))}
          </div>
          {tab === 'draw' ? (
            <div>
              <canvas ref={canvasRef} width={452} height={120} onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw} onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw}
                style={{ width: '100%', height: 120, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, cursor: 'crosshair', display: 'block', touchAction: 'none' }} />
              <button onClick={clearCanvas} style={{ marginTop: 6, fontSize: 11, color: '#4B5580', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Clear</button>
            </div>
          ) : (
            <div style={{ height: 120, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: 32, fontStyle: 'italic', color: '#F0F4FF', letterSpacing: 1 }}>{typedName || borrower.full_name}</div>
            </div>
          )}
          <div style={{ marginTop: 16, padding: '12px 14px', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 10, fontSize: 11, color: '#7A8AAA', lineHeight: 1.7 }}>
            By signing, you confirm you have read and agree to the loan terms: <strong style={{ color: '#F0F4FF' }}>₱{Number(loan.loan_amount).toLocaleString('en-PH')} loan</strong>
          {loan.loan_type === 'quickloan'
            ? <> at <strong style={{ color: '#F0F4FF' }}>10%/month daily interest (0.33%/day)</strong>, payable by <strong style={{ color: '#60A5FA' }}>Day 15</strong> (early) or <strong style={{ color: '#F59E0B' }}>Day 30</strong> (max). Extension fee of <strong style={{ color: '#F59E0B' }}>₱100</strong> applies after Day 15. Penalty of ₱25/day applies after Day 30.</>
            : <> at <strong style={{ color: '#F0F4FF' }}>{((loan.interest_rate || 0.07) * 100).toFixed(0)}%/mo × {loan.loan_term || 2} months interest</strong>, repayable in <strong style={{ color: '#F0F4FF' }}>{loan.num_installments || 4} installments</strong> of <strong style={{ color: '#60A5FA' }}>₱{Math.ceil(Number(loan.installment_amount)).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong> each.</>}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button onClick={onClose} style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: '#7A8AAA', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleSave} disabled={!typedName.trim()}
              style={{ flex: 2, padding: '12px', borderRadius: 10, border: 'none', background: typedName.trim() ? 'linear-gradient(135deg,#6366F1,#8B5CF6)' : 'rgba(255,255,255,0.05)', color: typedName.trim() ? '#fff' : '#4B5580', fontSize: 13, fontWeight: 700, cursor: typedName.trim() ? 'pointer' : 'not-allowed', fontFamily: 'Syne, sans-serif' }}>
              ✍ Sign & Download Agreement
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Shared Header ─────────────────────────────────────────────
function PortalHeader({ borrower, notifications, showNotifs, setShowNotifs, markAllRead, onSignOut, onBack, subtitle }) {
  const unread = notifications ? notifications.filter(n => !n.is_read).length : 0
  return (
    <header style={{ background: 'rgba(8,11,20,0.95)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0 24px', height: 60, display: 'flex', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100 }}>
      <div style={{ maxWidth: 1000, margin: '0 auto', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {onBack && (
            <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', color: '#7A8AAA', fontSize: 13, marginRight: 4 }}>
              ← Back
            </button>
          )}
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            <img src="/favicon-96x96.png" alt="ML" style={{ width: 28, height: 28, objectFit: 'contain' }} />
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 15, color: '#F0F4FF' }}>
              Moneyfest<span style={{ background: 'linear-gradient(90deg,#60a5fa,#a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Lending</span>
            </div>
          </a>
          {subtitle && <div style={{ fontSize: 11, color: '#4B5580', paddingLeft: 10, borderLeft: '1px solid rgba(255,255,255,0.08)', marginLeft: 4 }}>{subtitle}</div>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {borrower && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 4 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#3B82F6,#8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                {borrower.full_name?.charAt(0).toUpperCase()}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#F0F4FF', lineHeight: 1.2 }}>{borrower.full_name}</div>
                <div style={{ fontSize: 10, color: '#4B5580' }}>{borrower.department}</div>
              </div>
            </div>
          )}
          {notifications && (
            <div style={{ position: 'relative' }}>
              <button onClick={() => { setShowNotifs(v => !v); if (!showNotifs) markAllRead() }}
                style={{ position: 'relative', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <span style={{ fontSize: 15 }}>🔔</span>
                {unread > 0 && (
                  <div style={{ position: 'absolute', top: -3, right: -3, width: 15, height: 15, borderRadius: '50%', background: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 800, color: '#fff' }}>{unread}</div>
                )}
              </button>
              {showNotifs && (
                <div style={{ position: 'absolute', right: 0, top: 42, width: 300, background: '#0E1320', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.5)', zIndex: 200, overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between' }}>
                    <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, color: '#F0F4FF' }}>Notifications</div>
                    <button onClick={() => setShowNotifs(false)} style={{ background: 'none', border: 'none', color: '#4B5580', cursor: 'pointer' }}>✕</button>
                  </div>
                  <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                    {notifications.length === 0 ? (
                      <div style={{ padding: '28px 16px', textAlign: 'center', fontSize: 13, color: '#4B5580' }}>No notifications yet.</div>
                    ) : notifications.map((n, i) => (
                      <div key={i} style={{ padding: '11px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', background: n.is_read ? 'transparent' : 'rgba(59,130,246,0.04)', display: 'flex', gap: 10 }}>
                        <div style={{ fontSize: 18, flexShrink: 0 }}>{n.type === 'loan_approved' ? '🎉' : n.type === 'payment_confirmed' ? '✅' : n.type === 'payment_rejected' ? '❌' : '⏰'}</div>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#F0F4FF', marginBottom: 2 }}>{n.title}</div>
                          <div style={{ fontSize: 11, color: '#7A8AAA', lineHeight: 1.5 }}>{n.message}</div>
                          <div style={{ fontSize: 10, color: '#4B5580', marginTop: 4 }}>{new Date(n.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                        {!n.is_read && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#3B82F6', flexShrink: 0, marginTop: 4 }} />}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {onSignOut && (
            <button onClick={onSignOut} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '5px 12px', color: '#7A8AAA', fontSize: 12, cursor: 'pointer' }}>Sign out</button>
          )}
        </div>
      </div>
    </header>
  )
}

// ── Receipt Generator ────────────────────────────────────────
function generateReceiptHTML({ loan, borrower, installmentNum, amount, date }) {
  const numInstallments = loan.num_installments || 4
  const roundedAmount = Math.ceil(amount)
  const totalPaid = installmentNum * roundedAmount
  const remaining = Math.max(0, loan.total_repayment - totalPaid)
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Receipt</title>
  <style>
    
    *{margin:0;padding:0;box-sizing:border-box;}body{font-family:'DM Sans',sans-serif;background:#fff;color:#1a1a2e;padding:40px;max-width:580px;margin:0 auto;}
    .logo{font-family:'Syne',sans-serif;font-weight:800;font-size:20px;}.logo span{color:#6366F1;}
    .badge{display:inline-block;padding:4px 12px;border-radius:20px;background:#e8f5e9;color:#16a34a;font-size:12px;font-weight:700;margin-bottom:8px;}
    .title{font-family:'Syne',sans-serif;font-weight:800;font-size:26px;margin-bottom:4px;}
    .amount-box{background:linear-gradient(135deg,#f0f4ff,#e8f5e9);border:1px solid #c8d8f0;border-radius:14px;padding:24px;text-align:center;margin:24px 0;}
    .amount-val{font-family:'Syne',sans-serif;font-weight:800;font-size:36px;color:#22C55E;}
    .steps{display:flex;justify-content:space-between;margin:16px 0;}
    .step{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;}
    .step.done{background:#22C55E;color:#fff;}.step.pending{background:#e8ecf5;color:#7A8AAA;}
    .row{display:flex;justify-content:space-between;font-size:13px;padding:6px 0;border-bottom:1px solid #e8ecf5;}
    .row:last-child{border:none;font-weight:700;font-size:14px;}
    .footer{text-align:center;font-size:11px;color:#7A8AAA;border-top:1px solid #e8ecf5;padding-top:18px;margin-top:24px;}
  </style></head><body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;padding-bottom:18px;border-bottom:2px solid #e8ecf5;">
    <div class="logo">Moneyfest<span>Lending</span></div>
    <div style="text-align:right;font-size:12px;color:#7A8AAA;"><div style="font-weight:700;color:#1a1a2e;">LM-${Date.now().toString().slice(-8)}</div><div>${date}</div></div>
  </div>
  <div class="badge">✅ Payment Confirmed</div>
  <div class="title">Payment Receipt</div>
  <div style="font-size:14px;color:#7A8AAA;margin-bottom:20px;">Installment ${installmentNum} of ${numInstallments} — ${borrower?.full_name || 'Borrower'}</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">
    <div><div style="font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#7A8AAA;margin-bottom:3px;">Borrower</div><div style="font-size:13px;font-weight:600;">${borrower?.full_name || '—'}</div></div>
    <div><div style="font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#7A8AAA;margin-bottom:3px;">Department</div><div style="font-size:13px;font-weight:600;">${borrower?.department || '—'}</div></div>
  </div>
  <div class="amount-box"><div style="font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:#7A8AAA;margin-bottom:8px;">Amount Paid This Installment</div><div class="amount-val">₱${roundedAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div></div>
  <div style="margin-bottom:20px;"><div style="font-size:12px;font-weight:600;margin-bottom:10px;">Repayment Progress — ${installmentNum} of ${numInstallments}</div>
  <div style="height:8px;background:#e8ecf5;border-radius:4px;overflow:hidden;margin-bottom:10px;"><div style="height:100%;width:${(installmentNum / numInstallments) * 100}%;background:linear-gradient(90deg,#8B5CF6,#22C55E);border-radius:4px;"></div></div>
  <div class="steps">${Array.from({ length: numInstallments }, (_, i) => i + 1).map(i => `<div class="step ${i <= installmentNum ? 'done' : 'pending'}">${i <= installmentNum ? '✓' : i}</div>`).join('')}</div></div>
  <div style="background:#f8faff;border-radius:10px;padding:16px;">
    <div class="row"><span>Loan Principal</span><span>₱${loan.loan_amount?.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span></div>
    <div class="row"><span>Total Repayment</span><span>₱${loan.total_repayment?.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span></div>
    <div class="row"><span>Paid to Date</span><span>₱${totalPaid.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span></div>
    <div class="row" style="color:${remaining <= 0 ? '#22C55E' : '#1a1a2e'}"><span>${remaining <= 0 ? '🎉 Fully Paid!' : 'Remaining Balance'}</span><span>₱${remaining.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span></div>
  </div>
  <div class="footer"><p><strong>Moneyfest Lending</strong> · Private workplace lending</p><p style="margin-top:3px;">Official proof of payment — Installment ${installmentNum} of ${numInstallments}</p></div>
  </body></html>`
}

function downloadReceipt({ loan, borrower, installmentNum, amount }) {
  const date = new Date().toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })
  const html = generateReceiptHTML({ loan, borrower, installmentNum, amount, date })
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `Receipt_${borrower?.full_name?.replace(/\s+/g, '_')}_Inst${installmentNum}.html`
  a.click(); URL.revokeObjectURL(url)
}

export default function BorrowerPortalPage() {
  usePageVisit('portal')
  const [code, setCode] = useState('')
  const [inputCode, setInputCode] = useState('')
  const [borrower, setBorrower] = useState(null)
  const [loan, setLoan] = useState(null)
  const [proofs, setProofs] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [uploadModal, setUploadModal] = useState(null)
  const [showSignModal, setShowSignModal] = useState(false)
  const [signatureData, setSignatureData] = useState(null)
  const [typedName, setTypedName] = useState('')
  const [signatureSaved, setSignatureSaved] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [page, setPage] = useState('home')
  const [rebateCredits, setRebateCredits] = useState(null)
  const [creditTxns, setCreditTxns] = useState([])
  const [withdrawing, setWithdrawing] = useState(false)
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [withdrawMethod, setWithdrawMethod] = useState('')
  const [withdrawDetails, setWithdrawDetails] = useState('')
  const [pendingApp, setPendingApp] = useState(null)
  const [allLoans, setAllLoans] = useState([])
  const [notifications, setNotifications] = useState([])
  const [showNotifs, setShowNotifs] = useState(false)
  const [hoveredMethod, setHoveredMethod] = useState(null)
  const [activeMethod, setActiveMethod] = useState(null)
  const [copiedKey, setCopiedKey] = useState(null)
  const [renewing, setRenewing] = useState(false)
  const [renewalSent, setRenewalSent] = useState(false)
  const [loginType, setLoginType] = useState('borrower') // 'borrower' or 'partner'
  const [partnerInputCode, setPartnerInputCode] = useState('')
  const [partnerError, setPartnerError] = useState('')
  const [partnerLoading, setPartnerLoading] = useState(false)

  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  const handleFastTrackRenewal = async () => {
    if (!borrower) return
    setRenewing(true)
    try {
      // Create new application
      const { error: appError } = await supabase.from('applications').insert([{
        full_name: borrower.full_name,
        department: borrower.department,
        contact_number: borrower.contact_number,
        facebook_account: borrower.facebook_account,
        requested_amount: borrower.loan_limit_level === 4 ? 10000 : borrower.loan_limit_level === 3 ? 9000 : borrower.loan_limit_level === 2 ? 7000 : 5000,
        loan_purpose: loan?.loan_purpose || '', // Carry over previous purpose
        status: 'Pending',
        is_fast_track: true, // Tagging it for admin
        borrower_id: borrower.id
      }])
      if (appError) throw appError
      setRenewalSent(true)
      // Log audit
      await logAudit(borrower.id, borrower.full_name, 'Fast-Track Renewal Submitted')
    } catch (err) {
      console.error(err)
      alert('Failed to submit renewal. Please contact admin.')
    } finally {
      setRenewing(false)
    }
  }


  const fetchPortalData = useCallback(async (accessCode) => {
    setLoading(true); setError('')
    const cleanCode = accessCode.toUpperCase().trim()
    const { data: b } = await supabase.from('borrowers').select('*').eq('access_code', cleanCode).single()
    if (b) {
      const { data: allL } = await supabase.from('loans').select('*').eq('borrower_id', b.id).order('created_at', { ascending: false })
      const { data: p } = await supabase.from('payment_proofs').select('*').eq('borrower_id', b.id).order('created_at', { ascending: false })
      let { data: notifs } = await supabase.from('portal_notifications').select('*').eq('borrower_id', b.id).order('created_at', { ascending: false }).limit(20)
      setBorrower(b); setAllLoans(allL || []); setLoan(allL?.[0] || null); setProofs(p || [])
      const activeLoans = (allL || []).filter(l => l.status === 'Active')
      for (const activeLoan of activeLoans) {
        if (!activeLoan.release_date) continue
        const today = new Date(); today.setHours(0, 0, 0, 0)
        const paid = activeLoan.payments_made || 0
        const numInst = activeLoan.num_installments || 4
        const allDueDates = getDueDates(activeLoan.release_date, paid, numInst)
        for (const dueEntry of allDueDates) {
          if (dueEntry.paid) continue
          const due = dueEntry.date
          const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24))
          if (diffDays >= 0 && diffDays <= 2) {
            const alreadyNotified = (notifs || []).some(n => n.type === 'due_soon' && new Date(n.created_at) > new Date(Date.now() - 3 * 24 * 60 * 60 * 1000))
            if (!alreadyNotified) {
              const msg = diffDays === 0
                ? `Installment ${dueEntry.num} of ₱${Number(activeLoan.installment_amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })} is due TODAY. Please submit your payment proof.`
                : `Installment ${dueEntry.num} of ₱${Number(activeLoan.installment_amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })} is due in ${diffDays} day${diffDays > 1 ? 's' : ''} (${due.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}). Don't forget to pay!`
              const { data: newNotif } = await supabase.from('portal_notifications').insert({ borrower_id: b.id, type: 'due_soon', title: diffDays === 0 ? '⏰ Payment Due Today!' : '⏰ Payment Due Soon', message: msg }).select().single()
              if (newNotif) notifs = [...(notifs || []), newNotif]
            }
          }
          break
        }
      }
      setNotifications(notifs || [])
      const { data: creditsData } = await supabase.from('wallets').select('*').eq('borrower_id', b.id).single()
      const { data: txnData } = await supabase.from('wallet_transactions').select('*').eq('borrower_id', b.id).order('created_at', { ascending: false }).limit(20)
      setRebateCredits(creditsData || null); setCreditTxns(txnData || [])
      setLoading(false); return
    }
    const { data: app } = await supabase.from('applications').select('*').eq('access_code', cleanCode).single()
    if (app) { setPendingApp(app); setLoading(false); return }
    setError('Invalid access code. Please check and try again.')
    setLoading(false)
  }, [])

  useEffect(() => {
    const saved = localStorage.getItem('lm_portal_code')
    if (saved) { setCode(saved); setInputCode(saved); fetchPortalData(saved) }
    
    const savedPartner = localStorage.getItem('lm_partner_code')
    if (savedPartner) {
      // If we have a saved partner code, we might want to redirect to investor dashboard
      // but let's keep the user on the portal if they just opened it.
      // Or we can auto-redirect if they are on the "partner" tab.
    }
  }, [fetchPortalData])

  const handleLogin = async () => {
    if (!inputCode.trim()) { setError('Please enter your access code'); return }
    setCode(inputCode); localStorage.setItem('lm_portal_code', inputCode.toUpperCase().trim())
    await fetchPortalData(inputCode)
  }

  const handlePartnerLogin = async () => {
    if (!partnerInputCode.trim()) { setPartnerError('Please enter your partner access code'); return }
    setPartnerLoading(true); setPartnerError('')
    
    try {
      const { data, error } = await supabase
        .from('investors')
        .select('id, access_code')
        .eq('access_code', partnerInputCode.toUpperCase().trim())
        .single()

      if (error || !data) {
        setPartnerError('Invalid partner access code.')
        setPartnerLoading(false)
        return
      }

      localStorage.setItem('lm_partner_code', data.access_code)
      window.location.href = '/investor/dashboard'
    } catch (err) {
      setPartnerError('Login failed. Please try again.')
    } finally {
      setPartnerLoading(false)
    }
  }
  const handleUploaded = () => { setUploadModal(null); setUploadSuccess(true); fetchPortalData(code); setTimeout(() => setUploadSuccess(false), 5000) }
  const handleSaveSignature = async ({ typedName, signatureImage, signedAt }) => {
    // 1. Update DB
    await supabase.from('loans').update({ e_signature_name: typedName, e_signature_image: signatureImage, e_signature_date: signedAt, agreement_confirmed: true }).eq('id', loan.id)
    await supabase.from('borrowers').update({ e_signature_name: typedName, e_signature_image: signatureImage, e_signature_date: signedAt }).eq('id', borrower.id)

    // 2. Notify Admin
    try {
      await sendLoanAgreementSignedAdminEmail({
        borrowerName: borrower.full_name,
        loanAmount: loan.loan_amount,
        loanType: loan.loan_type === 'quickloan' ? 'QuickLoan' : 'Installment Loan',
        accessCode: borrower.access_code
      })

      await logAudit({
        action_type: 'LA_SIGNED',
        module: 'Portal',
        description: `Loan Agreement signed by ${borrower.full_name} (${loan.loan_type === 'quickloan' ? 'QuickLoan' : 'Installment'})`,
        changed_by: borrower.full_name
      })
    } catch (e) {
      console.error('Notification failed:', e)
    }

    // 3. Update State
    setLoan(prev => ({ ...prev, e_signature_name: typedName, e_signature_image: signatureImage, e_signature_date: signedAt, agreement_confirmed: true }))
    setBorrower(prev => ({ ...prev, e_signature_name: typedName, e_signature_image: signatureImage, e_signature_date: signedAt }))
    setSignatureSaved(true); setShowSignModal(false)

    // 4. Generate PDF
    setTimeout(() => loan.loan_type === 'quickloan' ? generateQuickLoanAgreementPDF() : generateLoanAgreementPDF(typedName, signatureImage, signedAt), 500)
  }

  const markAllRead = async () => {
    if (!borrower) return
    const unread = notifications.filter(n => !n.is_read)
    if (unread.length === 0) return
    await supabase.from('portal_notifications').update({ is_read: true }).eq('borrower_id', borrower.id).eq('is_read', false)
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
  }

  const generateLoanAgreementPDF = (sigName, sigImage, sigDate) => {
    const name = sigName || loan.e_signature_name || borrower.e_signature_name || borrower.full_name
    const img = sigImage || loan.e_signature_image || borrower.e_signature_image
    const date = sigDate || loan.e_signature_date || borrower.e_signature_date || new Date().toISOString()
    const principal = Number(loan.loan_amount)
    const holdAmt = loan.security_hold ? Number(loan.security_hold) : principal * 0.10
    const holdRate = principal > 0 ? ((holdAmt / principal) * 100).toFixed(0) : 10
    const released = loan.funds_released ? Number(loan.funds_released) : principal - holdAmt
    const total = Number(loan.total_repayment)
    const perInst = Math.ceil(Number(loan.installment_amount))
    const rate = ((loan.interest_rate || 0.07) * 100).toFixed(0)
    const signedDateStr = new Date(date).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
    const releaseDateStr = loan.release_date ? (() => { const [y, m, d] = loan.release_date.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }) })() : 'TBD'
    const numInstallments = loan.num_installments || 4
    const loanTerm = loan.loan_term || 2
    const dueDatesForPDF = getDueDates(loan.release_date, loan.payments_made || 0, numInstallments)
    const maturityDate = dueDatesForPDF.length >= numInstallments ? dueDatesForPDF[numInstallments - 1].date.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }) : 'TBD'
    const scheduleRows = dueDatesForPDF.map((due, i) => `<tr style="background:${due.paid ? '#f0fdf4' : i % 2 === 0 ? '#fafafa' : '#fff'}"><td style="padding:5px 8px;border:1px solid #e5e7eb;text-align:center;font-weight:600;">${due.num}</td><td style="padding:5px 8px;border:1px solid #e5e7eb;">${due.date.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}</td><td style="padding:5px 8px;border:1px solid #e5e7eb;text-align:right;font-weight:600;">&#8369;${perInst.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td><td style="padding:5px 8px;border:1px solid #e5e7eb;text-align:center;color:${due.paid ? '#16a34a' : '#9CA3AF'}">${due.paid ? '&#10003; Paid' : 'Pending'}</td></tr>`).join('')
    const refId = `LM-${(borrower.id || '').slice(-6).toUpperCase()}`
    const borrowerName = borrower.full_name || ''
    const borrowerDept = borrower.department || 'N/A'
    const borrowerCode = borrower.access_code || '—'
    const imgTag = img ? `<img src="${img}" style="height:68px;max-width:240px;display:block;" />` : '<div style="height:68px;"></div>'
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<style>
  @import url('https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,600;0,700;1,400&family=Caveat:wght@600&display=swap');
  *{margin:0;padding:0;box-sizing:border-box;}body{font-family:'EB Garamond',Georgia,serif;color:#111827;background:#fff;font-size:12px;line-height:1.6;}
  @media print{@page{size:A4;margin:15mm 18mm;}.page-break{page-break-before:always;}}
  .page{padding:36px 44px;}.page2{padding:36px 44px;}
  .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2.5px solid #1e1b4b;padding-bottom:14px;margin-bottom:20px;}
  .logo{font-size:24px;font-weight:700;letter-spacing:-0.5px;}.logo span{color:#6366F1;}
  .doc-meta{text-align:right;font-size:10.5px;color:#6B7280;line-height:1.7;}
  .two-col{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:18px;}
  .section{margin-bottom:18px;}.section-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#4338CA;border-bottom:1.5px solid #E5E7EB;padding-bottom:5px;margin-bottom:10px;}
  .row{display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid #F3F4F6;font-size:11.5px;}.row .lbl{color:#6B7280;}.row .val{font-weight:600;color:#111827;text-align:right;}
  .schedule-table{width:100%;border-collapse:collapse;font-size:11.5px;margin-bottom:0;}
  .schedule-table th{background:#1e1b4b;color:#fff;padding:7px 10px;text-align:left;font-size:10.5px;text-transform:uppercase;letter-spacing:0.5px;}
  .schedule-table td{padding:6px 10px;border:1px solid #E5E7EB;}
  .tc-item{font-size:11.5px;color:#374151;margin-bottom:10px;line-height:1.65;}.tc-item strong{color:#111827;}
  .sig-grid{display:grid;grid-template-columns:1fr 1fr;gap:48px;margin-top:32px;}
  .sig-col{display:flex;flex-direction:column;}.sig-label{font-size:9.5px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:1.2px;margin-bottom:12px;}
  .sig-image-box{height:72px;display:flex;align-items:flex-end;margin-bottom:0;}.sig-line{border-bottom:1.5px solid #374151;margin-bottom:6px;}
  .sig-name{font-size:22px;font-style:italic;font-family:'Caveat',cursive;color:#111827;margin-bottom:4px;line-height:1.2;}.sig-sub{font-size:10px;color:#9CA3AF;line-height:1.5;}
  .disclaimer{font-size:9.5px;color:#9CA3AF;margin-top:28px;padding-top:12px;border-top:1px solid #E5E7EB;line-height:1.6;}
  .page2-header{display:flex;justify-content:space-between;align-items:center;border-bottom:1.5px solid #E5E7EB;padding-bottom:10px;margin-bottom:20px;font-size:10px;color:#9CA3AF;}
</style></head><body>
<div class="page">
  <div class="header"><div><div class="logo">Moneyfest<span>Lending</span></div><div style="font-size:10.5px;color:#6B7280;margin-top:3px;">Private Lending Program — Loan Agreement</div></div>
  <div class="doc-meta"><div><strong>Ref:</strong> ${refId}</div><div><strong>Date Signed:</strong> ${signedDateStr}</div><div><strong>Maturity Date:</strong> <span style="color:#D97706;font-weight:700;">${maturityDate}</span></div></div></div>
  <div class="two-col">
    <div class="section"><div class="section-title">Parties to this Agreement</div>
      <div class="row"><span class="lbl">Borrower</span><span class="val">${borrowerName}</span></div>
      <div class="row"><span class="lbl">Department</span><span class="val">${borrowerDept}</span></div>
      <div class="row"><span class="lbl">Access Code</span><span class="val">${borrowerCode}</span></div>
      <div class="row"><span class="lbl">Lender</span><span class="val">MoneyfestLending</span></div>
      <div class="row"><span class="lbl">Release Date</span><span class="val">${releaseDateStr}</span></div>
      <div class="row"><span class="lbl">Maturity Date</span><span class="val" style="color:#D97706;font-weight:700;">${maturityDate}</span></div>
    </div>
    <div class="section"><div class="section-title">RA 3765 — Truth in Lending Act Disclosure</div>
      <div class="row"><span class="lbl">Approved Loan Amount</span><span class="val">&#8369;${principal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span></div>
      <div class="row"><span class="lbl">Security Hold (${holdRate}%)</span><span class="val">&#8369;${holdAmt.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span></div>
      <div class="row"><span class="lbl">Funds Released to Borrower</span><span class="val">&#8369;${released.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span></div>
      <div class="row"><span class="lbl">Finance Charge (Interest)</span><span class="val">&#8369;${(total - principal).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span></div>
      <div class="row"><span class="lbl">Monthly Interest Rate</span><span class="val">${rate}% per month × ${loanTerm} months</span></div>
      <div class="row"><span class="lbl">Effective Annual Rate</span><span class="val">${((loan.interest_rate || 0.07) * 12 * 100).toFixed(0)}% p.a. (RA 3765)</span></div>
      <div class="row"><span class="lbl">Total Amount Payable</span><span class="val" style="font-weight:700;">&#8369;${total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span></div>
      <div class="row"><span class="lbl">Number of Installments</span><span class="val">${numInstallments} payments every 5th and 20th of the month</span></div>
      <div class="row"><span class="lbl">Per Installment Amount</span><span class="val">&#8369;${perInst.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span></div>
    </div>
  </div>
  <div class="section"><div class="section-title">Payment Schedule</div>
    <table class="schedule-table"><thead><tr><th>#</th><th>Due Date</th><th>Amount Due</th><th>Status</th></tr></thead><tbody>${scheduleRows}</tbody></table>
  </div>
  ${loan.security_hold_returned ? '<div style="margin-top:8px;display:inline-flex;align-items:center;gap:6px;padding:4px 10px;background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.2);border-radius:20px;font-size:11px;color:#16a34a;font-weight:700;">✅ Security Hold of ₱' + Number(loan.security_hold).toLocaleString('en-PH', { minimumFractionDigits: 2 }) + ' has been returned to your Rebate Credits</div>' : ''}
</div>
<div class="page-break"></div>
<div class="page2">
  <div class="page2-header"><span>Moneyfest<strong>Lending</strong> — Loan Agreement (Page 2)</span><span>Ref: ${refId} · ${borrowerName}</span></div>

  <div class="section">
    <div class="section-title">Loan Disclosure & Borrower Acknowledgements</div>
    ${loan.e_signature_name ? `<div style="margin-bottom:12px;padding:8px 12px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;font-size:11px;color:#16a34a;font-weight:600;">✅ Loan Agreement e-signed by ${loan.e_signature_name} on ${new Date(loan.e_signature_date || date).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}</div>` : ''}
  </div>

  <div class="section">
    <div class="section-title">Terms &amp; Conditions</div>
    <p class="tc-item">1. <strong>Loan Term &amp; Interest</strong> — A monthly interest rate of ${rate}% is applied for each of the ${loanTerm} months of the loan term, resulting in a total finance charge of ${(Number(rate) * loanTerm).toFixed(0)}% of the principal. This charge is fixed and does not compound. It applies regardless of early settlement or prepayment of any installment.</p>
    <p class="tc-item">2. <strong>Repayment Schedule &amp; Installment Rounding</strong> — The loan is repaid in ${numInstallments} equal installments, collected on the 5th and 20th of each month. Where the total repayment does not divide evenly, each installment is rounded up to the nearest whole peso (₱1.00), applied uniformly across all installments, and disclosed in this agreement.</p>
    <p class="tc-item">3. <strong>Security Hold</strong> — ${holdRate}% of the approved loan amount is withheld upon fund release as a Security Hold. The rate is determined by credit score: VIP (1000) — 5%, Reliable (920+) — 6%, Trusted (835+) — 8%, Standard (750+) — 10%, Caution (500+) — 15%, High Risk (below 500) — 20%. Late payment penalties are automatically deducted from the Security Hold balance. The remaining balance is returned to the Borrower's Rebate Credits upon full payment of the final installment.</p>
    <p class="tc-item">4. <strong>Late Payment Penalties</strong> — A penalty of &#8369;20.00 per calendar day is charged for each day an installment remains unpaid past its due date. The penalty accrues daily with no cap until settled. Each late payment results in a deduction of 10 points from the Borrower's credit score.</p>
    <p class="tc-item">5. <strong>Default</strong> — Failure to pay two (2) or more consecutive installments constitutes a loan default. Upon default, the remaining balance becomes immediately due and payable in full. A credit score deduction of 150 points is applied. MoneyfestLending reserves the right to pursue all available legal remedies under Philippine law including filing a civil complaint and referral to barangay conciliation (RA 7160).</p>
    <p class="tc-item">6. <strong>Credit Score System</strong> — Every Borrower starts with a score of 750 (max 1,000). +15 points per on-time installment. -10 points per late installment. +25 bonus points on full loan repayment. -150 points upon default.</p>
    <p class="tc-item">7. <strong>Loan Limit &amp; Level System</strong> — Level 1 (first loan): ₱5,000. Level 2 (after 1 clean loan): ₱7,000. Level 3 (after 2 clean loans): ₱9,000. Level 4 (after 3 clean loans): ₱10,000 maximum.</p>
    <p class="tc-item">8. <strong>Rebate Credits &amp; Early Payment Incentive</strong> — If the Borrower pays the final installment at least 7 to 14 days before its due date, a fixed rebate of 1% of the original loan amount is credited to their Rebate Credits balance.</p>
    <p class="tc-item">9. <strong>Data Privacy</strong> — The Borrower's personal information is processed solely for loan administration in compliance with RA 10173 (Data Privacy Act of 2012).</p>
    <p class="tc-item">10. <strong>Program Rules</strong> — Only one active loan is permitted per Borrower at a time. MoneyfestLending reserves the right to amend these terms with notice.</p>
    <p class="tc-item">11. <strong>Governing Law</strong> — This agreement is governed by the laws of the Republic of the Philippines. Disputes shall first be referred to barangay conciliation under RA 7160 before court action.</p>
  </div>

  <div style="padding:10px 12px;background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.15);border-radius:8px;font-size:11px;color:#4B5580;margin-bottom:24px;">
    ${[
        { label: 'Approved Loan Amount', value: '₱' + principal.toLocaleString('en-PH', { minimumFractionDigits: 2 }), color: '#F0F4FF' },
        { label: 'Security Hold (' + holdRate + '%)', value: '₱' + holdAmt.toLocaleString('en-PH', { minimumFractionDigits: 2 }), color: '#F59E0B' },
        { label: 'Funds Released to You', value: '₱' + (loan.funds_released ? Number(loan.funds_released).toLocaleString('en-PH', { minimumFractionDigits: 2 }) : (principal * 0.80).toLocaleString('en-PH', { minimumFractionDigits: 2 })), color: '#22C55E' },
        { label: 'Finance Charge', value: '₱' + (total - principal).toLocaleString('en-PH', { minimumFractionDigits: 2 }), color: '#F59E0B' },
        { label: 'Monthly Interest Rate', value: rate + '% per month × ' + loanTerm + ' months', color: '#60A5FA' },
        { label: 'Effective Interest Rate (per annum)', value: ((loan.interest_rate || 0.07) * 12 * 100).toFixed(0) + '% p.a.', color: '#a78bfa' },
        { label: 'Total Amount Payable', value: '₱' + total.toLocaleString('en-PH', { minimumFractionDigits: 2 }), color: '#22C55E' },
        { label: 'Number of Installments', value: numInstallments + ' payments every 5th and 20th of the month', color: '#F0F4FF' },
        { label: 'Per Installment Amount', value: '₱' + perInst.toLocaleString('en-PH', { minimumFractionDigits: 2 }), color: '#F0F4FF' },
      ].map(row => `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.06);"><span style="color:#6B7280;">${row.label}</span><span style="font-weight:700;">${row.value}</span></div>`).join('')}
  </div>
  ${loan.security_hold_returned ? '<div style="margin-bottom:12px;display:inline-flex;align-items:center;gap:6px;padding:4px 10px;background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.2);border-radius:20px;font-size:11px;color:#16a34a;font-weight:700;">✅ Security Hold of ₱' + Number(loan.security_hold).toLocaleString('en-PH', { minimumFractionDigits: 2 }) + ' has been returned to your Rebate Credits</div>' : ''}
  <div style="padding:10px 12px;background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.15);border-radius:8px;font-size:10px;color:#6B7280;line-height:1.7;margin-bottom:24px;">
    <strong style="color:#818CF8;">RA 3765 — Truth in Lending Act Disclosure.</strong> This statement discloses all finance charges and terms applicable to your loan in compliance with Republic Act No. 3765 of the Philippines. The monthly interest rate is applied for each of the ${loanTerm} months of the loan term. The effective annual rate is the monthly rate multiplied by 12 months.
  </div>
  <div class="sig-grid">
    <div class="sig-col"><div class="sig-label">Borrower E-Signature</div><div class="sig-image-box">${imgTag}</div><div class="sig-line"></div><div class="sig-name">${name}</div><div class="sig-sub">${borrowerName}</div><div class="sig-sub">Signed electronically on ${signedDateStr}</div><div class="sig-sub" style="margin-top:3px;">Pursuant to RA 8792 — E-Commerce Act of the Philippines</div></div>
    <div class="sig-col"><div class="sig-label">Admin / Authorized Representative</div><div class="sig-image-box"><div style="height:68px;"></div></div><div class="sig-line"></div><div style="height:28px;margin-bottom:4px;"></div><div class="sig-sub">MoneyfestLending Administration</div><div class="sig-sub">Authorized Representative</div><div class="sig-sub" style="margin-top:3px;">Date: ___________________________</div></div>
  </div>
  <div class="disclaimer">This Loan Agreement is executed in compliance with Republic Act No. 3765 (Truth in Lending Act), Republic Act No. 10173 (Data Privacy Act of 2012), and Republic Act No. 8792 (Electronic Commerce Act of 2000). The electronic signature affixed herein constitutes a valid and binding signature under RA 8792 and has the same legal effect as a handwritten signature. This document is private and confidential. MoneyfestLending is a private colleague lending program and is not a bank, quasi-bank, or BSP-supervised financial institution.</div>
</div></body></html>`
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const safeName = (borrowerName || 'Borrower').replace(/\s+/g, '_')
    const a = document.createElement('a'); a.href = url; a.download = `LoanAgreement_${safeName}_${dateStr}.html`
    a.click(); URL.revokeObjectURL(url)
  }

  const generateQuickLoanAgreementPDF = () => {
    const principal = Number(loan.loan_amount)
    const dailyInterest = parseFloat((principal * 0.1 / 30).toFixed(2))
    const day15Interest = parseFloat((dailyInterest * 15).toFixed(2))
    const day15Total = parseFloat((principal + day15Interest).toFixed(2))
    const releaseDate = loan.release_date ? (() => { const [y, m, d] = loan.release_date.split('-').map(Number); return new Date(y, m - 1, d) })() : new Date()
    const day15Date = new Date(releaseDate); day15Date.setDate(day15Date.getDate() + 15)
    const day30Date = new Date(releaseDate); day30Date.setDate(day30Date.getDate() + 30)
    const fmt = d => d.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
    const releaseDateStr = fmt(releaseDate)
    const day15Str = fmt(day15Date)
    const day30Str = fmt(day30Date)
    const signedDateStr = loan.e_signature_date ? fmt(new Date(loan.e_signature_date)) : fmt(new Date())
    const name = loan.e_signature_name || borrower?.full_name || ''
    const img = loan.e_signature_image || borrower?.e_signature_image
    const imgTag = img ? `<img src="${img}" style="height:68px;max-width:240px;display:block;" />` : '<div style="height:68px;"></div>'
    const refId = `QL-${(borrower?.id || '').slice(-6).toUpperCase()}`

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<style>
  @import url('https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,600;0,700;1,400&family=Caveat:wght@600&display=swap');
  *{margin:0;padding:0;box-sizing:border-box;}body{font-family:'EB Garamond',Georgia,serif;color:#111827;background:#fff;font-size:12px;line-height:1.6;}
  @media print{@page{size:A4;margin:15mm 18mm;}}
  .page{padding:36px 44px;}
  .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2.5px solid #92400e;padding-bottom:14px;margin-bottom:20px;}
  .logo{font-size:24px;font-weight:700;letter-spacing:-0.5px;color:#111;}.logo span{color:#D97706;}
  .doc-meta{text-align:right;font-size:10.5px;color:#6B7280;line-height:1.7;}
  .badge{display:inline-block;padding:4px 12px;border-radius:20px;background:#fffbeb;border:1px solid #D97706;color:#92400e;font-size:11px;font-weight:700;margin-bottom:16px;}
  .two-col{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:18px;}
  .section{margin-bottom:18px;}.section-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#B45309;border-bottom:1.5px solid #FDE68A;padding-bottom:5px;margin-bottom:10px;}
  .row{display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid #FEF3C7;font-size:11.5px;}.row .lbl{color:#6B7280;}.row .val{font-weight:600;color:#111827;text-align:right;}
  .highlight-row{background:#fffbeb;padding:6px 10px;border-radius:6px;margin-bottom:6px;display:flex;justify-content:space-between;font-size:12px;}
  .tc-item{font-size:11.5px;color:#374151;margin-bottom:10px;line-height:1.65;}.tc-item strong{color:#111827;}
  .sig-grid{display:grid;grid-template-columns:1fr 1fr;gap:48px;margin-top:32px;}
  .sig-col{display:flex;flex-direction:column;}.sig-label{font-size:9.5px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:1.2px;margin-bottom:12px;}
  .sig-image-box{height:72px;display:flex;align-items:flex-end;margin-bottom:0;}.sig-line{border-bottom:1.5px solid #374151;margin-bottom:6px;}
  .sig-name{font-size:22px;font-style:italic;font-family:'Caveat',cursive;color:#111827;margin-bottom:4px;line-height:1.2;}.sig-sub{font-size:10px;color:#9CA3AF;line-height:1.5;}
  .disclaimer{font-size:9.5px;color:#9CA3AF;margin-top:28px;padding-top:12px;border-top:1px solid #E5E7EB;line-height:1.6;}
  .warning-box{background:#fffbeb;border:1px solid #D97706;border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:11px;color:#92400e;}
</style></head><body>
<div class="page">
  <div class="header">
    <div><div class="logo">Moneyfest<span>Lending</span></div><div style="font-size:10.5px;color:#6B7280;margin-top:3px;">⚡ QuickLoan Agreement</div></div>
    <div class="doc-meta"><div><strong>Ref:</strong> ${refId}</div><div><strong>Release Date:</strong> ${releaseDateStr}</div><div><strong>Day 15 Target:</strong> <span style="color:#D97706;font-weight:700;">${day15Str}</span></div><div><strong>Day 30 Deadline:</strong> <span style="color:#DC2626;font-weight:700;">${day30Str}</span></div></div>
  </div>

  <div class="badge">⚡ QuickLoan — Short-Term Cash Loan</div>

  <div class="two-col">
    <div class="section"><div class="section-title">Parties to this Agreement</div>
      <div class="row"><span class="lbl">Borrower</span><span class="val">${borrower?.full_name || ''}</span></div>
      <div class="row"><span class="lbl">Department</span><span class="val">${borrower?.department || 'N/A'}</span></div>
      <div class="row"><span class="lbl">Access Code</span><span class="val">${borrower?.access_code || '—'}</span></div>
      <div class="row"><span class="lbl">Lender</span><span class="val">MoneyfestLending</span></div>
      <div class="row"><span class="lbl">Release Date</span><span class="val">${releaseDateStr}</span></div>
    </div>
    <div class="section"><div class="section-title">RA 3765 — Truth in Lending Disclosure</div>
      <div class="row"><span class="lbl">Loan Principal</span><span class="val">&#8369;${principal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span></div>
      <div class="row"><span class="lbl">Funds Released (no hold)</span><span class="val">&#8369;${principal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span></div>
      <div class="row"><span class="lbl">Monthly Interest Rate</span><span class="val">10% per month</span></div>
      <div class="row"><span class="lbl">Daily Interest Rate</span><span class="val">0.3333%/day</span></div>
      <div class="row"><span class="lbl">Daily Interest Amount</span><span class="val">&#8369;${dailyInterest.toFixed(2)}/day</span></div>
      <div class="row"><span class="lbl">If paid on Day 15</span><span class="val" style="color:#16a34a;font-weight:700;">&#8369;${day15Total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span></div>
      <div class="row"><span class="lbl">Extension Fee (if missed)</span><span class="val">&#8369;100.00 (one-time)</span></div>
      <div class="row"><span class="lbl">Penalty after Day 30</span><span class="val" style="color:#DC2626;">&#8369;25.00/day (uncapped)</span></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Payment Timeline</div>
    <div class="highlight-row"><span>Release Date</span><span style="font-weight:700;">${releaseDateStr}</span></div>
    <div class="highlight-row" style="border-left:3px solid #16a34a;"><span>✅ Day 15 — Target Due Date</span><span style="font-weight:700;color:#16a34a;">${day15Str}</span></div>
    <div class="highlight-row" style="background:#fff7ed;border-left:3px solid #D97706;"><span>⚠️ Day 15 Missed → ₱100 extension fee, principal rolls over</span><span style="font-weight:700;color:#D97706;">₱100 collected</span></div>
    <div class="highlight-row" style="background:#fef2f2;border-left:3px solid #DC2626;"><span>🔴 Day 30 — Hard Deadline</span><span style="font-weight:700;color:#DC2626;">${day30Str}</span></div>
    <div class="highlight-row" style="background:#fef2f2;"><span>After Day 30 → ₱25/day penalty + daily interest run simultaneously</span><span style="font-weight:700;color:#DC2626;">No cap</span></div>
  </div>

  <div class="section">
    <div class="section-title">Terms & Conditions</div>
    <p class="tc-item">1. <strong>Interest Accrual</strong> — Interest accrues daily at 0.3333% per day (10%/month) on the outstanding principal from the date of release. Interest does not compound.</p>
    <p class="tc-item">2. <strong>Pay Anytime</strong> — The Borrower may settle the full outstanding balance at any time. Interest stops on the day payment is confirmed. No prepayment penalty applies.</p>
    <p class="tc-item">3. <strong>Day 15 Target Due Date</strong> — The target due date is 15 calendar days from release (${day15Str}). If settled by Day 15, total payment = ₱${principal.toLocaleString('en-PH')} principal + ₱${day15Interest.toFixed(2)} interest = ₱${day15Total.toLocaleString('en-PH')}.</p>
    <p class="tc-item">4. <strong>Extension Fee</strong> — If Day 15 is missed, a one-time extension fee of ₱100 is charged. The admin collects the accrued 15-day interest + ₱100 fee. The principal rolls over to Day 30.</p>
    <p class="tc-item">5. <strong>Day 30 Hard Deadline & Penalty</strong> — Day 30 (${day30Str}) is the absolute deadline. After Day 30, a ₱25/day penalty accrues on top of the continuing daily interest, with no cap, until fully settled.</p>
    <p class="tc-item">6. <strong>No Security Hold</strong> — QuickLoan carries no Security Hold deduction. The full approved amount is released to the Borrower.</p>
    <p class="tc-item">7. <strong>Full Payoff Only</strong> — QuickLoan must be settled in a single full payment. Partial principal payments are not accepted.</p>
    <p class="tc-item">8. <strong>One Active Loan</strong> — Only one active loan (of any type) is permitted per Borrower at a time.</p>
    <p class="tc-item">9. <strong>Data Privacy (RA 10173)</strong> — Personal information is processed solely for loan administration purposes.</p>
    <p class="tc-item">10. <strong>Governing Law</strong> — This agreement is governed by Philippine law including RA 3765, RA 10173, and RA 8792. Disputes shall first go to barangay conciliation under RA 7160.</p>
  </div>

  <div class="sig-grid">
    <div class="sig-col"><div class="sig-label">Borrower E-Signature</div><div class="sig-image-box">${imgTag}</div><div class="sig-line"></div><div class="sig-name">${name}</div><div class="sig-sub">${borrower?.full_name || ''}</div><div class="sig-sub">Signed electronically on ${signedDateStr}</div><div class="sig-sub" style="margin-top:3px;">Pursuant to RA 8792 — E-Commerce Act</div></div>
    <div class="sig-col"><div class="sig-label">Admin / Authorized Representative</div><div class="sig-image-box"><div style="height:68px;"></div></div><div class="sig-line"></div><div style="height:28px;margin-bottom:4px;"></div><div class="sig-sub">MoneyfestLending Administration</div><div class="sig-sub">Authorized Representative</div><div class="sig-sub" style="margin-top:3px;">Date: ___________________________</div></div>
  </div>

  <div class="disclaimer">This QuickLoan Agreement is executed in compliance with RA 3765 (Truth in Lending Act), RA 10173 (Data Privacy Act), and RA 8792 (E-Commerce Act). The electronic signature affixed herein has the same legal effect as a handwritten signature. MoneyfestLending is a private colleague lending program, not a BSP-regulated institution.</div>
</div></body></html>`

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const safeName = (borrower?.full_name || 'Borrower').replace(/\s+/g, '_')
    const a = document.createElement('a'); a.href = url; a.download = `QuickLoanAgreement_${safeName}_${dateStr}.html`
    a.click(); URL.revokeObjectURL(url)
  }

  // ── PENDING APP SCREEN ───────────────────────────────────────
  if (pendingApp) return (
    <div style={{ minHeight: '100dvh', background: '#080B14', fontFamily: 'DM Sans, sans-serif', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <PortalHeader />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', minHeight: 'calc(100dvh - 60px)', padding: '20px 16px' }}>
        <div style={{ maxWidth: 520, width: '100%' }}>

          {/* Status card */}
          <div style={{
            background: pendingApp.status === 'Rejected' ? 'rgba(239,68,68,0.04)' : 'rgba(245,158,11,0.04)',
            border: `1px solid ${pendingApp.status === 'Rejected' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'}`,
            borderRadius: 20, padding: '32px 28px', marginBottom: 16
          }}>
            {/* Icon + Title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
              <div style={{
                width: 52, height: 52, borderRadius: 14, flexShrink: 0,
                background: pendingApp.status === 'Rejected' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
                border: `1px solid ${pendingApp.status === 'Rejected' ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.25)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24
              }}>
                {pendingApp.status === 'Rejected' ? '❌' : '⏳'}
              </div>
              <div>
                <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 800, fontSize: 20, color: '#F0F4FF', marginBottom: 3 }}>
                  {pendingApp.status === 'Rejected' ? 'Application Not Approved' : 'Application Under Review'}
                </div>
                <div style={{ fontSize: 12, color: pendingApp.status === 'Rejected' ? '#EF4444' : '#F59E0B', fontWeight: 600 }}>
                  {pendingApp.status === 'Rejected' ? 'Status: Rejected' : 'Status: Pending Review'}
                </div>
              </div>
            </div>

            {/* Reason / message */}
            <div style={{
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 12, padding: '16px 18px', marginBottom: 20,
              fontSize: 13.5, color: '#9AA4BC', lineHeight: 1.8
            }}>
              {pendingApp.status === 'Rejected'
                ? (pendingApp.reject_reason || 'Your application was not approved. Please contact an admin for more information.')
                : 'Your application is currently being reviewed by our admin team. Please check back later or reach out directly via Microsoft Teams for updates.'}
            </div>

            {/* Application details */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 16 }}>
              <div style={{ fontSize: 10, color: '#4B5580', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 12 }}>Application Details</div>
              {[
                { label: 'Applicant', value: pendingApp.full_name },
                { label: 'Department', value: pendingApp.department },
                { label: 'Tenurity', value: (pendingApp.tenure_years || 0) + ' Year' + (pendingApp.tenure_years > 1 ? 's' : '') },
                { label: 'Requested Amount', value: '₱' + Number(pendingApp.loan_amount).toLocaleString() },
                { label: 'Reference Code', value: pendingApp.access_code },
                { label: 'Submitted', value: new Date(pendingApp.created_at).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' }) },
              ].map((r, i, arr) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                  <span style={{ fontSize: 12, color: '#4B5580' }}>{r.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#CBD5F0', fontFamily: 'Space Grotesk, sans-serif' }}>{r.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Contact admins */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '20px 22px', marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: '#4B5580', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 12 }}>Need help? Contact your admin</div>
            <p style={{ fontSize: 13, color: '#7A8AAA', lineHeight: 1.7, margin: '0 0 14px' }}>Our team is ready to assist with any questions about your application.</p>
            <a href="/contact" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 20px', borderRadius: 11, background: 'linear-gradient(135deg,rgba(59,130,246,0.12),rgba(139,92,246,0.12))', border: '1px solid rgba(139,92,246,0.25)', color: '#a78bfa', textDecoration: 'none', fontSize: 13, fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif' }}>
              💬 Contact Us →
            </a>
          </div>

          <button onClick={() => { setPendingApp(null); setInputCode(''); setCode('') }}
            style={{ width: '100%', padding: '12px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: '#7A8AAA', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#F0F4FF' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#7A8AAA' }}
          >← Back to Portal</button>

        </div>
      </div>
    </div>
  )

  if (!borrower) return (
    <div style={{ minHeight: '100dvh', background: '#080B14', fontFamily: 'DM Sans, sans-serif', display: 'flex', flexDirection: 'column', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <style>{`
        .portal-login-input:focus { border-color: rgba(99,102,241,0.5) !important; box-shadow: 0 0 0 3px rgba(99,102,241,0.1) !important; }
        .portal-login-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(99,102,241,0.3) !important; }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        .login-card { animation: fadeUp 0.5s ease forwards; }
        .type-btn { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
      `}</style>

      {/* Header */}
      <header style={{ padding: '16px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <img src="/favicon-96x96.png" alt="ML" style={{ width: 32, height: 32, objectFit: 'contain' }} />
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 16, color: '#F0F4FF' }}>
            Moneyfest<span style={{ background: 'linear-gradient(90deg,#60a5fa,#a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Lending</span>
          </div>
        </a>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href="/portal" onClick={(e) => { e.preventDefault(); setLoginType(loginType === 'borrower' ? 'partner' : 'borrower') }} 
             style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: '#7A8AAA', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
            Switch to {loginType === 'borrower' ? 'Partner' : 'Borrower'}
          </a>
        </div>
      </header>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ width: '100%', maxWidth: 420 }} className="login-card">
          
          {/* Logo/Icon */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ width: 72, height: 72, borderRadius: 22, background: loginType === 'borrower' ? 'linear-gradient(135deg,rgba(99,102,241,0.2),rgba(139,92,246,0.2))' : 'linear-gradient(135deg,rgba(139,92,246,0.2),rgba(245,158,11,0.2))', border: `1px solid ${loginType === 'borrower' ? 'rgba(99,102,241,0.3)' : 'rgba(245,158,11,0.3)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', animation: 'float 3s ease-in-out infinite', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
              <img src={loginType === 'borrower' ? "/padlock.png" : "/handshake.png"} alt="icon" style={{ width: 32, height: 32, objectFit: 'contain' }} />
            </div>
            <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 900, fontSize: 28, color: '#F0F4FF', letterSpacing: -0.5, marginBottom: 8 }}>
              {loginType === 'borrower' ? 'Borrower Portal' : 'Partner Portal'}
            </h1>
            <p style={{ fontSize: 14, color: '#4B5580', margin: 0 }}>
              {loginType === 'borrower' ? 'Access your loan details and repayment plan' : 'Track your capital, ROI, and active deployments'}
            </p>
          </div>

          <div style={{ background: '#0E1320', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 24, padding: '32px 28px', boxShadow: '0 40px 80px rgba(0,0,0,0.5)' }}>
            
            {/* Toggle Segment */}
            <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', padding: 4, borderRadius: 14, marginBottom: 28, border: '1px solid rgba(255,255,255,0.04)' }}>
              <button 
                onClick={() => setLoginType('borrower')}
                className="type-btn"
                style={{ flex: 1, padding: '10px', borderRadius: 11, border: 'none', background: loginType === 'borrower' ? 'rgba(255,255,255,0.06)' : 'transparent', color: loginType === 'borrower' ? '#F0F4FF' : '#4B5580', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                Borrower
              </button>
              <button 
                onClick={() => setLoginType('partner')}
                className="type-btn"
                style={{ flex: 1, padding: '10px', borderRadius: 11, border: 'none', background: loginType === 'partner' ? 'rgba(255,255,255,0.06)' : 'transparent', color: loginType === 'partner' ? '#F0F4FF' : '#4B5580', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                Partner
              </button>
            </div>

            {loginType === 'borrower' ? (
              /* Borrower Form */
              <div>
                <div style={{ fontSize: 11, color: '#4B5580', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 800, marginBottom: 10, marginLeft: 4 }}>Access Code</div>
                <input
                  value={inputCode}
                  onChange={e => setInputCode(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  placeholder="LM-XXXX"
                  maxLength={7}
                  className="portal-login-input"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '16px 16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, color: '#F0F4FF', fontSize: 24, fontWeight: 800, fontFamily: 'monospace', letterSpacing: 8, textAlign: 'center', marginBottom: 16, outline: 'none', transition: 'all 0.2s' }}
                />
                {error && (
                  <div style={{ fontSize: 13, color: '#EF4444', marginBottom: 16, padding: '12px 16px', background: 'rgba(239,68,68,0.08)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <AlertCircle size={14} /> {error}
                  </div>
                )}
                <button onClick={handleLogin} disabled={loading} className="portal-login-btn"
                  style={{ width: '100%', height: 52, borderRadius: 14, border: 'none', background: loading ? 'rgba(99,102,241,0.3)' : 'linear-gradient(135deg,#6366F1,#8B5CF6)', color: '#fff', fontSize: 15, fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'Syne, sans-serif', transition: 'all 0.2s', boxShadow: '0 4px 15px rgba(99,102,241,0.2)' }}>
                  {loading ? 'Verifying...' : 'Access My Loan →'}
                </button>
              </div>
            ) : (
              /* Partner Form */
              <div>
                <div style={{ fontSize: 11, color: '#4B5580', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 800, marginBottom: 10, marginLeft: 4 }}>Partner Access Code</div>
                <input
                  value={partnerInputCode}
                  onChange={e => setPartnerInputCode(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && handlePartnerLogin()}
                  placeholder="MF-XXXX"
                  maxLength={7}
                  className="portal-login-input"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '16px 16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, color: '#F59E0B', fontSize: 24, fontWeight: 800, fontFamily: 'monospace', letterSpacing: 8, textAlign: 'center', marginBottom: 16, outline: 'none', transition: 'all 0.2s' }}
                />
                {partnerError && (
                  <div style={{ fontSize: 13, color: '#EF4444', marginBottom: 16, padding: '12px 16px', background: 'rgba(239,68,68,0.08)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <AlertCircle size={14} /> {partnerError}
                  </div>
                )}
                <button onClick={handlePartnerLogin} disabled={partnerLoading} className="portal-login-btn"
                  style={{ width: '100%', height: 52, borderRadius: 14, border: 'none', background: partnerLoading ? 'rgba(245,158,11,0.3)' : 'linear-gradient(135deg,#F59E0B,#D97706)', color: '#000', fontSize: 15, fontWeight: 800, cursor: partnerLoading ? 'not-allowed' : 'pointer', fontFamily: 'Syne, sans-serif', transition: 'all 0.2s', boxShadow: '0 4px 15px rgba(245,158,11,0.2)' }}>
                  {partnerLoading ? 'Authenticating...' : 'Enter Partner Hub →'}
                </button>
              </div>
            )}

            <div style={{ marginTop: 24, padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: 14, fontSize: 12, color: '#4B5580', lineHeight: 1.6, textAlign: 'center', border: '1px solid rgba(255,255,255,0.04)' }}>
              {loginType === 'borrower' ? (
                <>💡 Your LM code is found in your approval email.<br />Need a loan? <a href="/apply" style={{ color: '#7A8AAA', fontWeight: 700, textDecoration: 'none' }}>Apply here →</a></>
              ) : (
                <>Interested in becoming a funding partner?<br /><a href="/admin/investor-pitch" style={{ color: '#F59E0B', fontWeight: 700, textDecoration: 'none' }}>View our Investor Pitch →</a></>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  // ── PROFILE PAGE ─────────────────────────────────────────────
  if (page === 'profile') return (
    <div style={{ minHeight: '100dvh', background: '#080B14', fontFamily: 'DM Sans, sans-serif', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>

      <PortalHeader borrower={borrower} notifications={notifications} showNotifs={showNotifs} setShowNotifs={setShowNotifs} markAllRead={markAllRead} onBack={() => setPage('home')} subtitle="My Profile" />
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 20px 40px' }}>

        {/* Hero card */}
        <div style={{ background: 'linear-gradient(135deg,#0E1320,#1a1040)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 20, padding: 28, marginBottom: 16, textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -40, right: -40, width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle,rgba(139,92,246,0.08),transparent)', pointerEvents: 'none' }} />
          <div style={{ width: 80, height: 80, borderRadius: 24, background: 'linear-gradient(135deg,#3B82F6,#8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, fontWeight: 900, color: '#fff', margin: '0 auto 16px', fontFamily: 'Syne, sans-serif', boxShadow: '0 8px 24px rgba(139,92,246,0.3)' }}>
            {borrower.full_name?.charAt(0).toUpperCase()}
          </div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 22, color: '#F0F4FF', marginBottom: 4 }}>{borrower.full_name}</div>
          <div style={{ fontSize: 13, color: '#7A8AAA', marginBottom: 14 }}>{borrower.department}</div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: getBadgeConfig(borrower.loyalty_badge || 'New').bg, border: '1px solid ' + getBadgeConfig(borrower.loyalty_badge || 'New').border, borderRadius: 8, padding: '5px 14px' }}>
            <span style={{ fontSize: 15 }}>{getBadgeConfig(borrower.loyalty_badge || 'New').emoji}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: getBadgeConfig(borrower.loyalty_badge || 'New').color }}>{getBadgeConfig(borrower.loyalty_badge || 'New').label}</span>
          </div>
        </div>

        {/* Credit Score */}
        <div style={{ background: '#0E1320', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 22, marginBottom: 14 }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, color: '#7A8AAA', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>Credit Score</div>
          {(() => {
            const score = borrower.credit_score || 750
            const pct = ((score - CREDIT_CONFIG.MIN_SCORE) / (CREDIT_CONFIG.MAX_SCORE - CREDIT_CONFIG.MIN_SCORE)) * 100
            const label = CREDIT_CONFIG.labelFromScore(score)
            const color = CREDIT_CONFIG.colorFromScore(score)
            return (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 }}>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 900, fontSize: 52, color, lineHeight: 1 }}>{score}</div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color, marginBottom: 2 }}>{label}</div>
                    <div style={{ fontSize: 11, color: '#4B5580' }}>out of 1,000</div>
                  </div>
                </div>
                <div style={{ height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
                  <div style={{ height: '100%', width: pct + '%', background: `linear-gradient(90deg,#EF4444,#F59E0B,#22C55E,#8B5CF6)`, borderRadius: 4, transition: 'width 1.2s ease' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#4B5580' }}>
                  <span>300</span><span>500</span><span>750</span><span>920</span><span>1000 VIP</span>
                </div>
              </div>
            )
          })()}
        </div>

        {/* Security Hold Tier */}
        {(() => {
          const score = borrower.credit_score || 750
          const cleanLoans = borrower.clean_loans || 0
          const tier = getSecurityHoldRate(score, cleanLoans)
          return (
            <div style={{ background: '#0E1320', border: `1px solid ${tier.color}22`, borderRadius: 16, padding: 22, marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, color: '#7A8AAA', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Security Hold Tier</div>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 900, fontSize: 24, color: tier.color }}>{(tier.rate * 100).toFixed(0)}%</div>
              </div>
              <div style={{ fontSize: 12, color: '#8892B0', lineHeight: 1.7, marginBottom: 14 }}>{tier.perk}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
                {[
                  { label: 'High Risk', rate: '20%', color: '#EF4444' },
                  { label: 'Caution', rate: '15%', color: '#F97316' },
                  { label: 'Standard', rate: '10%', color: '#7A8AAA' },
                  { label: 'Trusted', rate: '8%', color: '#60A5FA' },
                  { label: 'Reliable', rate: '6%', color: '#34D399' },
                  { label: 'VIP', rate: '5%', color: '#8B5CF6' },
                ].map((t, i) => {
                  const isActive = tier.label === t.label
                  return (
                    <div key={i} style={{ padding: '8px 10px', borderRadius: 10, background: isActive ? t.color + '18' : 'rgba(255,255,255,0.02)', border: `1px solid ${isActive ? t.color + '55' : 'rgba(255,255,255,0.05)'}`, textAlign: 'center' }}>
                      <div style={{ fontSize: 13, fontWeight: isActive ? 800 : 600, color: isActive ? t.color : '#4B5580' }}>{t.rate}</div>
                      <div style={{ fontSize: 10, color: isActive ? t.color + 'CC' : '#4B5580', marginTop: 2 }}>{t.label}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}

        {/* Loan Limit */}
        <div style={{ background: '#0E1320', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 22, marginBottom: 14 }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, color: '#7A8AAA', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>Loan Limit Level</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 14 }}>
            {[{ level: 1, amount: '₱5,000' }, { level: 2, amount: '₱7,000' }, { level: 3, amount: '₱9,000' }, { level: 4, amount: '₱10,000' }].map(l => {
              const current = (borrower.loan_limit_level || 1) === l.level
              const unlocked = (borrower.loan_limit_level || 1) >= l.level
              return (
                <div key={l.level} style={{ background: current ? 'rgba(139,92,246,0.12)' : unlocked ? 'rgba(34,197,94,0.06)' : 'rgba(255,255,255,0.02)', border: `1px solid ${current ? 'rgba(139,92,246,0.35)' : unlocked ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.05)'}`, borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: current ? '#8B5CF6' : unlocked ? '#22C55E' : '#4B5580', marginBottom: 4 }}>LVL {l.level}</div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: current ? '#F0F4FF' : unlocked ? '#CBD5F0' : '#4B5580' }}>{l.amount}</div>
                  {current && <div style={{ fontSize: 9, color: '#8B5CF6', marginTop: 3 }}>Current</div>}
                  {!current && unlocked && <div style={{ fontSize: 9, color: '#22C55E', marginTop: 3 }}>✓</div>}
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '10px 0', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <span style={{ color: '#4B5580' }}>Clean loans completed</span>
            <span style={{ fontWeight: 700, color: '#8B5CF6' }}>{borrower.clean_loans || 0} of 3</span>
          </div>
        </div>

        {/* Personal Details */}
        <div style={{ background: '#0E1320', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 22 }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, color: '#7A8AAA', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>Personal Details</div>
          {[{ label: 'Email', value: borrower.email }, { label: 'Phone', value: borrower.phone }, { label: 'Department', value: borrower.department }, { label: 'Tenure', value: borrower.tenure_years ? borrower.tenure_years + ' years' : 'N/A' }, { label: 'Access Code', value: borrower.access_code }].map((item, i, arr) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0', borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
              <span style={{ fontSize: 12, color: '#4B5580' }}>{item.label}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#F0F4FF' }}>{item.value || 'N/A'}</span>
            </div>
          ))}
        </div>

      </div>
    </div>
  )

  // ── PAYMENT HISTORY PAGE ──────────────────────────────────────
  if (page === 'payment-history') return (
    <div style={{ minHeight: '100dvh', background: '#080B14', fontFamily: 'DM Sans, sans-serif', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>

      <PortalHeader borrower={borrower} notifications={notifications} showNotifs={showNotifs} setShowNotifs={setShowNotifs} markAllRead={markAllRead} onBack={() => setPage('home')} subtitle="Payment History" />
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 20px 40px' }}>
        {allLoans.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 20, color: '#F0F4FF', marginBottom: 8 }}>No Payment History</div>
            <div style={{ fontSize: 14, color: '#7A8AAA' }}>Your confirmed payments will appear here.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {allLoans.map((l, li) => {
              const confirmedProofs = proofs.filter(p => p.loan_id === l.id && p.status === 'Confirmed')
              const loanDate = new Date(l.created_at).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })
              const instAmt = Math.ceil(l.installment_amount || 0)
              return (
                <div key={l.id} style={{ background: '#0E1320', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, overflow: 'hidden' }}>
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 15, color: '#F0F4FF' }}>Loan #{allLoans.length - li} — ₱{Number(l.loan_amount).toLocaleString()}</div>
                      <div style={{ fontSize: 11, color: '#4B5580', marginTop: 2 }}>{loanDate}</div>
                    </div>
                    <StatusBadge status={l.status} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', background: 'rgba(255,255,255,0.02)' }}>
                    {[
                      { label: 'Total Repayment', value: '₱' + Number(l.total_repayment).toLocaleString('en-PH', { minimumFractionDigits: 2 }) },
                      { label: 'Payments Made', value: `${l.payments_made || 0} of ${l.num_installments || 4}` },
                      { label: 'Balance', value: '₱' + Number(l.remaining_balance || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 }) },
                    ].map((s, i) => (
                      <div key={i} style={{ padding: '12px 14px', borderRight: i < 2 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                        <div style={{ fontSize: 10, color: '#4B5580', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{s.label}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#F0F4FF' }}>{s.value}</div>
                      </div>
                    ))}
                  </div>
                  {confirmedProofs.length > 0 ? (
                    <div style={{ padding: '14px 20px' }}>
                      <div style={{ fontSize: 10, color: '#4B5580', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10, fontWeight: 700 }}>Confirmed Payments</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {confirmedProofs.map((proof, pi) => (
                          <div key={pi} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.12)', borderRadius: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(34,197,94,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>✅</div>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: '#F0F4FF' }}>Installment {proof.installment_number}</div>
                                <div style={{ fontSize: 11, color: '#4B5580' }}>{new Date(proof.reviewed_at || proof.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: 13, fontWeight: 800, color: '#22C55E' }}>₱{instAmt.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
                                <div style={{ fontSize: 10, color: '#22C55E' }}>Confirmed</div>
                              </div>
                              <button onClick={() => downloadReceipt({ loan: l, borrower, installmentNum: proof.installment_number, amount: instAmt })}
                                style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.08)', color: '#60A5FA', fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                ↓ Receipt
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: '16px 20px', textAlign: 'center', fontSize: 13, color: '#4B5580' }}>No confirmed payments yet.</div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )

  // ── WALLET / REBATE CREDITS PAGE ──────────────────────────────
  if (page === 'wallet') {
    const canWithdraw = rebateCredits?.balance >= 500
    return (
      <>
        <div style={{ minHeight: '100dvh', background: '#080B14', fontFamily: 'DM Sans, sans-serif', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <PortalHeader borrower={borrower} notifications={notifications} showNotifs={showNotifs} setShowNotifs={setShowNotifs} markAllRead={markAllRead} onBack={() => setPage('home')} subtitle="Rebate Credits" />
          <div style={{ maxWidth: 520, margin: '0 auto', padding: '32px 20px 40px' }}>

            {/* Balance card */}
            <div style={{ background: 'linear-gradient(135deg,#0E1320,#1a1040)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 20, padding: 28, marginBottom: 16, textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 120%, rgba(245,158,11,0.06), transparent)', pointerEvents: 'none' }} />
              <div style={{ fontSize: 11, color: '#7A8AAA', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8, fontWeight: 700 }}>Rebate Credits Balance</div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 900, fontSize: 48, color: '#F59E0B', marginBottom: 4, lineHeight: 1 }}>
                ₱{(rebateCredits?.balance || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </div>
              {!canWithdraw && (
                <div style={{ fontSize: 12, color: '#4B5580', marginBottom: 16 }}>₱{(500 - (rebateCredits?.balance || 0)).toLocaleString('en-PH', { minimumFractionDigits: 2 })} more needed to withdraw</div>
              )}
              {canWithdraw ? (
                <button onClick={() => { setWithdrawMethod(''); setWithdrawDetails(''); setShowWithdrawModal(true) }}
                  style={{ padding: '12px 28px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#F59E0B,#D97706)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'Syne, sans-serif' }}>
                  💸 Request Withdrawal
                </button>
              ) : (
                <div style={{ display: 'inline-block', padding: '10px 20px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', fontSize: 12, color: '#4B5580' }}>🔒 Min. ₱500 required to withdraw</div>
              )}
            </div>

            {/* How to earn */}
            <div style={{ background: '#0E1320', border: '1px solid rgba(34,197,94,0.15)', borderRadius: 16, padding: 20, marginBottom: 16 }}>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, color: '#22C55E', marginBottom: 14 }}>🎁 How to earn rebates</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.1)', borderRadius: 10, marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#F0F4FF' }}>Pay final installment at least 1–2 weeks early</div>
                  <div style={{ fontSize: 11, color: '#4B5580', marginTop: 2 }}>₱50 rebate on a ₱5,000 loan</div>
                </div>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 900, fontSize: 22, color: '#22C55E' }}>1%</div>
              </div>
              <div style={{ fontSize: 11, color: '#4B5580', lineHeight: 1.7 }}>Fixed 1% of your original loan amount — credited automatically when admin records your payment. Security Hold is also returned here after your final installment.</div>
            </div>

            {/* Transaction history */}
            <div style={{ background: '#0E1320', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, color: '#F0F4FF' }}>Transaction History</div>
              {creditTxns.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', fontSize: 13, color: '#4B5580' }}>No transactions yet. Pay off a loan early to earn rebates!</div>
              ) : (
                <div>
                  {creditTxns.map((txn, i) => {
                    const isHoldReturn = txn.type === 'rebate' && txn.description?.toLowerCase().includes('security hold')
                    const isRebate = txn.type === 'rebate' && !isHoldReturn
                    const label = isHoldReturn ? 'Security Hold Returned' : isRebate ? 'Early Payoff Rebate' : 'Withdrawal'
                    const icon = isHoldReturn ? '🔐' : isRebate ? '🎁' : '💸'
                    const amountColor = isHoldReturn ? '#F59E0B' : isRebate ? '#22C55E' : '#F0F4FF'
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: i < creditTxns.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ width: 36, height: 36, borderRadius: 10, background: isHoldReturn ? 'rgba(245,158,11,0.1)' : isRebate ? 'rgba(34,197,94,0.1)' : txn.status === 'pending' ? 'rgba(245,158,11,0.1)' : 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{icon}</div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#F0F4FF' }}>{label}</div>
                            <div style={{ fontSize: 11, color: '#4B5580', marginTop: 2 }}>
                              {new Date(txn.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                              {txn.status === 'pending' && <span style={{ color: '#F59E0B', marginLeft: 6 }}>· Pending</span>}
                              {txn.status === 'rejected' && <span style={{ color: '#EF4444', marginLeft: 6 }}>· Rejected</span>}
                            </div>
                          </div>
                        </div>
                        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15, color: amountColor }}>
                          {txn.type === 'rebate' ? '+' : '-'}₱{Number(txn.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

          </div>

        </div>

        {/* Withdrawal Modal */}
        {showWithdrawModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
            <div style={{ width: '100%', maxWidth: 440, background: '#0E1320', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 20, overflow: 'hidden', boxShadow: '0 40px 80px rgba(0,0,0,0.6)' }}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 16, color: '#F0F4FF' }}>Request Withdrawal</div>
                  <div style={{ fontSize: 12, color: '#4B5580', marginTop: 2 }}>Amount: <strong style={{ color: '#F59E0B' }}>₱{(rebateCredits?.balance || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong></div>
                </div>
                <button onClick={() => setShowWithdrawModal(false)} style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#7A8AAA', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
              </div>
              <div style={{ padding: 24 }}>
                <div style={{ fontSize: 11, color: '#4B5580', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700, marginBottom: 10 }}>Select Release Method</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
                  {[
                    { value: 'Physical Cash', logo: '/cash-logo.png', label: 'Physical Cash', hint: 'Coordinate with admin in person', free: true },
                    { value: 'GCash', logo: '/gcash-logo.png', label: 'GCash', hint: 'Sent to your GCash number', free: false },
                    { value: 'RCBC', logo: '/rcbc-logo.png', label: 'RCBC Bank Transfer', hint: 'Transferred to your RCBC account', free: true },
                    { value: 'Other Bank', logo: '/bank-logo.png', label: 'Other Bank (Instapay/PESONet)', hint: 'Transfer fee applies', free: false },
                  ].map(m => (
                    <button key={m.value} onClick={() => { setWithdrawMethod(m.value); setWithdrawDetails('') }}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, border: `1.5px solid ${withdrawMethod === m.value ? 'rgba(245,158,11,0.5)' : 'rgba(255,255,255,0.07)'}`, background: withdrawMethod === m.value ? 'rgba(245,158,11,0.07)' : 'rgba(255,255,255,0.02)', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
                      <img src={m.logo} alt={m.label} style={{ width: 32, height: 32, objectFit: 'contain', flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: withdrawMethod === m.value ? '#F59E0B' : '#F0F4FF' }}>{m.label}</div>
                        <div style={{ fontSize: 11, color: '#4B5580', marginTop: 1 }}>{m.hint}</div>
                      </div>
                      {m.free && <span style={{ fontSize: 10, fontWeight: 700, color: '#22C55E', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 20, padding: '2px 8px' }}>Free</span>}
                      {withdrawMethod === m.value && <span style={{ fontSize: 14, color: '#F59E0B' }}>✓</span>}
                    </button>
                  ))}
                </div>
                {withdrawMethod && withdrawMethod !== 'Physical Cash' && (
                  <div style={{ marginBottom: 18 }}>
                    <div style={{ fontSize: 11, color: '#4B5580', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700, marginBottom: 8 }}>
                      {withdrawMethod === 'GCash' ? 'GCash Number & Name' : 'Account Number & Bank Name'}
                    </div>
                    <textarea value={withdrawDetails} onChange={e => setWithdrawDetails(e.target.value)}
                      placeholder={withdrawMethod === 'GCash' ? 'e.g. 09XX-XXX-XXXX · Juan Dela Cruz' : 'e.g. 1234-5678-9012 · BDO / BPI / UnionBank'}
                      rows={2} style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, color: '#F0F4FF', fontSize: 13, resize: 'none', outline: 'none', fontFamily: 'DM Sans, sans-serif' }} />
                  </div>
                )}
                {withdrawMethod === 'Physical Cash' && (
                  <div style={{ padding: '10px 14px', background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: 10, fontSize: 12, color: '#22C55E', marginBottom: 18 }}>
                    ✓ Admin will coordinate with you in person once the request is approved.
                  </div>
                )}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setShowWithdrawModal(false)} style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: '#7A8AAA', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                  <button
                    disabled={!withdrawMethod || (withdrawMethod !== 'Physical Cash' && !withdrawDetails.trim()) || withdrawing}
                    onClick={async () => {
                      setWithdrawing(true)
                      const methodDesc = withdrawMethod === 'Physical Cash' ? 'Physical Cash' : `${withdrawMethod} — ${withdrawDetails.trim()}`
                      const { error } = await supabase.from('wallet_transactions').insert({ borrower_id: borrower.id, type: 'withdrawal', amount: rebateCredits.balance, description: `Withdrawal request via ${methodDesc}`, status: 'pending' })
                      if (!error) {
                        await supabase.from('portal_notifications').insert({ borrower_id: borrower.id, type: 'withdrawal_requested', title: '💸 Withdrawal Requested', message: `Your withdrawal request of ₱${rebateCredits.balance.toLocaleString('en-PH', { minimumFractionDigits: 2 })} via ${withdrawMethod} is pending admin review.` })
                        fetchPortalData(code)
                        setShowWithdrawModal(false)
                      }
                      setWithdrawing(false)
                    }}
                    style={{ flex: 2, padding: '12px', borderRadius: 10, border: 'none', background: (!withdrawMethod || (withdrawMethod !== 'Physical Cash' && !withdrawDetails.trim())) ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg,#F59E0B,#D97706)', color: (!withdrawMethod || (withdrawMethod !== 'Physical Cash' && !withdrawDetails.trim())) ? '#4B5580' : '#fff', fontSize: 13, fontWeight: 700, cursor: (!withdrawMethod || (withdrawMethod !== 'Physical Cash' && !withdrawDetails.trim())) ? 'not-allowed' : 'pointer', fontFamily: 'Syne, sans-serif' }}>
                    {withdrawing ? 'Submitting...' : '💸 Submit Request'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    )
  }

  // ── PAYMENT METHODS PAGE ──────────────────────────────────────
  if (page === 'payment-methods') return (
    <div style={{ minHeight: '100dvh', background: '#080B14', fontFamily: 'DM Sans, sans-serif', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>

      <PortalHeader borrower={borrower} notifications={notifications} showNotifs={showNotifs} setShowNotifs={setShowNotifs} markAllRead={markAllRead} onBack={() => setPage('home')} subtitle="Payment Methods" />
      <div style={{ maxWidth: 620, margin: '0 auto', padding: '32px 20px 40px' }}>
        <div style={{ fontSize: 13, color: '#7A8AAA', marginBottom: 24, lineHeight: 1.7 }}>
          Choose any of the following methods to make your installment payments. After every payment, upload your proof through this portal so your admin can confirm it.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { logo: '/cash-logo.png', label: 'Physical Cash', fee: 'Free', feeColor: '#10B981', accent: 'rgba(16,185,129,0.05)', glow: 'rgba(16,185,129,0.2)', desc: 'Pay your admin directly in person.', steps: ['Prepare the exact installment amount in cash', 'Coordinate with your admin via Teams Chat', 'Hand over payment and request acknowledgement', 'Upload photo of receipt or acknowledgement'] },
            { logo: '/gcash-logo.png', label: 'GCash', fee: 'GCash Free', feeColor: '#3B82F6', accent: 'rgba(59,130,246,0.05)', glow: 'rgba(59,130,246,0.2)', desc: 'Send via GCash to Charlou June Ramil.', steps: ['Open GCash and select Send Money', { label: 'Send to: 09665835179 (Charlou June R.)', copy: '09665835179' }, 'Send the exact installment amount', '⚠️ Note: GCash to GCash is free. You must cover fees if using Bank-to-GCash or 3rd party apps.', 'Screenshot and upload the successful transaction'] },
            { logo: '/rcbc-logo.png', label: 'RCBC to RCBC', fee: 'Free', feeColor: '#EF4444', accent: 'rgba(239,68,68,0.05)', glow: 'rgba(239,68,68,0.2)', desc: 'Same-bank RCBC transfers are completely free.', steps: ['Log in to RCBC Online or App', { label: 'Transfer to: 9051147397 (John Paul Lacaron)', copy: '9051147397' }, 'Transfer exact installment amount', 'Screenshot the transfer confirmation', 'Upload the screenshot in the portal'] },
            { logo: '/maribank.png', label: 'MariBank', fee: 'Free', feeColor: '#F59E0B', accent: 'rgba(245,158,11,0.05)', glow: 'rgba(245,158,11,0.2)', desc: 'Send to Charlou June Ramil via MariBank.', steps: ['Open your bank app and select Transfer', 'Bank: MariBank PH', { label: 'Account: 12476681477 (Charlou June R.)', copy: '12476681477' }, 'Screenshot the transfer confirmation', 'Upload the screenshot in the portal'] },
            { logo: '/bank-logo.png', label: 'Other Bank', fee: 'Fee Applies', feeColor: '#8B5CF6', accent: 'rgba(139,92,246,0.05)', glow: 'rgba(139,92,246,0.2)', desc: 'Transfer from any bank via Instapay/PESONet.', steps: ['Use your bank online transfer or app', 'Choose Instapay (faster) or PESONet', 'Send exact installment amount + fee', 'Upload the screenshot in the portal'] },
          ].map((item, i) => (
            <div key={i} 
              onMouseEnter={() => setHoveredMethod(i)}
              onMouseLeave={() => setHoveredMethod(null)}
              onClick={() => setActiveMethod(activeMethod === i ? null : i)}
              style={{ 
                background: 'rgba(255,255,255,0.025)', 
                backdropFilter: 'blur(10px)',
                border: `1px solid ${activeMethod === i ? 'rgba(255,255,255,0.2)' : hoveredMethod === i ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)'}`,
                borderRadius: 24, 
                overflow: 'hidden', 
                transition: 'all 0.4s cubic-bezier(0.19, 1, 0.22, 1)',
                transform: hoveredMethod === i ? 'translateY(-4px)' : 'translateY(0)',
                boxShadow: hoveredMethod === i ? `0 20px 40px -15px ${item.glow}` : '0 4px 12px rgba(0,0,0,0.1)',
                cursor: 'pointer'
              }}
            >
              <div style={{ padding: '22px 26px', display: 'flex', alignItems: 'center', gap: 20, background: activeMethod === i ? `${item.accent.replace('0.05', '0.08')}` : item.accent }}>
                <div style={{ 
                  width: 60, height: 60, borderRadius: 16, background: 'rgba(255,255,255,0.05)', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden',
                  border: '1px solid rgba(255,255,255,0.08)',
                  boxShadow: '0 8px 16px rgba(0,0,0,0.2)'
                }}>
                  <img src={item.logo} alt={item.label} style={{ width: 40, height: 40, objectFit: 'contain' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                    <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 17, color: '#F0F4FF', letterSpacing: '-0.02em' }}>{item.label}</span>
                    <span style={{ fontSize: 10, fontWeight: 800, color: item.feeColor, background: `${item.feeColor}15`, padding: '3px 10px', borderRadius: 20, border: `1px solid ${item.feeColor}30`, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.fee}</span>
                  </div>
                  <div style={{ fontSize: 13, color: '#7A8AAA', fontWeight: 500 }}>{item.desc}</div>
                </div>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4B5580', transition: 'all 0.3s', transform: activeMethod === i ? 'rotate(180deg)' : 'rotate(0)' }}>
                  <ChevronDown size={18} />
                </div>
              </div>

              {/* Accordion Content */}
              <div style={{ 
                maxHeight: activeMethod === i ? 600 : 0, 
                opacity: activeMethod === i ? 1 : 0,
                transition: 'all 0.5s cubic-bezier(0.19, 1, 0.22, 1)',
                padding: activeMethod === i ? '0 26px 22px' : '0 26px 0',
                background: 'rgba(0,0,0,0.15)',
                overflow: 'hidden'
              }}>
                <div style={{ height: activeMethod === i ? 'auto' : 0 }}>
                  <div style={{ height: 1.5, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)', margin: '0 0 18px' }} />
                  <div style={{ fontSize: 10, color: '#4B5580', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 14, fontWeight: 800 }}>Repayment Instructions</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {item.steps.map((step, si) => {
                      const isObj = typeof step === 'object'
                      const txt = isObj ? step.label : step
                      const isWarn = txt.includes('⚠️')
                      return (
                        <div key={si} style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                          <div style={{ 
                            width: 24, height: 24, borderRadius: 8, 
                            background: isWarn ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.05)', 
                            border: `1px solid ${isWarn ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.1)'}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', 
                            fontSize: 10, fontWeight: 800, color: isWarn ? '#F59E0B' : '#7A8AAA', 
                            flexShrink: 0, marginTop: 1 
                          }}>{si + 1}</div>
                          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 13.5, color: isWarn ? '#F59E0B' : '#CBD5F0', lineHeight: 1.5, fontWeight: isWarn ? 600 : 400 }}>{txt}</span>
                            {isObj && step.copy && (
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleCopy(step.copy, txt) }}
                                style={{ 
                                  padding: '4px 10px', borderRadius: 8, border: `1px solid ${copiedKey === txt ? '#10B981' : 'rgba(99,102,241,0.3)'}`, 
                                  background: copiedKey === txt ? 'rgba(16,185,129,0.1)' : 'rgba(99,102,241,0.1)', 
                                  color: copiedKey === txt ? '#10B981' : '#8B5CF6', 
                                  fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s',
                                  display: 'flex', alignItems: 'center', gap: 6, margin: '2px 0'
                                }}
                              >
                                {copiedKey === txt ? '✓ Copied!' : '⧉ Copy'}
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ 
          marginTop: 24, padding: '18px 24px', 
          background: 'rgba(245,158,11,0.05)', 
          border: '1px solid rgba(245,158,11,0.2)', 
          borderRadius: 16, fontSize: 13, color: '#F59E0B', 
          lineHeight: 1.8, display: 'flex', gap: 14, alignItems: 'flex-start' 
        }}>
          <div style={{ fontSize: 20 }}>⚠️</div>
          <div>
            <strong style={{ color: '#F59E0B', display: 'block', marginBottom: 2, fontSize: 14, fontFamily: 'Syne, sans-serif', fontWeight: 800 }}>Important Reminder</strong>
            Always upload your proof of payment after every transaction. Your payment is only confirmed once your admin reviews and approves the proof.
          </div>
        </div>
      </div>
    </div>
  )

  // ── HOME PAGE ────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100dvh', background: '#080B14', fontFamily: 'DM Sans, sans-serif', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <style>{`
        
        @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes scaleIn { from{opacity:0;transform:scale(0.97)} to{opacity:1;transform:scale(1)} }
        .pc { animation: fadeUp 0.45s ease forwards; opacity: 0; }
        .pc:nth-child(1){animation-delay:0.05s}.pc:nth-child(2){animation-delay:0.1s}.pc:nth-child(3){animation-delay:0.15s}.pc:nth-child(4){animation-delay:0.2s}.pc:nth-child(5){animation-delay:0.25s}.pc:nth-child(6){animation-delay:0.3s}
        .nav-btn { transition: all 0.15s ease; }
        .nav-btn:hover { transform: translateX(2px); background: rgba(255,255,255,0.04) !important; }
        .inst-row { transition: all 0.15s ease; }
        .inst-row:hover { background: rgba(255,255,255,0.04) !important; }
        .upload-btn { transition: all 0.2s ease; }
        .upload-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(34,197,94,0.25) !important; }
        .stats-grid { transition: all 0.3s ease; }
        @media (max-width: 860px) { .portal-grid { grid-template-columns: 1fr !important; } .portal-sidebar { display: none !important; } }
        @media (max-width: 640px) { .stats-grid { grid-template-columns: 1fr !important; } }
        @media (max-width: 520px) { .loan-meta-grid { grid-template-columns: 1fr 1fr !important; } }

        .ribbon-btn { transition: all 0.22s cubic-bezier(0.4, 0, 0.2, 1); position: relative; }
        .ribbon-btn:hover { 
          transform: translateY(-2px) scale(1.06); 
          background: rgba(255,255,255,0.06) !important; 
          border-color: rgba(255,255,255,0.12) !important;
          box-shadow: 0 8px 20px -6px rgba(0,0,0,0.4);
        }
        .ribbon-btn::after {
          content: attr(data-label);
          position: absolute;
          bottom: 100%;
          left: 50%;
          transform: translateX(-50%) translateY(4px);
          background: rgba(15, 23, 42, 0.95);
          color: #fff;
          padding: 5px 10px;
          border-radius: 8px;
          font-size: 10px;
          font-weight: 700;
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
          transition: all 0.2s ease;
          white-space: nowrap;
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          margin-bottom: 8px;
          font-family: 'Syne, sans-serif';
        }
        .ribbon-btn:hover::after {
          opacity: 1;
          visibility: visible;
          transform: translateX(-50%) translateY(0);
        }
      `}</style>

      <PortalHeader borrower={borrower} notifications={notifications} showNotifs={showNotifs} setShowNotifs={setShowNotifs} markAllRead={markAllRead} onSignOut={() => { setBorrower(null); setLoan(null); setAllLoans([]); setCode(''); setInputCode(''); localStorage.removeItem('lm_portal_code') }} />

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '28px 20px 48px' }}>

        {uploadSuccess && (
          <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 12, padding: '12px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#22C55E', fontWeight: 600 }}>
            ✅ Payment proof submitted successfully! Your admin will review it shortly.
          </div>
        )}

        {/* No loan state */}
        {!loan ? (
          <div style={{ maxWidth: 500, margin: '0 auto', padding: '40px 0' }}>
            <div style={{ textAlign: 'center', padding: '40px 20px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 24 }}>
              <div style={{ fontSize: 52, marginBottom: 16 }}>🏦</div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 24, color: '#F0F4FF', marginBottom: 8 }}>No Active Loan</div>
              <div style={{ fontSize: 14, color: '#7A8AAA', marginBottom: 24 }}>You don't have an active loan yet.</div>
              <a href="/apply" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderRadius: 12, background: 'linear-gradient(135deg,#3B82F6,#2563EB)', color: '#fff', fontSize: 14, fontWeight: 700, textDecoration: 'none', fontFamily: 'Syne, sans-serif' }}>New Application →</a>
            </div>

            {/* Fast-Track Renewal for Trusted/VIPs */}
            {(borrower.loyalty_badge !== 'New' && !renewalSent) && (
              <div className="pc" style={{ marginTop: 24, background: 'linear-gradient(135deg,#0E1320,#1a1040)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 24, padding: 24, position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: -40, right: -40, width: 140, height: 140, borderRadius: '50%', background: 'radial-gradient(circle,rgba(139,92,246,0.1),transparent)', pointerEvents: 'none' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(139,92,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a78bfa' }}>
                    <Lock size={18} />
                  </div>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 16, color: '#F0F4FF' }}>Fast-Track Renewal Available</div>
                </div>
                <p style={{ fontSize: 13, color: '#7A8AAA', lineHeight: 1.6, marginBottom: 20 }}>
                  As a **{getBadgeConfig(borrower.loyalty_badge).label}**, you can renew your loan with one click. We'll reuse your existing profile for instant processing.
                </p>
                <button 
                  onClick={handleFastTrackRenewal}
                  disabled={renewing}
                  style={{ width: '100%', padding: '13px', borderRadius: 12, border: 'none', background: renewing ? 'rgba(139,92,246,0.3)' : 'linear-gradient(135deg,#6366F1,#8B5CF6)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: renewing ? 'not-allowed' : 'pointer', fontFamily: 'Syne, sans-serif', transition: 'all 0.2s' }}>
                  {renewing ? 'Submitting...' : '🚀 Renew Loan in One-Click'}
                </button>
              </div>
            )}

            {renewalSent && (
              <div className="pc" style={{ marginTop: 24, background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 20, padding: 24, textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>🚀</div>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 18, color: '#22C55E', marginBottom: 6 }}>Renewal Submitted!</div>
                <p style={{ fontSize: 13, color: '#7A8AAA', lineHeight: 1.6 }}>Our admin team has received your fast-track renewal request. We'll notify you once it's approved.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="portal-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>

            {/* ── LEFT COLUMN ── */}
            <div>
              {/* Dashboard Highlights Row (Mini-Stats) */}
              <div className="pc stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
                {[
                  (() => {
                    const isQL = loan.loan_type === 'quickloan'
                    if (isQL) {
                      const releaseDate = loan.release_date ? (() => { const [y,m,d] = loan.release_date.split('-').map(Number); return new Date(y,m-1,d) })() : null
                      const daysElapsed = releaseDate ? Math.max(0, Math.floor((new Date() - releaseDate) / 86400000)) : 0
                      const target = daysElapsed <= 15 ? 15 : 30
                      const daysLeft = Math.max(0, target - daysElapsed)
                      const targetDate = releaseDate ? new Date(releaseDate.getTime() + target * 86400000) : null
                      return {
                        label: daysElapsed <= 15 ? 'Day 15 Target' : 'Day 30 Deadline',
                        value: daysLeft > 0 ? `${daysLeft} Days Left` : (daysElapsed <= 30 ? 'Due Today' : 'Overdue'),
                        sub: targetDate ? targetDate.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—',
                        icon: <Calendar size={14} />,
                        color: daysElapsed > 30 ? '#EF4444' : daysElapsed > 15 ? '#F59E0B' : '#22C55E',
                        bg: daysElapsed > 30 ? 'rgba(239,68,68,0.08)' : daysElapsed > 15 ? 'rgba(245,158,11,0.08)' : 'rgba(34,197,94,0.08)',
                        border: daysElapsed > 30 ? 'rgba(239,68,68,0.2)' : daysElapsed > 15 ? 'rgba(245,158,11,0.2)' : 'rgba(34,197,94,0.2)'
                      }
                    }
                    const dates = getDueDates(loan.release_date, loan.payments_made, loan.num_installments)
                    const next = dates.find(d => !d.paid)
                    const now = new Date()
                    const diff = next ? Math.ceil((new Date(next.date) - now) / (1000 * 60 * 60 * 24)) : null
                    return {
                      label: 'Next Payday',
                      value: next ? (diff > 0 ? `${diff} Days Left` : 'Due Today') : 'No pending',
                      sub: next ? formatDate(next.dateStr) : 'Fully Paid',
                      icon: <Calendar size={14} />,
                      color: '#8B5CF6',
                      bg: 'rgba(139,92,246,0.08)',
                      border: 'rgba(139,92,246,0.2)'
                    }
                  })(),
                  { 
                    label: 'Available Rebates', 
                    value: '₱' + (rebateCredits?.balance || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 }),
                    sub: 'Wallet Balance',
                    icon: <CreditCard size={14} />,
                    color: '#22C55E',
                    bg: 'rgba(34,197,94,0.08)',
                    border: 'rgba(34,197,94,0.2)'
                  },
                  { 
                    label: 'Credit Health', 
                    value: getBadgeConfig(borrower.loyalty_badge).label,
                    sub: `${borrower.credit_score || 750} Points`,
                    icon: <CheckCircle size={14} />,
                    color: '#3B82F6',
                    bg: 'rgba(59,130,246,0.08)',
                    border: 'rgba(59,130,246,0.2)'
                  }
                ].map((stat, i) => (
                  <div key={i} style={{ background: '#0E1320', border: `1px solid ${stat.border}`, borderRadius: 16, padding: '14px 16px', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: -10, right: -10, width: 40, height: 40, borderRadius: '50%', background: stat.bg, filter: 'blur(10px)', pointerEvents: 'none' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <div style={{ color: stat.color }}>{stat.icon}</div>
                      <span style={{ fontSize: 10, color: '#4B5580', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800 }}>{stat.label}</span>
                    </div>
                    <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 15, color: '#F0F4FF' }}>{stat.value}</div>
                    <div style={{ fontSize: 10, color: '#7A8AAA', marginTop: 2 }}>{stat.sub}</div>
                  </div>
                ))}
              </div>

              {/* Loan Hero Card */}
              <div className="pc" style={{ background: 'linear-gradient(135deg,#0d1425,#160e30)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 20, padding: 24, marginBottom: 16, position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: -60, right: -60, width: 240, height: 240, borderRadius: '50%', background: 'radial-gradient(circle,rgba(99,102,241,0.06),transparent)', pointerEvents: 'none' }} />

                <div style={{ marginBottom: 20 }}>
                  {(() => {
                    const isQL = loan.loan_type === 'quickloan'
                    if (isQL) {
                      const principal = Number(loan.loan_amount)
                      const releaseDate = loan.release_date ? (() => { const [y,m,d] = loan.release_date.split('-').map(Number); return new Date(y,m-1,d) })() : null
                      const daysElapsed = releaseDate && loan.status !== 'Pending' ? Math.max(0, Math.floor((new Date() - releaseDate) / 86400000)) : 0
                      const dailyInterest = parseFloat((principal * 0.1 / 30).toFixed(2))
                      const accrued = parseFloat((dailyInterest * daysElapsed).toFixed(2))
                      const extensionFee = loan.extension_fee_charged ? 100 : 0
                      const penaltyDays = Math.max(0, daysElapsed - 30)
                      const penalty = penaltyDays * 25
                      const liveTotal = loan.status === 'Paid' ? 0 : parseFloat((principal + accrued + extensionFee + penalty).toFixed(2))
                      const phase = daysElapsed > 30 ? 'penalty' : daysElapsed > 15 ? 'extended' : 'active'
                      const balColor = loan.status === 'Paid' ? '#22C55E' : phase === 'penalty' ? '#EF4444' : phase === 'extended' ? '#F59E0B' : '#F0F4FF'
                      return (
                        <>
                          <div style={{ fontSize: 11, color: '#4B5580', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6, fontWeight: 700 }}>
                            {loan.status === 'Pending' ? 'Loan Amount' : 'Total Owed Today'}
                          </div>
                          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 44, color: balColor, lineHeight: 1, letterSpacing: -2, marginBottom: 10 }}>
                            ₱{(loan.status === 'Pending' ? principal : liveTotal).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          </div>
                          {loan.status !== 'Pending' && daysElapsed > 0 && (
                            <div style={{ fontSize: 11, color: '#7A8AAA', marginBottom: 8 }}>₱{principal.toLocaleString('en-PH')} principal + ₱{accrued.toFixed(2)} interest ({daysElapsed}d)</div>
                          )}
                        </>
                      )
                    }
                    return (
                      <>
                        <div style={{ fontSize: 11, color: '#4B5580', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6, fontWeight: 700 }}>Remaining Balance</div>
                        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 44, color: loan.status === 'Paid' ? '#22C55E' : '#F0F4FF', lineHeight: 1, letterSpacing: -2, marginBottom: 10 }}>
                          ₱{Number(loan.remaining_balance).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </div>
                      </>
                    )
                  })()}
                  <StatusBadge status={loan.status} />
                </div>

                {/* Progress bar */}
                {(() => {
                  const isQL = loan.loan_type === 'quickloan'
                  if (isQL) {
                    const releaseDate = loan.release_date ? (() => { const [y,m,d] = loan.release_date.split('-').map(Number); return new Date(y,m-1,d) })() : null
                    const daysElapsed = releaseDate ? Math.max(0, Math.floor((new Date() - releaseDate) / 86400000)) : 0
                    const pct = Math.min(100, Math.round((daysElapsed / 30) * 100))
                    const phase = daysElapsed > 30 ? 'penalty' : daysElapsed > 15 ? 'extended' : 'active'
                    const barColor = phase === 'penalty' ? '#EF4444' : phase === 'extended' ? '#F59E0B' : '#22C55E'
                    return (
                      <div style={{ marginBottom: 20 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12, color: '#7A8AAA' }}>
                          <span>⚡ QuickLoan — Day {daysElapsed} of 30</span>
                          <span style={{ color: barColor, fontWeight: 700 }}>{phase === 'penalty' ? '🔴 Overdue' : phase === 'extended' ? '🟡 Extended' : '🟢 Active'}</span>
                        </div>
                        <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: pct + '%', background: barColor, borderRadius: 3, transition: 'width 1s ease' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10, color: '#4B5580' }}>
                          <span>Release</span><span>Day 15 (Early)</span><span>Day 30 (Max)</span>
                        </div>
                      </div>
                    )
                  }
                  const paid = loan.payments_made || 0
                  const total = loan.num_installments || 4
                  const pct = Math.round((paid / total) * 100)
                  return (
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12, color: '#7A8AAA' }}>
                        <span>{paid} of {total} installments paid</span>
                        <span style={{ color: pct === 100 ? '#22C55E' : '#F0F4FF', fontWeight: 700 }}>{pct}% complete</span>
                      </div>
                      <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: pct + '%', background: pct === 100 ? '#22C55E' : 'linear-gradient(90deg,#6366F1,#8B5CF6,#22C55E)', borderRadius: 3, transition: 'width 1s ease' }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
                        {Array.from({ length: total }, (_, i) => i + 1).map(i => (
                          <div key={i} style={{ width: 26, height: 26, borderRadius: '50%', background: i <= paid ? (i === total ? '#22C55E' : '#8B5CF6') : 'rgba(255,255,255,0.05)', border: `1.5px solid ${i <= paid ? (i === total ? '#22C55E' : '#8B5CF6') : 'rgba(255,255,255,0.1)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: i <= paid ? '#fff' : '#4B5580', flexShrink: 0 }}>
                            {i <= paid ? '✓' : i}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })()}

                {/* Meta grid */}
                <div className="loan-meta-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
                  {(() => {
                    const isQL = loan.loan_type === 'quickloan'
                    const principal = Number(loan.loan_amount)
                    const dailyInterest = parseFloat((principal * 0.1 / 30).toFixed(2))
                    return [
                      { label: 'Approved Amount', value: '₱' + principal.toLocaleString('en-PH'), color: '#F0F4FF' },
                      { label: 'Loan Purpose', value: loan.loan_purpose || 'Not specified', color: '#8B5CF6' },
                      isQL
                        ? { label: 'Daily Interest', value: `₱${dailyInterest.toFixed(2)}/day`, color: '#60A5FA' }
                        : { label: 'Security Hold', value: loan.security_hold > 0 ? `🔒 ₱${Number(loan.security_hold).toLocaleString('en-PH')}` : '—', color: '#F59E0B' },
                      isQL
                        ? { label: 'Interest Rate', value: '10%/month (daily)', color: '#a78bfa' }
                        : { label: 'Per Installment', value: '₱' + Math.ceil(Number(loan.installment_amount)).toLocaleString('en-PH', { minimumFractionDigits: 2 }), color: '#a78bfa' },
                    ]
                  })().map((m, i) => (
                    <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '14px 16px' }}>
                      <div style={{ fontSize: 10, color: '#4B5580', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6, fontWeight: 700 }}>{m.label}</div>
                      <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15, color: m.color }}>{m.value}</div>
                    </div>
                  ))}
                </div>

                {/* Dates */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                  <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ fontSize: 9, color: '#4B5580', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4, fontWeight: 700 }}>Release Date</div>
                    <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, color: '#F59E0B' }}>{formatDate(loan.release_date)}</div>
                  </div>
                  {(() => {
                    const numInst = loan.num_installments || 4
                    const dueDates = getDueDates(loan.release_date, loan.payments_made || 0, numInst)
                    const maturity = dueDates.length >= numInst ? dueDates[numInst - 1].date.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' }) : 'TBD'
                    return (
                      <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: '10px 12px' }}>
                        <div style={{ fontSize: 9, color: '#4B5580', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4, fontWeight: 700 }}>Maturity Date</div>
                        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, color: '#F59E0B' }}>{maturity}</div>
                      </div>
                    )
                  })()}
                </div>
              </div>

              {/* E-Signature Banner */}
              {!loan.agreement_confirmed && (
                <div className="pc" style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 14, padding: '14px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#a78bfa', marginBottom: 2 }}>✍ Sign Your Loan Agreement</div>
                    <div style={{ fontSize: 12, color: '#4B5580' }}>Your e-signature is required to activate your loan terms.</div>
                  </div>
                  <button onClick={() => setShowSignModal(true)}
                    style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#6366F1,#8B5CF6)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Syne, sans-serif', whiteSpace: 'nowrap' }}>
                    Sign Now
                  </button>
                </div>
              )}
              {loan.agreement_confirmed && loan.e_signature_name && (
                <div className="pc" style={{ background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: 14, padding: '12px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: 12, color: '#22C55E', fontWeight: 600 }}>✅ Loan Agreement signed by {loan.e_signature_name} · {new Date(loan.e_signature_date || '').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                  <button onClick={() => loan.loan_type === 'quickloan' ? generateQuickLoanAgreementPDF() : generateLoanAgreementPDF()} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid rgba(34,197,94,0.25)', background: 'rgba(34,197,94,0.08)', color: '#22C55E', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>↓ Download</button>
                </div>
              )}

              {/* Payment Schedule / QuickLoan Payoff Card */}
              {loan.loan_type === 'quickloan' ? (
                // ── QuickLoan: single payoff card ──
                (() => {
                  const principal = Number(loan.loan_amount)
                  const dailyInterest = parseFloat((principal * 0.1 / 30).toFixed(2))
                  const releaseDate = loan.release_date ? (() => { const [y,m,d] = loan.release_date.split('-').map(Number); return new Date(y,m-1,d) })() : null
                  const daysElapsed = releaseDate ? Math.max(0, Math.floor((new Date() - releaseDate) / 86400000)) : 0
                  const accruedNow = parseFloat((dailyInterest * daysElapsed).toFixed(2))
                  const extensionFee = loan.extension_fee_charged ? 100 : 0
                  const penaltyDays = Math.max(0, daysElapsed - 30)
                  const penalty = penaltyDays * 25
                  const totalOwedNow = parseFloat((principal + accruedNow + extensionFee + penalty).toFixed(2))
                  const day15Interest = parseFloat((dailyInterest * 15).toFixed(2))
                  const day15Total = parseFloat((principal + day15Interest).toFixed(2))
                  const day15Date = releaseDate ? new Date(releaseDate.getTime() + 15 * 86400000) : null
                  const day30Date = releaseDate ? new Date(releaseDate.getTime() + 30 * 86400000) : null
                  const fmt = d => d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
                  const hasProof = proofs.some(p => p.loan_id === loan.id && p.status === 'Pending')
                  const phase = daysElapsed > 30 ? 'penalty' : daysElapsed > 15 ? 'extended' : 'active'
                  const phaseColor = phase === 'penalty' ? '#EF4444' : phase === 'extended' ? '#F59E0B' : '#22C55E'
                  return (
                    <div className="pc" style={{ background: '#0E1320', border: `1px solid ${phase === 'penalty' ? 'rgba(239,68,68,0.3)' : phase === 'extended' ? 'rgba(245,158,11,0.25)' : 'rgba(34,197,94,0.2)'}`, borderRadius: 18, overflow: 'hidden', marginBottom: 16 }}>
                      <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 9, background: `${phaseColor}18`, border: `1px solid ${phaseColor}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>⚡</div>
                          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15, color: '#F0F4FF' }}>QuickLoan Pay-Off</div>
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: phaseColor, background: `${phaseColor}15`, padding: '3px 10px', borderRadius: 20, border: `1px solid ${phaseColor}30` }}>
                          Day {daysElapsed}
                        </div>
                      </div>
                      <div style={{ padding: '16px 20px' }}>
                        {/* Two pay-off options */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                          <div style={{ padding: '12px 14px', borderRadius: 12, background: daysElapsed <= 15 ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)', border: `1px solid ${daysElapsed <= 15 ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
                            <div style={{ fontSize: 10, color: '#4B5580', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Early Pay-off (by Day 15)</div>
                            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 18, color: daysElapsed <= 15 ? '#22C55E' : '#EF4444' }}>₱{day15Total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
                            <div style={{ fontSize: 10, color: '#4B5580', marginTop: 2 }}>{day15Date ? fmt(day15Date) : '—'} · No extension fee</div>
                          </div>
                          <div style={{ padding: '12px 14px', borderRadius: 12, background: daysElapsed <= 30 ? 'rgba(245,158,11,0.06)' : 'rgba(239,68,68,0.08)', border: `1px solid ${daysElapsed <= 30 ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.3)'}` }}>
                            <div style={{ fontSize: 10, color: '#4B5580', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Max Term (by Day 30)</div>
                            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 18, color: '#F59E0B' }}>₱{(principal + dailyInterest * 30 + extensionFee).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
                            <div style={{ fontSize: 10, color: '#4B5580', marginTop: 2 }}>{day30Date ? fmt(day30Date) : '—'} + ₱100 ext. fee</div>
                          </div>
                        </div>
                        {/* Live balance */}
                        <div style={{ padding: '12px 14px', borderRadius: 10, background: `${phaseColor}08`, border: `1px solid ${phaseColor}25`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                          <div>
                            <div style={{ fontSize: 11, color: '#4B5580', marginBottom: 2 }}>Total Owed Right Now</div>
                            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 22, color: phaseColor }}>₱{totalOwedNow.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 10, color: '#4B5580' }}>Principal</div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#F0F4FF' }}>₱{principal.toLocaleString('en-PH')}</div>
                            <div style={{ fontSize: 10, color: '#4B5580', marginTop: 2 }}>+ ₱{accruedNow.toFixed(2)} interest</div>
                            {extensionFee > 0 && <div style={{ fontSize: 10, color: '#F59E0B' }}>+ ₱100 ext. fee</div>}
                            {penalty > 0 && <div style={{ fontSize: 10, color: '#EF4444' }}>+ ₱{penalty} penalty</div>}
                          </div>
                        </div>
                        {/* Upload proof button */}
                        {(loan.status === 'Active' || loan.status === 'Partially Paid') && (
                          hasProof
                            ? <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', fontSize: 12, color: '#F59E0B', fontWeight: 600, textAlign: 'center' }}>⏳ Payment proof pending admin review</div>
                            : <button onClick={() => setUploadModal(1)} className="upload-btn"
                                style={{ width: '100%', padding: '11px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#22C55E,#16a34a)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Syne, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                ⬆ Upload Pay-Off Proof
                              </button>
                        )}
                      </div>
                    </div>
                  )
                })()
              ) : (
                // ── Installment: regular schedule ──
                <div className="pc" style={{ background: '#0E1320', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, overflow: 'hidden', marginBottom: 16 }}>
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>📅</div>
                    <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15, color: '#F0F4FF' }}>Payment Schedule</div>
                  </div>
                  <div style={{ padding: '8px 0' }}>
                    {(() => {
                      const numInst = loan.num_installments || 4
                      const dueDates = getDueDates(loan.release_date, loan.payments_made || 0, numInst)
                      return dueDates.map((due, i) => {
                        const isPaid = due.paid
                        const isCurrent = due.current
                        const hasProof = proofs.some(p => p.loan_id === loan.id && p.installment_number === due.num && p.status === 'Pending')
                        const instAmt = Math.ceil(Number(loan.installment_amount))
                        return (
                          <div key={i} className="inst-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 20px', borderBottom: i < dueDates.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none', background: isCurrent ? 'rgba(99,102,241,0.04)' : 'transparent' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <div style={{ width: 32, height: 32, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: isPaid ? 14 : 12, fontWeight: 700, background: isPaid ? 'rgba(34,197,94,0.12)' : isCurrent ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.04)', border: `1px solid ${isPaid ? 'rgba(34,197,94,0.25)' : isCurrent ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.06)'}`, color: isPaid ? '#22C55E' : isCurrent ? '#a78bfa' : '#4B5580' }}>
                                {isPaid ? '✓' : due.num}
                              </div>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: isPaid ? '#22C55E' : isCurrent ? '#F0F4FF' : '#7A8AAA' }}>Installment {due.num} — ₱{instAmt.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
                                <div style={{ fontSize: 11, color: isPaid ? 'rgba(34,197,94,0.6)' : '#4B5580', marginTop: 1 }}>Due: {due.date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              {hasProof && <span style={{ fontSize: 11, color: '#F59E0B', fontWeight: 600, background: 'rgba(245,158,11,0.1)', padding: '3px 8px', borderRadius: 6 }}>⏳ Pending</span>}
                              {isCurrent && !hasProof && (loan.status === 'Active' || loan.status === 'Partially Paid') && (
                                <button onClick={() => setUploadModal(due.num)} className="upload-btn"
                                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg,#22C55E,#16a34a)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Syne, sans-serif' }}>
                                  ⬆ Upload Proof
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })
                    })()}
                  </div>
                </div>
              )}

              <PenaltySection loanId={loan.id} supabase={supabase} />

              {/* Loan Disclosure */}
              {(() => {
                const principal = Number(loan.loan_amount)
                const isQL = loan.loan_type === 'quickloan'

                if (isQL) {
                  // ── QuickLoan disclosure ──
                  const dailyInterest = parseFloat((principal * 0.1 / 30).toFixed(2))
                  const daysElapsed = loan.release_date
                    ? Math.max(0, Math.floor((new Date() - new Date(loan.release_date)) / (1000 * 60 * 60 * 24)))
                    : 0
                  const accruedNow = parseFloat((dailyInterest * daysElapsed).toFixed(2))
                  const extensionFee = loan.extension_fee_charged ? 100 : 0
                  const penaltyDays = Math.max(0, daysElapsed - 30)
                  const penalty = penaltyDays * 25
                  const totalOwedNow = parseFloat((principal + accruedNow + extensionFee + penalty).toFixed(2))
                  const day15Interest = parseFloat((dailyInterest * 15).toFixed(2))
                  const day15Total = parseFloat((principal + day15Interest).toFixed(2))
                  const releaseDate = loan.release_date ? (() => { const [y, m, d] = loan.release_date.split('-').map(Number); return new Date(y, m - 1, d) })() : null
                  const day15Date = releaseDate ? new Date(releaseDate.getTime() + 15 * 86400000) : null
                  const day30Date = releaseDate ? new Date(releaseDate.getTime() + 30 * 86400000) : null
                  const fmt = d => d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
                  const phase = daysElapsed > 30 ? 'penalty' : daysElapsed > 15 ? 'extended' : 'active'
                  const phaseColor = phase === 'penalty' ? '#EF4444' : phase === 'extended' ? '#F59E0B' : '#22C55E'

                  return (
                    <div className="pc" style={{ background: '#0E1320', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 18, overflow: 'hidden', marginBottom: 16 }}>
                      <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, color: '#F59E0B' }}>⚡ Loan Disclosure</div>
                        <div style={{ fontSize: 10, color: '#4B5580', textTransform: 'uppercase', letterSpacing: '0.07em' }}>RA 3765 — Truth in Lending Act</div>
                      </div>
                      <div style={{ padding: '14px 20px' }}>
                        {[
                          { label: 'Approved Loan Amount', value: '₱' + principal.toLocaleString('en-PH', { minimumFractionDigits: 2 }), color: '#F0F4FF' },
                          { label: 'Security Hold', value: 'None — full amount released', color: '#22C55E' },
                          { label: 'Funds Released to You', value: '₱' + principal.toLocaleString('en-PH', { minimumFractionDigits: 2 }), color: '#22C55E' },
                          { label: 'Daily Interest Rate', value: `0.3333%/day  (₱${dailyInterest.toFixed(2)}/day)`, color: '#60A5FA' },
                          { label: 'Monthly Interest Rate', value: '10% per month', color: '#60A5FA' },
                          { label: 'Effective Rate (per annum)', value: '120% p.a. (RA 3765)', color: '#a78bfa' },
                          { label: 'If paid on Day 15', value: '₱' + day15Total.toLocaleString('en-PH', { minimumFractionDigits: 2 }), color: '#22C55E' },
                          { label: 'Extension Fee (if Day 15 missed)', value: '₱100.00 one-time', color: '#F59E0B' },
                          { label: 'Penalty after Day 30', value: '₱25.00/day (no cap)', color: '#EF4444' },
                        ].map((row, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent', borderRadius: 8, gap: 12 }}>
                            <span style={{ fontSize: 12, color: '#7A8AAA', flex: 1 }}>{row.label}</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: row.color, textAlign: 'right' }}>{row.value}</span>
                          </div>
                        ))}

                        {/* Live balance box */}
                        <div style={{ marginTop: 12, padding: '12px 14px', background: phase === 'penalty' ? 'rgba(239,68,68,0.06)' : phase === 'extended' ? 'rgba(245,158,11,0.06)' : 'rgba(34,197,94,0.06)', border: `1px solid ${phase === 'penalty' ? 'rgba(239,68,68,0.2)' : phase === 'extended' ? 'rgba(245,158,11,0.2)' : 'rgba(34,197,94,0.2)'}`, borderRadius: 10 }}>
                          <div style={{ fontSize: 10, color: '#4B5580', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Live Balance Today (Day {daysElapsed})</div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontSize: 12, color: '#7A8AAA' }}>Principal</span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#F0F4FF' }}>₱{principal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontSize: 12, color: '#7A8AAA' }}>Accrued Interest ({daysElapsed} days)</span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#a78bfa' }}>₱{accruedNow.toFixed(2)}</span>
                          </div>
                          {extensionFee > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                              <span style={{ fontSize: 12, color: '#7A8AAA' }}>Extension Fee</span>
                              <span style={{ fontSize: 12, fontWeight: 700, color: '#F59E0B' }}>₱100.00</span>
                            </div>
                          )}
                          {penalty > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                              <span style={{ fontSize: 12, color: '#7A8AAA' }}>Penalty ({penaltyDays} days × ₱25)</span>
                              <span style={{ fontSize: 12, fontWeight: 700, color: '#EF4444' }}>₱{penalty.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                            </div>
                          )}
                          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: 4 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#F0F4FF' }}>Total Owed Now</span>
                            <span style={{ fontSize: 16, fontWeight: 800, color: phaseColor, fontFamily: 'Syne, sans-serif' }}>₱{totalOwedNow.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                          </div>
                        </div>

                        {/* Day 15 / Day 30 timeline */}
                        {releaseDate && (
                          <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <div style={{ flex: 1, padding: '8px 10px', background: daysElapsed <= 15 ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)', border: `1px solid ${daysElapsed <= 15 ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`, borderRadius: 8 }}>
                              <div style={{ fontSize: 10, color: '#4B5580', marginBottom: 2 }}>Day 15 Target</div>
                              <div style={{ fontSize: 12, fontWeight: 700, color: daysElapsed <= 15 ? '#22C55E' : '#EF4444' }}>{day15Date ? fmt(day15Date) : '—'}</div>
                              <div style={{ fontSize: 10, color: '#4B5580', marginTop: 2 }}>{daysElapsed <= 15 ? `${15 - daysElapsed} day${15 - daysElapsed !== 1 ? 's' : ''} left` : 'Missed'}</div>
                            </div>
                            <div style={{ flex: 1, padding: '8px 10px', background: daysElapsed <= 30 ? 'rgba(245,158,11,0.06)' : 'rgba(239,68,68,0.08)', border: `1px solid ${daysElapsed <= 30 ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.3)'}`, borderRadius: 8 }}>
                              <div style={{ fontSize: 10, color: '#4B5580', marginBottom: 2 }}>Day 30 Deadline</div>
                              <div style={{ fontSize: 12, fontWeight: 700, color: daysElapsed <= 30 ? '#F59E0B' : '#EF4444' }}>{day30Date ? fmt(day30Date) : '—'}</div>
                              <div style={{ fontSize: 10, color: '#4B5580', marginTop: 2 }}>{daysElapsed <= 30 ? `${30 - daysElapsed} day${30 - daysElapsed !== 1 ? 's' : ''} left` : 'PAST DEADLINE'}</div>
                            </div>
                          </div>
                        )}
                      </div>
                      <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.04)', display: 'flex', gap: 10 }}>
                        {!loan.e_signature_name ? (
                          <button onClick={() => setShowSignModal(true)}
                            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#F59E0B,#D97706)', color: '#000', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Syne, sans-serif' }}>
                            ✍ Sign QuickLoan Agreement
                          </button>
                        ) : (
                          <button onClick={() => generateQuickLoanAgreementPDF()}
                            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px', borderRadius: 10, border: '1px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.06)', color: '#F59E0B', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                            ↓ Download QuickLoan Agreement
                          </button>
                        )}
                      </div>
                    </div>
                  )
                }

                // ── Installment loan disclosure ──
                const holdAmt = loan.security_hold ? Number(loan.security_hold) : principal * 0.10
                const holdRate = principal > 0 ? ((holdAmt / principal) * 100).toFixed(0) : 10
                const total = Number(loan.total_repayment)
                const perInst = Math.ceil(Number(loan.installment_amount))
                const numInstallments = loan.num_installments || 4
                const flatRate = ((loan.interest_rate || 0.07) * 100).toFixed(0)
                const effectiveAnnual = ((loan.interest_rate || 0.07) * 12 * 100).toFixed(0)
                const released = loan.funds_released ? Number(loan.funds_released) : principal - holdAmt
                return (
                  <div className="pc" style={{ background: '#0E1320', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 18, overflow: 'hidden', marginBottom: 16 }}>
                    <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, color: '#F0F4FF' }}>Loan Disclosure</div>
                      <div style={{ fontSize: 10, color: '#4B5580', textTransform: 'uppercase', letterSpacing: '0.07em' }}>RA 3765 — Truth in Lending Act</div>
                    </div>
                    <div style={{ padding: '14px 20px' }}>
                      {[
                        { label: 'Approved Loan Amount', value: '₱' + principal.toLocaleString('en-PH', { minimumFractionDigits: 2 }), color: '#F0F4FF' },
                        { label: 'Security Hold (' + holdRate + '%)', value: '₱' + holdAmt.toLocaleString('en-PH', { minimumFractionDigits: 2 }), color: '#F59E0B' },
                        { label: 'Funds Released to You', value: '₱' + released.toLocaleString('en-PH', { minimumFractionDigits: 2 }), color: '#22C55E' },
                        { label: 'Finance Charge', value: '₱' + (total - principal).toLocaleString('en-PH', { minimumFractionDigits: 2 }), color: '#F59E0B' },
                        { label: 'Monthly Interest Rate', value: flatRate + '% per month × ' + (loan.loan_term || 2) + ' months', color: '#60A5FA' },
                        { label: 'Effective Interest Rate (per annum)', value: effectiveAnnual + '% p.a.', color: '#a78bfa' },
                        { label: 'Total Amount Payable', value: '₱' + total.toLocaleString('en-PH', { minimumFractionDigits: 2 }), color: '#22C55E' },
                        { label: 'Number of Installments', value: numInstallments + ' payments every 5th and 20th of the month', color: '#F0F4FF' },
                        { label: 'Per Installment Amount', value: '₱' + perInst.toLocaleString('en-PH', { minimumFractionDigits: 2 }), color: '#F0F4FF' },
                      ].map((row, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent', borderRadius: 8, gap: 12 }}>
                          <span style={{ fontSize: 12, color: '#7A8AAA', flex: 1 }}>{row.label}</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: row.color, textAlign: 'right' }}>{row.value}</span>
                        </div>
                      ))}
                      {loan.security_hold_returned && (
                        <div style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, fontSize: 11, color: '#22C55E', fontWeight: 700 }}>
                          ✅ Security Hold of ₱{Number(loan.security_hold).toLocaleString('en-PH', { minimumFractionDigits: 2 })} has been returned to your Rebate Credits
                        </div>
                      )}
                    </div>
                    <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.04)', display: 'flex', gap: 10 }}>
                      {!loan.e_signature_name ? (
                        <button onClick={() => setShowSignModal(true)}
                          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#6366F1,#8B5CF6)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Syne, sans-serif' }}>
                          ✍ Sign Loan Agreement
                        </button>
                      ) : (
                        <button onClick={() => generateLoanAgreementPDF()}
                          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px', borderRadius: 10, border: '1px solid rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.06)', color: '#a78bfa', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                          ↓ Download Loan Agreement
                        </button>
                      )}
                    </div>
                  </div>
                )
              })()}

            </div>{/* end left */}

            {/* ── RIGHT SIDEBAR ── */}
            <div className="portal-sidebar" style={{ display: 'flex', flexDirection: 'column', gap: 14, position: 'sticky', top: 76 }}>

              {/* Borrower / Road to VIP card */}
              <div className="pc" style={{ background: 'linear-gradient(135deg,#0E1320,#160e30)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 20, padding: 22, boxShadow: '0 10px 30px -10px rgba(0,0,0,0.5)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 14, background: 'linear-gradient(135deg,#3B82F6,#8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 900, color: '#fff', flexShrink: 0, fontFamily: 'Syne, sans-serif', boxShadow: '0 4px 12px rgba(139,92,246,0.3)' }}>
                    {borrower.full_name?.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 14, color: '#F0F4FF', letterSpacing: '-0.01em' }}>{borrower.full_name}</div>
                    <div style={{ fontSize: 11, color: '#4B5580', marginTop: 1 }}>{borrower.department}</div>
                  </div>
                </div>

                {/* Quick Action Ribbon with Tooltips */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                  {[
                    { icon: <Clock size={16} />, page: 'payment-history', label: 'History', color: '#22C55E' },
                    { icon: <User size={16} />, page: 'profile', label: 'My Profile', color: '#3B82F6' },
                    { icon: <Wallet size={16} />, page: 'wallet', label: 'Wallet', color: '#F59E0B' },
                    { icon: <CreditCard size={16} />, page: 'payment-methods', label: 'Repay Now', color: '#8B5CF6' },
                  ].map((item, i) => (
                    <button key={i} onClick={() => setPage(item.page)} className="ribbon-btn" data-label={item.label}
                      style={{ 
                        flex: 1, height: 42, borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', 
                        background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                        color: item.color, cursor: 'pointer', outline: 'none'
                      }}>
                      {item.icon}
                      <div style={{ position: 'absolute', bottom: 0, left: '20%', right: '20%', height: 2, background: item.color, opacity: 0.4, borderRadius: '2px 2px 0 0' }} />
                    </button>
                  ))}
                </div>

                {(() => {
                  const score = borrower.credit_score || 750
                  const currentBadge = getBadgeConfig(borrower.loyalty_badge || 'New')
                  const nextBadgeIdx = BADGE_TIERS.findIndex(b => b.id === currentBadge.id) + 1
                  const nextBadge = BADGE_TIERS[nextBadgeIdx] || null
                  
                  const scorePct = ((score - 300) / 700) * 100

                  return (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', marginBottom: 16 }}>
                        <span style={{ fontSize: 18 }}>{currentBadge.emoji}</span>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 800, color: currentBadge.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{currentBadge.label}</div>
                          <div style={{ fontSize: 11, color: '#4B5580' }}>Current Status</div>
                        </div>
                      </div>

                      {nextBadge ? (
                        <div style={{ marginTop: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: '#CBD5F0' }}>Road to {nextBadge.label}</span>
                              <span style={{ fontSize: 12 }}>{nextBadge.emoji}</span>
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 800, color: nextBadge.color }}>{nextBadge.minScore - score} pts left</span>
                          </div>
                          <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden', marginBottom: 12 }}>
                            <div style={{ 
                              height: '100%', 
                              width: Math.min(100, Math.max(5, ((score - currentBadge.minScore) / (nextBadge.minScore - currentBadge.minScore)) * 100)) + '%', 
                              background: `linear-gradient(90deg, ${currentBadge.color}, ${nextBadge.color})`, 
                              borderRadius: 3, 
                              transition: 'width 1s ease' 
                            }} />
                          </div>
                          <div style={{ padding: '10px', background: `${nextBadge.color}08`, border: `1px solid ${nextBadge.color}15`, borderRadius: 10 }}>
                            <div style={{ fontSize: 9, color: nextBadge.color, textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.05em', marginBottom: 4 }}>Next Perk Unlocked</div>
                            <div style={{ fontSize: 11, color: '#CBD5F0', lineHeight: 1.4 }}>{nextBadge.desc}</div>
                          </div>
                        </div>
                      ) : (
                        <div style={{ padding: '12px', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 12, textAlign: 'center' }}>
                          <div style={{ fontSize: 14, fontWeight: 800, color: '#8B5CF6' }}>👑 Maximum Rank!</div>
                          <div style={{ fontSize: 11, color: '#a78bfa', marginTop: 4 }}>You've earned all VIP benefits.</div>
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>

              {/* Visual Payment Calendar (Sidebar) */}
              <div className="pc" style={{ background: '#0E1320', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, overflow: 'hidden' }}>
                <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.01)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Calendar size={13} style={{ color: '#4B5580' }} />
                      <span style={{ fontSize: 10, color: '#4B5580', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800 }}>Payment Schedule</span>
                    </div>
                    <span style={{ fontSize: 9, color: '#7A8AAA', background: 'rgba(255,255,255,0.05)', padding: '1px 6px', borderRadius: 4 }}>{new Date().toLocaleDateString('en-PH', { month: 'short' })}</span>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => (
                      <div key={d} style={{ textAlign: 'center', fontSize: 9, color: '#4B5580', fontWeight: 800, paddingBottom: 4 }}>{d}</div>
                    ))}
                    {(() => {
                      const now = new Date()
                      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).getDay()
                      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
                      const items = []
                      for (let i = 0; i < firstDay; i++) items.push(<div key={`p-${i}`} />)
                      for (let d = 1; d <= daysInMonth; d++) {
                        const isPayDay = d === 5 || d === 20
                        const isToday = d === now.getDate()
                        items.push(
                          <div key={d} style={{ 
                            aspectRatio: '1', 
                            display: 'flex', alignItems: 'center', justifyContent: 'center', 
                            fontSize: 10, borderRadius: 6,
                            background: isPayDay ? (isToday ? '#22C55E' : 'rgba(99,102,241,0.12)') : isToday ? 'rgba(255,255,255,0.06)' : 'transparent',
                            border: isPayDay ? `1px solid ${isToday ? '#22C55E' : 'rgba(99,102,241,0.25)'}` : 'none',
                            color: isPayDay ? '#F0F4FF' : isToday ? '#F0F4FF' : '#4B5580',
                            fontWeight: isPayDay || isToday ? 800 : 400,
                            position: 'relative'
                          }}>
                            {d}
                            {isPayDay && <div style={{ position: 'absolute', bottom: 1, width: 2, height: 2, borderRadius: '50%', background: '#8B5CF6' }} />}
                          </div>
                        )
                      }
                      return items
                    })()}
                  </div>
                </div>
              </div>


              {/* Smart Rebate Calculator */}
              <div className="pc" style={{ background: 'linear-gradient(135deg,#0E1320,#081c10)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 16, padding: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(34,197,94,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#22C55E' }}>
                    <CreditCard size={14} />
                  </div>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 13, color: '#F0F4FF', letterSpacing: '0.01em' }}>Rebate Calculator</div>
                </div>
                <div style={{ fontSize: 11, color: '#7A8AAA', marginBottom: 14, lineHeight: 1.5 }}>
                  Pay off your full balance early to earn a **1% rebate** on your principal!
                </div>
                {(() => {
                  const principal = Number(loan.loan_amount)
                  const rebate = principal * 0.01
                  const totalRepay = Number(loan.total_repayment) || (principal * 1.14) // default if missing
                  const savings = rebate // For now just the rebate, interest savings would be separate
                  return (
                    <div style={{ padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                        <span style={{ fontSize: 11, color: '#4B5580' }}>Potential Rebate</span>
                        <span style={{ fontSize: 14, fontWeight: 900, color: '#22C55E', fontFamily: 'Syne, sans-serif' }}>+₱{rebate.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '8px 0' }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                        <span style={{ fontSize: 11, color: '#4B5580' }}>Est. Total Savings</span>
                        <span style={{ fontSize: 14, fontWeight: 900, color: '#60A5FA', fontFamily: 'Syne, sans-serif' }}>₱{rebate.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <button onClick={() => setPage('payment-methods')} style={{ width: '100%', marginTop: 14, padding: '9px', borderRadius: 10, border: '1px solid rgba(34,197,94,0.3)', background: 'rgba(34,197,94,0.06)', color: '#22C55E', fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}>
                        Pay Early Now →
                      </button>
                    </div>
                  )
                })()}
              </div>

              {/* Need Help */}
              <div className="pc" style={{ background: '#0E1320', border: '1px solid rgba(59,130,246,0.12)', borderRadius: 16, padding: 14 }}>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 12, color: '#F0F4FF', marginBottom: 10 }}>❓ Need Help?</div>
                <div style={{ fontSize: 11, color: '#7A8AAA', marginBottom: 12, lineHeight: 1.6 }}>Questions about your loan, payments, or schedule? Our admin team is here to help.</div>
                <a href="/contact" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 9, background: 'linear-gradient(135deg,rgba(59,130,246,0.1),rgba(139,92,246,0.1))', border: '1px solid rgba(139,92,246,0.25)', color: '#a78bfa', textDecoration: 'none', fontSize: 12, fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif' }}>
                  💬 Contact Us →
                </a>
              </div>

              <a href="/faq" className="pc nav-btn" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px', background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 14, textDecoration: 'none' }}>
                <img src="/faq.png" alt="faq" style={{ width: 14, height: 14, objectFit: 'contain' }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: '#a78bfa', flex: 1 }}>View FAQ & Privacy Notice</span>
                <span style={{ color: '#4B5580' }}>›</span>
              </a>

            </div>{/* end sidebar */}
          </div>
        )}
      </div>

      {showSignModal && loan && (
        <SignatureModal borrower={borrower} loan={loan} onSave={handleSaveSignature} onClose={() => setShowSignModal(false)} />
      )}
      {uploadModal && (
        <UploadModal installmentNum={uploadModal} loan={loan} borrower={borrower} onClose={() => setUploadModal(null)} onUploaded={handleUploaded} />
      )}
    </div>
  )
}
