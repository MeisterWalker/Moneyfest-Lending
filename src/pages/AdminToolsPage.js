import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { CREDIT_CONFIG, getBadgeStatus, calcSecurityHold } from '../lib/creditSystem'
import { logAudit, formatCurrency, formatDate } from '../lib/helpers'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'
import {
  Wrench, Target, FileText, HeartPulse, Search, Save, Check, AlertTriangle,
  ChevronDown, ChevronUp, RefreshCw, Shield, Zap, CheckCircle, XCircle, User
} from 'lucide-react'

// ─── Tool Tab Button ──────────────────────────────────────────
function ToolTab({ icon: Icon, label, active, color, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px', borderRadius: 12,
      border: active ? `1px solid ${color}40` : '1px solid var(--card-border)',
      background: active ? `${color}12` : 'rgba(255,255,255,0.02)',
      color: active ? color : 'var(--text-label)', cursor: 'pointer',
      fontSize: 14, fontWeight: active ? 700 : 500, transition: 'all 0.15s ease', width: '100%',
      textAlign: 'left'
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: active ? `${color}20` : 'rgba(255,255,255,0.04)',
        border: `1px solid ${active ? color + '30' : 'var(--card-border)'}`
      }}>
        <Icon size={17} color={active ? color : 'var(--text-muted)'} />
      </div>
      {label}
    </button>
  )
}

// ─── Section Wrapper ──────────────────────────────────────────
function Section({ icon: Icon, title, color = 'var(--blue)', children }) {
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{
        padding: '18px 24px', borderBottom: '1px solid var(--card-border)',
        display: 'flex', alignItems: 'center', gap: 10,
        background: `linear-gradient(135deg, ${color}08, transparent)`
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 9, background: `${color}18`,
          border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <Icon size={17} color={color} />
        </div>
        <span style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 16 }}>{title}</span>
      </div>
      <div style={{ padding: '22px 24px' }}>{children}</div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// 1. CREDIT SCORE OVERRIDE
