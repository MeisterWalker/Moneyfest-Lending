import { useState, useEffect } from 'react'
import { calcSecurityHold, CREDIT_CONFIG } from '../lib/creditSystem'
import { supabase } from '../lib/supabase'
import { sendPendingEmail } from '../lib/emailService'
import { usePageVisit } from '../hooks/usePageVisit'

const DEPARTMENTS = ['Minto Money', 'Greyhound']
const LOAN_AMOUNTS = [5000, 7000, 9000, 10000]

const ALLOWED_DOMAINS = [
  'gmail.com','yahoo.com','outlook.com','hotmail.com','icloud.com',
  'live.com','msn.com','protonmail.com','mail.com','mysource.com',
  'ymail.com','googlemail.com'
]

function validateEmail(email) {
  const trimmed = email.trim().toLowerCase()
  if (!/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(trimmed)) return 'Please enter a valid email address'
  const domain = trimmed.split('@')[1]
  if (!ALLOWED_DOMAINS.includes(domain)) return 'Please use a valid email provider (e.g. @gmail.com, @yahoo.com)'
  return null
}

export default function PublicApplyPage() {
  usePageVisit('apply')
  const [step, setStep] = useState(1)
  const [submitted, setSubmitted] = useState(false)
  const [accessCode, setAccessCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showDisclaimer, setShowDisclaimer] = useState(false)
  const [showTnC, setShowTnC] = useState(false)
  const [tncScrolled, setTncScrolled] = useState(false)
  const [disclaimerCountdown, setDisclaimerCountdown] = useState(4)
  const [pendingAmount, setPendingAmount] = useState(null)
  const [interestRate, setInterestRate] = useState(0.07)

  useEffect(() => {
    supabase.from('settings').select('interest_rate').eq('id', 1).single()
      .then(({ data }) => { if (data?.interest_rate) setInterestRate(data.interest_rate) })
  }, [])

  const [form, setForm] = useState({
    full_name: '', department: '', tenure_years: '', phone: '', email: '', address: '',

    loan_amount: '', loan_purpose: '', release_method: '',
    gcash_number: '', gcash_name: '', bank_account_number: '', bank_account_confirm: '', bank_account_holder: '', bank_name: '',
    agreed: false
  })
  const [idFile, setIdFile] = useState(null)
  const [idFileBack, setIdFileBack] = useState(null)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const startDisclaimer = (amt) => { setPendingAmount(amt); setDisclaimerCountdown(4); setShowDisclaimer(true) }
  useEffect(() => {
    if (!showDisclaimer || disclaimerCountdown <= 0) return
    const t = setTimeout(() => setDisclaimerCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [showDisclaimer, disclaimerCountdown])

  const confirmDisclaimer = () => { set('loan_amount', pendingAmount); setShowDisclaimer(false); setPendingAmount(null) }


  const validateStep1 = () => {
    if (!form.full_name.trim()) return 'Please enter your full name'
    if (!form.department) return 'Please select your department'
    if (!form.tenure_years) return 'Please enter your tenure'
    if (!form.phone.trim()) return 'Please enter your phone number'
    if (!form.email.trim()) return 'Please enter your email'
    const emailErr = validateEmail(form.email)
    if (emailErr) return emailErr
    if (!form.address.trim()) return 'Please enter your address'
    return null
  }

  const validateStep2 = () => {
    const allowed = ['image/jpeg','image/png','image/jpg','application/pdf']
    if (!idFile) return 'Please upload the front of your ID'
    if (!allowed.includes(idFile.type)) return 'ID front must be a JPG, PNG, or PDF file'
    if (idFile.size > 5 * 1024 * 1024) return 'ID front must be under 5MB'
    if (!idFileBack) return 'Please upload the back of your ID'
    if (!allowed.includes(idFileBack.type)) return 'ID back must be a JPG, PNG, or PDF file'
    if (idFileBack.size > 5 * 1024 * 1024) return 'ID back must be under 5MB'
    return null
  }

  const validateStep3 = () => {
    if (!form.loan_amount) return 'Please select a loan amount'
    if (!form.loan_purpose.trim()) return 'Please enter your loan purpose'
    if (!form.release_method) return 'Please select a preferred release method'
    if (form.release_method === 'GCash') {
      if (!form.gcash_number.trim()) return 'Please enter your GCash number'
      if (!form.gcash_name.trim()) return 'Please enter your GCash full name'
    }
    if (form.release_method === 'RCBC' && !form.bank_account_number.trim()) return 'Please enter your RCBC account number'
    if (form.release_method === 'RCBC' && !form.bank_account_holder.trim()) return 'Please enter the account holder name for your RCBC account'
    if (form.release_method === 'RCBC' && form.bank_account_number.trim() !== form.bank_account_confirm.trim()) return 'RCBC account numbers do not match — please re-enter'
    if (form.release_method === 'Other Bank Transfer') {
      if (!form.bank_name.trim()) return 'Please enter your bank name'
      if (!form.bank_account_number.trim()) return 'Please enter your account number'
      if (!form.bank_account_holder.trim()) return 'Please enter the account holder name'
      if (form.bank_account_number.trim() !== form.bank_account_confirm.trim()) return 'Account numbers do not match — please re-enter'
    }
    if (!form.agreed) return 'Please agree to the terms and conditions'
    return null
  }

  const handleNext = () => {
    if (step === 1) {
      const err = validateStep1()
      if (err) { setError(err); return }
      setError(''); setStep(2)
    } else if (step === 2) {
      const err = validateStep2()
      if (err) { setError(err); return }
      setError(''); setStep(3)
    }
  }

  const handleSubmit = async () => {
    const err = validateStep3()
    if (err) { setError(err); return }
    setError(''); setLoading(true)
    const code = 'LM-' + Math.random().toString(36).substring(2, 6).toUpperCase()

    // Upload ID front and back to Supabase Storage
    let validIdPath = null
    let validIdBackPath = null
    if (idFile) {
      const ext = idFile.name.split('.').pop()
      const filePath = `${code}/${Date.now()}-id-front.${ext}`
      const { error: uploadErr } = await supabase.storage
        .from('valid-ids')
        .upload(filePath, idFile, { contentType: idFile.type, upsert: false })
      if (uploadErr) {
        setError('Failed to upload ID front. Please try again.')
        setLoading(false)
        return
      }
      validIdPath = filePath
    }
    if (idFileBack) {
      const ext = idFileBack.name.split('.').pop()
      const filePath = `${code}/${Date.now()}-id-back.${ext}`
      const { error: uploadErr } = await supabase.storage
        .from('valid-ids')
        .upload(filePath, idFileBack, { contentType: idFileBack.type, upsert: false })
      if (uploadErr) {
        setError('Failed to upload ID back. Please try again.')
        setLoading(false)
        return
      }
      validIdBackPath = filePath
    }

    const { error: dbErr } = await supabase.from('applications').insert({
      full_name: form.full_name.trim(), department: form.department,
      tenure_years: parseFloat(form.tenure_years) || 0,
      phone: form.phone.trim(), email: form.email.trim(), address: form.address.trim(),
      loan_amount: parseFloat(form.loan_amount), loan_purpose: form.loan_purpose.trim(),
      release_method: form.release_method,
      gcash_number: form.gcash_number.trim() || null, gcash_name: form.gcash_name.trim() || null,
      bank_account_number: form.bank_account_number.trim() || null, bank_name: form.bank_name.trim() || null, bank_account_holder: form.bank_account_holder.trim() || null,
      valid_id_path: validIdPath,
      valid_id_back_path: validIdBackPath,
      status: 'Pending', access_code: code, created_at: new Date().toISOString()
    })
    setLoading(false)
    if (dbErr) { setError('Submission failed. Please try again.'); return }
    if (form.email.trim()) {
      await sendPendingEmail({ to: form.email.trim(), borrowerName: form.full_name.trim(), accessCode: code, loanAmount: parseFloat(form.loan_amount) })
    }
    setAccessCode(code); setSubmitted(true)
  }

  const inp = {
    width: '100%', boxSizing: 'border-box', padding: '10px 13px',
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 9, color: '#F0F4FF', fontSize: 13.5, outline: 'none',
    fontFamily: 'DM Sans, sans-serif', transition: 'border-color 0.2s'
  }
  const lbl = { display: 'block', fontSize: 11, color: '#7A8AAA', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }

  // ── Success screen ──────────────────────────────────────────
  if (submitted) return (
    <div style={{ minHeight: '100vh', background: '#0B0F1A', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, position: 'relative', overflow: 'hidden' }}>

      {/* Confetti canvas */}
      <style>{`
        @keyframes confettiFall {
          0%   { transform: translateY(-20px) rotate(0deg);   opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
        @keyframes confettiSway {
          0%, 100% { margin-left: 0px; }
          25%       { margin-left: 30px; }
          75%       { margin-left: -30px; }
        }
        .confetti-piece {
          position: fixed;
          top: -20px;
          animation: confettiFall linear forwards, confettiSway ease-in-out infinite;
          z-index: 0;
          border-radius: 2px;
          pointer-events: none;
        }
      `}</style>

      {/* Generate confetti pieces */}
      {Array.from({ length: 80 }, (_, i) => {
        const colors = ['#3B82F6','#8B5CF6','#22C55E','#F59E0B','#EF4444','#14B8A6','#EC4899','#F97316','#A78BFA','#34D399']
        const color = colors[i % colors.length]
        const left = (i * 1.27) % 100
        const delay = (i * 0.07) % 3
        const duration = 2.5 + (i % 4) * 0.5
        const width = 6 + (i % 3) * 4
        const height = 8 + (i % 4) * 4
        const isCircle = i % 5 === 0
        return (
          <div key={i} className="confetti-piece" style={{
            left: left + 'vw',
            width: isCircle ? width : width,
            height: isCircle ? width : height,
            borderRadius: isCircle ? '50%' : '2px',
            background: color,
            animationDuration: duration + 's, ' + (duration * 0.8) + 's',
            animationDelay: delay + 's, ' + delay + 's',
            opacity: 0.9,
          }} />
        )
      })}

      <div style={{ textAlign: 'center', maxWidth: 480, width: '100%', position: 'relative', zIndex: 1 }}>
        <img src="/verified.png" alt="verified" style={{ width: 80, height: 80, objectFit: "contain", marginBottom: 16 }} />
        <h2 style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 28, color: '#F0F4FF', margin: '0 0 12px', letterSpacing: -0.5 }}>Application Submitted!</h2>
        <p style={{ color: '#7A8AAA', fontSize: 15, lineHeight: 1.7, marginBottom: 20 }}>
          Thank you <strong style={{ color: '#F0F4FF' }}>{form.full_name}</strong>! Your application is now under review. Our admin will get back to you shortly.
        </p>
        <div style={{ background: 'linear-gradient(135deg,#0f1729,#1a1040)', border: '2px solid rgba(139,92,246,0.4)', borderRadius: 16, padding: '22px 28px', marginBottom: 16 }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#4B5580', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><img src="/padlock.png" alt="access" style={{ width: 14, height: 14, objectFit: 'contain' }} />Your Portal Access Code</div>
          <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: 8, color: '#F0F4FF', fontFamily: 'monospace', marginBottom: 10 }}>{accessCode}</div>
          <div style={{ fontSize: 12, color: '#4B5580', marginBottom: 16 }}>Use this to track your application in the Borrower Portal</div>
          <a href="/portal" style={{ display: 'inline-block', background: 'linear-gradient(135deg,#3B82F6,#8B5CF6)', color: '#fff', textDecoration: 'none', padding: '11px 28px', borderRadius: 10, fontSize: 13, fontWeight: 700, fontFamily: 'Space Grotesk' }}>
            Check Status in Portal →
          </a>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          <div style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 12, padding: '14px 16px', textAlign: 'left' }}>
            <div style={{ fontSize: 11, color: '#4B5580', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Amount</div>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 18, color: '#22C55E' }}>₱{parseFloat(form.loan_amount).toLocaleString()}</div>
          </div>
          <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 12, padding: '14px 16px', textAlign: 'left' }}>
            <div style={{ fontSize: 11, color: '#4B5580', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</div>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 18, color: '#F59E0B' }}>Pending</div>
          </div>
        </div>
        <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 12, padding: '16px 20px', textAlign: 'left' }}>
          <div style={{ fontSize: 13, color: '#60A5FA', fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 7 }}><img src='/mail.png' alt='mail' style={{ width: 18, height: 18, objectFit: 'contain' }} />Need to follow up?</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[{ i: 'JP', n: 'John Paul Lacaron', g: 'linear-gradient(135deg,#3B82F6,#8B5CF6)' }, { i: 'CJ', n: 'Charlou June Ramil', g: 'linear-gradient(135deg,#14B8A6,#3B82F6)' }].map(a => (
              <div key={a.n} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: a.g, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#fff', flexShrink: 0 }}>{a.i}</div>
                <div><div style={{ fontSize: 13, fontWeight: 600, color: '#F0F4FF' }}>{a.n}</div><div style={{ fontSize: 11, color: '#4B5580' }}>Admin · Teams Chat</div></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )

  // ── Calculator helper ────────────────────────────────────────
  const calcDueDates = () => {
    const today = new Date(); const d = today.getDate(), m = today.getMonth(), y = today.getFullYear()
    let release = d <= 5 ? new Date(y, m, 5) : d <= 20 ? new Date(y, m, 20) : new Date(y, m + 1, 5)
    return Array.from({ length: 4 }, (_, i) => {
      const dt = new Date(release)
      if (release.getDate() <= 5) { dt.setMonth(dt.getMonth() + Math.floor(i / 2)); dt.setDate(i % 2 === 0 ? 20 : 5) }
      else { dt.setMonth(dt.getMonth() + Math.ceil((i + 1) / 2)); dt.setDate(i % 2 === 0 ? 5 : 20) }
      return dt
    })
  }

  return (
    <div style={{ minHeight: '100vh', background: '#07090F', fontFamily: 'DM Sans, sans-serif', position: 'relative', overflowX: 'hidden' }}>
      <style>{`
        .apply-grid-bg {
          position: fixed; inset: 0; pointer-events: none; opacity: 0.03; z-index: 0;
          background-image: linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px);
          background-size: 48px 48px;
        }
      `}</style>
      <div className="apply-grid-bg" />
      <div style={{ position: 'fixed', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 70%)', top: '-10%', right: '-8%', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', width: 350, height: 350, borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)', bottom: '5%', left: '-5%', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'relative', zIndex: 1 }}>

      {/* Disclaimer Modal */}
      {showDisclaimer && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20 }}>
          <div style={{ background: '#141B2D', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 20, padding: 32, width: '100%', maxWidth: 460 }}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ marginBottom: 12 }}><img src="/warning.png" alt="warning" style={{ width: 44, height: 44, objectFit: 'contain' }} /></div>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 20, color: '#F59E0B', marginBottom: 6 }}>Important Loan Disclaimer</div>
              <div style={{ fontSize: 13, color: '#7A8AAA' }}>Please read carefully before proceeding</div>
            </div>
            <div style={{ background: '#0B0F1A', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '18px 20px', marginBottom: 20, fontSize: 13, color: '#CBD5F0', lineHeight: 1.8 }}>
              <p style={{ margin: '0 0 12px' }}>You selected <strong style={{ color: '#22C55E', fontFamily: 'Space Grotesk' }}>₱{pendingAmount?.toLocaleString()}</strong> as your requested loan amount.</p>
              <p style={{ margin: '0 0 12px' }}><strong style={{ color: '#F0F4FF' }}>All first-time borrowers are approved at ₱5,000</strong> regardless of amount requested. This is part of our <strong style={{ color: '#8B5CF6' }}>Level Attainment System</strong>:</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: '0 0 12px' }}>
                {[['Level 1', '₱5,000', 'New borrower'], ['Level 2', '₱7,000', 'After 1 clean loan'], ['Level 3', '₱9,000', 'After 2 clean loans'], ['Level 4', '₱10,000', 'After 3 clean loans (max)']].map(([l, a, d], i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', background: 'rgba(139,92,246,0.06)', borderRadius: 7, border: '1px solid rgba(139,92,246,0.12)' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#8B5CF6', minWidth: 50 }}>{l}</span>
                    <span style={{ fontWeight: 700, color: '#22C55E', minWidth: 60, fontFamily: 'Space Grotesk' }}>{a}</span>
                    <span style={{ fontSize: 12, color: '#4B5580' }}>{d}</span>
                  </div>
                ))}
              </div>
              <p style={{ margin: 0, fontSize: 12, color: '#7A8AAA' }}>Admin may approve higher amounts at their discretion — this is not guaranteed.</p>
            </div>
            <button onClick={disclaimerCountdown === 0 ? confirmDisclaimer : undefined} disabled={disclaimerCountdown > 0}
              style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', background: disclaimerCountdown > 0 ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg,#F59E0B,#EF4444)', color: disclaimerCountdown > 0 ? '#4B5580' : '#fff', fontSize: 14, fontWeight: 700, cursor: disclaimerCountdown > 0 ? 'not-allowed' : 'pointer', fontFamily: 'Space Grotesk', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {disclaimerCountdown > 0 ? (<><span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', fontSize: 13, fontWeight: 800 }}>{disclaimerCountdown}</span>Please read carefully...</>) : ('I Understand — Continue with ₱' + pendingAmount?.toLocaleString())}
            </button>
          </div>
        </div>
      )}

      {/* Terms & Conditions Modal */}
      {showTnC && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20 }}>
          <div style={{ background: '#141B2D', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 20, width: '100%', maxWidth: 560, maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>
            {/* Modal header */}
            <div style={{ padding: '22px 28px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <img src="/list.png" alt="terms" style={{ width: 22, height: 22, objectFit: 'contain' }} />
                <div>
                  <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 17, color: '#F0F4FF' }}>Terms & Conditions</div>
                  <div style={{ fontSize: 11, color: '#4B5580', marginTop: 1 }}>MoneyfestLending Workplace Lending Program</div>
                </div>
              </div>
              <button onClick={() => setShowTnC(false)} style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.07)', color: '#7A8AAA', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>

            {/* Scroll hint */}
            {!tncScrolled && (
              <div style={{ padding: '8px 28px', background: 'rgba(99,102,241,0.08)', borderBottom: '1px solid rgba(99,102,241,0.15)', fontSize: 12, color: '#7A8AAA', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <span style={{ fontSize: 14 }}>👇</span> Please scroll to the bottom to enable the agree button
              </div>
            )}
            {tncScrolled && (
              <div style={{ padding: '8px 28px', background: 'rgba(34,197,94,0.06)', borderBottom: '1px solid rgba(34,197,94,0.15)', fontSize: 12, color: '#22C55E', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <span>✅</span> You've read the terms — you can now agree below
              </div>
            )}

            {/* Scrollable content */}
            <div
              style={{ padding: '24px 28px', overflowY: 'auto', flex: 1, lineHeight: 1.85, fontSize: 13, color: '#8892B0' }}
              onScroll={e => {
                const el = e.target
                const nearBottom = el.scrollHeight - el.scrollTop <= el.clientHeight + 40
                if (nearBottom) setTncScrolled(true)
              }}
            >
              {[
                { title: '1. Eligibility', body: 'This lending program is exclusively available to active team members in good standing within our office. By submitting an application, you confirm that you are currently employed and eligible to participate. Applications from ineligible individuals will not be processed.' },
                { title: '2. Loan Terms & Interest', body: `Approved loans are subject to a monthly interest rate of ${(interestRate * 100).toFixed(0)}% applied over the 2-month loan term, for a total interest charge of ${(interestRate * 2 * 100).toFixed(0)}% of the principal. This is not a compounding rate. The total repayable amount is fixed at the time of approval and will not change provided payments are made on schedule.` },
                { title: '3. Repayment Schedule', body: 'Loans are repaid in 4 equal installments, collected every 5th and 20th of the month. Your repayment schedule begins on the cutoff date following your loan release. It is your responsibility to ensure payments are submitted on time.' },
                { title: '4. Late Payments & Default', body: 'A late payment penalty of ₱20 per day will be charged for each installment not paid by its due date. The penalty accrues daily with no cap until the installment is settled. Late payments result in a -10 point deduction to your credit score per missed installment. A loan is considered in default if two (2) consecutive installments are missed. Upon default, the entire remaining loan balance becomes immediately due and payable. Consistent non-payment or willful evasion of loan obligations may result in MoneyfestLending pursuing all available legal remedies under Philippine law, including the filing of a civil complaint for collection of sum of money, referral to barangay conciliation under RA 7160 (Katarungang Pambarangay Law), and other remedies under RA 9474 (Lending Company Regulation Act of 2007). The Borrower shall be liable for all costs of collection, including reasonable attorney\'s fees, if legal action becomes necessary.' },
                { title: '5. Early Payoff Rebate', body: 'If your final (4th) installment is paid at least 1 day before its due date, you will receive a fixed 1% rebate on your loan principal, credited to your Rebate Credits balance. Rebates apply to the final installment only and are credited automatically. Rebate Credits are withdrawable once your balance reaches ₱500, subject to admin approval.' },
                { title: '6. Accuracy of Information', body: 'By submitting an application, you confirm that all information provided — including personal details, employment information, and government-issued ID — is accurate, complete, and truthful. Providing false or misleading information is grounds for immediate rejection or cancellation of your loan.' },
                { title: '7. Authorization', body: 'You authorize MoneyfestLending administrators to verify your submitted information, and process your personal data in accordance with our Privacy Notice and the Data Privacy Act of 2012 (RA 10173).' },
                { title: '8. ID Verification', body: "A valid government-issued ID is required for all applications. Accepted IDs include SSS, GSIS, PhilHealth, Pag-IBIG, Passport, Driver's License, Postal ID, Voter's ID, PRC ID, and Senior Citizen ID. Your ID images are stored securely and handled in accordance with our Privacy Notice." },
                { title: '9. Security Hold', body: 'A Security Hold is withheld from your approved loan amount upon release. The rate depends on your credit score: VIP (1000) pays 5%, Reliable (920+) pays 6%, Trusted (835+) pays 8%, Standard (750+) pays 10%, Caution (500+) pays 15%, and High Risk (below 500) pays 20%. The Security Hold is automatically returned to your Rebate Credits balance after your 4th and final installment is paid.' },
                { title: '10. Loan Limit & Level System', body: 'All first-time borrowers are approved at a maximum of ₱5,000 regardless of the amount requested. Subsequent loan limits increase based on your repayment history through our Level Attainment System. The program administrators reserve the right to adjust loan limits at their discretion.' },
                { title: '11. Program Rules', body: 'Only one active loan is permitted per borrower at a time. New applications will not be processed while an existing loan is outstanding. The program administrators reserve the right to reject any application without disclosure of specific reasons.' },
                { title: '12. Amendments', body: 'MoneyfestLending reserves the right to amend these Terms & Conditions at any time. Continued use of the program constitutes acceptance of any updated terms. Borrowers will be notified of significant changes where possible.' },
                { title: '13. Governing Law & Legal Remedies', body: 'These Terms & Conditions are governed by the laws of the Republic of the Philippines, including Republic Act 3765 (Truth in Lending Act), Republic Act 10173 (Data Privacy Act of 2012), and Republic Act 9474 (Lending Company Regulation Act of 2007). Any dispute shall first be referred to barangay conciliation under RA 7160 (Katarungang Pambarangay Law). If unresolved, disputes shall be brought before the appropriate Philippine courts. MoneyfestLending reserves the right to pursue all legal remedies available under Philippine law against borrowers who default, evade payment, or otherwise breach this agreement. The Borrower expressly acknowledges this right by agreeing to these terms.' },
              ].map((sec, i) => (
                <div key={i} style={{ marginBottom: 20 }}>
                  <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 13, color: '#CBD5F0', marginBottom: 6 }}>{sec.title}</div>
                  <div style={{ fontSize: 13, color: '#8892B0', lineHeight: 1.85 }}>{sec.body}</div>
                </div>
              ))}
              <div style={{ marginTop: 8, padding: '12px 16px', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 10, fontSize: 11, color: '#4B5580', lineHeight: 1.7 }}>
                These Terms & Conditions are issued in compliance with Philippine law. For data privacy concerns, refer to our <a href="/privacy" target="_blank" rel="noreferrer" style={{ color: '#60A5FA', textDecoration: 'none' }}>Privacy Notice</a>.
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '16px 28px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: 10, flexShrink: 0 }}>
              <button
                disabled={!tncScrolled}
                onClick={() => { set('agreed', true); setShowTnC(false) }}
                style={{
                  flex: 1, padding: '12px', borderRadius: 10, border: 'none',
                  background: tncScrolled ? 'linear-gradient(135deg,#6366F1,#8B5CF6)' : 'rgba(255,255,255,0.05)',
                  color: tncScrolled ? '#fff' : '#4B5580',
                  fontSize: 13, fontWeight: 700,
                  cursor: tncScrolled ? 'pointer' : 'not-allowed',
                  fontFamily: 'Space Grotesk',
                  transition: 'all 0.2s ease'
                }}>
                {tncScrolled ? '✓ I Agree & Close' : '🔒 Scroll to bottom to agree'}
              </button>
              <button onClick={() => setShowTnC(false)}
                style={{ padding: '12px 20px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#7A8AAA', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg,#0d1226,#141B2D)', borderBottom: '1px solid rgba(139,92,246,0.2)', padding: '18px 28px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src="/favicon-96x96.png" alt="MoneyfestLending" style={{ width: 44, height: 44, objectFit: 'contain' }} />
            <div>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 20, color: '#F0F4FF' }}>
                Moneyfest<span style={{ background: 'linear-gradient(90deg,#60a5fa,#a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Lending</span>
              </div>
              <div style={{ fontSize: 11, color: '#4B5580', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Loan Application</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <a href="/faq" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 9, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#7A8AAA', fontSize: 13, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}>
              <img src="/faq.png" alt="faq" style={{ width: 14, height: 14, objectFit: 'contain', marginRight: 5, verticalAlign: 'middle' }} />FAQ
            </a>
            <a href="/portal" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 9, background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)', color: '#a78bfa', fontSize: 13, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap', fontFamily: 'Space Grotesk' }}>
              My Portal →
            </a>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 28px 60px' }}>

        {/* Step indicator */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, marginBottom: 36 }}>
          {['Personal Info', 'ID Verification', 'Loan Details'].map((label, i) => {
            const num = i + 1; const done = step > num; const active = step === num
            return (
              <div key={num} style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 18px', borderRadius: 24, background: active ? 'rgba(59,130,246,0.12)' : done ? 'rgba(34,197,94,0.08)' : 'transparent', border: `1px solid ${active ? 'rgba(59,130,246,0.3)' : done ? 'rgba(34,197,94,0.25)' : 'transparent'}` }}>
                  <div style={{ width: 26, height: 26, borderRadius: '50%', background: done ? '#22C55E' : active ? '#3B82F6' : 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: done || active ? '#fff' : '#4B5580', flexShrink: 0 }}>{done ? '✓' : num}</div>
                  <span style={{ fontSize: 13, fontWeight: active ? 700 : 500, color: active ? '#F0F4FF' : done ? '#22C55E' : '#4B5580', whiteSpace: 'nowrap', fontFamily: 'Space Grotesk' }}>{label}</span>
                </div>
                {i < 2 && <div style={{ width: 40, height: 2, background: step > num ? '#22C55E' : 'rgba(255,255,255,0.06)', margin: '0 4px' }} />}
              </div>
            )
          })}
        </div>

        {/* ── STEP 1: Two-column layout ── */}
        {step === 1 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 24, alignItems: 'start', maxWidth: 560, margin: '0 auto', width: '100%' }}>

            {/* Left: Personal Info */}
            <div style={{ background: 'linear-gradient(145deg,#1c2d4a,#1a2640)', border: '1px solid rgba(59,130,246,0.4)', borderRadius: 18, padding: 32, boxShadow: '0 0 0 1px rgba(59,130,246,0.1), 0 8px 32px rgba(59,130,246,0.15)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, paddingBottom: 18, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 5 }}><img src="/list.png" alt="info" style={{ width: 26, height: 26, objectFit: 'contain' }} /></div>
                <div>
                  <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 17, color: '#F0F4FF' }}>Personal Information</div>
                  <div style={{ fontSize: 12, color: '#7A8AAA', marginTop: 2 }}>Your basic details</div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div><label style={lbl}>Full Name *</label><input value={form.full_name} onChange={e => set('full_name', e.target.value)} placeholder="Enter your full name" style={inp} /></div>
                <div className="apply-name-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={lbl}>Department *</label>
                    <select value={form.department} onChange={e => set('department', e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
                      <option value="">Select...</option>
                      {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div><label style={lbl}>Years of Tenure *</label><input value={form.tenure_years} onChange={e => set('tenure_years', e.target.value)} placeholder="e.g. 2.5" type="number" min="0" step="0.5" style={inp} /></div>
                </div>
                <div><label style={lbl}>Phone Number *</label><input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="09XX XXX XXXX" style={inp} /></div>
                <div>
                  <label style={lbl}>Email Address *</label>
                  <input value={form.email} onChange={e => set('email', e.target.value)} placeholder="your@gmail.com" type="email"
                    style={{ ...inp, borderColor: form.email && validateEmail(form.email) ? 'rgba(239,68,68,0.5)' : form.email && !validateEmail(form.email) ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.08)' }} />
                  {form.email && validateEmail(form.email) && <div style={{ fontSize: 11, color: '#EF4444', marginTop: 4 }}><span style={{ display: "flex", alignItems: "center", gap: 4 }}><img src="/warning.png" alt="warning" style={{ width: 13, height: 13, objectFit: "contain" }} />{validateEmail(form.email)}</span></div>}
                  {form.email && !validateEmail(form.email) && <div style={{ fontSize: 11, color: '#22C55E', marginTop: 4 }}>✓ Valid email</div>}
                </div>
                <div><label style={lbl}>Home Address *</label><textarea value={form.address} onChange={e => set('address', e.target.value)} placeholder="Enter your complete home address" rows={2} style={{ ...inp, resize: 'none' }} /></div>
              </div>
            </div>

            {/* Right: Trustee + Info */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>


              {/* Info blurb */}
              <div style={{ background: 'linear-gradient(135deg,rgba(59,130,246,0.12),rgba(139,92,246,0.1))', border: '1px solid rgba(59,130,246,0.35)', borderRadius: 14, padding: '20px 22px', boxShadow: '0 4px 16px rgba(59,130,246,0.1)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <img src="/list.png" alt="info" style={{ width: 15, height: 15, objectFit: 'contain' }} />
                  <span style={{ fontSize: 13, color: '#60A5FA', fontWeight: 700 }}>What to expect</span>
                </div>
                <div style={{ fontSize: 13, color: '#8892B0', lineHeight: 1.8, marginBottom: 14 }}>
                  Applications are reviewed manually by our admin team. You'll receive a unique <strong style={{ color: '#CBD5F0' }}>access code</strong> after submitting — use it to track your status anytime in the Borrower Portal.
                </div>
                <div style={{ height: 1, background: 'rgba(59,130,246,0.15)', marginBottom: 14 }} />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <span style={{ fontSize: 12, color: '#7A8AAA' }}>For more info visit our FAQ</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <a href="/faq" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 8, background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)', fontSize: 12, color: '#60A5FA', textDecoration: 'none', fontWeight: 600 }}>
                      <img src="/faq.png" alt="faq" style={{ width: 12, height: 12, objectFit: 'contain' }} /> View FAQ →
                    </a>
                    <a href="/privacy" target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 8, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', fontSize: 12, color: '#a78bfa', textDecoration: 'none', fontWeight: 600 }}>
                      <img src="/padlock.png" alt="privacy" style={{ width: 12, height: 12, objectFit: 'contain' }} /> Privacy Notice →
                    </a>
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}


        {/* ── STEP 2: ID Verification ── */}
        {step === 2 && (
          <div style={{ maxWidth: 560, margin: '0 auto', width: '100%' }}>
            <div style={{ background: '#141B2D', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 18, padding: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
                <div style={{ width: 42, height: 42, borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4 }}><img src="/id.png" alt="ID" style={{ width: 32, height: 32, objectFit: 'contain' }} /></div>
                <div>
                  <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 16, color: '#F0F4FF' }}>ID Verification</div>
                  <div style={{ fontSize: 11, color: '#4B5580' }}>Upload front and back of your government-issued ID</div>
                </div>
              </div>

              {/* Accepted IDs info */}
              <div style={{ background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 12, padding: '14px 16px', marginBottom: 20, fontSize: 12, color: '#7A8AAA', lineHeight: 1.8 }}>
                <div style={{ fontWeight: 700, color: '#60A5FA', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 7 }}><img src="/checkbox.png" alt="check" style={{ width: 18, height: 18, objectFit: 'contain' }} /> Accepted IDs</div>
                SSS · GSIS · PhilHealth · Pag-IBIG · Passport · Driver's License · Postal ID · Voter's ID · PRC ID · Senior Citizen ID · or any government-issued photo ID
              </div>

              {/* File upload area - Front & Back */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                {/* Front */}
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: '#7A8AAA', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                    Front of ID *
                  </label>
                  <label style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: 8, padding: '24px 12px', borderRadius: 12,
                    border: `2px dashed ${idFile ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.1)'}`,
                    background: idFile ? 'rgba(34,197,94,0.04)' : 'rgba(255,255,255,0.02)',
                    cursor: 'pointer', transition: 'all 0.2s', minHeight: 130
                  }}>
                    <div style={{ width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{idFile ? <span style={{ fontSize: 28 }}>✅</span> : <img src="/id.png" alt="ID" style={{ width: 52, height: 52, objectFit: 'contain', opacity: 0.85 }} />}</div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: idFile ? '#22C55E' : '#F0F4FF', marginBottom: 3 }}>
                        {idFile ? idFile.name : 'Upload front side'}
                      </div>
                      <div style={{ fontSize: 11, color: '#4B5580' }}>
                        {idFile ? `${(idFile.size / 1024).toFixed(0)} KB` : 'JPG, PNG, PDF · Max 5MB'}
                      </div>
                    </div>
                    <input type="file" accept="image/jpeg,image/png,image/jpg,application/pdf" style={{ display: 'none' }} onChange={e => { setIdFile(e.target.files[0] || null); setError('') }} />
                  </label>
                  {idFile && (
                    <button onClick={() => setIdFile(null)} style={{ marginTop: 6, background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#EF4444', display: 'flex', alignItems: 'center', gap: 4 }}>
                      ✕ Remove
                    </button>
                  )}
                </div>

                {/* Back */}
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: '#7A8AAA', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                    Back of ID *
                  </label>
                  <label style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: 8, padding: '24px 12px', borderRadius: 12,
                    border: `2px dashed ${idFileBack ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.1)'}`,
                    background: idFileBack ? 'rgba(34,197,94,0.04)' : 'rgba(255,255,255,0.02)',
                    cursor: 'pointer', transition: 'all 0.2s', minHeight: 130
                  }}>
                    <div style={{ width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{idFileBack ? <span style={{ fontSize: 28 }}>✅</span> : <img src="/refresh.png" alt="Back ID" style={{ width: 44, height: 44, objectFit: 'contain', opacity: 0.7 }} />}</div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: idFileBack ? '#22C55E' : '#F0F4FF', marginBottom: 3 }}>
                        {idFileBack ? idFileBack.name : 'Upload back side'}
                      </div>
                      <div style={{ fontSize: 11, color: '#4B5580' }}>
                        {idFileBack ? `${(idFileBack.size / 1024).toFixed(0)} KB` : 'JPG, PNG, PDF · Max 5MB'}
                      </div>
                    </div>
                    <input type="file" accept="image/jpeg,image/png,image/jpg,application/pdf" style={{ display: 'none' }} onChange={e => { setIdFileBack(e.target.files[0] || null); setError('') }} />
                  </label>
                  {idFileBack && (
                    <button onClick={() => setIdFileBack(null)} style={{ marginTop: 6, background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#EF4444', display: 'flex', alignItems: 'center', gap: 4 }}>
                      ✕ Remove
                    </button>
                  )}
                </div>
              </div>

              <div style={{ padding: '12px 16px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, fontSize: 12, color: '#F59E0B', lineHeight: 1.7 }}>
                <img src="/warning.png" alt="warning" style={{ width: 14, height: 14, objectFit: 'contain', verticalAlign: 'middle', marginRight: 4 }} />Make sure your ID is <strong>clear and readable</strong>. Blurry or cropped photos may delay your application.
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 3: Loan Details — two-column ── */}
        {step === 3 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>

            {/* Left: Amount + Release */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Loan Amount */}
              <div style={{ background: '#141B2D', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 18, padding: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4 }}><img src="/philippine-peso.png" alt="philippine-peso" style={{ width: 24, height: 24, objectFit: 'contain' }} /></div>
                  <div>
                    <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 16, color: '#F0F4FF' }}>Loan Amount</div>
                    <div style={{ fontSize: 11, color: '#4B5580' }}>Select how much you need</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                  {LOAN_AMOUNTS.map(amt => (
                    <button key={amt} onClick={() => form.loan_amount === amt ? null : startDisclaimer(amt)}
                      style={{ padding: '16px 12px', borderRadius: 12, border: `2px solid ${form.loan_amount === amt ? '#3B82F6' : 'rgba(255,255,255,0.07)'}`, background: form.loan_amount === amt ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.02)', cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s' }}>
                      <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 22, color: form.loan_amount === amt ? '#22C55E' : '#7A8AAA' }}>₱{amt.toLocaleString()}</div>
                      <div style={{ fontSize: 11, color: '#4B5580', marginTop: 3 }}>₱{(amt * (1 + interestRate * 2) / 4).toFixed(2)}/cutoff</div>
                    </button>
                  ))}
                </div>
                <div><label style={lbl}>Loan Purpose *</label><textarea value={form.loan_purpose} onChange={e => set('loan_purpose', e.target.value)} placeholder="e.g. Bills payment, Emergency, Allowance, Tuition, Medical, Rent..." rows={2} style={{ ...inp, resize: 'none' }} /></div>
              </div>

              {/* Release Method */}
              <div style={{ background: '#141B2D', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 18, padding: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4 }}><img src="/payment-method.png" alt="payment" style={{ width: 30, height: 30, objectFit: 'contain' }} /></div>
                  <div>
                    <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 16, color: '#F0F4FF' }}>Release Method</div>
                    <div style={{ fontSize: 11, color: '#4B5580' }}>How you want to receive your loan</div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { value: 'Physical Cash', logo: '/cash-logo.png', desc: 'Receive in cash. No transaction fee.', fee: null },
                    { value: 'GCash', logo: '/gcash-logo.png', desc: 'Sent to your GCash number. Free if GCash to GCash.', fee: '₱15' },
                    { value: 'RCBC', logo: '/rcbc-logo.png', desc: 'Transferred to your RCBC account.', fee: null },
                    { value: 'Other Bank Transfer', logo: '/bank-logo.png', desc: 'Instapay/PESONet. Borrower covers fee.', fee: 'You cover fee' },
                  ].map(opt => (
                    <button key={opt.value} onClick={() => set('release_method', opt.value)}
                      style={{ padding: '11px 14px', borderRadius: 10, border: `2px solid ${form.release_method === opt.value ? '#3B82F6' : 'rgba(255,255,255,0.07)'}`, background: form.release_method === opt.value ? 'rgba(59,130,246,0.08)' : 'rgba(255,255,255,0.02)', cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, transition: 'all 0.15s' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <img src={opt.logo} alt={opt.value} style={{ width: 28, height: 28, objectFit: 'contain' }} />
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13, color: form.release_method === opt.value ? '#F0F4FF' : '#7A8AAA' }}>{opt.value}</div>
                          <div style={{ fontSize: 11, color: '#4B5580' }}>{opt.desc}</div>
                        </div>
                      </div>
                      {opt.fee && <span style={{ fontSize: 10, color: '#F59E0B', background: 'rgba(245,158,11,0.08)', padding: '2px 8px', borderRadius: 6, flexShrink: 0 }}>{opt.fee}</span>}
                    </button>
                  ))}
                </div>

                {/* Conditional account fields */}
                {form.release_method === 'GCash' && (
                  <div style={{ marginTop: 14, padding: 16, background: 'rgba(0,163,255,0.05)', border: '1px solid rgba(0,163,255,0.2)', borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#60B8FF' }}>📱 GCash Account Details</div>
                    <div><label style={lbl}>GCash Number *</label><input value={form.gcash_number} onChange={e => set('gcash_number', e.target.value)} placeholder="09XX XXX XXXX" style={inp} /></div>
                    <div><label style={lbl}>GCash Full Name *</label><input value={form.gcash_name} onChange={e => set('gcash_name', e.target.value)} placeholder="Full name on GCash" style={inp} /></div>
                  </div>
                )}
                {form.release_method === 'RCBC' && (
                  <div style={{ marginTop: 14, padding: 16, background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#F87171', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}><img src="/payment-method.png" alt="payment" style={{ width: 14, height: 14, objectFit: 'contain' }} /> RCBC Account Details</div>
                    <div><label style={lbl}>Account Holder Name *</label><input value={form.bank_account_holder} onChange={e => set('bank_account_holder', e.target.value)} placeholder="Full name on the bank account" style={inp} /></div>
                    <div><label style={lbl}>Account Number *</label><input value={form.bank_account_number} onChange={e => set('bank_account_number', e.target.value)} placeholder="Enter RCBC account number" style={inp} /></div>
                    <div>
                      <label style={lbl}>Confirm Account Number *</label>
                      <input value={form.bank_account_confirm} onChange={e => set('bank_account_confirm', e.target.value)} placeholder="Re-enter account number to confirm" style={{ ...inp, borderColor: form.bank_account_confirm ? (form.bank_account_confirm === form.bank_account_number ? '#22C55E' : '#EF4444') : undefined }} />
                      {form.bank_account_confirm && form.bank_account_confirm !== form.bank_account_number && <div style={{ fontSize: 11, color: '#EF4444', marginTop: 4 }}>⚠️ Account numbers do not match</div>}
                      {form.bank_account_confirm && form.bank_account_confirm === form.bank_account_number && <div style={{ fontSize: 11, color: '#22C55E', marginTop: 4 }}>✅ Account numbers match</div>}
                    </div>
                  </div>
                )}
                {form.release_method === 'Other Bank Transfer' && (
                  <div style={{ marginTop: 14, padding: 16, background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#A78BFA', marginBottom: 0, display: 'flex', alignItems: 'center', gap: 6 }}><img src="/payment-method.png" alt="payment" style={{ width: 14, height: 14, objectFit: 'contain' }} /> Bank Account Details</div>
                    <div><label style={lbl}>Bank Name *</label><input value={form.bank_name} onChange={e => set('bank_name', e.target.value)} placeholder="e.g. BDO, BPI, Metrobank" style={inp} /></div>
                    <div><label style={lbl}>Account Holder Name *</label><input value={form.bank_account_holder} onChange={e => set('bank_account_holder', e.target.value)} placeholder="Full name on the bank account" style={inp} /></div>
                    <div><label style={lbl}>Account Number *</label><input value={form.bank_account_number} onChange={e => set('bank_account_number', e.target.value)} placeholder="Enter your account number" style={inp} /></div>
                    <div>
                      <label style={lbl}>Confirm Account Number *</label>
                      <input value={form.bank_account_confirm} onChange={e => set('bank_account_confirm', e.target.value)} placeholder="Re-enter account number to confirm" style={{ ...inp, borderColor: form.bank_account_confirm ? (form.bank_account_confirm === form.bank_account_number ? '#22C55E' : '#EF4444') : undefined }} />
                      {form.bank_account_confirm && form.bank_account_confirm !== form.bank_account_number && <div style={{ fontSize: 11, color: '#EF4444', marginTop: 4 }}>⚠️ Account numbers do not match</div>}
                      {form.bank_account_confirm && form.bank_account_confirm === form.bank_account_number && <div style={{ fontSize: 11, color: '#22C55E', marginTop: 4 }}>✅ Account numbers match</div>}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Calculator + Terms */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Loan Calculator */}
              {form.loan_amount ? (() => {
                const principal = parseFloat(form.loan_amount)
                const interest = principal * interestRate * 2
                const total = principal + interest
                const perInst = total / 4
                const securityHold = parseFloat((principal * 0.10).toFixed(2)) // standard rate; actual rate set by credit score
                const fundsReleased = parseFloat((principal - securityHold).toFixed(2))
                let feeAmt = 0, feeLabel = ''
                if (form.release_method === 'GCash') { feeAmt = 15; feeLabel = 'GCash transaction fee — flat ₱15 (free if GCash to GCash)' }
                else if (form.release_method === 'Other Bank Transfer') { feeLabel = 'Transfer fee varies (Instapay/PESONet)' }
                const received = feeAmt > 0 ? fundsReleased - feeAmt : null
                const dueDates = calcDueDates()
                return (
                  <div style={{ background: 'linear-gradient(135deg,#0f1a2e,#141B2D)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 18, overflow: 'hidden' }}>
                    <div style={{ padding: '18px 22px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 3 }}><img src="/calculator.png" alt="calculator" style={{ width: 24, height: 24, objectFit: 'contain' }} /></div>
                      <div>
                        <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 15, color: '#F0F4FF' }}>Loan Summary</div>
                        <div style={{ fontSize: 11, color: '#4B5580' }}>Based on your selections</div>
                      </div>
                    </div>
                    <div className="apply-calc-grid" style={{ padding: '18px 22px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                      {[
                        { label: 'Approved Amount', value: '₱' + principal.toLocaleString('en-PH', { minimumFractionDigits: 2 }), color: '#F0F4FF', sub: 'Principal' },
                        { label: 'You Will Receive', value: '₱' + fundsReleased.toLocaleString('en-PH', { minimumFractionDigits: 2 }), color: '#22C55E', sub: 'Released to you' },
                        { label: 'Security Hold', value: '₱' + securityHold.toLocaleString('en-PH', { minimumFractionDigits: 2 }), color: '#F59E0B', sub: '10% standard · lower with good score' },
                        { label: 'Interest (' + (interestRate * 100).toFixed(0) + '% flat)', value: '₱' + interest.toLocaleString('en-PH', { minimumFractionDigits: 2 }), color: '#a78bfa', sub: 'On full amount' },
                        { label: 'Total Repayment', value: '₱' + total.toLocaleString('en-PH', { minimumFractionDigits: 2 }), color: '#EF4444', sub: 'Over 4 payments' },
                        { label: 'Per Installment', value: '₱' + perInst.toLocaleString('en-PH', { minimumFractionDigits: 2 }), color: '#60A5FA', sub: 'Every cutoff' },
                      ].map((item, i) => (
                        <div key={i} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '12px 14px' }}>
                          <div style={{ fontSize: 10, color: '#4B5580', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>{item.label}</div>
                          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 17, color: item.color }}>{item.value}</div>
                          <div style={{ fontSize: 10, color: '#4B5580', marginTop: 2 }}>{item.sub}</div>
                        </div>
                      ))}
                    </div>
                    {feeLabel && (
                      <div style={{ margin: '0 22px 12px', padding: '10px 14px', background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 9 }}>
                        <div style={{ fontSize: 12, color: '#F59E0B' }}><span style={{ display: "flex", alignItems: "center", gap: 4 }}><img src="/warning.png" alt="warning" style={{ width: 13, height: 13, objectFit: "contain" }} />{feeLabel}</span></div>
                        {received && <div style={{ fontSize: 13, fontWeight: 700, color: '#F0F4FF', marginTop: 4 }}>You will receive: <span style={{ color: '#22C55E' }}>₱{received.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span></div>}
                      </div>
                    )}
                    <div style={{ padding: '0 22px 20px' }}>
                      <div style={{ fontSize: 11, color: '#4B5580', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Payment Schedule</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                        {dueDates.map((date, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 13px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 9 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#8B5CF6' }}>{i + 1}</div>
                              <span style={{ fontSize: 12, color: '#CBD5F0' }}>Installment {i + 1}</span>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: '#22C55E' }}>₱{perInst.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
                              <div style={{ fontSize: 10, color: '#4B5580' }}>{date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })() : (
                <div style={{ background: '#141B2D', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 18, padding: 32, textAlign: 'center' }}>
                  <img src="/calculator.png" alt="calculator" style={{ width: 52, height: 52, objectFit: 'contain', marginBottom: 12, opacity: 0.55 }} />
                  <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 15, color: '#F0F4FF', marginBottom: 6 }}>Loan Calculator</div>
                  <div style={{ fontSize: 13, color: '#4B5580' }}>Select a loan amount on the left to see your payment breakdown and schedule.</div>
                </div>
              )}

              {/* Terms + Submit */}
              <div style={{ background: '#141B2D', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 18, padding: 24 }}>

                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', marginBottom: 14 }}
                  onClick={e => { e.preventDefault(); if (!form.agreed) { setTncScrolled(false); setShowTnC(true) } else { set('agreed', false) } }}>
                  <div style={{
                    marginTop: 2, width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                    border: `2px solid ${form.agreed ? '#3B82F6' : 'rgba(255,255,255,0.2)'}`,
                    background: form.agreed ? '#3B82F6' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s ease'
                  }}>
                    {form.agreed && <span style={{ color: '#fff', fontSize: 10, fontWeight: 800, lineHeight: 1 }}>✓</span>}
                  </div>
                  <span style={{ fontSize: 13, color: '#7A8AAA', lineHeight: 1.6 }}>
                    I have read and agree to the{' '}
                    <span style={{ color: '#F0F4FF', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer' }}>Terms & Conditions</span>
                    {' '}and the{' '}
                    <a href='/privacy' target='_blank' rel='noreferrer' style={{ color: '#60A5FA', textDecoration: 'none', fontWeight: 600 }} onClick={e => e.stopPropagation()}>Privacy Notice</a>.
                  </span>
                </label>
                {error && (
                  <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, fontSize: 13, color: '#EF4444', marginBottom: 14 }}><span style={{ display: "flex", alignItems: "center", gap: 4 }}><img src="/warning.png" alt="warning" style={{ width: 13, height: 13, objectFit: "contain" }} />{error}</span></div>
                )}
                <button onClick={handleSubmit} disabled={loading}
                  className="submit-btn" style={{ width: '100%', padding: '14px', borderRadius: 12, border: 'none', background: loading ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg,#22C55E,#3B82F6)', color: loading ? '#4B5580' : '#fff', fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'Space Grotesk', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {loading ? 'Submitting...' : <><style>{`@keyframes rocketFly2{0%{transform:translate(0,0) rotate(-45deg)}25%{transform:translate(3px,-4px) rotate(-45deg)}50%{transform:translate(6px,-8px) rotate(-45deg)}75%{transform:translate(3px,-4px) rotate(-45deg)}100%{transform:translate(0,0) rotate(-45deg)}}.submit-btn:hover .rocket-icon2{animation:rocketFly2 0.6s ease-in-out infinite}`}</style><img src="/startup.png" alt="launch" className="rocket-icon2" style={{ width: 18, height: 18, objectFit: 'contain', marginRight: 7 }} />Submit Application</>}
                </button>
              </div>

            </div>
          </div>
        )}

        {/* Error (step 1 & 2) */}
        {(step === 1 || step === 2) && error && (
          <div style={{ marginTop: 16, padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, fontSize: 13, color: '#EF4444' }}><span style={{ display: "flex", alignItems: "center", gap: 4 }}><img src="/warning.png" alt="warning" style={{ width: 13, height: 13, objectFit: "contain" }} />{error}</span></div>
        )}

        {/* Navigation */}
        <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
          {(step === 2 || step === 3) && (
            <button onClick={() => { setStep(step - 1); setError('') }}
              style={{ padding: '13px 28px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: '#7A8AAA', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              ← Back
            </button>
          )}
          {step === 1 && (
            <button onClick={handleNext}
              style={{ marginLeft: 'auto', padding: '13px 36px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#3B82F6,#8B5CF6)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'Space Grotesk' }}>
              Continue →
            </button>
          )}
          {step === 2 && (
            <button onClick={handleNext}
              style={{ marginLeft: 'auto', padding: '13px 36px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#3B82F6,#8B5CF6)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'Space Grotesk' }}>
              Continue to Loan Details →
            </button>
          )}
        </div>

        <p style={{ textAlign: 'center', fontSize: 12, color: '#4B5580', marginTop: 24, lineHeight: 1.7 }}>
          Your information is kept private and secure. This is an exclusive internal program for our team members only. · <a href="/faq" style={{ color: '#3B82F6', textDecoration: 'none' }}>View FAQ</a> · <a href="/privacy" style={{ color: '#3B82F6', textDecoration: 'none' }}>Privacy Notice</a> · <a href="/terms" style={{ color: '#3B82F6', textDecoration: 'none' }}>Terms & Conditions</a>
        </p>

      </div>
      </div>
    </div>
  )
}
