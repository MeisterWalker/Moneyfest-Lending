import { useState, useEffect } from 'react'
import { calcSecurityHold, CREDIT_CONFIG } from '../lib/creditSystem'
import { supabase } from '../lib/supabase'
import { sendPendingEmail, sendApplicationReceivedAdminEmail } from '../lib/emailService'
import { usePageVisit } from '../hooks/usePageVisit'
import ChatBot from '../components/ChatBot'

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

function SuccessScreen({ accessCode, fullName, loanAmount }) {
  const [copied, setCopied] = useState(false)
  const [codeSaved, setCodeSaved] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(accessCode).then(() => { setCopied(true); setCodeSaved(true); setTimeout(() => setCopied(false), 2000) }).catch(() => {
      const el = document.createElement('textarea'); el.value = accessCode; document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el)
      setCopied(true); setCodeSaved(true); setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <div style={{ minHeight: '100dvh', background: '#0B0F1A', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', padding: 'clamp(24px, 5vw, 40px) clamp(16px, 4vw, 24px)', position: 'relative', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <style>{`@keyframes confettiFall{0%{transform:translateY(-20px) rotate(0deg);opacity:1}100%{transform:translateY(110vh) rotate(720deg);opacity:0}}@keyframes confettiSway{0%,100%{margin-left:0px}25%{margin-left:30px}75%{margin-left:-30px}}@keyframes codePulse{0%,100%{box-shadow:0 0 0 0 rgba(139,92,246,0.4)}50%{box-shadow:0 0 0 8px rgba(139,92,246,0)}}@keyframes warningPulse{0%,100%{border-color:rgba(245,158,11,0.4)}50%{border-color:rgba(245,158,11,0.9)}}.confetti-piece{position:fixed;top:-20px;animation:confettiFall linear forwards,confettiSway ease-in-out infinite;z-index:0;border-radius:2px;pointer-events:none}.code-pulse{animation:codePulse 2s ease-in-out infinite}.warning-pulse{animation:warningPulse 1.5s ease-in-out infinite}`}</style>
      {Array.from({ length: 80 }, (_, i) => { const colors = ['#3B82F6','#8B5CF6','#22C55E','#F59E0B','#EF4444','#14B8A6','#EC4899','#F97316','#A78BFA','#34D399']; const isCircle = i % 5 === 0; const w = 6 + (i % 3) * 4; const h = 8 + (i % 4) * 4; return <div key={i} className="confetti-piece" style={{ left: ((i * 1.27) % 100) + 'vw', width: isCircle ? w : w, height: isCircle ? w : h, borderRadius: isCircle ? '50%' : '2px', background: colors[i % colors.length], animationDuration: (2.5 + (i % 4) * 0.5) + 's, ' + ((2.5 + (i % 4) * 0.5) * 0.8) + 's', animationDelay: ((i * 0.07) % 3) + 's, ' + ((i * 0.07) % 3) + 's', opacity: 0.9 }} /> })}
      <div style={{ maxWidth: 500, width: '100%', position: 'relative', zIndex: 1, margin: 'auto 0' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <img src="/verified.png" alt="verified" style={{ width: 72, height: 72, objectFit: 'contain', marginBottom: 14 }} />
          <h2 style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 26, color: '#F0F4FF', margin: '0 0 8px', letterSpacing: -0.5 }}>Application Submitted!</h2>
          <p style={{ color: '#7A8AAA', fontSize: 14, lineHeight: 1.7, margin: 0 }}>Thank you <strong style={{ color: '#F0F4FF' }}>{fullName}</strong>! Your application is now under review.</p>
        </div>
        {!codeSaved && (
          <div className="warning-pulse" style={{ background: 'rgba(245,158,11,0.1)', border: '2px solid rgba(245,158,11,0.4)', borderRadius: 12, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22, flexShrink: 0 }}>⚠️</span>
            <div><div style={{ fontSize: 13, fontWeight: 700, color: '#F59E0B', marginBottom: 2 }}>Save your access code before leaving!</div><div style={{ fontSize: 12, color: '#7A8AAA', lineHeight: 1.5 }}>This is the only way to access your loan status. Copy it now — you won't see this again.</div></div>
          </div>
        )}
        <div className="code-pulse" style={{ background: 'linear-gradient(135deg,#0f1729,#1a1040)', border: '2px solid rgba(139,92,246,0.5)', borderRadius: 18, padding: '28px 28px 24px', marginBottom: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#4B5580', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><img src="/padlock.png" alt="access" style={{ width: 13, height: 13, objectFit: 'contain' }} /> Your Portal Access Code</div>
          <div style={{ fontSize: 'clamp(28px, 8vw, 40px)', fontWeight: 900, letterSpacing: 10, color: '#F0F4FF', fontFamily: 'monospace', marginBottom: 6, textShadow: '0 0 20px rgba(139,92,246,0.4)' }}>{accessCode}</div>
          <div style={{ fontSize: 12, color: '#4B5580', marginBottom: 20 }}>Use this code to log in to the Borrower Portal</div>
          <button onClick={handleCopy} style={{ width: '100%', padding: '13px', borderRadius: 10, border: copied ? '1px solid rgba(34,197,94,0.3)' : 'none', background: copied ? 'rgba(34,197,94,0.15)' : 'linear-gradient(135deg,#8B5CF6,#6366F1)', color: copied ? '#22C55E' : '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'Space Grotesk', marginBottom: 12, transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {copied ? <><span style={{ fontSize: 16 }}>✅</span> Copied to clipboard!</> : <><span style={{ fontSize: 16 }}>📋</span> Copy Access Code</>}
          </button>
          {codeSaved && <div style={{ fontSize: 12, color: '#22C55E', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginBottom: 12 }}>✓ Code saved — you can now access the portal</div>}
          <a href="/portal" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)', color: '#60A5FA', textDecoration: 'none', padding: '11px 28px', borderRadius: 10, fontSize: 13, fontWeight: 700, fontFamily: 'Space Grotesk' }}><img src="/startup.png" alt="portal" style={{ width: 14, height: 14, objectFit: 'contain' }} /> Go to Borrower Portal →</a>
        </div>
        <div style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 12, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>📸</span>
          <div style={{ fontSize: 12, color: '#7A8AAA', lineHeight: 1.6 }}><strong style={{ color: '#CBD5F0', display: 'block', marginBottom: 2 }}>Tip: Take a screenshot of this page</strong>Your access code is <strong style={{ color: '#F0F4FF' }}>{accessCode}</strong>. Without it, you won't be able to check your application status. A confirmation email has been sent to your email address.</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 16 }}>
          <div style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 12, padding: '14px 16px' }}><div style={{ fontSize: 11, color: '#4B5580', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Loan Amount</div><div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 20, color: '#22C55E' }}>₱{parseFloat(loanAmount).toLocaleString()}</div></div>
          <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 12, padding: '14px 16px' }}><div style={{ fontSize: 11, color: '#4B5580', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</div><div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 20, color: '#F59E0B' }}>Pending</div></div>
        </div>
        <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 12, padding: '16px 20px' }}>
          <div style={{ fontSize: 13, color: '#60A5FA', fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 7 }}><img src='/mail.png' alt='mail' style={{ width: 16, height: 16, objectFit: 'contain' }} />Need to follow up?</div>
          <p style={{ fontSize: 13, color: '#7A8AAA', lineHeight: 1.7, margin: '0 0 12px' }}>Our admin team is here to help with any questions about your application.</p>
          <a href="/contact" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 10, background: 'linear-gradient(135deg,rgba(59,130,246,0.15),rgba(139,92,246,0.15))', border: '1px solid rgba(139,92,246,0.3)', color: '#a78bfa', textDecoration: 'none', fontSize: 13, fontWeight: 700, fontFamily: 'Space Grotesk' }}>
            💬 Contact Us →
          </a>
        </div>
      </div>
    </div>
  )
}

