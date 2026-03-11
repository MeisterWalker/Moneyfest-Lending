import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { sendPendingEmail } from '../lib/emailService'

const DEPARTMENTS = ['Minto Money', 'Greyhound']
const LOAN_AMOUNTS = [5000, 7000, 9000, 10000]

function FAQItem({ question, answer, children }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ background: '#141B2D', border: `1px solid ${open ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.06)'}`, borderRadius: 12, overflow: 'hidden', transition: 'border 0.2s' }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', padding: '14px 18px', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <span style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 14, color: '#F0F4FF', textAlign: 'left' }}>{question}</span>
        <span style={{ color: open ? '#3B82F6' : '#4B5580', fontSize: 18, flexShrink: 0, transition: 'transform 0.2s', transform: open ? 'rotate(45deg)' : 'rotate(0deg)' }}>+</span>
      </button>
      {open && (
        <div style={{ padding: '0 18px 14px', fontSize: 13, color: '#7A8AAA', lineHeight: 1.7, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          {answer}
          {children}
        </div>
      )}
    </div>
  )
}

export default function PublicApplyPage() {
  const [step, setStep] = useState(1)
  const [submitted, setSubmitted] = useState(false)
  const [accessCode, setAccessCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showDisclaimer, setShowDisclaimer] = useState(false)
  const [disclaimerCountdown, setDisclaimerCountdown] = useState(4)
  const [pendingAmount, setPendingAmount] = useState(null)

  const [form, setForm] = useState({
    full_name: '', department: '', tenure_years: '', phone: '', email: '', address: '',
    trustee_name: '', trustee_phone: '', trustee_relationship: '',
    loan_amount: '', loan_purpose: '', release_method: '',
    gcash_number: '', gcash_name: '', bank_account_number: '', bank_name: '',
    agreed: false
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Disclaimer countdown
  const startDisclaimer = (amt) => {
    setPendingAmount(amt)
    setDisclaimerCountdown(4)
    setShowDisclaimer(true)
  }

  useEffect(() => {
    if (!showDisclaimer) return
    if (disclaimerCountdown <= 0) return
    const t = setTimeout(() => setDisclaimerCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [showDisclaimer, disclaimerCountdown])

  const confirmDisclaimer = () => {
    set('loan_amount', pendingAmount)
    setShowDisclaimer(false)
    setPendingAmount(null)
    setDisclaimerCountdown(4)
  }

  const validateStep1 = () => {
    if (!form.full_name.trim()) return 'Please enter your full name'
    if (!form.department) return 'Please select your department'
    if (!form.tenure_years) return 'Please enter your tenure'
    if (!form.phone.trim()) return 'Please enter your phone number'
    if (!form.email.trim()) return 'Please enter your email'
    if (!form.address.trim()) return 'Please enter your address'
    return null
  }
  const validateStep2 = () => {
    if (!form.trustee_name.trim()) return 'Please enter trustee name'
    if (!form.trustee_phone.trim()) return 'Please enter trustee phone'
    if (!form.trustee_relationship.trim()) return 'Please enter trustee relationship'
    return null
  }
  const validateStep3 = () => {
    if (!form.loan_amount) return 'Please select a loan amount'
    if (!form.release_method) return 'Please select a preferred release method'
    if (form.release_method === 'GCash') {
      if (!form.gcash_number.trim()) return 'Please enter your GCash number'
      if (!form.gcash_name.trim()) return 'Please enter your GCash full name'
    }
    if (form.release_method === 'RCBC') {
      if (!form.bank_account_number.trim()) return 'Please enter your RCBC account number'
    }
    if (form.release_method === 'Other Bank Transfer') {
      if (!form.bank_name.trim()) return 'Please enter your bank name'
      if (!form.bank_account_number.trim()) return 'Please enter your account number'
    }
    if (!form.agreed) return 'Please agree to the terms and conditions'
    return null
  }

  const handleNext = () => {
    const err = step === 1 ? validateStep1() : validateStep2()
    if (err) { setError(err); return }
    setError(''); setStep(s => s + 1)
  }

  const handleSubmit = async () => {
    const err = validateStep3()
    if (err) { setError(err); return }
    setError('')
    setLoading(true)
    const code = 'LM-' + Math.random().toString(36).substring(2, 6).toUpperCase()
    const { error: dbErr } = await supabase.from('applications').insert({
      full_name: form.full_name.trim(), department: form.department,
      tenure_years: parseFloat(form.tenure_years) || 0,
      phone: form.phone.trim(), email: form.email.trim(), address: form.address.trim(),
      trustee_name: form.trustee_name.trim(), trustee_phone: form.trustee_phone.trim(),
      trustee_relationship: form.trustee_relationship.trim(),
      loan_amount: parseFloat(form.loan_amount), loan_purpose: form.loan_purpose.trim(),
      release_method: form.release_method,
      gcash_number: form.gcash_number.trim() || null, gcash_name: form.gcash_name.trim() || null,
      bank_account_number: form.bank_account_number.trim() || null, bank_name: form.bank_name.trim() || null,
      status: 'Pending', access_code: code, created_at: new Date().toISOString()
    })
    setLoading(false)
    if (dbErr) { setError('Submission failed. Please try again.'); return }
    if (form.email.trim()) {
      const emailResult = await sendPendingEmail({
        to: form.email.trim(), borrowerName: form.full_name.trim(),
        accessCode: code, loanAmount: parseFloat(form.loan_amount)
      })
      console.log('Pending email result:', emailResult)
    }
    setAccessCode(code)
    setSubmitted(true)
  }

  const inputStyle = {
    width: '100%', boxSizing: 'border-box', padding: '11px 14px',
    background: '#0B0F1A', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 9, color: '#F0F4FF', fontSize: 14, outline: 'none',
    fontFamily: 'DM Sans, sans-serif'
  }
  const labelStyle = { display: 'block', fontSize: 12, color: '#7A8AAA', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }

  // Success screen
  if (submitted) return (
    <div style={{ minHeight: '100vh', background: '#0B0F1A', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ textAlign: 'center', maxWidth: 460 }}>
        <div style={{ fontSize: 64, marginBottom: 20 }}>🎉</div>
        <h2 style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 28, color: '#F0F4FF', marginBottom: 12 }}>Application Submitted!</h2>
        <p style={{ color: '#7A8AAA', fontSize: 15, lineHeight: 1.7, marginBottom: 16 }}>
          Thank you <strong style={{ color: '#F0F4FF' }}>{form.full_name}</strong>! Your loan application has been received and is now under review. Our admin will get back to you shortly.
        </p>
        <div style={{ background: 'linear-gradient(135deg,#0f1729,#1a1040)', border: '2px solid rgba(139,92,246,0.4)', borderRadius: 14, padding: '20px 24px', marginBottom: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#4B5580', marginBottom: 8 }}>Your Portal Access Code</div>
          <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: 8, color: '#F0F4FF', fontFamily: 'monospace', marginBottom: 8 }}>{accessCode}</div>
          <div style={{ fontSize: 12, color: '#4B5580', marginBottom: 14 }}>Use this to check your application status at the Borrower Portal</div>
          <a href="/portal" style={{ display: 'inline-block', background: 'linear-gradient(135deg,#3B82F6,#8B5CF6)', color: '#fff', textDecoration: 'none', padding: '10px 24px', borderRadius: 9, fontSize: 13, fontWeight: 700 }}>
            Check Application Status
          </a>
        </div>
        <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 12, padding: '16px 20px', marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: '#22C55E', fontWeight: 600, marginBottom: 8 }}>📋 Application Details</div>
          <div style={{ fontSize: 13, color: '#7A8AAA', marginTop: 4 }}>Amount Requested: <strong style={{ color: '#F0F4FF' }}>₱{parseFloat(form.loan_amount).toLocaleString()}</strong></div>
          <div style={{ fontSize: 13, color: '#7A8AAA', marginTop: 4 }}>Release Method: <strong style={{ color: '#F0F4FF' }}>{form.release_method || 'Not specified'}</strong></div>
          <div style={{ fontSize: 13, color: '#7A8AAA', marginTop: 4 }}>Status: <strong style={{ color: '#F59E0B' }}>Pending Review</strong></div>
        </div>
        <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 12, padding: '16px 20px' }}>
          <div style={{ fontSize: 13, color: '#60A5FA', fontWeight: 600, marginBottom: 10 }}>💬 Need to follow up?</div>
          <div style={{ fontSize: 13, color: '#7A8AAA', marginBottom: 12, lineHeight: 1.6 }}>Contact any of the following admins via <strong style={{ color: '#F0F4FF' }}>Microsoft Teams Chat</strong>:</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[{ i: 'JP', n: 'John Paul Lacaron', g: 'linear-gradient(135deg,#3B82F6,#8B5CF6)' }, { i: 'CJ', n: 'Charlou John Ramil', g: 'linear-gradient(135deg,#14B8A6,#3B82F6)' }].map(a => (
              <div key={a.n} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: a.g, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{a.i}</div>
                <div><div style={{ fontSize: 13, fontWeight: 600, color: '#F0F4FF' }}>{a.n}</div><div style={{ fontSize: 11, color: '#4B5580' }}>Admin · Teams Chat</div></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#0B0F1A', fontFamily: 'DM Sans, sans-serif' }}>

      {/* Disclaimer Modal */}
      {showDisclaimer && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20 }}>
          <div style={{ background: '#141B2D', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 20, padding: 32, width: '100%', maxWidth: 460 }}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 44, marginBottom: 12 }}>⚠️</div>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 20, color: '#F59E0B', marginBottom: 6 }}>Important Loan Disclaimer</div>
              <div style={{ fontSize: 13, color: '#7A8AAA' }}>Please read carefully before proceeding</div>
            </div>
            <div style={{ background: '#0B0F1A', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '18px 20px', marginBottom: 20, fontSize: 13, color: '#CBD5F0', lineHeight: 1.8 }}>
              <p style={{ margin: '0 0 12px' }}>
                You have selected <strong style={{ color: '#22C55E', fontFamily: 'Space Grotesk' }}>₱{pendingAmount?.toLocaleString()}</strong> as your requested loan amount.
              </p>
              <p style={{ margin: '0 0 12px' }}>
                Please be aware that <strong style={{ color: '#F0F4FF' }}>all first-time borrowers are approved at a starting loan amount of ₱5,000</strong>, regardless of the amount requested. This is part of our <strong style={{ color: '#8B5CF6' }}>Level Attainment System</strong>:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: '0 0 12px' }}>
                {[
                  { level: 'Level 1', amount: 'P5,000', desc: 'New borrower (starting limit)' },
                  { level: 'Level 2', amount: 'P7,000', desc: 'After 1 clean loan' },
                  { level: 'Level 3', amount: 'P9,000', desc: 'After 2 clean loans' },
                  { level: 'Level 4', amount: 'P10,000', desc: 'After 3 clean loans (max)' },
                ].map((l, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', background: 'rgba(139,92,246,0.06)', borderRadius: 7, border: '1px solid rgba(139,92,246,0.12)' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#8B5CF6', minWidth: 50 }}>{l.level}</span>
                    <span style={{ fontWeight: 700, color: '#22C55E', minWidth: 56 }}>{l.amount}</span>
                    <span style={{ fontSize: 12, color: '#4B5580' }}>{l.desc}</span>
                  </div>
                ))}
              </div>
              <p style={{ margin: 0, fontSize: 12, color: '#7A8AAA', lineHeight: 1.7 }}>
                In some cases, the admin may approve a higher starting amount based on their review of your application — however, <strong style={{ color: '#F0F4FF' }}>this is not guaranteed</strong> and is entirely at the admin's discretion. Submitting a higher amount does not guarantee you will receive it.
              </p>
            </div>
            <button
              onClick={disclaimerCountdown === 0 ? confirmDisclaimer : undefined}
              disabled={disclaimerCountdown > 0}
              style={{
                width: '100%', padding: '14px', borderRadius: 12, border: 'none',
                background: disclaimerCountdown > 0 ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg,#F59E0B,#EF4444)',
                color: disclaimerCountdown > 0 ? '#4B5580' : '#fff',
                fontSize: 14, fontWeight: 700, cursor: disclaimerCountdown > 0 ? 'not-allowed' : 'pointer',
                fontFamily: 'Space Grotesk', transition: 'all 0.3s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
              }}
            >
              {disclaimerCountdown > 0 ? (
                <>
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', fontSize: 13, fontWeight: 800 }}>{disclaimerCountdown}</span>
                  Please read the above carefully...
                </>
              ) : (
                'I Understand - Continue with P' + pendingAmount?.toLocaleString()
              )}
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg,#0d1226,#141B2D)', borderBottom: '1px solid rgba(139,92,246,0.2)', padding: '20px 24px' }}>
        <div style={{ maxWidth: 560, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src="/favicon-96x96.png" alt="Loan Manifest" style={{ width: 48, height: 48, objectFit: 'contain' }} />
            <div>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 20, color: '#F0F4FF' }}>
                Loan<span style={{ background: 'linear-gradient(90deg,#60a5fa,#a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Manifest</span>
              </div>
              <div style={{ fontSize: 11, color: '#4B5580', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Loan Application</div>
            </div>
          </div>
          <a href="/portal" style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 10, background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)', color: '#a78bfa', fontSize: 13, fontWeight: 700, textDecoration: 'none', fontFamily: 'Space Grotesk', whiteSpace: 'nowrap' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
            My Portal
          </a>
        </div>
      </div>

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '32px 20px' }}>

        {/* Progress steps */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 32, position: 'relative', zIndex: 1 }}>
          {['Personal Info', 'Trustee', 'Loan Details'].map((label, i) => {
            const num = i + 1
            const done = step > num
            const active = step === num
            return (
              <div key={num} style={{ display: 'flex', alignItems: 'center', flex: i < 2 ? 1 : 'none' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: done ? '#22C55E' : active ? '#3B82F6' : 'rgba(255,255,255,0.05)', border: `2px solid ${done ? '#22C55E' : active ? '#3B82F6' : 'rgba(255,255,255,0.1)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: done || active ? '#fff' : '#4B5580' }}>
                    {done ? "✓" : num}
                  </div>
                  <div style={{ fontSize: 10, color: active ? '#F0F4FF' : '#4B5580', fontWeight: active ? 700 : 400, whiteSpace: 'nowrap' }}>{label}</div>
                </div>
                {i < 2 && <div style={{ flex: 1, height: 2, background: done ? '#22C55E' : 'rgba(255,255,255,0.06)', margin: '0 8px', marginBottom: 16 }} />}
              </div>
            )
          })}
        </div>

        <div style={{ background: '#141B2D', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '24px 22px', marginBottom: 24 }}>

          {/* Step 1 */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h2 style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 20, color: '#F0F4FF', marginBottom: 6 }}>Personal Information</h2>
              <div><label style={labelStyle}>Full Name *</label><input value={form.full_name} onChange={e => set('full_name', e.target.value)} placeholder="Enter your full name" style={inputStyle} /></div>
              <div>
                <label style={labelStyle}>Department *</label>
                <select value={form.department} onChange={e => set('department', e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value="">Select department</option>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div><label style={labelStyle}>Years of Tenure *</label><input value={form.tenure_years} onChange={e => set('tenure_years', e.target.value)} placeholder="e.g. 2.5" type="number" min="0" step="0.5" style={inputStyle} /></div>
              <div><label style={labelStyle}>Phone Number *</label><input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="09XX XXX XXXX" style={inputStyle} /></div>
              <div><label style={labelStyle}>Email Address *</label><input value={form.email} onChange={e => set('email', e.target.value)} placeholder="your@email.com" type="email" style={inputStyle} /></div>
              <div><label style={labelStyle}>Home Address *</label><textarea value={form.address} onChange={e => set('address', e.target.value)} placeholder="Enter your complete address" rows={2} style={{ ...inputStyle, resize: 'none' }} /></div>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h2 style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 20, color: '#F0F4FF', marginBottom: 6 }}>Trustee / Guarantor</h2>
              <p style={{ fontSize: 13, color: '#7A8AAA', marginTop: 0 }}>Please provide a trustee who can vouch for you and may be contacted for follow-up.</p>
              <div><label style={labelStyle}>Trustee Full Name *</label><input value={form.trustee_name} onChange={e => set('trustee_name', e.target.value)} placeholder="Enter trustee full name" style={inputStyle} /></div>
              <div><label style={labelStyle}>Trustee Phone Number *</label><input value={form.trustee_phone} onChange={e => set('trustee_phone', e.target.value)} placeholder="09XX XXX XXXX" style={inputStyle} /></div>
              <div><label style={labelStyle}>Relationship to Applicant *</label><input value={form.trustee_relationship} onChange={e => set('trustee_relationship', e.target.value)} placeholder="e.g. Spouse, Parent, Colleague" style={inputStyle} /></div>
            </div>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <h2 style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 20, color: '#F0F4FF', marginBottom: 6 }}>Loan Details</h2>

              {/* Loan Amount */}
              <div>
                <label style={labelStyle}>Loan Amount *</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {LOAN_AMOUNTS.map(amt => (
                    <button key={amt} onClick={() => form.loan_amount === amt ? null : startDisclaimer(amt)} style={{ padding: '14px', borderRadius: 10, border: `2px solid ${form.loan_amount === amt ? '#3B82F6' : 'rgba(255,255,255,0.08)'}`, background: form.loan_amount === amt ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.03)', color: form.loan_amount === amt ? '#F0F4FF' : '#7A8AAA', cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s' }}>
                      <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 20, color: form.loan_amount === amt ? '#22C55E' : '#7A8AAA' }}>₱{amt.toLocaleString()}</div>
                      <div style={{ fontSize: 11, marginTop: 2 }}>₱{(amt * 1.08 / 4).toFixed(2)}/cutoff</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Loan Purpose */}
              <div>
                <label style={labelStyle}>Loan Purpose</label>
                <textarea value={form.loan_purpose} onChange={e => set('loan_purpose', e.target.value)} placeholder="Briefly describe what this loan is for (optional)" rows={2} style={{ ...inputStyle, resize: 'none' }} />
              </div>

              {/* Release Method */}
              <div>
                <label style={labelStyle}>Preferred Release Method *</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { value: 'Physical Cash', logo: '/cash-logo.png', desc: 'Receive your loan in cash. No transaction fee.', fee: null },
                    { value: 'GCash', logo: '/gcash-logo.png', desc: 'Sent to your GCash number.', fee: 'Fee: P15 or 1% (whichever is higher)' },
                    { value: 'RCBC', logo: '/rcbc-logo.png', desc: 'Transferred to your RCBC account. Free if RCBC to RCBC.', fee: null },
                    { value: 'Other Bank Transfer', logo: '/bank-logo.png', desc: 'Instapay/PESONet to any non-RCBC bank. You must send the exact amount due - transfer fees are on your end.', fee: 'Borrower covers transfer fee' },
                  ].map(opt => (
                    <button key={opt.value} onClick={() => set('release_method', opt.value)} style={{ padding: '12px 14px', borderRadius: 10, border: `2px solid ${form.release_method === opt.value ? '#3B82F6' : 'rgba(255,255,255,0.07)'}`, background: form.release_method === opt.value ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.02)', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <img src={opt.logo} alt={opt.value} style={{ width: 32, height: 32, objectFit: 'contain', flexShrink: 0 }} />
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13, color: form.release_method === opt.value ? '#F0F4FF' : '#7A8AAA' }}>{opt.value}</div>
                          <div style={{ fontSize: 11, color: '#4B5580', marginTop: 2 }}>{opt.desc}</div>
                        </div>
                      </div>
                      {opt.fee && <div style={{ fontSize: 11, color: '#F59E0B', background: 'rgba(245,158,11,0.08)', padding: '3px 8px', borderRadius: 6, flexShrink: 0 }}>{opt.fee}</div>}
                    </button>
                  ))}
                </div>

                {form.release_method && !['Physical Cash', 'RCBC'].includes(form.release_method) && (
                  <div style={{ marginTop: 8, padding: '9px 12px', background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, fontSize: 12, color: '#F59E0B' }}>
                    The applicable transaction fee will be deducted from your approved loan amount before release.
                  </div>
                )}

                {/* GCash details */}
                {form.release_method === 'GCash' && (
                  <div style={{ marginTop: 12, padding: '16px', background: 'rgba(0,163,255,0.05)', border: '1px solid rgba(0,163,255,0.2)', borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <img src="/gcash-logo.png" alt="GCash" style={{ height: 20, objectFit: 'contain' }} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#60B8FF' }}>GCash Account Details</span>
                    </div>
                    <div><label style={labelStyle}>GCash Number *</label><input value={form.gcash_number} onChange={e => set('gcash_number', e.target.value)} placeholder="09XX XXX XXXX" style={inputStyle} /></div>
                    <div><label style={labelStyle}>GCash Full Name *</label><input value={form.gcash_name} onChange={e => set('gcash_name', e.target.value)} placeholder="Full name linked to this GCash number" style={inputStyle} /></div>
                  </div>
                )}

                {/* RCBC details */}
                {form.release_method === 'RCBC' && (
                  <div style={{ marginTop: 12, padding: '16px', background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <img src="/rcbc-logo.png" alt="RCBC" style={{ height: 20, objectFit: 'contain' }} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#F87171' }}>RCBC Account Details</span>
                    </div>
                    <div><label style={labelStyle}>RCBC Account Number *</label><input value={form.bank_account_number} onChange={e => set('bank_account_number', e.target.value)} placeholder="Enter your RCBC account number" style={inputStyle} /></div>
                  </div>
                )}

                {/* Other Bank details */}
                {form.release_method === 'Other Bank Transfer' && (
                  <div style={{ marginTop: 12, padding: '16px', background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <img src="/bank-logo.png" alt="Bank" style={{ height: 20, objectFit: 'contain' }} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#A78BFA' }}>Bank Account Details</span>
                    </div>
                    <div><label style={labelStyle}>Bank Name *</label><input value={form.bank_name} onChange={e => set('bank_name', e.target.value)} placeholder="e.g. BDO, BPI, Metrobank, UnionBank" style={inputStyle} /></div>
                    <div><label style={labelStyle}>Account Number *</label><input value={form.bank_account_number} onChange={e => set('bank_account_number', e.target.value)} placeholder="Enter your account number" style={inputStyle} /></div>
                  </div>
                )}
              </div>

              {/* Interest Calculator */}
              {form.loan_amount && (() => {
                const principal = parseFloat(form.loan_amount)
                const interest = principal * 0.08
                const totalRepayment = principal + interest
                const perInstallment = totalRepayment / 4
                let feeAmount = 0
                let feeLabel = ''
                if (form.release_method === 'GCash') { feeAmount = Math.max(15, principal * 0.01); feeLabel = 'GCash fee (P15 or 1%, whichever is higher)' }
                else if (form.release_method === 'Other Bank Transfer') { feeAmount = null; feeLabel = 'Transfer fee varies (Instapay/PESONet)' }
                const amountReceived = feeAmount > 0 ? principal - feeAmount : null

                const today = new Date()
                const day = today.getDate(), month = today.getMonth(), year = today.getFullYear()
                let release
                if (day <= 5) release = new Date(year, month, 5)
                else if (day <= 20) release = new Date(year, month, 20)
                else release = new Date(year, month + 1, 5)

                const dueDates = []
                for (let i = 1; i <= 4; i++) {
                  const d = new Date(release)
                  if (release.getDate() <= 5) { d.setMonth(d.getMonth() + Math.floor((i-1)/2)); d.setDate(i%2===1?20:5) }
                  else { d.setMonth(d.getMonth() + Math.ceil(i/2)); d.setDate(i%2===1?5:20) }
                  dueDates.push(d)
                }

                return (
                  <div style={{ background: 'linear-gradient(135deg,#0f1729,#141B2D)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 14, overflow: 'hidden' }}>
                    <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(34,197,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🧮</div>
                      <div>
                        <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 13, color: '#F0F4FF' }}>Loan Summary</div>
                        <div style={{ fontSize: 11, color: '#4B5580' }}>Based on your selections</div>
                      </div>
                    </div>
                    <div style={{ padding: '16px 18px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      {[
                        { label: 'Loan Amount', value: 'P' + principal.toLocaleString('en-PH', { minimumFractionDigits: 2 }), color: '#F0F4FF', sub: 'Principal' },
                        { label: 'Interest (8% flat)', value: 'P' + interest.toLocaleString('en-PH', { minimumFractionDigits: 2 }), color: '#F59E0B', sub: 'One-time' },
                        { label: 'Total Repayment', value: 'P' + totalRepayment.toLocaleString('en-PH', { minimumFractionDigits: 2 }), color: '#EF4444', sub: 'Over 4 payments' },
                        { label: 'Per Installment', value: 'P' + perInstallment.toLocaleString('en-PH', { minimumFractionDigits: 2 }), color: '#22C55E', sub: 'Every cutoff' },
                      ].map((item, i) => (
                        <div key={i} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '10px 12px' }}>
                          <div style={{ fontSize: 10, color: '#4B5580', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{item.label}</div>
                          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 16, color: item.color }}>{item.value}</div>
                          <div style={{ fontSize: 10, color: '#4B5580', marginTop: 2 }}>{item.sub}</div>
                        </div>
                      ))}
                    </div>
                    {feeLabel && (
                      <div style={{ margin: '0 18px 12px', padding: '10px 14px', background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 9 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                          <div style={{ fontSize: 12, color: '#F59E0B' }}>⚠️ {feeLabel}</div>
                          {feeAmount > 0 && <div style={{ fontSize: 12, fontWeight: 700, color: '#F59E0B' }}>-P{feeAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>}
                        </div>
                        {amountReceived && <div style={{ marginTop: 6, fontSize: 13, color: '#F0F4FF', fontWeight: 700 }}>You will receive: <span style={{ color: '#22C55E' }}>P{amountReceived.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span></div>}
                      </div>
                    )}
                    <div style={{ padding: '0 18px 16px' }}>
                      <div style={{ fontSize: 11, color: '#4B5580', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Payment Schedule</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {dueDates.map((date, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#8B5CF6' }}>{i+1}</div>
                              <span style={{ fontSize: 12, color: '#CBD5F0' }}>Installment {i+1}</span>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: '#22C55E' }}>P{perInstallment.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
                              <div style={{ fontSize: 10, color: '#4B5580' }}>{date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* Terms */}
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '14px', fontSize: 12, color: '#7A8AAA', lineHeight: 1.7, maxHeight: 120, overflowY: 'auto' }}>
                <strong style={{ color: '#F0F4FF' }}>Terms & Conditions:</strong> By submitting this application, I confirm that all information provided is accurate. I understand that loans are subject to 8% flat interest rate, repayable in 4 equal installments every 5th and 20th of the month. Late payments will result in credit score deductions. I authorize LM Management to verify my information and contact my trustee if necessary.
              </div>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.agreed} onChange={e => set('agreed', e.target.checked)} style={{ marginTop: 2, width: 16, height: 16, accentColor: '#3B82F6', flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: '#7A8AAA', lineHeight: 1.6 }}>I have read and agree to the <strong style={{ color: '#F0F4FF' }}>Terms & Conditions</strong> of this loan application.</span>
              </label>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div style={{ marginTop: 16, padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, fontSize: 13, color: '#EF4444' }}>
            ⚠️ {error}
          </div>
        )}

        {/* Navigation */}
        <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
          {step > 1 && (
            <button onClick={() => { setStep(s => s - 1); setError('') }} style={{ flex: 1, padding: '13px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: '#7A8AAA', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              ← Back
            </button>
          )}
          {step < 3 ? (
            <button onClick={handleNext} style={{ flex: 2, padding: '13px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#3B82F6,#8B5CF6)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'Space Grotesk' }}>
              Continue →
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={loading} style={{ flex: 2, padding: '13px', borderRadius: 10, border: 'none', background: loading ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg,#22C55E,#3B82F6)', color: loading ? '#4B5580' : '#fff', fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {loading ? 'Submitting...' : "🚀 Submit Application"}
            </button>
          )}
        </div>

        {/* Footer note */}
        <p style={{ textAlign: 'center', fontSize: 12, color: '#4B5580', marginTop: 24, lineHeight: 1.7 }}>
          Your information is kept private and secure. For inquiries contact your department admin.
        </p>

        {/* FAQ */}
        <div style={{ marginTop: 40, marginBottom: 40 }}>
          <h3 style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 16, color: '#F0F4FF', marginBottom: 16, textAlign: 'center' }}>❓ Frequently Asked Questions</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <FAQItem question="Who can apply for a loan?" answer="This lending program is exclusively available to active employees of MySource Solutions. You must be currently employed and in good standing to be eligible. Applicants from outside the company will not be processed." />
            <FAQItem question="How much can I borrow?" answer="First-time borrowers are approved for ₱5,000. Your limit increases as you build a good repayment history — up to ₱10,000 over time." />
            <FAQItem question="How is the interest calculated?" answer="We use a flat 8% interest rate on the principal. For example, a ₱5,000 loan has a total repayment of ₱5,400, split into 4 installments of ₱1,350 each." />
            <FAQItem question="When are payments due?" answer="Payments are collected every 5th and 20th of the month — that's 2 payments per month for 2 months until your loan is fully paid." />
            <FAQItem question="Can I apply for another loan while I have an existing one?" answer="No. You must fully settle your current loan before applying for a new one. No rollovers or extensions are allowed." />
            <FAQItem question="What happens if I miss a payment?" answer="Missed payments will negatively affect your credit score and may freeze your loan limit increase. Consistent late payments may result in your loan being flagged as defaulted." />
            <FAQItem question="How will my loan be released and are there fees?" answer="Once approved, your loan will be released via your chosen method — Physical Cash, GCash, RCBC, or Other Bank Transfer. Release fees vary: Physical Cash and RCBC-to-RCBC are free, GCash charges P15 or 1% (whichever is higher), and other bank transfers require the borrower to cover the transfer fee. Fees are deducted from your approved amount before release." />
            <FAQItem question="What are the accepted repayment methods?" answer="You can repay your loan using any of the following methods. Always upload your proof of payment through the Borrower Portal after every transaction.">
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { logo: '/cash-logo.png', label: 'Physical Cash', fee: 'Free', desc: 'Pay your admin directly in person. No fees, no transfer needed.', freebie: true, border: 'rgba(34,197,94,0.25)' },
                  { logo: '/gcash-logo.png', label: 'GCash', fee: 'P15 or 1%', desc: 'Send to the admin GCash number. Fee is whichever is higher.', freebie: false, border: 'rgba(0,163,255,0.25)' },
                  { logo: '/rcbc-logo.png', label: 'RCBC to RCBC', fee: 'Free', desc: 'Transfer directly to the admin RCBC account. Same-bank transfers are free.', freebie: true, border: 'rgba(220,38,38,0.25)' },
                  { logo: '/bank-logo.png', label: 'Other Bank (Instapay/PESONet)', fee: 'You cover fee', desc: 'Transfer from any other bank. You must send the exact amount due - transfer fees are on your end.', freebie: false, border: 'rgba(139,92,246,0.25)' },
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, background: '#0B0F1A', border: `1px solid ${item.border}`, borderRadius: 12, padding: '14px 16px' }}>
                    <img src={item.logo} alt={item.label} style={{ width: 40, height: 40, objectFit: 'contain', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 13, color: '#F0F4FF' }}>{item.label}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: item.freebie ? '#22C55E' : '#F59E0B', background: item.freebie ? 'rgba(34,197,94,0.08)' : 'rgba(245,158,11,0.08)', padding: '2px 10px', borderRadius: 20, border: `1px solid ${item.freebie ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.2)'}` }}>{item.fee}</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#4B5580', lineHeight: 1.5 }}>{item.desc}</div>
                    </div>
                  </div>
                ))}
                <div style={{ marginTop: 4, padding: '10px 14px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 9, fontSize: 12, color: '#F59E0B', lineHeight: 1.6 }}>
                  Always upload your proof of payment through the <strong>Borrower Portal</strong> after every transaction so your admin can confirm it.
                </div>
              </div>
            </FAQItem>
            <FAQItem question="How long does approval take?" answer="Applications are reviewed manually by the admin. You will be contacted once your application has been approved or rejected." />
            <FAQItem question="Who can I contact for questions?" answer="For any inquiries, you may reach out to the following admins via Microsoft Teams chat:">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                {[{ name: 'John Paul Lacaron' }, { name: 'Charlou John Ramil' }].map((person, pi) => (
                  <div key={pi} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 9, padding: '10px 12px' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#3B82F6,#8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 13, color: '#fff', flexShrink: 0 }}>{person.name.charAt(0)}</div>
                    <div>
                      <div style={{ fontWeight: 700, color: '#F0F4FF', fontSize: 13 }}>{person.name}</div>
                      <div style={{ fontSize: 11, color: '#3B82F6' }}>Microsoft Teams</div>
                    </div>
                  </div>
                ))}
              </div>
            </FAQItem>
          </div>
        </div>

      </div>
    </div>
  )
}
