import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'
import { 
  ChevronLeft, Award, Brain, Target, ShieldCheck, 
  Search, Flag, MessageSquare, Save, XCircle, Info
} from 'lucide-react'

const RUBRIC_CATEGORIES = [
  { 
    id: 'character', 
    label: 'Character & Integrity', 
    icon: ShieldCheck, 
    color: '#3B82F6', 
    description: 'Assesses honesty, openness, and professional reputation.',
    questions: [
      "Tell me about a time you had a financial emergency and you *did not* have enough to cover it. How did you handle that situation?",
      "Whose financial advice in this company do you trust most? Why?",
      "If you were unable to make a payment on time, how would you handle talking to the admin team?"
    ]
  },
  { 
    id: 'capacity', 
    label: 'Financial Resilience', 
    icon: Brain, 
    color: '#8B5CF6', 
    description: 'Assesses their ability to plan and manage unexpected events.',
    questions: [
      "If your car broke down tomorrow, how would you pay for the repair without this loan?",
      "If you had only enough for one: this loan payment or a high-utility bill, which would you pay first?",
      "Walk me through your typical payday cycle. Where does the money go in the first 24 hours?"
    ]
  },
  { 
    id: 'reliability', 
    label: 'Company Standing', 
    icon: Award, 
    color: '#10B981', 
    description: 'Assesses their perceived tenure and loyalty to the firm.',
    questions: [
      "How long do you honestly see yourself staying with us at this company?",
      "Who in your department would you say is the most responsible person you know? Why?",
      "What is your proudest achievement during your time here?"
    ]
  },
  { 
    id: 'purpose', 
    label: 'Purpose & Vision', 
    icon: Target, 
    color: '#F59E0B', 
    description: 'Assesses if the loan is being used for growth or just short-term relief.',
    questions: [
      "You mentioned this is for [Purpose]. How will this specifically help your situation 6 months from now?",
      "What is the most important lesson you've learned about money in the last 12 months?",
      "How does this loan contribute to your long-term financial goals?"
    ]
  }
]

const RED_FLAGS = [
  "Vague about purpose",
  "Avoidant behavior during questioning",
  "History of missed payments elsewhere",
  "Excessive urgency / Panic",
  "Conflict in story between application and interview"
]