function SidebarInfo({ step }) {
  const steps = [
    { num: 1, title: 'Fill in your details', desc: 'Name, department, contact info.' },
    { num: 2, title: 'Upload your ID', desc: 'Front and back of a government-issued ID.' },
    { num: 3, title: 'Choose loan amount', desc: 'Select amount, release method, agree to terms.' },
  ]
  return (
    <div style={{ background: '#0f1420', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 14, padding: '18px 20px', marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#60A5FA', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>📋 What to expect</div>
      {steps.map((s, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: i < 2 ? 12 : 0 }}>
          <div style={{ width: 22, height: 22, borderRadius: '50%', background: step > s.num ? '#22C55E' : step === s.num ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)', border: `1px solid ${step > s.num ? '#22C55E' : step === s.num ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.08)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: step > s.num ? '#fff' : step === s.num ? '#818CF8' : '#4B5580', flexShrink: 0, marginTop: 1 }}>
            {step > s.num ? '✓' : s.num}
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: step >= s.num ? '#F0F4FF' : '#4B5580', marginBottom: 2 }}>{s.title}</div>
            <div style={{ fontSize: 11, color: '#4B5580', lineHeight: 1.5 }}>{s.desc}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

function SidebarTiers() {
  return (
    <div style={{ background: '#0f1420', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: '18px 20px', marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#7A8AAA', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Loan limits by tier</div>
      {[
        { icon: '🌱', label: 'New', limit: '₱5,000', req: 'First loan', color: '#7A8AAA' },
        { icon: '⭐', label: 'Trusted', limit: '₱7,000', req: '1 clean loan', color: '#F59E0B' },
        { icon: '🤝', label: 'Reliable', limit: '₱9,000', req: '2 clean loans', color: '#3B82F6' },
        { icon: '👑', label: 'VIP', limit: '₱10,000', req: '3 clean loans', color: '#8B5CF6' },
      ].map((t, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: i < 3 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
          <span style={{ fontSize: 14, width: 20, flexShrink: 0 }}>{t.icon}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: t.color, minWidth: 60 }}>{t.label}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#22C55E', marginLeft: 'auto' }}>{t.limit}</span>
          <span style={{ fontSize: 11, color: '#4B5580', marginLeft: 8 }}>{t.req}</span>
        </div>
      ))}
    </div>
  )
}

function SidebarCalc({ interestRate, selectedAmount, loanTerm = 2, loanType = 'regular' }) {
  if (!selectedAmount) return (
    <div style={{ background: '#0f1420', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: '18px 20px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#7A8AAA', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>💰 Quick estimate</div>
      <div style={{ fontSize: 12, color: '#4B5580', textAlign: 'center', padding: '12px 0' }}>Select a loan amount to see your breakdown</div>
    </div>
  )

  const principal = parseFloat(selectedAmount)
  const isQuickLoan = loanType === 'quickloan'

  if (isQuickLoan) {
    const dailyInterest = parseFloat((principal * 0.1 / 30).toFixed(2))
    const day15Interest = parseFloat((dailyInterest * 15).toFixed(2))
    const day15Total = parseFloat((principal + day15Interest).toFixed(2))
    const day30Interest = parseFloat((dailyInterest * 30).toFixed(2))
    const day30Total = parseFloat((principal + day30Interest + 100).toFixed(2))
    return (
      <div style={{ background: 'linear-gradient(135deg,rgba(15,23,41,1),rgba(40,25,10,0.9))', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 14, padding: '18px 20px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#F59E0B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>⚡ QuickLoan Breakdown</div>
        {[
          { lbl: 'Loan principal', val: '₱' + principal.toLocaleString('en-PH'), color: '#F0F4FF' },
          { lbl: 'Daily interest', val: '₱' + dailyInterest.toFixed(2) + '/day', color: '#a78bfa' },
          { lbl: 'You receive', val: '₱' + principal.toLocaleString('en-PH'), color: '#22C55E' },
          { lbl: 'No security hold', val: '✓', color: '#22C55E' },
        ].map((r, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: i < 3 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
            <span style={{ fontSize: 11, color: '#4B5580' }}>{r.lbl}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: r.color }}>{r.val}</span>
          </div>
        ))}
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ padding: '10px 12px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 9, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: '#4B5580', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>If paid on Day 15</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#22C55E', fontFamily: 'Space Grotesk' }}>₱{day15Total.toLocaleString('en-PH')}</div>
            <div style={{ fontSize: 10, color: '#4B5580', marginTop: 2 }}>principal + {day15Interest.toFixed(2)} interest</div>
          </div>
          <div style={{ padding: '10px 12px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 9, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: '#4B5580', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>If missed Day 15 (Day 30 max)</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#F59E0B', fontFamily: 'Space Grotesk' }}>₱{day30Total.toLocaleString('en-PH')}</div>
            <div style={{ fontSize: 10, color: '#4B5580', marginTop: 2 }}>+ ₱100 extension fee</div>
          </div>
        </div>
      </div>
    )
  }

  // Regular / Installment loan breakdown
  const numInstallments = loanTerm * 2
  const interest = principal * interestRate * loanTerm
  const total = principal + interest
  const perInst = Math.ceil(total / numInstallments)
  const hold = principal * 0.10
  const received = principal - hold
  return (
    <div style={{ background: 'linear-gradient(135deg,rgba(15,23,41,1),rgba(26,16,64,0.9))', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 14, padding: '18px 20px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#22C55E', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>💰 Loan breakdown</div>
      {[
        { lbl: 'Loan principal', val: '₱' + principal.toLocaleString('en-PH'), color: '#F0F4FF' },
        { lbl: `Interest (7%/mo × ${loanTerm})`, val: '₱' + interest.toLocaleString('en-PH', { minimumFractionDigits: 2 }), color: '#a78bfa' },
        { lbl: 'Security hold (10%)', val: '₱' + hold.toLocaleString('en-PH', { minimumFractionDigits: 2 }), color: '#F59E0B' },
        { lbl: 'You receive', val: '₱' + received.toLocaleString('en-PH', { minimumFractionDigits: 2 }), color: '#22C55E' },
        { lbl: 'Total repayment', val: '₱' + total.toLocaleString('en-PH', { minimumFractionDigits: 2 }), color: '#F0F4FF' },
      ].map((r, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: i < 4 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
          <span style={{ fontSize: 11, color: '#4B5580' }}>{r.lbl}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: r.color }}>{r.val}</span>
        </div>
      ))}
      <div style={{ marginTop: 12, padding: '10px 12px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 9, textAlign: 'center' }}>
        <div style={{ fontSize: 10, color: '#4B5580', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Per installment ({numInstallments} total)</div>
        <div style={{ fontSize: 20, fontWeight: 900, color: '#22C55E', fontFamily: 'Space Grotesk' }}>₱{perInst.toLocaleString('en-PH')}</div>
        <div style={{ fontSize: 10, color: '#4B5580', marginTop: 2 }}>every 5th & 20th of month</div>
      </div>
    </div>
  )
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
  const [departments, setDepartments] = useState([])  // Dynamic Departments

  useEffect(() => {
    supabase.from('settings').select('interest_rate').eq('id', 1).single()
      .then(({ data }) => { if (data?.interest_rate) setInterestRate(data.interest_rate) })
    // Fetch departments from DB alphabetically
    supabase.from('departments').select('name').eq('active', true).order('name')
      .then(({ data }) => { if (data) setDepartments(data.map(d => d.name)) })
  }, [])

  const [form, setForm] = useState({
    full_name: '', department: '', custom_department: '', tenure_years: '', phone: '', email: '', address: '',
    loan_type: 'regular',
    loan_amount: '',
    loan_purpose: '',
    loan_term: 2,
    release_method: '',
    building: '',
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
    if (!form.department) return 'Please enter your department'
    if (form.department === 'Other' && !form.custom_department?.trim()) return 'Please type your custom department'
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
    if (step === 1) { const err = validateStep1(); if (err) { setError(err); return }; setError(''); setStep(2) }
    else if (step === 2) { const err = validateStep2(); if (err) { setError(err); return }; setError(''); setStep(3) }
  }

  const handleSubmit = async () => {
    const err = validateStep3(); if (err) { setError(err); return }
    if (loading) return  // ← double-submit guard
    setError(''); setLoading(true)

    // ── Duplicate check ──────────────────────────────────────────────────
    // 1. Borrowers table: block if email, name, OR phone already registered
    const email   = form.email.trim()
    const name    = form.full_name.trim()
    const phone   = form.phone.trim()

    const { data: dupBorrower } = await supabase
      .from('borrowers').select('id')
      .or(`email.ilike.${email},full_name.ilike.${name},phone.eq.${phone}`)
      .limit(1)

    if (dupBorrower && dupBorrower.length > 0) {
      setError('You are already a registered borrower. Please log in to your Borrower Portal to request a new loan.')
      setLoading(false); return
    }

    // 2. Applications table: check for existing record
    const [{ data: appsByEmail }, { data: appsByPhone }] = await Promise.all([
      supabase.from('applications').select('id, status')
        .ilike('email', email)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase.from('applications').select('id, status')
        .eq('phone', phone)
        .order('created_at', { ascending: false })
        .limit(5)
    ])

    const allMatches = [
      ...(appsByEmail || []),
      ...(appsByPhone || [])
    ]

    // Priority: active statuses first, Denied last
    const existingApp =
      allMatches.find(a => ['Pending', 'Under Review'].includes(a.status)) ||
      allMatches.find(a => a.status === 'Approved') ||
      allMatches.find(a => a.status === 'Denied') ||
      null

    if (existingApp) {
      if (existingApp.status === 'Pending' || 
          existingApp.status === 'Under Review') {
        setError('You already have an application currently under review. Please wait for a decision before submitting a new one.')
        setLoading(false); return
      }
      if (existingApp.status === 'Approved') {
        setError('You are already a registered borrower. Please log in to your Borrower Portal to request a new loan.')
        setLoading(false); return
      }
      if (existingApp.status === 'Denied') {
        setError('You have a previous denied application on file. Please visit the Application Status page and use your original access code to reapply from there — your previous information has been saved for you.')
        setLoading(false); return
      }
      // Any other unknown status — block to be safe
      setError('A previous application was found under your details. Please contact admin for assistance.')
      setLoading(false); return
    }
    // ── End duplicate check ──────────────────────────────────────────────

    // FE-04 FIX: Use crypto.randomUUID for higher entropy (8 chars = 36^8 ≈ 2.8 trillion combos)
    const code = 'LM-' + crypto.randomUUID().replace(/-/g, '').substring(0, 8).toUpperCase()
    let validIdPath = null, validIdBackPath = null
    if (idFile) {
      const ext = idFile.name.split('.').pop()
      const ts = Date.now()
      const filePath = `${code}/${ts}-id-front.${ext}`
      const { error: uploadErr } = await supabase.storage.from('valid-ids').upload(filePath, idFile, { contentType: idFile.type, upsert: false })
      if (uploadErr) { setError('Failed to upload ID front. Please try again.'); setLoading(false); return }
      validIdPath = filePath
    }
    if (idFileBack) {
      const ext = idFileBack.name.split('.').pop()
      const ts = Date.now()
      const filePath = `${code}/${ts}-id-back.${ext}`
      const { error: uploadErr } = await supabase.storage.from('valid-ids').upload(filePath, idFileBack, { contentType: idFileBack.type, upsert: false })
      if (uploadErr) { setError('Failed to upload ID back. Please try again.'); setLoading(false); return }
      validIdBackPath = filePath
    }
    const { error: dbErr } = await supabase.from('applications').insert({
      full_name: form.full_name.trim(),
      department: form.department === 'Other' ? form.custom_department.trim() : form.department,
      tenure_years: parseFloat(form.tenure_years) || 0,
      phone: form.phone.trim(),
      email: form.email.trim(),
      address: form.address.trim(),
      loan_type: form.loan_type || 'regular',
      loan_amount: parseFloat(form.loan_amount),
      loan_purpose: form.loan_purpose.trim(),
      loan_term: form.loan_type === 'quickloan' ? null : (form.loan_term || 2),
      release_method: form.release_method,
      building: form.building,
      gcash_number: form.gcash_number.trim() || null,
      gcash_name: form.gcash_name.trim() || null,
      bank_account_number: form.bank_account_number.trim() || null,
      bank_name: form.bank_name.trim() || null,
      bank_account_holder: form.bank_account_holder.trim() || null,
      valid_id_path: validIdPath,
      valid_id_back_path: validIdBackPath,
      access_code: code,
      status: 'Pending',
    })
    if (dbErr) { setError('Submission failed. Please try again.'); setLoading(false); return }
    if (form.email.trim()) {
      sendPendingEmail({ to: form.email.trim(), borrowerName: form.full_name.trim(), accessCode: code, loanAmount: parseFloat(form.loan_amount) }).catch(() => {})
      sendApplicationReceivedAdminEmail({ borrowerName: form.full_name.trim(), loanAmount: parseFloat(form.loan_amount), accessCode: code, loanType: form.loan_type === 'quickloan' ? '⚡ QuickLoan' : '📅 Installment' }).catch(() => {})
    }
    setAccessCode(code); setSubmitted(true); setLoading(false)
  }

  const inp = { width: '100%', boxSizing: 'border-box', padding: '10px 13px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, color: '#F0F4FF', fontSize: 13, outline: 'none', fontFamily: 'DM Sans, sans-serif', transition: 'border-color 0.2s' }
  const lbl = { display: 'block', fontSize: 10, color: '#7A8AAA', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700 }

  const calcDueDates = () => {
    const numInst = (form.loan_term || 2) * 2
    const today = new Date(); const d = today.getDate(), m = today.getMonth(), y = today.getFullYear()
    let firstDay = d <= 5 ? 20 : 5
    let firstMonth = d <= 5 ? m : m + 1
    let firstYear = y
    if (firstMonth > 11) { firstMonth = 0; firstYear += 1 }
    const dates = []
    let curDay = firstDay, curMonth = firstMonth, curYear = firstYear
    for (let i = 0; i < numInst; i++) {
      dates.push(new Date(curYear, curMonth, curDay))
      if (curDay === 5) { curDay = 20 }
      else { curDay = 5; curMonth += 1; if (curMonth > 11) { curMonth = 0; curYear += 1 } }
    }
    return dates
  }

  if (submitted) return <SuccessScreen accessCode={accessCode} fullName={form.full_name} loanAmount={form.loan_amount} />

  const progressPct = step === 1 ? 16 : step === 2 ? 50 : 83

  const cardStyle = { background: '#0f1624', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, overflow: 'hidden' }
  const cardHeader = { padding: 'clamp(14px, 3vw, 18px) clamp(14px, 3vw, 22px)', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: 10 }
  const cardBody = { padding: 'clamp(14px, 3vw, 22px)' }
  const cardFooter = { padding: 'clamp(12px, 3vw, 16px) clamp(14px, 3vw, 22px)', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }
  const iconBox = (color) => ({ width: 36, height: 36, borderRadius: 9, background: `rgba(${color},0.12)`, border: `1px solid rgba(${color},0.2)`, display: 'flex', alignItems: 'center', justifyContent: 'center' })

  return (
    <div style={{ minHeight: '100dvh', background: '#07090F', fontFamily: 'DM Sans, sans-serif', position: 'relative', overflowX: 'hidden', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <style>{`
        .apply-grid-bg{position:fixed;inset:0;pointer-events:none;opacity:0.025;z-index:0;background-image:linear-gradient(rgba(255,255,255,0.8) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.8) 1px,transparent 1px);background-size:48px 48px}
        .apply-inp:focus{border-color:rgba(99,102,241,0.5)!important;outline:none}
        .upload-zone{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:24px 12px;border-radius:12px;cursor:pointer;transition:all 0.2s;min-height:130px}
        .upload-zone:hover{background:rgba(255,255,255,0.04)!important}
        .amt-btn{padding:16px 12px;border-radius:12px;cursor:pointer;text-align:center;transition:all 0.15s;minHeight: '72px'}
        .amt-btn:hover{transform:translateY(-2px)}
        .release-opt{padding:11px 14px;border-radius:10px;cursor:pointer;text-align:left;display:flex;justify-content:space-between;align-items:center;gap:10px;transition:all 0.15s;width:100%}
        .release-opt:hover{background:rgba(255,255,255,0.04)!important}
        .submit-btn:hover .rocket-icon{animation:rocketFly 0.6s ease-in-out infinite}
        @keyframes rocketFly{0%{transform:translate(0,0) rotate(-45deg)}25%{transform:translate(3px,-4px) rotate(-45deg)}50%{transform:translate(6px,-8px) rotate(-45deg)}75%{transform:translate(3px,-4px) rotate(-45deg)}100%{transform:translate(0,0) rotate(-45deg)}}
        @media(max-width:820px){.apply-2col{grid-template-columns:1fr!important}.apply-sidebar{display:none!important}}
        @media(max-width:400px){.header-faq{display:none!important}}
        @media(max-width:480px){
          .step-label{display:none!important}
          .apply-2col{padding-left:12px!important;padding-right:12px!important}
          .upload-zone{min-height:110px!important;padding:16px 8px!important}
          .release-opt{padding:10px 12px!important}
        }
      `}</style>

      <div className="apply-grid-bg" />
      <div style={{ position: 'fixed', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle,rgba(99,102,241,0.07) 0%,transparent 70%)', top: '-10%', right: '-8%', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', width: 350, height: 350, borderRadius: '50%', background: 'radial-gradient(circle,rgba(59,130,246,0.06) 0%,transparent 70%)', bottom: '5%', left: '-5%', pointerEvents: 'none', zIndex: 0 }} />

      <div style={{ position: 'relative', zIndex: 1 }}>

        {/* Disclaimer Modal */}
        {showDisclaimer && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20 }}>
            <div style={{ background: '#141B2D', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 20, padding: 'clamp(18px, 4vw, 32px)', width: '100%', maxWidth: 460, maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <img src="/warning.png" alt="warning" style={{ width: 44, height: 44, objectFit: 'contain', marginBottom: 12 }} />
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

        {/* T&C Modal */}
        {showTnC && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20 }}>
            <div style={{ background: '#141B2D', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 20, width: '100%', maxWidth: 560, maxHeight: '92dvh', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: 'clamp(18px, 4vw, 32px)', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <img src="/list.png" alt="terms" style={{ width: 22, height: 22, objectFit: 'contain' }} />
                  <div>
                    <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 17, color: '#F0F4FF' }}>
                      {form.loan_type === 'quickloan' ? '⚡ QuickLoan Terms & Conditions' : 'Terms & Conditions'}
                    </div>
                    <div style={{ fontSize: 11, color: '#4B5580', marginTop: 1 }}>MoneyfestLending Workplace Lending Program</div>
                  </div>
                </div>
                <button onClick={() => setShowTnC(false)} style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.07)', color: '#7A8AAA', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
              </div>
              {!tncScrolled && <div style={{ padding: '8px 28px', background: 'rgba(99,102,241,0.08)', borderBottom: '1px solid rgba(99,102,241,0.15)', fontSize: 12, color: '#7A8AAA', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}><span style={{ fontSize: 14 }}>👇</span> Please scroll to the bottom to enable the agree button</div>}
              {tncScrolled && <div style={{ padding: '8px 28px', background: 'rgba(34,197,94,0.06)', borderBottom: '1px solid rgba(34,197,94,0.15)', fontSize: 12, color: '#22C55E', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}><span>✅</span> You've read the terms — you can now agree below</div>}
              <div style={{ padding: '24px 28px', overflowY: 'auto', flex: 1, lineHeight: 1.85, fontSize: 13, color: '#8892B0' }}
                onScroll={e => { const el = e.target; if (el.scrollHeight - el.scrollTop <= el.clientHeight + 40) setTncScrolled(true) }}>
                {(() => {
                  const installmentTerms = [
                    { title: '1. Eligibility', body: 'This lending program is exclusively available to active team members in good standing within our office. By submitting an application, you confirm that you are currently employed and eligible to participate.' },
                    { title: '2. Loan Amount & Limits', body: 'All first-time borrowers are approved at a maximum of ₱5,000 regardless of the amount requested. Limits increase after clean repayments: Level 2 (1 clean loan) — ₱7,000; Level 3 (2 clean loans) — ₱9,000; Level 4 (3 clean loans) — ₱10,000 maximum. A "clean loan" means fully repaid with no defaults. Upgrades require a credit score of at least 750.' },
                    { title: '3. Loan Terms & Interest', body: `Approved loans are subject to a monthly interest rate of ${(interestRate * 100).toFixed(0)}% applied over your chosen loan term (2 or 3 months). For a 2-month term: total interest is ${(interestRate * 2 * 100).toFixed(0)}% of the principal. For a 3-month term: total interest is ${(interestRate * 3 * 100).toFixed(0)}%. This is not a compounding rate. The total repayable amount is fixed at the time of approval.` },
                    { title: '4. Repayment Schedule & Installment Rounding', body: `Loans are repaid in equal installments — 4 for a 2-month term, 6 for a 3-month term — collected every 5th and 20th of the month. Where the total repayment does not divide evenly, each installment is rounded up to the nearest whole peso (₱1.00), applied uniformly across all installments.` },
                    { title: '5. Late Payments & Default', body: 'A late payment penalty of ₱20 per calendar day is charged for each installment not paid by its due date. The penalty accrues daily with no cap until settled. Late payments result in a -10 point credit score deduction per missed installment. Penalties are automatically deducted from the Security Hold balance. A loan is in default if two (2) consecutive installments are missed. Upon default, the full remaining balance becomes immediately due, a -150 point deduction is applied, and MoneyfestLending reserves the right to pursue all legal remedies under Philippine law including filing a civil complaint and referral to barangay conciliation (RA 7160).' },
                    { title: '6. Early Payoff Rebate Credits', body: 'If your final installment is paid at least 7 to 14 days before its due date, you will receive a fixed 1% rebate on your original loan principal, credited to your Rebate Credits balance. The rebate applies only to the final installment. Rebate Credits can be withdrawn once the balance reaches ₱500, subject to admin approval.' },
                    { title: '7. Security Hold', body: 'A Security Hold is withheld from your approved loan amount upon release. The rate is determined by your credit score: VIP (1000) — 5%, Reliable (920+) — 6%, Trusted (835+) — 8%, Standard (750+) — 10%, Caution (500+) — 15%, High Risk (below 500) — 20%. Late payment penalties are deducted from this balance. The remaining Security Hold is automatically returned to your Rebate Credits after your final installment is confirmed.' },
                    { title: '8. Credit Score System', body: 'Every borrower starts with a score of 750 (max 1,000). +15 points per on-time installment. -10 points per late installment. +25 bonus points on full loan repayment. -150 points upon default. Your score affects your Security Hold rate, borrower tier, and loan limit.' },
                    { title: '9. Accuracy of Information', body: 'By submitting an application, you confirm that all information provided is accurate, complete, and truthful. Providing false or misleading information is grounds for immediate rejection or cancellation of your loan.' },
                    { title: '10. ID Verification', body: "A valid government-issued ID is required for all applications. Accepted IDs include SSS, GSIS, PhilHealth, Pag-IBIG, Passport, Driver's License, Postal ID, Voter's ID, PRC ID, and Senior Citizen ID." },
                    { title: '11. Authorization & Data Privacy', body: 'You authorize MoneyfestLending administrators to verify your submitted information and process your personal data in accordance with our Privacy Notice and the Data Privacy Act of 2012 (RA 10173). Data will not be shared with third parties without consent except as required by law.' },
                    { title: '12. Program Rules', body: 'Only one active loan is permitted per borrower at a time. The Lender reserves the right to approve, reject, or adjust any loan application at its sole discretion without obligation to disclose specific reasons.' },
                    { title: '13. Truth in Lending Disclosure (RA 3765)', body: `In compliance with Republic Act No. 3765, MoneyfestLending discloses: the principal amount, the finance charge in peso terms, the monthly interest rate of ${(interestRate * 100).toFixed(0)}% (applied over the chosen loan term), the effective annual interest rate of approximately ${(interestRate * 12 * 100).toFixed(0)}% per annum, the total amount payable, and the full installment schedule. This disclosure is accessible at any time through the Borrower Portal.` },
                    { title: '14. Amendments', body: 'MoneyfestLending reserves the right to amend these Terms & Conditions at any time. Any changes will be communicated to active borrowers via the Borrower Portal or email. Continued use constitutes acceptance of the updated terms.' },
                    { title: '15. Governing Law & Legal Remedies', body: 'These Terms & Conditions are governed by the laws of the Republic of the Philippines, including Republic Act 3765 (Truth in Lending Act), Republic Act 10173 (Data Privacy Act), and Republic Act 9474 (Lending Company Regulation Act). Any dispute shall first be referred to barangay conciliation under RA 7160 before court action.' },
                  ]

                  const quickloanTerms = [
                    { title: '1. Eligibility', body: 'QuickLoan is exclusively available to active team members in good standing. By applying, you confirm you are currently employed and eligible.' },
                    { title: '2. Loan Amount & Limits', body: 'QuickLoan amounts are capped at ₱3,000. This is a short-term cash loan designed for immediate needs.' },
                    { title: '3. Interest Rate & Daily Accrual', body: 'QuickLoan follows a 10% monthly flat rate, converted to 0.3333% daily interest. Interest is NOT compounded. You pay for the exact number of days you hold the loan.' },
                    { title: '4. Repayment Flow (Pay Anytime)', body: 'Unlike installment loans, QuickLoan has no fixed schedule. You may settle in full at any time. Early settlement saves you money as daily interest stops on the day of payment.' },
                    { title: '5. Day 15 Target Due Date', body: 'The target due date is 15 calendar days from release. Paying in full by Day 15 closes the loan with only the principal and 15 days of interest.' },
                    { title: '6. Day 15 Missed — Extension Fee', body: 'If full payment is not made by Day 15, a one-time ₱100 extension fee is charged. The principal remains outstanding until the hard deadline on Day 30.' },
                    { title: '7. Day 30 Hard Deadline & Penalties', body: 'Day 30 is the final deadline. Starting Day 31, a daily penalty of ₱25 is charged on top of the daily interest until the loan is fully settled.' },
                    { title: '8. No Security Hold', body: 'QuickLoans carry no Security Hold deduction. The full approved amount is released to the borrower.' },
                    { title: '9. Credit Score System', body: 'Successful payoff of a QuickLoan earns +25 bonus points. Default results in a -150 point deduction. There are no per-installment score changes as there are no fixed installments.' },
                    { title: '10. Accuracy of Information', body: 'By submitting, you confirm all details are truthful. False information leads to immediate rejection.' },
                    { title: '11. Authorization & Data Privacy', body: 'You authorize MoneyfestLending to process your data in compliance with the Data Privacy Act of 2012 (RA 10173).' },
                    { title: '12. Program Rules', body: 'Only one active loan is permitted at a time. No loan stacking (e.g., you cannot have a QuickLoan and an Installment Loan simultaneously).' },
                    { title: '13. Truth in Lending Disclosure (RA 3765)', body: 'MoneyfestLending discloses: principal, daily/monthly interest rate, fees, and penalties. The effective annual rate is approximately 120%.' },
                    { title: '14. Amendments', body: 'Terms may be updated at any time, with notifications sent via the portal or email.' },
                    { title: '15. Governing Law', body: 'Governed by Philippine laws (RA 3765, RA 10173, RA 8792). Disputes are first handled via barangay conciliation (RA 7160).' },
                  ]

                  const isQL = form.loan_type === 'quickloan'
                  const activeTerms = isQL ? quickloanTerms : installmentTerms


                  return activeTerms.map((sec, i) => (
                    <div key={i} style={{ marginBottom: 20 }}>
                      <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 13, color: '#CBD5F0', marginBottom: 6 }}>{sec.title}</div>
                      <div style={{ fontSize: 13, color: '#8892B0', lineHeight: 1.85 }}>{sec.body}</div>
                    </div>
                  ))
                })()}
                <div style={{ marginTop: 8, padding: '12px 16px', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 10, fontSize: 11, color: '#4B5580', lineHeight: 1.7 }}>
                  For data privacy concerns, refer to our <a href="/privacy" target="_blank" rel="noreferrer" style={{ color: '#60A5FA', textDecoration: 'none' }}>Privacy Notice</a>.
                </div>
              </div>
              <div style={{ padding: '16px 28px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: 10, flexShrink: 0, flexWrap: 'wrap' }}>
                <button disabled={!tncScrolled} onClick={() => { set('agreed', true); setShowTnC(false) }} style={{ flex: 1, padding: '12px', borderRadius: 10, border: 'none', background: tncScrolled ? 'linear-gradient(135deg,#6366F1,#8B5CF6)' : 'rgba(255,255,255,0.05)', color: tncScrolled ? '#fff' : '#4B5580', fontSize: 13, fontWeight: 700, cursor: tncScrolled ? 'pointer' : 'not-allowed', fontFamily: 'Space Grotesk', transition: 'all 0.2s ease' }}>
                  {tncScrolled ? '✓ I Agree & Close' : '🔒 Scroll to bottom to agree'}
                </button>
                <button onClick={() => setShowTnC(false)} style={{ padding: '12px 20px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#7A8AAA', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Close</button>
              </div>
            </div>
          </div>
        )}

        {/* Sticky Header */}
        <div style={{ background: 'rgba(7,9,15,0.96)', borderBottom: '1px solid rgba(139,92,246,0.2)', padding: '14px clamp(12px, 4vw, 28px)', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 100 }}>
          <div style={{ maxWidth: 1060, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
              <img src="/favicon-96x96.png" alt="MoneyfestLending" style={{ width: 34, height: 34, objectFit: 'contain' }} />
              <div>
                <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 16, color: '#F0F4FF' }}>Moneyfest<span style={{ background: 'linear-gradient(90deg,#60a5fa,#a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Lending</span></div>
                <div style={{ fontSize: 9, color: '#4B5580', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Loan Application</div>
              </div>
            </a>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <a href="/faq" className="header-faq" style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', color: '#7A8AAA', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}><img src="/faq.png" alt="faq" style={{ width: 12, height: 12, objectFit: 'contain' }} />FAQ</a>
              <a href="/portal" style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.25)', color: '#a78bfa', fontSize: 12, fontWeight: 700, textDecoration: 'none', fontFamily: 'Space Grotesk' }}>My Portal →</a>
            </div>
          </div>
        </div>

        {/* Hero */}
        <div style={{ padding: '28px 28px 20px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 14px', borderRadius: 20, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', marginBottom: 12 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22C55E' }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: '#22C55E', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Private Workplace Program</span>
          </div>
          <h1 style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 'clamp(20px,4vw,30px)', color: '#F0F4FF', margin: '0 0 8px', letterSpacing: -0.5 }}>
            Apply for a <span style={{ background: 'linear-gradient(90deg,#60a5fa,#a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Loan</span>
          </h1>
          <p style={{ color: '#7A8AAA', fontSize: 13, maxWidth: 380, margin: '0 auto' }}>Takes about 3 minutes. You'll get an access code to track your application anytime.</p>
        </div>

        {/* Step bar + progress */}
        <div style={{ maxWidth: 1060, margin: '0 auto', padding: 'clamp(10px, 3vw, 16px) clamp(10px, 3vw, 16px) 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, marginBottom: 10 }}>
            {['Personal Info', 'ID Verification', 'Loan Details'].map((label, i) => {
              const num = i + 1; const done = step > num; const active = step === num
              return (
                <div key={num} style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 16px', borderRadius: 24, background: active ? 'rgba(59,130,246,0.12)' : done ? 'rgba(34,197,94,0.08)' : 'transparent', border: `1px solid ${active ? 'rgba(59,130,246,0.3)' : done ? 'rgba(34,197,94,0.25)' : 'transparent'}` }}>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: done ? '#22C55E' : active ? '#3B82F6' : 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: done || active ? '#fff' : '#4B5580', flexShrink: 0 }}>{done ? '✓' : num}</div>
                    <span className="step-label" style={{ fontSize: 12, fontWeight: active ? 700 : 500, color: active ? '#F0F4FF' : done ? '#22C55E' : '#4B5580', whiteSpace: 'nowrap', fontFamily: 'Space Grotesk' }}>{label}</span>
                  </div>
                  {i < 2 && <div style={{ width: 36, height: 2, background: step > num ? '#22C55E' : 'rgba(255,255,255,0.06)', margin: '0 4px' }} />}
                </div>
              )
            })}
          </div>
          <div style={{ height: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden', marginBottom: 20 }}>
            <div style={{ height: '100%', width: progressPct + '%', background: 'linear-gradient(90deg,#3B82F6,#8B5CF6)', borderRadius: 2, transition: 'width 0.4s ease' }} />
          </div>
        </div>

        {/* Two-column layout */}
        <div className="apply-2col" style={{ maxWidth: 1060, margin: '0 auto', padding: 'clamp(0px, 2vw, 0px) clamp(10px, 3vw, 16px) 60px', display: 'grid', gridTemplateColumns: '1fr 290px', gap: 18, alignItems: 'start' }}>

          {/* LEFT COLUMN */}
          <div>

            {/* STEP 1 */}
            {step === 1 && (
              <div style={cardStyle}>
                <div style={cardHeader}>
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><img src="/list.png" alt="info" style={{ width: 20, height: 20, objectFit: 'contain' }} /></div>
                  <div><div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 15, color: '#F0F4FF' }}>Personal Information</div><div style={{ fontSize: 11, color: '#4B5580', marginTop: 1 }}>Your basic details</div></div>
                </div>
                <div style={cardBody}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div><label style={lbl}>Full Name *</label><input className="apply-inp" value={form.full_name} onChange={e => set('full_name', e.target.value)} placeholder="Enter your full legal name" style={inp} /></div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                      <div>
                        <label style={lbl}>Department *</label>
                        <select className="apply-inp" value={form.department} onChange={e => { set('department', e.target.value); set('custom_department', ''); }} style={{ ...inp, appearance: 'none', cursor: 'pointer' }}>
                          <option value="">Select Department...</option>
                          {departments.map(d => <option key={d} value={d}>{d}</option>)}
                          <option value="Other">Other (Please specify)</option>
                        </select>
                        {form.department === 'Other' && (
                          <input className="apply-inp" value={form.custom_department} onChange={e => set('custom_department', e.target.value)} placeholder="Type your department" style={{ ...inp, marginTop: 8 }} />
                        )}
                      </div>
                      <div>
                        <label style={lbl}>Assigned Building *</label>
                        <select className="apply-inp" value={form.building} onChange={e => set('building', e.target.value)} style={{ ...inp, appearance: 'none', cursor: 'pointer' }}>
                          <option value="">Select Building...</option>
                          <option value="Ng Khai">Ng Khai</option>
                          <option value="Epic">Epic</option>
                        </select>
                      </div>
                    </div>
                    <div><label style={lbl}>Years of Tenure *</label><input className="apply-inp" value={form.tenure_years} onChange={e => set('tenure_years', e.target.value)} placeholder="e.g. 2.5" type="number" min="0" step="0.5" style={inp} /></div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                      <div><label style={lbl}>Phone Number *</label><input className="apply-inp" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="09XX XXX XXXX" style={inp} /></div>
                      <div>
                        <label style={lbl}>Email Address *</label>
                        <input className="apply-inp" value={form.email} onChange={e => set('email', e.target.value)} placeholder="your@gmail.com" type="email" style={{ ...inp, borderColor: form.email && validateEmail(form.email) ? 'rgba(239,68,68,0.5)' : form.email && !validateEmail(form.email) ? 'rgba(34,197,94,0.4)' : undefined }} />
                        {form.email && validateEmail(form.email) && <div style={{ fontSize: 11, color: '#EF4444', marginTop: 4 }}>{validateEmail(form.email)}</div>}
                        {form.email && !validateEmail(form.email) && <div style={{ fontSize: 11, color: '#22C55E', marginTop: 4 }}>✓ Valid email</div>}
                      </div>
                    </div>
                    <div><label style={lbl}>Home Address *</label><textarea className="apply-inp" value={form.address} onChange={e => set('address', e.target.value)} placeholder="Enter your complete home address" rows={2} style={{ ...inp, resize: 'none' }} /></div>
                  </div>
                </div>
                {error && <div style={{ margin: '0 22px 12px', padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, fontSize: 13, color: '#EF4444' }}>{error}</div>}
                <div style={cardFooter}>
                  <div style={{ display: 'flex', gap: 8 }}><a href="/faq" style={{ fontSize: 11, color: '#6366F1', textDecoration: 'none', fontWeight: 600 }}>FAQ</a><span style={{ fontSize: 11, color: '#4B5580' }}>·</span><a href="/privacy" target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#6366F1', textDecoration: 'none', fontWeight: 600 }}>Privacy</a></div>
                  <button onClick={handleNext} style={{ padding: 'clamp(9px, 2vw, 11px) clamp(14px, 3vw, 26px)', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#3B82F6,#8B5CF6)', color: '#fff', fontSize: 'clamp(11px, 3vw, 13px)', fontWeight: 700, cursor: 'pointer', fontFamily: 'Space Grotesk' }}>Continue to ID Upload →</button>
                </div>
              </div>
            )}

            {/* STEP 2 */}
            {step === 2 && (
              <div style={cardStyle}>
                <div style={cardHeader}>
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><img src="/id.png" alt="ID" style={{ width: 20, height: 20, objectFit: 'contain' }} /></div>
                  <div><div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 15, color: '#F0F4FF' }}>ID Verification</div><div style={{ fontSize: 11, color: '#4B5580', marginTop: 1 }}>Upload front and back of any government-issued ID</div></div>
                </div>
                <div style={cardBody}>
                  <div style={{ background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.12)', borderRadius: 10, padding: '12px 14px', marginBottom: 18, fontSize: 12, color: '#7A8AAA', lineHeight: 1.8 }}>
                    <div style={{ fontWeight: 700, color: '#60A5FA', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}><img src="/checkbox.png" alt="check" style={{ width: 13, height: 13, objectFit: 'contain' }} /> Accepted IDs</div>
                    SSS · GSIS · PhilHealth · Pag-IBIG · Passport · Driver's License · Postal ID · Voter's ID · PRC ID · Senior Citizen ID
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
                    {[{ label: 'Front of ID *', file: idFile, setFile: setIdFile, icon: '/id.png' }, { label: 'Back of ID *', file: idFileBack, setFile: setIdFileBack, icon: '/refresh.png' }].map(({ label, file, setFile, icon }, i) => (
                      <div key={i}>
                        <div style={{ fontSize: 10, color: '#7A8AAA', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700 }}>{label}</div>
                        <label className="upload-zone" style={{ border: `2px dashed ${file ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.08)'}`, background: file ? 'rgba(34,197,94,0.04)' : 'rgba(255,255,255,0.02)' }}>
                          <div style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{file ? <span style={{ fontSize: 26 }}>✅</span> : <img src={icon} alt="upload" style={{ width: 38, height: 38, objectFit: 'contain', opacity: 0.7 }} />}</div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: file ? '#22C55E' : '#F0F4FF', marginBottom: 2 }}>{file ? file.name : 'Click to upload'}</div>
                            <div style={{ fontSize: 11, color: '#4B5580' }}>{file ? `${(file.size / 1024).toFixed(0)} KB` : 'JPG, PNG, PDF · Max 5MB'}</div>
                          </div>
                          <input type="file" accept="image/jpeg,image/png,image/jpg,application/pdf" style={{ display: 'none' }} onChange={e => { setFile(e.target.files[0] || null); setError('') }} />
                        </label>
                        {file && <button onClick={() => setFile(null)} style={{ marginTop: 4, background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#EF4444', display: 'flex', alignItems: 'center', gap: 3 }}>✕ Remove</button>}
                      </div>
                    ))}
                  </div>
                  <div style={{ padding: '10px 14px', background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 9, fontSize: 12, color: '#F59E0B' }}>
                    <img src="/warning.png" alt="warning" style={{ width: 12, height: 12, objectFit: 'contain', verticalAlign: 'middle', marginRight: 5 }} />Make sure your ID is <strong>clear and readable</strong>. Blurry or cropped photos may delay your application.
                  </div>
                </div>
                {error && <div style={{ margin: '0 22px 12px', padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, fontSize: 13, color: '#EF4444' }}>{error}</div>}
                <div style={cardFooter}>
                  <button onClick={() => { setStep(1); setError('') }} style={{ padding: '10px 18px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: '#7A8AAA', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>← Back</button>
                  <button onClick={handleNext} style={{ padding: 'clamp(9px, 2vw, 11px) clamp(14px, 3vw, 26px)', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#3B82F6,#8B5CF6)', color: '#fff', fontSize: 'clamp(11px, 3vw, 13px)', fontWeight: 700, cursor: 'pointer', fontFamily: 'Space Grotesk' }}>Continue to Loan Details →</button>
                </div>
              </div>
            )}

            {/* STEP 3 */}
            {step === 3 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                {/* Loan Type Selector */}
                <div style={cardStyle}>
                  <div style={cardHeader}>
                    <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>⚡</div>
                    <div><div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 15, color: '#F0F4FF' }}>Loan Type</div><div style={{ fontSize: 11, color: '#4B5580', marginTop: 1 }}>Choose the right loan for your need</div></div>
                  </div>
                  <div style={cardBody}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
                      {[
                        { value: 'regular', label: 'Installment Loan', sub: 'Up to ₱10,000 · 2–3 months · semi-monthly payments', color: '#3B82F6' },
                        { value: 'quickloan', label: '⚡ QuickLoan', sub: 'Up to ₱3,000 · pay anytime · daily interest · Day 15 target', color: '#F59E0B' },
                      ].map(opt => (
                        <button key={opt.value} onClick={() => { set('loan_type', opt.value); set('loan_amount', '') }}
                          style={{
                            border: `2px solid ${form.loan_type === opt.value ? opt.color : 'rgba(255,255,255,0.07)'}`,
                            background: form.loan_type === opt.value ? `${opt.color}18` : 'rgba(255,255,255,0.02)',
                            borderRadius: 10, padding: '14px 16px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s'
                          }}>
                          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 14, color: form.loan_type === opt.value ? opt.color : '#7A8AAA', marginBottom: 4 }}>{opt.label}</div>
                          <div style={{ fontSize: 11, color: '#4B5580', lineHeight: 1.5 }}>{opt.sub}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Loan Amount card */}
                <div style={cardStyle}>
                  <div style={cardHeader}>
                    <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><img src="/philippine-peso.png" alt="peso" style={{ width: 20, height: 20, objectFit: 'contain' }} /></div>
                    <div><div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 15, color: '#F0F4FF' }}>Loan Amount</div><div style={{ fontSize: 11, color: '#4B5580', marginTop: 1 }}>Select how much you need</div></div>
                  </div>
                  <div style={cardBody}>
                    {form.loan_type === 'quickloan' ? (
                      /* QuickLoan amounts */
                      <div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 10, marginBottom: 14 }}>
                          {[1000, 2000, 3000].map(amt => (
                            <button key={amt} className="amt-btn" onClick={() => set('loan_amount', amt)}
                              style={{ border: `2px solid ${form.loan_amount === amt ? '#F59E0B' : 'rgba(255,255,255,0.07)'}`, background: form.loan_amount === amt ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.02)', minHeight: '72px' }}>
                              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 18, color: form.loan_amount === amt ? '#F59E0B' : '#7A8AAA' }}>₱{amt.toLocaleString()}</div>
                              <div style={{ fontSize: 10, color: '#4B5580', marginTop: 2 }}>₱{(amt * 0.1 / 30).toFixed(2)}/day</div>
                              <div style={{ fontSize: 10, color: '#4B5580' }}>₱{(amt + amt * 0.1 / 30 * 15).toFixed(0)} at Day 15</div>
                            </button>
                          ))}
                        </div>
                        <div style={{ padding: '10px 14px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, fontSize: 12, color: '#7A8AAA', lineHeight: 1.7 }}>
                          ⚡ <strong style={{ color: '#F59E0B' }}>QuickLoan:</strong> Interest accrues daily at 10%/month. Pay any time — the earlier you pay, the less you owe. Target due date is <strong style={{ color: '#F0F4FF' }}>Day 15</strong> from release. Hard deadline is Day 30. A ₱100 extension fee applies if Day 15 is missed.
                        </div>
                      </div>
                    ) : (
                      /* Installment loan amounts */
                      <div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10, marginBottom: 14 }}>
                          {LOAN_AMOUNTS.map(amt => (
                            <button key={amt} className="amt-btn" onClick={() => form.loan_amount === amt ? null : startDisclaimer(amt)}
                              style={{ border: `2px solid ${form.loan_amount === amt ? '#3B82F6' : 'rgba(255,255,255,0.07)'}`, background: form.loan_amount === amt ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.02)', minHeight: '72px' }}>
                              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 18, color: form.loan_amount === amt ? '#22C55E' : '#7A8AAA' }}>₱{amt.toLocaleString()}</div>
                              <div style={{ fontSize: 10, color: '#4B5580', marginTop: 2 }}>₱{Math.ceil(amt * (1 + interestRate * form.loan_term) / (form.loan_term * 2)).toLocaleString('en-PH')}/cutoff</div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div><label style={lbl}>Loan Purpose *</label><textarea className="apply-inp" value={form.loan_purpose} onChange={e => set('loan_purpose', e.target.value)} placeholder="e.g. Bills payment, Emergency, Allowance, Tuition, Medical, Rent..." rows={2} style={{ ...inp, resize: 'none' }} /></div>

                    {/* Loan term selector — only for installment loans */}
                    {form.loan_type !== 'quickloan' && (
                      <div style={{ marginTop: 14 }}>
                        <label style={lbl}>Loan Term *</label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                          {[
                            { term: 2, label: '2 Months', sub: '4 installments · 14% total interest' },
                            { term: 3, label: '3 Months', sub: '6 installments · 21% total interest' },
                          ].map(({ term, label, sub }) => (
                            <button key={term} onClick={() => set('loan_term', term)} style={{
                              border: `2px solid ${form.loan_term === term ? '#8B5CF6' : 'rgba(255,255,255,0.07)'}`,
                              background: form.loan_term === term ? 'rgba(139,92,246,0.12)' : 'rgba(255,255,255,0.02)',
                              borderRadius: 10, padding: '12px 14px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s'
                            }}>
                              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 15, color: form.loan_term === term ? '#a78bfa' : '#7A8AAA' }}>{label}</div>
                              <div style={{ fontSize: 10, color: form.loan_term === term ? '#8B5CF6' : '#4B5580', marginTop: 3 }}>{sub}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Release Method card */}
                <div style={cardStyle}>
                  <div style={cardHeader}>
                    <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><img src="/payment-method.png" alt="payment" style={{ width: 20, height: 20, objectFit: 'contain' }} /></div>
                    <div><div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 15, color: '#F0F4FF' }}>Release Method</div><div style={{ fontSize: 11, color: '#4B5580', marginTop: 1 }}>How you want to receive your loan</div></div>
                  </div>
                  <div style={cardBody}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {[
                        { value: 'Physical Cash', logo: '/cash-logo.png', desc: 'Receive in cash. No transaction fee.', fee: null },
                        { value: 'GCash', logo: '/gcash-logo.png', desc: 'Sent to your GCash number. Free if GCash to GCash.', fee: '₱15' },
                        { value: 'RCBC', logo: '/rcbc-logo.png', desc: 'Transferred to your RCBC account.', fee: null },
                        { value: 'Other Bank Transfer', logo: '/bank-logo.png', desc: 'Instapay/PESONet. Borrower covers fee.', fee: 'You cover fee' },
                      ].map(opt => (
                        <button key={opt.value} className="release-opt" onClick={() => set('release_method', opt.value)}
                          style={{ border: `2px solid ${form.release_method === opt.value ? '#3B82F6' : 'rgba(255,255,255,0.07)'}`, background: form.release_method === opt.value ? 'rgba(59,130,246,0.08)' : 'rgba(255,255,255,0.02)', flexWrap: 'wrap', gap: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                            <img src={opt.logo} alt={opt.value} style={{ width: 26, height: 26, objectFit: 'contain' }} />
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 13, color: form.release_method === opt.value ? '#F0F4FF' : '#7A8AAA' }}>{opt.value}</div>
                              <div style={{ fontSize: 11, color: '#4B5580' }}>{opt.desc}</div>
                            </div>
                          </div>
                          {opt.fee && <span style={{ fontSize: 10, color: '#F59E0B', background: 'rgba(245,158,11,0.08)', padding: '2px 8px', borderRadius: 5, flexShrink: 0 }}>{opt.fee}</span>}
                        </button>
                      ))}
                    </div>

                    {form.release_method === 'GCash' && (
                      <div style={{ marginTop: 14, padding: 16, background: 'rgba(0,163,255,0.05)', border: '1px solid rgba(0,163,255,0.2)', borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#60B8FF' }}>📱 GCash Account Details</div>
                        <div><label style={lbl}>GCash Number *</label><input className="apply-inp" value={form.gcash_number} onChange={e => set('gcash_number', e.target.value)} placeholder="09XX XXX XXXX" style={inp} /></div>
                        <div><label style={lbl}>GCash Full Name *</label><input className="apply-inp" value={form.gcash_name} onChange={e => set('gcash_name', e.target.value)} placeholder="Full name on GCash" style={inp} /></div>
                      </div>
                    )}
                    {form.release_method === 'RCBC' && (
                      <div style={{ marginTop: 14, padding: 16, background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#F87171' }}>🏦 RCBC Account Details</div>
                        <div><label style={lbl}>Account Holder Name *</label><input className="apply-inp" value={form.bank_account_holder} onChange={e => set('bank_account_holder', e.target.value)} placeholder="Full name on the bank account" style={inp} /></div>
                        <div><label style={lbl}>Account Number *</label><input className="apply-inp" value={form.bank_account_number} onChange={e => set('bank_account_number', e.target.value)} placeholder="Enter RCBC account number" style={inp} /></div>
                        <div>
                          <label style={lbl}>Confirm Account Number *</label>
                          <input className="apply-inp" value={form.bank_account_confirm} onChange={e => set('bank_account_confirm', e.target.value)} placeholder="Re-enter account number to confirm" style={{ ...inp, borderColor: form.bank_account_confirm ? (form.bank_account_confirm === form.bank_account_number ? '#22C55E' : '#EF4444') : undefined }} />
                          {form.bank_account_confirm && form.bank_account_confirm !== form.bank_account_number && <div style={{ fontSize: 11, color: '#EF4444', marginTop: 4 }}>⚠️ Account numbers do not match</div>}
                          {form.bank_account_confirm && form.bank_account_confirm === form.bank_account_number && <div style={{ fontSize: 11, color: '#22C55E', marginTop: 4 }}>✅ Account numbers match</div>}
                        </div>
                      </div>
                    )}
                    {form.release_method === 'Other Bank Transfer' && (
                      <div style={{ marginTop: 14, padding: 16, background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#A78BFA' }}>🏦 Bank Account Details</div>
                        <div><label style={lbl}>Bank Name *</label><input className="apply-inp" value={form.bank_name} onChange={e => set('bank_name', e.target.value)} placeholder="e.g. BDO, BPI, Metrobank" style={inp} /></div>
                        <div><label style={lbl}>Account Holder Name *</label><input className="apply-inp" value={form.bank_account_holder} onChange={e => set('bank_account_holder', e.target.value)} placeholder="Full name on the bank account" style={inp} /></div>
                        <div><label style={lbl}>Account Number *</label><input className="apply-inp" value={form.bank_account_number} onChange={e => set('bank_account_number', e.target.value)} placeholder="Enter your account number" style={inp} /></div>
                        <div>
                          <label style={lbl}>Confirm Account Number *</label>
                          <input className="apply-inp" value={form.bank_account_confirm} onChange={e => set('bank_account_confirm', e.target.value)} placeholder="Re-enter account number to confirm" style={{ ...inp, borderColor: form.bank_account_confirm ? (form.bank_account_confirm === form.bank_account_number ? '#22C55E' : '#EF4444') : undefined }} />
                          {form.bank_account_confirm && form.bank_account_confirm !== form.bank_account_number && <div style={{ fontSize: 11, color: '#EF4444', marginTop: 4 }}>⚠️ Account numbers do not match</div>}
                          {form.bank_account_confirm && form.bank_account_confirm === form.bank_account_number && <div style={{ fontSize: 11, color: '#22C55E', marginTop: 4 }}>✅ Account numbers match</div>}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Payment schedule — Only for installment loans */}
                {form.loan_type !== 'quickloan' && form.loan_amount && (() => {
                  const principal = parseFloat(form.loan_amount)
                  const loanTerm = form.loan_term || 2
                  const numInstallments = loanTerm * 2
                  const interest = principal * interestRate * loanTerm
                  const total = principal + interest
                  const perInst = Math.ceil(total / numInstallments)
                  const dueDates = calcDueDates()
                  return (
                    <div style={cardStyle}>
                      <div style={cardHeader}>
                        <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><img src="/calendar.png" alt="schedule" style={{ width: 20, height: 20, objectFit: 'contain' }} /></div>
                        <div><div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 15, color: '#F0F4FF' }}>Payment Schedule</div><div style={{ fontSize: 11, color: '#4B5580', marginTop: 1 }}>₱{perInst.toLocaleString('en-PH')} per installment</div></div>
                      </div>
                      <div style={cardBody}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {dueDates.map((date, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 9 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#8B5CF6' }}>{i + 1}</div>
                                <span style={{ fontSize: 13, color: '#CBD5F0', fontFamily: 'Space Grotesk', fontWeight: 600 }}>Installment {i + 1}</span>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: '#22C55E', fontFamily: 'Space Grotesk' }}>₱{perInst.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
                                <div style={{ fontSize: 11, color: '#4B5580' }}>{date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )
                })()}

                {/* QuickLoan Summary — Show in main column for mobile since sidebar is hidden */}
                {form.loan_type === 'quickloan' && form.loan_amount && (() => {
                  const principal = parseFloat(form.loan_amount)
                  const dailyInterest = parseFloat((principal * 0.1 / 30).toFixed(2))
                  const day15Total = parseFloat((principal + dailyInterest * 15).toFixed(2))
                  const day30Total = parseFloat((principal + dailyInterest * 30 + 100).toFixed(2))
                  return (
                    <div style={cardStyle}>
                      <div style={cardHeader}>
                        <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>⚡</div>
                        <div><div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 15, color: '#F0F4FF' }}>⚡ QuickLoan Summary</div><div style={{ fontSize: 11, color: '#4B5580', marginTop: 1 }}>Pay anytime — no fixed installments</div></div>
                      </div>
                      <div style={cardBody}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: 9, border: '1px solid rgba(255,255,255,0.05)' }}>
                            <span style={{ fontSize: 12, color: '#7A8AAA' }}>Daily Interest</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#a78bfa' }}>₱{dailyInterest.toFixed(2)} / day</span>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                            <div style={{ padding: '12px', background: 'rgba(34,197,94,0.08)', borderRadius: 10, border: '1px solid rgba(34,197,94,0.2)', textAlign: 'center' }}>
                              <div style={{ fontSize: 10, color: '#4B5580', textTransform: 'uppercase', marginBottom: 4 }}>Pay on Day 15</div>
                              <div style={{ fontSize: 16, fontWeight: 900, color: '#22C55E', fontFamily: 'Space Grotesk' }}>₱{day15Total.toLocaleString('en-PH')}</div>
                            </div>
                            <div style={{ padding: '12px', background: 'rgba(245,158,11,0.06)', borderRadius: 10, border: '1px solid rgba(245,158,11,0.2)', textAlign: 'center' }}>
                              <div style={{ fontSize: 10, color: '#4B5580', textTransform: 'uppercase', marginBottom: 4 }}>After Day 15</div>
                              <div style={{ fontSize: 16, fontWeight: 900, color: '#F59E0B', fontFamily: 'Space Grotesk' }}>₱{day30Total.toLocaleString('en-PH')}</div>
                            </div>
                          </div>
                          <div style={{ padding: '10px 14px', background: 'rgba(59,130,246,0.05)', borderRadius: 9, border: '1px solid rgba(59,130,246,0.1)', fontSize: 11, color: '#4B5580', lineHeight: 1.6 }}>
                            📌 <strong>Target Date:</strong> Day 15 from release. Hard deadline is Day 30. A ₱100 extension fee applies if Day 15 is missed.
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })()}

                {/* Terms + Submit */}
                <div style={cardStyle}>
                  <div style={cardBody}>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', marginBottom: 14 }}
                      onClick={e => { e.preventDefault(); if (!form.agreed) { setTncScrolled(false); setShowTnC(true) } else { set('agreed', false) } }}>
                      <div style={{ marginTop: 2, width: 16, height: 16, borderRadius: 4, flexShrink: 0, border: `2px solid ${form.agreed ? '#3B82F6' : 'rgba(255,255,255,0.2)'}`, background: form.agreed ? '#3B82F6' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s ease' }}>
                        {form.agreed && <span style={{ color: '#fff', fontSize: 10, fontWeight: 800 }}>✓</span>}
                      </div>
                      <span style={{ fontSize: 13, color: '#7A8AAA', lineHeight: 1.6 }}>I have read and agree to the <span style={{ color: '#F0F4FF', fontWeight: 700, textDecoration: 'underline' }}>Terms & Conditions</span> and the <a href='/privacy' target='_blank' rel='noreferrer' style={{ color: '#60A5FA', textDecoration: 'none', fontWeight: 600 }} onClick={e => e.stopPropagation()}>Privacy Notice</a>.</span>
                    </label>
                    {error && <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, fontSize: 13, color: '#EF4444', marginBottom: 14 }}>{error}</div>}
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button onClick={() => { setStep(2); setError('') }} style={{ padding: '13px 18px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: '#7A8AAA', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>← Back</button>
                      <button onClick={handleSubmit} disabled={loading} className="submit-btn" style={{ flex: 1, padding: '13px', borderRadius: 10, border: 'none', background: loading ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg,#22C55E,#3B82F6)', color: loading ? '#4B5580' : '#fff', fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'Space Grotesk', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                        {loading ? 'Submitting...' : <><img src="/startup.png" alt="launch" className="rocket-icon" style={{ width: 16, height: 16, objectFit: 'contain' }} />Submit Application</>}
                      </button>
                    </div>
                  </div>
                </div>

              </div>
            )}

            <p style={{ textAlign: 'center', fontSize: 11, color: '#4B5580', marginTop: 20, lineHeight: 1.7 }}>
              Private & secure — internal program only. · <a href="/faq" style={{ color: '#6366F1', textDecoration: 'none', fontWeight: 600 }}>FAQ</a> · <a href="/privacy" style={{ color: '#6366F1', textDecoration: 'none', fontWeight: 600 }}>Privacy</a> · <a href="/terms" style={{ color: '#6366F1', textDecoration: 'none', fontWeight: 600 }}>Terms</a>
            </p>
          </div>

          {/* RIGHT: sticky sidebar */}
          <div className="apply-sidebar" style={{ position: 'sticky', top: 72 }}>
            <SidebarInfo step={step} />
            <SidebarTiers />
            {step > 1 && <SidebarCalc interestRate={interestRate} selectedAmount={form.loan_amount} loanTerm={form.loan_term} loanType={form.loan_type} />}
          </div>
        </div>
      </div>
      <ChatBot />
    </div>
  )
}
