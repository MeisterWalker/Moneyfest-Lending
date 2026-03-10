import { useState } from 'react'
import { supabase } from '../lib/supabase'

const DEPARTMENTS = ['Minto Money', 'Greyhound']
const LOAN_AMOUNTS = [5000, 7000, 9000, 10000]

export default function PublicApplyPage() {
  const [step, setStep] = useState(1)
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    full_name: '', department: '', tenure_years: '', phone: '', email: '',
    address: '', trustee_name: '', trustee_phone: '', trustee_relationship: '',
    loan_amount: '', loan_purpose: '', agreed: false
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
          <div style={{ width: 38, height: 38, background: 'linear-gradient(135deg,#3B82F6,#8B5CF6)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>💼</div>
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
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 32 }}>
          {['Personal Info', 'Trustee', 'Loan Details'].map((label, i) => {
            const num = i + 1
            const done = step > num
            const active = step === num
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < 2 ? 1 : 'none' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, background: done ? '#22C55E' : active ? '#3B82F6' : 'rgba(255,255,255,0.05)', color: done || active ? '#fff' : '#4B5580', border: `2px solid ${done ? '#22C55E' : active ? '#3B82F6' : 'rgba(255,255,255,0.1)'}`, transition: 'all 0.2s' }}>
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
      </div>
    </div>
  )
}
