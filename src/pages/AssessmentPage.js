import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { ClipboardList, User, Clock, CheckCircle, AlertTriangle, ArrowRight, Search, Filter } from 'lucide-react'

export default function AssessmentPage() {
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState('All')
  const navigate = useNavigate()

  const fetchData = useCallback(async () => {
    setLoading(true)
    // Fetch applications with their assessment status
    const { data, error } = await supabase
      .from('application_with_assessment')
      .select('*')
      .eq('status', 'Pending')
      .order('created_at', { ascending: false })
    
    if (error) console.error('Error fetching assessments:', error)
    else setApplications(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const filtered = applications.filter(app => {
    const matchesSearch = app.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
    if (filter === 'All') return matchesSearch
    if (filter === 'Assessed') return matchesSearch && app.assessment_id
    if (filter === 'Pending') return matchesSearch && !app.assessment_id
    return matchesSearch
  })

  return (
    <div style={{ padding: '32px 28px', maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 800, fontSize: 28, color: 'var(--text-primary)', margin: 0 }}>
          Applicant Assessments
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>
          Conduct interviews and score potential borrowers using the internal rubric.
        </p>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 260, position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            placeholder="Search applicants..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box', padding: '12px 12px 12px 42px', borderRadius: 12, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-primary)', fontSize: 14, outline: 'none' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 8, background: 'var(--card-bg)', padding: 4, borderRadius: 12, border: '1px solid var(--card-border)' }}>
          {['All', 'Pending', 'Assessed'].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: filter === f ? 'var(--blue)' : 'transparent', color: filter === f ? '#fff' : 'var(--text-muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 100, color: 'var(--text-muted)' }}>Loading applicants...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 20px', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 20 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 20, color: 'var(--text-primary)' }}>No active applications found</div>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>All caught up! No applications currently waiting for assessment.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
          {filtered.map(app => (
            <div key={app.id} style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 16, padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'all 0.2s' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg, var(--blue), var(--purple))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 18, fontWeight: 800 }}>
                  {app.full_name?.charAt(0)}
                </div>
                <div>
                  <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>{app.full_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{app.department} · Applied {new Date(app.created_at).toLocaleDateString()}</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4, fontWeight: 800 }}>Assessment Status</div>
                  {app.assessment_id ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--green)', fontSize: 13, fontWeight: 700 }}>
                      <CheckCircle size={14} /> {app.assessment_recommendation} ({app.score_overall}/10)
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--orange)', fontSize: 13, fontWeight: 700 }}>
                      <Clock size={14} /> Waiting for Call
                    </div>
                  )}
                </div>

                <button 
                  onClick={() => navigate(`/admin/assessment/${app.id}`)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 10, border: 'none', background: 'rgba(99,102,241,0.1)', color: 'var(--blue)', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--blue)'; e.currentTarget.style.color = '#fff' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.1)'; e.currentTarget.style.color = 'var(--blue)' }}
                >
                  {app.assessment_id ? 'Review Assessment' : 'Start Interview'} <ArrowRight size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
