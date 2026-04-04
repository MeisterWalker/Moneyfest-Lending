import { useState, useEffect, useCallback, useRef } from 'react'
import { CREDIT_CONFIG, BADGE_TIERS, SECURITY_HOLD_TIERS, getBadgeConfig, getBadgeFromScore, getSecurityHoldRate } from '../lib/creditSystem'
import { supabase } from '../lib/supabase'
import { usePageVisit } from '../hooks/usePageVisit'
import { getInstallmentDates, formatDateValue, logAudit } from '../lib/helpers'
import { generateBorrowerReceiptPDF, generateBorrowerLoanAgreementPDF, generateBorrowerQuickLoanPDF } from '../lib/pdfGenerator'
import { sendLoanAgreementSignedAdminEmail } from '../lib/emailService'
import {
  Lock, CheckCircle, Clock, AlertCircle, Upload,
  FileText, Calendar, CreditCard, User, Wallet, ChevronDown, ChevronUp, X, Home
} from 'lucide-react'

function formatDate(str) {
  if (!str) return "—"
  const [y, m, d] = str.split('-')
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })
}

function getDueDates(releaseDate, paymentsMade, numInstallments = 4) {
  if (!releaseDate) return []
  const dates = getInstallmentDates(releaseDate, numInstallments)
  return dates.map((cutoff, idx) => {
    const i = idx + 1
    return {
      num: i,
      date: cutoff,
      dateStr: cutoff.getFullYear() + '-' + String(cutoff.getMonth() + 1).padStart(2, '0') + '-' + String(cutoff.getDate()).padStart(2, '0'),
      paid: i <= paymentsMade,
      current: i === paymentsMade + 1
    }
  })
}