export default function AssessmentForm() {
  const { id } = useParams()
  const { user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  
  const [app, setApp] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  const [scores, setScores] = useState({
    character: 5,
    capacity: 5,
    reliability: 5,
    purpose: 5,
    overall: 5
  })
  const [notes, setNotes] = useState('')
  const [selectedFlags, setSelectedFlags] = useState([])
  const [recommendation, setRecommendation] = useState('Recommended')

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('applications').select('*').eq('id', id).single()
      if (data) setApp(data)
      
      // Load existing assessment if any
      const { data: existing } = await supabase.from('applicant_assessments').select('*').eq('application_id', id).single()
      if (existing) {
        setScores({
          character: existing.score_character,
          capacity: existing.score_capacity,
          reliability: existing.score_reliability,
          purpose: existing.score_purpose,
          overall: existing.score_overall
        })
        setNotes(existing.interview_notes)
        setSelectedFlags(existing.red_flags || [])
        setRecommendation(existing.recommendation)
      }
      setLoading(false)
    }
    load()
  }, [id])

  const handleSave = async () => {
    setSaving(true)
    const payload = {
      application_id: id,
      admin_id: user?.id,
      score_character: scores.character,
      score_capacity: scores.capacity,
      score_reliability: scores.reliability,
      score_purpose: scores.purpose,
      score_overall: scores.overall,
      interview_notes: notes,
      red_flags: selectedFlags,
      recommendation: recommendation,
      updated_at: new Date().toISOString()
    }

    const { error } = await supabase.from('applicant_assessments').upsert(payload, { onConflict: 'application_id' })
    
    if (error) toast('Save failed: ' + error.message, 'error')
    else {
      toast('Assessment saved successfully', 'success')
      navigate('/admin/assessments')
    }
    setSaving(false)
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Loading...</div>
  if (!app) return <div style={{ padding: 40, textAlign: 'center' }}>Application not found</div>

  return (
    <div style={{ padding: '32px 28px', maxWidth: 1100, margin: '0 auto', background: 'var(--bg)', minHeight: '100vh' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button onClick={() => navigate('/admin/assessments')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--card-border)', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <ChevronLeft size={20} />
          </button>
          <div>
            <div style={{ fontSize: 13, color: 'var(--blue)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>Confidential Borrower Profiling</div>
            <h1 style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 800, fontSize: 28, color: 'var(--text-primary)', margin: 0 }}>
              Interview Worksheet for {app.full_name}
            </h1>
          </div>
        </div>
        <button 
          onClick={handleSave}
          disabled={saving}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderRadius: 12, border: 'none', background: 'var(--blue)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'Space Grotesk' }}
        >
          <Save size={18} /> {saving ? 'Saving...' : 'Save Assessment'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start' }}>
        
        {/* Main Form Left */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* Rubric Categories */}
          {RUBRIC_CATEGORIES.map(cat => (
            <div key={cat.id} style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 20, overflow: 'hidden' }}>
              <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: `${cat.color}08` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: `${cat.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: cat.color }}>
                    <cat.icon size={20} />
                  </div>
                  <div>
                    <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>{cat.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{cat.description}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: cat.color }}>{scores[cat.id]}/10</span>
                  <input 
                    type="range" min="1" max="10" 
                    value={scores[cat.id]} 
                    onChange={e => setScores({ ...scores, [cat.id]: parseInt(e.target.value) })}
                    style={{ width: 100, accentColor: cat.color }}
                  />
                </div>
              </div>
              <div style={{ padding: 24 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12, fontWeight: 800 }}>Psycological Interview Script</div>
                {cat.questions.map((q, qi) => (
                  <div key={qi} style={{ display: 'flex', gap: 12, marginBottom: 14, padding: '12px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ color: cat.color, marginTop: 2 }}><MessageSquare size={13} /></div>
                    <div style={{ fontSize: 13.5, color: '#CBD5F0', lineHeight: 1.5 }}>{q.replace('[Purpose]', app.loan_purpose || 'this loan')}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Notes Section */}
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 20, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Info size={18} color="var(--blue)" />
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>Internal Interview Notes</div>
            </div>
            <textarea 
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Record any critical psychological or character-related observations here for the admin team..."
              style={{ width: '100%', minHeight: 160, padding: 16, borderRadius: 14, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--card-border)', color: '#F0F4FF', fontSize: 14, fontFamily: 'inherit', resize: 'none', outline: 'none' }}
            />
          </div>
        </div>

        {/* Sidebar Right */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* Summary & Final Score */}
          <div style={{ background: 'linear-gradient(135deg, #141B2D, #0B0F1A)', border: '1px solid var(--card-border)', borderRadius: 20, padding: 24, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12, fontWeight: 700 }}>Final Quality Score</div>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 56, color: scores.overall >= 8 ? 'var(--green)' : scores.overall >= 5 ? 'var(--blue)' : 'var(--red)', marginBottom: 8 }}>
              {scores.overall}/10
            </div>
            <input 
              type="range" min="1" max="10" 
              value={scores.overall} 
              onChange={e => setScores({ ...scores, overall: parseInt(e.target.value) })}
              style={{ width: '100%', accentColor: 'var(--blue)', marginBottom: 16 }}
            />
            
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>Select Recommendation</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {['Highly Recommended', 'Recommended', 'Proceed with Caution', 'Rejected'].map(r => (
                <button key={r} onClick={() => setRecommendation(r)} style={{ padding: '10px', borderRadius: 10, border: `1.5px solid ${recommendation === r ? 'var(--blue)' : 'rgba(255,255,255,0.06)'}`, background: recommendation === r ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.03)', color: recommendation === r ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }}>
                  {r === recommendation && '✓ '} {r}
                </button>
              ))}
            </div>
          </div>

          {/* Red Flag Checklist */}
          <div style={{ background: 'var(--card-bg)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 20, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, color: 'var(--red)' }}>
              <Flag size={18} />
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 14 }}>Red Flag Checklist</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {RED_FLAGS.map(f => {
                const selected = selectedFlags.includes(f)
                return (
                  <label key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', opacity: selected ? 1 : 0.6 }}>
                    <input 
                      type="checkbox" 
                      checked={selected} 
                      onChange={() => {
                        if (selected) setSelectedFlags(selectedFlags.filter(i => i !== f))
                        else setSelectedFlags([...selectedFlags, f])
                      }}
                      style={{ accentColor: 'var(--red)' }}
                    />
                    <span style={{ fontSize: 12, color: selected ? '#EF4444' : 'var(--text-muted)' }}>{f}</span>
                  </label>
                )
              })}
            </div>
          </div>

          {/* Applicant Info Summary */}
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 20, padding: 24 }}>
             <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12, fontWeight: 700 }}>Applicant Profile</div>
             <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { label: 'Amount', value: '₱' + app.loan_amount?.toLocaleString() },
                  { label: 'Term', value: (app.loan_term || 2) + ' Months' },
                  { label: 'Tenure', value: (app.tenure_years || 0) + ' Years' },
                  { label: 'Building', value: app.building || 'Not specified' }
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--text-muted)' }}>{item.label}</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{item.value}</span>
                  </div>
                ))}
             </div>
          </div>

        </div>
      </div>
    </div>
  )
}
