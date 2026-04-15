import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const LOAN_AMOUNTS_REGULAR = [5000, 7000, 9000, 10000]
const LOAN_AMOUNTS_QUICK = [1000, 2000, 3000]

const ALLOWED_DOMAINS = [
  'gmail.com','yahoo.com','outlook.com','hotmail.com','icloud.com',
  'live.com','msn.com','protonmail.com','mail.com','mysource.com',
  'ymail.com','googlemail.com'
]

function validateEmail(email) {
  const t = email.trim().toLowerCase()
  if (!/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(t)) return 'Please enter a valid email address'
  const domain = t.split('@')[1]
  if (!ALLOWED_DOMAINS.includes(domain)) return 'Please use a valid email provider (e.g. @gmail.com)'
  return null
}

/* ── Shared style tokens ─────────────────────────────── */
const inp = {
  width: '100%', boxSizing: 'border-box', padding: '10px 13px',
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 9, color: '#F0F4FF', fontSize: 13, outline: 'none',
  fontFamily: 'DM Sans, sans-serif', transition: 'border-color 0.2s'
}
const lbl = {
  display: 'block', fontSize: 10, color: '#7A8AAA', marginBottom: 5,
  textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700
}
const card = {
  background: '#0f1624', border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 16, overflow: 'hidden', marginBottom: 16
}
const cardHead = {
  padding: '16px 22px', borderBottom: '1px solid rgba(255,255,255,0.05)',
  display: 'flex', alignItems: 'center', gap: 10
}
const cardBody = { padding: '20px 22px' }

/* ── Helper: read-only field ─────────────────────────── */
function ReadField({ label, value }) {
  if (!value) return null
  return (
    <div>
      <div style={lbl}>{label}</div>
      <div style={{
        padding: '10px 13px', background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)', borderRadius: 9,
        fontSize: 13, color: '#CBD5F0', fontFamily: 'DM Sans, sans-serif'
      }}>{value}</div>
    </div>
  )
}

/* ── Status badge ────────────────────────────────────── */
function StatusBadge({ status }) {
  const map = {
    Pending:       { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)', icon: '⏳' },
    'Under Review':{ color: '#60A5FA', bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.3)',  icon: '🔍' },
    Denied:        { color: '#EF4444', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.3)',   icon: '❌' },
    Approved:      { color: '#22C55E', bg: 'rgba(34,197,94,0.12)',   border: 'rgba(34,197,94,0.3)',   icon: '✅' },
  }
  const s = map[status] || map['Pending']
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700,
      color: s.color, background: s.bg, border: `1px solid ${s.border}`
    }}>{s.icon} {status}</span>
  )
}

