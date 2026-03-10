import { useState, useEffect } from 'react'
import { X, Phone, Users } from 'lucide-react'
import { BorrowerAvatarUpload } from './BorrowerAvatar'

const RELATIONSHIPS = ['Spouse', 'Parent', 'Sibling', 'Child', 'Friend', 'Colleague', 'Other']

export default function BorrowerModal({ isOpen, onClose, onSave, borrower, departments }) {
  const isEdit = !!borrower
  const [form, setForm] = useState({
    full_name: '', department: '', tenure_years: '',
    address: '', phone: '', email: '',
    trustee_name: '', trustee_phone: '', trustee_relationship: '',
    admin_notes: '', photo_url: ''
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    if (borrower) {
      setForm({
        full_name: borrower.full_name || '',
        department: borrower.department || '',
        tenure_years: borrower.tenure_years || '',
        address: borrower.address || '',
        phone: borrower.phone || '',
        email: borrower.email || '',
        trustee_name: borrower.trustee_name || '',
        trustee_phone: borrower.trustee_phone || '',
        trustee_relationship: borrower.trustee_relationship || '',
        admin_notes: borrower.admin_notes || '',
        photo_url: borrower.photo_url || ''
      })
    } else {
      setForm({
        full_name: '', department_id: departments[0]?.id || '',
        tenure_years: '', address: '', phone: '', email: '',
        trustee_name: '', trustee_phone: '', trustee_relationship: '',
        admin_notes: '', photo_url: ''
      })
    }
  }, [borrower, departments, isOpen])

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const handleSave = async () => {
    if (!form.full_name.trim()) return alert('Full name is required')
    if (!form.department) return alert('Please select a department')
    setSaving(true)
    await onSave(form, isEdit)
    setSaving(false)
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 620 }}>
        {/* Header */}
        <div style={{ padding: '24px 28px 20px', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontFamily: 'Space Grotesk', fontSize: 18, fontWeight: 700 }}>
              {isEdit ? 'Edit Borrower' : 'Add New Borrower'}
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
              {isEdit ? 'Update borrower information' : 'New borrower starts at credit score 750'}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Avatar upload + name row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <BorrowerAvatarUpload
              name={form.full_name || '?'}
              photoUrl={form.photo_url}
              onPhotoChange={url => set('photo_url', url || '')}
            />
            <div style={{ flex: 1 }}>
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input placeholder="e.g. Maria Santos" value={form.full_name} onChange={e => set('full_name', e.target.value)} />
              </div>
            </div>
          </div>

          {/* Department + Tenure */}
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Department *</label>
              <select value={form.department} onChange={e => set('department', e.target.value)}>
                <option value="">Select department</option>
                {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Employment Tenure (years)</label>
              <input type="number" step="0.1" min="0" placeholder="e.g. 2.5" value={form.tenure_years} onChange={e => set('tenure_years', e.target.value)} />
            </div>
          </div>

          {/* Contact */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Phone size={15} color="var(--purple)" />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-label)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Contact Info</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Address</label>
                <input placeholder="e.g. 123 Rizal St, Cebu City" value={form.address} onChange={e => set('address', e.target.value)} />
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input placeholder="e.g. 09171234567" value={form.phone} onChange={e => set('phone', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input type="email" placeholder="email@example.com" value={form.email} onChange={e => set('email', e.target.value)} />
                </div>
              </div>
            </div>
          </div>

          {/* Trustee */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Users size={15} color="var(--teal)" />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-label)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Trustee / Emergency Contact</span>
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Trustee Full Name</label>
                <input placeholder="e.g. James Santos" value={form.trustee_name} onChange={e => set('trustee_name', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Trustee Phone</label>
                <input placeholder="e.g. 09189876543" value={form.trustee_phone} onChange={e => set('trustee_phone', e.target.value)} />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Relationship</label>
                <select value={form.trustee_relationship} onChange={e => set('trustee_relationship', e.target.value)}>
                  <option value="">Select relationship</option>
                  {RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Admin Notes */}
          <div className="form-group">
            <label className="form-label">📝 Admin Notes (Private)</label>
            <textarea
              rows={3}
              placeholder="Private remarks visible only to admin..."
              value={form.admin_notes}
              onChange={e => e.target.value.length <= 500 && set('admin_notes', e.target.value)}
              style={{ resize: 'vertical' }}
            />
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right' }}>{form.admin_notes.length}/500</div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 28px 24px', borderTop: '1px solid var(--card-border)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} className="btn-cancel">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Borrower'}
          </button>
        </div>
      </div>
    </div>
  )
}
