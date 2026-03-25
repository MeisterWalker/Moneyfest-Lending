import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { CREDIT_CONFIG, getBadgeConfig } from '../lib/creditSystem'
import { logAudit, formatDate } from '../lib/helpers'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'
import BorrowerModal from '../components/BorrowerModal'
import {
  UserPlus, Search, Users, Trash2, Edit2,
  ChevronDown, ChevronUp, Phone, Mail,
  CreditCard, Calendar, StickyNote, MapPin
} from 'lucide-react'
import BorrowerAvatar from '../components/BorrowerAvatar'

const BADGE_CONFIG = {
  New:      { label: "🌱 New",      cls: 'badge-new' },
  Trusted:  { label: "⭐ Trusted",  cls: 'badge-trusted' },
  Reliable: { label: "🤝 Reliable", cls: 'badge-reliable' },
  VIP:      { label: "👑 VIP",      cls: 'badge-vip' },
}

const RISK_CONFIG = {
  Low: { cls: 'badge-low' },
  Medium: { cls: 'badge-medium' },
  High: { cls: 'badge-high' },
}

function BorrowerCard({ borrower, departments, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  const dept = { name: borrower.department }
  const badge = BADGE_CONFIG[borrower.loyalty_badge] || BADGE_CONFIG.New
  const risk = RISK_CONFIG[borrower.risk_score] || RISK_CONFIG.Low

  const scoreColor = CREDIT_CONFIG.colorFromScore(borrower.credit_score || CREDIT_CONFIG.STARTING_SCORE)

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', transition: 'box-shadow 0.2s' }}>
      {/* Card Header */}
      <div style={{ padding: '20px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0 }}>
            {/* Avatar */}
            <BorrowerAvatar name={borrower.full_name} photoUrl={borrower.photo_url} size={46} />

            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 16, marginBottom: 4 }}>
                {borrower.full_name}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {dept && (
                  <span style={{ fontSize: 12, color: 'var(--text-label)', background: 'rgba(255,255,255,0.04)', padding: '2px 8px', borderRadius: 6, border: '1px solid var(--card-border)' }}>
                    {dept.name}
                  </span>
                )}
                <span className={`badge ${badge.cls}`} style={{ fontSize: 11 }}>{badge.label}</span>
              </div>
            </div>
          </div>

          {/* Credit score + risk */}
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 22, color: scoreColor, lineHeight: 1 }}>
              {borrower.credit_score}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Credit Score</div>
            <span className={`badge ${risk.cls}`} style={{ fontSize: 11 }}>{borrower.risk_score} Risk</span>
          </div>
        </div>

        {/* Quick info row */}
        <div style={{ display: 'flex', gap: 16, marginTop: 14, flexWrap: 'wrap' }}>
          {borrower.phone && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-label)' }}>
              <Phone size={12} /> {borrower.phone}
            </div>
          )}
          {borrower.email && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-label)' }}>
              <Mail size={12} /> {borrower.email}
            </div>
          )}
          {borrower.tenure_years && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-label)' }}>
              <Calendar size={12} /> {borrower.tenure_years} yrs tenure
            </div>
          )}
          {borrower.building && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-label)' }}>
              <MapPin size={12} /> Building: {borrower.building}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-label)' }}>
            <CreditCard size={12} /> Limit: ₱{borrower.loan_limit?.toLocaleString()} (Lvl {borrower.loan_limit_level})
          </div>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--card-border)', padding: '16px 22px', background: 'rgba(255,255,255,0.01)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Address</div>
              <div style={{ fontSize: 13, color: 'var(--text-label)' }}>{borrower.address || "—"}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Member Since</div>
              <div style={{ fontSize: 13, color: 'var(--text-label)' }}>{formatDate(borrower.created_at)}</div>
            </div>
            {borrower.admin_notes && (
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <StickyNote size={11} /> Admin Notes (Private)
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-label)', background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 8, padding: '8px 12px' }}>
                  {borrower.admin_notes}
                </div>
              </div>
            )}
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>🎯 Loan Purpose</div>
              <div style={{ fontSize: 13, color: 'var(--text-label)', fontWeight: 600 }}>{borrower.loan_purpose || "Not specified"}</div>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 5 }}><img src="/padlock.png" alt="access" style={{ width: 13, height: 13, objectFit: 'contain' }} />Portal Access Code</div>
              {borrower.access_code ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 900, letterSpacing: 6, color: '#F0F4FF', background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: 8, padding: '8px 16px' }}>
                    {borrower.access_code}
                  </div>
                  <button
                    onClick={() => { navigator.clipboard.writeText(borrower.access_code); }}
                    title="Copy code"
                    style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 7, padding: '6px 12px', color: '#8B5CF6', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  >
                    Copy
                  </button>
                  <a
                    href={process.env.REACT_APP_PORTAL_URL || 'https://loanmoneyfest.vercel.app/portal'}
                    target="_blank"
                    rel="noreferrer"
                    style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 7, padding: '6px 12px', color: '#3B82F6', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}
                  >
                    Open Portal ↗
                  </a>
                </div>
              ) : (
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No access code assigned</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer actions */}
      <div style={{ borderTop: '1px solid var(--card-border)', padding: '12px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button
          onClick={() => setExpanded(!expanded)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
        >
          {expanded ? <><ChevronUp size={14} /> Less info</> : <><ChevronDown size={14} /> More info</>}
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-edit" onClick={() => onEdit(borrower)}>
            <Edit2 size={13} /> Edit
          </button>
          <button className="btn-delete" onClick={() => onDelete(borrower)}>
            <Trash2 size={13} /> Delete
          </button>
        </div>
      </div>
    </div>
  )
}

export default function BorrowersPage() {
  const [borrowers, setBorrowers] = useState([])
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingBorrower, setEditingBorrower] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const { user } = useAuth()
  const { toast } = useToast()

  const fetchData = useCallback(async () => {
    const [{ data: b }, { data: d }] = await Promise.all([
      supabase.from('borrowers').select('*').order('created_at', { ascending: false }),
      supabase.from('departments').select('*').order('name')
    ])
    setBorrowers(b || [])
    setDepartments(d || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSave = async (form, isEdit) => {
    if (isEdit) {
      // CRITICAL: Only update profile fields, NEVER touch credit_score or risk_score
      const { error } = await supabase.from('borrowers').update({
        full_name: form.full_name,
        department: form.department,
        tenure_years: parseFloat(form.tenure_years) || 0,
        address: form.address,
        phone: form.phone,
        email: form.email,
        admin_notes: form.admin_notes,
        photo_url: form.photo_url || null,
        building: form.building || '',
        loan_purpose: form.loan_purpose || '',
        updated_at: new Date().toISOString()
        // credit_score and risk_score are intentionally excluded
      }).eq('id', editingBorrower.id)

      if (error) { 
        console.error('Update borrower error:', error)
        toast('Failed to update: ' + error.message, 'error')
        return 
      }
      const editChanges = []
      if (editingBorrower.full_name !== form.full_name) editChanges.push('name')
      if (editingBorrower.department !== form.department) editChanges.push('department')
      if (editingBorrower.phone !== form.phone) editChanges.push('phone')
      if (editingBorrower.email !== form.email) editChanges.push('email')
      if (editingBorrower.admin_notes !== form.admin_notes) editChanges.push('admin notes')
      if (editingBorrower.address !== form.address) editChanges.push('address')
      if (editingBorrower.tenure_years !== form.tenure_years) editChanges.push('tenure')
      if (form.loan_limit && !isNaN(parseFloat(form.loan_limit)) &&
          String(editingBorrower.loan_limit) !== String(form.loan_limit))
        editChanges.push(`loan limit → ₱${parseFloat(form.loan_limit).toLocaleString()}`)
      const changeDesc = editChanges.length > 0 ? ` (changed: ${editChanges.join(', ')})` : ''
      await logAudit({ action_type: 'BORROWER_EDITED', module: 'Borrower', description: `Borrower profile updated: ${form.full_name}${changeDesc}`, changed_by: user?.email })
      toast(`${form.full_name} updated successfully`, 'success')
    } else {
      // New borrower: ALWAYS hardcode credit_score=750, risk_score="Low"
      const { error } = await supabase.from('borrowers').insert({
        full_name: form.full_name,
        department: form.department,
        tenure_years: parseFloat(form.tenure_years) || 0,
        address: form.address,
        phone: form.phone,
        email: form.email,
        admin_notes: form.admin_notes,
        photo_url: form.photo_url || null,
        building: form.building || '',
        loan_purpose: form.loan_purpose || '',
        credit_score: 750,
        risk_score: 'Low',
        loyalty_badge: 'New',
        loan_limit: 5000,
        loan_limit_level: 1
      })
      if (error) { 
        console.error('Add borrower error:', error)
        toast('Failed to add: ' + error.message, 'error')
        return 
      }
      await logAudit({ action_type: 'BORROWER_ADDED', module: 'Borrower', description: `New borrower added: ${form.full_name}`, changed_by: user?.email })
      toast(`${form.full_name} added successfully`, 'success')
    }
    setModalOpen(false)
    setEditingBorrower(null)
    fetchData()
  }

  const handleDelete = async (borrower) => {
    // First delete ALL related records to avoid FK constraint errors
    await supabase.from('loans').delete().eq('borrower_id', borrower.id)
    await supabase.from('payment_proofs').delete().eq('borrower_id', borrower.id)
    await supabase.from('penalty_charges').delete().eq('borrower_id', borrower.id)
    await supabase.from('wallets').delete().eq('borrower_id', borrower.id)
    await supabase.from('wallet_transactions').delete().eq('borrower_id', borrower.id)

    // Now delete the borrower
    const { error } = await supabase.from('borrowers').delete().eq('id', borrower.id)
    if (error) {
      console.error('Delete borrower error:', error)
      toast('Failed to delete: ' + error.message, 'error')
      setDeleteTarget(null)
      return
    }
    await logAudit({ action_type: 'BORROWER_DELETED', module: 'Borrower', description: `Borrower and all related records deleted: ${borrower.full_name}`, changed_by: user?.email })
    toast(`${borrower.full_name} removed`, 'info')
    setDeleteTarget(null)
    // Optimistic update — remove from local state immediately
    setBorrowers(prev => prev.filter(b => b.id !== borrower.id))
  }

  const openAdd = () => { setEditingBorrower(null); setModalOpen(true) }
  const openEdit = (b) => { setEditingBorrower(b); setModalOpen(true) }

  const filtered = borrowers.filter(b =>
    b.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    b.department?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ padding: '32px 28px', maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Borrowers</h1>
          <p className="page-subtitle">{borrowers.length} registered borrower{borrowers.length !== 1 ? 's' : ''}</p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="search-bar">
            <Search size={15} />
            <input placeholder="Search borrowers..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button className="btn-primary" onClick={openAdd}>
            <UserPlus size={16} /> Add Borrower
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14, marginBottom: 28 }}>
        {[
          { label: 'Total', value: borrowers.length, color: 'var(--blue)' },
          { label: 'Low Risk', value: borrowers.filter(b => b.risk_score === 'Low').length, color: 'var(--green)' },
          { label: 'Medium Risk', value: borrowers.filter(b => b.risk_score === 'Medium').length, color: 'var(--gold)' },
          { label: 'High Risk', value: borrowers.filter(b => b.risk_score === 'High').length, color: 'var(--red)' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '14px 18px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 24, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Borrower cards */}
      {loading ? (
        <div className="empty-state"><p>Loading borrowers...</p></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <Users size={48} />
          <h3>{search ? 'No results found' : 'No borrowers yet'}</h3>
          <p style={{ marginBottom: 20 }}>{search ? 'Try a different search term' : 'Add your first borrower to get started'}</p>
          {!search && <button className="btn-primary" onClick={openAdd}><UserPlus size={16} /> Add First Borrower</button>}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {filtered.map(b => (
            <BorrowerCard
              key={b.id}
              borrower={b}
              departments={departments}
              onEdit={openEdit}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <BorrowerModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditingBorrower(null) }}
        onSave={handleSave}
        borrower={editingBorrower}
        departments={departments}
      />

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: 400, padding: 28 }}>
            <h2 style={{ fontFamily: 'Space Grotesk', fontSize: 18, marginBottom: 10 }}>Delete Borrower?</h2>
            <p style={{ color: 'var(--text-label)', fontSize: 14, marginBottom: 6 }}>
              Are you sure you want to remove <strong style={{ color: 'var(--text-primary)' }}>{deleteTarget.full_name}</strong>?
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 24 }}>
              This cannot be undone. Borrowers with active loans cannot be deleted.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn-cancel" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn-delete" onClick={() => handleDelete(deleteTarget)}>
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
