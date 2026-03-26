import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'
import { 
  ChevronLeft, Save, Phone, MessageSquare, 
  AlertTriangle, XCircle, AlertCircle, CheckCircle2
} from 'lucide-react'

/* ─────────────── INTERVIEW CATEGORIES & QUESTIONS ─────────────── */
const CATEGORIES = [
  {
    id: 'purpose',
    title: 'Purpose & Need',
    questions: [
      {
        id: 'q1',
        label: 'PHONE + CHAT',
        text: '"Can you tell me a bit more about what the loan is for? Just so we can make sure the amount and terms fit your actual need."',
        guide: 'Framed as helpful, not interrogatory — appropriate for a colleague. Reveals whether the need is genuine, planned, or impulsive. Specific answers (hospital bill, school enrollment, appliance repair) are strong. "Personal lang" with no follow-up is a soft flag.',
        responses: [
          { label: 'Clear, specific, planned purpose', score: 3 },
          { label: 'Vague but reasonable', score: 2 },
          { label: 'Very vague or evasive', score: 0 }
        ]
      },
      {
        id: 'q2',
        label: 'PHONE + CHAT',
        text: '"Is the amount you applied for the exact amount you need, or would a smaller amount still cover it?"',
        guide: 'Responsible borrowers borrow what they need, not the maximum they can get. Employees who always apply for the maximum without justification may be over-borrowing. This also opens the door to approving a reduced amount if full approval isn\'t warranted.',
        responses: [
          { label: 'Knows exact amount needed', score: 3 },
          { label: 'Open to adjusting', score: 2 },
          { label: 'Insists on maximum only', score: 0 }
        ]
      },
      {
        id: 'q3',
        label: 'PHONE',
        text: '"Have you borrowed from us before? How was that experience for you?"',
        guide: 'For returning borrowers, this checks their relationship with the program. A good borrower remembers their repayment well. A flag is when they don\'t remember clearly or downplay a past late payment.',
        responses: [
          { label: 'Good history, remembers clearly', score: 3 },
          { label: 'First-time borrower', score: 2 },
          { label: 'Downplays past issues', score: 0 }
        ]
      }
    ]
  },
  {
    id: 'payroll',
    title: 'Payroll & Repayment',
    questions: [
      {
        id: 'q4',
        label: 'PHONE + CHAT',
        text: '"Just to confirm — your repayment will be via salary deduction on the 5th and 20th cutoff, right? Does that work with your current take-home pay?"',
        guide: 'Since repayment is via payroll deduction, this confirms the employee understands how it works and that the deduction won\'t leave them financially stranded. An employee whose take-home will drop below a livable amount is a concern — not because they\'re dishonest, but because they may request reversal or stop cooperating.',
        responses: [
          { label: 'Comfortable with deduction', score: 3 },
          { label: 'Slightly concerned but willing', score: 2 },
          { label: 'Uncomfortable or unaware of terms', score: 0 }
        ]
      },
      {
        id: 'q5',
        label: 'PHONE + CHAT',
        text: '"Do you have any other existing loans or salary deductions right now — SSS, Pag-IBIG, PhilHealth, or anything else?"',
        guide: 'High existing deductions + new loan = higher risk of default. Compare total deductions vs. gross pay.',
        responses: [
          { label: 'Few or no other deductions', score: 3 },
          { label: 'Some but manageable', score: 2 },
          { label: 'Heavy existing obligations', score: 0 }
        ]
      }
    ]
  },
  {
    id: 'stability',
    title: 'Employment & Stability',
    questions: [
      {
        id: 'q6',
        label: 'PHONE',
        text: '"How long have you been with the company? Are you a regular employee?"',
        guide: 'Probationary employees are higher risk. Longer tenure = lower default risk. Regular status = stable payroll deduction.',
        responses: [
          { label: 'Regular, 1+ year tenure', score: 3 },
          { label: 'Regular, under 1 year', score: 2 },
          { label: 'Probationary or contractual', score: 0 }
        ]
      },
      {
        id: 'q7',
        label: 'PHONE',
        text: '"How long do you see yourself staying with the company?"',
        guide: 'An employee planning to resign before the loan term ends is a high-risk borrower. Collection after separation is extremely difficult.',
        responses: [
          { label: 'Long-term, no plans to leave', score: 3 },
          { label: 'At least through loan term', score: 2 },
          { label: 'Evasive or mentions leaving', score: 0 }
        ]
      }
    ]
  },
  {
    id: 'character',
    title: 'Character & Behavior',
    questions: [
      {
        id: 'q8',
        label: 'PHONE',
        text: '"If something unexpected happened and you couldn\'t make a payment, what would you do?"',
        guide: 'This tests their problem-solving and communication instincts under financial stress. Good answer: "I would contact you immediately." Bad answer: "I\'d figure it out" or total silence.',
        responses: [
          { label: 'Would communicate proactively', score: 3 },
          { label: 'Would try to manage alone first', score: 2 },
          { label: 'Avoidant or dismissive', score: 0 }
        ]
      },
      {
        id: 'q9',
        label: 'PHONE',
        text: '"Who in your department do you consider most responsible with money? Why?"',
        guide: 'Reveals financial values. If they can articulate what "responsible" looks like, they share those values. If they struggle or deflect, it could indicate low financial awareness.',
        responses: [
          { label: 'Articulate, shows financial awareness', score: 3 },
          { label: 'Generic but reasonable answer', score: 2 },
          { label: 'Can\'t answer or deflects', score: 0 }
        ]
      }
    ]
  }
]