/* ── Login screen ────────────────────────────────────── */
function LoginScreen({ onLogin }) {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [approvedNoRecord, setApprovedNoRecord] = useState(false)

  const handleSubmit = async () => {
    const trimmed = code.trim().toUpperCase()
    if (!trimmed) { setError('Please enter your access code.'); return }
    setLoading(true); setError(''); setApprovedNoRecord(false)

    // Step 1: Check borrowers table first
    const { data: borrower } = await supabase
      .from('borrowers')
      .select('id, access_code')
      .eq('access_code', trimmed)
      .maybeSingle()
    if (borrower) {
      // They are a full borrower — redirect to the full portal
      setLoading(false)
      window.location.href = '/portal'
      return
    }

    // Step 2: Check applications table
    const { data: app, error: err } = await supabase
      .from('applications')
      .select('*')
      .eq('access_code', trimmed)
      .maybeSingle()
    setLoading(false)
    if (err || !app) {
      setError('Access code not found. Please check and try again.')
      return
    }

    // Step 3: Route based on application status
    if (app.status === 'Approved') {
      // Approved but not in borrowers yet — admin sync issue
      setApprovedNoRecord(true)
      return
    }
    onLogin(app)
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#07090F', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', fontFamily: 'DM Sans, sans-serif' }}>
      <style>{`
        .ap-inp:focus { border-color: rgba(99,102,241,0.5) !important; outline: none; }
        @keyframes pulse-ring { 0%,100%{box-shadow:0 0 0 0 rgba(99,102,241,0.3)} 50%{box-shadow:0 0 0 12px rgba(99,102,241,0)} }
      `}</style>

      {/* Background glow */}
      <div style={{ position:'fixed', width:500, height:500, borderRadius:'50%', background:'radial-gradient(circle,rgba(99,102,241,0.08) 0%,transparent 70%)', top:'-10%', right:'-8%', pointerEvents:'none' }} />
      <div style={{ position:'fixed', width:350, height:350, borderRadius:'50%', background:'radial-gradient(circle,rgba(59,130,246,0.06) 0%,transparent 70%)', bottom:'5%', left:'-5%', pointerEvents:'none' }} />

      <div style={{ maxWidth: 420, width: '100%', position: 'relative', zIndex: 1 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img src="/favicon-96x96.png" alt="MoneyfestLending" style={{ width: 52, height: 52, objectFit: 'contain', marginBottom: 12 }} />
          <h1 style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 26, color: '#F0F4FF', margin: '0 0 6px', letterSpacing: -0.5 }}>
            Moneyfest<span style={{ background: 'linear-gradient(90deg,#60a5fa,#a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Lending</span>
          </h1>
          <p style={{ color: '#7A8AAA', fontSize: 13, margin: 0 }}>Check your application status</p>
        </div>

        <div style={{ background: '#0f1624', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 18, padding: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6366F1', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 6 }}>
            <img src="/padlock.png" alt="lock" style={{ width: 13, height: 13, objectFit: 'contain' }} /> Enter your access code
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={lbl}>Access Code</label>
            <input
              className="ap-inp"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              placeholder="LM-XXXXXXXX"
              style={{ ...inp, textAlign: 'center', fontFamily: 'Space Grotesk, monospace', fontWeight: 800, fontSize: 18, letterSpacing: 4, textTransform: 'uppercase' }}
            />
            <div style={{ fontSize: 11, color: '#4B5580', marginTop: 5 }}>Your access code was shown after you submitted your application.</div>
          </div>
          {error && (
            <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, fontSize: 12, color: '#EF4444', marginBottom: 14 }}>{error}</div>
          )}
          {approvedNoRecord && (
            <div style={{ padding: '12px 14px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, fontSize: 12, color: '#F59E0B', marginBottom: 14, lineHeight: 1.6 }}>
              ⚠️ Your application was approved but your borrower account is still being set up. Please <a href="/contact" style={{ color: '#F59E0B', fontWeight: 700 }}>contact admin</a> to resolve this.
            </div>
          )}
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              width: '100%', padding: '13px', borderRadius: 10, border: 'none',
              background: loading ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg,#6366F1,#8B5CF6)',
              color: loading ? '#4B5580' : '#fff', fontSize: 14, fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'Space Grotesk'
            }}
          >{loading ? 'Looking up…' : '🔍 Check Application Status'}</button>
        </div>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: '#4B5580' }}>
          Don't have an access code? <a href="/apply" style={{ color: '#6366F1', textDecoration: 'none', fontWeight: 700 }}>Apply here →</a>
        </div>
        <div style={{ textAlign: 'center', marginTop: 8, fontSize: 12, color: '#4B5580' }}>
          Existing borrower? <a href="/portal" style={{ color: '#60A5FA', textDecoration: 'none', fontWeight: 700 }}>Go to Borrower Portal →</a>
        </div>
      </div>
    </div>
  )
}

