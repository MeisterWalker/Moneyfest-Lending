import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'
import { logAudit } from '../lib/helpers'

// ── Status config ──────────────────────────────────────────────
const STATUS = {
  Pending:       { bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.35)',  text: '#F59E0B',  icon: '⏳' },
  'Under Review':{ bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.35)', text: '#60A5FA',  icon: '🔍' },
  Denied:        { bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.35)',  text: '#EF4444',  icon: '❌' },
  Approved:      { bg: 'rgba(34,197,94,0.12)',   border: 'rgba(34,197,94,0.35)', text: '#22C55E',  icon: '✅' },
}

const TABS = ['Pending', 'Under Review', 'Denied', 'Approved']

// ── Shared style tokens ────────────────────────────────────────
const cardStyle = {
  background: '#0D1321',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 14,
  overflow: 'hidden',
  marginBottom: 10,
  transition: 'box-shadow 0.2s',
}
const btnBase = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  padding: '8px 14px', borderRadius: 9, fontSize: 12, fontWeight: 700,
  cursor: 'pointer', border: 'none', transition: 'all 0.15s',
}

function fmt(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}
function fmtTime(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ── Status badge ───────────────────────────────────────────────
function StatusBadge({ status }) {
  const s = STATUS[status] || STATUS.Pending
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 11px', borderRadius: 20, fontSize: 11, fontWeight: 800,
      background: s.bg, border: `1px solid ${s.border}`, color: s.text,
      letterSpacing: '0.03em',
    }}>{s.icon} {status}</span>
  )
}

