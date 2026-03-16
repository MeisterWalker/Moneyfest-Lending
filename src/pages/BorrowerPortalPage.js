import { useState, useEffect, useCallback, useRef } from 'react'
import { CREDIT_CONFIG, BADGE_TIERS, SECURITY_HOLD_TIERS, getBadgeConfig, getBadgeFromScore, getSecurityHoldRate } from '../lib/creditSystem'
import { supabase } from '../lib/supabase'
import {
  Lock, CheckCircle, Clock, AlertCircle, Upload,
  FileText, Calendar, CreditCard, ChevronDown, ChevronUp, X
} from 'lucide-react'

function formatDate(str) {
  if (!str) return "—"
  const [y, m, d] = str.split('-')
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })
}

function getDueDates(releaseDate, paymentsMade) {
  if (!releaseDate) return []
  const [y, m, d] = releaseDate.split('-').map(Number)
  const release = new Date(y, m - 1, d)
  const dates = []
  for (let i = 1; i <= 4; i++) {
    const cutoff = new Date(release)
    if (release.getDate() <= 5) {
      cutoff.setMonth(cutoff.getMonth() + Math.floor((i - 1) / 2))
      cutoff.setDate(i % 2 === 1 ? 20 : 5)
    } else {
      cutoff.setMonth(cutoff.getMonth() + Math.ceil(i / 2))
      cutoff.setDate(i % 2 === 1 ? 5 : 20)
    }
    dates.push({
      num: i,
      date: cutoff,
      dateStr: cutoff.getFullYear() + '-' + String(cutoff.getMonth() + 1).padStart(2, '0') + '-' + String(cutoff.getDate()).padStart(2, '0'),
      paid: i <= paymentsMade,
      current: i === paymentsMade + 1
    })
  }
  return dates
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
    <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.color}40`, borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 700 }}>
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

    // Guard: check if proof already exists for this installment
    const { data: existing } = await supabase
      .from('payment_proofs')
      .select('id, status')
      .eq('loan_id', loan.id)
      .eq('installment_number', installmentNum)
      .single()

    if (existing) {
      if (existing.status === 'Pending') {
        setError('You already submitted proof for this installment. Please wait for admin confirmation.')
        setUploading(false)
        return
      }
      if (existing.status === 'Confirmed') {
        setError('This installment has already been confirmed by the admin.')
        setUploading(false)
        return
      }
      // If Rejected — delete old record and allow re-upload
      await supabase.from('payment_proofs').delete().eq('id', existing.id)
    }

    setUploading(true)
    setError('')

    const ext = file.name.split('.').pop()
    const path = `${borrower.id}/${loan.id}/installment-${installmentNum}-${Date.now()}.${ext}`

    const { error: uploadErr } = await supabase.storage
      .from('payment-proofs')
      .upload(path, file, { contentType: file.type, upsert: false })

    if (uploadErr) { setError('Upload failed: ' + uploadErr.message); setUploading(false); return }

    const { error: dbErr } = await supabase.from('payment_proofs').insert({
      borrower_id: borrower.id,
      loan_id: loan.id,
      installment_number: installmentNum,
      file_path: path,
      file_name: file.name,
      notes: notes || null,
      status: 'Pending'
    })

    if (dbErr) { setError('Saved file but failed to record: ' + dbErr.message); setUploading(false); return }

    setUploading(false)
    onUploaded()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20 }}>
      <div style={{ background: '#141B2D', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 420 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 16, color: '#F0F4FF' }}>
            Upload Payment Proof
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 10, padding: '10px 14px', marginBottom: 18, fontSize: 13, color: '#8B5CF6', fontWeight: 600 }}>
          Installment {installmentNum} of 4 — ₱{Number(loan.installment_amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Payment Screenshot or Receipt *
          </label>
          <label style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 8, padding: '24px 16px', borderRadius: 10,
            border: `2px dashed ${file ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.1)'}`,
            background: file ? 'rgba(34,197,94,0.04)' : 'rgba(255,255,255,0.02)',
            cursor: 'pointer', transition: 'all 0.2s'
          }}>
            <Upload size={22} color={file ? '#22C55E' : 'rgba(255,255,255,0.3)'} />
            <span style={{ fontSize: 13, color: file ? '#22C55E' : 'var(--text-muted)' }}>
              {file ? file.name : 'Click to choose file (JPG, PNG, PDF)'}
            </span>
            <input type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={e => setFile(e.target.files[0])} />
          </label>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="e.g. Paid via GCash, ref# 12345..."
            rows={2}
            style={{ width: '100%', background: '#0B0F1A', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#F0F4FF', fontSize: 13, padding: '10px 12px', resize: 'none', fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box' }}
          />
        </div>

        {error && <div style={{ fontSize: 12, color: '#EF4444', marginBottom: 14, padding: '8px 12px', background: 'rgba(239,68,68,0.08)', borderRadius: 8 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '11px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: 'var(--text-muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={handleUpload} disabled={uploading || !file} style={{ flex: 2, padding: '11px', borderRadius: 9, border: 'none', background: uploading || !file ? 'rgba(139,92,246,0.3)' : 'linear-gradient(135deg,#3B82F6,#8B5CF6)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: uploading || !file ? 'not-allowed' : 'pointer' }}>
            {uploading ? 'Uploading...' : 'Submit Proof'}
          </button>
        </div>
      </div>


    </div>
  )
}

function PenaltySection({ loanId, supabase }) {
  const [penalties, setPenalties] = useState([])
  useEffect(() => {
    if (!loanId) return
    supabase.from('penalty_charges').select('*')
      .eq('loan_id', loanId).order('created_at', { ascending: false })
      .then(({ data }) => setPenalties(data || []))
  }, [loanId])

  if (penalties.length === 0) return null

  const total = penalties.reduce((sum, p) => sum + Number(p.penalty_amount), 0)
  return (
    <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 16, padding: 20, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src="/warning.png" alt="penalty" style={{ width: 16, height: 16, objectFit: 'contain' }} />
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 14, color: '#F0F4FF' }}>Late Payment Penalties</div>
        </div>
        <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 15, color: '#EF4444' }}>
          Total: ₱{total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {penalties.map((p, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(239,68,68,0.05)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.1)' }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#F0F4FF' }}>Installment {p.installment_number} — {p.days_late} day{p.days_late > 1 ? 's' : ''} late</div>
              <div style={{ fontSize: 11, color: '#7A8AAA', marginTop: 2 }}>₱{p.penalty_per_day}/day{p.cap_applied ? ' · cap applied' : ''} · {new Date(p.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
            </div>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 14, color: '#EF4444' }}>₱{Number(p.penalty_amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12, fontSize: 11, color: '#7A8AAA', lineHeight: 1.6 }}>
        Penalties are charged at ₱20/day per installment, capped at 20% of the installment amount. Settle penalties directly with your admin.
      </div>
    </div>
  )
}

function LottieHourglass() {
  const ref = useRef(null)
  const animRef = useRef(null)

  useEffect(() => {
    const initAnim = () => {
      if (!ref.current || !window.lottie) return
      // Destroy previous if any
      if (animRef.current) { animRef.current.destroy(); animRef.current = null }
      animRef.current = window.lottie.loadAnimation({
        container: ref.current,
        renderer: 'svg',
        loop: true,
        autoplay: true,
        path: '/gold_hourglass.json'
      })
    }

    if (window.lottie) {
      initAnim()
    } else {
      // Check if script already loading
      const existing = document.querySelector('script[data-lottie]')
      if (existing) {
        existing.addEventListener('load', initAnim)
      } else {
        const script = document.createElement('script')
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie.min.js'
        script.setAttribute('data-lottie', 'true')
        script.onload = initAnim
        document.head.appendChild(script)
      }
    }

    return () => {
      if (animRef.current) { animRef.current.destroy(); animRef.current = null }
    }
  }, [])

  return <div ref={ref} style={{ width: 90, height: 90, margin: '0 auto' }} />
}

// ── E-Signature Modal ─────────────────────────────────────────
function SignatureModal({ borrower, loan, onSave, onClose }) {
  const [typedName, setTypedName] = useState('')
  const [signing, setSigning] = useState(false)
  const [signed, setSigned] = useState(false)
  const canvasRef = useRef(null)
  const drawing = useRef(false)
  const lastPos = useRef(null)

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if (e.touches) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY
      }
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    }
  }

  const startDraw = (e) => {
    e.preventDefault()
    drawing.current = true
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const pos = getPos(e, canvas)
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
    lastPos.current = pos
  }

  const draw = (e) => {
    e.preventDefault()
    if (!drawing.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const pos = getPos(e, canvas)
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#111827'
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    lastPos.current = pos
  }

  const endDraw = () => { drawing.current = false }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }

  const handleSave = async () => {
    if (!typedName.trim()) return
    setSigning(true)
    const canvas = canvasRef.current
    const signatureImage = canvas.toDataURL('image/png')
    await onSave({ typedName: typedName.trim(), signatureImage, signedAt: new Date().toISOString() })
    setSigned(true)
    setSigning(false)
  }

  const nameMatches = typedName.trim().toLowerCase() === (borrower.full_name || '').toLowerCase()

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20 }}>
      <div style={{ background: '#141B2D', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: 28, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 16, color: '#F0F4FF' }}>E-Signature</div>
            <div style={{ fontSize: 11, color: '#4B5580', marginTop: 2 }}>Sign your Loan Agreement</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4B5580', fontSize: 18 }}>✕</button>
        </div>

        {signed ? (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 16, color: '#22C55E', marginBottom: 8 }}>Signature Saved!</div>
            <div style={{ fontSize: 13, color: '#7A8AAA', marginBottom: 20 }}>Your loan agreement has been signed. You can now download it.</div>
            <button onClick={onClose} style={{ padding: '10px 28px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#22C55E,#16A34A)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              Close & Download
            </button>
          </div>
        ) : (
          <>
            {/* Loan summary */}
            <div style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.18)', borderRadius: 12, padding: '12px 16px', marginBottom: 20, fontSize: 12, color: '#7A8AAA', lineHeight: 1.7 }}>
              By signing, you confirm you have read and agree to the loan terms: <strong style={{ color: '#F0F4FF' }}>₱{Number(loan.loan_amount).toLocaleString('en-PH')} loan</strong> at <strong style={{ color: '#F0F4FF' }}>{((loan.interest_rate || 0.07) * 100).toFixed(0)}% flat interest</strong>, repayable in <strong style={{ color: '#F0F4FF' }}>4 installments</strong> of <strong style={{ color: '#60A5FA' }}>₱{Number(loan.installment_amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong> each.
            </div>

            {/* Step 1 — Type name */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#7A8AAA', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                Step 1 — Type your full name exactly as registered
              </div>
              <input
                value={typedName}
                onChange={e => setTypedName(e.target.value)}
                placeholder={borrower.full_name}
                style={{ width: '100%', background: '#0B0F1A', border: `1px solid ${nameMatches && typedName ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 10, color: nameMatches && typedName ? '#22C55E' : '#F0F4FF', fontSize: 15, fontFamily: 'Caveat, cursive', padding: '12px 14px', boxSizing: 'border-box', outline: 'none', transition: 'border-color 0.2s' }}
              />
              {typedName && !nameMatches && (
                <div style={{ fontSize: 11, color: '#EF4444', marginTop: 5 }}>⚠️ Name must exactly match: <strong>{borrower.full_name}</strong></div>
              )}
              {nameMatches && typedName && (
                <div style={{ fontSize: 11, color: '#22C55E', marginTop: 5 }}>✅ Name verified</div>
              )}
            </div>

            {/* Step 2 — Draw signature */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#7A8AAA', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Step 2 — Draw your signature below
                </div>
                <button onClick={clearCanvas} style={{ fontSize: 11, color: '#4B5580', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Clear</button>
              </div>
              <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(99,102,241,0.2)', background: '#F8F9FA' }}>
                {/* Typed name watermark */}
                {typedName && (
                  <div style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', fontSize: 13, color: 'rgba(99,102,241,0.2)', fontFamily: 'Caveat, cursive', pointerEvents: 'none', whiteSpace: 'nowrap', letterSpacing: 1 }}>
                    {typedName}
                  </div>
                )}
                {/* Signature line */}
                <div style={{ position: 'absolute', bottom: 32, left: 20, right: 20, height: 1, background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
                <canvas
                  ref={canvasRef}
                  width={460}
                  height={150}
                  style={{ width: '100%', height: 150, display: 'block', cursor: 'crosshair', touchAction: 'none' }}
                  onMouseDown={startDraw}
                  onMouseMove={draw}
                  onMouseUp={endDraw}
                  onMouseLeave={endDraw}
                  onTouchStart={startDraw}
                  onTouchMove={draw}
                  onTouchEnd={endDraw}
                />
              </div>
              <div style={{ fontSize: 11, color: '#4B5580', marginTop: 5 }}>Draw using your mouse or touchscreen. Your typed name appears as a watermark.</div>
            </div>

            {/* Sign button */}
            <button
              onClick={handleSave}
              disabled={!nameMatches || signing}
              style={{ width: '100%', padding: '13px', borderRadius: 12, border: 'none', background: nameMatches ? 'linear-gradient(135deg,#3B82F6,#8B5CF6)' : 'rgba(255,255,255,0.06)', color: nameMatches ? '#fff' : '#4B5580', fontSize: 14, fontWeight: 700, cursor: nameMatches ? 'pointer' : 'not-allowed', fontFamily: 'Space Grotesk', transition: 'all 0.2s' }}>
              {signing ? 'Saving signature...' : <><img src='/digital-signature.png' alt='sign' style={{ width: 16, height: 16, objectFit: 'contain' }} /> Sign Loan Agreement</>}
            </button>

            <div style={{ fontSize: 11, color: '#4B5580', textAlign: 'center', marginTop: 10, lineHeight: 1.6 }}>
              By signing, you acknowledge full understanding of the loan terms and agree to be bound by them. This serves as your electronic signature under the E-Commerce Act (RA 8792).
            </div>
          </>
        )}
      </div>
    </div>
  )
}


export default function BorrowerPortalPage() {
  const [code, setCode] = useState('')
  const [inputCode, setInputCode] = useState('')
  const [borrower, setBorrower] = useState(null)
  const [loan, setLoan] = useState(null)
  const [proofs, setProofs] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [uploadModal, setUploadModal] = useState(null)
  const [showSignModal, setShowSignModal] = useState(false)
  const [signatureData, setSignatureData] = useState(null) // base64 canvas drawing
  const [typedName, setTypedName] = useState('')
  const [signatureSaved, setSignatureSaved] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [page, setPage] = useState('home') // 'home' | 'payment-methods' | 'profile' | 'payment-history' | 'wallet'
  const [rebateCredits, setRebateCredits] = useState(null)
  const [creditTxns, setCreditTxns] = useState([])
  const [withdrawing, setWithdrawing] = useState(false)
  const [pendingApp, setPendingApp] = useState(null)
  const [allLoans, setAllLoans] = useState([])
  const [notifications, setNotifications] = useState([])
  const [showNotifs, setShowNotifs] = useState(false)

  const fetchPortalData = useCallback(async (accessCode) => {
    setLoading(true)
    setError('')
    const cleanCode = accessCode.toUpperCase().trim()

    // First check approved borrowers
    const { data: b } = await supabase
      .from('borrowers')
      .select('*')
      .eq('access_code', cleanCode)
      .single()

    if (b) {
      const { data: allL } = await supabase
        .from('loans')
        .select('*')
        .eq('borrower_id', b.id)
        .order('created_at', { ascending: false })

      const { data: p } = await supabase
        .from('payment_proofs')
        .select('*')
        .eq('borrower_id', b.id)
        .order('created_at', { ascending: false })

      let { data: notifs } = await supabase
        .from('portal_notifications')
        .select('*')
        .eq('borrower_id', b.id)
        .order('created_at', { ascending: false })
        .limit(20)

      setBorrower(b)
      setAllLoans(allL || [])
      setLoan(allL?.[0] || null)
      setProofs(p || [])
      // Check for upcoming due dates — notify if within 2 days and not already notified today
      const activeLoans = (allL || []).filter(l => l.status === 'Active')
      for (const activeLoan of activeLoans) {
        if (!activeLoan.release_date) continue
        const [yr, mo, dy] = activeLoan.release_date.split('-').map(Number)
        const releaseDate = new Date(yr, mo - 1, dy)
        const today = new Date(); today.setHours(0,0,0,0)
        const paid = activeLoan.payments_made || 0
        // Generate next due date
        for (let i = paid; i < 4; i++) {
          const due = new Date(releaseDate)
          if (releaseDate.getDate() <= 5) {
            due.setMonth(due.getMonth() + Math.floor(i / 2))
            due.setDate(i % 2 === 0 ? 20 : 5)
          } else {
            due.setMonth(due.getMonth() + Math.ceil((i + 1) / 2))
            due.setDate(i % 2 === 0 ? 5 : 20)
          }
          const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24))
          if (diffDays >= 0 && diffDays <= 2) {
            // Check if we already sent this notif recently (within last 3 days)
            const alreadyNotified = (notifs || []).some(n =>
              n.type === 'due_soon' &&
              new Date(n.created_at) > new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
            )
            if (!alreadyNotified) {
              const msg = diffDays === 0
                ? `Installment ${i + 1} of ₱${Number(activeLoan.installment_amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })} is due TODAY. Please submit your payment proof.`
                : `Installment ${i + 1} of ₱${Number(activeLoan.installment_amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })} is due in ${diffDays} day${diffDays > 1 ? 's' : ''} (${due.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}). Don't forget to pay!`
              const { data: newNotif } = await supabase.from('portal_notifications').insert({
                borrower_id: b.id, type: 'due_soon',
                title: diffDays === 0 ? '⏰ Payment Due Today!' : '⏰ Payment Due Soon',
                message: msg
              }).select().single()
              if (newNotif) notifs = [...(notifs || []), newNotif]
            }
          }
          break // only check the next upcoming installment
        }
      }

      setNotifications(notifs || [])

      // Fetch Rebate Credits balance
      const { data: creditsData } = await supabase
        .from('wallets').select('*').eq('borrower_id', b.id).single()
      const { data: txnData } = await supabase
        .from('wallet_transactions').select('*').eq('borrower_id', b.id)
        .order('created_at', { ascending: false }).limit(20)
      setRebateCredits(creditsData || null)
      setCreditTxns(txnData || [])

      setLoading(false)
      return
    }

    // Check pending/rejected applications
    const { data: app } = await supabase
      .from('applications')
      .select('*')
      .eq('access_code', cleanCode)
      .single()

    if (app) {
      setPendingApp(app)
      setLoading(false)
      return
    }

    setError('Invalid access code. Please check and try again.')
    setLoading(false)
  }, [])

  // Auto-restore session on page refresh
  useEffect(() => {
    const saved = localStorage.getItem('lm_portal_code')
    if (saved) {
      setCode(saved)
      setInputCode(saved)
      fetchPortalData(saved)
    }
  }, [fetchPortalData])

  const handleLogin = async () => {
    if (!inputCode.trim()) { setError('Please enter your access code'); return }
    setCode(inputCode)
    localStorage.setItem('lm_portal_code', inputCode.toUpperCase().trim())
    await fetchPortalData(inputCode)
  }

  const handleUploaded = () => {
    setUploadModal(null)
    setUploadSuccess(true)
    fetchPortalData(code)
    setTimeout(() => setUploadSuccess(false), 5000)
  }

  const handleSaveSignature = async ({ typedName, signatureImage, signedAt }) => {
    // Store signature on the LOAN record (not borrower) so each loan has its own fresh signature
    await supabase.from('loans').update({
      e_signature_name: typedName,
      e_signature_image: signatureImage,
      e_signature_date: signedAt,
      agreement_confirmed: true
    }).eq('id', loan.id)
    // Also keep on borrower for PDF generation reference
    await supabase.from('borrowers').update({
      e_signature_name: typedName,
      e_signature_image: signatureImage,
      e_signature_date: signedAt
    }).eq('id', borrower.id)
    setLoan(prev => ({ ...prev, e_signature_name: typedName, e_signature_image: signatureImage, e_signature_date: signedAt, agreement_confirmed: true }))
    setBorrower(prev => ({ ...prev, e_signature_name: typedName, e_signature_image: signatureImage, e_signature_date: signedAt }))
    setSignatureSaved(true)
    setShowSignModal(false)
    // Auto-trigger download after signing
    setTimeout(() => generateLoanAgreementPDF(typedName, signatureImage, signedAt), 500)
  }

  const generateLoanAgreementPDF = (sigName, sigImage, sigDate) => {
    const name = sigName || borrower.e_signature_name || borrower.full_name
    const img = sigImage || borrower.e_signature_image
    const date = sigDate || borrower.e_signature_date || new Date().toISOString()
    const principal = Number(loan.loan_amount)
    const holdAmt = loan.security_hold ? Number(loan.security_hold) : principal * 0.10
    const holdRate = principal > 0 ? ((holdAmt / principal) * 100).toFixed(0) : 10
    const released = loan.funds_released ? Number(loan.funds_released) : principal - holdAmt
    const total = Number(loan.total_repayment)
    const perInst = Number(loan.installment_amount)
    const rate = ((loan.interest_rate || 0.07) * 100).toFixed(0)
    const signedDateStr = new Date(date).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
    const releaseDateStr = loan.release_date ? new Date(loan.release_date).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }) : 'TBD'

    // Generate payment schedule using same logic as getDueDates()
    const dueDatesForPDF = getDueDates(loan.release_date, loan.payments_made || 0)
    const maturityDate = dueDatesForPDF.length >= 4
      ? dueDatesForPDF[3].date.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
      : 'TBD'
    const scheduleRows = dueDatesForPDF.map((due, i) => {
      return `<tr style="background:${due.paid ? '#f0fdf4' : i % 2 === 0 ? '#fafafa' : '#fff'}">
        <td style="padding:5px 8px;border:1px solid #e5e7eb;text-align:center;font-weight:600;">${due.num}</td>
        <td style="padding:5px 8px;border:1px solid #e5e7eb;">${due.date.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
        <td style="padding:5px 8px;border:1px solid #e5e7eb;text-align:right;font-weight:600;">₱${perInst.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
        <td style="padding:5px 8px;border:1px solid #e5e7eb;text-align:center;color:${due.paid ? '#16a34a' : '#9CA3AF'}">${due.paid ? '✓ Paid' : 'Pending'}</td>
      </tr>`
    }).join('')

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<style>
  @import url('https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,600;0,700;1,400&family=Caveat:wght@600&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'EB Garamond',Georgia,serif; color:#111827; background:#fff; font-size:12px; line-height:1.6; }
  @media print { @page { size:A4; margin:15mm 18mm; } .page-break { page-break-before:always; } }
  .page { padding:36px 44px; }
  .page2 { padding:36px 44px; }
  .header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2.5px solid #1e1b4b; padding-bottom:14px; margin-bottom:20px; }
  .logo { font-size:24px; font-weight:700; letter-spacing:-0.5px; }
  .logo span { color:#6366F1; }
  .doc-meta { text-align:right; font-size:10.5px; color:#6B7280; line-height:1.7; }
  .two-col { display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:18px; }
  .section { margin-bottom:18px; }
  .section-title { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:1.5px; color:#4338CA; border-bottom:1.5px solid #E5E7EB; padding-bottom:5px; margin-bottom:10px; }
  .row { display:flex; justify-content:space-between; align-items:center; padding:4px 0; border-bottom:1px solid #F3F4F6; font-size:11.5px; }
  .row .lbl { color:#6B7280; }
  .row .val { font-weight:600; color:#111827; text-align:right; }
  .schedule-table { width:100%; border-collapse:collapse; font-size:11.5px; margin-bottom:0; }
  .schedule-table th { background:#1e1b4b; color:#fff; padding:7px 10px; text-align:left; font-size:10.5px; text-transform:uppercase; letter-spacing:0.5px; }
  .schedule-table td { padding:6px 10px; border:1px solid #E5E7EB; }
  .tc-item { font-size:11.5px; color:#374151; margin-bottom:10px; line-height:1.65; }
  .tc-item strong { color:#111827; }
  .sig-grid { display:grid; grid-template-columns:1fr 1fr; gap:48px; margin-top:32px; padding-top:0; }
  .sig-col { display:flex; flex-direction:column; }
  .sig-label { font-size:9.5px; font-weight:700; color:#6B7280; text-transform:uppercase; letter-spacing:1.2px; margin-bottom:12px; }
  .sig-image-box { height:72px; display:flex; align-items:flex-end; margin-bottom:0; }
  .sig-line { border-bottom:1.5px solid #374151; margin-bottom:6px; }
  .sig-name { font-size:22px; font-style:italic; font-family:'Caveat',cursive; color:#111827; margin-bottom:4px; line-height:1.2; }
  .sig-sub { font-size:10px; color:#9CA3AF; line-height:1.5; }
  .disclaimer { font-size:9.5px; color:#9CA3AF; margin-top:28px; padding-top:12px; border-top:1px solid #E5E7EB; line-height:1.6; }
  .page2-header { display:flex; justify-content:space-between; align-items:center; border-bottom:1.5px solid #E5E7EB; padding-bottom:10px; margin-bottom:20px; font-size:10px; color:#9CA3AF; }
</style>
</head>
<body>

<!-- ═══ PAGE 1 ═══ -->
<div class="page">

  <!-- HEADER -->
  <div class="header">
    <div>
      <div class="logo">Moneyfest<span>Lending</span></div>
      <div style="font-size:10.5px;color:#6B7280;margin-top:3px;">Private Lending Program — Loan Agreement</div>
    </div>
    <div class="doc-meta">
      <div><strong>Ref:</strong> LM-\${borrower.id?.slice(-6).toUpperCase()}</div>
      <div><strong>Date Signed:</strong> \${signedDateStr}</div>
      <div><strong>Maturity Date:</strong> <span style="color:#D97706;font-weight:700;">\${maturityDate}</span></div>
    </div>
  </div>

  <!-- PARTIES -->
  <div class="two-col">
    <div class="section">
      <div class="section-title">Parties to this Agreement</div>
      <div class="row"><span class="lbl">Borrower</span><span class="val">\${borrower.full_name}</span></div>
      <div class="row"><span class="lbl">Department</span><span class="val">\${borrower.department || 'N/A'}</span></div>
      <div class="row"><span class="lbl">Access Code</span><span class="val">\${borrower.access_code}</span></div>
      <div class="row"><span class="lbl">Lender</span><span class="val">MoneyfestLending</span></div>
      <div class="row"><span class="lbl">Release Date</span><span class="val">\${releaseDateStr}</span></div>
      <div class="row"><span class="lbl">Maturity Date</span><span class="val" style="color:#D97706;font-weight:700;">\${maturityDate}</span></div>
    </div>

    <!-- RA 3765 -->
    <div class="section">
      <div class="section-title">RA 3765 — Truth in Lending Act Disclosure</div>
      <div class="row"><span class="lbl">Approved Loan Amount</span><span class="val">₱\${principal.toLocaleString('en-PH',{minimumFractionDigits:2})}</span></div>
      <div class="row"><span class="lbl">Security Hold (\${holdRate}%)</span><span class="val">₱\${holdAmt.toLocaleString('en-PH',{minimumFractionDigits:2})}</span></div>
      <div class="row"><span class="lbl">Funds Released to Borrower</span><span class="val">₱\${released.toLocaleString('en-PH',{minimumFractionDigits:2})}</span></div>
      <div class="row"><span class="lbl">Finance Charge (Interest)</span><span class="val">₱\${(total-principal).toLocaleString('en-PH',{minimumFractionDigits:2})}</span></div>
      <div class="row"><span class="lbl">Flat Interest Rate</span><span class="val">\${rate}% of principal (one-time)</span></div>
      <div class="row"><span class="lbl">Effective Annual Rate</span><span class="val">\${((total-principal)/principal/2*12*100).toFixed(2)}% per annum</span></div>
      <div class="row"><span class="lbl">Total Amount Payable</span><span class="val" style="color:#1e1b4b;font-size:13px;">₱\${total.toLocaleString('en-PH',{minimumFractionDigits:2})}</span></div>
      <div class="row"><span class="lbl">Per Installment Amount</span><span class="val">₱\${perInst.toLocaleString('en-PH',{minimumFractionDigits:2})}</span></div>
    </div>
  </div>

  <!-- PAYMENT SCHEDULE -->
  <div class="section">
    <div class="section-title">Payment Schedule & Maturity Date</div>
    <table class="schedule-table">
      <thead>
        <tr>
          <th style="width:8%">#</th>
          <th style="width:42%">Due Date</th>
          <th style="width:28%;text-align:right">Amount Due</th>
          <th style="width:22%;text-align:center">Status</th>
        </tr>
      </thead>
      <tbody>
        \${scheduleRows}
      </tbody>
      <tfoot>
        <tr style="background:#1e1b4b;">
          <td colspan="2" style="padding:7px 10px;border:1px solid #374151;color:#fff;font-weight:700;font-size:11.5px;">📌 Loan Maturity — Final Payment Due</td>
          <td style="padding:7px 10px;border:1px solid #374151;color:#FCD34D;font-weight:700;text-align:right;">₱\${perInst.toLocaleString('en-PH',{minimumFractionDigits:2})}</td>
          <td style="padding:7px 10px;border:1px solid #374151;color:#FCD34D;text-align:center;font-weight:700;">\${maturityDate}</td>
        </tr>
      </tfoot>
    </table>
  </div>

</div>

<!-- ═══ PAGE 2 ═══ -->
<div class="page-break"></div>
<div class="page2">

  <!-- Page 2 mini header -->
  <div class="page2-header">
    <div><strong style="color:#1e1b4b;">MoneyfestLending</strong> — Loan Agreement (continued)</div>
    <div>Ref: LM-\${borrower.id?.slice(-6).toUpperCase()} · \${borrower.full_name}</div>
  </div>

  <!-- TERMS & CONDITIONS — full width -->
  <div class="section">
    <div class="section-title">Terms & Conditions</div>
    <p class="tc-item">1. <strong>Interest</strong> — A flat interest rate of \${rate}% is charged on the full approved loan amount. This charge applies regardless of early settlement or prepayment of any installment.</p>
    <p class="tc-item">2. <strong>Security Hold</strong> — \${holdRate}% of the approved loan amount is withheld upon fund release as a Security Hold. Late payment penalties are automatically deducted from the Security Hold balance. The remaining Security Hold balance is returned to the Borrower's Rebate Credits upon full payment of the 4th installment.</p>
    <p class="tc-item">3. <strong>Late Payment Penalties</strong> — A penalty of ₱20.00 per calendar day is charged for each day an installment remains unpaid past its due date (5th or 20th of the month). The total penalty per installment is capped at 10% of the installment amount. Each late payment also results in a deduction of 10 points from the Borrower's credit score.</p>
    <p class="tc-item">4. <strong>Default</strong> — Failure to pay two (2) or more consecutive installments constitutes a loan default. Upon default, the remaining balance becomes immediately due and payable. A credit score deduction of 150 points is applied and the Borrower's account will be flagged as High Risk.</p>
    <p class="tc-item">5. <strong>Rebate Credits & Early Payment Incentive</strong> — If the Borrower pays the 4th (final) installment at least 1 day before its due date, a fixed rebate of 1% of the original loan amount is credited to their Rebate Credits balance. The rebate rate is fixed at 1% regardless of how many days early payment is made. Rebates are credited automatically by the system.</p>
    <p class="tc-item">6. <strong>Data Privacy</strong> — The Borrower's personal information is collected and processed solely for the administration of this loan in compliance with Republic Act No. 10173 (Data Privacy Act of 2012). Data will not be shared with third parties without consent except as required by law.</p>
    <p class="tc-item">7. <strong>Governing Law</strong> — This agreement shall be governed by the laws of the Republic of the Philippines. Any dispute arising from this agreement shall be resolved amicably between the parties before any formal legal action is taken.</p>
  </div>

  <!-- SIGNATURES -->
  <div class="section" style="margin-top:32px;">
    <div class="section-title">Electronic Signatures — RA 8792 (E-Commerce Act)</div>
    <p style="font-size:11px;color:#6B7280;margin-bottom:24px;line-height:1.6;">By affixing their electronic signature below, both parties confirm they have read, understood, and agreed to all terms and conditions set forth in this Loan Agreement.</p>

    <div class="sig-grid">
      <!-- Borrower -->
      <div class="sig-col">
        <div class="sig-label">Borrower E-Signature</div>
        <div class="sig-image-box">
          \${img ? '<img src="' + img + '" style="height:68px;max-width:240px;display:block;" />' : '<div style="height:68px;"></div>'}
        </div>
        <div class="sig-line"></div>
        <div class="sig-name">\${name}</div>
        <div class="sig-sub">\${name}</div>
        <div class="sig-sub">Signed electronically on \${signedDateStr}</div>
        <div class="sig-sub" style="margin-top:3px;">Pursuant to RA 8792 — E-Commerce Act of the Philippines</div>
      </div>

      <!-- Admin -->
      <div class="sig-col">
        <div class="sig-label">Admin / Authorized Representative</div>
        <div class="sig-image-box">
          <div style="height:68px;"></div>
        </div>
        <div class="sig-line"></div>
        <div style="height:28px;margin-bottom:4px;"></div>
        <div class="sig-sub">MoneyfestLending Administration</div>
        <div class="sig-sub">Authorized Representative</div>
        <div class="sig-sub" style="margin-top:3px;">Date: ___________________________</div>
      </div>
    </div>
  </div>

  <div class="disclaimer">
    This Loan Agreement is executed in compliance with Republic Act No. 3765 (Truth in Lending Act), Republic Act No. 10173 (Data Privacy Act of 2012), and Republic Act No. 8792 (Electronic Commerce Act of 2000). The electronic signature affixed herein constitutes a valid and binding signature under RA 8792 and has the same legal effect as a handwritten signature. This document is private and confidential. MoneyfestLending is a private colleague lending program and is not a bank, quasi-bank, or BSP-supervised financial institution. This document is for the exclusive use of the named parties only.
  </div>

</div>
</body>
</html>`

        const win = window.open('', '_blank')
    if (win) {
      win.document.write(html)
      win.document.close()
      win.focus()
      setTimeout(() => { win.print(); }, 800)
    }
  }

  const markAllRead = async () => {
    const unread = notifications.filter(n => !n.is_read).map(n => n.id)
    if (unread.length === 0) return
    await supabase.from('portal_notifications').update({ is_read: true }).in('id', unread)
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
  }

  const dueDates = loan ? getDueDates(loan.release_date, loan.payments_made || 0) : []
  const progressPct = loan ? ((loan.payments_made || 0) / 4) * 100 : 0

  // Pending / Rejected application screen
  if (pendingApp && !borrower) return (
    <div style={{ minHeight: '100vh', background: '#0B0F1A', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: 'DM Sans, sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 460 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <img src="/favicon-96x96.png" alt="MoneyfestLending" style={{ width: 48, height: 48, objectFit: 'contain', marginBottom: 10 }} />
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 24, color: '#F0F4FF' }}>
            Moneyfest<span style={{ background: 'linear-gradient(90deg,#60a5fa,#a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Lending</span>
          </div>
        </div>

        <div style={{ background: '#141B2D', border: `1px solid ${pendingApp.status === 'Rejected' ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.25)'}`, borderRadius: 16, padding: 28 }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>{pendingApp.status === 'Rejected' ? "❌" : "⏳"}</div>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 20, color: pendingApp.status === 'Rejected' ? '#EF4444' : '#F59E0B', marginBottom: 8 }}>
              {pendingApp.status === 'Rejected' ? 'Application Not Approved' : 'Application Under Review'}
            </div>
            <div style={{ fontSize: 14, color: '#7A8AAA', lineHeight: 1.7 }}>
              {pendingApp.status === 'Rejected'
                ? 'Unfortunately your application was not approved at this time.'
                : 'Your application has been received and is currently being reviewed by our admin.'}
            </div>
          </div>

          {/* Application summary */}
          <div style={{ background: '#0B0F1A', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '14px 18px', marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: '#4B5580', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}><span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><img src="/list.png" alt="info" style={{ width: 13, height: 13, objectFit: 'contain', marginRight: 5, verticalAlign: 'middle' }} />Application Details</span></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: '#4B5580' }}>Name</span>
                <span style={{ color: '#F0F4FF', fontWeight: 600 }}>{pendingApp.full_name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: '#4B5580' }}>Amount Requested</span>
                <span style={{ color: '#F0F4FF', fontWeight: 600 }}>P{Number(pendingApp.loan_amount).toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: '#4B5580' }}>Submitted</span>
                <span style={{ color: '#F0F4FF', fontWeight: 600 }}>{new Date(pendingApp.created_at).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: '#4B5580' }}>Status</span>
                <span style={{ fontWeight: 700, color: pendingApp.status === 'Rejected' ? '#EF4444' : '#F59E0B' }}>{pendingApp.status}</span>
              </div>
              {pendingApp.status === 'Rejected' && pendingApp.reject_reason && (
                <div style={{ marginTop: 4, padding: '8px 12px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 8, fontSize: 12, color: '#EF4444' }}>
                  Reason: {pendingApp.reject_reason}
                </div>
              )}
            </div>
          </div>

          {/* Contact / instructions */}
          {pendingApp.status !== 'Rejected' && (
            <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 10, padding: '14px 16px', marginBottom: 20, fontSize: 13, color: '#8892B0', lineHeight: 1.8 }}>
              📧 <strong style={{ color: '#CBD5F0' }}>Please check your email</strong> from time to time for updates on your application.<br/>
              For follow-ups, contact the following admins via <strong style={{ color: '#F0F4FF' }}>Microsoft Teams Chat</strong>:
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { initials: 'JP', name: 'John Paul Lacaron', gradient: 'linear-gradient(135deg,#3B82F6,#8B5CF6)' },
              { initials: 'CJ', name: 'Charlou June Ramil', gradient: 'linear-gradient(135deg,#14B8A6,#3B82F6)' },
            ].map(a => (
              <div key={a.name} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '10px 14px' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: a.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#fff', flexShrink: 0 }}>{a.initials}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#F0F4FF' }}>{a.name}</div>
                  <div style={{ fontSize: 11, color: '#4B5580' }}>Admin - Teams Chat</div>
                </div>
              </div>
            ))}
          </div>

          <button onClick={() => { setPendingApp(null); setInputCode(''); setCode('') }}
            style={{ width: '100%', marginTop: 20, padding: '11px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: 'var(--text-muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            Back
          </button>
        </div>
      </div>
    </div>
  )

  // Login screen
  if (!borrower) return (
    <div style={{ minHeight: '100vh', background: '#0B0F1A', fontFamily: 'DM Sans, sans-serif' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg,#0d1226,#141B2D)', borderBottom: '1px solid rgba(139,92,246,0.2)', padding: '18px 28px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src="/favicon-96x96.png" alt="MoneyfestLending" style={{ width: 44, height: 44, objectFit: 'contain' }} />
            <div>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 20, color: '#F0F4FF' }}>
                Moneyfest<span style={{ background: 'linear-gradient(90deg,#60a5fa,#a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Lending</span>
              </div>
              <div style={{ fontSize: 11, color: '#4B5580', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Borrower Portal</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <a href="/apply" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 9, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', color: '#22C55E', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
              <img src="/startup.png" alt="launch" style={{ width: 14, height: 14, objectFit: 'contain', marginRight: 5 }} />Apply
            </a>
            <a href="/faq" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 9, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: '#7A8AAA', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
              <img src="/faq.png" alt="faq" style={{ width: 14, height: 14, objectFit: 'contain', marginRight: 5, verticalAlign: 'middle' }} />FAQ
            </a>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, minHeight: 'calc(100vh - 69px)' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <img src="/favicon-96x96.png" alt="MoneyfestLending" style={{ width: 56, height: 56, objectFit: 'contain', marginBottom: 12 }} />
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 28, color: '#F0F4FF', letterSpacing: -1 }}>
            Moneyfest<span style={{ background: 'linear-gradient(90deg,#60a5fa,#a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Lending</span>
          </div>
          <div style={{ fontSize: 13, color: '#4B5580', marginTop: 4 }}>Borrower Portal</div>
        </div>

        <div style={{ background: '#141B2D', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4 }}>
              <img src="/padlock.png" alt="access" style={{ width: 24, height: 24, objectFit: 'contain' }} />
            </div>
            <div>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 15, color: '#F0F4FF' }}>Enter Access Code</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Check your approval email for your code</div>
            </div>
          </div>

          <input
            value={inputCode}
            onChange={e => setInputCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="e.g. LM-A4B2"
            maxLength={7}
            style={{
              width: '100%', boxSizing: 'border-box', padding: '13px 16px',
              background: '#0B0F1A', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 10, color: '#F0F4FF', fontSize: 18, fontWeight: 800,
              fontFamily: 'monospace', letterSpacing: 6, textAlign: 'center',
              marginBottom: 14, outline: 'none'
            }}
          />

          {error && (
            <div style={{ fontSize: 13, color: '#EF4444', marginBottom: 14, padding: '10px 14px', background: 'rgba(239,68,68,0.08)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertCircle size={14} /> {error}
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={loading}
            style={{ width: '100%', padding: '13px', borderRadius: 10, border: 'none', background: loading ? 'rgba(139,92,246,0.3)' : 'linear-gradient(135deg,#3B82F6,#8B5CF6)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'Space Grotesk' }}
          >
            {loading ? 'Checking...' : <><img src="/startup.png" alt="launch" style={{ width: 16, height: 16, objectFit: 'contain', marginRight: 7 }} />Access My Loan</>}
          </button>

          <div style={{ marginTop: 18, padding: '12px 14px', background: 'rgba(59,130,246,0.06)', borderRadius: 8, fontSize: 12, color: '#4B5580', lineHeight: 1.6 }}>
            💡 Your access code was sent to your email when your loan was approved. Contact <strong style={{ color: '#7A8AAA' }}>John Paul Lacaron</strong> or <strong style={{ color: '#7A8AAA' }}>Charlou June Ramil</strong> via Teams if you need help.
          </div>
        </div>

      </div>
      </div>
    </div>
  )

  // Payment Methods page
  // ── PROFILE PAGE ──────────────────────────────────────────────
  if (borrower && page === 'profile') return (
    <div style={{ minHeight: '100vh', background: '#0B0F1A', fontFamily: 'DM Sans, sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg,#0d1226,#141B2D)', borderBottom: '1px solid rgba(139,92,246,0.2)', padding: '16px 24px' }}>
        <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 16, color: '#F0F4FF' }}>
          Moneyfest<span style={{ background: 'linear-gradient(90deg,#60a5fa,#a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Lending</span>
          <span style={{ fontFamily: 'DM Sans', fontWeight: 400, fontSize: 13, color: '#4B5580', marginLeft: 8 }}>· My Profile</span>
        </div>
      </div>
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '36px 28px 24px' }}>
              {/* Floating back button */}
      <div style={{ position: 'relative', maxWidth: 860, margin: '0 auto', padding: '0 28px' }}>
        <div style={{ position: 'absolute', top: -16, left: 20, zIndex: 10 }}>
          <button onClick={() => setPage('home')} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'linear-gradient(135deg,#141B2D,#1a1040)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 20, padding: '5px 14px', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
            <span style={{ fontSize: 13, color: '#a78bfa' }}>←</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa' }}>Back to Home</span>
          </button>
        </div>
      </div>
        {/* Avatar + Name */}
        <div style={{ background: '#141B2D', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 24, marginBottom: 16, textAlign: 'center' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg,#3B82F6,#8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 900, color: '#fff', margin: '0 auto 14px', fontFamily: 'Space Grotesk' }}>
            {borrower.full_name?.charAt(0).toUpperCase()}
          </div>
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 20, color: '#F0F4FF', marginBottom: 4 }}>{borrower.full_name}</div>
          <div style={{ fontSize: 13, color: '#7A8AAA', marginBottom: 12 }}>{borrower.department}</div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: getBadgeConfig(borrower.loyalty_badge || 'New').bg, border: '1px solid ' + getBadgeConfig(borrower.loyalty_badge || 'New').border, borderRadius: 20, padding: '4px 14px' }}>
            <span style={{ fontSize: 14 }}>
              {getBadgeConfig(borrower.loyalty_badge || 'New').emoji}
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: getBadgeConfig(borrower.loyalty_badge || 'New').color }}>{getBadgeConfig(borrower.loyalty_badge || 'New').label}</span>
          </div>
        </div>

        {/* Credit Score */}
        <div style={{ background: '#141B2D', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 24, marginBottom: 16 }}>
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 14, color: '#F0F4FF', marginBottom: 16 }}>Credit Score</div>
          {(() => {
            const score = borrower.credit_score || 750
            const pct = ((score - CREDIT_CONFIG.MIN_SCORE) / (CREDIT_CONFIG.MAX_SCORE - CREDIT_CONFIG.MIN_SCORE)) * 100
            const label = CREDIT_CONFIG.labelFromScore(score)
            const color = CREDIT_CONFIG.colorFromScore(score)
            return (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 }}>
                  <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 48, color, lineHeight: 1 }}>{score}</div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color }}>{label}</div>
                    <div style={{ fontSize: 11, color: '#4B5580' }}>out of 850</div>
                  </div>
                </div>
                <div style={{ height: 10, background: '#1E2640', borderRadius: 5, overflow: 'hidden', marginBottom: 8 }}>
                  <div style={{ height: '100%', width: pct + '%', background: `linear-gradient(90deg,#EF4444,#F59E0B,#22C55E)`, borderRadius: 5, transition: 'width 1s ease' }} />
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
          const msg = tier.perk
          return (
            <div style={{ background: '#141B2D', border: `1px solid ${tier.color}33`, borderRadius: 16, padding: '16px 20px', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 14, color: '#F0F4FF' }}>Security Hold Tier</div>
                <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 22, color: tier.color }}>{(tier.rate * 100).toFixed(0)}%</div>
              </div>
              <div style={{ fontSize: 12, color: '#8892B0', lineHeight: 1.7, marginBottom: 12 }}>{msg}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                {[
                  { label: 'High Risk', rate: '20%', minScore: '< 600', color: '#EF4444' },
                  { label: 'Caution',   rate: '15%', minScore: '600+',  color: '#F97316' },
                  { label: 'Standard',  rate: '10%', minScore: '750+',  color: '#7A8AAA' },
                  { label: 'Trusted',   rate: '8%',  minScore: '700+',  color: '#60A5FA' },
                  { label: 'Reliable',  rate: '6%',  minScore: '750+',  color: '#34D399' },
                  { label: 'VIP',       rate: '5%',  minScore: '1000',  color: '#8B5CF6' },
                ].map((t, i) => {
                  const isActive = tier.label === t.label
                  return (
                    <div key={i} style={{ padding: '7px 10px', borderRadius: 8, background: isActive ? t.color + '22' : 'rgba(255,255,255,0.02)', border: `1px solid ${isActive ? t.color + '66' : 'rgba(255,255,255,0.05)'}`, textAlign: 'center' }}>
                      <div style={{ fontSize: 12, fontWeight: isActive ? 800 : 600, color: isActive ? t.color : '#4B5580' }}>{t.rate}</div>
                      <div style={{ fontSize: 10, color: isActive ? t.color : '#4B5580', marginTop: 2 }}>{t.label}</div>
                      <div style={{ fontSize: 9, color: '#4B5580', marginTop: 1 }}>{t.minScore}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}

        {/* Loan Limit Level */}
        <div style={{ background: '#141B2D', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 24, marginBottom: 16 }}>
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 14, color: '#F0F4FF', marginBottom: 16 }}>Loan Limit Level</div>
          <div className="portal-loan-level-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 16 }}>
            {[
              { level: 1, amount: 'P5,000', loans: 0 },
              { level: 2, amount: 'P7,000', loans: 1 },
              { level: 3, amount: 'P9,000', loans: 2 },
              { level: 4, amount: 'P10,000', loans: 3 },
            ].map(l => {
              const current = (borrower.loan_limit_level || 1) === l.level
              const unlocked = (borrower.loan_limit_level || 1) >= l.level
              return (
                <div key={l.level} style={{ background: current ? 'rgba(139,92,246,0.15)' : unlocked ? 'rgba(34,197,94,0.07)' : 'rgba(255,255,255,0.02)', border: `1px solid ${current ? 'rgba(139,92,246,0.4)' : unlocked ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.05)'}`, borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: current ? '#8B5CF6' : unlocked ? '#22C55E' : '#4B5580', marginBottom: 4 }}>LVL {l.level}</div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: current ? '#F0F4FF' : unlocked ? '#CBD5F0' : '#4B5580' }}>{l.amount}</div>
                  {current && <div style={{ fontSize: 9, color: '#8B5CF6', marginTop: 3 }}>Current</div>}
                  {!current && unlocked && <div style={{ fontSize: 9, color: '#22C55E', marginTop: 3 }}>Unlocked</div>}
                  {!unlocked && <div style={{ fontSize: 9, color: '#4B5580', marginTop: 3 }}>{l.loans} clean loans</div>}
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: 10 }}>
            <div style={{ fontSize: 13, color: '#7A8AAA' }}>Current Limit</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#22C55E' }}>P{Number(borrower.loan_limit || 5000).toLocaleString()}</div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: 10, marginTop: 6 }}>
            <div style={{ fontSize: 13, color: '#7A8AAA' }}>Clean Loans Completed</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#8B5CF6' }}>{borrower.clean_loans || 0} of 3 needed for max</div>
          </div>
        </div>

        {/* Personal Details */}
        <div style={{ background: '#141B2D', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 24 }}>
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 14, color: '#F0F4FF', marginBottom: 16 }}><span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><img src="/list.png" alt="info" style={{ width: 13, height: 13, objectFit: 'contain', marginRight: 5, verticalAlign: 'middle' }} />Personal Details</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'Email', value: borrower.email },
              { label: 'Phone', value: borrower.phone },
              { label: 'Department', value: borrower.department },
              { label: 'Tenure', value: borrower.tenure_years ? borrower.tenure_years + ' years' : 'N/A' },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: 9 }}>
                <span style={{ fontSize: 12, color: '#4B5580' }}>{item.label}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#F0F4FF' }}>{item.value || 'N/A'}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  )

  // ── PAYMENT HISTORY PAGE ───────────────────────────────────────
  if (borrower && page === 'payment-history') return (
    <div style={{ minHeight: '100vh', background: '#0B0F1A', fontFamily: 'DM Sans, sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg,#0d1226,#141B2D)', borderBottom: '1px solid rgba(59,130,246,0.2)', padding: '16px 24px' }}>
        <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 16, color: '#F0F4FF' }}>
          Moneyfest<span style={{ background: 'linear-gradient(90deg,#60a5fa,#a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Lending</span>
          <span style={{ fontFamily: 'DM Sans', fontWeight: 400, fontSize: 13, color: '#4B5580', marginLeft: 8 }}>· Payment History</span>
        </div>
      </div>
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '36px 28px 24px' }}>
              {/* Floating back button */}
      <div style={{ position: 'relative', maxWidth: 860, margin: '0 auto', padding: '0 28px' }}>
        <div style={{ position: 'absolute', top: -16, left: 20, zIndex: 10 }}>
          <button onClick={() => setPage('home')} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'linear-gradient(135deg,#141B2D,#1a1040)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 20, padding: '5px 14px', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
            <span style={{ fontSize: 13, color: '#a78bfa' }}>←</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa' }}>Back to Home</span>
          </button>
        </div>
      </div>
        {allLoans.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 18, color: '#F0F4FF', marginBottom: 8 }}>No Payment History</div>
            <div style={{ fontSize: 14, color: '#7A8AAA' }}>Your confirmed payments will appear here.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {allLoans.map((l, li) => {
              const confirmedProofs = proofs.filter(p => p.loan_id === l.id && p.status === 'Confirmed')
              const loanDate = new Date(l.created_at).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })
              return (
                <div key={l.id} style={{ background: '#141B2D', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, overflow: 'hidden' }}>
                  {/* Loan header */}
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 14, color: '#F0F4FF' }}>
                        Loan #{allLoans.length - li} — P{Number(l.loan_amount).toLocaleString()}
                      </div>
                      <div style={{ fontSize: 11, color: '#4B5580', marginTop: 2 }}>{loanDate}</div>
                    </div>
                    <div style={{ padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                      background: l.status === 'Completed' ? 'rgba(34,197,94,0.1)' : l.status === 'Active' ? 'rgba(59,130,246,0.1)' : 'rgba(139,92,246,0.1)',
                      color: l.status === 'Completed' ? '#22C55E' : l.status === 'Active' ? '#3B82F6' : '#8B5CF6'
                    }}>{l.status}</div>
                  </div>

                  {/* Summary row */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 1, background: 'rgba(255,255,255,0.03)' }}>
                    {[
                      { label: 'Total Repayment', value: 'P' + Number(l.total_repayment).toLocaleString('en-PH', { minimumFractionDigits: 2 }) },
                      { label: 'Payments Made', value: `${l.payments_made || 0} of 4` },
                      { label: 'Remaining', value: 'P' + Number(l.remaining_balance || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 }) },
                    ].map((s, i) => (
                      <div key={i} style={{ padding: '12px 14px', background: '#141B2D' }}>
                        <div style={{ fontSize: 10, color: '#4B5580', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{s.label}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#F0F4FF' }}>{s.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Confirmed payments */}
                  {confirmedProofs.length > 0 ? (
                    <div style={{ padding: '14px 20px' }}>
                      <div style={{ fontSize: 11, color: '#4B5580', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Confirmed Payments</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {confirmedProofs.map((proof, pi) => (
                          <div key={pi} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(34,197,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>✅</div>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: '#F0F4FF' }}>Installment {proof.installment_number}</div>
                                <div style={{ fontSize: 11, color: '#4B5580' }}>
                                  {new Date(proof.reviewed_at || proof.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </div>
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: 13, fontWeight: 800, color: '#22C55E' }}>P{Number(l.installment_amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
                              <div style={{ fontSize: 10, color: '#22C55E' }}>Confirmed</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: '16px 20px', textAlign: 'center', fontSize: 13, color: '#4B5580' }}>
                      No confirmed payments yet for this loan.
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

    </div>
  )

  if (borrower && page === 'wallet') return (
    <div style={{ minHeight: '100vh', background: '#0B0F1A', fontFamily: 'DM Sans, sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg,#0d1226,#141B2D)', borderBottom: '1px solid rgba(139,92,246,0.2)', padding: '16px 24px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setPage('home')} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '7px 14px', color: '#F0F4FF', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>← Back</button>
          <div>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 16, color: '#F0F4FF' }}>My Rebate Credits</div>
            <div style={{ fontSize: 11, color: '#4B5580' }}>Early payoff rewards</div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '28px 28px' }}>

        {/* Balance card */}
        <div style={{ background: 'linear-gradient(135deg,#1a1040,#0f1729)', border: '1px solid rgba(139,92,246,0.35)', borderRadius: 20, padding: '28px 24px', marginBottom: 20, textAlign: 'center', boxShadow: '0 8px 32px rgba(139,92,246,0.15)' }}>
          <div style={{ fontSize: 12, color: '#7A8AAA', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>🎁 Rebate Credits Balance</div>
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 44, color: '#F0F4FF', letterSpacing: -1, marginBottom: 6 }}>
            ₱{(rebateCredits?.balance || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: 12, color: '#4B5580', marginBottom: 24 }}>
            {(rebateCredits?.balance || 0) >= 500
              ? '✅ Eligible for withdrawal'
              : `₱${(500 - (rebateCredits?.balance || 0)).toLocaleString('en-PH', { minimumFractionDigits: 2 })} more needed to withdraw`}
          </div>

          {/* Withdraw button */}
          <button
            disabled={!rebateCredits || rebateCredits.balance < 500 || withdrawing}
            onClick={async () => {
              setWithdrawing(true)
              // Check for existing pending withdrawal
              const { data: existing } = await supabase
                .from('wallet_transactions')
                .select('id').eq('borrower_id', borrower.id)
                .eq('type', 'withdrawal').eq('status', 'pending').single()
              if (existing) {
                alert('You already have a pending withdrawal request. Please wait for admin to process it.')
                setWithdrawing(false)
                return
              }
              await supabase.from('wallet_transactions').insert({
                borrower_id: borrower.id,
                loan_id: null,
                type: 'withdrawal',
                amount: rebateCredits.balance,
                description: `Withdrawal request of ₱${rebateCredits.balance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`,
                status: 'pending'
              })
              setCreditTxns(prev => [{ type: 'withdrawal', amount: rebateCredits.balance, description: `Withdrawal request of ₱${rebateCredits.balance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`, status: 'pending', created_at: new Date().toISOString() }, ...prev])
              setWithdrawing(false)
              alert('✅ Withdrawal request submitted! Admin will process it shortly.')
            }}
            style={{
              width: '100%', padding: '14px', borderRadius: 12, border: 'none', fontSize: 14, fontWeight: 700,
              fontFamily: 'Space Grotesk', cursor: !rebateCredits || rebateCredits.balance < 500 ? 'not-allowed' : 'pointer',
              background: !rebateCredits || rebateCredits.balance < 500 ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg,#8B5CF6,#3B82F6)',
              color: !rebateCredits || rebateCredits.balance < 500 ? '#4B5580' : '#fff',
              transition: 'all 0.2s'
            }}
          >
            {withdrawing ? 'Submitting...' : rebateCredits && rebateCredits.balance >= 500 ? `💸 Withdraw ₱${rebateCredits.balance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : `🔒 Min. ₱500 required`}
          </button>
        </div>

        {/* How rebates work */}
        <div style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 14, padding: '16px 18px', marginBottom: 20 }}>
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 13, color: '#22C55E', marginBottom: 10 }}><span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><img src='/giftbox.png' alt='rebate' style={{ width: 18, height: 18, objectFit: 'contain' }} />How to earn rebates</span></div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(34,197,94,0.05)', borderRadius: 9, border: '1px solid rgba(34,197,94,0.12)' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#F0F4FF' }}>Pay final installment at least 1 day early</div>
              <div style={{ fontSize: 11, color: '#4B5580', marginTop: 2 }}>₱50 rebate on a ₱5,000 loan</div>
            </div>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 22, color: '#22C55E' }}>1%</div>
          </div>
          <div style={{ fontSize: 11, color: '#4B5580', marginTop: 10 }}>Fixed 1% of your original loan amount — credited automatically when admin records your payment.</div>
        </div>

        {/* Transaction history */}
        <div style={{ background: '#141B2D', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 14, color: '#F0F4FF' }}>
            Transaction History
          </div>
          {creditTxns.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', fontSize: 13, color: '#4B5580' }}>
              No transactions yet. Pay off a loan early to earn rebates!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {creditTxns.map((txn, i) => {
                const isHoldReturn = txn.type === 'rebate' && txn.description && txn.description.toLowerCase().includes('security hold')
                const isRebate = txn.type === 'rebate' && !isHoldReturn
                const label = isHoldReturn ? 'Security Hold Returned' : isRebate ? 'Early Payoff Rebate' : 'Withdrawal'
                const icon = isHoldReturn ? '/padlock.png' : isRebate ? '/giftbox.png' : null
                const iconBg = isHoldReturn ? 'rgba(245,158,11,0.15)' : isRebate ? 'rgba(34,197,94,0.15)' : txn.status === 'pending' ? 'rgba(245,158,11,0.15)' : txn.status === 'rejected' ? 'rgba(239,68,68,0.15)' : 'rgba(59,130,246,0.15)'
                const amountColor = isHoldReturn ? '#F59E0B' : isRebate ? '#22C55E' : '#F0F4FF'
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: i < creditTxns.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                        {icon ? <img src={icon} alt={label} style={{ width: 18, height: 18, objectFit: 'contain' }} /> : txn.status === 'pending' ? '⏳' : txn.status === 'rejected' ? '❌' : '💸'}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#F0F4FF' }}>{label}</div>
                        <div style={{ fontSize: 11, color: '#4B5580', marginTop: 2 }}>
                          {new Date(txn.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                          {txn.status === 'pending' && <span style={{ color: '#F59E0B', marginLeft: 6 }}>· Pending</span>}
                          {txn.status === 'rejected' && <span style={{ color: '#EF4444', marginLeft: 6 }}>· Rejected</span>}
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 15, color: amountColor }}>
                        {txn.type === 'rebate' ? '+' : '-'}₱{Number(txn.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  )

  if (borrower && page === 'payment-methods') return (
    <div style={{ minHeight: '100vh', background: '#0B0F1A', fontFamily: 'DM Sans, sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg,#0d1226,#141B2D)', borderBottom: '1px solid rgba(139,92,246,0.2)', padding: '16px 24px' }}>
        <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 14 }}>
          <button onClick={() => setPage('home')} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '7px 14px', color: '#F0F4FF', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>← Back</button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><img src="/payment-method.png" alt="payment" style={{ width: 22, height: 22, objectFit: 'contain' }} /><div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 16, color: '#F0F4FF' }}>Accepted Payment Methods</div></div>
            <div style={{ fontSize: 11, color: '#4B5580' }}>How to repay your loan</div>
          </div>
        </div>
      </div>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '28px 20px' }}>
        <p style={{ fontSize: 13, color: '#7A8AAA', marginBottom: 24, lineHeight: 1.7 }}>
          Choose any of the following methods to make your installment payments. After every payment, upload your proof of payment through this portal so your admin can confirm it.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            { logo: '/cash-logo.png', label: 'Physical Cash', fee: '✓ Free', feeBg: 'rgba(34,197,94,0.08)', feeColor: '#22C55E', feeBorder: 'rgba(34,197,94,0.2)', border: 'rgba(34,197,94,0.25)', desc: 'Pay your admin directly in person. Coordinate with John Paul Lacaron or Charlou June Ramil to arrange your payment. No fees, no transfer needed.', steps: ['Prepare the exact installment amount in cash', 'Coordinate with your admin via Teams Chat', 'Hand over payment and request acknowledgement', 'Upload a photo of the receipt or acknowledgement in the portal'] },
            { logo: '/gcash-logo.png', label: 'GCash', fee: '₱15', feeBg: 'rgba(245,158,11,0.08)', feeColor: '#F59E0B', feeBorder: 'rgba(245,158,11,0.2)', border: 'rgba(0,163,255,0.25)', desc: 'Send via GCash to the admin number. A transaction fee of ₱15 flat applies — please send the exact installment amount and cover any fees separately.', steps: ['Open GCash and send to admin number', 'Send the exact installment amount', 'Screenshot the successful transaction screen', 'Upload the screenshot in the portal'] },
            { logo: '/rcbc-logo.png', label: 'RCBC to RCBC', fee: '✓ Free', feeBg: 'rgba(34,197,94,0.08)', feeColor: '#22C55E', feeBorder: 'rgba(34,197,94,0.2)', border: 'rgba(220,38,38,0.25)', desc: 'Transfer directly to the admin RCBC account. Same-bank RCBC-to-RCBC transfers are completely free with no deductions.', steps: ['Log in to RCBC Online or App', 'Transfer exact installment amount to admin RCBC account', 'Screenshot the successful transfer confirmation', 'Upload the screenshot in the portal'] },
            { logo: '/bank-logo.png', label: 'Other Bank (Instapay/PESONet)', fee: 'You cover fee', feeBg: 'rgba(245,158,11,0.08)', feeColor: '#F59E0B', feeBorder: 'rgba(245,158,11,0.2)', border: 'rgba(139,92,246,0.25)', desc: 'Transfer from any other bank using Instapay or PESONet. You are responsible for covering any transfer fees - send the exact installment amount plus fees so the full amount arrives.', steps: ['Use your bank online transfer or app', 'Choose Instapay (faster) or PESONet', 'Send exact installment amount + transfer fee', 'Screenshot the transaction confirmation', 'Upload the screenshot in the portal'] },
          ].map((item, i) => (
            <div key={i} style={{ background: '#141B2D', border: `1px solid ${item.border}`, borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
                <img src={item.logo} alt={item.label} style={{ width: 52, height: 52, objectFit: 'contain', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                    <span style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 15, color: '#F0F4FF' }}>{item.label}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: item.feeColor, background: item.feeBg, padding: '3px 12px', borderRadius: 20, border: `1px solid ${item.feeBorder}` }}>{item.fee}</span>
                  </div>
                  <div style={{ fontSize: 13, color: '#7A8AAA', lineHeight: 1.6 }}>{item.desc}</div>
                </div>
              </div>
              <div style={{ padding: '14px 20px 18px', borderTop: `1px solid ${item.border}`, background: 'rgba(0,0,0,0.15)' }}>
                <div style={{ fontSize: 11, color: '#4B5580', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>How to pay</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {item.steps.map((step, si) => (
                    <div key={si} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#8B5CF6', flexShrink: 0, marginTop: 1 }}>{si + 1}</div>
                      <span style={{ fontSize: 13, color: '#CBD5F0', lineHeight: 1.5 }}>{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 20, padding: '14px 18px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 12, fontSize: 13, color: '#F59E0B', lineHeight: 1.7 }}>
          <img src="/warning.png" alt="warning" style={{ width: 14, height: 14, objectFit: 'contain', verticalAlign: 'middle', marginRight: 4 }} /><strong>Important:</strong> Always upload your proof of payment in the portal after every transaction. Your payment is only confirmed once your admin reviews and approves the proof.
        </div>
      </div>
    </div>
  )

  // Portal dashboard
  return (
    <div style={{ minHeight: '100vh', background: '#0B0F1A', fontFamily: 'DM Sans, sans-serif' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg,#0d1226,#141B2D)', borderBottom: '1px solid rgba(139,92,246,0.2)', padding: '16px 24px' }}>
        <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
<a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
              <img src="/favicon-96x96.png" alt="MoneyfestLending" style={{ width: 36, height: 36, objectFit: 'contain' }} />
              <div>
                <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 16, color: '#F0F4FF' }}>
                  Moneyfest<span style={{ background: 'linear-gradient(90deg,#60a5fa,#a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Lending</span>
                </div>
                <div style={{ fontSize: 11, color: '#4B5580' }}>Borrower Portal</div>
              </div>
            </a>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#F0F4FF' }}>{borrower.full_name}</div>
              <div style={{ fontSize: 11, color: '#4B5580' }}>{borrower.department}</div>
            </div>

            {/* Notification Bell */}
            <div style={{ position: 'relative' }}>
              <button onClick={() => { setShowNotifs(v => !v); if (!showNotifs) markAllRead() }}
                style={{ position: 'relative', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <span style={{ fontSize: 16 }}>🔔</span>
                {notifications.filter(n => !n.is_read).length > 0 && (
                  <div style={{ position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: '50%', background: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: '#fff' }}>
                    {notifications.filter(n => !n.is_read).length}
                  </div>
                )}
              </button>

              {/* Dropdown */}
              {showNotifs && (
                <div style={{ position: 'absolute', right: 0, top: 44, width: 320, background: '#141B2D', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, boxShadow: '0 12px 40px rgba(0,0,0,0.5)', zIndex: 200, overflow: 'hidden' }}>
                  <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 13, color: '#F0F4FF' }}>Notifications</div>
                    <button onClick={() => setShowNotifs(false)} style={{ background: 'none', border: 'none', color: '#4B5580', cursor: 'pointer', fontSize: 16 }}>✕</button>
                  </div>
                  <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                    {notifications.length === 0 ? (
                      <div style={{ padding: '32px 16px', textAlign: 'center', fontSize: 13, color: '#4B5580' }}>No notifications yet.</div>
                    ) : notifications.map((n, i) => (
                      <div key={i} style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', background: n.is_read ? 'transparent' : 'rgba(59,130,246,0.04)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <div style={{ fontSize: 20, flexShrink: 0, marginTop: 1 }}>
                          {n.type === 'loan_approved' ? '🎉' : n.type === 'payment_confirmed' ? '✅' : n.type === 'payment_rejected' ? '❌' : '⏰'}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#F0F4FF', marginBottom: 3 }}>{n.title}</div>
                          <div style={{ fontSize: 12, color: '#7A8AAA', lineHeight: 1.5 }}>{n.message}</div>
                          <div style={{ fontSize: 10, color: '#4B5580', marginTop: 5 }}>
                            {new Date(n.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                        {!n.is_read && <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#3B82F6', flexShrink: 0, marginTop: 5 }} />}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button onClick={() => { setBorrower(null); setLoan(null); setAllLoans([]); setCode(''); setInputCode(''); localStorage.removeItem('lm_portal_code') }}
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '6px 12px', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}>
              Sign out
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes portalFadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @media (max-width: 900px) {
          .portal-two-col { grid-template-columns: 1fr !important; }
          .portal-sidebar { display: none !important; }
        }
        @media (max-width: 600px) {
          .portal-loan-level-grid { grid-template-columns: repeat(2,1fr) !important; }
          .portal-tabs { flex-wrap: wrap !important; gap: 6px !important; }
        }
        .portal-card { animation: portalFadeUp 0.5s ease forwards; opacity: 0; }
        .portal-card:nth-child(1) { animation-delay: 0.05s; }
        .portal-card:nth-child(2) { animation-delay: 0.12s; }
        .portal-card:nth-child(3) { animation-delay: 0.19s; }
        .portal-card:nth-child(4) { animation-delay: 0.26s; }
        .portal-card:nth-child(5) { animation-delay: 0.33s; }
        .portal-card:nth-child(6) { animation-delay: 0.40s; }
        .portal-card-hover { transition: transform 0.2s ease, box-shadow 0.2s ease; }
        .portal-card-hover:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.3); }
        .nav-btn { transition: all 0.15s ease; }
        .nav-btn:hover { filter: brightness(1.2); transform: translateY(-1px); }
      `}</style>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 32px' }}>

        {uploadSuccess && (
          <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 12, padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
            <CheckCircle size={16} color="#22C55E" />
            <div style={{ fontSize: 13, color: '#22C55E', fontWeight: 600 }}>Payment proof submitted! Admin will review and confirm your payment shortly.</div>
          </div>
        )}

        {!loan ? (
          <div style={{ background: '#141B2D', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 32, textAlign: 'center' }}>
            <FileText size={40} color="rgba(255,255,255,0.1)" style={{ marginBottom: 12 }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: '#F0F4FF', marginBottom: 6 }}>No Active Loan</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>You don't have an active loan at the moment.</div>
          </div>
        ) : (
          <>
            {/* Desktop two-column layout */}
            <div className="portal-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24, alignItems: 'start' }}>
            <div>
            {/* Loan summary card with outside quick-access buttons */}
            <div className="portal-card" style={{ position: 'relative', marginBottom: 20 }}>

            <div style={{ background: 'linear-gradient(135deg,#141B2D,#1a1040)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 16, padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 12, color: '#4B5580', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Remaining Balance</div>
                  <div style={{ fontFamily: 'Space Grotesk', fontSize: 36, fontWeight: 900, color: '#F0F4FF', letterSpacing: -1 }}>
                    ₱{Number(loan.remaining_balance).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <StatusBadge status={loan.status} />
              </div>

              {/* Release Date Banner — shown when loan is Pending Release */}
              {loan.status === 'Pending' && loan.release_date && (() => {
                const [y, m, d] = loan.release_date.split('-').map(Number)
                const releaseDate = new Date(y, m - 1, d)
                const today = new Date()
                today.setHours(0, 0, 0, 0)
                const diffMs = releaseDate - today
                const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
                const isPast = diffDays < 0
                const isToday = diffDays === 0
                const formattedDate = releaseDate.toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

                return (
                  <div style={{ background: 'linear-gradient(135deg,rgba(245,158,11,0.08),rgba(239,68,68,0.05))', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 14, padding: '18px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>
                      {isToday ? '🎉' : isPast ? '⏳' : <img src='/calendar.png' alt='calendar' style={{ width: 28, height: 28, objectFit: 'contain' }} />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#F59E0B', fontWeight: 700, marginBottom: 4 }}>
                        {isToday ? 'Release Day!' : isPast ? 'Processing Release' : 'Scheduled Fund Release'}
                      </div>
                      <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 16, color: '#F0F4FF', marginBottom: 4 }}>
                        {formattedDate}
                      </div>
                      <div style={{ fontSize: 12, color: '#7A8AAA', lineHeight: 1.6 }}>
                        {isToday
                          ? 'Your funds are being processed today. Please wait for admin confirmation.'
                          : isPast
                          ? 'Your release is being processed. Please contact your admin for updates.'
                          : diffDays === 1
                          ? 'Your funds will be released tomorrow. Please make sure your details are correct.'
                          : `Your funds will be released in ${diffDays} days. Please make sure your release details are correct.`}
                      </div>
                    </div>
                    {!isPast && !isToday && (
                      <div style={{ textAlign: 'center', flexShrink: 0 }}>
                        <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 28, color: '#F59E0B', lineHeight: 1 }}>{diffDays}</div>
                        <div style={{ fontSize: 10, color: '#7A8AAA', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{diffDays === 1 ? 'day' : 'days'}</div>
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* Loan Agreement Signature Reminder — shown when Pending and not yet signed */}
              {loan.status === 'Pending' && !loan.e_signature_name && (
                <div style={{
                  background: 'linear-gradient(135deg,rgba(99,102,241,0.1),rgba(139,92,246,0.08))',
                  border: '1px solid rgba(99,102,241,0.35)',
                  borderLeft: '4px solid #6366F1',
                  borderRadius: 14, padding: '18px 20px', marginBottom: 16,
                  display: 'flex', alignItems: 'flex-start', gap: 14
                }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <img src='/digital-signature.png' alt='sign' style={{ width: 26, height: 26, objectFit: 'contain' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 15, color: '#F0F4FF', marginBottom: 6 }}>
                      Action Required — Sign Your Loan Agreement
                    </div>
                    <div style={{ fontSize: 13, color: '#8892B0', lineHeight: 1.7, marginBottom: 14 }}>
                      Your loan has been approved! To avoid delays in the release of your funds, please sign your Loan Agreement as soon as possible. Fund release will only be processed once your signed agreement is on file.
                    </div>
                    <button
                      onClick={() => setShowSignModal(true)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                        padding: '10px 20px', borderRadius: 10, border: 'none',
                        background: 'linear-gradient(135deg,#6366F1,#8B5CF6)',
                        color: '#fff', fontSize: 13, fontWeight: 700,
                        cursor: 'pointer', fontFamily: 'Space Grotesk'
                      }}>
                      <img src='/digital-signature.png' alt='sign' style={{ width: 16, height: 16, objectFit: 'contain' }} /> Sign Loan Agreement Now
                    </button>
                  </div>
                </div>
              )}

              {/* Signed confirmation banner — shown when Pending and already signed */}
              {loan.status === 'Pending' && loan.e_signature_name && (
                <div style={{
                  background: 'rgba(34,197,94,0.06)',
                  border: '1px solid rgba(34,197,94,0.25)',
                  borderLeft: '4px solid #22C55E',
                  borderRadius: 14, padding: '14px 18px', marginBottom: 16,
                  display: 'flex', alignItems: 'center', gap: 12
                }}>
                  <span style={{ fontSize: 20 }}>✅</span>
                  <div>
                    <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 14, color: '#22C55E', marginBottom: 2 }}>
                      Loan Agreement Signed
                    </div>
                    <div style={{ fontSize: 12, color: '#4B5580' }}>
                      Signed by <strong style={{ color: '#CBD5F0' }}>{loan.e_signature_name}</strong> on {loan.e_signature_date ? new Date(loan.e_signature_date).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' }) : '—'} · Your fund release will proceed as scheduled.
                    </div>
                  </div>
                </div>
              )}

              {/* Progress bar */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#4B5580', marginBottom: 8 }}>
                  <span>{loan.payments_made || 0} of 4 installments paid</span>
                  <span>{Math.round(progressPct)}% complete</span>
                </div>
                <div style={{ height: 8, background: '#1E2640', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: progressPct + '%', background: 'linear-gradient(90deg,#8B5CF6,#22C55E)', borderRadius: 4, transition: 'width 0.5s ease' }} />
                </div>
              </div>

              {/* Stats row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12 }}>
                {[
                  { label: 'Approved Amount', value: '₱' + Number(loan.loan_amount).toLocaleString('en-PH'), color: '#F0F4FF' },
                  { label: 'You Received', value: '₱' + (loan.funds_released ? Number(loan.funds_released).toLocaleString('en-PH') : (Number(loan.loan_amount) * 0.90).toLocaleString('en-PH')), color: '#22C55E' },
                  { label: 'Security Hold', value: (loan.security_hold_returned ? '✅ ' : '🔒 ') + '₱' + (loan.security_hold ? Number(loan.security_hold).toLocaleString('en-PH') : (loan.security_hold ? Number(loan.security_hold) : Number(loan.loan_amount) * 0.10).toLocaleString('en-PH')), color: loan.security_hold_returned ? '#22C55E' : '#F59E0B' },
                  { label: 'Per Installment', value: '₱' + Number(loan.installment_amount).toLocaleString('en-PH', { minimumFractionDigits: 2 }), color: '#8B5CF6' },
                  { label: 'Release Date', value: formatDate(loan.release_date), color: '#F59E0B' },
                  { label: 'Maturity Date', value: (() => { const d = getDueDates(loan.release_date, 0); return d.length >= 4 ? new Date(d[3].dateStr).toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'}) : 'TBD' })(), color: '#F97316' },
                ].map(s => (
                  <div key={s.label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ fontSize: 10, color: '#4B5580', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{s.label}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>
            </div>

            {/* Installment schedule */}
            <div style={{ background: '#141B2D', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 20, marginBottom: 20 }}>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 14, color: '#F0F4FF', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Calendar size={16} color="#3B82F6" /> Payment Schedule
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {dueDates.map(due => {
                  const proof = proofs.find(p => p.installment_number === due.num)
                  return (
                    <div key={due.num} style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      padding: '14px 16px', borderRadius: 12,
                      background: due.paid ? 'rgba(34,197,94,0.05)' : due.current ? 'rgba(59,130,246,0.07)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${due.paid ? 'rgba(34,197,94,0.2)' : due.current ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.05)'}`,
                    }}>
                      {/* Status icon */}
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: due.paid ? 'rgba(34,197,94,0.15)' : due.current ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {due.paid ? <CheckCircle size={16} color="#22C55E" /> : due.current ? <Clock size={16} color="#3B82F6" /> : <div style={{ fontSize: 12, fontWeight: 700, color: '#4B5580' }}>{due.num}</div>}
                      </div>
                      {/* Details */}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: due.paid ? '#22C55E' : due.current ? '#F0F4FF' : '#4B5580' }}>
                          Installment {due.num} — ₱{Number(loan.installment_amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </div>
                        <div style={{ fontSize: 12, color: '#4B5580', marginTop: 2 }}>Due: {formatDate(due.dateStr)}</div>
                        {proof && (
                          <div style={{ fontSize: 11, marginTop: 4, color: proof.status === 'Pending' ? '#F59E0B' : '#22C55E' }}>
                            {proof.status === 'Pending' ? "⏳ Proof submitted — awaiting admin confirmation" : "✅ Payment confirmed"}
                          </div>
                        )}
                      </div>
                      {/* Live penalty counter for overdue */}
                      {due.current && !due.paid && (() => {
                        const today = new Date(); today.setHours(0,0,0,0)
                        const dueD = new Date(due.date); dueD.setHours(0,0,0,0)
                        const daysLate = Math.max(0, Math.ceil((today - dueD) / (1000 * 60 * 60 * 24)))
                        if (daysLate <= 0) return null
                        const PENALTY_PER_DAY = 20
                        const cap = Number(loan.installment_amount) * 0.20
                        const penalty = Math.min(daysLate * PENALTY_PER_DAY, cap)
                        const capped = penalty === cap
                        return (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, flexShrink: 0 }}>
                            <img src="/warning.png" alt="penalty" style={{ width: 13, height: 13, objectFit: 'contain' }} />
                            <div style={{ fontSize: 11, color: '#EF4444', fontWeight: 700 }}>
                              +₱{penalty.toLocaleString('en-PH', { minimumFractionDigits: 2 })} penalty
                              <span style={{ fontWeight: 400, color: '#F87171', marginLeft: 4 }}>
                                ({daysLate}d late{capped ? ' · capped' : ''})
                              </span>
                            </div>
                          </div>
                        )
                      })()}

                      {/* Upload button */}
                      {due.current && !due.paid && (
                        <button
                          onClick={() => setUploadModal(due.num)}
                          disabled={proof && proof.status === 'Pending'}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                            borderRadius: 9, border: 'none', fontSize: 12, fontWeight: 700,
                            cursor: proof && proof.status === 'Pending' ? 'not-allowed' : 'pointer',
                            background: proof && proof.status === 'Pending'
                              ? 'rgba(245,158,11,0.1)'
                              : proof && proof.status === 'Rejected'
                              ? 'rgba(239,68,68,0.15)'
                              : 'linear-gradient(135deg,#3B82F6,#8B5CF6)',
                            color: proof && proof.status === 'Pending' ? '#F59E0B' : proof && proof.status === 'Rejected' ? '#EF4444' : '#fff',
                            flexShrink: 0, border: proof && proof.status === 'Rejected' ? '1px solid rgba(239,68,68,0.3)' : 'none'
                          }}
                        >
                          {proof && proof.status === 'Pending'
                            ? <><Clock size={12} /> Pending</>
                            : proof && proof.status === 'Rejected'
                            ? <><Upload size={12} /> Re-upload</>
                            : <><Upload size={12} /> Upload Proof</>}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Loan Disclosure Statement — RA 3765 Truth in Lending Act */}
            {(() => {
              const principal = Number(loan.loan_amount)
              const totalRepayment = Number(loan.total_repayment)
              const financeCharge = totalRepayment - principal
              const flatRate = Number(loan.interest_rate || 0.07) * 100
              // Effective annual rate: loan is 2 months, so annualize
              const effectiveAnnual = ((financeCharge / principal) / 2 * 12 * 100).toFixed(2)
              return (
                <div style={{ background: '#141B2D', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 16, padding: 20, marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <img src="/verified.png" alt="disclosure" style={{ width: 18, height: 18, objectFit: 'contain' }} />
                    <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 14, color: '#F0F4FF' }}>Loan Disclosure Statement</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                    {[
                      { label: 'Approved Loan Amount', value: '₱' + principal.toLocaleString('en-PH', { minimumFractionDigits: 2 }), color: '#F0F4FF' },
                      { label: 'Security Hold (' + (loan.security_hold && principal ? ((Number(loan.security_hold)/principal*100).toFixed(0)) : '10') + '%)', value: '₱' + (loan.security_hold ? Number(loan.security_hold).toLocaleString('en-PH', { minimumFractionDigits: 2 }) : (principal * 0.10).toLocaleString('en-PH', { minimumFractionDigits: 2 })), color: '#F59E0B' },
                      { label: 'Funds Released to You', value: '₱' + (loan.funds_released ? Number(loan.funds_released).toLocaleString('en-PH', { minimumFractionDigits: 2 }) : (principal * 0.80).toLocaleString('en-PH', { minimumFractionDigits: 2 })), color: '#22C55E' },
                      { label: 'Finance Charge', value: '₱' + financeCharge.toLocaleString('en-PH', { minimumFractionDigits: 2 }), color: '#F59E0B' },
                      { label: 'Flat Interest Rate', value: flatRate.toFixed(0) + '% of principal', color: '#60A5FA' },
                      { label: 'Effective Interest Rate (per annum)', value: effectiveAnnual + '% p.a.', color: '#a78bfa' },
                      { label: 'Total Amount Payable', value: '₱' + totalRepayment.toLocaleString('en-PH', { minimumFractionDigits: 2 }), color: '#22C55E' },
                      { label: 'Number of Installments', value: '4 payments every 5th and 20th of the month', color: '#F0F4FF' },
                      { label: 'Per Installment Amount', value: '₱' + Number(loan.installment_amount).toLocaleString('en-PH', { minimumFractionDigits: 2 }), color: '#F0F4FF' },
                    ].map((row, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, gap: 12 }}>
                        <span style={{ fontSize: 12, color: '#7A8AAA', flex: 1 }}>{row.label}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: row.color, textAlign: 'right' }}>{row.value}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ padding: '10px 12px', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 8, fontSize: 11, color: '#4B5580', lineHeight: 1.7 }}>
                    {loan.security_hold_returned && (
                      <div style={{ marginBottom: 8, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 20, fontSize: 11, color: '#22C55E', fontWeight: 700 }}>
                        ✅ Security Hold of ₱{Number(loan.security_hold).toLocaleString('en-PH', { minimumFractionDigits: 2 })} has been returned to your Rebate Credits
                      </div>
                    )}
                    <strong style={{ color: '#818CF8' }}>RA 3765 — Truth in Lending Act Disclosure.</strong> This statement discloses all finance charges and terms applicable to your loan in compliance with Republic Act No. 3765 of the Philippines. The effective interest rate is computed based on the loan term of 2 months annualized over 12 months.
                  </div>
                  {/* Sign & Download buttons */}
                  <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                    {!loan.e_signature_name ? (
                      <button onClick={() => setShowSignModal(true)}
                        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#6366F1,#8B5CF6)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                        <img src='/digital-signature.png' alt='sign' style={{ width: 16, height: 16, objectFit: 'contain' }} /> Sign Loan Agreement
                      </button>
                    ) : (
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 10 }}>
                        <span style={{ fontSize: 14 }}>✅</span>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#22C55E' }}>Signed by {loan.e_signature_name}</div>
                          <div style={{ fontSize: 10, color: '#4B5580' }}>{loan.e_signature_date ? new Date(loan.e_signature_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}</div>
                        </div>
                      </div>
                    )}
                    <button onClick={() => generateLoanAgreementPDF()}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px 18px', borderRadius: 10, border: '1px solid rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.08)', color: '#818CF8', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      📄 Download PDF
                    </button>
                  </div>
                </div>
              )
            })()}

            <PenaltySection loanId={loan.id} supabase={supabase} />
            </div>{/* end left column */}

            {/* ── Right sidebar ── */}
            <div className="portal-sidebar" style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 24 }}>

              {/* Borrower badge card */}
              <div className="portal-card" style={{ background: 'linear-gradient(135deg,#1a1040,#141B2D)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: 16, padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg,#3B82F6,#8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                    {borrower.full_name?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 14, color: '#F0F4FF' }}>{borrower.full_name}</div>
                    <div style={{ fontSize: 11, color: '#4B5580', marginTop: 2 }}>{borrower.department}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(139,92,246,0.08)', borderRadius: 10, border: '1px solid rgba(139,92,246,0.15)', marginBottom: 12 }}>
                  <span style={{ fontSize: 18 }}>{getBadgeConfig(borrower.loyalty_badge || 'New').emoji}</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: getBadgeConfig(borrower.loyalty_badge || 'New').color }}>{getBadgeConfig(borrower.loyalty_badge || 'New').label}</div>
                    <div style={{ fontSize: 10, color: '#4B5580' }}>Score: {borrower.credit_score || 750} / 1,000</div>
                  </div>
                </div>
                {/* Mini score bar */}
                <div style={{ height: 4, background: '#1E2640', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: (((borrower.credit_score || 750) - 300) / 700 * 100) + '%', background: 'linear-gradient(90deg,#EF4444,#F59E0B,#22C55E,#8B5CF6)', borderRadius: 2, transition: 'width 1s ease' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#4B5580', marginTop: 4 }}>
                  <span>300</span><span>750</span><span>1000 VIP</span>
                </div>
              </div>

              {/* Quick actions */}
              <div className="portal-card" style={{ background: '#141B2D', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 16 }}>
                <div style={{ fontSize: 11, color: '#4B5580', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Quick Actions</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[
                    { icon: '/history.png', label: 'Payment History', page: 'payment-history', color: '#22C55E', border: 'rgba(34,197,94,0.2)' },
                    { icon: '/user.png', label: 'My Profile', page: 'profile', color: '#8B5CF6', border: 'rgba(139,92,246,0.2)' },
                    { icon: '/wallet.png', label: `Rebate Credits${rebateCredits && rebateCredits.balance > 0 ? ' — ₱' + rebateCredits.balance.toLocaleString('en-PH', { minimumFractionDigits: 2 }) : ''}`, page: 'wallet', color: '#F59E0B', border: 'rgba(245,158,11,0.2)' },
                    { icon: '/payment-method.png', label: 'Payment Methods', page: 'payment-methods', color: '#60A5FA', border: 'rgba(59,130,246,0.2)' },
                  ].map((item, i) => (
                    <button key={i} onClick={() => setPage(item.page)} className="nav-btn"
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, border: `1px solid ${item.border}`, background: 'rgba(255,255,255,0.02)', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
                      <img src={item.icon} alt={item.label} style={{ width: 18, height: 18, objectFit: 'contain', flexShrink: 0 }} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: item.color }}>{item.label}</span>
                      <span style={{ marginLeft: 'auto', color: '#4B5580', fontSize: 14 }}>›</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Need Help */}
              <div className="portal-card" style={{ background: '#141B2D', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 16, padding: 16 }}>
                <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 13, color: '#F0F4FF', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 7 }}>
                  <img src="/faq.png" alt="help" style={{ width: 15, height: 15, objectFit: 'contain' }} /> Need Help?
                </div>
                <div style={{ fontSize: 12, color: '#7A8AAA', marginBottom: 10, lineHeight: 1.6 }}>Contact your admin via <strong style={{ color: '#F0F4FF' }}>Microsoft Teams</strong>:</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[
                    { initials: 'JP', name: 'John Paul Lacaron', gradient: 'linear-gradient(135deg,#3B82F6,#8B5CF6)' },
                    { initials: 'CJ', name: 'Charlou June Ramil', gradient: 'linear-gradient(135deg,#14B8A6,#3B82F6)' },
                  ].map(a => (
                    <div key={a.name} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '8px 10px' }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: a.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#fff', flexShrink: 0 }}>{a.initials}</div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#F0F4FF' }}>{a.name}</div>
                        <div style={{ fontSize: 10, color: '#4B5580' }}>Admin · Teams Chat</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* FAQ link */}
              <a href="/faq" className="portal-card nav-btn" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 14, textDecoration: 'none' }}>
                <img src="/faq.png" alt="faq" style={{ width: 16, height: 16, objectFit: 'contain' }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: '#a78bfa' }}>View FAQ & Privacy Notice</span>
                <span style={{ marginLeft: 'auto', color: '#4B5580' }}>›</span>
              </a>

            </div>{/* end right sidebar */}
            </div>{/* end two-column grid */}
          </>
        )}
      </div>

      {showSignModal && loan && (
        <SignatureModal
          borrower={borrower}
          loan={loan}
          onSave={handleSaveSignature}
          onClose={() => setShowSignModal(false)}
        />
      )}

      {uploadModal && (
        <UploadModal
          installmentNum={uploadModal}
          loan={loan}
          borrower={borrower}
          onClose={() => setUploadModal(null)}
          onUploaded={handleUploaded}
        />
      )}


    </div>
  )
}