/* ── Pending / Under Review screen ───────────────────── */
function PendingScreen({ app }) {
  const submitted = new Date(app.created_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
  const isQuick = app.loan_type === 'quickloan'

  return (
    <div style={{ minHeight: '100dvh', background: '#07090F', fontFamily: 'DM Sans, sans-serif', padding: 'clamp(16px,4vw,32px)' }}>
      <div style={{ maxWidth: 700, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            <img src="/favicon-96x96.png" alt="logo" style={{ width: 32, height: 32, objectFit: 'contain' }} />
            <span style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 16, color: '#F0F4FF' }}>
              Moneyfest<span style={{ background: 'linear-gradient(90deg,#60a5fa,#a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Lending</span>
            </span>
          </a>
          <StatusBadge status={app.status} />
        </div>

        {/* Status card */}
        <div style={{ background: 'linear-gradient(135deg,rgba(15,22,36,1),rgba(30,22,64,0.8))', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 18, padding: 28, marginBottom: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>{app.status === 'Under Review' ? '🔍' : '⏳'}</div>
          <h2 style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 22, color: '#F0F4FF', margin: '0 0 8px', letterSpacing: -0.3 }}>
            Application Under Review
          </h2>
          <p style={{ color: '#7A8AAA', fontSize: 14, lineHeight: 1.7, margin: '0 0 16px' }}>
            Hi <strong style={{ color: '#F0F4FF' }}>{app.full_name}</strong> — your application is currently being reviewed.<br />
            We'll notify you once a decision has been made.
          </p>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 10, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', fontSize: 12, color: '#818CF8' }}>
            📋 Access Code: <strong style={{ fontFamily: 'Space Grotesk', fontSize: 14, letterSpacing: 2 }}>{app.access_code}</strong>
          </div>
        </div>

        {/* Summary */}
        <div style={card}>
          <div style={cardHead}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>📄</div>
            <div>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 14, color: '#F0F4FF' }}>Application Summary</div>
              <div style={{ fontSize: 11, color: '#4B5580', marginTop: 1 }}>Submitted {submitted}</div>
            </div>
          </div>
          <div style={{ ...cardBody, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <ReadField label="Full Name" value={app.full_name} />
            <ReadField label="Department" value={app.department} />
            <ReadField label="Phone" value={app.phone} />
            <ReadField label="Email" value={app.email} />
            <ReadField label="Loan Type" value={isQuick ? '⚡ QuickLoan' : '📅 Installment Loan'} />
            <ReadField label="Loan Amount" value={`₱${parseFloat(app.loan_amount || 0).toLocaleString('en-PH')}`} />
            {!isQuick && <ReadField label="Loan Term" value={app.loan_term ? `${app.loan_term} month${app.loan_term > 1 ? 's' : ''}` : null} />}
            <ReadField label="Loan Purpose" value={app.loan_purpose} />
            <ReadField label="Release Method" value={app.release_method} />
          </div>
        </div>

        <div style={{ textAlign: 'center', fontSize: 12, color: '#4B5580', marginTop: 12 }}>
          Questions? <a href="/contact" style={{ color: '#6366F1', textDecoration: 'none', fontWeight: 600 }}>Contact us →</a>
        </div>
      </div>
    </div>
  )
}

/* ── Approved screen ─────────────────────────────────── */
function ApprovedScreen({ app }) {
  return (
    <div style={{ minHeight: '100dvh', background: '#07090F', fontFamily: 'DM Sans, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
        <h2 style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 28, color: '#F0F4FF', margin: '0 0 10px', letterSpacing: -0.5 }}>You're Approved!</h2>
        <p style={{ color: '#7A8AAA', fontSize: 14, lineHeight: 1.7, margin: '0 0 24px' }}>
          Congratulations, <strong style={{ color: '#F0F4FF' }}>{app.full_name}</strong>! Your application has been approved and you are now an official MoneyfestLending borrower. Access your full dashboard below.
        </p>
        <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 14, padding: '16px 20px', marginBottom: 24 }}>
          <div style={{ fontSize: 11, color: '#4B5580', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Your Access Code</div>
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 24, letterSpacing: 6, color: '#22C55E' }}>{app.access_code}</div>
          <div style={{ fontSize: 12, color: '#4B5580', marginTop: 4 }}>Use this to log in to the Borrower Portal</div>
        </div>
        <a href="/portal" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '14px', borderRadius: 12, border: 'none',
          background: 'linear-gradient(135deg,#22C55E,#3B82F6)',
          color: '#fff', fontSize: 14, fontWeight: 700, textDecoration: 'none',
          fontFamily: 'Space Grotesk', cursor: 'pointer'
        }}>
          <img src="/startup.png" alt="portal" style={{ width: 16, height: 16, objectFit: 'contain' }} />
          Go to Borrower Portal →
        </a>
      </div>
    </div>
  )
}

