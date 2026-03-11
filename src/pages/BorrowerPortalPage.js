import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import {
  Lock, CheckCircle, Clock, AlertCircle, Upload,
  FileText, Calendar, CreditCard, ChevronDown, ChevronUp, X
} from 'lucide-react'

function formatDate(str) {
  if (!str) return '—'
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

export default function BorrowerPortalPage() {
  const [code, setCode] = useState('')
  const [inputCode, setInputCode] = useState('')
  const [borrower, setBorrower] = useState(null)
  const [loan, setLoan] = useState(null)
  const [proofs, setProofs] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [uploadModal, setUploadModal] = useState(null)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [page, setPage] = useState('home') // 'home' | 'payment-methods'

  const fetchPortalData = useCallback(async (accessCode) => {
    setLoading(true)
    setError('')

    const { data: b } = await supabase
      .from('borrowers')
      .select('*')
      .eq('access_code', accessCode.toUpperCase().trim())
      .single()

    if (!b) { setError('Invalid access code. Please check and try again.'); setLoading(false); return }

    const { data: l } = await supabase
      .from('loans')
      .select('*')
      .eq('borrower_id', b.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    const { data: p } = await supabase
      .from('payment_proofs')
      .select('*')
      .eq('borrower_id', b.id)
      .order('created_at', { ascending: false })

    setBorrower(b)
    setLoan(l || null)
    setProofs(p || [])
    setLoading(false)
  }, [])

  const handleLogin = async () => {
    if (!inputCode.trim()) { setError('Please enter your access code'); return }
    setCode(inputCode)
    await fetchPortalData(inputCode)
  }

  const handleUploaded = () => {
    setUploadModal(null)
    setUploadSuccess(true)
    fetchPortalData(code)
    setTimeout(() => setUploadSuccess(false), 5000)
  }

  const dueDates = loan ? getDueDates(loan.release_date, loan.payments_made || 0) : []
  const progressPct = loan ? ((loan.payments_made || 0) / 4) * 100 : 0

  // Login screen
  if (!borrower) return (
    <div style={{ minHeight: '100vh', background: '#0B0F1A', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: 'DM Sans, sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <img src="/favicon-96x96.png" alt="Loan Manifest" style={{ width: 56, height: 56, objectFit: 'contain', marginBottom: 12 }} />
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 28, color: '#F0F4FF', letterSpacing: -1 }}>
            Loan<span style={{ background: 'linear-gradient(90deg,#60a5fa,#a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Manifest</span>
          </div>
          <div style={{ fontSize: 13, color: '#4B5580', marginTop: 4 }}>Borrower Portal</div>
        </div>

        <div style={{ background: '#141B2D', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(139,92,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Lock size={16} color="#8B5CF6" />
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
            {loading ? 'Checking...' : 'Access My Loan →'}
          </button>

          <div style={{ marginTop: 18, padding: '12px 14px', background: 'rgba(59,130,246,0.06)', borderRadius: 8, fontSize: 12, color: '#4B5580', lineHeight: 1.6 }}>
            💡 Your access code was sent to your email when your loan was approved. Contact <strong style={{ color: '#7A8AAA' }}>John Paul Lacaron</strong> or <strong style={{ color: '#7A8AAA' }}>Charlou John Ramil</strong> via Teams if you need help.
          </div>
        </div>
      </div>
    </div>
  )

  // Payment Methods page
  if (borrower && page === 'payment-methods') return (
    <div style={{ minHeight: '100vh', background: '#0B0F1A', fontFamily: 'DM Sans, sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg,#0d1226,#141B2D)', borderBottom: '1px solid rgba(139,92,246,0.2)', padding: '16px 24px' }}>
        <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 14 }}>
          <button onClick={() => setPage('home')} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '7px 14px', color: '#F0F4FF', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>← Back</button>
          <div>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 16, color: '#F0F4FF' }}>Accepted Payment Methods</div>
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
            { logo: '/cash-logo.png', label: 'Physical Cash', fee: '✓ Free', feeBg: 'rgba(34,197,94,0.08)', feeColor: '#22C55E', feeBorder: 'rgba(34,197,94,0.2)', border: 'rgba(34,197,94,0.25)', desc: 'Pay your admin directly in person. Coordinate with John Paul Lacaron or Charlou John Ramil to arrange your payment. No fees, no transfer needed.', steps: ['Prepare the exact installment amount in cash', 'Coordinate with your admin via Teams Chat', 'Hand over payment and request acknowledgement', 'Upload a photo of the receipt or acknowledgement in the portal'] },
            { logo: '/gcash-logo.png', label: 'GCash', fee: 'P15 or 1%', feeBg: 'rgba(245,158,11,0.08)', feeColor: '#F59E0B', feeBorder: 'rgba(245,158,11,0.2)', border: 'rgba(0,163,255,0.25)', desc: 'Send via GCash to the admin number. A transaction fee of P15 or 1% of the amount (whichever is higher) applies - please send the exact installment amount and cover any fees separately.', steps: ['Open GCash and send to admin number', 'Send the exact installment amount', 'Screenshot the successful transaction screen', 'Upload the screenshot in the portal'] },
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
          ⚠️ <strong>Important:</strong> Always upload your proof of payment in the portal after every transaction. Your payment is only confirmed once your admin reviews and approves the proof.
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
            <img src="/favicon-96x96.png" alt="Loan Manifest" style={{ width: 36, height: 36, objectFit: 'contain' }} />
            <div>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 16, color: '#F0F4FF' }}>
                Loan<span style={{ background: 'linear-gradient(90deg,#60a5fa,#a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Manifest</span>
              </div>
              <div style={{ fontSize: 11, color: '#4B5580' }}>Borrower Portal</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#F0F4FF' }}>{borrower.full_name}</div>
              <div style={{ fontSize: 11, color: '#4B5580' }}>{borrower.department}</div>
            </div>
            <button onClick={() => { setBorrower(null); setLoan(null); setCode(''); setInputCode('') }}
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '6px 12px', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}>
              Sign out
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 20px' }}>

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
            {/* Loan summary card */}
            <div style={{ background: 'linear-gradient(135deg,#141B2D,#1a1040)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 16, padding: 24, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 12, color: '#4B5580', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Remaining Balance</div>
                  <div style={{ fontFamily: 'Space Grotesk', fontSize: 36, fontWeight: 900, color: '#F0F4FF', letterSpacing: -1 }}>
                    ₱{Number(loan.remaining_balance).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <StatusBadge status={loan.status} />
              </div>

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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {[
                  { label: 'Loan Amount', value: 'P' + Number(loan.loan_amount).toLocaleString('en-PH'), color: '#F0F4FF' },
                  { label: 'Per Installment', value: 'P' + Number(loan.installment_amount).toLocaleString('en-PH', { minimumFractionDigits: 2 }), color: '#8B5CF6' },
                  { label: 'Release Date', value: formatDate(loan.release_date), color: '#F59E0B' },
                ].map(s => (
                  <div key={s.label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ fontSize: 10, color: '#4B5580', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{s.label}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: s.color }}>{s.value}</div>
                  </div>
                ))}
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
                            {proof.status === 'Pending' ? '⏳ Proof submitted — awaiting admin confirmation' : '✅ Payment confirmed'}
                          </div>
                        )}
                      </div>
                      {/* Upload button */}
                      {due.current && !due.paid && (
                        <button
                          onClick={() => setUploadModal(due.num)}
                          disabled={!!proof}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                            borderRadius: 9, border: 'none', fontSize: 12, fontWeight: 700, cursor: proof ? 'not-allowed' : 'pointer',
                            background: proof ? 'rgba(245,158,11,0.1)' : 'linear-gradient(135deg,#3B82F6,#8B5CF6)',
                            color: proof ? '#F59E0B' : '#fff', flexShrink: 0
                          }}
                        >
                          {proof ? <><Clock size={12} /> Pending</> : <><Upload size={12} /> Upload Proof</>}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Payment Methods link */}
            <div onClick={() => setPage('payment-methods')} style={{ background: '#141B2D', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 16, padding: '16px 20px', marginBottom: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'border-color 0.2s' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ display: 'flex', gap: -4 }}>
                  {['/cash-logo.png', '/gcash-logo.png', '/rcbc-logo.png', '/bank-logo.png'].map((logo, i) => (
                    <img key={i} src={logo} alt="" style={{ width: 28, height: 28, objectFit: 'contain', marginLeft: i > 0 ? -6 : 0, borderRadius: '50%', background: '#0B0F1A', border: '1px solid rgba(255,255,255,0.06)' }} />
                  ))}
                </div>
                <div>
                  <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 14, color: '#F0F4FF' }}>Accepted Payment Methods</div>
                  <div style={{ fontSize: 12, color: '#4B5580', marginTop: 2 }}>Cash, GCash, RCBC, Bank Transfer</div>
                </div>
              </div>
              <div style={{ color: '#8B5CF6', fontSize: 16 }}>›</div>
            </div>

            {/* Contact admin */}
            <div style={{ background: '#141B2D', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 16, padding: 20 }}>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 14, color: '#F0F4FF', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                💬 Need Help?
              </div>
              <div style={{ fontSize: 13, color: '#7A8AAA', marginBottom: 14 }}>Contact any of the following admins via <strong style={{ color: '#F0F4FF' }}>Microsoft Teams Chat</strong>:</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { initials: 'JP', name: 'John Paul Lacaron', gradient: 'linear-gradient(135deg,#3B82F6,#8B5CF6)' },
                  { initials: 'CJ', name: 'Charlou John Ramil', gradient: 'linear-gradient(135deg,#14B8A6,#3B82F6)' },
                ].map(a => (
                  <div key={a.name} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '10px 14px' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: a.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#fff', flexShrink: 0 }}>{a.initials}</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#F0F4FF' }}>{a.name}</div>
                      <div style={{ fontSize: 11, color: '#4B5580' }}>Admin · Teams Chat</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

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