// ── Deny modal ─────────────────────────────────────────────────
function DenyModal({ app, adminEmail, onConfirm, onClose }) {
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)

  const handleConfirm = async () => {
    if (!reason.trim()) return
    setLoading(true)
    await onConfirm(app, reason.trim())
    setLoading(false)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
      backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 1000, padding: 20,
    }}>
      <div style={{
        width: '100%', maxWidth: 460, background: '#0D1321',
        border: '1px solid rgba(239,68,68,0.3)', borderRadius: 18,
        overflow: 'hidden', boxShadow: '0 40px 80px rgba(0,0,0,0.6)',
      }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 800, fontSize: 16, color: '#F0F4FF' }}>
            Deny Application
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#7A8AAA', cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ padding: 22 }}>
          <div style={{ fontSize: 13, color: '#7A8AAA', marginBottom: 14, lineHeight: 1.6 }}>
            You are denying <strong style={{ color: '#F0F4FF' }}>{app.full_name}</strong>'s application for <strong style={{ color: '#F0F4FF' }}>₱{Number(app.loan_amount).toLocaleString()}</strong>. Please provide a reason that will be shown to the applicant.
          </div>
          <label style={{ display: 'block', fontSize: 10, color: '#4B5580', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
            Rejection Reason *
          </label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="e.g. Insufficient tenure, incomplete documents, existing overdue balance..."
            rows={4}
            autoFocus
            style={{
              width: '100%', boxSizing: 'border-box', padding: '11px 14px',
              background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: 9, color: '#F0F4FF', fontSize: 13, resize: 'vertical',
              outline: 'none', fontFamily: 'DM Sans, sans-serif', lineHeight: 1.6,
              marginBottom: 16,
            }}
          />
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ ...btnBase, flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#7A8AAA' }}>
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!reason.trim() || loading}
              style={{ ...btnBase, flex: 2, background: reason.trim() && !loading ? '#EF4444' : 'rgba(239,68,68,0.25)', color: reason.trim() && !loading ? '#fff' : '#7A8AAA', cursor: reason.trim() && !loading ? 'pointer' : 'not-allowed' }}
            >
              {loading ? 'Saving…' : '❌ Confirm Deny'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Detail row helper ──────────────────────────────────────────
function Row({ label, value, accent }) {
  if (!value && value !== 0) return null
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', gap: 12 }}>
      <span style={{ fontSize: 12, color: '#4B5580', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: accent || '#CBD5F0', fontFamily: 'Space Grotesk, sans-serif', textAlign: 'right' }}>{value}</span>
    </div>
  )
}

// ── Applicant card ─────────────────────────────────────────────
function ApplicantCard({ app, tab, onMarkReview, onApprove, onDeny }) {
  const [expanded, setExpanded] = useState(false)
  const [acting, setActing] = useState(false)

  const isQuick = app.loan_type === 'quickloan'
  const estInstallment = isQuick ? null : Math.ceil(app.loan_amount * (1 + 0.07 * (app.loan_term || 2)) / ((app.loan_term || 2) * 2))

  const wrap = fn => async () => { setActing(true); await fn(); setActing(false) }

  return (
    <div style={cardStyle}>
      {/* ── Header row ── */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', flexWrap: 'wrap', userSelect: 'none' }}
      >
        {/* Avatar */}
        <div style={{
          width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
          background: 'linear-gradient(135deg,#3B82F6,#8B5CF6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'Space Grotesk, sans-serif', fontWeight: 800, color: '#fff', fontSize: 15,
        }}>
          {app.full_name?.charAt(0).toUpperCase()}
        </div>

        {/* Name + meta */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: 14, color: '#F0F4FF' }}>
              {app.full_name}
            </span>
            {app.is_reapplication && (
              <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 20, background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', color: '#a78bfa' }}>
                🔄 Re-application
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: '#4B5580', marginTop: 2 }}>
            {app.department}{app.building ? ` · ${app.building}` : ''} · Applied {fmt(app.created_at)}
          </div>
        </div>

        {/* Amount + loan type */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 900, fontSize: 17, color: '#22C55E' }}>
            ₱{Number(app.loan_amount).toLocaleString()}
          </div>
          <div style={{ fontSize: 10, color: isQuick ? '#F59E0B' : '#60A5FA', fontWeight: 700, marginTop: 2 }}>
            {isQuick ? '⚡ QuickLoan' : `📅 ${app.loan_term || 2}-mo Installment`}
          </div>
        </div>

        {/* Status badge */}
        <div style={{ flexShrink: 0 }}>
          <StatusBadge status={app.status} />
        </div>

        {/* Chevron */}
        <span style={{ color: '#4B5580', fontSize: 13 }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {/* ── Expanded detail ── */}
      {expanded && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '18px 20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20, marginBottom: 18 }}>

            {/* Personal */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#4B5580', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>👤 Personal</div>
              <Row label="Access Code" value={app.access_code} accent="#818CF8" />
              <Row label="Department" value={app.department} />
              <Row label="Building" value={app.building} />
              <Row label="Tenure" value={app.tenure_years != null ? `${app.tenure_years} yr${app.tenure_years !== 1 ? 's' : ''}` : null} />
              <Row label="Phone" value={app.phone} />
              <Row label="Email" value={app.email} />
              <Row label="Address" value={app.address || 'Not provided'} />
            </div>

            {/* Loan */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#4B5580', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>💰 Loan Details</div>
              <Row label="Amount" value={`₱${Number(app.loan_amount).toLocaleString()}`} accent="#22C55E" />
              <Row label="Type" value={isQuick ? '⚡ QuickLoan' : '📅 Installment Loan'} />
              {!isQuick && <Row label="Term" value={`${app.loan_term || 2} months`} />}
              {!isQuick && <Row label="Est. Installment" value={`₱${estInstallment?.toLocaleString()}/cutoff`} />}
              <Row label="Purpose" value={app.loan_purpose} />
              <Row label="Release Method" value={app.release_method} />
              {app.gcash_number && <Row label="GCash No." value={app.gcash_number} />}
              {app.gcash_name && <Row label="GCash Name" value={app.gcash_name} />}
              {app.bank_account_number && <Row label="Account No." value={app.bank_account_number} />}
              {app.bank_account_holder && <Row label="Account Holder" value={app.bank_account_holder} />}
            </div>

            {/* Timeline */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#4B5580', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>📅 Timeline</div>
              <Row label="Applied" value={fmtTime(app.created_at)} />
              <Row label="Reviewed At" value={app.reviewed_at ? fmtTime(app.reviewed_at) : null} />
              <Row label="Reviewed By" value={app.reviewed_by} />
              {app.is_reapplication && <Row label="Type" value="🔄 Re-application" accent="#a78bfa" />}
            </div>
          </div>

          {/* Rejection reason (Denied tab) */}
          {app.status === 'Denied' && app.rejection_reason && (
            <div style={{ padding: '12px 14px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, fontSize: 13, color: '#FCA5A5', lineHeight: 1.6, marginBottom: 16 }}>
              <strong style={{ display: 'block', fontSize: 11, color: '#EF4444', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Rejection Reason</strong>
              {app.rejection_reason}
            </div>
          )}

          {/* ── Actions ── */}
          {(tab === 'Pending' || tab === 'Under Review') && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingTop: 4 }}>
              {tab === 'Pending' && (
                <button
                  onClick={wrap(() => onMarkReview(app))}
                  disabled={acting}
                  style={{ ...btnBase, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', color: '#60A5FA' }}
                >
                  🔍 Mark Under Review
                </button>
              )}
              <button
                onClick={wrap(() => onApprove(app))}
                disabled={acting}
                style={{ ...btnBase, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: '#22C55E' }}
              >
                ✅ Approve
              </button>
              <button
                onClick={() => onDeny(app)}
                disabled={acting}
                style={{ ...btnBase, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444' }}
              >
                ❌ Deny
              </button>
            </div>
          )}

          {/* View-only notice for Denied / Approved tabs */}
          {(tab === 'Denied' || tab === 'Approved') && (
            <div style={{ fontSize: 11, color: '#4B5580', fontStyle: 'italic', paddingTop: 4 }}>
              {tab === 'Approved' ? '✅ Audit trail — this application has been approved.' : '📋 History record — no further actions available.'}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────
export default function ApplicantsPage() {
  const { user } = useAuth()
  const { toast } = useToast()

  const [applicants, setApplicants] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('Pending')
  const [search, setSearch] = useState('')
  const [denyTarget, setDenyTarget] = useState(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('applications')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) console.error('ApplicantsPage fetch error:', error)
    setApplicants(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Mark Under Review ──
  const handleMarkReview = async (app) => {
    const { error } = await supabase.from('applications')
      .update({ status: 'Under Review', reviewed_at: new Date().toISOString(), reviewed_by: user?.email })
      .eq('id', app.id)
    if (error) { toast('Failed to update status.', 'error'); return }
    await logAudit({ action_type: 'APPLICATION_UNDER_REVIEW', module: 'Applicants', description: `${app.full_name}'s application marked Under Review.`, changed_by: user?.email })
    setApplicants(prev => prev.map(a => a.id === app.id ? { ...a, status: 'Under Review', reviewed_at: new Date().toISOString(), reviewed_by: user?.email } : a))
    toast(`${app.full_name} marked Under Review`, 'info')
  }

  // ── Approve ──
  const handleApprove = async (app) => {
    try {
      const now = new Date().toISOString()
      // 1. Update application
      const { error: appErr } = await supabase.from('applications')
        .update({ status: 'Approved', reviewed_at: now, reviewed_by: user?.email })
        .eq('id', app.id)
      if (appErr) throw appErr

      // 2. Check if borrower already exists (avoid duplicates)
      const { data: existing } = await supabase.from('borrowers')
        .select('id').eq('access_code', app.access_code).maybeSingle()

      if (!existing) {
        const { error: bErr } = await supabase.from('borrowers').insert({
          full_name:        app.full_name,
          department:       app.department || '',
          phone:            app.phone || '',
          email:            app.email || '',
          address:          app.address || '',
          tenure_years:     app.tenure_years || 0,
          access_code:      app.access_code,
          building:         app.building || '',
          credit_score:     750,
          loan_limit:       5000,
          loan_limit_level: 1,
          loyalty_badge:    'New',
          at_risk:          false,
          admin_notes:      'Approved via Applicants page.',
        })
        if (bErr) throw bErr
      }

      // 3. Log + UI update
      await logAudit({ action_type: 'APPLICATION_APPROVED', module: 'Applicants', description: `Approved applicant ${app.full_name} (${app.access_code}) — ₱${Number(app.loan_amount).toLocaleString()} ${app.loan_type === 'quickloan' ? 'QuickLoan' : 'Installment'}. Borrower record created.`, changed_by: user?.email })
      setApplicants(prev => prev.map(a => a.id === app.id ? { ...a, status: 'Approved', reviewed_at: now, reviewed_by: user?.email } : a))
      toast(`✅ ${app.full_name} approved! Borrower record created.`, 'success')

    } catch (err) {
      console.error('Approve error:', err)
      toast('Error approving applicant: ' + err.message, 'error')
    }
  }

  // ── Deny (modal confirm) ──
  const handleDenyConfirm = async (app, reason) => {
    const now = new Date().toISOString()
    const { error } = await supabase.from('applications')
      .update({ status: 'Denied', rejection_reason: reason, reviewed_at: now, reviewed_by: user?.email })
      .eq('id', app.id)
    if (error) { toast('Failed to deny applicant.', 'error'); return }
    await logAudit({ action_type: 'APPLICATION_DENIED', module: 'Applicants', description: `Denied applicant ${app.full_name} (${app.access_code}). Reason: ${reason}`, changed_by: user?.email })
    setApplicants(prev => prev.map(a => a.id === app.id ? { ...a, status: 'Denied', rejection_reason: reason, reviewed_at: now, reviewed_by: user?.email } : a))
    setDenyTarget(null)
    toast(`Application denied — ${app.full_name}`, 'info')
  }

  // ── Filter + search ──
  const tabCounts = TABS.reduce((acc, t) => ({ ...acc, [t]: applicants.filter(a => a.status === t).length }), {})

  const filtered = applicants.filter(a => {
    if (a.status !== tab) return false
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      a.full_name?.toLowerCase().includes(q) ||
      a.department?.toLowerCase().includes(q) ||
      a.email?.toLowerCase().includes(q) ||
      a.access_code?.toLowerCase().includes(q)
    )
  })

  return (
    <div style={{ padding: 'clamp(16px,4vw,32px) clamp(12px,3vw,28px)', maxWidth: 960, margin: '0 auto', fontFamily: 'DM Sans, sans-serif' }}>
      <style>{`
        .ap-tab { transition: all 0.15s; border-radius: 8px; }
        .ap-card:hover { box-shadow: 0 0 0 1px rgba(99,102,241,0.2); }
        .ap-search:focus { border-color: rgba(99,102,241,0.5) !important; outline: none; }
        .ap-act:hover:not(:disabled) { filter: brightness(1.15); transform: translateY(-1px); }
      `}</style>

      {/* ── Page header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 900, fontSize: 28, color: '#F0F4FF', margin: '0 0 4px', letterSpacing: -0.5 }}>
            Applicants
          </h1>
          <p style={{ color: '#4B5580', fontSize: 14, margin: 0 }}>
            Manage loan applications — review, approve, or deny.
          </p>
        </div>
        {tabCounts.Pending > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 10, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)' }}>
            <span style={{ fontSize: 16 }}>⏳</span>
            <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: 13, color: '#F59E0B' }}>{tabCounts.Pending} pending review</span>
          </div>
        )}
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 4, marginBottom: 20, width: 'fit-content', flexWrap: 'wrap' }}>
        {TABS.map(t => {
          const s = STATUS[t]
          const active = tab === t
          return (
            <button
              key={t}
              className="ap-tab"
              onClick={() => { setTab(t); setSearch('') }}
              style={{
                padding: '7px 18px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
                background: active ? s.bg : 'transparent',
                color: active ? s.text : '#4B5580',
                outline: active ? `1px solid ${s.border}` : 'none',
              }}
            >
              {t}
              {tabCounts[t] > 0 && (
                <span style={{ marginLeft: 7, padding: '1px 8px', borderRadius: 20, fontSize: 10, fontWeight: 900, background: active ? s.text : 'rgba(255,255,255,0.06)', color: active ? '#000' : '#4B5580' }}>
                  {tabCounts[t]}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Search ── */}
      <div style={{ marginBottom: 20, position: 'relative' }}>
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: '#4B5580', pointerEvents: 'none' }}>🔍</span>
        <input
          className="ap-search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={`Search ${tab.toLowerCase()} applicants…`}
          style={{
            width: '100%', maxWidth: 400, boxSizing: 'border-box',
            padding: '9px 14px 9px 36px',
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 10, color: '#F0F4FF', fontSize: 13,
            fontFamily: 'DM Sans, sans-serif',
          }}
        />
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#4B5580' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
          <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700 }}>Loading applicants…</div>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#4B5580' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>{STATUS[tab]?.icon}</div>
          <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: 18, marginBottom: 8, color: '#7A8AAA' }}>
            No {tab.toLowerCase()} applicants
          </div>
          <div style={{ fontSize: 13 }}>
            {search ? 'No results match your search.' : tab === 'Pending' ? 'New applications will appear here.' : 'Nothing to show here.'}
          </div>
        </div>
      ) : (
        filtered.map(app => (
          <ApplicantCard
            key={app.id}
            app={app}
            tab={tab}
            onMarkReview={handleMarkReview}
            onApprove={handleApprove}
            onDeny={a => setDenyTarget(a)}
          />
        ))
      )}

      {/* ── Deny modal ── */}
      {denyTarget && (
        <DenyModal
          app={denyTarget}
          adminEmail={user?.email}
          onConfirm={handleDenyConfirm}
          onClose={() => setDenyTarget(null)}
        />
      )}
    </div>
  )
}