/* ── Denied screen + reapply form ────────────────────── */
function DeniedScreen({ app, departments }) {
  const [showReapply, setShowReapply] = useState(false)
  const [resubmitted, setResubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  /* Pre-fill form from previous app */
  const isQuick = app.loan_type === 'quickloan'
  const [form, setForm] = useState({
    full_name: app.full_name || '',
    department: app.department || '',
    custom_department: '',
    tenure_years: app.tenure_years?.toString() || '',
    phone: app.phone || '',
    email: app.email || '',
    address: app.address || '',
    loan_type: app.loan_type || 'regular',
    loan_amount: app.loan_amount ? parseFloat(app.loan_amount) : '',
    loan_purpose: app.loan_purpose || '',
    loan_term: app.loan_term || 2,
    release_method: app.release_method || '',
    building: app.building || '',
    gcash_number: app.gcash_number || '',
    gcash_name: app.gcash_name || '',
    bank_name: app.bank_name || '',
    bank_account_number: app.bank_account_number || '',
    bank_account_confirm: app.bank_account_number || '',
    bank_account_holder: app.bank_account_holder || '',
    agreed: false,
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const validate = () => {
    if (!form.full_name.trim()) return 'Full name is required'
    if (!form.department) return 'Department is required'
    if (form.department === 'Other' && !form.custom_department?.trim()) return 'Please specify your department'
    if (!form.phone.trim()) return 'Phone number is required'
    if (!form.email.trim()) return 'Email is required'
    const emailErr = validateEmail(form.email)
    if (emailErr) return emailErr
    if (!form.loan_amount) return 'Please select a loan amount'
    if (!form.loan_purpose.trim()) return 'Loan purpose is required'
    if (!form.release_method) return 'Please select a release method'
    if (form.release_method === 'GCash') {
      if (!form.gcash_number.trim()) return 'GCash number is required'
      if (!form.gcash_name.trim()) return 'GCash full name is required'
    }
    if ((form.release_method === 'RCBC' || form.release_method === 'Other Bank Transfer')) {
      if (!form.bank_account_number.trim()) return 'Account number is required'
      if (!form.bank_account_holder.trim()) return 'Account holder name is required'
      if (form.bank_account_number.trim() !== form.bank_account_confirm.trim()) return 'Account numbers do not match'
    }
    if (!form.agreed) return 'You must agree to the Terms & Conditions'
    return null
  }

  const handleResubmit = async () => {
    const err = validate(); if (err) { setError(err); return }
    setLoading(true); setError('')
    const { error: dbErr } = await supabase.from('applications').update({
      full_name:          form.full_name.trim(),
      department:         form.department === 'Other' ? form.custom_department.trim() : form.department,
      tenure_years:       parseFloat(form.tenure_years) || 0,
      phone:              form.phone.trim(),
      email:              form.email.trim(),
      address:            form.address.trim(),
      loan_type:          form.loan_type,
      loan_amount:        parseFloat(form.loan_amount),
      loan_purpose:       form.loan_purpose.trim(),
      loan_term:          form.loan_type === 'quickloan' ? null : (form.loan_term || 2),
      release_method:     form.release_method,
      building:           form.building,
      gcash_number:       form.gcash_number.trim() || null,
      gcash_name:         form.gcash_name.trim() || null,
      bank_name:          form.bank_name.trim() || null,
      bank_account_number: form.bank_account_number.trim() || null,
      bank_account_holder: form.bank_account_holder.trim() || null,
      status:             'Pending',
      rejection_reason:   null,
      reviewed_at:        null,
      is_reapplication:   true,
    }).eq('id', app.id)
    setLoading(false)
    if (dbErr) { setError('Resubmission failed. Please try again.'); return }
    setResubmitted(true)
  }

  /* ── Success after resubmit ── */
  if (resubmitted) return (
    <div style={{ minHeight: '100dvh', background: '#07090F', fontFamily: 'DM Sans, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 460, width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
        <h2 style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 26, color: '#F0F4FF', margin: '0 0 10px', letterSpacing: -0.5 }}>Reapplication Submitted!</h2>
        <p style={{ color: '#7A8AAA', fontSize: 14, lineHeight: 1.7, margin: '0 0 24px' }}>
          Your application has been resubmitted for review. <strong style={{ color: '#F0F4FF' }}>Your access code remains the same</strong> — use it to check your status anytime.
        </p>
        <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 14, padding: '16px 20px', marginBottom: 24 }}>
          <div style={{ fontSize: 11, color: '#4B5580', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Your Access Code</div>
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 24, letterSpacing: 6, color: '#a78bfa' }}>{app.access_code}</div>
          <div style={{ fontSize: 12, color: '#4B5580', marginTop: 4 }}>Check your status using this code</div>
        </div>
        <button onClick={() => window.location.reload()} style={{
          width: '100%', padding: '13px', borderRadius: 12, border: 'none',
          background: 'linear-gradient(135deg,#6366F1,#8B5CF6)', color: '#fff',
          fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'Space Grotesk'
        }}>🔄 Check Status Now</button>
      </div>
    </div>
  )

  const submittedDate = new Date(app.created_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
  const prevIsQuick = app.loan_type === 'quickloan'

  /* ── Main denial screen ── */
  return (
    <div style={{ minHeight: '100dvh', background: '#07090F', fontFamily: 'DM Sans, sans-serif', padding: 'clamp(16px,4vw,32px)' }}>
      <style>{`
        .ap-inp:focus { border-color: rgba(99,102,241,0.5) !important; outline: none; }
        .amt-chip { border-radius: 10px; cursor: pointer; text-align: center; transition: all 0.15s; padding: 14px 10px; }
        .amt-chip:hover { transform: translateY(-2px); }
        .rel-opt { padding: 11px 14px; border-radius: 10px; cursor: pointer; text-align: left; display: flex; justify-content: space-between; align-items: center; gap: 10px; transition: all 0.15s; width: 100%; }
        .rel-opt:hover { background: rgba(255,255,255,0.04) !important; }
      `}</style>

      <div style={{ maxWidth: 700, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            <img src="/favicon-96x96.png" alt="logo" style={{ width: 30, height: 30, objectFit: 'contain' }} />
            <span style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 15, color: '#F0F4FF' }}>
              Moneyfest<span style={{ background: 'linear-gradient(90deg,#60a5fa,#a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Lending</span>
            </span>
          </a>
          <StatusBadge status="Denied" />
        </div>

        {/* Denial banner */}
        <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 16, padding: '22px 24px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div style={{ fontSize: 36, flexShrink: 0 }}>❌</div>
            <div>
              <h2 style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 20, color: '#FCA5A5', margin: '0 0 6px', letterSpacing: -0.3 }}>
                Application Not Approved
              </h2>
              <p style={{ color: '#7A8AAA', fontSize: 13, lineHeight: 1.7, margin: '0 0 12px' }}>
                Hi <strong style={{ color: '#F0F4FF' }}>{app.full_name}</strong>, unfortunately your application submitted on <strong style={{ color: '#F0F4FF' }}>{submittedDate}</strong> was not approved.
              </p>
              {app.rejection_reason && (
                <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: '#FCA5A5', lineHeight: 1.6 }}>
                  <strong style={{ display: 'block', marginBottom: 4, color: '#EF4444' }}>Reason:</strong>
                  {app.rejection_reason}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Previous application summary */}
        <div style={card}>
          <div style={cardHead}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>📋</div>
            <div>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 14, color: '#F0F4FF' }}>Previous Application Details</div>
              <div style={{ fontSize: 11, color: '#4B5580', marginTop: 1 }}>Submitted {submittedDate}</div>
            </div>
          </div>
          <div style={{ ...cardBody, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <ReadField label="Full Name" value={app.full_name} />
            <ReadField label="Department" value={app.department} />
            <ReadField label="Phone" value={app.phone} />
            <ReadField label="Email" value={app.email} />
            <ReadField label="Loan Type" value={prevIsQuick ? '⚡ QuickLoan' : '📅 Installment Loan'} />
            <ReadField label="Loan Amount" value={`₱${parseFloat(app.loan_amount || 0).toLocaleString('en-PH')}`} />
            <ReadField label="Loan Purpose" value={app.loan_purpose} />
            <ReadField label="Release Method" value={app.release_method} />
            <ReadField label="Access Code" value={app.access_code} />
          </div>
        </div>

        {/* Reapply toggle */}
        {!showReapply && (
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <button onClick={() => setShowReapply(true)} style={{
              padding: '14px 32px', borderRadius: 12, border: 'none',
              background: 'linear-gradient(135deg,#6366F1,#8B5CF6)',
              color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'Space Grotesk', display: 'inline-flex', alignItems: 'center', gap: 8
            }}>🔄 Reapply Now</button>
            <div style={{ fontSize: 12, color: '#4B5580', marginTop: 8 }}>
              Your access code will remain the same. Your previous data is pre-filled below.
            </div>
          </div>
        )}

        {/* ── Reapply Form ─────────────────────────────── */}
        {showReapply && (
          <div>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 18, color: '#F0F4FF', margin: '0 0 16px', letterSpacing: -0.3 }}>
              ✏️ Update &amp; Resubmit Application
            </div>

            {/* Personal Info */}
            <div style={card}>
              <div style={cardHead}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>👤</div>
                <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 14, color: '#F0F4FF' }}>Personal Information</div>
              </div>
              <div style={{ ...cardBody, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div><label style={lbl}>Full Name *</label><input className="ap-inp" value={form.full_name} onChange={e => set('full_name', e.target.value)} style={inp} /></div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                  <div>
                    <label style={lbl}>Department *</label>
                    <select className="ap-inp" value={form.department} onChange={e => { set('department', e.target.value); set('custom_department', '') }} style={{ ...inp, appearance: 'none', cursor: 'pointer' }}>
                      <option value="">Select Department…</option>
                      {departments.map(d => <option key={d} value={d}>{d}</option>)}
                      <option value="Other">Other (Please specify)</option>
                    </select>
                    {form.department === 'Other' && (
                      <input className="ap-inp" value={form.custom_department} onChange={e => set('custom_department', e.target.value)} placeholder="Type your department" style={{ ...inp, marginTop: 8 }} />
                    )}
                  </div>
                  <div>
                    <label style={lbl}>Assigned Building</label>
                    <select className="ap-inp" value={form.building} onChange={e => set('building', e.target.value)} style={{ ...inp, appearance: 'none', cursor: 'pointer' }}>
                      <option value="">Select Building…</option>
                      <option value="Ng Khai">Ng Khai</option>
                      <option value="Epic">Epic</option>
                    </select>
                  </div>
                </div>
                <div><label style={lbl}>Years of Tenure</label><input className="ap-inp" value={form.tenure_years} onChange={e => set('tenure_years', e.target.value)} type="number" min="0" step="0.5" style={inp} /></div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                  <div><label style={lbl}>Phone *</label><input className="ap-inp" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="09XX XXX XXXX" style={inp} /></div>
                  <div>
                    <label style={lbl}>Email *</label>
                    <input className="ap-inp" value={form.email} onChange={e => set('email', e.target.value)} type="email" style={{ ...inp, borderColor: form.email && validateEmail(form.email) ? 'rgba(239,68,68,0.5)' : form.email && !validateEmail(form.email) ? 'rgba(34,197,94,0.4)' : undefined }} />
                    {form.email && validateEmail(form.email) && <div style={{ fontSize: 11, color: '#EF4444', marginTop: 4 }}>{validateEmail(form.email)}</div>}
                    {form.email && !validateEmail(form.email) && <div style={{ fontSize: 11, color: '#22C55E', marginTop: 4 }}>✓ Valid email</div>}
                  </div>
                </div>
                <div><label style={lbl}>Home Address</label><textarea className="ap-inp" value={form.address} onChange={e => set('address', e.target.value)} rows={2} style={{ ...inp, resize: 'none' }} /></div>
              </div>
            </div>

            {/* Loan Type */}
            <div style={card}>
              <div style={cardHead}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>⚡</div>
                <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 14, color: '#F0F4FF' }}>Loan Type</div>
              </div>
              <div style={{ ...cardBody, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                {[
                  { value: 'regular',   label: 'Installment Loan', sub: 'Up to ₱10,000 · 2–3 months', color: '#3B82F6' },
                  { value: 'quickloan', label: '⚡ QuickLoan',       sub: 'Up to ₱3,000 · pay anytime', color: '#F59E0B' },
                ].map(opt => (
                  <button key={opt.value} onClick={() => { set('loan_type', opt.value); set('loan_amount', '') }}
                    style={{ border: `2px solid ${form.loan_type === opt.value ? opt.color : 'rgba(255,255,255,0.07)'}`, background: form.loan_type === opt.value ? `${opt.color}18` : 'rgba(255,255,255,0.02)', borderRadius: 10, padding: '14px 16px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
                    <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 13, color: form.loan_type === opt.value ? opt.color : '#7A8AAA', marginBottom: 4 }}>{opt.label}</div>
                    <div style={{ fontSize: 11, color: '#4B5580', lineHeight: 1.5 }}>{opt.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Loan Details */}
            <div style={card}>
              <div style={cardHead}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>₱</div>
                <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 14, color: '#F0F4FF' }}>Loan Details</div>
              </div>
              <div style={{ ...cardBody, display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Amount picker */}
                <div>
                  <label style={lbl}>Loan Amount *</label>
                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${form.loan_type === 'quickloan' ? 3 : 2}, 1fr)`, gap: 10 }}>
                    {(form.loan_type === 'quickloan' ? LOAN_AMOUNTS_QUICK : LOAN_AMOUNTS_REGULAR).map(amt => (
                      <button key={amt} className="amt-chip" onClick={() => set('loan_amount', amt)}
                        style={{ border: `2px solid ${form.loan_amount === amt ? (form.loan_type === 'quickloan' ? '#F59E0B' : '#3B82F6') : 'rgba(255,255,255,0.07)'}`, background: form.loan_amount === amt ? (form.loan_type === 'quickloan' ? 'rgba(245,158,11,0.1)' : 'rgba(59,130,246,0.1)') : 'rgba(255,255,255,0.02)' }}>
                        <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 17, color: form.loan_amount === amt ? (form.loan_type === 'quickloan' ? '#F59E0B' : '#22C55E') : '#7A8AAA' }}>₱{amt.toLocaleString()}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div><label style={lbl}>Loan Purpose *</label><textarea className="ap-inp" value={form.loan_purpose} onChange={e => set('loan_purpose', e.target.value)} rows={2} style={{ ...inp, resize: 'none' }} placeholder="e.g. Bills, Medical, Allowance…" /></div>

                {form.loan_type !== 'quickloan' && (
                  <div>
                    <label style={lbl}>Loan Term *</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                      {[{ term: 2, label: '2 Months', sub: '4 installments · 14% total interest' }, { term: 3, label: '3 Months', sub: '6 installments · 21% total interest' }].map(({ term, label, sub }) => (
                        <button key={term} onClick={() => set('loan_term', term)} style={{ border: `2px solid ${form.loan_term === term ? '#8B5CF6' : 'rgba(255,255,255,0.07)'}`, background: form.loan_term === term ? 'rgba(139,92,246,0.12)' : 'rgba(255,255,255,0.02)', borderRadius: 10, padding: '12px 14px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
                          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 14, color: form.loan_term === term ? '#a78bfa' : '#7A8AAA' }}>{label}</div>
                          <div style={{ fontSize: 10, color: form.loan_term === term ? '#8B5CF6' : '#4B5580', marginTop: 3 }}>{sub}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Release Method */}
            <div style={card}>
              <div style={cardHead}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>💳</div>
                <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 14, color: '#F0F4FF' }}>Release Method</div>
              </div>
              <div style={{ ...cardBody, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { value: 'Physical Cash', logo: '/cash-logo.png',    desc: 'Receive in cash. No transaction fee.' },
                  { value: 'GCash',          logo: '/gcash-logo.png',   desc: 'Sent to your GCash number.' },
                  { value: 'RCBC',           logo: '/rcbc-logo.png',    desc: 'Transferred to your RCBC account.' },
                  { value: 'Other Bank Transfer', logo: '/bank-logo.png', desc: 'Instapay/PESONet. Borrower covers fee.' },
                ].map(opt => (
                  <button key={opt.value} className="rel-opt" onClick={() => set('release_method', opt.value)}
                    style={{ border: `2px solid ${form.release_method === opt.value ? '#3B82F6' : 'rgba(255,255,255,0.07)'}`, background: form.release_method === opt.value ? 'rgba(59,130,246,0.08)' : 'rgba(255,255,255,0.02)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                      <img src={opt.logo} alt={opt.value} style={{ width: 24, height: 24, objectFit: 'contain' }} />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: form.release_method === opt.value ? '#F0F4FF' : '#7A8AAA' }}>{opt.value}</div>
                        <div style={{ fontSize: 11, color: '#4B5580' }}>{opt.desc}</div>
                      </div>
                    </div>
                  </button>
                ))}

                {form.release_method === 'GCash' && (
                  <div style={{ marginTop: 10, padding: 14, background: 'rgba(0,163,255,0.05)', border: '1px solid rgba(0,163,255,0.2)', borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ fontWeight: 700, fontSize: 12, color: '#60B8FF' }}>📱 GCash Details</div>
                    <div><label style={lbl}>GCash Number *</label><input className="ap-inp" value={form.gcash_number} onChange={e => set('gcash_number', e.target.value)} placeholder="09XX XXX XXXX" style={inp} /></div>
                    <div><label style={lbl}>GCash Full Name *</label><input className="ap-inp" value={form.gcash_name} onChange={e => set('gcash_name', e.target.value)} placeholder="Full name on GCash" style={inp} /></div>
                  </div>
                )}
                {form.release_method === 'RCBC' && (
                  <div style={{ marginTop: 10, padding: 14, background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ fontWeight: 700, fontSize: 12, color: '#F87171' }}>🏦 RCBC Account Details</div>
                    <div><label style={lbl}>Account Holder Name *</label><input className="ap-inp" value={form.bank_account_holder} onChange={e => set('bank_account_holder', e.target.value)} placeholder="Full name on the account" style={inp} /></div>
                    <div><label style={lbl}>Account Number *</label><input className="ap-inp" value={form.bank_account_number} onChange={e => set('bank_account_number', e.target.value)} style={inp} /></div>
                    <div>
                      <label style={lbl}>Confirm Account Number *</label>
                      <input className="ap-inp" value={form.bank_account_confirm} onChange={e => set('bank_account_confirm', e.target.value)} style={{ ...inp, borderColor: form.bank_account_confirm ? (form.bank_account_confirm === form.bank_account_number ? '#22C55E' : '#EF4444') : undefined }} />
                      {form.bank_account_confirm && form.bank_account_confirm !== form.bank_account_number && <div style={{ fontSize: 11, color: '#EF4444', marginTop: 4 }}>⚠️ Numbers do not match</div>}
                    </div>
                  </div>
                )}
                {form.release_method === 'Other Bank Transfer' && (
                  <div style={{ marginTop: 10, padding: 14, background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ fontWeight: 700, fontSize: 12, color: '#A78BFA' }}>🏦 Bank Account Details</div>
                    <div><label style={lbl}>Bank Name *</label><input className="ap-inp" value={form.bank_name} onChange={e => set('bank_name', e.target.value)} placeholder="e.g. BDO, BPI, Metrobank" style={inp} /></div>
                    <div><label style={lbl}>Account Holder Name *</label><input className="ap-inp" value={form.bank_account_holder} onChange={e => set('bank_account_holder', e.target.value)} style={inp} /></div>
                    <div><label style={lbl}>Account Number *</label><input className="ap-inp" value={form.bank_account_number} onChange={e => set('bank_account_number', e.target.value)} style={inp} /></div>
                    <div>
                      <label style={lbl}>Confirm Account Number *</label>
                      <input className="ap-inp" value={form.bank_account_confirm} onChange={e => set('bank_account_confirm', e.target.value)} style={{ ...inp, borderColor: form.bank_account_confirm ? (form.bank_account_confirm === form.bank_account_number ? '#22C55E' : '#EF4444') : undefined }} />
                      {form.bank_account_confirm && form.bank_account_confirm !== form.bank_account_number && <div style={{ fontSize: 11, color: '#EF4444', marginTop: 4 }}>⚠️ Numbers do not match</div>}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Agree & Submit */}
            <div style={card}>
              <div style={cardBody}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', marginBottom: 14 }}>
                  <div onClick={() => set('agreed', !form.agreed)} style={{ marginTop: 2, width: 16, height: 16, borderRadius: 4, flexShrink: 0, border: `2px solid ${form.agreed ? '#3B82F6' : 'rgba(255,255,255,0.2)'}`, background: form.agreed ? '#3B82F6' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', cursor: 'pointer' }}>
                    {form.agreed && <span style={{ color: '#fff', fontSize: 10, fontWeight: 800 }}>✓</span>}
                  </div>
                  <span style={{ fontSize: 13, color: '#7A8AAA', lineHeight: 1.6 }}>
                    I have read and agree to the <a href="/terms" target="_blank" rel="noreferrer" style={{ color: '#F0F4FF', fontWeight: 700 }}>Terms &amp; Conditions</a> and <a href="/privacy" target="_blank" rel="noreferrer" style={{ color: '#60A5FA', fontWeight: 600 }}>Privacy Notice</a>.
                  </span>
                </label>

                {error && <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, fontSize: 13, color: '#EF4444', marginBottom: 14 }}>{error}</div>}

                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setShowReapply(false)} style={{ padding: '13px 18px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: '#7A8AAA', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>← Cancel</button>
                  <button onClick={handleResubmit} disabled={loading} style={{
                    flex: 1, padding: '13px', borderRadius: 10, border: 'none',
                    background: loading ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg,#22C55E,#3B82F6)',
                    color: loading ? '#4B5580' : '#fff', fontSize: 14, fontWeight: 700,
                    cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'Space Grotesk'
                  }}>
                    {loading ? 'Resubmitting…' : '🔄 Resubmit Application'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div style={{ textAlign: 'center', fontSize: 12, color: '#4B5580', marginTop: 12, paddingBottom: 40 }}>
          Questions? <a href="/contact" style={{ color: '#6366F1', textDecoration: 'none', fontWeight: 600 }}>Contact us →</a>
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════
   Main export
══════════════════════════════════════════════════════ */
export default function ApplicantStatusPage() {
  const location = useLocation()
  // Accept pre-loaded app data passed via React Router state (e.g. from BorrowerPortalPage)
  const [app, setApp] = useState(location.state?.app || null)
  const [departments, setDepartments] = useState([])

  useEffect(() => {
    supabase.from('departments').select('name').eq('active', true).order('name')
      .then(({ data }) => { if (data) setDepartments(data.map(d => d.name)) })
  }, [])

  if (!app) return <LoginScreen onLogin={setApp} />

  if (app.status === 'Approved') return <ApprovedScreen app={app} />
  if (app.status === 'Denied')   return <DeniedScreen app={app} departments={departments} />
  /* Pending / Under Review */
  return <PendingScreen app={app} />
}