/* ─────────────── RED FLAGS ─────────────── */
const AUTO_DECLINE_FLAGS = [
  { id: 'resign', title: 'Planning to resign before loan term ends', desc: 'Explicitly mentioned or strongly implied during the call. Collection after separation is difficult and strains relationships. Do not approve.' },
  { id: 'deductions_50', title: 'Total deductions would exceed 50% of gross pay', desc: 'SSS, Pag-IBIG, PhilHealth, existing loans, and this new loan combined. An employee who takes home less than half their salary is a financial stress risk and may request reversal or stop cooperating.' },
  { id: 'probation', title: 'Under probationary period', desc: 'Employment is not yet confirmed. If they don\'t pass probation, loan recovery becomes immediately complicated. Wait for regularization before approving.' },
  { id: 'hr_case', title: 'Active HR case or disciplinary proceedings', desc: 'Employment termination is a real possibility. Do not approve loans for employees under active investigation or facing dismissal proceedings.' },
  { id: 'unresolved', title: 'Unresolved previous loan with Moneyfest', desc: 'Any existing balance in arrears or unrectified missed payment. Resolve the current obligation before considering a new one.' }
]

const CAUTION_FLAGS = [
  { id: 'evasive_resign', title: 'Evasive about resignation plans', desc: '"Depends," "I\'ll see how it goes," or changing the subject when asked about staying. Not an automatic decline but requires a written acknowledgment of early settlement terms.' },
  { id: 'low_take_home', title: 'Deductions will leave very low take-home', desc: 'Not over 50% but close. Recommend a reduced loan amount or longer term to keep monthly deductions manageable.' },
  { id: 'third_party', title: 'Borrowing for a third party', desc: 'The loan is actually for a relative, partner, or friend. The borrower may lose motivation to repay if the relationship sours. Requires extra scrutiny and possibly a co-maker arrangement.' },
  { id: 'excessive_urgency', title: 'Excessive urgency / Panic', desc: 'Pressuring for immediate release. May indicate a deeper financial crisis that the loan alone won\'t solve.' }
]

/* ─────────────── SCORING ENGINE ─────────────── */
function computeScore(answers, declineFlags, cautionFlags) {
  const answeredQuestions = Object.values(answers).filter(a => a !== null && a !== undefined)
  if (answeredQuestions.length === 0) return { total: 0, max: 27, pct: 0, recommendation: 'Pending' }
  
  const total = answeredQuestions.reduce((sum, s) => sum + s, 0)
  const max = answeredQuestions.length * 3
  const pct = Math.round((total / max) * 100)
  
  // Auto-decline if ANY decline flag is checked
  if (declineFlags.length > 0) return { total, max, pct, recommendation: 'Rejected' }
  
  // Caution flags reduce the effective score
  const cautionPenalty = cautionFlags.length * 5
  const adjustedPct = Math.max(0, pct - cautionPenalty)
  
  let recommendation
  if (adjustedPct >= 80) recommendation = 'Highly Recommended'
  else if (adjustedPct >= 60) recommendation = 'Recommended'
  else if (adjustedPct >= 40) recommendation = 'Proceed with Caution'
  else recommendation = 'Rejected'
  
  return { total, max, pct: adjustedPct, recommendation }
}