function StatusBadge({ status }) {
  const map = {
    Active: { bg: 'rgba(59,130,246,0.15)', color: '#3B82F6', label: 'Active' },
    'Partially Paid': { bg: 'rgba(245,158,11,0.15)', color: '#F59E0B', label: 'Partially Paid' },
    Paid: { bg: 'rgba(34,197,94,0.15)', color: '#22C55E', label: 'Fully Paid' },
    Pending: { bg: 'rgba(139,92,246,0.15)', color: '#8B5CF6', label: 'Pending Release' },
    Overdue: { bg: 'rgba(239,68,68,0.15)', color: '#EF4444', label: 'Overdue' },
    Defaulted: { bg: 'rgba(239,68,68,0.15)', color: '#EF4444', label: 'Defaulted' },
  }
  const s = map[status] || map.Pending
  return (
    <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.color}40`, borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
      {s.label}
    </span>
  )
}

function UploadModal({ installmentNum, loan, borrower, onClose, onUploaded, qlPaymentType }) {
  const [file, setFile] = useState(null)
  const defaultNote = qlPaymentType === 'interest_only'
    ? '[INTEREST ONLY — Day 15] Paying accrued 15-day interest + ₱100 extension fee. Principal rolls to Day 30.'
    : qlPaymentType === 'full_payoff'
    ? '[FULL PAY-OFF] Settling full outstanding balance (principal + all accrued interest).'
    : ''
  const [notes, setNotes] = useState(defaultNote)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const isQL = !!qlPaymentType
  const accentColor = qlPaymentType === 'full_payoff' ? '#22C55E' : qlPaymentType === 'interest_only' ? '#F59E0B' : '#22C55E'

  const handleUpload = async () => {
    if (!file) { setError('Please select a file'); return }
    if (file.size > 5 * 1024 * 1024) { setError('File must be under 5MB'); return }
    const { data: existing } = await supabase.from('payment_proofs').select('id').eq('loan_id', loan.id).eq('installment_number', installmentNum).eq('status', 'Pending').single()
    if (existing) { setError('A proof is already pending review for this installment.'); return }
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `${borrower.access_code}/${Date.now()}-installment${installmentNum}.${ext}`
    const { error: upErr } = await supabase.storage.from('payment-proofs').upload(path, file, { upsert: false })
    if (upErr) { setError('Upload failed: ' + upErr.message); setUploading(false); return }
    const { error: dbErr } = await supabase.from('payment_proofs').insert({
      borrower_id: borrower.id, loan_id: loan.id,
      installment_number: installmentNum, file_path: path,
      file_name: file.name, notes: notes.trim() || null, status: 'Pending'
    })
    if (dbErr) { setError('Failed to save proof: ' + dbErr.message); setUploading(false); return }
    await supabase.from('portal_notifications').insert({
      borrower_id: borrower.id, type: 'payment_submitted',
      title: '✅ Proof Submitted',
      message: isQL
        ? (qlPaymentType === 'interest_only'
            ? 'Your Day 15 interest payment proof has been submitted and is awaiting admin review.'
            : 'Your QuickLoan full pay-off proof has been submitted and is awaiting admin review.')
        : `Your payment proof for installment ${installmentNum} has been submitted and is awaiting admin review.`
    })
    setUploading(false)
    onUploaded()
  }

  const typeLabel = qlPaymentType === 'full_payoff'
    ? '⚡ Full Pay-Off'
    : qlPaymentType === 'interest_only'
    ? '📅 Interest Only (Day 15)'
    : `Installment ${installmentNum}`

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 440, background: '#0E1320', border: `1px solid ${accentColor}30`, borderRadius: 20, overflow: 'hidden', boxShadow: '0 40px 80px rgba(0,0,0,0.6)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 16, color: '#F0F4FF' }}>Upload Payment Proof</div>
            <div style={{ fontSize: 12, color: accentColor, marginTop: 2, fontWeight: 700 }}>{typeLabel}</div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#7A8AAA', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
        <div style={{ padding: 24 }}>
          {isQL && (
            <div style={{ marginBottom: 14, padding: '10px 14px', background: qlPaymentType === 'full_payoff' ? 'rgba(34,197,94,0.06)' : 'rgba(245,158,11,0.06)', border: `1px solid ${accentColor}30`, borderRadius: 10, fontSize: 12, color: accentColor, lineHeight: 1.6 }}>
              {qlPaymentType === 'full_payoff'
                ? '💚 Upload proof of your full balance payment (principal + all accrued interest). Admin will mark your loan as fully paid.'
                : '⚠️ Upload proof of your 15-day interest + ₱100 extension fee payment. Your principal rolls over to Day 30.'}
            </div>
          )}
          
          {/* Admin Payment Details Box */}
          <div style={{ padding: '14px', background: 'rgba(59,130,246,0.06)', borderRadius: 12, border: '1px solid rgba(59,130,246,0.15)', marginBottom: 14, textAlign: 'left' }}>
            <div style={{ fontSize: 11, color: '#3B82F6', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Send Payment To</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <img src="/gcash-logo.png" alt="GCash" style={{ width: 24, height: 24, objectFit: 'contain' }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#F0F4FF' }}>GCash</div>
                    <div style={{ fontSize: 10, color: '#7A8AAA' }}>Charlou June Ramil</div>
                  </div>
                </div>
                <div style={{ fontSize: 13, fontFamily: 'Space Grotesk, sans-serif', fontWeight: 800, color: '#60A5FA' }}>09665835179</div>
              </div>
            </div>
          </div>
          <label style={{
            display: 'block', border: `2px dashed ${file ? accentColor : 'rgba(255,255,255,0.1)'}`,
            borderRadius: 14, padding: '28px 20px', textAlign: 'center', cursor: 'pointer',
            background: file ? `${accentColor}08` : 'rgba(255,255,255,0.02)', marginBottom: 14, transition: 'all 0.2s'
          }}>
            <input type="file" accept="image/*,.pdf" onChange={e => setFile(e.target.files[0])} style={{ display: 'none' }} />
            <div style={{ fontSize: 28, marginBottom: 8 }}>{file ? '✅' : '📎'}</div>
            <div style={{ fontSize: 13, color: file ? accentColor : '#7A8AAA', fontWeight: 600 }}>
              {file ? file.name : 'Click to select screenshot or PDF'}
            </div>
            <div style={{ fontSize: 11, color: '#4B5580', marginTop: 4 }}>JPG, PNG, PDF · Max 5MB</div>
          </label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional note for admin..." rows={2}
            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, color: '#F0F4FF', fontSize: 13, resize: 'none', outline: 'none', fontFamily: 'DM Sans, sans-serif', marginBottom: 14 }} />
          {error && <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, fontSize: 13, color: '#EF4444', marginBottom: 14 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: '#7A8AAA', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleUpload} disabled={uploading || !file}
              style={{ flex: 2, padding: '12px', borderRadius: 10, border: 'none', background: uploading ? `${accentColor}50` : `linear-gradient(135deg,${accentColor},${accentColor}CC)`, color: qlPaymentType === 'interest_only' ? '#000' : '#fff', fontSize: 13, fontWeight: 700, cursor: uploading ? 'not-allowed' : 'pointer', fontFamily: 'Syne, sans-serif' }}>
              {uploading ? 'Uploading...' : '⬆ Submit Proof'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Principal Payment Modal ────────────────────────────────────
function PrincipalPaymentModal({ loan, borrower, onClose, onUploaded }) {
  const [file, setFile] = useState(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  // Live calculations
  const principal = parseFloat(loan.current_principal ?? loan.loan_amount) || 0
  const baselineDate = loan.interest_baseline_date || loan.release_date
  const daysForInterest = (() => {
    if (!baselineDate) return 0
    const [y, m, d] = baselineDate.split('-').map(Number)
    const base = new Date(y, m - 1, d)
    const today = new Date(); today.setHours(0, 0, 0, 0)
    return Math.max(0, Math.floor((today - base) / 86400000))
  })()
  const dailyRate = 0.1 / 30
  const accruedInterest = parseFloat((principal * dailyRate * daysForInterest).toFixed(2))
  const dailyInterest = parseFloat((principal * dailyRate).toFixed(2))

  const amount = parseFloat(paymentAmount) || 0
  const interestPortion = Math.min(amount, accruedInterest)
  const principalPortion = Math.max(0, amount - accruedInterest)
  const principalAfter = Math.max(0, principal - principalPortion)
  const isFullPayoff = principalAfter <= 0

  const isValid = amount > accruedInterest && file

  const handleSubmit = async () => {
    if (!file) { setError('Please attach proof of payment'); return }
    if (amount <= 0) { setError('Please enter a valid payment amount'); return }
    if (amount <= accruedInterest) {
      setError(`Payment must be more than ₱${accruedInterest.toFixed(2)} to cover accrued interest first`)
      return
    }
    if (file.size > 5 * 1024 * 1024) { setError('File must be under 5MB'); return }

    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `principal-payments/${borrower.access_code}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('payment-proofs').upload(path, file, { upsert: false })
      if (upErr) { setError('Upload failed: ' + upErr.message); setUploading(false); return }
      const { error: dbErr } = await supabase.from('principal_payments').insert({
        loan_id: loan.id,
        borrower_id: borrower.id,
        payment_amount: amount,
        interest_portion: accruedInterest,
        principal_portion: principalPortion,
        principal_before: principal,
        principal_after: principalAfter,
        days_elapsed: daysForInterest,
        accrued_interest: accruedInterest,
        file_path: path,
        file_name: file.name,
        notes: notes.trim() || null,
        status: 'Pending'
      })
      if (dbErr) { setError('Failed to save: ' + dbErr.message); setUploading(false); return }

      await supabase.from('portal_notifications').insert({
        borrower_id: borrower.id,
        type: 'principal_payment_submitted',
        title: '💳 Principal Payment Submitted',
        message: `Your principal payment of ₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })} has been submitted for admin review. This covers ₱${accruedInterest.toFixed(2)} in accrued interest and reduces your principal by ₱${principalPortion.toFixed(2)}.`
      })
      onUploaded()
    } catch (e) {
      setError('Unexpected error: ' + e.message)
      setUploading(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(14px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 480, background: '#0A0F1E', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 22, overflow: 'hidden', boxShadow: '0 50px 100px rgba(0,0,0,0.7)' }}>

        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'linear-gradient(135deg,rgba(99,102,241,0.1),rgba(139,92,246,0.08))', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 16, color: '#F0F4FF' }}>💳 Pay Towards Principal</div>
            <div style={{ fontSize: 12, color: '#a78bfa', marginTop: 2, fontWeight: 600 }}>Reduce your principal balance anytime</div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#7A8AAA', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        <div style={{ padding: 24 }}>
          {/* How it works */}
          <div style={{ marginBottom: 18, padding: '12px 14px', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 12, fontSize: 12, color: '#a78bfa', lineHeight: 1.7 }}>
            <strong style={{ color: '#F0F4FF', display: 'block', marginBottom: 4 }}>How this works</strong>
            Your payment first covers <strong style={{ color: '#F59E0B' }}>accrued interest</strong> to date, then the remainder reduces your <strong style={{ color: '#22C55E' }}>principal</strong>. Daily interest recalculates on the lower principal going forward.
          </div>

          {/* Live balance snapshot */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
            {[
              { label: 'Current Principal', value: `₱${principal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`, color: '#F0F4FF' },
              { label: `Accrued Interest (${daysForInterest}d)`, value: `₱${accruedInterest.toFixed(2)}`, color: '#F59E0B' },
              { label: 'Daily Interest Rate', value: `₱${dailyInterest.toFixed(2)}/day`, color: '#60A5FA' },
              { label: 'Min. Payment Required', value: `> ₱${accruedInterest.toFixed(2)}`, color: '#EF4444' },
            ].map((item, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ fontSize: 10, color: '#4B5580', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4, fontWeight: 700 }}>{item.label}</div>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 14, color: item.color }}>{item.value}</div>
              </div>
            ))}
          </div>

          {/* Amount Input */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 11, color: '#4B5580', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6, fontWeight: 700 }}>Payment Amount (₱)</label>
            <input
              type="number"
              value={paymentAmount}
              onChange={e => setPaymentAmount(e.target.value)}
              placeholder={`Enter amount (min ₱${(accruedInterest + 1).toFixed(2)})`}
              style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', background: 'rgba(255,255,255,0.05)', border: `1px solid ${amount > accruedInterest && amount > 0 ? 'rgba(34,197,94,0.4)' : amount > 0 && amount <= accruedInterest ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.1)'}`, borderRadius: 10, color: '#F0F4FF', fontSize: 15, fontWeight: 700, outline: 'none', fontFamily: 'Syne, sans-serif' }}
            />
          </div>

          {/* Live breakdown */}
          {amount > 0 && (
            <div style={{ marginBottom: 14, padding: '12px 14px', background: amount > accruedInterest ? 'rgba(34,197,94,0.05)' : 'rgba(239,68,68,0.05)', border: `1px solid ${amount > accruedInterest ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`, borderRadius: 10 }}>
              {amount <= accruedInterest ? (
                <div style={{ fontSize: 12, color: '#EF4444', fontWeight: 600 }}>⚠️ Amount must exceed ₱{accruedInterest.toFixed(2)} to cover interest first</div>
              ) : (
                <>
                  <div style={{ fontSize: 11, color: '#4B5580', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10, fontWeight: 800 }}>Payment Breakdown</div>
                  {[
                    { label: '→ Covers accrued interest', value: `₱${accruedInterest.toFixed(2)}`, color: '#F59E0B' },
                    { label: '→ Reduces principal by', value: `₱${principalPortion.toFixed(2)}`, color: '#22C55E' },
                    { label: isFullPayoff ? '🎉 New principal (PAID OFF!)' : '→ New principal after', value: `₱${principalAfter.toFixed(2)}`, color: isFullPayoff ? '#22C55E' : '#60A5FA' },
                  ].map((r, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0', borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                      <span style={{ color: '#7A8AAA' }}>{r.label}</span>
                      <span style={{ fontWeight: 800, color: r.color, fontFamily: 'Syne, sans-serif' }}>{r.value}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {/* Admin Payment Details Box */}
          <div style={{ padding: '14px', background: 'rgba(59,130,246,0.06)', borderRadius: 12, border: '1px solid rgba(59,130,246,0.15)', marginBottom: 16, textAlign: 'left' }}>
            <div style={{ fontSize: 11, color: '#3B82F6', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Send Payment To</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <img src="/gcash-logo.png" alt="GCash" style={{ width: 24, height: 24, objectFit: 'contain' }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#F0F4FF' }}>GCash</div>
                    <div style={{ fontSize: 10, color: '#7A8AAA' }}>Charlou June Ramil</div>
                  </div>
                </div>
                <div style={{ fontSize: 13, fontFamily: 'Space Grotesk, sans-serif', fontWeight: 800, color: '#60A5FA' }}>09665835179</div>
              </div>
            </div>
          </div>

          {/* File upload */}
          <label style={{ display: 'block', border: `2px dashed ${file ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.1)'}`, borderRadius: 12, padding: '20px', textAlign: 'center', cursor: 'pointer', background: file ? 'rgba(99,102,241,0.05)' : 'rgba(255,255,255,0.02)', marginBottom: 14, transition: 'all 0.2s' }}>
            <input type="file" accept="image/*,.pdf" onChange={e => setFile(e.target.files[0])} style={{ display: 'none' }} />
            <div style={{ fontSize: 24, marginBottom: 6 }}>{file ? '✅' : '📎'}</div>
            <div style={{ fontSize: 12, color: file ? '#a78bfa' : '#7A8AAA', fontWeight: 600 }}>{file ? file.name : 'Upload proof of payment (screenshot)'}</div>
            <div style={{ fontSize: 11, color: '#4B5580', marginTop: 2 }}>JPG, PNG, PDF · Max 5MB</div>
          </label>

          <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional note for admin..." rows={2}
            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, color: '#F0F4FF', fontSize: 13, resize: 'none', outline: 'none', fontFamily: 'DM Sans, sans-serif', marginBottom: 14 }} />

          {error && <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, fontSize: 13, color: '#EF4444', marginBottom: 14 }}>{error}</div>}

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: '#7A8AAA', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleSubmit} disabled={uploading || !isValid}
              style={{ flex: 2, padding: '12px', borderRadius: 10, border: 'none', background: !isValid ? 'rgba(255,255,255,0.06)' : 'linear-gradient(135deg,#6366F1,#8B5CF6)', color: !isValid ? '#4B5580' : '#fff', fontSize: 13, fontWeight: 700, cursor: !isValid ? 'not-allowed' : 'pointer', fontFamily: 'Syne, sans-serif' }}>
              {uploading ? 'Submitting...' : '💳 Submit Principal Payment'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function PenaltySection({ loanId, supabase }) {
  const [penalties, setPenalties] = useState([])
  useEffect(() => {
    if (!loanId) return
    supabase.from('penalty_charges').select('*').eq('loan_id', loanId).order('created_at', { ascending: false })
      .then(({ data }) => setPenalties(data || []))
  }, [loanId, supabase])
  if (!penalties.length) return null
  const total = penalties.reduce((s, p) => s + (p.amount || 0), 0)
  return (
    <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 14, padding: '16px 18px', marginTop: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, color: '#EF4444' }}>⚠ Late Payment Penalties</div>
        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 15, color: '#EF4444' }}>₱{total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
      </div>
      {penalties.map((p, i) => (
        <div key={i} style={{ fontSize: 12, color: '#8892B0', display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
          <span>Installment {p.installment_number} · {p.days_late} days late</span>
          <span style={{ color: '#EF4444', fontWeight: 700 }}>₱{(p.amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
        </div>
      ))}
    </div>
  )
}

function LottieHourglass() {
  const [dots, setDots] = useState(0)
  useEffect(() => { const t = setInterval(() => setDots(d => (d + 1) % 4), 500); return () => clearInterval(t) }, [])
  return <span style={{ fontFamily: 'monospace' }}>{'⏳'}{'.'.repeat(dots)}</span>
}

// ── E-Signature Modal ─────────────────────────────────────────
function SignatureModal({ borrower, loan, onSave, onClose }) {
  const canvasRef = useRef(null)
  const [drawing, setDrawing] = useState(false)
  const [typedName, setTypedName] = useState('')
  const [hasDrawn, setHasDrawn] = useState(false)
  const [tab, setTab] = useState('draw')

  const startDraw = (e) => {
    const c = canvasRef.current; if (!c) return
    const r = c.getBoundingClientRect()
    const x = (e.touches?.[0]?.clientX ?? e.clientX) - r.left
    const y = (e.touches?.[0]?.clientY ?? e.clientY) - r.top
    const ctx = c.getContext('2d')
    ctx.beginPath(); ctx.moveTo(x, y)
    setDrawing(true); setHasDrawn(true)
  }
  const draw = (e) => {
    if (!drawing) return
    e.preventDefault()
    const c = canvasRef.current; if (!c) return
    const r = c.getBoundingClientRect()
    const x = (e.touches?.[0]?.clientX ?? e.clientX) - r.left
    const y = (e.touches?.[0]?.clientY ?? e.clientY) - r.top
    const ctx = c.getContext('2d')
    ctx.strokeStyle = '#F0F4FF'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'
    ctx.lineTo(x, y); ctx.stroke()
  }
  const stopDraw = () => setDrawing(false)
  const clearCanvas = () => {
    const c = canvasRef.current; if (!c) return
    c.getContext('2d').clearRect(0, 0, c.width, c.height)
    setHasDrawn(false)
  }
  const handleSave = () => {
    if (!typedName.trim()) return
    let signatureImage = null
    if (tab === 'draw' && hasDrawn && canvasRef.current) {
      signatureImage = canvasRef.current.toDataURL('image/png')
    }
    onSave({ typedName: typedName.trim(), signatureImage, signedAt: new Date().toISOString() })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 500, background: '#0E1320', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 20, overflow: 'hidden', boxShadow: '0 40px 80px rgba(0,0,0,0.6)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 16, color: '#F0F4FF' }}>Sign Loan Agreement</div>
            <div style={{ fontSize: 12, color: '#4B5580', marginTop: 2 }}>
              {loan.loan_type === 'quickloan'
                ? `₱${Number(loan.loan_amount).toLocaleString('en-PH')} QuickLoan · daily interest · pay off by Day 15 or Day 30`
                : `₱${Number(loan.loan_amount).toLocaleString('en-PH')} loan · repayable in ${loan.num_installments || 4} installments of ₱${Math.ceil(Number(loan.installment_amount)).toLocaleString('en-PH')} each`}
            </div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#7A8AAA', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
        <div style={{ padding: 24 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11, color: '#4B5580', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6, fontWeight: 700 }}>Full Name (as it appears on ID)</label>
            <input value={typedName} onChange={e => setTypedName(e.target.value)} placeholder={borrower.full_name}
              style={{ width: '100%', boxSizing: 'border-box', padding: '11px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#F0F4FF', fontSize: 14, fontWeight: 600, outline: 'none', fontFamily: 'DM Sans, sans-serif' }} />
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {['draw', 'type'].map(t => (
              <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: '8px', borderRadius: 8, border: `1px solid ${tab === t ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.06)'}`, background: tab === t ? 'rgba(99,102,241,0.15)' : 'transparent', color: tab === t ? '#a78bfa' : '#7A8AAA', fontSize: 12, fontWeight: 700, cursor: 'pointer', textTransform: 'capitalize' }}>{t} Signature</button>
            ))}
          </div>
          {tab === 'draw' ? (
            <div>
              <canvas ref={canvasRef} width={452} height={120} onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw} onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw}
                style={{ width: '100%', height: 120, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, cursor: 'crosshair', display: 'block', touchAction: 'none' }} />
              <button onClick={clearCanvas} style={{ marginTop: 6, fontSize: 11, color: '#4B5580', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Clear</button>
            </div>
          ) : (
            <div style={{ height: 120, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: 32, fontStyle: 'italic', color: '#F0F4FF', letterSpacing: 1 }}>{typedName || borrower.full_name}</div>
            </div>
          )}
          <div style={{ marginTop: 16, padding: '12px 14px', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 10, fontSize: 11, color: '#7A8AAA', lineHeight: 1.7 }}>
            By signing, you confirm you have read and agree to the loan terms: <strong style={{ color: '#F0F4FF' }}>₱{Number(loan.loan_amount).toLocaleString('en-PH')} loan</strong>
          {loan.loan_type === 'quickloan'
            ? <> at <strong style={{ color: '#F0F4FF' }}>10%/month daily interest (0.33%/day)</strong>, payable by <strong style={{ color: '#60A5FA' }}>Day 15</strong> (early) or <strong style={{ color: '#F59E0B' }}>Day 30</strong> (max). Extension fee of <strong style={{ color: '#F59E0B' }}>₱100</strong> applies after Day 15. Penalty of ₱25/day applies after Day 30.</>
            : <> at <strong style={{ color: '#F0F4FF' }}>{((loan.interest_rate || 0.07) * 100).toFixed(0)}%/mo × {loan.loan_term || 2} months interest</strong>, repayable in <strong style={{ color: '#F0F4FF' }}>{loan.num_installments || 4} installments</strong> of <strong style={{ color: '#60A5FA' }}>₱{Math.ceil(Number(loan.installment_amount)).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong> each.</>}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button onClick={onClose} style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: '#7A8AAA', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleSave} disabled={!typedName.trim()}
              style={{ flex: 2, padding: '12px', borderRadius: 10, border: 'none', background: typedName.trim() ? 'linear-gradient(135deg,#6366F1,#8B5CF6)' : 'rgba(255,255,255,0.05)', color: typedName.trim() ? '#fff' : '#4B5580', fontSize: 13, fontWeight: 700, cursor: typedName.trim() ? 'pointer' : 'not-allowed', fontFamily: 'Syne, sans-serif' }}>
              ✍ Sign & Download Agreement
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Shared Header ─────────────────────────────────────────────
function PortalHeader({ borrower, notifications, showNotifs, setShowNotifs, markAllRead, onSignOut, onBack, subtitle }) {
  const unread = notifications ? notifications.filter(n => !n.is_read).length : 0
  return (
    <header style={{ background: 'rgba(8,11,20,0.95)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0 24px', height: 60, display: 'flex', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100 }}>
      <div style={{ maxWidth: 1000, margin: '0 auto', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {onBack && (
            <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', color: '#7A8AAA', fontSize: 13, marginRight: 4 }}>
              ← Back
            </button>
          )}
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            <img src="/favicon-96x96.png" alt="ML" style={{ width: 28, height: 28, objectFit: 'contain' }} />
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 15, color: '#F0F4FF' }}>
              Moneyfest<span style={{ background: 'linear-gradient(90deg,#60a5fa,#a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Lending</span>
            </div>
          </a>
          {subtitle && <div style={{ fontSize: 11, color: '#4B5580', paddingLeft: 10, borderLeft: '1px solid rgba(255,255,255,0.08)', marginLeft: 4 }}>{subtitle}</div>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {borrower && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 4 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#3B82F6,#8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                {borrower.full_name?.charAt(0).toUpperCase()}
              </div>
              <div className="header-user-info" style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#F0F4FF', lineHeight: 1.2 }}>{borrower.full_name}</div>
                <div style={{ fontSize: 10, color: '#4B5580' }}>{borrower.department}</div>
              </div>
            </div>
          )}
          {notifications && (
            <div style={{ position: 'relative' }}>
              <button onClick={() => { setShowNotifs(v => !v); if (!showNotifs) markAllRead() }}
                style={{ position: 'relative', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <span style={{ fontSize: 15 }}>🔔</span>
                {unread > 0 && (
                  <div style={{ position: 'absolute', top: -3, right: -3, width: 15, height: 15, borderRadius: '50%', background: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 800, color: '#fff' }}>{unread}</div>
                )}
              </button>
              {showNotifs && (
                <div style={{ position: 'absolute', right: 0, top: 42, width: 300, background: '#0E1320', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.5)', zIndex: 200, overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between' }}>
                    <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, color: '#F0F4FF' }}>Notifications</div>
                    <button onClick={() => setShowNotifs(false)} style={{ background: 'none', border: 'none', color: '#4B5580', cursor: 'pointer' }}>✕</button>
                  </div>
                  <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                    {notifications.length === 0 ? (
                      <div style={{ padding: '28px 16px', textAlign: 'center', fontSize: 13, color: '#4B5580' }}>No notifications yet.</div>
                    ) : notifications.map((n, i) => (
                      <div key={i} style={{ padding: '11px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', background: n.is_read ? 'transparent' : 'rgba(59,130,246,0.04)', display: 'flex', gap: 10 }}>
                        <div style={{ fontSize: 18, flexShrink: 0 }}>{n.type === 'loan_approved' ? '🎉' : n.type === 'payment_confirmed' ? '✅' : n.type === 'payment_rejected' ? '❌' : '⏰'}</div>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#F0F4FF', marginBottom: 2 }}>{n.title}</div>
                          <div style={{ fontSize: 11, color: '#7A8AAA', lineHeight: 1.5 }}>{n.message}</div>
                          <div style={{ fontSize: 10, color: '#4B5580', marginTop: 4 }}>{new Date(n.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                        {!n.is_read && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#3B82F6', flexShrink: 0, marginTop: 4 }} />}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {onSignOut && (
            <button onClick={onSignOut} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '5px 12px', color: '#7A8AAA', fontSize: 12, cursor: 'pointer' }}>Sign out</button>
          )}
        </div>
      </div>
    </header>
  )
}

// ── Receipt Generator ────────────────────────────────────────
// Using pdfGenerator instead of raw HTML

export default function BorrowerPortalPage() {
  usePageVisit('portal')
  const [code, setCode] = useState('')
  const [inputCode, setInputCode] = useState('')
  const [borrower, setBorrower] = useState(null)
  const [loan, setLoan] = useState(null)
  const [proofs, setProofs] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [uploadModal, setUploadModal] = useState(null)
  const [qlPaymentType, setQlPaymentType] = useState(null) // 'interest_only' | 'full_payoff'
  const [showPrincipalModal, setShowPrincipalModal] = useState(false)
  const [showSignModal, setShowSignModal] = useState(false)
  const [signatureData, setSignatureData] = useState(null)
  const [typedName, setTypedName] = useState('')
  const [signatureSaved, setSignatureSaved] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [page, setPage] = useState('home')
  const [rebateCredits, setRebateCredits] = useState(null)
  const [creditTxns, setCreditTxns] = useState([])
  const [withdrawing, setWithdrawing] = useState(false)
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [withdrawMethod, setWithdrawMethod] = useState('')
  const [withdrawDetails, setWithdrawDetails] = useState('')
  const [pendingApp, setPendingApp] = useState(null)
  const [allLoans, setAllLoans] = useState([])
  const [notifications, setNotifications] = useState([])
  const [showNotifs, setShowNotifs] = useState(false)
  const [hoveredMethod, setHoveredMethod] = useState(null)
  const [activeMethod, setActiveMethod] = useState(null)
  const [copiedKey, setCopiedKey] = useState(null)
  const [renewing, setRenewing] = useState(false)
  const [renewalSent, setRenewalSent] = useState(false)
  const [loginType, setLoginType] = useState('borrower') // 'borrower' or 'partner'
  const [partnerInputCode, setPartnerInputCode] = useState('')
  const [partnerError, setPartnerError] = useState('')
  const [partnerLoading, setPartnerLoading] = useState(false)

  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  const handleFastTrackRenewal = async () => {
    if (!borrower) return
    setRenewing(true)
    try {
      // Create new application
      const { error: appError } = await supabase.from('applications').insert([{
        full_name: borrower.full_name,
        department: borrower.department,
        contact_number: borrower.contact_number,
        facebook_account: borrower.facebook_account,
        requested_amount: borrower.loan_limit_level === 4 ? 10000 : borrower.loan_limit_level === 3 ? 9000 : borrower.loan_limit_level === 2 ? 7000 : 5000,
        loan_purpose: loan?.loan_purpose || '', // Carry over previous purpose
        status: 'Pending',
        is_fast_track: true, // Tagging it for admin
        borrower_id: borrower.id
      }])
      if (appError) throw appError
      setRenewalSent(true)
      // Log audit
      await logAudit(borrower.id, borrower.full_name, 'Fast-Track Renewal Submitted')
    } catch (err) {
      console.error(err)
      alert('Failed to submit renewal. Please contact admin.')
    } finally {
      setRenewing(false)
    }
  }


  const fetchPortalData = useCallback(async (accessCode) => {
    setLoading(true); setError('')
    const cleanCode = accessCode.toUpperCase().trim()
    const { data: b } = await supabase.from('borrowers').select('*').eq('access_code', cleanCode).single()
    if (b) {
      const { data: allL } = await supabase.from('loans').select('*').eq('borrower_id', b.id).order('created_at', { ascending: false })
      const { data: p } = await supabase.from('payment_proofs').select('*').eq('borrower_id', b.id).order('created_at', { ascending: false })
      let { data: notifs } = await supabase.from('portal_notifications').select('*').eq('borrower_id', b.id).order('created_at', { ascending: false }).limit(20)
      setBorrower(b); setAllLoans(allL || []); setLoan(allL?.[0] || null); setProofs(p || [])
      const activeLoans = (allL || []).filter(l => l.status === 'Active')
      for (const activeLoan of activeLoans) {
        if (!activeLoan.release_date) continue
        const today = new Date(); today.setHours(0, 0, 0, 0)
        const paid = activeLoan.payments_made || 0
        const numInst = activeLoan.num_installments || 4
        const allDueDates = getDueDates(activeLoan.release_date, paid, numInst)
        for (const dueEntry of allDueDates) {
          if (dueEntry.paid) continue
          const due = dueEntry.date
          const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24))
          if (diffDays >= 0 && diffDays <= 2) {
            const alreadyNotified = (notifs || []).some(n => n.type === 'due_soon' && new Date(n.created_at) > new Date(Date.now() - 3 * 24 * 60 * 60 * 1000))
            if (!alreadyNotified) {
              const msg = diffDays === 0
                ? `Installment ${dueEntry.num} of ₱${Number(activeLoan.installment_amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })} is due TODAY. Please submit your payment proof.`
                : `Installment ${dueEntry.num} of ₱${Number(activeLoan.installment_amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })} is due in ${diffDays} day${diffDays > 1 ? 's' : ''} (${due.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}). Don't forget to pay!`
              const { data: newNotif } = await supabase.from('portal_notifications').insert({ borrower_id: b.id, type: 'due_soon', title: diffDays === 0 ? '⏰ Payment Due Today!' : '⏰ Payment Due Soon', message: msg }).select().single()
              if (newNotif) notifs = [...(notifs || []), newNotif]
            }
          }
          break
        }
      }
      // 3. Fetch latest application by borrower_id OR access_code
      const { data: latestApp } = await supabase
        .from('applications')
        .select('*')
        .or(`borrower_id.eq.${b.id},access_code.eq.${cleanCode}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      
      setPendingApp(latestApp || null)
      setLoading(false); return
    }
    
    // 4. If no borrower found, check if it's a first-time applicant
    const { data: app } = await supabase.from('applications').select('*').eq('access_code', cleanCode).single()
    if (app) { setPendingApp(app); setLoading(false); return }
    setError('Invalid access code. Please check and try again.')
    setLoading(false)
  }, [])

  useEffect(() => {
    const saved = localStorage.getItem('lm_portal_code')
    if (saved) { setCode(saved); setInputCode(saved); fetchPortalData(saved) }
    
    const savedPartner = localStorage.getItem('lm_partner_code')
    if (savedPartner) {
      // If we have a saved partner code, we might want to redirect to investor dashboard
      // but let's keep the user on the portal if they just opened it.
      // Or we can auto-redirect if they are on the "partner" tab.
    }
  }, [fetchPortalData])

  const handleLogin = async () => {
    if (!inputCode.trim()) { setError('Please enter your access code'); return }
    setCode(inputCode); localStorage.setItem('lm_portal_code', inputCode.toUpperCase().trim())
    await fetchPortalData(inputCode)
  }

  const handlePartnerLogin = async () => {
    if (!partnerInputCode.trim()) { setPartnerError('Please enter your partner access code'); return }
    setPartnerLoading(true); setPartnerError('')
    
    try {
      const { data, error } = await supabase
        .from('investors')
        .select('id, access_code')
        .eq('access_code', partnerInputCode.toUpperCase().trim())
        .single()

      if (error || !data) {
        console.error('Partner Login Error:', error)
        setPartnerError('Invalid partner access code.')
        setPartnerLoading(false)
        return
      }

      localStorage.setItem('lm_partner_code', data.access_code)
      window.location.href = '/investor/dashboard'
    } catch (err) {
      setPartnerError('Login failed. Please try again.')
    } finally {
      setPartnerLoading(false)
    }
  }
  const handleUploaded = () => { setUploadModal(null); setUploadSuccess(true); fetchPortalData(code); setTimeout(() => setUploadSuccess(false), 5000) }
  const handleSaveSignature = async ({ typedName, signatureImage, signedAt }) => {
    // 1. Update DB
    await supabase.from('loans').update({ e_signature_name: typedName, e_signature_image: signatureImage, e_signature_date: signedAt, agreement_confirmed: true }).eq('id', loan.id)
    await supabase.from('borrowers').update({ e_signature_name: typedName, e_signature_image: signatureImage, e_signature_date: signedAt }).eq('id', borrower.id)

    // 2. Notify Admin
    try {
      await sendLoanAgreementSignedAdminEmail({
        borrowerName: borrower.full_name,
        loanAmount: loan.loan_amount,
        loanType: loan.loan_type === 'quickloan' ? 'QuickLoan' : 'Installment Loan',
        accessCode: borrower.access_code
      })

      await logAudit({
        action_type: 'LA_SIGNED',
        module: 'Portal',
        description: `Loan Agreement signed by ${borrower.full_name} (${loan.loan_type === 'quickloan' ? 'QuickLoan' : 'Installment'})`,
        changed_by: borrower.full_name
      })
    } catch (e) {
      console.error('Notification failed:', e)
    }

    // 3. Update State
    setLoan(prev => ({ ...prev, e_signature_name: typedName, e_signature_image: signatureImage, e_signature_date: signedAt, agreement_confirmed: true }))
    setBorrower(prev => ({ ...prev, e_signature_name: typedName, e_signature_image: signatureImage, e_signature_date: signedAt }))
    setSignatureSaved(true); setShowSignModal(false)

    // 4. Generate PDF
    setTimeout(() => loan.loan_type === 'quickloan' ? generateBorrowerQuickLoanPDF(loan, borrower, typedName, signatureImage, signedAt) : generateBorrowerLoanAgreementPDF(loan, borrower, typedName, signatureImage, signedAt), 500)
  }

  const markAllRead = async () => {
    if (!borrower) return
    const unread = notifications.filter(n => !n.is_read)
    if (unread.length === 0) return
    await supabase.from('portal_notifications').update({ is_read: true }).eq('borrower_id', borrower.id).eq('is_read', false)
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
  }



  // ── PENDING APP SCREEN ───────────────────────────────────────
  if (pendingApp) return (
    <div style={{ minHeight: '100dvh', background: '#080B14', fontFamily: 'DM Sans, sans-serif', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <PortalHeader />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', minHeight: 'calc(100dvh - 60px)', padding: '20px 16px' }}>
        <div style={{ maxWidth: 520, width: '100%' }}>

          {/* Status card */}
          <div style={{
            background: pendingApp.status === 'Rejected' ? 'rgba(239,68,68,0.04)' : 'rgba(245,158,11,0.04)',
            border: `1px solid ${pendingApp.status === 'Rejected' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'}`,
            borderRadius: 20, padding: '32px 28px', marginBottom: 16
          }}>
            {/* Icon + Title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
              <div style={{
                width: 52, height: 52, borderRadius: 14, flexShrink: 0,
                background: pendingApp.status === 'Rejected' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
                border: `1px solid ${pendingApp.status === 'Rejected' ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.25)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24
              }}>
                {pendingApp.status === 'Rejected' ? '❌' : '⏳'}
              </div>
              <div>
                <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 800, fontSize: 20, color: '#F0F4FF', marginBottom: 3 }}>
                  {pendingApp.status === 'Rejected' ? 'Application Not Approved' : 'Application Under Review'}
                </div>
                <div style={{ fontSize: 12, color: pendingApp.status === 'Rejected' ? '#EF4444' : '#F59E0B', fontWeight: 600 }}>
                  {pendingApp.status === 'Rejected' ? 'Status: Rejected' : 'Status: Pending Review'}
                </div>
              </div>
            </div>

            {/* Reason / message */}
            <div style={{
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 12, padding: '16px 18px', marginBottom: 20,
              fontSize: 13.5, color: '#9AA4BC', lineHeight: 1.8
            }}>
              {pendingApp.status === 'Rejected'
                ? (pendingApp.reject_reason || 'Your application was not approved. Please contact an admin for more information.')
                : 'Your application is currently being reviewed by our admin team. Please check back later or reach out directly via Microsoft Teams for updates.'}
            </div>

            {/* Application details */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 16 }}>
              <div style={{ fontSize: 10, color: '#4B5580', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 12 }}>Application Details</div>
              {[
                { label: 'Applicant', value: pendingApp.full_name },
                { label: 'Department', value: pendingApp.department },
                { label: 'Tenurity', value: (pendingApp.tenure_years || 0) + ' Year' + (pendingApp.tenure_years > 1 ? 's' : '') },
                { label: 'Requested Amount', value: '₱' + Number(pendingApp.loan_amount).toLocaleString() },
                { label: 'Reference Code', value: pendingApp.access_code },
                { label: 'Submitted', value: new Date(pendingApp.created_at).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' }) },
              ].map((r, i, arr) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                  <span style={{ fontSize: 12, color: '#4B5580' }}>{r.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#CBD5F0', fontFamily: 'Space Grotesk, sans-serif' }}>{r.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Contact admins */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '20px 22px', marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: '#4B5580', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 12 }}>Need help? Contact your admin</div>
            <p style={{ fontSize: 13, color: '#7A8AAA', lineHeight: 1.7, margin: '0 0 14px' }}>Our team is ready to assist with any questions about your application.</p>
            <a href="/contact" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 20px', borderRadius: 11, background: 'linear-gradient(135deg,rgba(59,130,246,0.12),rgba(139,92,246,0.12))', border: '1px solid rgba(139,92,246,0.25)', color: '#a78bfa', textDecoration: 'none', fontSize: 13, fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif' }}>
              💬 Contact Us →
            </a>
          </div>

          <button onClick={() => { setPendingApp(null); setInputCode(''); setCode('') }}
            style={{ width: '100%', padding: '12px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: '#7A8AAA', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#F0F4FF' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#7A8AAA' }}
          >← Back to Portal</button>

        </div>
      </div>
    </div>
  )

  if (!borrower) return (
    <div style={{ minHeight: '100dvh', background: '#080B14', fontFamily: 'DM Sans, sans-serif', display: 'flex', flexDirection: 'column', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <style>{`
        .portal-login-input:focus { border-color: rgba(99,102,241,0.5) !important; box-shadow: 0 0 0 3px rgba(99,102,241,0.1) !important; }
        .portal-login-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(99,102,241,0.3) !important; }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        .login-card { animation: fadeUp 0.5s ease forwards; }
        .type-btn { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
      `}</style>

      {/* Header */}
      <header style={{ padding: '16px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <img src="/favicon-96x96.png" alt="ML" style={{ width: 32, height: 32, objectFit: 'contain' }} />
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 16, color: '#F0F4FF' }}>
            Moneyfest<span style={{ background: 'linear-gradient(90deg,#60a5fa,#a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Lending</span>
          </div>
        </a>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href="/portal" onClick={(e) => { e.preventDefault(); setLoginType(loginType === 'borrower' ? 'partner' : 'borrower') }} 
             style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: '#7A8AAA', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
            Switch to {loginType === 'borrower' ? 'Partner' : 'Borrower'}
          </a>
        </div>
      </header>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ width: '100%', maxWidth: 420 }} className="login-card">
          
          {/* Logo/Icon */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ width: 72, height: 72, borderRadius: 22, background: loginType === 'borrower' ? 'linear-gradient(135deg,rgba(99,102,241,0.2),rgba(139,92,246,0.2))' : 'linear-gradient(135deg,rgba(139,92,246,0.2),rgba(245,158,11,0.2))', border: `1px solid ${loginType === 'borrower' ? 'rgba(99,102,241,0.3)' : 'rgba(245,158,11,0.3)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', animation: 'float 3s ease-in-out infinite', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
              <img src={loginType === 'borrower' ? "/padlock.png" : "/handshake.png"} alt="icon" style={{ width: 32, height: 32, objectFit: 'contain' }} />
            </div>
            <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 900, fontSize: 28, color: '#F0F4FF', letterSpacing: -0.5, marginBottom: 8 }}>
              {loginType === 'borrower' ? 'Borrower Portal' : 'Partner Portal'}
            </h1>
            <p style={{ fontSize: 14, color: '#4B5580', margin: 0 }}>
              {loginType === 'borrower' ? 'Access your loan details and repayment plan' : 'Track your capital, ROI, and active deployments'}
            </p>
          </div>

          <div style={{ background: '#0E1320', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 24, padding: '32px 28px', boxShadow: '0 40px 80px rgba(0,0,0,0.5)' }}>
            
            {/* Toggle Segment */}
            <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', padding: 4, borderRadius: 14, marginBottom: 28, border: '1px solid rgba(255,255,255,0.04)' }}>
              <button 
                onClick={() => setLoginType('borrower')}
                className="type-btn"
                style={{ flex: 1, padding: '10px', borderRadius: 11, border: 'none', background: loginType === 'borrower' ? 'rgba(255,255,255,0.06)' : 'transparent', color: loginType === 'borrower' ? '#F0F4FF' : '#4B5580', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                Borrower
              </button>
              <button 
                onClick={() => setLoginType('partner')}
                className="type-btn"
                style={{ flex: 1, padding: '10px', borderRadius: 11, border: 'none', background: loginType === 'partner' ? 'rgba(255,255,255,0.06)' : 'transparent', color: loginType === 'partner' ? '#F0F4FF' : '#4B5580', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                Partner
              </button>
            </div>

            {loginType === 'borrower' ? (
              /* Borrower Form */
              <div>
                <div style={{ fontSize: 11, color: '#4B5580', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 800, marginBottom: 10, marginLeft: 4 }}>Access Code</div>
                <input
                  value={inputCode}
                  onChange={e => setInputCode(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  placeholder="LM-XXXX"
                  maxLength={7}
                  className="portal-login-input"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '16px 16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, color: '#F0F4FF', fontSize: 24, fontWeight: 800, fontFamily: 'monospace', letterSpacing: 8, textAlign: 'center', marginBottom: 16, outline: 'none', transition: 'all 0.2s' }}
                />
                {error && (
                  <div style={{ fontSize: 13, color: '#EF4444', marginBottom: 16, padding: '12px 16px', background: 'rgba(239,68,68,0.08)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <AlertCircle size={14} /> {error}
                  </div>
                )}
                <button onClick={handleLogin} disabled={loading} className="portal-login-btn"
                  style={{ width: '100%', height: 52, borderRadius: 14, border: 'none', background: loading ? 'rgba(99,102,241,0.3)' : 'linear-gradient(135deg,#6366F1,#8B5CF6)', color: '#fff', fontSize: 15, fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'Syne, sans-serif', transition: 'all 0.2s', boxShadow: '0 4px 15px rgba(99,102,241,0.2)' }}>
                  {loading ? 'Verifying...' : 'Access My Loan →'}
                </button>
              </div>
            ) : (
              /* Partner Form */
              <div>
                <div style={{ fontSize: 11, color: '#4B5580', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 800, marginBottom: 10, marginLeft: 4 }}>Partner Access Code</div>
                <input
                  value={partnerInputCode}
                  onChange={e => setPartnerInputCode(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && handlePartnerLogin()}
                  placeholder="MF-XXXX"
                  maxLength={7}
                  className="portal-login-input"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '16px 16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, color: '#F59E0B', fontSize: 24, fontWeight: 800, fontFamily: 'monospace', letterSpacing: 8, textAlign: 'center', marginBottom: 16, outline: 'none', transition: 'all 0.2s' }}
                />
                {partnerError && (
                  <div style={{ fontSize: 13, color: '#EF4444', marginBottom: 16, padding: '12px 16px', background: 'rgba(239,68,68,0.08)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <AlertCircle size={14} /> {partnerError}
                  </div>
                )}
                <button onClick={handlePartnerLogin} disabled={partnerLoading} className="portal-login-btn"
                  style={{ width: '100%', height: 52, borderRadius: 14, border: 'none', background: partnerLoading ? 'rgba(245,158,11,0.3)' : 'linear-gradient(135deg,#F59E0B,#D97706)', color: '#000', fontSize: 15, fontWeight: 800, cursor: partnerLoading ? 'not-allowed' : 'pointer', fontFamily: 'Syne, sans-serif', transition: 'all 0.2s', boxShadow: '0 4px 15px rgba(245,158,11,0.2)' }}>
                  {partnerLoading ? 'Authenticating...' : 'Enter Partner Hub →'}
                </button>
              </div>
            )}

            <div style={{ marginTop: 24, padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: 14, fontSize: 12, color: '#4B5580', lineHeight: 1.6, textAlign: 'center', border: '1px solid rgba(255,255,255,0.04)' }}>
              {loginType === 'borrower' ? (
                <>💡 Your LM code is found in your approval email.<br />Need a loan? <a href="/apply" style={{ color: '#7A8AAA', fontWeight: 700, textDecoration: 'none' }}>Apply here →</a></>
              ) : (
                <>Interested in becoming a funding partner?<br /><a href="/admin/investor-pitch" style={{ color: '#F59E0B', fontWeight: 700, textDecoration: 'none' }}>View our Investor Pitch →</a></>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  // ── PROFILE PAGE ─────────────────────────────────────────────
  if (page === 'profile') return (
    <div style={{ minHeight: '100dvh', background: '#080B14', fontFamily: 'DM Sans, sans-serif', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>

      <PortalHeader borrower={borrower} notifications={notifications} showNotifs={showNotifs} setShowNotifs={setShowNotifs} markAllRead={markAllRead} onBack={() => setPage('home')} subtitle="My Profile" />
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 20px 40px' }}>

        {/* Hero card */}
        <div style={{ background: 'linear-gradient(135deg,#0E1320,#1a1040)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 20, padding: 28, marginBottom: 16, textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -40, right: -40, width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle,rgba(139,92,246,0.08),transparent)', pointerEvents: 'none' }} />
          <div style={{ width: 80, height: 80, borderRadius: 24, background: 'linear-gradient(135deg,#3B82F6,#8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, fontWeight: 900, color: '#fff', margin: '0 auto 16px', fontFamily: 'Syne, sans-serif', boxShadow: '0 8px 24px rgba(139,92,246,0.3)' }}>
            {borrower.full_name?.charAt(0).toUpperCase()}
          </div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 22, color: '#F0F4FF', marginBottom: 4 }}>{borrower.full_name}</div>
          <div style={{ fontSize: 13, color: '#7A8AAA', marginBottom: 14 }}>{borrower.department}</div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: getBadgeConfig(borrower.loyalty_badge || 'New').bg, border: '1px solid ' + getBadgeConfig(borrower.loyalty_badge || 'New').border, borderRadius: 8, padding: '5px 14px' }}>
            <span style={{ fontSize: 15 }}>{getBadgeConfig(borrower.loyalty_badge || 'New').emoji}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: getBadgeConfig(borrower.loyalty_badge || 'New').color }}>{getBadgeConfig(borrower.loyalty_badge || 'New').label}</span>
          </div>
        </div>

        {/* Credit Score */}
        <div style={{ background: '#0E1320', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 22, marginBottom: 14 }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, color: '#7A8AAA', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>Credit Score</div>
          {(() => {
            const score = borrower.credit_score || 750
            const pct = ((score - CREDIT_CONFIG.MIN_SCORE) / (CREDIT_CONFIG.MAX_SCORE - CREDIT_CONFIG.MIN_SCORE)) * 100
            const label = CREDIT_CONFIG.labelFromScore(score)
            const color = CREDIT_CONFIG.colorFromScore(score)
            return (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 }}>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 900, fontSize: 52, color, lineHeight: 1 }}>{score}</div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color, marginBottom: 2 }}>{label}</div>
                    <div style={{ fontSize: 11, color: '#4B5580' }}>out of 1,000</div>
                  </div>
                </div>
                <div style={{ height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
                  <div style={{ height: '100%', width: pct + '%', background: `linear-gradient(90deg,#EF4444,#F59E0B,#22C55E,#8B5CF6)`, borderRadius: 4, transition: 'width 1.2s ease' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#4B5580' }}>
                  <span>300</span><span>500</span><span>750</span><span>920</span><span>1000 VIP</span>
                </div>
              </div>
            )
          })()}
        </div>

        {/* Security Hold Tier */}
        {(() => {
          const score = borrower.credit_score || 750
          const cleanLoans = borrower.clean_loans || 0
          const tier = getSecurityHoldRate(score, cleanLoans)
          return (
            <div style={{ background: '#0E1320', border: `1px solid ${tier.color}22`, borderRadius: 16, padding: 22, marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, color: '#7A8AAA', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Security Hold Tier</div>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 900, fontSize: 24, color: tier.color }}>{(tier.rate * 100).toFixed(0)}%</div>
              </div>
              <div style={{ fontSize: 12, color: '#8892B0', lineHeight: 1.7, marginBottom: 14 }}>{tier.perk}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
                {[
                  { label: 'High Risk', rate: '20%', color: '#EF4444' },
                  { label: 'Caution', rate: '15%', color: '#F97316' },
                  { label: 'Standard', rate: '10%', color: '#7A8AAA' },
                  { label: 'Trusted', rate: '8%', color: '#60A5FA' },
                  { label: 'Reliable', rate: '6%', color: '#34D399' },
                  { label: 'VIP', rate: '5%', color: '#8B5CF6' },
                ].map((t, i) => {
                  const isActive = tier.label === t.label
                  return (
                    <div key={i} style={{ padding: '8px 10px', borderRadius: 10, background: isActive ? t.color + '18' : 'rgba(255,255,255,0.02)', border: `1px solid ${isActive ? t.color + '55' : 'rgba(255,255,255,0.05)'}`, textAlign: 'center' }}>
                      <div style={{ fontSize: 13, fontWeight: isActive ? 800 : 600, color: isActive ? t.color : '#4B5580' }}>{t.rate}</div>
                      <div style={{ fontSize: 10, color: isActive ? t.color + 'CC' : '#4B5580', marginTop: 2 }}>{t.label}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}

        {/* Loan Limit */}
        <div style={{ background: '#0E1320', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 22, marginBottom: 14 }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, color: '#7A8AAA', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>Loan Limit Level</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 14 }}>
            {[{ level: 1, amount: '₱5,000' }, { level: 2, amount: '₱7,000' }, { level: 3, amount: '₱9,000' }, { level: 4, amount: '₱10,000' }].map(l => {
              const current = (borrower.loan_limit_level || 1) === l.level
              const unlocked = (borrower.loan_limit_level || 1) >= l.level
              return (
                <div key={l.level} style={{ background: current ? 'rgba(139,92,246,0.12)' : unlocked ? 'rgba(34,197,94,0.06)' : 'rgba(255,255,255,0.02)', border: `1px solid ${current ? 'rgba(139,92,246,0.35)' : unlocked ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.05)'}`, borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: current ? '#8B5CF6' : unlocked ? '#22C55E' : '#4B5580', marginBottom: 4 }}>LVL {l.level}</div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: current ? '#F0F4FF' : unlocked ? '#CBD5F0' : '#4B5580' }}>{l.amount}</div>
                  {current && <div style={{ fontSize: 9, color: '#8B5CF6', marginTop: 3 }}>Current</div>}
                  {!current && unlocked && <div style={{ fontSize: 9, color: '#22C55E', marginTop: 3 }}>✓</div>}
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '10px 0', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <span style={{ color: '#4B5580' }}>Clean loans completed</span>
            <span style={{ fontWeight: 700, color: '#8B5CF6' }}>{borrower.clean_loans || 0} of 3</span>
          </div>
        </div>

        {/* Personal Details */}
        <div style={{ background: '#0E1320', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 22 }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, color: '#7A8AAA', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>Personal Details</div>
          {[{ label: 'Email', value: borrower.email }, { label: 'Phone', value: borrower.phone }, { label: 'Department', value: borrower.department }, { label: 'Tenure', value: borrower.tenure_years ? borrower.tenure_years + ' years' : 'N/A' }, { label: 'Access Code', value: borrower.access_code }].map((item, i, arr) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0', borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
              <span style={{ fontSize: 12, color: '#4B5580' }}>{item.label}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#F0F4FF' }}>{item.value || 'N/A'}</span>
            </div>
          ))}
        </div>

      </div>
    </div>
  )

  // ── PAYMENT HISTORY PAGE ──────────────────────────────────────
  if (page === 'payment-history') return (
    <div style={{ minHeight: '100dvh', background: '#080B14', fontFamily: 'DM Sans, sans-serif', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>

      <PortalHeader borrower={borrower} notifications={notifications} showNotifs={showNotifs} setShowNotifs={setShowNotifs} markAllRead={markAllRead} onBack={() => setPage('home')} subtitle="Payment History" />
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 20px 40px' }}>
        {allLoans.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 20, color: '#F0F4FF', marginBottom: 8 }}>No Payment History</div>
            <div style={{ fontSize: 14, color: '#7A8AAA' }}>Your confirmed payments will appear here.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {allLoans.map((l, li) => {
              const confirmedProofs = proofs.filter(p => p.loan_id === l.id && p.status === 'Confirmed')
              const loanDate = new Date(l.created_at).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })
              const instAmt = Math.ceil(l.installment_amount || 0)
              return (
                <div key={l.id} style={{ background: '#0E1320', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, overflow: 'hidden' }}>
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 15, color: '#F0F4FF' }}>Loan #{allLoans.length - li} — ₱{Number(l.loan_amount).toLocaleString()}</div>
                      <div style={{ fontSize: 11, color: '#4B5580', marginTop: 2 }}>{loanDate}</div>
                    </div>
                    <StatusBadge status={l.status} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', background: 'rgba(255,255,255,0.02)' }}>
                    {[
                      { label: 'Total Repayment', value: '₱' + Number(l.total_repayment).toLocaleString('en-PH', { minimumFractionDigits: 2 }) },
                      { label: 'Payments Made', value: `${l.payments_made || 0} of ${l.num_installments || 4}` },
                      { label: 'Balance', value: '₱' + Number(l.remaining_balance || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 }) },
                    ].map((s, i) => (
                      <div key={i} style={{ padding: '12px 14px', borderRight: i < 2 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                        <div style={{ fontSize: 10, color: '#4B5580', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{s.label}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#F0F4FF' }}>{s.value}</div>
                      </div>
                    ))}
                  </div>
                  {confirmedProofs.length > 0 ? (
                    <div style={{ padding: '14px 20px' }}>
                      <div style={{ fontSize: 10, color: '#4B5580', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10, fontWeight: 700 }}>Confirmed Payments</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {confirmedProofs.map((proof, pi) => (
                          <div key={pi} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.12)', borderRadius: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(34,197,94,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>✅</div>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: '#F0F4FF' }}>Installment {proof.installment_number}</div>
                                <div style={{ fontSize: 11, color: '#4B5580' }}>{new Date(proof.reviewed_at || proof.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: 13, fontWeight: 800, color: '#22C55E' }}>₱{instAmt.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
                                <div style={{ fontSize: 10, color: '#22C55E' }}>Confirmed</div>
                              </div>
                              <button onClick={() => generateBorrowerReceiptPDF({ loan: l, borrower, installmentNum: proof.installment_number, amount: instAmt })}
                                style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.08)', color: '#60A5FA', fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                ↓ Receipt
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: '16px 20px', textAlign: 'center', fontSize: 13, color: '#4B5580' }}>No confirmed payments yet.</div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )

  // ── WALLET / REBATE CREDITS PAGE ──────────────────────────────
  if (page === 'wallet') {
    const canWithdraw = rebateCredits?.balance >= 500
    return (
      <>
        <div style={{ minHeight: '100dvh', background: '#080B14', fontFamily: 'DM Sans, sans-serif', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <PortalHeader borrower={borrower} notifications={notifications} showNotifs={showNotifs} setShowNotifs={setShowNotifs} markAllRead={markAllRead} onBack={() => setPage('home')} subtitle="Rebate Credits" />
          <div style={{ maxWidth: 520, margin: '0 auto', padding: '32px 20px 40px' }}>

            {/* Rebate content — installment only */}
            {loan?.loan_type === 'quickloan' ? (
              <div style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 14, padding: '18px 20px', marginBottom: 16, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ fontSize: 22, flexShrink: 0 }}>ℹ️</div>
                <div>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 13, color: '#F0F4FF', marginBottom: 4 }}>Rebate Credits — Installment Loans Only</div>
                  <div style={{ fontSize: 11, color: '#7A8AAA', lineHeight: 1.6 }}>Rebate Credits and early-payoff rewards are exclusive to <strong style={{ color: '#a78bfa' }}>Installment Loan</strong> borrowers. Your QuickLoan does not earn rebates. Your transaction history is shown below.</div>
                </div>
              </div>
            ) : (
              <div style={{ background: 'linear-gradient(135deg,#0E1320,#1a1040)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 20, padding: 28, marginBottom: 16, textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 120%, rgba(245,158,11,0.06), transparent)', pointerEvents: 'none' }} />
                <div style={{ fontSize: 11, color: '#7A8AAA', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8, fontWeight: 700 }}>Rebate Credits Balance</div>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 900, fontSize: 48, color: '#F59E0B', marginBottom: 4, lineHeight: 1 }}>
                  ₱{(rebateCredits?.balance || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </div>
                {!canWithdraw && (
                  <div style={{ fontSize: 12, color: '#4B5580', marginBottom: 16 }}>₱{(500 - (rebateCredits?.balance || 0)).toLocaleString('en-PH', { minimumFractionDigits: 2 })} more needed to withdraw</div>
                )}
                {canWithdraw ? (
                  <button onClick={() => { setWithdrawMethod(''); setWithdrawDetails(''); setShowWithdrawModal(true) }}
                    style={{ padding: '12px 28px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#F59E0B,#D97706)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'Syne, sans-serif' }}>
                    💸 Request Withdrawal
                  </button>
                ) : (
                  <div style={{ display: 'inline-block', padding: '10px 20px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', fontSize: 12, color: '#4B5580' }}>🔒 Min. ₱500 required to withdraw</div>
                )}
              </div>
            )}

            {/* How to earn — installment only */}
            {loan?.loan_type !== 'quickloan' && (
              <div style={{ background: '#0E1320', border: '1px solid rgba(34,197,94,0.15)', borderRadius: 16, padding: 20, marginBottom: 16 }}>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, color: '#22C55E', marginBottom: 14 }}>🎁 How to earn rebates</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.1)', borderRadius: 10, marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#F0F4FF' }}>Pay final installment at least 1–2 weeks early</div>
                    <div style={{ fontSize: 11, color: '#4B5580', marginTop: 2 }}>₱50 rebate on a ₱5,000 loan</div>
                  </div>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 900, fontSize: 22, color: '#22C55E' }}>1%</div>
                </div>
                <div style={{ fontSize: 11, color: '#4B5580', lineHeight: 1.7 }}>Fixed 1% of your original loan amount — credited automatically when admin records your payment. Security Hold is also returned here after your final installment.</div>
              </div>
            )}


            <div style={{ background: '#0E1320', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, color: '#F0F4FF' }}>Transaction History</div>
              {creditTxns.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', fontSize: 13, color: '#4B5580' }}>No transactions yet. Pay off a loan early to earn rebates!</div>
              ) : (
                <div>
                  {creditTxns.map((txn, i) => {
                    const isHoldReturn = txn.type === 'rebate' && txn.description?.toLowerCase().includes('security hold')
                    const isRebate = txn.type === 'rebate' && !isHoldReturn
                    const label = isHoldReturn ? 'Security Hold Returned' : isRebate ? 'Early Payoff Rebate' : 'Withdrawal'
                    const icon = isHoldReturn ? '🔐' : isRebate ? '🎁' : '💸'
                    const amountColor = isHoldReturn ? '#F59E0B' : isRebate ? '#22C55E' : '#F0F4FF'
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: i < creditTxns.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ width: 36, height: 36, borderRadius: 10, background: isHoldReturn ? 'rgba(245,158,11,0.1)' : isRebate ? 'rgba(34,197,94,0.1)' : txn.status === 'pending' ? 'rgba(245,158,11,0.1)' : 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{icon}</div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#F0F4FF' }}>{label}</div>
                            <div style={{ fontSize: 11, color: '#4B5580', marginTop: 2 }}>
                              {new Date(txn.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                              {txn.status === 'pending' && <span style={{ color: '#F59E0B', marginLeft: 6 }}>· Pending</span>}
                              {txn.status === 'rejected' && <span style={{ color: '#EF4444', marginLeft: 6 }}>· Rejected</span>}
                            </div>
                          </div>
                        </div>
                        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15, color: amountColor }}>
                          {txn.type === 'rebate' ? '+' : '-'}₱{Number(txn.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

          </div>

        </div>

        {/* Withdrawal Modal */}
        {showWithdrawModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
            <div style={{ width: '100%', maxWidth: 440, background: '#0E1320', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 20, overflow: 'hidden', boxShadow: '0 40px 80px rgba(0,0,0,0.6)' }}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 16, color: '#F0F4FF' }}>Request Withdrawal</div>
                  <div style={{ fontSize: 12, color: '#4B5580', marginTop: 2 }}>Amount: <strong style={{ color: '#F59E0B' }}>₱{(rebateCredits?.balance || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong></div>
                </div>
                <button onClick={() => setShowWithdrawModal(false)} style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#7A8AAA', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
              </div>
              <div style={{ padding: 24 }}>
                <div style={{ fontSize: 11, color: '#4B5580', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700, marginBottom: 10 }}>Select Release Method</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
                  {[
                    { value: 'Physical Cash', logo: '/cash-logo.png', label: 'Physical Cash', hint: 'Coordinate with admin in person', free: true },
                    { value: 'GCash', logo: '/gcash-logo.png', label: 'GCash', hint: 'Sent to your GCash number', free: false },
                    { value: 'RCBC', logo: '/rcbc-logo.png', label: 'RCBC Bank Transfer', hint: 'Transferred to your RCBC account', free: true },
                    { value: 'Other Bank', logo: '/bank-logo.png', label: 'Other Bank (Instapay/PESONet)', hint: 'Transfer fee applies', free: false },
                  ].map(m => (
                    <button key={m.value} onClick={() => { setWithdrawMethod(m.value); setWithdrawDetails('') }}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, border: `1.5px solid ${withdrawMethod === m.value ? 'rgba(245,158,11,0.5)' : 'rgba(255,255,255,0.07)'}`, background: withdrawMethod === m.value ? 'rgba(245,158,11,0.07)' : 'rgba(255,255,255,0.02)', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
                      <img src={m.logo} alt={m.label} style={{ width: 32, height: 32, objectFit: 'contain', flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: withdrawMethod === m.value ? '#F59E0B' : '#F0F4FF' }}>{m.label}</div>
                        <div style={{ fontSize: 11, color: '#4B5580', marginTop: 1 }}>{m.hint}</div>
                      </div>
                      {m.free && <span style={{ fontSize: 10, fontWeight: 700, color: '#22C55E', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 20, padding: '2px 8px' }}>Free</span>}
                      {withdrawMethod === m.value && <span style={{ fontSize: 14, color: '#F59E0B' }}>✓</span>}
                    </button>
                  ))}
                </div>
                {withdrawMethod && withdrawMethod !== 'Physical Cash' && (
                  <div style={{ marginBottom: 18 }}>
                    <div style={{ fontSize: 11, color: '#4B5580', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700, marginBottom: 8 }}>
                      {withdrawMethod === 'GCash' ? 'GCash Number & Name' : 'Account Number & Bank Name'}
                    </div>
                    <textarea value={withdrawDetails} onChange={e => setWithdrawDetails(e.target.value)}
                      placeholder={withdrawMethod === 'GCash' ? 'e.g. 09XX-XXX-XXXX · Juan Dela Cruz' : 'e.g. 1234-5678-9012 · BDO / BPI / UnionBank'}
                      rows={2} style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, color: '#F0F4FF', fontSize: 13, resize: 'none', outline: 'none', fontFamily: 'DM Sans, sans-serif' }} />
                  </div>
                )}
                {withdrawMethod === 'Physical Cash' && (
                  <div style={{ padding: '10px 14px', background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: 10, fontSize: 12, color: '#22C55E', marginBottom: 18 }}>
                    ✓ Admin will coordinate with you in person once the request is approved.
                  </div>
                )}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setShowWithdrawModal(false)} style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: '#7A8AAA', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                  <button
                    disabled={!withdrawMethod || (withdrawMethod !== 'Physical Cash' && !withdrawDetails.trim()) || withdrawing}
                    onClick={async () => {
                      setWithdrawing(true)
                      const methodDesc = withdrawMethod === 'Physical Cash' ? 'Physical Cash' : `${withdrawMethod} — ${withdrawDetails.trim()}`
                      const { error } = await supabase.from('wallet_transactions').insert({ borrower_id: borrower.id, type: 'withdrawal', amount: rebateCredits.balance, description: `Withdrawal request via ${methodDesc}`, status: 'pending' })
                      if (!error) {
                        await supabase.from('portal_notifications').insert({ borrower_id: borrower.id, type: 'withdrawal_requested', title: '💸 Withdrawal Requested', message: `Your withdrawal request of ₱${rebateCredits.balance.toLocaleString('en-PH', { minimumFractionDigits: 2 })} via ${withdrawMethod} is pending admin review.` })
                        fetchPortalData(code)
                        setShowWithdrawModal(false)
                      }
                      setWithdrawing(false)
                    }}
                    style={{ flex: 2, padding: '12px', borderRadius: 10, border: 'none', background: (!withdrawMethod || (withdrawMethod !== 'Physical Cash' && !withdrawDetails.trim())) ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg,#F59E0B,#D97706)', color: (!withdrawMethod || (withdrawMethod !== 'Physical Cash' && !withdrawDetails.trim())) ? '#4B5580' : '#fff', fontSize: 13, fontWeight: 700, cursor: (!withdrawMethod || (withdrawMethod !== 'Physical Cash' && !withdrawDetails.trim())) ? 'not-allowed' : 'pointer', fontFamily: 'Syne, sans-serif' }}>
                    {withdrawing ? 'Submitting...' : '💸 Submit Request'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    )
  }

  // ── PAYMENT METHODS PAGE ──────────────────────────────────────
  if (page === 'payment-methods') return (
    <div style={{ minHeight: '100dvh', background: '#080B14', fontFamily: 'DM Sans, sans-serif', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>

      <PortalHeader borrower={borrower} notifications={notifications} showNotifs={showNotifs} setShowNotifs={setShowNotifs} markAllRead={markAllRead} onBack={() => setPage('home')} subtitle="Payment Methods" />
      <div style={{ maxWidth: 620, margin: '0 auto', padding: '32px 20px 40px' }}>
        <div style={{ fontSize: 13, color: '#7A8AAA', marginBottom: 24, lineHeight: 1.7 }}>
          Choose any of the following methods to make your installment payments. After every payment, upload your proof through this portal so your admin can confirm it.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { logo: '/cash-logo.png', label: 'Physical Cash', fee: 'Free', feeColor: '#10B981', accent: 'rgba(16,185,129,0.05)', glow: 'rgba(16,185,129,0.2)', desc: 'Pay your admin directly in person.', steps: ['Prepare the exact installment amount in cash', 'Coordinate with your admin via Teams Chat', 'Hand over payment and request acknowledgement', 'Upload photo of receipt or acknowledgement'] },
            { logo: '/gcash-logo.png', label: 'GCash', fee: 'GCash Free', feeColor: '#3B82F6', accent: 'rgba(59,130,246,0.05)', glow: 'rgba(59,130,246,0.2)', desc: 'Send via GCash to Charlou June Ramil.', steps: ['Open GCash and select Send Money', { label: 'Send to: 09665835179 (Charlou June R.)', copy: '09665835179' }, 'Send the exact installment amount', '⚠️ Note: GCash to GCash is free. You must cover fees if using Bank-to-GCash or 3rd party apps.', 'Screenshot and upload the successful transaction'] },
            { logo: '/rcbc-logo.png', label: 'RCBC to RCBC', fee: 'Free', feeColor: '#EF4444', accent: 'rgba(239,68,68,0.05)', glow: 'rgba(239,68,68,0.2)', desc: 'Same-bank RCBC transfers are completely free.', steps: ['Log in to RCBC Online or App', { label: 'Transfer to: 9051147397 (John Paul Lacaron)', copy: '9051147397' }, 'Transfer exact installment amount', 'Screenshot the transfer confirmation', 'Upload the screenshot in the portal'] },
            { logo: '/maribank.png', label: 'MariBank', fee: 'Free', feeColor: '#F59E0B', accent: 'rgba(245,158,11,0.05)', glow: 'rgba(245,158,11,0.2)', desc: 'Send to Charlou June Ramil via MariBank.', steps: ['Open your bank app and select Transfer', 'Bank: MariBank PH', { label: 'Account: 12476681477 (Charlou June R.)', copy: '12476681477' }, 'Screenshot the transfer confirmation', 'Upload the screenshot in the portal'] },
            { logo: '/bank-logo.png', label: 'Other Bank', fee: 'Fee Applies', feeColor: '#8B5CF6', accent: 'rgba(139,92,246,0.05)', glow: 'rgba(139,92,246,0.2)', desc: 'Transfer from any bank via Instapay/PESONet.', steps: ['Use your bank online transfer or app', 'Choose Instapay (faster) or PESONet', 'Send exact installment amount + fee', 'Upload the screenshot in the portal'] },
          ].map((item, i) => (
            <div key={i} 
              onMouseEnter={() => setHoveredMethod(i)}
              onMouseLeave={() => setHoveredMethod(null)}
              onClick={() => setActiveMethod(activeMethod === i ? null : i)}
              style={{ 
                background: 'rgba(255,255,255,0.025)', 
                backdropFilter: 'blur(10px)',
                border: `1px solid ${activeMethod === i ? 'rgba(255,255,255,0.2)' : hoveredMethod === i ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)'}`,
                borderRadius: 24, 
                overflow: 'hidden', 
                transition: 'all 0.4s cubic-bezier(0.19, 1, 0.22, 1)',
                transform: hoveredMethod === i ? 'translateY(-4px)' : 'translateY(0)',
                boxShadow: hoveredMethod === i ? `0 20px 40px -15px ${item.glow}` : '0 4px 12px rgba(0,0,0,0.1)',
                cursor: 'pointer'
              }}
            >
              <div style={{ padding: '22px 26px', display: 'flex', alignItems: 'center', gap: 20, background: activeMethod === i ? `${item.accent.replace('0.05', '0.08')}` : item.accent }}>
                <div style={{ 
                  width: 60, height: 60, borderRadius: 16, background: 'rgba(255,255,255,0.05)', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden',
                  border: '1px solid rgba(255,255,255,0.08)',
                  boxShadow: '0 8px 16px rgba(0,0,0,0.2)'
                }}>
                  <img src={item.logo} alt={item.label} style={{ width: 40, height: 40, objectFit: 'contain' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                    <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 17, color: '#F0F4FF', letterSpacing: '-0.02em' }}>{item.label}</span>
                    <span style={{ fontSize: 10, fontWeight: 800, color: item.feeColor, background: `${item.feeColor}15`, padding: '3px 10px', borderRadius: 20, border: `1px solid ${item.feeColor}30`, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.fee}</span>
                  </div>
                  <div style={{ fontSize: 13, color: '#7A8AAA', fontWeight: 500 }}>{item.desc}</div>
                </div>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4B5580', transition: 'all 0.3s', transform: activeMethod === i ? 'rotate(180deg)' : 'rotate(0)' }}>
                  <ChevronDown size={18} />
                </div>
              </div>

              {/* Accordion Content */}
              <div style={{ 
                maxHeight: activeMethod === i ? 600 : 0, 
                opacity: activeMethod === i ? 1 : 0,
                transition: 'all 0.5s cubic-bezier(0.19, 1, 0.22, 1)',
                padding: activeMethod === i ? '0 26px 22px' : '0 26px 0',
                background: 'rgba(0,0,0,0.15)',
                overflow: 'hidden'
              }}>
                <div style={{ height: activeMethod === i ? 'auto' : 0 }}>
                  <div style={{ height: 1.5, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)', margin: '0 0 18px' }} />
                  <div style={{ fontSize: 10, color: '#4B5580', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 14, fontWeight: 800 }}>Repayment Instructions</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {item.steps.map((step, si) => {
                      const isObj = typeof step === 'object'
                      const txt = isObj ? step.label : step
                      const isWarn = txt.includes('⚠️')
                      return (
                        <div key={si} style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                          <div style={{ 
                            width: 24, height: 24, borderRadius: 8, 
                            background: isWarn ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.05)', 
                            border: `1px solid ${isWarn ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.1)'}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', 
                            fontSize: 10, fontWeight: 800, color: isWarn ? '#F59E0B' : '#7A8AAA', 
                            flexShrink: 0, marginTop: 1 
                          }}>{si + 1}</div>
                          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 13.5, color: isWarn ? '#F59E0B' : '#CBD5F0', lineHeight: 1.5, fontWeight: isWarn ? 600 : 400 }}>{txt}</span>
                            {isObj && step.copy && (
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleCopy(step.copy, txt) }}
                                style={{ 
                                  padding: '4px 10px', borderRadius: 8, border: `1px solid ${copiedKey === txt ? '#10B981' : 'rgba(99,102,241,0.3)'}`, 
                                  background: copiedKey === txt ? 'rgba(16,185,129,0.1)' : 'rgba(99,102,241,0.1)', 
                                  color: copiedKey === txt ? '#10B981' : '#8B5CF6', 
                                  fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s',
                                  display: 'flex', alignItems: 'center', gap: 6, margin: '2px 0'
                                }}
                              >
                                {copiedKey === txt ? '✓ Copied!' : '⧉ Copy'}
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ 
          marginTop: 24, padding: '18px 24px', 
          background: 'rgba(245,158,11,0.05)', 
          border: '1px solid rgba(245,158,11,0.2)', 
          borderRadius: 16, fontSize: 13, color: '#F59E0B', 
          lineHeight: 1.8, display: 'flex', gap: 14, alignItems: 'flex-start' 
        }}>
          <div style={{ fontSize: 20 }}>⚠️</div>
          <div>
            <strong style={{ color: '#F59E0B', display: 'block', marginBottom: 2, fontSize: 14, fontFamily: 'Syne, sans-serif', fontWeight: 800 }}>Important Reminder</strong>
            Always upload your proof of payment after every transaction. Your payment is only confirmed once your admin reviews and approves the proof.
          </div>
        </div>
      </div>
    </div>
  )

  // ── HOME PAGE ────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100dvh', background: '#080B14', fontFamily: 'DM Sans, sans-serif', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <style>{`
        
        @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes scaleIn { from{opacity:0;transform:scale(0.97)} to{opacity:1;transform:scale(1)} }
        .pc { animation: fadeUp 0.45s ease forwards; opacity: 0; }
        .pc:nth-child(1){animation-delay:0.05s}.pc:nth-child(2){animation-delay:0.1s}.pc:nth-child(3){animation-delay:0.15s}.pc:nth-child(4){animation-delay:0.2s}.pc:nth-child(5){animation-delay:0.25s}.pc:nth-child(6){animation-delay:0.3s}
        .nav-btn { transition: all 0.15s ease; }
        .nav-btn:hover { transform: translateX(2px); background: rgba(255,255,255,0.04) !important; }
        .inst-row { transition: all 0.15s ease; }
        .inst-row:hover { background: rgba(255,255,255,0.04) !important; }
        .upload-btn { transition: all 0.2s ease; }
        .upload-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(34,197,94,0.25) !important; }
        .stats-grid { transition: all 0.3s ease; }
        @media (max-width: 860px) { 
          .portal-grid { grid-template-columns: 1fr !important; } 
          .bottom-nav { display: flex !important; margin-top: 20px; }
          .main-content-area { padding-bottom: 80px !important; }
        }
        @media (max-width: 640px) { .stats-grid { grid-template-columns: repeat(2, 1fr) !important; } }
        @media (max-width: 500px) { 
          .header-user-info { display: none !important; } 
          .stats-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 520px) { .loan-meta-grid { grid-template-columns: 1fr 1fr !important; } }
        @media (max-width: 400px) { .ql-pay-btns { flex-direction: column !important; } }
        
        .bottom-nav {
          display: none;
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          height: 64px;
          background: rgba(8, 11, 20, 0.95);
          backdrop-filter: blur(20px);
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          align-items: center;
          justify-content: space-around;
          padding: 0 10px;
          z-index: 1000;
          box-shadow: 0 -10px 30px rgba(0,0,0,0.5);
        }
        .bn-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          background: none;
          border: none;
          color: #4B5580;
          cursor: pointer;
          transition: all 0.2s;
          padding: 8px;
          border-radius: 12px;
          flex: 1;
        }
        .bn-item.active { color: #8B5CF6; }
        .bn-item:active { transform: scale(0.92); background: rgba(255,255,255,0.04); }
        .bn-label { fontSize: 10px; fontWeight: 700; text-transform: uppercase; letter-spacing: 0.02em; }


        .ribbon-btn { transition: all 0.22s cubic-bezier(0.4, 0, 0.2, 1); position: relative; }
        .ribbon-btn:hover { 
          transform: translateY(-2px) scale(1.06); 
          background: rgba(255,255,255,0.06) !important; 
          border-color: rgba(255,255,255,0.12) !important;
          box-shadow: 0 8px 20px -6px rgba(0,0,0,0.4);
        }
        .ribbon-btn::after {
          content: attr(data-label);
          position: absolute;
          bottom: 100%;
          left: 50%;
          transform: translateX(-50%) translateY(4px);
          background: rgba(15, 23, 42, 0.95);
          color: #fff;
          padding: 5px 10px;
          border-radius: 8px;
          font-size: 10px;
          font-weight: 700;
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
          transition: all 0.2s ease;
          white-space: nowrap;
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          margin-bottom: 8px;
          font-family: 'Syne, sans-serif';
        }
        .ribbon-btn:hover::after {
          opacity: 1;
          visibility: visible;
          transform: translateX(-50%) translateY(0);
        }
      `}</style>

      <PortalHeader borrower={borrower} notifications={notifications} showNotifs={showNotifs} setShowNotifs={setShowNotifs} markAllRead={markAllRead} onSignOut={() => { setBorrower(null); setLoan(null); setAllLoans([]); setCode(''); setInputCode(''); localStorage.removeItem('lm_portal_code') }} />

      <div className="main-content-area" style={{ maxWidth: 1000, margin: '0 auto', padding: '28px 20px 48px' }}>

        {/* Main Portal View */}
        <div className="portal-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>
          
          {/* ── LEFT COLUMN ── */}
          <div>
            {/* Reloan Banner (Shows if latest loan is paid and no pending app) */}
            {borrower && (!loan || loan.status === 'Paid') && (!pendingApp || (pendingApp.status !== 'Pending' && pendingApp.status !== 'Approved')) && !renewalSent && (
              <div className="pc" style={{ 
                background: 'linear-gradient(135deg, #1e1b4b, #312e81)', 
                border: '1px solid rgba(139,92,246,0.3)', 
                borderRadius: 24, padding: 28, position: 'relative', overflow: 'hidden',
                boxShadow: '0 20px 40px -10px rgba(0,0,0,0.4)'
              }}>
                <div style={{ position: 'absolute', top: -30, right: -30, width: 140, height: 140, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.15), transparent)', pointerEvents: 'none' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(139,92,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a78bfa', fontSize: 24 }}>🚀</div>
                  <div>
                    <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 18, color: '#F0F4FF' }}>Quick Reloan Available</div>
                    <div style={{ fontSize: 13, color: '#7A8AAA' }}>You have no active loans. Apply for a new one instantly!</div>
                  </div>
                </div>
                <button 
                  onClick={handleFastTrackRenewal}
                  disabled={renewing}
                  style={{ width: '100%', padding: '14px', borderRadius: 14, border: 'none', background: renewing ? 'rgba(139,92,246,0.3)' : 'linear-gradient(135deg,#6366F1,#8B5CF6)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: renewing ? 'not-allowed' : 'pointer', fontFamily: 'Syne, sans-serif', transition: 'all 0.2s', boxShadow: '0 8px 20px rgba(99,102,241,0.3)' }}>
                  {renewing ? 'Submitting...' : '✨ Apply for a New Loan'}
                </button>
              </div>
            )}

            {/* Application Pending State */}
            {borrower && pendingApp && (pendingApp.status === 'Pending' || pendingApp.status === 'Approved') && (!loan || loan.status === 'Paid') && (
              <div className="pc" style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 24, padding: 32, textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>⏳</div>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 20, color: '#60A5FA', marginBottom: 8 }}>Application Under Review</div>
                <p style={{ fontSize: 14, color: '#7A8AAA', lineHeight: 1.6, maxWidth: 340, margin: '0 auto' }}>
                  Your reloan application for **₱{Number(pendingApp.requested_amount).toLocaleString()}** has been received and is currently being reviewed by our team.
                </p>
                <div style={{ marginTop: 24, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px', background: 'rgba(59,130,246,0.1)', borderRadius: 20, color: '#60A5FA', fontSize: 12, fontWeight: 700 }}>
                  <Clock size={14} /> Status: {pendingApp.status}
                </div>
              </div>
            )}

            {renewalSent && (
              <div className="pc" style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 24, padding: 32, textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>🎯</div>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 20, color: '#22C55E' }}>Success!</div>
                <p style={{ fontSize: 14, color: '#7A8AAA', marginTop: 8 }}>Your reloan application has been submitted successfully.</p>
              </div>
            )}

            {/* Conditional Display for Active Loan or No Active Loan Placeholder */}
            {loan && loan.status !== 'Paid' ? (
              <>
                {/* Dashboard Highlights Row (Mini-Stats) */}
              <div className="pc stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
                {[
                  (() => {
                    const isQL = loan.loan_type === 'quickloan'
                    if (isQL) {
                      const releaseDate = loan.release_date ? (() => { const [y,m,d] = loan.release_date.split('-').map(Number); return new Date(y,m-1,d) })() : null
                      const daysElapsed = releaseDate ? Math.max(0, Math.floor((new Date() - releaseDate) / 86400000)) : 0
                      const target = daysElapsed <= 15 ? 15 : 30
                      const daysLeft = Math.max(0, target - daysElapsed)
                      const targetDate = releaseDate ? new Date(releaseDate.getTime() + target * 86400000) : null
                      return {
                        label: daysElapsed <= 15 ? 'Day 15 Target' : 'Day 30 Deadline',
                        value: daysLeft > 0 ? `${daysLeft} Days Left` : (daysElapsed <= 30 ? 'Due Today' : 'Overdue'),
                        sub: targetDate ? targetDate.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—',
                        icon: <Calendar size={14} />,
                        color: daysElapsed > 30 ? '#EF4444' : daysElapsed > 15 ? '#F59E0B' : '#22C55E',
                        bg: daysElapsed > 30 ? 'rgba(239,68,68,0.08)' : daysElapsed > 15 ? 'rgba(245,158,11,0.08)' : 'rgba(34,197,94,0.08)',
                        border: daysElapsed > 30 ? 'rgba(239,68,68,0.2)' : daysElapsed > 15 ? 'rgba(245,158,11,0.2)' : 'rgba(34,197,94,0.2)'
                      }
                    }
                    const dates = getDueDates(loan.release_date, loan.payments_made, loan.num_installments)
                    const next = dates.find(d => !d.paid)
                    const now = new Date()
                    const diff = next ? Math.ceil((new Date(next.date) - now) / (1000 * 60 * 60 * 24)) : null
                    return {
                      label: 'Next Payday',
                      value: next ? (diff > 0 ? `${diff} Days Left` : 'Due Today') : 'No pending',
                      sub: next ? formatDate(next.dateStr) : 'Fully Paid',
                      icon: <Calendar size={14} />,
                      color: '#8B5CF6',
                      bg: 'rgba(139,92,246,0.08)',
                      border: 'rgba(139,92,246,0.2)'
                    }
                  })(),
                  { 
                    label: 'Available Rebates', 
                    value: '₱' + (rebateCredits?.balance || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 }),
                    sub: 'Wallet Balance',
                    icon: <CreditCard size={14} />,
                    color: '#22C55E',
                    bg: 'rgba(34,197,94,0.08)',
                    border: 'rgba(34,197,94,0.2)'
                  },
                  { 
                    label: 'Credit Health', 
                    value: getBadgeConfig(borrower.loyalty_badge).label,
                    sub: `${borrower.credit_score || 750} Points`,
                    icon: <CheckCircle size={14} />,
                    color: '#3B82F6',
                    bg: 'rgba(59,130,246,0.08)',
                    border: 'rgba(59,130,246,0.2)'
                  }
                ].map((stat, i) => (
                  <div key={i} style={{ background: '#0E1320', border: `1px solid ${stat.border}`, borderRadius: 16, padding: '14px 16px', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: -10, right: -10, width: 40, height: 40, borderRadius: '50%', background: stat.bg, filter: 'blur(10px)', pointerEvents: 'none' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <div style={{ color: stat.color }}>{stat.icon}</div>
                      <span style={{ fontSize: 10, color: '#4B5580', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800 }}>{stat.label}</span>
                    </div>
                    <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 15, color: '#F0F4FF' }}>{stat.value}</div>
                    <div style={{ fontSize: 10, color: '#7A8AAA', marginTop: 2 }}>{stat.sub}</div>
                  </div>
                ))}
              </div>

              {/* Loan Hero Card */}
              <div className="pc" style={{ background: 'linear-gradient(135deg,#0d1425,#160e30)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 20, padding: 24, marginBottom: 16, position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: -60, right: -60, width: 240, height: 240, borderRadius: '50%', background: 'radial-gradient(circle,rgba(99,102,241,0.06),transparent)', pointerEvents: 'none' }} />

                <div style={{ marginBottom: 20 }}>
                  {(() => {
                    const isQL = loan.loan_type === 'quickloan'
                    if (isQL) {
                      const principal = Number(loan.loan_amount)
                      const releaseDate = loan.release_date ? (() => { const [y,m,d] = loan.release_date.split('-').map(Number); return new Date(y,m-1,d) })() : null
                      const daysElapsed = releaseDate && loan.status !== 'Pending' ? Math.max(0, Math.floor((new Date() - releaseDate) / 86400000)) : 0
                      const dailyInterest = parseFloat((principal * 0.1 / 30).toFixed(2))
                      const accrued = parseFloat((dailyInterest * daysElapsed).toFixed(2))
                      const extensionFee = loan.extension_fee_charged ? 100 : 0
                      const penaltyDays = Math.max(0, daysElapsed - 30)
                      const penalty = penaltyDays * 25
                      const liveTotal = loan.status === 'Paid' ? 0 : parseFloat((principal + accrued + extensionFee + penalty).toFixed(2))
                      const phase = daysElapsed > 30 ? 'penalty' : daysElapsed > 15 ? 'extended' : 'active'
                      const balColor = loan.status === 'Paid' ? '#22C55E' : phase === 'penalty' ? '#EF4444' : phase === 'extended' ? '#F59E0B' : '#F0F4FF'
                      return (
                        <>
                          <div style={{ fontSize: 11, color: '#4B5580', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6, fontWeight: 700 }}>
                            {loan.status === 'Pending' ? 'Loan Amount' : 'Total Owed Today'}
                          </div>
                          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 44, color: balColor, lineHeight: 1, letterSpacing: -2, marginBottom: 10 }}>
                            ₱{(loan.status === 'Pending' ? principal : liveTotal).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          </div>
                          {loan.status !== 'Pending' && daysElapsed > 0 && (
                            <div style={{ fontSize: 11, color: '#7A8AAA', marginBottom: 8 }}>₱{principal.toLocaleString('en-PH')} principal + ₱{accrued.toFixed(2)} interest ({daysElapsed}d)</div>
                          )}
                        </>
                      )
                    }
                    return (
                      <>
                        <div style={{ fontSize: 11, color: '#4B5580', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6, fontWeight: 700 }}>Remaining Balance</div>
                        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 44, color: loan.status === 'Paid' ? '#22C55E' : '#F0F4FF', lineHeight: 1, letterSpacing: -2, marginBottom: 10 }}>
                          ₱{Number(loan.remaining_balance).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </div>
                      </>
                    )
                  })()}
                  <StatusBadge status={loan.status} />
                </div>

                {/* Progress bar */}
                {(() => {
                  const isQL = loan.loan_type === 'quickloan'
                  if (isQL) {
                    const releaseDate = loan.release_date ? (() => { const [y,m,d] = loan.release_date.split('-').map(Number); return new Date(y,m-1,d) })() : null
                    const daysElapsed = releaseDate ? Math.max(0, Math.floor((new Date() - releaseDate) / 86400000)) : 0
                    const pct = Math.min(100, Math.round((daysElapsed / 30) * 100))
                    const phase = daysElapsed > 30 ? 'penalty' : daysElapsed > 15 ? 'extended' : 'active'
                    const barColor = phase === 'penalty' ? '#EF4444' : phase === 'extended' ? '#F59E0B' : '#22C55E'
                    return (
                      <div style={{ marginBottom: 20 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12, color: '#7A8AAA' }}>
                          <span>⚡ QuickLoan — Day {daysElapsed} of 30</span>
                          <span style={{ color: barColor, fontWeight: 700 }}>{phase === 'penalty' ? '🔴 Overdue' : phase === 'extended' ? '🟡 Extended' : '🟢 Active'}</span>
                        </div>
                        <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: pct + '%', background: barColor, borderRadius: 3, transition: 'width 1s ease' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10, color: '#4B5580' }}>
                          <span>Release</span><span>Day 15 (Early)</span><span>Day 30 (Max)</span>
                        </div>
                      </div>
                    )
                  }
                  const paid = loan.payments_made || 0
                  const total = loan.num_installments || 4
                  const pct = Math.round((paid / total) * 100)
                  return (
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12, color: '#7A8AAA' }}>
                        <span>{paid} of {total} installments paid</span>
                        <span style={{ color: pct === 100 ? '#22C55E' : '#F0F4FF', fontWeight: 700 }}>{pct}% complete</span>
                      </div>
                      <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: pct + '%', background: pct === 100 ? '#22C55E' : 'linear-gradient(90deg,#6366F1,#8B5CF6,#22C55E)', borderRadius: 3, transition: 'width 1s ease' }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
                        {Array.from({ length: total }, (_, i) => i + 1).map(i => (
                          <div key={i} style={{ width: 26, height: 26, borderRadius: '50%', background: i <= paid ? (i === total ? '#22C55E' : '#8B5CF6') : 'rgba(255,255,255,0.05)', border: `1.5px solid ${i <= paid ? (i === total ? '#22C55E' : '#8B5CF6') : 'rgba(255,255,255,0.1)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: i <= paid ? '#fff' : '#4B5580', flexShrink: 0 }}>
                            {i <= paid ? '✓' : i}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })()}

                {/* Meta grid */}
                <div className="loan-meta-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
                  {(() => {
                    const isQL = loan.loan_type === 'quickloan'
                    const principal = Number(loan.loan_amount)
                    const dailyInterest = parseFloat((principal * 0.1 / 30).toFixed(2))
                    return [
                      { label: 'Approved Amount', value: '₱' + principal.toLocaleString('en-PH'), color: '#F0F4FF' },
                      { label: 'Loan Purpose', value: loan.loan_purpose || 'Not specified', color: '#8B5CF6' },
                      isQL
                        ? { label: 'Daily Interest', value: `₱${dailyInterest.toFixed(2)}/day`, color: '#60A5FA' }
                        : { label: 'Security Hold', value: loan.security_hold > 0 ? `🔒 ₱${Number(loan.security_hold).toLocaleString('en-PH')}` : '—', color: '#F59E0B' },
                      isQL
                        ? { label: 'Interest Rate', value: '10%/month (daily)', color: '#a78bfa' }
                        : { label: 'Per Installment', value: '₱' + Math.ceil(Number(loan.installment_amount)).toLocaleString('en-PH', { minimumFractionDigits: 2 }), color: '#a78bfa' },
                    ]
                  })().map((m, i) => (
                    <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '14px 16px' }}>
                      <div style={{ fontSize: 10, color: '#4B5580', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6, fontWeight: 700 }}>{m.label}</div>
                      <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15, color: m.color }}>{m.value}</div>
                    </div>
                  ))}
                </div>

                {/* Dates */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                  <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ fontSize: 9, color: '#4B5580', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4, fontWeight: 700 }}>Release Date</div>
                    <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, color: '#F59E0B' }}>{formatDate(loan.release_date)}</div>
                  </div>
                  {(() => {
                    const numInst = loan.num_installments || 4
                    const dueDates = getDueDates(loan.release_date, loan.payments_made || 0, numInst)
                    const maturity = dueDates.length >= numInst ? dueDates[numInst - 1].date.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' }) : 'TBD'
                    return (
                      <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: '10px 12px' }}>
                        <div style={{ fontSize: 9, color: '#4B5580', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4, fontWeight: 700 }}>Maturity Date</div>
                        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, color: '#F59E0B' }}>{maturity}</div>
                      </div>
                    )
                  })()}
                </div>
              </div>

              {/* E-Signature Banner */}
              {!loan.agreement_confirmed && (
                <div className="pc" style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 14, padding: '14px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#a78bfa', marginBottom: 2 }}>✍ Sign Your Loan Agreement</div>
                    <div style={{ fontSize: 12, color: '#4B5580' }}>Your e-signature is required to activate your loan terms.</div>
                  </div>
                  <button onClick={() => setShowSignModal(true)}
                    style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#6366F1,#8B5CF6)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Syne, sans-serif', whiteSpace: 'nowrap' }}>
                    Sign Now
                  </button>
                </div>
              )}
              {loan.agreement_confirmed && loan.e_signature_name && (
                <div className="pc" style={{ background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: 14, padding: '12px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: 12, color: '#22C55E', fontWeight: 600 }}>✅ Loan Agreement signed by {loan.e_signature_name} · {new Date(loan.e_signature_date || '').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                  <button onClick={() => loan.loan_type === 'quickloan' ? generateBorrowerQuickLoanPDF(loan, borrower) : generateBorrowerLoanAgreementPDF(loan, borrower)} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid rgba(34,197,94,0.25)', background: 'rgba(34,197,94,0.08)', color: '#22C55E', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>↓ Download</button>
                </div>
              )}

                {/* QuickLoan Payment Actions — moved to sidebar */}

                {/* ── Truth in Lending Act Disclosure ── landscape card ── */}
                {loan && loan.status !== 'Pending' && loan.loan_type === 'quickloan' && (() => {
                  const principal = parseFloat(loan.current_principal ?? loan.loan_amount) || 0
                  const dailyAmt = parseFloat((principal * 0.1 / 30).toFixed(2))
                  const day15Int = parseFloat((dailyAmt * 15).toFixed(2))
                  const day15Tot = parseFloat((principal + day15Int + 100).toFixed(2))
                  const day30Int = parseFloat((dailyAmt * 30).toFixed(2))
                  const day30Tot = parseFloat((principal + day30Int).toFixed(2))
                  const rel = loan.release_date
                  const fmtD = (rel, plus) => {
                    if (!rel) return 'TBD'
                    const [y,m,d] = rel.split('-').map(Number)
                    const dt = new Date(y,m-1,d); dt.setDate(dt.getDate()+plus)
                    return dt.toLocaleDateString('en-PH',{month:'short',day:'numeric'})
                  }
                  return (
                    <div className="pc" style={{ background: 'linear-gradient(135deg,#0A0F1E,#0d0a00)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 16, overflow: 'hidden', marginBottom: 16 }}>
                      {/* Header */}
                      <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(245,158,11,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                          <img src="/id-logo.png" alt="tila" style={{ width: 18, height: 18, objectFit: 'contain', opacity: 0.75 }} />
                          <div>
                            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 12, color: '#F0F4FF' }}>Truth in Lending Disclosure</div>
                            <div style={{ fontSize: 9, color: '#F59E0B', fontWeight: 600 }}>RA 3765 — Republic Act No. 3765 (Philippines)</div>
                          </div>
                        </div>
                        <span style={{ fontSize: 9, color: '#F59E0B', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 12, padding: '2px 8px', fontWeight: 700 }}>QuickLoan</span>
                      </div>
                      {/* Stats row — landscape */}
                      <div style={{ padding: '12px 18px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        {[
                          { label: 'Loan Principal', value: `₱${principal.toLocaleString('en-PH',{minimumFractionDigits:2})}`, color: '#F0F4FF' },
                          { label: 'Daily Rate', value: '0.33% / day', color: '#F59E0B' },
                          { label: 'Daily Interest', value: `₱${dailyAmt.toFixed(2)} / day`, color: '#F59E0B' },
                          { label: 'Effective Annual', value: '120% p.a.', color: '#a78bfa' },
                        ].map((col, i) => (
                          <div key={i} style={{ textAlign: 'center', padding: '8px 4px', background: 'rgba(255,255,255,0.02)', borderRadius: 9, border: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ fontSize: 8, color: '#4B5580', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5, fontWeight: 700 }}>{col.label}</div>
                            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 12, color: col.color }}>{col.value}</div>
                          </div>
                        ))}
                      </div>
                      {/* Repayment schedule — full-width rows */}
                      <div style={{ padding: '0 18px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {[
                          {
                            phase: 'Day 15',
                            date: fmtD(rel, 15),
                            detail: `₱${day15Int.toFixed(2)} interest + ₱100 extension fee`,
                            total: `₱${day15Tot.toFixed(2)}`,
                            color: '#22C55E',
                            tag: 'Early Target',
                          },
                          {
                            phase: 'Day 30',
                            date: fmtD(rel, 30),
                            detail: `₱${day30Int.toFixed(2)} accrued interest — full settlement`,
                            total: `₱${day30Tot.toFixed(2)}`,
                            color: '#F59E0B',
                            tag: 'Deadline',
                          },
                          {
                            phase: 'After Day 30',
                            date: 'Ongoing',
                            detail: '₱25/day penalty accrues on top of daily interest',
                            total: '+₱25/day',
                            color: '#EF4444',
                            tag: '⚠ Penalty',
                          },
                        ].map((row, i) => (
                          <div key={i} style={{
                            display: 'flex', alignItems: 'center', gap: 12,
                            background: `${row.color}07`, border: `1px solid ${row.color}20`,
                            borderLeft: `3px solid ${row.color}`, borderRadius: 9,
                            padding: '9px 14px',
                          }}>
                            {/* Phase */}
                            <div style={{ minWidth: 72, flexShrink: 0 }}>
                              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 11, color: row.color }}>{row.phase}</div>
                              <div style={{ fontSize: 9, color: '#4B5580', marginTop: 1 }}>{row.date}</div>
                            </div>
                            {/* Divider */}
                            <div style={{ width: 1, height: 28, background: `${row.color}20`, flexShrink: 0 }} />
                            {/* Detail */}
                            <div style={{ flex: 1, fontSize: 10, color: '#7A8AAA', lineHeight: 1.5 }}>{row.detail}</div>
                            {/* Total + badge */}
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 900, fontSize: 13, color: row.color }}>{row.total}</div>
                              <span style={{ fontSize: 8, color: row.color, background: `${row.color}18`, borderRadius: 4, padding: '1px 6px', fontWeight: 700, marginTop: 2, display: 'inline-block' }}>{row.tag}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      {/* Footnote */}
                      <div style={{ padding: '8px 18px 12px', fontSize: 9, color: '#4B5580', lineHeight: 1.7 }}>
                        <span style={{ color: '#F59E0B', fontWeight: 700 }}>RA 3765 Disclosure. </span>
                        Interest of <strong style={{ color: '#F0F4FF' }}>10%/month (0.33%/day)</strong> is charged on the outstanding principal. Daily interest resets after each approved principal payment. MoneyfestLending is a private colleague lending program and is not a BSP-supervised institution.
                      </div>
                    </div>
                  )
                })()}

                {/* ── Truth in Lending Act Disclosure (installment only — QL version is in sidebar) ── */}
                {loan && loan.status !== 'Pending' && loan.loan_type !== 'quickloan' && (() => {
                    const principal = parseFloat(loan.loan_amount) || 0
                    const holdAmt = loan.security_hold ? parseFloat(loan.security_hold) : principal * 0.10
                    const holdRate = principal > 0 ? ((holdAmt / principal) * 100).toFixed(0) : 10
                    const released = loan.funds_released ? parseFloat(loan.funds_released) : principal - holdAmt
                    const total = parseFloat(loan.total_repayment) || 0
                    const financeCharge = total - principal
                    const rate = ((loan.interest_rate || 0.07) * 100).toFixed(0)
                    const earRate = ((loan.interest_rate || 0.07) * 12 * 100).toFixed(0)
                    const perInst = Math.ceil(parseFloat(loan.installment_amount) || 0)
                    const numInst = loan.num_installments || 4
                    const loanTerm = loan.loan_term || 2
                    return (
                      <div className="pc" style={{ background: 'linear-gradient(135deg,#0A0F1E,#0e1020)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 18, overflow: 'hidden', marginBottom: 16 }}>
                        <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', gap: 10 }}>
                          <img src="/id-logo.png" alt="disclosure" style={{ width: 20, height: 20, objectFit: 'contain', opacity: 0.75 }} />
                          <div>
                            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 12, color: '#F0F4FF' }}>Truth in Lending Disclosure</div>
                            <div style={{ fontSize: 9, color: '#a78bfa', fontWeight: 600, marginTop: 1 }}>RA 3765 — Republic Act No. 3765 (Philippines)</div>
                          </div>
                        </div>
                        <div style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginBottom: 12 }}>
                            {[
                              { label: 'Approved Amount', value: `₱${principal.toLocaleString('en-PH',{minimumFractionDigits:2})}`, color: '#F0F4FF' },
                              { label: `Security Hold (${holdRate}%)`, value: `₱${holdAmt.toLocaleString('en-PH',{minimumFractionDigits:2})}`, color: '#F59E0B' },
                              { label: 'Released to You', value: `₱${released.toLocaleString('en-PH',{minimumFractionDigits:2})}`, color: '#22C55E' },
                              { label: 'Finance Charge', value: `₱${financeCharge.toLocaleString('en-PH',{minimumFractionDigits:2})}`, color: '#F59E0B' },
                              { label: `Rate × ${loanTerm}mo`, value: `${rate}%/mo`, color: '#60A5FA' },
                              { label: 'Annual Rate', value: `${earRate}% p.a.`, color: '#a78bfa' },
                              { label: 'Total Payable', value: `₱${total.toLocaleString('en-PH',{minimumFractionDigits:2})}`, color: '#22C55E' },
                              { label: `${numInst} Installments`, value: `₱${perInst.toLocaleString('en-PH',{minimumFractionDigits:2})}/ea`, color: '#F0F4FF' },
                            ].map((row, i) => (
                              <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '8px 10px' }}>
                                <div style={{ fontSize: 8, color: '#4B5580', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3, fontWeight: 700 }}>{row.label}</div>
                                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 12, color: row.color }}>{row.value}</div>
                              </div>
                            ))}
                          </div>
                          <div style={{ padding: '9px 11px', background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.12)', borderRadius: 8, fontSize: 9.5, color: '#7A8AAA', lineHeight: 1.7 }}>
                            <span style={{ color: '#a78bfa', fontWeight: 700 }}>RA 3765.</span> Installments on the <strong style={{ color: '#F0F4FF' }}>5th & 20th</strong> of each month. Security Hold of <strong style={{ color: '#F0F4FF' }}>₱{holdAmt.toLocaleString('en-PH',{minimumFractionDigits:2})}</strong> returned upon full repayment. Late penalty: ₱20/day per installment.
                          </div>
                        </div>
                      </div>
                    )
                })()}

              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '100px 20px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 24 }}>
                <div style={{ fontSize: 52, marginBottom: 16 }}>🏦</div>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 24, color: '#F0F4FF', marginBottom: 12 }}>No Active Loan</div>
                <p style={{ fontSize: 14, color: '#7A8AAA', marginBottom: 24, maxWidth: 300, margin: '0 auto 24px' }}>
                  You don't have an active loan at the moment. Explore our loan options or check back later!
                </p>
                <a href="/apply" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 28px', borderRadius: 14, background: 'linear-gradient(135deg,#3B82F6,#2563EB)', color: '#fff', fontSize: 14, fontWeight: 700, textDecoration: 'none', fontFamily: 'Syne, sans-serif' }}>
                  Apply for a Loan →
                </a>
              </div>
            )}
          </div>{/* end left column */}

            {/* ── RIGHT SIDEBAR ── */}
            <div className="portal-sidebar" style={{ display: 'flex', flexDirection: 'column', gap: 14, position: 'sticky', top: 76 }}>

              {/* Borrower / Road to VIP card */}
              <div className="pc" style={{ background: 'linear-gradient(135deg,#0E1320,#160e30)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 20, padding: 22, boxShadow: '0 10px 30px -10px rgba(0,0,0,0.5)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 14, background: 'linear-gradient(135deg,#3B82F6,#8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 900, color: '#fff', flexShrink: 0, fontFamily: 'Syne, sans-serif', boxShadow: '0 4px 12px rgba(139,92,246,0.3)' }}>
                    {borrower.full_name?.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 14, color: '#F0F4FF', letterSpacing: '-0.01em' }}>{borrower.full_name}</div>
                    <div style={{ fontSize: 11, color: '#4B5580', marginTop: 1 }}>{borrower.department}</div>
                  </div>
                </div>

                {/* Quick Action Ribbon with Tooltips */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                  {[
                    { icon: <Clock size={16} />, page: 'payment-history', label: 'History', color: '#22C55E' },
                    { icon: <User size={16} />, page: 'profile', label: 'My Profile', color: '#3B82F6' },
                    { icon: <Wallet size={16} />, page: 'wallet', label: 'Wallet', color: '#F59E0B' },
                  ].map((item, i) => (
                    <button key={i} onClick={() => setPage(item.page)} className="ribbon-btn" data-label={item.label}
                      style={{ 
                        flex: 1, height: 42, borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', 
                        background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                        color: item.color, cursor: 'pointer', outline: 'none'
                      }}>
                      {item.icon}
                      <div style={{ position: 'absolute', bottom: 0, left: '20%', right: '20%', height: 2, background: item.color, opacity: 0.4, borderRadius: '2px 2px 0 0' }} />
                    </button>
                  ))}
                  {/* Repay Now — direct action */}
                  <button
                    className="ribbon-btn"
                    data-label="Repay Now"
                    onClick={() => {
                      if (!loan || loan.status === 'Pending' || loan.status === 'Paid') return
                      if (loan.loan_type === 'quickloan') {
                        document.getElementById('payment-section')?.scrollIntoView({ behavior: 'smooth' })
                      } else {
                        setUploadModal((loan.payments_made || 0) + 1)
                      }
                    }}
                    style={{
                      flex: 1, height: 42, borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)',
                      background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#8B5CF6', cursor: loan && loan.status !== 'Pending' && loan.status !== 'Paid' ? 'pointer' : 'not-allowed',
                      outline: 'none', opacity: loan && loan.status !== 'Pending' && loan.status !== 'Paid' ? 1 : 0.4
                    }}>
                    <CreditCard size={16} />
                    <div style={{ position: 'absolute', bottom: 0, left: '20%', right: '20%', height: 2, background: '#8B5CF6', opacity: 0.4, borderRadius: '2px 2px 0 0' }} />
                  </button>
                </div>

                {(() => {
                  const score = borrower.credit_score || 750
                  const currentBadge = getBadgeConfig(borrower.loyalty_badge || 'New')
                  const nextBadgeIdx = BADGE_TIERS.findIndex(b => b.id === currentBadge.id) + 1
                  const nextBadge = BADGE_TIERS[nextBadgeIdx] || null
                  
                  const scorePct = ((score - 300) / 700) * 100

                  return (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', marginBottom: 16 }}>
                        <span style={{ fontSize: 18 }}>{currentBadge.emoji}</span>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 800, color: currentBadge.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{currentBadge.label}</div>
                          <div style={{ fontSize: 11, color: '#4B5580' }}>Current Status</div>
                        </div>
                      </div>

                      {nextBadge ? (
                        <div style={{ marginTop: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: '#CBD5F0' }}>Road to {nextBadge.label}</span>
                              <span style={{ fontSize: 12 }}>{nextBadge.emoji}</span>
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 800, color: nextBadge.color }}>{nextBadge.minScore - score} pts left</span>
                          </div>
                          <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden', marginBottom: 12 }}>
                            <div style={{ 
                              height: '100%', 
                              width: Math.min(100, Math.max(5, ((score - currentBadge.minScore) / (nextBadge.minScore - currentBadge.minScore)) * 100)) + '%', 
                              background: `linear-gradient(90deg, ${currentBadge.color}, ${nextBadge.color})`, 
                              borderRadius: 3, 
                              transition: 'width 1s ease' 
                            }} />
                          </div>
                          <div style={{ padding: '10px', background: `${nextBadge.color}08`, border: `1px solid ${nextBadge.color}15`, borderRadius: 10 }}>
                            <div style={{ fontSize: 9, color: nextBadge.color, textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.05em', marginBottom: 4 }}>Next Perk Unlocked</div>
                            <div style={{ fontSize: 11, color: '#CBD5F0', lineHeight: 1.4 }}>{nextBadge.desc}</div>
                          </div>
                        </div>
                      ) : (
                        <div style={{ padding: '12px', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 12, textAlign: 'center' }}>
                          <div style={{ fontSize: 14, fontWeight: 800, color: '#8B5CF6' }}>👑 Maximum Rank!</div>
                          <div style={{ fontSize: 11, color: '#a78bfa', marginTop: 4 }}>You've earned all VIP benefits.</div>
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>


              {/* Payment Options in sidebar (QuickLoan only) */}
              <div id="payment-section">
              {loan && loan.loan_type === 'quickloan' && loan.status !== 'Pending' && (
                <div className="pc" style={{ background: '#0E1320', border: '1px solid rgba(99,102,241,0.18)', borderRadius: 16, overflow: 'hidden' }}>
                  <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: 7 }}>
                    <div style={{ width: 22, height: 22, borderRadius: 6, background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <CreditCard size={12} color="#a78bfa" />
                    </div>
                    <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 11, color: '#F0F4FF', letterSpacing: '0.02em' }}>Payment Options</div>
                  </div>
                  <div style={{ padding: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    <button onClick={() => setShowPrincipalModal(true)}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '12px 6px', borderRadius: 11, border: '1.5px solid rgba(99,102,241,0.3)', background: 'linear-gradient(135deg,rgba(99,102,241,0.1),rgba(139,92,246,0.07))', cursor: 'pointer', textAlign: 'center', minHeight: 80 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg,#6366F1,#8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 3px 8px rgba(99,102,241,0.4)' }}>
                        <CreditCard size={14} color="#fff" />
                      </div>
                      <div style={{ fontSize: 9.5, fontWeight: 800, color: '#F0F4FF', fontFamily: 'Syne, sans-serif', lineHeight: 1.3 }}>Pay{<br/>}Principal</div>
                    </button>
                    <button onClick={() => { setQlPaymentType('full_payoff'); setUploadModal(1) }}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '12px 6px', borderRadius: 11, border: '1.5px solid rgba(34,197,94,0.3)', background: 'rgba(34,197,94,0.06)', cursor: 'pointer', textAlign: 'center', minHeight: 80 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg,#22C55E,#16A34A)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 3px 8px rgba(34,197,94,0.35)' }}>
                        <CheckCircle size={14} color="#fff" />
                      </div>
                      <div style={{ fontSize: 9.5, fontWeight: 800, color: '#F0F4FF', fontFamily: 'Syne, sans-serif', lineHeight: 1.3 }}>Full{<br/>}Pay-Off</div>
                    </button>
                    {!loan.extension_fee_charged
                      ? <button onClick={() => { setQlPaymentType('interest_only'); setUploadModal(1) }}
                          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '12px 6px', borderRadius: 11, border: '1.5px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.05)', cursor: 'pointer', textAlign: 'center', minHeight: 80 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg,#F59E0B,#D97706)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 3px 8px rgba(245,158,11,0.35)' }}>
                            <Clock size={14} color="#fff" />
                          </div>
                          <div style={{ fontSize: 9.5, fontWeight: 800, color: '#F0F4FF', fontFamily: 'Syne, sans-serif', lineHeight: 1.3 }}>Interest{<br/>}Only</div>
                        </button>
                      : <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '12px 6px', borderRadius: 11, border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)', textAlign: 'center', minHeight: 80 }}>
                          <div style={{ fontSize: 16 }}>✅</div>
                          <div style={{ fontSize: 9, color: '#4B5580', lineHeight: 1.3 }}>Extended</div>
                        </div>
                    }
                  </div>
                </div>
              )}

              {/* Payment Actions in sidebar (Installment Loans) */}
              {loan && loan.loan_type !== 'quickloan' && loan.status !== 'Pending' && loan.status !== 'Paid' && (
                <div className="pc" style={{ background: '#0E1320', border: '1px solid rgba(34,197,94,0.18)', borderRadius: 16, overflow: 'hidden' }}>
                  <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: 7 }}>
                    <div style={{ width: 22, height: 22, borderRadius: 6, background: 'rgba(34,197,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <CreditCard size={12} color="#22C55E" />
                    </div>
                    <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 11, color: '#F0F4FF', letterSpacing: '0.02em' }}>Next Installment</div>
                  </div>
                  <div style={{ padding: '14px', textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: '#7A8AAA', marginBottom: 4, fontWeight: 600 }}>Installment {(loan.payments_made || 0) + 1} of {loan.num_installments || 4}</div>
                    <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 24, fontWeight: 800, color: '#22C55E', marginBottom: 12 }}>
                       ₱{Math.ceil(loan.installment_amount || 0).toLocaleString('en-PH')}
                    </div>
                    <button onClick={() => setUploadModal((loan.payments_made || 0) + 1)} style={{ width: '100%', padding: '10px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#22C55E,#16A34A)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Syne, sans-serif', boxShadow: '0 4px 12px rgba(34,197,94,0.3)', transition: 'all 0.2s' }} className="upload-btn">
                      Upload Payment Proof
                    </button>
                    <div style={{ marginTop: 10, fontSize: 9, color: '#4B5580', lineHeight: 1.4 }}>Submit your transfer receipt to update your payment status.</div>
                  </div>
                </div>
              )}
              </div>

              {/* Calendar: keep for installment loans only */}
              {(!loan || loan.loan_type !== 'quickloan') && (
                <div className="pc" style={{ background: '#0E1320', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, overflow: 'hidden' }}>
                  <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.01)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Calendar size={13} style={{ color: '#4B5580' }} />
                        <span style={{ fontSize: 10, color: '#4B5580', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800 }}>Payment Schedule</span>
                      </div>
                      <span style={{ fontSize: 9, color: '#7A8AAA', background: 'rgba(255,255,255,0.05)', padding: '1px 6px', borderRadius: 4 }}>{new Date().toLocaleDateString('en-PH', { month: 'short' })}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
                      {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => (
                        <div key={d} style={{ textAlign: 'center', fontSize: 9, color: '#4B5580', fontWeight: 800, paddingBottom: 4 }}>{d}</div>
                      ))}
                      {(() => {
                        const now = new Date()
                        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).getDay()
                        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
                        const items = []
                        for (let i = 0; i < firstDay; i++) items.push(<div key={`p-${i}`} />)
                        for (let d = 1; d <= daysInMonth; d++) {
                          const isPayDay = d === 5 || d === 20
                          const isToday = d === now.getDate()
                          items.push(
                            <div key={d} style={{ aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, borderRadius: 6, background: isPayDay ? (isToday ? '#22C55E' : 'rgba(99,102,241,0.12)') : isToday ? 'rgba(255,255,255,0.06)' : 'transparent', border: isPayDay ? `1px solid ${isToday ? '#22C55E' : 'rgba(99,102,241,0.25)'}` : 'none', color: isPayDay ? '#F0F4FF' : isToday ? '#F0F4FF' : '#4B5580', fontWeight: isPayDay || isToday ? 800 : 400, position: 'relative' }}>
                              {d}
                              {isPayDay && <div style={{ position: 'absolute', bottom: 1, width: 2, height: 2, borderRadius: '50%', background: '#8B5CF6' }} />}
                            </div>
                          )
                        }
                        return items
                      })()}
                    </div>
                  </div>
                </div>
              )}

              {/* Smart Rebate Calculator (Only for installment loans) */}
              {loan && loan.status !== 'Paid' && loan.loan_type !== 'quickloan' && (
                <div className="pc" style={{ background: 'linear-gradient(135deg,#0E1320,#081c10)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 16, padding: 18 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(34,197,94,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#22C55E' }}>
                      <CreditCard size={14} />
                    </div>
                    <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 13, color: '#F0F4FF', letterSpacing: '0.01em' }}>Rebate Calculator</div>
                  </div>
                  <div style={{ fontSize: 11, color: '#7A8AAA', marginBottom: 14, lineHeight: 1.5 }}>
                    Pay off your full balance early to earn a **1% rebate** on your principal!
                  </div>
                  {(() => {
                    const principal = Number(loan.loan_amount)
                    const rebate = principal * 0.01
                    return (
                      <div style={{ padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.04)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                          <span style={{ fontSize: 11, color: '#4B5580' }}>Potential Rebate</span>
                          <span style={{ fontSize: 14, fontWeight: 900, color: '#22C55E', fontFamily: 'Syne, sans-serif' }}>+₱{rebate.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '8px 0' }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                          <span style={{ fontSize: 11, color: '#4B5580' }}>Est. Total Savings</span>
                          <span style={{ fontSize: 14, fontWeight: 900, color: '#60A5FA', fontFamily: 'Syne, sans-serif' }}>₱{rebate.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <button onClick={() => { setPage('home'); setTimeout(() => document.getElementById('payment-section')?.scrollIntoView({ behavior: 'smooth' }), 150) }} style={{ width: '100%', marginTop: 14, padding: '9px', borderRadius: 10, border: '1px solid rgba(34,197,94,0.3)', background: 'rgba(34,197,94,0.06)', color: '#22C55E', fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}>
                          Pay Early Now →
                        </button>
                      </div>
                    )
                  })()}
                </div>
              )}


              {/* Need Help */}
              <div className="pc" style={{ background: '#0E1320', border: '1px solid rgba(59,130,246,0.12)', borderRadius: 16, padding: 14 }}>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 12, color: '#F0F4FF', marginBottom: 10 }}>❓ Need Help?</div>
                <div style={{ fontSize: 11, color: '#7A8AAA', marginBottom: 12, lineHeight: 1.6 }}>Questions about your loan, payments, or schedule? Our admin team is here to help.</div>
                <a href="/contact" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 9, background: 'linear-gradient(135deg,rgba(59,130,246,0.1),rgba(139,92,246,0.1))', border: '1px solid rgba(139,92,246,0.25)', color: '#a78bfa', textDecoration: 'none', fontSize: 12, fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif' }}>
                  💬 Contact Us →
                </a>
              </div>

              <a href="/faq" className="pc nav-btn" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px', background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 14, textDecoration: 'none' }}>
                <img src="/faq.png" alt="faq" style={{ width: 14, height: 14, objectFit: 'contain' }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: '#a78bfa', flex: 1 }}>View FAQ & Privacy Notice</span>
                <span style={{ color: '#4B5580' }}>›</span>
              </a>

            </div>{/* end sidebar */}
          </div>{/* end portal-grid */}
        </div>{/* end main-content-area */}

        {showSignModal && loan && (
          <SignatureModal borrower={borrower} loan={loan} onSave={handleSaveSignature} onClose={() => setShowSignModal(false)} />
        )}
        {uploadModal && (
          <UploadModal installmentNum={uploadModal} loan={loan} borrower={borrower} qlPaymentType={qlPaymentType} onClose={() => { setUploadModal(null); setQlPaymentType(null) }} onUploaded={handleUploaded} />
        )}
        {showPrincipalModal && loan && borrower && (
          <PrincipalPaymentModal loan={loan} borrower={borrower} onClose={() => setShowPrincipalModal(false)} onUploaded={() => { setShowPrincipalModal(false); handleUploaded() }} />
        )}

        {/* Mobile Bottom Navigation */}
        <nav className="bottom-nav">
          <button onClick={() => setPage('home')} className={`bn-item ${page === 'home' ? 'active' : ''}`}>
            <Home size={20} />
            <span className="bn-label">Home</span>
          </button>
          <button onClick={() => setPage('payment-history')} className={`bn-item ${page === 'payment-history' ? 'active' : ''}`}>
            <Clock size={20} />
            <span className="bn-label">History</span>
          </button>
          <button onClick={() => setPage('wallet')} className={`bn-item ${page === 'wallet' ? 'active' : ''}`}>
            <Wallet size={20} />
            <span className="bn-label">Wallet</span>
          </button>
          <button onClick={() => { setPage('home'); setTimeout(() => document.getElementById('payment-section')?.scrollIntoView({ behavior: 'smooth' }), 150) }} className={`bn-item ${page === 'payment-methods' ? 'active' : ''}`}>
            <CreditCard size={20} />
            <span className="bn-label">Repay</span>
          </button>
          <button onClick={() => setPage('profile')} className={`bn-item ${page === 'profile' ? 'active' : ''}`}>
            <User size={20} />
            <span className="bn-label">Profile</span>
          </button>
        </nav>
      </div>
    )
}