// ═══════════════════════════════════════════════════════════════
function CreditOverrideTool({ borrowers, fetchData, adminEmail }) {
  const { toast } = useToast()
  const [selectedId, setSelectedId] = useState('')
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({ credit_score: '', risk_score: '', loyalty_badge: '', clean_loans: '', loan_limit: '', loan_limit_level: '' })
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const selected = borrowers.find(b => b.id === selectedId)
  const filtered = borrowers.filter(b => b.full_name?.toLowerCase().includes(search.toLowerCase()))

  const selectBorrower = (b) => {
    setSelectedId(b.id)
    setSearch('')
    setForm({
      credit_score: b.credit_score || 750,
      risk_score: b.risk_score || 'Low',
      loyalty_badge: b.loyalty_badge || 'New',
      clean_loans: b.clean_loans || 0,
      loan_limit: b.loan_limit || 5000,
      loan_limit_level: b.loan_limit_level || 1
    })
    setReason('')
    setSaved(false)
  }

  const autoCalc = (score, cleanLoans) => {
    const badge = getBadgeStatus(parseInt(score) || 750, parseInt(cleanLoans) || 0)
    const risk = CREDIT_CONFIG.riskFromScore(parseInt(score) || 750)
    setForm(f => ({ ...f, credit_score: score, clean_loans: cleanLoans, loyalty_badge: badge, risk_score: risk }))
  }

  const handleSave = async () => {
    if (!selectedId || !reason.trim()) { toast('Select a borrower and enter a reason', 'error'); return }
    setSaving(true)
    const before = { credit_score: selected.credit_score, risk_score: selected.risk_score, loyalty_badge: selected.loyalty_badge, clean_loans: selected.clean_loans, loan_limit: selected.loan_limit }
    const after = { credit_score: parseInt(form.credit_score), risk_score: form.risk_score, loyalty_badge: form.loyalty_badge, clean_loans: parseInt(form.clean_loans) || 0, loan_limit: parseInt(form.loan_limit) || 5000, loan_limit_level: parseInt(form.loan_limit_level) || 1 }

    const { error } = await supabase.from('borrowers').update({
      ...after, updated_at: new Date().toISOString()
    }).eq('id', selectedId)

    if (error) { toast('Failed: ' + error.message, 'error'); setSaving(false); return }

    const changes = Object.keys(after).filter(k => String(before[k]) !== String(after[k])).map(k => `${k}: ${before[k]} → ${after[k]}`).join(', ')
    await logAudit({
      action_type: 'CREDIT_OVERRIDE', module: 'Admin Tools',
      description: `Credit override for ${selected.full_name}: ${changes}. Reason: ${reason}`,
      changed_by: adminEmail
    })
    toast(`${selected.full_name} credit updated successfully`, 'success')
    setSaved(true)
    setSaving(false)
    fetchData()
  }

  const scoreColor = CREDIT_CONFIG.colorFromScore(parseInt(form.credit_score) || 750)

  return (
    <Section icon={Target} title="Credit Score Override" color="#F59E0B">
      {/* Borrower Search */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Select Borrower</label>
        <div style={{ position: 'relative' }}>
          <div className="search-bar" style={{ marginBottom: 0 }}>
            <Search size={15} />
            <input placeholder="Search by name..." value={search} onChange={e => { setSearch(e.target.value); setSelectedId('') }}
              style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 14, width: '100%' }} />
          </div>
          {search && !selectedId && filtered.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 10, maxHeight: 200, overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.4)', marginTop: 4 }}>
              {filtered.slice(0, 8).map(b => (
                <button key={b.id} onClick={() => selectBorrower(b)} style={{
                  width: '100%', padding: '10px 14px', border: 'none', background: 'transparent', cursor: 'pointer',
                  color: 'var(--text-primary)', fontSize: 13, textAlign: 'left', display: 'flex', justifyContent: 'space-between',
                  borderBottom: '1px solid var(--card-border)'
                }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(245,158,11,0.08)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{ fontWeight: 500 }}>{b.full_name}</span>
                  <span style={{ color: CREDIT_CONFIG.colorFromScore(b.credit_score), fontFamily: 'Space Grotesk', fontWeight: 700 }}>{b.credit_score}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Selected Borrower Card */}
      {selected && (
        <div style={{ background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 12, padding: '18px 22px', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 18 }}>{selected.full_name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{selected.department} · {selected.email || 'No email'}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Current Score</div>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 28, color: CREDIT_CONFIG.colorFromScore(selected.credit_score) }}>{selected.credit_score}</div>
            </div>
          </div>

          {/* Current → New comparison */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 12, marginBottom: 18 }}>
            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Current</div>
              {[
                { l: 'Score', v: selected.credit_score, c: CREDIT_CONFIG.colorFromScore(selected.credit_score) },
                { l: 'Badge', v: selected.loyalty_badge },
                { l: 'Risk', v: selected.risk_score },
                { l: 'Clean Loans', v: selected.clean_loans || 0 },
                { l: 'Loan Limit', v: `₱${(selected.loan_limit || 5000).toLocaleString()}` },
              ].map(r => (
                <div key={r.l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '3px 0', color: 'var(--text-label)' }}>
                  <span>{r.l}</span><span style={{ fontWeight: 600, color: r.c || 'var(--text-primary)' }}>{r.v}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)', fontSize: 20 }}>→</div>
            <div style={{ background: `${scoreColor}08`, border: `1px solid ${scoreColor}20`, borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 11, color: scoreColor, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>New Values</div>
              {[
                { l: 'Score', v: form.credit_score, c: scoreColor },
                { l: 'Badge', v: form.loyalty_badge },
                { l: 'Risk', v: form.risk_score },
                { l: 'Clean Loans', v: form.clean_loans },
                { l: 'Loan Limit', v: `₱${parseInt(form.loan_limit || 5000).toLocaleString()}` },
              ].map(r => (
                <div key={r.l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '3px 0', color: 'var(--text-label)' }}>
                  <span>{r.l}</span><span style={{ fontWeight: 700, color: r.c || scoreColor }}>{r.v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Edit Fields */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14, marginBottom: 16 }}>
            <div className="form-group">
              <label className="form-label">Credit Score</label>
              <input type="number" min="300" max="1000" value={form.credit_score}
                onChange={e => autoCalc(e.target.value, form.clean_loans)} />
            </div>
            <div className="form-group">
              <label className="form-label">Clean Loans</label>
              <input type="number" min="0" max="99" value={form.clean_loans}
                onChange={e => autoCalc(form.credit_score, e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Badge</label>
              <select value={form.loyalty_badge} onChange={e => setForm(f => ({ ...f, loyalty_badge: e.target.value }))}>
                {['New', 'Trusted', 'Reliable', 'VIP'].map(b => <option key={b}>{b}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Risk Score</label>
              <select value={form.risk_score} onChange={e => setForm(f => ({ ...f, risk_score: e.target.value }))}>
                {['Low', 'Medium', 'High'].map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Loan Limit (₱)</label>
              <input type="number" min="1000" step="1000" value={form.loan_limit}
                onChange={e => setForm(f => ({ ...f, loan_limit: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Limit Level</label>
              <input type="number" min="1" max="10" value={form.loan_limit_level}
                onChange={e => setForm(f => ({ ...f, loan_limit_level: e.target.value }))} />
            </div>
          </div>

          {/* Reason */}
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label">⚠️ Reason for Override (Required)</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2}
              placeholder="e.g. Completed 2nd loan successfully, adjusted credit to reflect tier..."
              style={{ width: '100%', resize: 'vertical', boxSizing: 'border-box' }} />
          </div>

          <button onClick={handleSave} disabled={saving || !reason.trim()} className="btn-primary" style={{ gap: 8, opacity: !reason.trim() ? 0.5 : 1 }}>
            {saved ? <><Check size={15} /> Saved!</> : saving ? <><RefreshCw size={15} style={{ animation: 'spin 0.6s linear infinite' }} /> Saving...</> : <><Save size={15} /> Apply Credit Override</>}
          </button>
        </div>
      )}

      {!selected && (
        <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)', fontSize: 13 }}>
          <Target size={32} style={{ opacity: 0.3, marginBottom: 8 }} /><br />
          Search and select a borrower to override their credit values
        </div>
      )}
    </Section>
  )
}

// ═══════════════════════════════════════════════════════════════
// 2. LOAN STATUS OVERRIDE
// ═══════════════════════════════════════════════════════════════
function LoanOverrideTool({ loans, borrowers, fetchData, adminEmail }) {
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [form, setForm] = useState({})
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const enriched = loans.map(l => ({ ...l, borrower_name: borrowers.find(b => b.id === l.borrower_id)?.full_name || 'Unknown' }))
  const filtered = enriched.filter(l => l.borrower_name.toLowerCase().includes(search.toLowerCase()) || formatCurrency(l.loan_amount).includes(search))
  const selected = enriched.find(l => l.id === selectedId)

  const selectLoan = (l) => {
    setSelectedId(l.id)
    setSearch('')
    setForm({
      status: l.status, payments_made: l.payments_made || 0,
      remaining_balance: l.remaining_balance || 0,
      security_hold: l.security_hold || 0, security_hold_returned: l.security_hold_returned || false,
      release_date: l.release_date || '', due_date: l.due_date || '',
      current_principal: l.current_principal ?? l.loan_amount,
      extension_fee_charged: l.extension_fee_charged || false,
      interest_baseline_date: l.interest_baseline_date || l.release_date || ''
    })
    setReason('')
    setSaved(false)
  }

  const handleSave = async () => {
    if (!selectedId || !reason.trim()) { toast('Select a loan and enter a reason', 'error'); return }
    setSaving(true)
    const before = { status: selected.status, payments_made: selected.payments_made, remaining_balance: selected.remaining_balance, security_hold: selected.security_hold, security_hold_returned: selected.security_hold_returned }

    const updateData = {
      status: form.status,
      payments_made: parseInt(form.payments_made) || 0,
      remaining_balance: parseFloat(form.remaining_balance) || 0,
      security_hold: parseFloat(form.security_hold) || 0,
      security_hold_returned: form.security_hold_returned,
      release_date: form.release_date || null,
      due_date: form.due_date || null,
      updated_at: new Date().toISOString()
    }
    if (selected.loan_type === 'quickloan') {
      updateData.current_principal = parseFloat(form.current_principal) || 0
      updateData.extension_fee_charged = form.extension_fee_charged
      updateData.interest_baseline_date = form.interest_baseline_date || null
    }

    const { error } = await supabase.from('loans').update(updateData).eq('id', selectedId)
    if (error) { toast('Failed: ' + error.message, 'error'); setSaving(false); return }

    const changes = Object.keys(before).filter(k => String(before[k]) !== String(updateData[k])).map(k => `${k}: ${before[k]} → ${updateData[k]}`).join(', ')
    await logAudit({
      action_type: 'LOAN_OVERRIDE', module: 'Admin Tools',
      description: `Loan override for ${selected.borrower_name} (₱${selected.loan_amount}): ${changes}. Reason: ${reason}`,
      changed_by: adminEmail
    })
    toast(`Loan for ${selected.borrower_name} updated`, 'success')
    setSaved(true); setSaving(false); fetchData()
  }

  const isQL = selected?.loan_type === 'quickloan'
  const statusColors = { Pending: '#6B7280', Active: '#3B82F6', 'Partially Paid': '#8B5CF6', Paid: '#22C55E', Overdue: '#F59E0B', Defaulted: '#EF4444' }

  return (
    <Section icon={FileText} title="Loan Status Override" color="#3B82F6">
      <div style={{ marginBottom: 20 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Select Loan</label>
        <div style={{ position: 'relative' }}>
          <div className="search-bar" style={{ marginBottom: 0 }}>
            <Search size={15} />
            <input placeholder="Search by borrower name..." value={search} onChange={e => { setSearch(e.target.value); setSelectedId('') }}
              style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 14, width: '100%' }} />
          </div>
          {search && !selectedId && filtered.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 10, maxHeight: 220, overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.4)', marginTop: 4 }}>
              {filtered.slice(0, 10).map(l => (
                <button key={l.id} onClick={() => selectLoan(l)} style={{
                  width: '100%', padding: '10px 14px', border: 'none', background: 'transparent', cursor: 'pointer',
                  color: 'var(--text-primary)', fontSize: 13, textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  borderBottom: '1px solid var(--card-border)'
                }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(59,130,246,0.08)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div>
                    <div style={{ fontWeight: 500 }}>{l.borrower_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatCurrency(l.loan_amount)} · {l.loan_type === 'quickloan' ? '⚡ QuickLoan' : 'Installment'}</div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: `${statusColors[l.status] || '#6B7280'}20`, color: statusColors[l.status] || '#6B7280' }}>{l.status}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {selected && (
        <div style={{ background: 'rgba(59,130,246,0.04)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 12, padding: '18px 22px', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 18 }}>{selected.borrower_name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatCurrency(selected.loan_amount)} · {isQL ? '⚡ QuickLoan' : `${selected.num_installments || 4} installments`} · Released {formatDate(selected.release_date)}</div>
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, padding: '4px 14px', borderRadius: 20, background: `${statusColors[selected.status]}20`, color: statusColors[selected.status] }}>{selected.status}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 16 }}>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                {['Pending', 'Active', 'Partially Paid', 'Paid', 'Overdue', 'Defaulted'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Payments Made</label>
              <input type="number" min="0" value={form.payments_made} onChange={e => setForm(f => ({ ...f, payments_made: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Remaining Balance (₱)</label>
              <input type="number" min="0" value={form.remaining_balance} onChange={e => setForm(f => ({ ...f, remaining_balance: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Security Hold (₱)</label>
              <input type="number" min="0" value={form.security_hold} onChange={e => setForm(f => ({ ...f, security_hold: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Hold Returned</label>
              <select value={form.security_hold_returned ? 'true' : 'false'} onChange={e => setForm(f => ({ ...f, security_hold_returned: e.target.value === 'true' }))}>
                <option value="false">No</option>
                <option value="true">Yes</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Release Date</label>
              <input type="date" value={form.release_date} onChange={e => setForm(f => ({ ...f, release_date: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Next Due Date</label>
              <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
            </div>
            {isQL && (
              <>
                <div className="form-group">
                  <label className="form-label">Current Principal (₱)</label>
                  <input type="number" min="0" value={form.current_principal} onChange={e => setForm(f => ({ ...f, current_principal: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Extension Fee Charged</label>
                  <select value={form.extension_fee_charged ? 'true' : 'false'} onChange={e => setForm(f => ({ ...f, extension_fee_charged: e.target.value === 'true' }))}>
                    <option value="false">No</option>
                    <option value="true">Yes</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Interest Baseline Date</label>
                  <input type="date" value={form.interest_baseline_date || ''} onChange={e => setForm(f => ({ ...f, interest_baseline_date: e.target.value }))} />
                </div>
              </>
            )}
          </div>

          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label">⚠️ Reason for Override (Required)</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2}
              placeholder="e.g. Payment was received but status didn't auto-update..."
              style={{ width: '100%', resize: 'vertical', boxSizing: 'border-box' }} />
          </div>

          <button onClick={handleSave} disabled={saving || !reason.trim()} className="btn-primary" style={{ gap: 8, opacity: !reason.trim() ? 0.5 : 1 }}>
            {saved ? <><Check size={15} /> Saved!</> : saving ? <><RefreshCw size={15} style={{ animation: 'spin 0.6s linear infinite' }} /> Saving...</> : <><Save size={15} /> Apply Loan Override</>}
          </button>
        </div>
      )}

      {!selected && (
        <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)', fontSize: 13 }}>
          <FileText size={32} style={{ opacity: 0.3, marginBottom: 8 }} /><br />
          Search and select a loan to override its status and values
        </div>
      )}
    </Section>
  )
}

// ═══════════════════════════════════════════════════════════════
// 3. DATA HEALTH CHECK
// ═══════════════════════════════════════════════════════════════
function DataHealthTool({ borrowers, loans, fetchData, adminEmail }) {
  const { toast } = useToast()
  const [issues, setIssues] = useState(null)
  const [scanning, setScanning] = useState(false)
  const [fixing, setFixing] = useState({})

  const runScan = async () => {
    setScanning(true)
    const found = []

    // 1. Loans marked Active/Partially Paid but fully paid
    loans.filter(l => ['Active', 'Partially Paid'].includes(l.status) && l.loan_type !== 'quickloan')
      .filter(l => (l.payments_made || 0) >= (l.num_installments || 4))
      .forEach(l => {
        const b = borrowers.find(x => x.id === l.borrower_id)
        found.push({ id: `paid-${l.id}`, type: 'status_mismatch', severity: 'high', icon: '🔴',
          title: `${b?.full_name || 'Unknown'} — Loan should be "Paid"`,
          detail: `Status is "${l.status}" but ${l.payments_made}/${l.num_installments || 4} installments completed`,
          fix: async () => {
            await supabase.from('loans').update({ status: 'Paid', remaining_balance: 0, updated_at: new Date().toISOString() }).eq('id', l.id)
            await logAudit({ action_type: 'HEALTH_FIX', module: 'Admin Tools', description: `Auto-fixed loan status to Paid for ${b?.full_name}`, changed_by: adminEmail })
          }
        })
      })

    // 2. Credit score out of range
    borrowers.filter(b => b.credit_score < 300 || b.credit_score > 1000)
      .forEach(b => {
        const clamped = Math.max(300, Math.min(1000, b.credit_score))
        found.push({ id: `score-${b.id}`, type: 'score_anomaly', severity: 'medium', icon: '🟡',
          title: `${b.full_name} — Credit score out of range (${b.credit_score})`,
          detail: `Valid range is 300–1000. Will clamp to ${clamped}`,
          fix: async () => {
            await supabase.from('borrowers').update({ credit_score: clamped, updated_at: new Date().toISOString() }).eq('id', b.id)
            await logAudit({ action_type: 'HEALTH_FIX', module: 'Admin Tools', description: `Clamped credit score from ${b.credit_score} to ${clamped} for ${b.full_name}`, changed_by: adminEmail })
          }
        })
      })

    // 3. Badge not matching score + clean_loans
    borrowers.forEach(b => {
      const expected = getBadgeStatus(b.credit_score || 750, b.clean_loans || 0)
      if (b.loyalty_badge !== expected) {
        found.push({ id: `badge-${b.id}`, type: 'badge_mismatch', severity: 'medium', icon: '🟡',
          title: `${b.full_name} — Badge mismatch`,
          detail: `Current: "${b.loyalty_badge}" → Expected: "${expected}" (score: ${b.credit_score}, clean loans: ${b.clean_loans || 0})`,
          fix: async () => {
            await supabase.from('borrowers').update({ loyalty_badge: expected, updated_at: new Date().toISOString() }).eq('id', b.id)
            await logAudit({ action_type: 'HEALTH_FIX', module: 'Admin Tools', description: `Fixed badge from ${b.loyalty_badge} to ${expected} for ${b.full_name}`, changed_by: adminEmail })
          }
        })
      }
    })

    // 4. Risk not matching score
    borrowers.forEach(b => {
      const expected = CREDIT_CONFIG.riskFromScore(b.credit_score || 750)
      if (b.risk_score !== expected) {
        found.push({ id: `risk-${b.id}`, type: 'risk_mismatch', severity: 'low', icon: '🔵',
          title: `${b.full_name} — Risk score mismatch`,
          detail: `Current: "${b.risk_score}" → Expected: "${expected}" (credit: ${b.credit_score})`,
          fix: async () => {
            await supabase.from('borrowers').update({ risk_score: expected, updated_at: new Date().toISOString() }).eq('id', b.id)
            await logAudit({ action_type: 'HEALTH_FIX', module: 'Admin Tools', description: `Fixed risk from ${b.risk_score} to ${expected} for ${b.full_name}`, changed_by: adminEmail })
          }
        })
      }
    })

    // 5. Duplicate access codes
    const codes = {}
    borrowers.forEach(b => { if (b.access_code) { codes[b.access_code] = codes[b.access_code] || []; codes[b.access_code].push(b) } })
    Object.entries(codes).filter(([, arr]) => arr.length > 1).forEach(([code, arr]) => {
      found.push({ id: `dup-${code}`, type: 'duplicate_code', severity: 'high', icon: '🔴',
        title: `Duplicate access code: ${code}`,
        detail: `Shared by: ${arr.map(b => b.full_name).join(', ')}. Will regenerate for all but the first.`,
        fix: async () => {
          for (let i = 1; i < arr.length; i++) {
            const newCode = Math.random().toString(36).substring(2, 9).toUpperCase()
            await supabase.from('borrowers').update({ access_code: newCode }).eq('id', arr[i].id)
            await logAudit({ action_type: 'HEALTH_FIX', module: 'Admin Tools', description: `Regenerated duplicate access code for ${arr[i].full_name}: ${code} → ${newCode}`, changed_by: adminEmail })
          }
        }
      })
    })

    // 6. Missing access codes
    const noCode = borrowers.filter(b => !b.access_code)
    if (noCode.length > 0) {
      found.push({ id: 'missing-codes', type: 'missing_code', severity: 'medium', icon: '🟡',
        title: `${noCode.length} borrower${noCode.length > 1 ? 's' : ''} missing access code`,
        detail: noCode.map(b => b.full_name).join(', '),
        fix: async () => {
          for (const b of noCode) {
            const code = Math.random().toString(36).substring(2, 9).toUpperCase()
            await supabase.from('borrowers').update({ access_code: code }).eq('id', b.id)
          }
          await logAudit({ action_type: 'HEALTH_FIX', module: 'Admin Tools', description: `Generated access codes for ${noCode.length} borrowers`, changed_by: adminEmail })
        }
      })
    }

    // 7. Stale pending loans (> 7 days)
    const now = new Date()
    loans.filter(l => l.status === 'Pending').filter(l => {
      const created = new Date(l.created_at)
      return (now - created) / (1000 * 60 * 60 * 24) > 7
    }).forEach(l => {
      const b = borrowers.find(x => x.id === l.borrower_id)
      const days = Math.floor((now - new Date(l.created_at)) / (1000 * 60 * 60 * 24))
      found.push({ id: `stale-${l.id}`, type: 'stale_pending', severity: 'low', icon: '🔵',
        title: `${b?.full_name || 'Unknown'} — Stale pending loan (${days} days)`,
        detail: `Loan of ${formatCurrency(l.loan_amount)} created ${formatDate(l.created_at)} still pending`,
        fix: null // No auto-fix — manual review needed
      })
    })

    // 8. QuickLoans missing current_principal
    loans.filter(l => l.loan_type === 'quickloan' && l.release_date && l.current_principal == null && l.status !== 'Paid')
      .forEach(l => {
        const b = borrowers.find(x => x.id === l.borrower_id)
        found.push({ id: `qlp-${l.id}`, type: 'ql_missing_principal', severity: 'medium', icon: '🟡',
          title: `${b?.full_name || 'Unknown'} — QuickLoan missing current_principal`,
          detail: `Will backfill to loan_amount (₱${l.loan_amount}) and set interest_baseline_date to release_date`,
          fix: async () => {
            await supabase.from('loans').update({ current_principal: l.loan_amount, interest_baseline_date: l.release_date }).eq('id', l.id)
            await logAudit({ action_type: 'HEALTH_FIX', module: 'Admin Tools', description: `Backfilled QuickLoan principal for ${b?.full_name}`, changed_by: adminEmail })
          }
        })
      })

    // Sort: high first
    const order = { high: 0, medium: 1, low: 2 }
    found.sort((a, b) => order[a.severity] - order[b.severity])
    setIssues(found)
    setScanning(false)
  }

  const handleFix = async (issue) => {
    if (!issue.fix) return
    setFixing(f => ({ ...f, [issue.id]: true }))
    try {
      await issue.fix()
      toast(`Fixed: ${issue.title}`, 'success')
      setIssues(prev => prev.filter(i => i.id !== issue.id))
      fetchData()
    } catch (err) {
      toast('Fix failed: ' + err.message, 'error')
    }
    setFixing(f => ({ ...f, [issue.id]: false }))
  }

  const handleFixAll = async () => {
    const fixable = (issues || []).filter(i => i.fix)
    if (fixable.length === 0) return
    if (!window.confirm(`Fix all ${fixable.length} auto-fixable issues?`)) return
    for (const issue of fixable) { await handleFix(issue) }
  }

  const high = (issues || []).filter(i => i.severity === 'high').length
  const medium = (issues || []).filter(i => i.severity === 'medium').length
  const low = (issues || []).filter(i => i.severity === 'low').length

  return (
    <Section icon={HeartPulse} title="Data Health Check" color="#10B981">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: 'var(--text-label)' }}>
          Scan your database for inconsistencies, mismatches, and missing data. One-click fixes available.
        </div>
        <button onClick={runScan} disabled={scanning} className="btn-primary" style={{ gap: 8, whiteSpace: 'nowrap' }}>
          {scanning ? <><RefreshCw size={15} style={{ animation: 'spin 0.6s linear infinite' }} /> Scanning...</> : <><HeartPulse size={15} /> Run Scan</>}
        </button>
      </div>

      {issues !== null && (
        <>
          {/* Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Total Issues', value: issues.length, color: issues.length === 0 ? 'var(--green)' : 'var(--text-primary)' },
              { label: 'Critical', value: high, color: high > 0 ? '#EF4444' : 'var(--green)' },
              { label: 'Medium', value: medium, color: medium > 0 ? '#F59E0B' : 'var(--green)' },
              { label: 'Low', value: low, color: low > 0 ? '#3B82F6' : 'var(--green)' },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid var(--card-border)' }}>
                <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 24, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {issues.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--green)' }}>
              <CheckCircle size={40} style={{ marginBottom: 8 }} />
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 18, marginBottom: 4 }}>All Clear!</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No data integrity issues found. Your database is healthy.</div>
            </div>
          ) : (
            <>
              {issues.filter(i => i.fix).length > 1 && (
                <button onClick={handleFixAll} style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 10, border: '1px solid rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.08)', color: '#10B981', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
                  <Zap size={15} /> Fix All ({issues.filter(i => i.fix).length} auto-fixable)
                </button>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {issues.map(issue => (
                  <div key={issue.id} style={{
                    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14,
                    padding: '14px 18px', borderRadius: 10,
                    background: issue.severity === 'high' ? 'rgba(239,68,68,0.04)' : issue.severity === 'medium' ? 'rgba(245,158,11,0.04)' : 'rgba(59,130,246,0.04)',
                    border: `1px solid ${issue.severity === 'high' ? 'rgba(239,68,68,0.15)' : issue.severity === 'medium' ? 'rgba(245,158,11,0.15)' : 'rgba(59,130,246,0.15)'}`
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>{issue.icon} {issue.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{issue.detail}</div>
                    </div>
                    {issue.fix ? (
                      <button onClick={() => handleFix(issue)} disabled={fixing[issue.id]}
                        style={{ flexShrink: 0, padding: '6px 14px', borderRadius: 8, border: 'none', background: 'var(--green)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        {fixing[issue.id] ? '...' : '✅ Fix'}
                      </button>
                    ) : (
                      <span style={{ flexShrink: 0, padding: '6px 14px', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Manual review</span>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {issues === null && !scanning && (
        <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)', fontSize: 13 }}>
          <HeartPulse size={32} style={{ opacity: 0.3, marginBottom: 8 }} /><br />
          Click "Run Scan" to check your database health
        </div>
      )}
    </Section>
  )
}

// ═══════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════
export default function AdminToolsPage() {
  const { user } = useAuth()
  const [borrowers, setBorrowers] = useState([])
  const [loans, setLoans] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('credit')

  const fetchData = useCallback(async () => {
    const [{ data: b }, { data: l }] = await Promise.all([
      supabase.from('borrowers').select('*').order('full_name'),
      supabase.from('loans').select('*').order('created_at', { ascending: false })
    ])
    setBorrowers(b || [])
    setLoans(l || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) return (
    <div style={{ padding: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Loading admin tools...</div>
    </div>
  )

  return (
    <div style={{ padding: '32px 28px', maxWidth: 1100, margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">🛠️ Admin Tools</h1>
          <p className="page-subtitle">Power tools to manage your data without the SQL editor</p>
        </div>
      </div>

      {/* Tool Tabs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 28 }}>
        <ToolTab icon={Target} label="Credit Override" active={activeTab === 'credit'} color="#F59E0B" onClick={() => setActiveTab('credit')} />
        <ToolTab icon={FileText} label="Loan Override" active={activeTab === 'loan'} color="#3B82F6" onClick={() => setActiveTab('loan')} />
        <ToolTab icon={HeartPulse} label="Health Check" active={activeTab === 'health'} color="#10B981" onClick={() => setActiveTab('health')} />
      </div>

      {/* Active Tool */}
      {activeTab === 'credit' && <CreditOverrideTool borrowers={borrowers} fetchData={fetchData} adminEmail={user?.email} />}
      {activeTab === 'loan' && <LoanOverrideTool loans={loans} borrowers={borrowers} fetchData={fetchData} adminEmail={user?.email} />}
      {activeTab === 'health' && <DataHealthTool borrowers={borrowers} loans={loans} fetchData={fetchData} adminEmail={user?.email} />}
    </div>
  )
}