const REC_COLORS = {
  'Highly Recommended': { bg: 'rgba(34,197,94,0.15)', border: 'rgba(34,197,94,0.4)', text: '#22C55E' },
  'Recommended': { bg: 'rgba(99,102,241,0.15)', border: 'rgba(99,102,241,0.4)', text: '#6366F1' },
  'Proceed with Caution': { bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.4)', text: '#F59E0B' },
  'Rejected': { bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.4)', text: '#EF4444' },
  'Pending': { bg: 'rgba(100,116,139,0.15)', border: 'rgba(100,116,139,0.4)', text: '#94A3B8' }
}

/* ─────────────── COMPONENT ─────────────── */
export default function AssessmentForm() {
  const { id } = useParams()
  const { user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  
  const [app, setApp] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('script')
  
  // Per-question answers (question id -> score)
  const [answers, setAnswers] = useState({})
  const [notes, setNotes] = useState('')
  const [declineFlags, setDeclineFlags] = useState([])
  const [cautionFlags, setCautionFlags] = useState([])

  const score = useMemo(() => computeScore(answers, declineFlags, cautionFlags), [answers, declineFlags, cautionFlags])

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('applications').select('*').eq('id', id).single()
      if (data) setApp(data)
      
      // Load existing assessment
      const { data: existing } = await supabase.from('applicant_assessments').select('*').eq('application_id', id).single()
      if (existing) {
        // Reconstruct answers from stored JSON
        if (existing.interview_notes) setNotes(existing.interview_notes)
        if (existing.answers_json) setAnswers(existing.answers_json)
        if (existing.red_flags) {
          const allFlags = existing.red_flags || []
          setDeclineFlags(allFlags.filter(f => AUTO_DECLINE_FLAGS.some(d => d.id === f)))
          setCautionFlags(allFlags.filter(f => CAUTION_FLAGS.some(c => c.id === f)))
        }
      }
      setLoading(false)
    }
    load()
  }, [id])

  const handleSave = async () => {
    setSaving(true)
    const allFlags = [...declineFlags, ...cautionFlags]
    
    const payload = {
      application_id: id,
      admin_id: user?.id,
      score_character: score.pct,
      score_capacity: score.total,
      score_reliability: score.max,
      score_purpose: Object.keys(answers).length,
      score_overall: score.pct,
      interview_notes: notes,
      red_flags: allFlags,
      recommendation: score.recommendation,
      answers_json: answers,
      updated_at: new Date().toISOString()
    }

    const { error } = await supabase.from('applicant_assessments').upsert(payload, { onConflict: 'application_id' })
    
    if (error) toast('Save failed: ' + error.message, 'error')
    else {
      toast('Assessment saved — ' + score.recommendation, 'success')
      navigate('/admin/assessments')
    }
    setSaving(false)
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
  if (!app) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Application not found</div>

  const recColor = REC_COLORS[score.recommendation] || REC_COLORS['Pending']
  const TABS = [
    { id: 'script', label: 'Opening Script' },
    { id: 'questions', label: 'Assessment Questions' },
    { id: 'flags', label: 'Red Flags' },
    { id: 'result', label: 'Scoring & Result' }
  ]

  return (
    <div style={{ padding: '32px 28px', maxWidth: 960, margin: '0 auto' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button onClick={() => navigate('/admin/assessments')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--card-border)', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <ChevronLeft size={20} />
          </button>
          <div>
            <div style={{ fontSize: 12, color: 'var(--blue)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Confidential Borrower Profiling</div>
            <h1 style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 800, fontSize: 26, color: 'var(--text-primary)', margin: '4px 0 0' }}>
              Interview Worksheet — {app.full_name}
            </h1>
          </div>
        </div>
        <button 
          onClick={handleSave} disabled={saving}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderRadius: 12, border: 'none', background: 'var(--blue)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'Space Grotesk', opacity: saving ? 0.6 : 1 }}
        >
          <Save size={18} /> {saving ? 'Saving...' : 'Save Assessment'}
        </button>
      </div>

      {/* Live Score Banner */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderRadius: 16, background: recColor.bg, border: `1.5px solid ${recColor.border}`, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 32, color: recColor.text }}>{score.pct}%</div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>Auto Score</div>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 16, color: recColor.text }}>{score.recommendation}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 24, fontSize: 12, color: 'var(--text-muted)' }}>
          <div><strong style={{ color: 'var(--text-primary)' }}>{Object.keys(answers).length}</strong> / {CATEGORIES.reduce((s, c) => s + c.questions.length, 0)} Questions</div>
          <div><strong style={{ color: '#EF4444' }}>{declineFlags.length}</strong> Decline Flags</div>
          <div><strong style={{ color: '#F59E0B' }}>{cautionFlags.length}</strong> Caution Flags</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 28, background: 'var(--card-bg)', padding: 4, borderRadius: 14, border: '1px solid var(--card-border)' }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            flex: 1, padding: '10px 16px', borderRadius: 10, border: 'none',
            background: activeTab === tab.id ? 'var(--blue)' : 'transparent',
            color: activeTab === tab.id ? '#fff' : 'var(--text-muted)',
            fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
            fontFamily: 'Space Grotesk'
          }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── TAB: Opening Script ─── */}
      {activeTab === 'script' && (
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 20, padding: 32 }}>
          <Section title="Phone Opening">
            <ScriptBlock label="CALL OPENER">
              "Hi <b>[Name]</b>! This is <b>[Your Name]</b> from Moneyfest Lending. I'm calling about your loan application — do you have about 5 to 10 minutes to chat?"
            </ScriptBlock>
            <ScriptBlock label="IF THEY SEEM NERVOUS">
              "Don't worry — this is just a quick friendly check-in, not an interrogation! We just want to make sure we get you the right loan setup. Everything is confidential and separate from your employment record."
            </ScriptBlock>
            <ScriptBlock label="TRANSITION INTO QUESTIONS">
              "Great! So I just have a few quick questions — nothing too formal. It helps us process your application faster and make sure the terms work for you. Ready to go?"
            </ScriptBlock>
          </Section>

          <Section title="Chat / Messenger Opening">
            <ScriptBlock label="FIRST MESSAGE">
              "Hi <b>[Name]</b>! This is <b>[Your Name]</b> from Moneyfest Lending. We received your loan application — just need to ask a few quick questions before we proceed. Is now a good time?"
            </ScriptBlock>
            <ScriptBlock label="NO RESPONSE AFTER 24 HOURS">
              "Hi <b>[Name]</b>, just following up on your Moneyfest loan application. We'd love to move it forward — let us know when you're free to answer a few quick questions. No rush!"
            </ScriptBlock>
          </Section>

          <Section title="Closing the Call / Chat">
            <ScriptBlock label="CLOSING">
              "Thanks so much, <b>[Name]</b>! That's everything we need. We'll review your application and get back to you within <b>[X business days]</b>. If you have any questions in the meantime, feel free to reach out anytime."
            </ScriptBlock>
          </Section>
        </div>
      )}

      {/* ─── TAB: Assessment Questions ─── */}
      {activeTab === 'questions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          {CATEGORIES.map(cat => (
            <div key={cat.id}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 16 }}>
                Category — {cat.title}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {cat.questions.map((q, qi) => (
                  <div key={q.id} style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 16, padding: '20px 24px' }}>
                    {/* Question header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      <div style={{ padding: '3px 10px', borderRadius: 6, background: q.label === 'PHONE' ? 'rgba(34,197,94,0.15)' : 'rgba(99,102,241,0.15)', fontSize: 10, fontWeight: 800, color: q.label === 'PHONE' ? '#22C55E' : '#6366F1', display: 'flex', alignItems: 'center', gap: 4 }}>
                        {q.label === 'PHONE' ? <Phone size={10} /> : <MessageSquare size={10} />} {q.label}
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>Q{qi + 1}</span>
                    </div>
                    
                    {/* Question text */}
                    <div style={{ fontSize: 15, color: 'var(--text-primary)', fontWeight: 600, lineHeight: 1.5, marginBottom: 10 }}>
                      {q.text.replace('[Purpose]', app.loan_purpose || 'this loan')}
                    </div>
                    
                    {/* Guide note */}
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 16, fontStyle: 'italic', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, borderLeft: '3px solid rgba(99,102,241,0.3)' }}>
                      {q.guide}
                    </div>

                    {/* Response Buttons */}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {q.responses.map((r, ri) => {
                        const isSelected = answers[q.id] === r.score
                        const color = r.score === 3 ? '#22C55E' : r.score === 2 ? '#F59E0B' : '#EF4444'
                        return (
                          <button
                            key={ri}
                            onClick={() => setAnswers(prev => ({ ...prev, [q.id]: r.score }))}
                            style={{
                              flex: 1, minWidth: 180, padding: '10px 14px', borderRadius: 10,
                              border: `1.5px solid ${isSelected ? color : 'rgba(255,255,255,0.08)'}`,
                              background: isSelected ? `${color}15` : 'rgba(255,255,255,0.02)',
                              color: isSelected ? color : 'var(--text-muted)',
                              fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
                              textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8
                            }}
                          >
                            <div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${isSelected ? color : 'rgba(255,255,255,0.15)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              {isSelected && <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />}
                            </div>
                            {r.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Notes */}
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 16, padding: 24 }}>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginBottom: 12 }}>Internal Interview Notes</div>
            <textarea 
              value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Record any observations, gut feelings, or context about this interview..."
              style={{ width: '100%', minHeight: 120, padding: 14, borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--card-border)', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
        </div>
      )}

      {/* ─── TAB: Red Flags ─── */}
      {activeTab === 'flags' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          {/* Auto Decline */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 16 }}>
              In-House Specific — Automatic Decline Flags
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {AUTO_DECLINE_FLAGS.map(flag => {
                const isChecked = declineFlags.includes(flag.id)
                return (
                  <button key={flag.id} onClick={() => {
                    if (isChecked) setDeclineFlags(prev => prev.filter(f => f !== flag.id))
                    else setDeclineFlags(prev => [...prev, flag.id])
                  }} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 16, padding: '18px 20px', borderRadius: 14,
                    background: isChecked ? 'rgba(239,68,68,0.08)' : 'var(--card-bg)',
                    border: `1.5px solid ${isChecked ? 'rgba(239,68,68,0.4)' : 'var(--card-border)'}`,
                    cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s', width: '100%'
                  }}>
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: isChecked ? 'rgba(239,68,68,0.2)' : 'rgba(239,68,68,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <XCircle size={16} color="#EF4444" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 14, color: isChecked ? '#EF4444' : 'var(--text-primary)', marginBottom: 4 }}>{flag.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{flag.desc}</div>
                    </div>
                    <div style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${isChecked ? '#EF4444' : 'rgba(255,255,255,0.15)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                      {isChecked && <CheckCircle2 size={14} color="#EF4444" />}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Proceed with Caution */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 16 }}>
              Proceed with Caution
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {CAUTION_FLAGS.map(flag => {
                const isChecked = cautionFlags.includes(flag.id)
                return (
                  <button key={flag.id} onClick={() => {
                    if (isChecked) setCautionFlags(prev => prev.filter(f => f !== flag.id))
                    else setCautionFlags(prev => [...prev, flag.id])
                  }} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 16, padding: '18px 20px', borderRadius: 14,
                    background: isChecked ? 'rgba(245,158,11,0.08)' : 'var(--card-bg)',
                    border: `1.5px solid ${isChecked ? 'rgba(245,158,11,0.4)' : 'var(--card-border)'}`,
                    cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s', width: '100%'
                  }}>
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: isChecked ? 'rgba(245,158,11,0.2)' : 'rgba(245,158,11,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <AlertCircle size={16} color="#F59E0B" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 14, color: isChecked ? '#F59E0B' : 'var(--text-primary)', marginBottom: 4 }}>{flag.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{flag.desc}</div>
                    </div>
                    <div style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${isChecked ? '#F59E0B' : 'rgba(255,255,255,0.15)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                      {isChecked && <CheckCircle2 size={14} color="#F59E0B" />}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB: Scoring & Result ─── */}
      {activeTab === 'result' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* Big Result Card */}
          <div style={{ background: 'linear-gradient(135deg, #141B2D, #0B0F1A)', border: `2px solid ${recColor.border}`, borderRadius: 24, padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 700, marginBottom: 8 }}>Final Assessment Result</div>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 72, color: recColor.text, lineHeight: 1 }}>{score.pct}%</div>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 24, color: recColor.text, marginTop: 8, marginBottom: 24 }}>{score.recommendation}</div>
            
            <div style={{ display: 'flex', justifyContent: 'center', gap: 40 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Raw Score</div>
                <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 20, color: 'var(--text-primary)' }}>{score.total}/{score.max}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Decline Flags</div>
                <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 20, color: declineFlags.length > 0 ? '#EF4444' : 'var(--text-primary)' }}>{declineFlags.length}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Caution Flags</div>
                <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 20, color: cautionFlags.length > 0 ? '#F59E0B' : 'var(--text-primary)' }}>{cautionFlags.length}</div>
              </div>
            </div>
          </div>

          {/* Scoring Rubric Explanation */}
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 16, padding: 24 }}>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', marginBottom: 16 }}>Scoring Rubric</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { range: '80–100%', label: 'Highly Recommended', color: '#22C55E', desc: 'Strong answers, no flags. Safe to approve.' },
                { range: '60–79%', label: 'Recommended', color: '#6366F1', desc: 'Solid profile with minor concerns.' },
                { range: '40–59%', label: 'Proceed with Caution', color: '#F59E0B', desc: 'Notable concerns. Consider reduced amount or extra terms.' },
                { range: '0–39%', label: 'Rejected', color: '#EF4444', desc: 'Too many red flags or poor interview responses.' }
              ].map((r, i) => (
                <div key={i} style={{ padding: '14px 16px', borderRadius: 12, background: `${r.color}08`, border: `1px solid ${r.color}30` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: r.color }} />
                    <span style={{ fontWeight: 800, fontSize: 13, color: r.color }}>{r.range}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>— {r.label}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>{r.desc}</div>
                </div>
              ))}
            </div>
            
            <div style={{ marginTop: 16, padding: '12px 16px', borderRadius: 10, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              <strong style={{ color: '#EF4444' }}>Auto-Decline Rule:</strong> If ANY "Automatic Decline Flag" is checked, the recommendation is automatically set to <strong>Rejected</strong> regardless of the interview score.
            </div>
          </div>

          {/* Per-question breakdown */}
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 16, padding: 24 }}>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', marginBottom: 16 }}>Question Breakdown</div>
            {CATEGORIES.map(cat => (
              <div key={cat.id} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>{cat.title}</div>
                {cat.questions.map(q => {
                  const a = answers[q.id]
                  const color = a === 3 ? '#22C55E' : a === 2 ? '#F59E0B' : a === 0 ? '#EF4444' : 'var(--text-muted)'
                  const label = a !== undefined && a !== null ? q.responses.find(r => r.score === a)?.label : 'Not answered'
                  return (
                    <div key={q.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 8, marginBottom: 4, background: 'rgba(255,255,255,0.02)' }}>
                      <span style={{ fontSize: 12, color: 'var(--text-label)' }}>{q.text.substring(0, 60)}...</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color }}>{label}</span>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ─────────────── Helper Components ─────────────── */
function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>{children}</div>
    </div>
  )
}

function ScriptBlock({ label, children }) {
  return (
    <div style={{ padding: '14px 18px', borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: typeof children === 'string' ? children : '' }}>
        {typeof children !== 'string' ? children : undefined}
      </div>
    </div>
  )
}
