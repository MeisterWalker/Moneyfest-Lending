import { useState } from 'react'
import { supabase } from '../lib/supabase'

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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    full_name: '', department: '', tenure_years: '', phone: '', email: '',
    address: '', trustee_name: '', trustee_phone: '', trustee_relationship: '',
    loan_amount: '', loan_purpose: '', release_method: '', agreed: false
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const validateStep1 = () => {
    if (!form.full_name.trim()) return 'Full name is required'
    if (!form.department) return 'Department is required'
    if (!form.phone.trim()) return 'Phone number is required'
    if (!form.email.trim() || !form.email.includes('@')) return 'Valid email is required'
    return null
  }

  const validateStep2 = () => {
    if (!form.trustee_name.trim()) return 'Trustee name is required'
    if (!form.trustee_phone.trim()) return 'Trustee phone is required'
    if (!form.trustee_relationship.trim()) return 'Trustee relationship is required'
    return null
  }

  const validateStep3 = () => {
    if (!form.loan_amount) return 'Please select a loan amount'
    if (!form.release_method) return 'Please select a preferred release method'
    if (!form.agreed) return 'You must agree to the terms'
    return null
  }

  const handleNext = () => {
    const err = step === 1 ? validateStep1() : step === 2 ? validateStep2() : null
    if (err) { setError(err); return }
    setError('')
    setStep(s => s + 1)
  }

  const handleSubmit = async () => {
    const err = validateStep3()
    if (err) { setError(err); return }
    setError('')
    setLoading(true)
    const { error: dbErr } = await supabase.from('applications').insert({
      full_name: form.full_name.trim(),
      department: form.department,
      tenure_years: parseFloat(form.tenure_years) || 0,
      phone: form.phone.trim(),
      email: form.email.trim(),
      address: form.address.trim(),
      trustee_name: form.trustee_name.trim(),
      trustee_phone: form.trustee_phone.trim(),
      trustee_relationship: form.trustee_relationship.trim(),
      loan_amount: parseFloat(form.loan_amount),
      loan_purpose: form.loan_purpose.trim(),
      release_method: form.release_method,
      status: 'Pending',
      created_at: new Date().toISOString()
    })
    setLoading(false)
    if (dbErr) { setError('Submission failed. Please try again.'); return }
    setSubmitted(true)
  }

  const inputStyle = {
    width: '100%', padding: '12px 14px', borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.05)',
    color: '#F0F4FF', fontSize: 14, boxSizing: 'border-box',
    outline: 'none', fontFamily: 'DM Sans, sans-serif'
  }

  const labelStyle = {
    fontSize: 12, fontWeight: 600, color: '#7A8AAA',
    display: 'block', marginBottom: 6,
    textTransform: 'uppercase', letterSpacing: '0.06em'
  }

  if (submitted) return (
    <div style={{ minHeight: '100vh', background: '#0B0F1A', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ textAlign: 'center', maxWidth: 420 }}>
        <div style={{ fontSize: 64, marginBottom: 20 }}>🎉</div>
        <h2 style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 28, color: '#F0F4FF', marginBottom: 12 }}>Application Submitted!</h2>
        <p style={{ color: '#7A8AAA', fontSize: 15, lineHeight: 1.7, marginBottom: 24 }}>
          Thank you <strong style={{ color: '#F0F4FF' }}>{form.full_name}</strong>! Your loan application has been received and is now under review. Our admin will get back to you shortly.
        </p>
        <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 12, padding: '16px 20px' }}>
          <div style={{ fontSize: 13, color: '#22C55E', fontWeight: 600 }}>📋 Application Details</div>
          <div style={{ fontSize: 13, color: '#7A8AAA', marginTop: 8 }}>
            Amount Requested: <strong style={{ color: '#F0F4FF' }}>₱{parseFloat(form.loan_amount).toLocaleString()}</strong>
          </div>
          <div style={{ fontSize: 13, color: '#7A8AAA', marginTop: 4 }}>
            Release Method: <strong style={{ color: '#F0F4FF' }}>{form.release_method}</strong>
          </div>
          <div style={{ fontSize: 13, color: '#7A8AAA', marginTop: 4 }}>
            Status: <strong style={{ color: '#F59E0B' }}>Pending Review</strong>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#0B0F1A', fontFamily: 'DM Sans, sans-serif' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg,#0d1226,#141B2D)', borderBottom: '1px solid rgba(139,92,246,0.2)', padding: '20px 24px' }}>
        <div style={{ maxWidth: 560, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src="/favicon-96x96.png" alt="Loan Manifest" style={{ width: 48, height: 48, objectFit: 'contain' }} />
          <div>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 20, color: '#F0F4FF' }}>
              Loan<span style={{ background: 'linear-gradient(90deg,#60a5fa,#a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Manifest</span>
            </div>
            <div style={{ fontSize: 11, color: '#4B5580', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Loan Application</div>
          </div>
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
              <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < 2 ? 1 : 'none' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, fontFamily: 'Space Grotesk, sans-serif', background: done ? '#22C55E' : active ? '#3B82F6' : 'rgba(255,255,255,0.05)', color: done || active ? '#fff' : '#4B5580', border: `2px solid ${done ? '#22C55E' : active ? '#3B82F6' : 'rgba(255,255,255,0.1)'}`, transition: 'all 0.2s', flexShrink: 0, lineHeight: '32px', textAlign: 'center' }}>
                    {done ? '✓' : num}
                  </div>
                  <div style={{ fontSize: 11, color: active ? '#F0F4FF' : '#4B5580', fontWeight: active ? 600 : 400, whiteSpace: 'nowrap' }}>{label}</div>
                </div>
                {i < 2 && <div style={{ flex: 1, height: 2, background: done ? '#22C55E' : 'rgba(255,255,255,0.08)', margin: '0 8px', marginBottom: 22, transition: 'all 0.2s' }} />}
              </div>
            )
          })}
        </div>

        {/* Card */}
        <div style={{ background: '#141B2D', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '28px 28px' }}>

          {/* Step 1 — Personal Info */}
          {step === 1 && (
            <div>
              <h2 style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 20, color: '#F0F4FF', marginBottom: 6 }}>Personal Information</h2>
              <p style={{ fontSize: 13, color: '#7A8AAA', marginBottom: 24 }}>Please provide your personal details below.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={labelStyle}>Full Name *</label>
                  <input value={form.full_name} onChange={e => set('full_name', e.target.value)} placeholder="Juan dela Cruz" style={inputStyle} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Department *</label>
                    <select value={form.department} onChange={e => set('department', e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                      <option value="">Select...</option>
                      {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Tenure (Years)</label>
                    <input value={form.tenure_years} onChange={e => set('tenure_years', e.target.value)} placeholder="e.g. 2.5" type="number" style={inputStyle} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Phone Number *</label>
                    <input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="09XX XXX XXXX" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Email Address *</label>
                    <input value={form.email} onChange={e => set('email', e.target.value)} placeholder="juan@email.com" type="email" style={inputStyle} />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Home Address</label>
                  <input value={form.address} onChange={e => set('address', e.target.value)} placeholder="Street, City, Province" style={inputStyle} />
                </div>
              </div>
            </div>
          )}

          {/* Step 2 — Trustee */}
          {step === 2 && (
            <div>
              <h2 style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 20, color: '#F0F4FF', marginBottom: 6 }}>Trustee / Guarantor</h2>
              <p style={{ fontSize: 13, color: '#7A8AAA', marginBottom: 24 }}>Provide someone who can vouch for your loan repayment.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={labelStyle}>Trustee Full Name *</label>
                  <input value={form.trustee_name} onChange={e => set('trustee_name', e.target.value)} placeholder="Full name of trustee" style={inputStyle} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Trustee Phone *</label>
                    <input value={form.trustee_phone} onChange={e => set('trustee_phone', e.target.value)} placeholder="09XX XXX XXXX" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Relationship *</label>
                    <input value={form.trustee_relationship} onChange={e => set('trustee_relationship', e.target.value)} placeholder="e.g. Spouse, Sibling" style={inputStyle} />
                  </div>
                </div>
                <div style={{ background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: '#7A8AAA', lineHeight: 1.6 }}>
                  ℹ️ Your trustee will be contacted in case of missed payments or emergencies. Make sure they are aware of this application.
                </div>
              </div>
            </div>
          )}

          {/* Step 3 — Loan Details */}
          {step === 3 && (
            <div>
              <h2 style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 20, color: '#F0F4FF', marginBottom: 6 }}>Loan Details</h2>
              <p style={{ fontSize: 13, color: '#7A8AAA', marginBottom: 24 }}>Select your desired loan amount and agree to the terms.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={labelStyle}>Loan Amount Requested *</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                    {LOAN_AMOUNTS.map(amt => (
                      <button key={amt} onClick={() => set('loan_amount', amt)} style={{ padding: '14px', borderRadius: 10, border: `2px solid ${form.loan_amount === amt ? '#3B82F6' : 'rgba(255,255,255,0.08)'}`, background: form.loan_amount === amt ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.03)', color: form.loan_amount === amt ? '#F0F4FF' : '#7A8AAA', cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s' }}>
                        <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 20, color: form.loan_amount === amt ? '#22C55E' : '#7A8AAA' }}>₱{amt.toLocaleString()}</div>
                        <div style={{ fontSize: 11, marginTop: 2 }}>₱{(amt * 1.08 / 4).toFixed(2)}/cutoff</div>
                      </button>
                    ))}
                  </div>
                  <div style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 9, padding: '10px 14px', fontSize: 12, color: '#F59E0B', lineHeight: 1.6 }}>
                    ⚠️ <strong>Subject to approval.</strong> The amount you select is your request only. First-time borrowers are typically approved for ₱5,000 regardless of the amount requested. Higher limits are earned over time based on your repayment history and credit standing.
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Purpose of Loan</label>
                  <input value={form.loan_purpose} onChange={e => set('loan_purpose', e.target.value)} placeholder="e.g. Medical, Education, Emergency" style={inputStyle} />
                </div>

                {/* Release Method */}
                <div>
                  <label style={labelStyle}>Preferred Release Method *</label>
                  <p style={{ fontSize: 12, color: '#4B5580', marginBottom: 10, marginTop: -2 }}>
                    Note: Transaction fees will be deducted from your loan amount depending on the method chosen.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[
                      { value: 'Physical Cash', label: '💵 Physical Cash', desc: 'Receive your loan in cash. No transaction fee.', fee: null, feeColor: '#22C55E' },
                      { value: 'GCash', label: '💙 GCash', desc: 'Sent to your GCash number.', fee: 'Fee: ₱15 or 1% (whichever is higher)', feeColor: '#F59E0B' },
                      { value: 'RCBC', label: '🏦 RCBC Bank Transfer', desc: 'Transferred to your RCBC account.', fee: 'Free if RCBC to RCBC', feeColor: '#22C55E' },
                      { value: 'Other Bank Transfer', label: '🏛️ Other Bank Transfer', desc: 'Instapay/PESONet to any non-RCBC bank.', fee: 'Fee: ₱25 (Instapay) or ₱10 (PESONet)', feeColor: '#F59E0B' },
                    ].map(opt => (
                      <button key={opt.value} onClick={() => set('release_method', opt.value)} style={{ padding: '12px 14px', borderRadius: 10, border: `2px solid ${form.release_method === opt.value ? '#3B82F6' : 'rgba(255,255,255,0.07)'}`, background: form.release_method === opt.value ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.02)', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13, color: form.release_method === opt.value ? '#F0F4FF' : '#7A8AAA' }}>{opt.label}</div>
                          <div style={{ fontSize: 11, color: '#4B5580', marginTop: 2 }}>{opt.desc}</div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          {opt.fee
                            ? <div style={{ fontSize: 11, color: opt.feeColor, fontWeight: 600 }}>{opt.fee}</div>
                            : <div style={{ fontSize: 11, color: '#22C55E', fontWeight: 600 }}>✓ No fee</div>
                          }
                        </div>
                      </button>
                    ))}
                  </div>
                  {form.release_method && !['Physical Cash', 'RCBC'].includes(form.release_method) && (
                    <div style={{ marginTop: 8, padding: '9px 12px', background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, fontSize: 12, color: '#F59E0B' }}>
                      ⚠️ The applicable transaction fee will be deducted from your approved loan amount before release.
                    </div>
                  )}
                </div>

                {/* Terms */}
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '14px', fontSize: 12, color: '#7A8AAA', lineHeight: 1.7, maxHeight: 120, overflowY: 'auto' }}>
                  <strong style={{ color: '#F0F4FF' }}>Terms & Conditions:</strong> By submitting this application, I confirm that all information provided is accurate. I understand that loans are subject to 8% flat interest rate, repayable in 4 equal installments every 5th and 20th of the month. Late payments will result in credit score deductions. I authorize LM Management to verify my information and contact my trustee if necessary.
                </div>

                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.agreed} onChange={e => set('agreed', e.target.checked)} style={{ marginTop: 2, width: 16, height: 16, accentColor: '#3B82F6', flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: '#7A8AAA', lineHeight: 1.6 }}>
                    I have read and agree to the <strong style={{ color: '#F0F4FF' }}>Terms & Conditions</strong> of this loan application.
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{ marginTop: 16, padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, fontSize: 13, color: '#EF4444' }}>
              ⚠️ {error}
            </div>
          )}

          {/* Navigation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 28, gap: 10 }}>
            {step > 1 ? (
              <button onClick={() => { setStep(s => s - 1); setError('') }} style={{ padding: '11px 20px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#7A8AAA', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                ← Back
              </button>
            ) : <div />}

            {step < 3 ? (
              <button onClick={handleNext} style={{ padding: '11px 24px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#3B82F6,#8B5CF6)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                Next →
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={loading} style={{ padding: '11px 24px', borderRadius: 10, border: 'none', background: loading ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg,#22C55E,#3B82F6)', color: loading ? '#4B5580' : '#fff', fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                {loading ? <><div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> Submitting...</> : '🚀 Submit Application'}
              </button>
            )}
          </div>
        </div>

        <p style={{ textAlign: 'center', fontSize: 12, color: '#4B5580', marginTop: 20 }}>
          Your information is kept private and secure. For inquiries contact your department admin.
        </p>

        {/* Payment Methods */}
        <div style={{ marginTop: 40 }}>
          <h3 style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 16, color: '#F0F4FF', marginBottom: 16, textAlign: 'center' }}>
            💳 Accepted Payment Methods
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {/* GCash */}
            <div style={{ background: '#141B2D', border: '1px solid rgba(0,163,255,0.25)', borderRadius: 14, padding: '18px 20px', textAlign: 'center' }}>
              <img src="/gcash-logo.png" alt="GCash" style={{ height: 40, objectFit: 'contain', marginBottom: 10 }} />
              <div style={{ fontSize: 12, color: '#7A8AAA', lineHeight: 1.6 }}>Send your installment payment via GCash. Account details will be provided upon loan approval.</div>
            </div>
            {/* RCBC */}
            <div style={{ background: '#141B2D', border: '1px solid rgba(220,38,38,0.25)', borderRadius: 14, padding: '18px 20px', textAlign: 'center' }}>
              <img src="/rcbc-logo.png" alt="RCBC" style={{ height: 40, objectFit: 'contain', marginBottom: 10 }} />
              <div style={{ fontSize: 12, color: '#7A8AAA', lineHeight: 1.6 }}>Bank transfer via RCBC. Account details will be provided upon loan approval.</div>
            </div>
          </div>
          <div style={{ marginTop: 10, padding: '10px 14px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 9, fontSize: 12, color: '#F59E0B', textAlign: 'center' }}>
            ⚠️ Always send proof of payment to your admin after every transaction.
          </div>
        </div>

        {/* FAQ */}
        <div style={{ marginTop: 40, marginBottom: 40 }}>
          <h3 style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 16, color: '#F0F4FF', marginBottom: 16, textAlign: 'center' }}>
            ❓ Frequently Asked Questions
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              {
                q: 'Who can apply for a loan?',
                a: 'This lending program is exclusively available to active employees of MySource Solutions. You must be currently employed and in good standing to be eligible. Applicants from outside the company will not be processed.'
              },
              {
                q: 'How much can I borrow?',
                a: 'First-time borrowers are approved for ₱5,000. Your limit increases as you build a good repayment history — up to ₱10,000 over time.'
              },
              {
                q: 'How is the interest calculated?',
                a: 'We use a flat 8% interest rate on the principal. For example, a ₱5,000 loan has a total repayment of ₱5,400, split into 4 installments of ₱1,350 each.'
              },
              {
                q: 'When are payments due?',
                a: 'Payments are collected every 5th and 20th of the month — that\'s 2 payments per month for 2 months until your loan is fully paid.'
              },
              {
                q: 'Can I apply for another loan while I have an existing one?',
                a: 'No. You must fully settle your current loan before applying for a new one. No rollovers or extensions are allowed.'
              },
              {
                q: 'What happens if I miss a payment?',
                a: 'Missed payments will negatively affect your credit score and may freeze your loan limit increase. Consistent late payments may result in your loan being flagged as defaulted.'
              },
              {
                q: 'How long does approval take?',
                a: 'Applications are reviewed manually by the admin. You will be contacted once your application has been approved or rejected.'
              },
              {
                q: 'Who can I contact for questions?',
                a: 'For any inquiries, you may reach out to the following admins via Microsoft Teams chat:'
              },
            ].map((item, i) => (
              <FAQItem key={i} question={item.q} answer={item.a}>
                {item.q === 'Who can I contact for questions?' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                    {[
                      { name: 'John Paul Lacaron', role: 'Admin' },
                      { name: 'Charlou John Ramil', role: 'Admin' },
                    ].map((person, pi) => (
                      <div key={pi} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 9, padding: '10px 12px' }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#3B82F6,#8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 13, color: '#fff', flexShrink: 0 }}>
                          {person.name.charAt(0)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: '#F0F4FF', fontSize: 13 }}>{person.name}</div>
                          <div style={{ fontSize: 11, color: '#3B82F6' }}>📱 Microsoft Teams</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </FAQItem>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
