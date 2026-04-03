import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { formatCurrency } from '../lib/helpers'
import {
  Building2, Smartphone, CreditCard, Wallet, TrendingUp,
  Info, LogOut, RefreshCw, PenTool, XCircle, Sun, Moon, Printer
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts'
import { useToast } from '../components/Toast'
import { SignaturePad } from '../components/SignaturePad'
import InvestorMoa from '../components/InvestorMoa'
import { sendPayoutRequestedAdminEmail, sendMoaSignedAdminEmail } from '../lib/emailService'

const TIER_RATES = {
  'Starter':  0.07,
  'Standard': 0.08,
  'Premium':  0.09
}

// ─── Theme tokens ──────────────────────────────────────────────
const DARK = {
  bg:         '#0B0F1A',
  cardBg:     '#0E1320',
  cardBorder: 'rgba(255,255,255,0.08)',
  headerBg:   'linear-gradient(135deg,#0E1320 0%,#141B2D 100%)',
  heroBg:     'linear-gradient(135deg,#111827,#1e3a5f)',
  heroBorder: 'rgba(59,130,246,0.3)',
  text:       '#F0F4FF',
  textMuted:  '#7A8AAA',
  textLabel:  '#4B5580',
  accent:     '#3B82F6',
  accent2:    '#1E40AF',
  green:      '#22C55E',
  gold:       '#F59E0B',
  red:        '#EF4444',
  tableHead:  'rgba(255,255,255,0.03)',
  tableRow:   'transparent',
  tableRowH:  'rgba(255,255,255,0.02)',
  divider:    'rgba(255,255,255,0.06)',
  inputBg:    'rgba(0,0,0,0.25)',
  inputBorder:'rgba(255,255,255,0.1)',
}

const LIGHT = {
  bg:         '#EEF2F9',
  cardBg:     '#FFFFFF',
  cardBorder: '#CBD5E1',
  headerBg:   'linear-gradient(135deg,#1E3A5F 0%,#1E40AF 100%)',
  heroBg:     'linear-gradient(135deg,#1E3A5F,#1d4ed8)',
  heroBorder: '#1E40AF',
  text:       '#0F172A',
  textMuted:  '#475569',
  textLabel:  '#64748B',
  accent:     '#1D4ED8',
  accent2:    '#1e40af',
  green:      '#16A34A',
  gold:       '#D97706',
  red:        '#DC2626',
  tableHead:  '#F1F5F9',
  tableRow:   '#FFFFFF',
  tableRowH:  '#F8FAFF',
  divider:    '#E2E8F0',
  inputBg:    '#F8FAFF',
  inputBorder:'#CBD5E1',
}

// ─── Payout Modal ─────────────────────────────────────────────
function PayoutRequestModal({ isOpen, onClose, onSubmit, investor, requesting, t }) {
  const [method, setMethod] = useState('GCash')
  const [accountName, setAccountName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [confirmAccountNumber, setConfirmAccountNumber] = useState('')

  if (!isOpen) return null
  const isMatching = accountNumber === confirmAccountNumber
  const isComplete = accountName && accountNumber && confirmAccountNumber && isMatching

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ maxWidth: 460, width: '100%', padding: 32, background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: 20, position: 'relative', boxShadow: '0 40px 80px rgba(0,0,0,0.5)' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 20, right: 20, background: 'none', border: 'none', color: t.textMuted, cursor: 'pointer' }}>
          <XCircle size={24} />
        </button>
        <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: 22, fontWeight: 800, margin: '0 0 6px', color: t.text }}>Request Payout</h3>
        <p style={{ fontSize: 13, color: t.textMuted, marginBottom: 24 }}>Select your preferred method for receiving your capital.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            {['GCash', 'Bank Transfer'].map(m => (
              <button key={m} onClick={() => setMethod(m)}
                style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1px solid', borderColor: method === m ? t.accent : t.cardBorder, background: method === m ? `${t.accent}18` : 'transparent', color: method === m ? t.accent : t.textMuted, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                {m === 'GCash' ? <Smartphone size={15} /> : <Building2 size={15} />} {m}
              </button>
            ))}
          </div>
          {[
            { label: "Account Holder's Name", key: 'name', val: accountName, set: setAccountName, ph: 'Full Legal Name', err: false },
            { label: 'Account Number', key: 'acc', val: accountNumber, set: setAccountNumber, ph: method === 'GCash' ? '0917 XXX XXXX' : 'XXXX-XXXX-XX', err: false },
            { label: `Confirm Account Number${!isMatching && confirmAccountNumber ? ' — Mismatch!' : ''}`, key: 'conf', val: confirmAccountNumber, set: setConfirmAccountNumber, ph: 'Repeat Account Number', err: !isMatching && !!confirmAccountNumber },
          ].map(f => (
            <div key={f.key}>
              <label style={{ fontSize: 11, color: f.err ? t.red : t.textMuted, textTransform: 'uppercase', marginBottom: 6, display: 'block', fontWeight: 600 }}>{f.label}</label>
              <input type="text" placeholder={f.ph} value={f.val} onChange={e => f.set(e.target.value)}
                style={{ width: '100%', padding: '11px 14px', borderRadius: 10, background: t.inputBg, border: `1px solid ${f.err ? t.red : t.inputBorder}`, color: t.text, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
            </div>
          ))}
          <div style={{ padding: 14, background: `${t.accent}10`, border: `1px solid ${t.accent}25`, borderRadius: 10 }}>
            <div style={{ fontSize: 11, color: t.accent, fontWeight: 700, marginBottom: 3 }}>⭐ PREMIUM SERVICE</div>
            <p style={{ fontSize: 12, color: t.textMuted, margin: 0, lineHeight: 1.5 }}>We waive all transaction fees for {investor?.tier} members.</p>
          </div>
          <button disabled={!isComplete || requesting} onClick={() => onSubmit({ method, accountName, accountNumber, amount: investor?.total_capital || 0 })}
            style={{ width: '100%', height: 46, borderRadius: 10, border: 'none', background: isComplete ? `linear-gradient(135deg,${t.accent},${t.accent2})` : t.cardBorder, color: '#fff', fontSize: 14, fontWeight: 700, cursor: isComplete ? 'pointer' : 'not-allowed', fontFamily: 'Syne, sans-serif', opacity: isComplete ? 1 : 0.6 }}>
            {requesting ? 'Processing...' : 'Submit Payout Request'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Agreement Modal ──────────────────────────────────────────
function AgreementModal({ isOpen, onClose, investor, onSign }) {
  const [showPad, setShowPad] = useState(false)
  if (!isOpen || !investor) return null
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(12px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 0' }}>
      <div style={{ position: 'relative', width: '95%', maxWidth: 900, maxHeight: '95vh', overflowY: 'auto', background: '#fff', borderRadius: 12 }}>
        <div style={{ position: 'sticky', top: 0, padding: 15, display: 'flex', justifyContent: 'flex-end', zIndex: 10, background: 'rgba(255,255,255,0.9)' }}>
          <button onClick={onClose} style={{ background: '#000', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: 'pointer', fontWeight: 600 }}>Close View</button>
        </div>
        {!investor.signed_at && (
          <div style={{ padding: '0 40px 20px', textAlign: 'center' }}>
            <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', padding: '16px 20px', borderRadius: 12, display: 'inline-block' }}>
              <p style={{ fontFamily: 'Inter', fontSize: 13, color: '#9A3412', margin: '0 0 10px' }}>
                <strong>Official Signature Required:</strong> Please sign to activate your dashboard.
              </p>
              <button onClick={() => setShowPad(true)}
                style={{ background: '#EA580C', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: 8, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, margin: '0 auto' }}>
                <PenTool size={16} /> Sign Document Officially
              </button>
            </div>
          </div>
        )}
        <InvestorMoa investor={investor} onSign={() => setShowPad(true)} />
      </div>
      {showPad && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <SignaturePad onSave={(data) => { onSign(data); setShowPad(false) }} onCancel={() => setShowPad(false)} />
        </div>
      )}
    </div>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────
export default function InvestorDashboard() {
  const [investor, setInvestor]         = useState(null)
  const [loans, setLoans]               = useState([])
  const [loading, setLoading]           = useState(true)
  const [requestingPayout, setRequestingPayout] = useState(false)
  const [showPayoutModal, setShowPayoutModal]    = useState(false)
  const [showAgreementModal, setShowAgreementModal] = useState(false)
  const [forecastData, setForecastData] = useState([])
  const [liveAccrual, setLiveAccrual]   = useState(0)
  const [yesterdayAccrual, setYesterdayAccrual] = useState(0)
  const [overallAccrual, setOverallAccrual]     = useState(0)
  const [isDark, setIsDark]             = useState(true)  // default dark
  const { toast } = useToast()

  const t = isDark ? DARK : LIGHT

  const fetchData = useCallback(async () => {
    const partnerCode = localStorage.getItem('lm_partner_code')
    if (!partnerCode) { setLoading(false); return }

    const { data: inv, error: invErr } = await supabase
      .from('investors').select('*').eq('access_code', partnerCode).single()

    if (invErr || !inv) { setLoading(false); return }

    setInvestor(inv)
    if (!inv.signed_at) setShowAgreementModal(true)

    const { data: lData } = await supabase
      .from('loans').select('*, borrowers(full_name, department, building)')
      .eq('investor_id', inv.id).order('created_at', { ascending: false })

    setLoans(lData || [])

    // Forecast (12 months)
    const rate = TIER_RATES[inv.tier] || 0.12
    const totalCapital = Number(inv.total_capital || 0)
    const months = Array.from({ length: 13 }, (_, i) => {
      const quarters = Math.floor(i / 3)
      const projected = inv.auto_reinvest !== false
        ? totalCapital * Math.pow(1 + rate, quarters)
        : totalCapital + (totalCapital * rate * (i / 3))
      return { month: i === 0 ? 'Now' : `M${i}`, value: Math.round(projected), earnings: Math.round(projected - totalCapital) }
    })
    setForecastData(months)
    setLoading(false)
  }, [])

  // Live accrual ticker + yesterday & overall
  useEffect(() => {
    if (!investor || !loans.length) { setLiveAccrual(0); setYesterdayAccrual(0); setOverallAccrual(0); return }
    const activeLoansFiltered = loans.filter(l => ['Active', 'Partially Paid', 'Overdue'].includes(l.status))
    const activeCapital = activeLoansFiltered.reduce((s, l) => s + Number(l.loan_amount), 0)
    if (activeCapital <= 0) { setLiveAccrual(0); setYesterdayAccrual(0); setOverallAccrual(0); return }

    // Daily rate derived from tier quarterly rate: e.g. Premium 9%/90days = 0.001 per day
    const quarterlyRate = TIER_RATES[investor.tier] || 0.08
    const dailyRate = quarterlyRate / 90
    const dailyProfit = activeCapital * dailyRate

    // Today's live accrual (based on time elapsed today)
    const now = new Date()
    const secondsInDay = (now.getHours() * 3600) + (now.getMinutes() * 60) + now.getSeconds()
    setLiveAccrual(dailyProfit * (secondsInDay / 86400))

    // Yesterday's accrual — full day of interest on capital that was active yesterday
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayCapital = activeLoansFiltered
      .filter(l => new Date(l.created_at) <= yesterday)
      .reduce((s, l) => s + Number(l.loan_amount), 0)
    setYesterdayAccrual(yesterdayCapital * dailyRate)

    // Overall accrual — total interest accumulated across all days each active loan has been deployed
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    let totalOverall = 0
    activeLoansFiltered.forEach(l => {
      const loanStart = new Date(l.created_at)
      const daysActive = Math.max(0, Math.floor((todayStart - loanStart) / 86400000))
      totalOverall += Number(l.loan_amount) * dailyRate * daysActive
    })
    // Add today's partial accrual
    totalOverall += dailyProfit * (secondsInDay / 86400)
    setOverallAccrual(totalOverall)

    const iv = setInterval(() => {
      const increment = dailyProfit / (86400 / 5)
      setLiveAccrual(prev => prev + increment)
      setOverallAccrual(prev => prev + increment)
    }, 5000)
    return () => clearInterval(iv)
  }, [investor, loans])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSignMoa = async (signatureData) => {
    if (!investor) return
    try {
      const now = new Date().toISOString()
      const { error } = await supabase.from('investors')
        .update({ signed_at: now, signature_data: signatureData }).eq('id', investor.id)
      if (error) throw error
      setInvestor({ ...investor, signed_at: now, signature_data: signatureData })
      sendMoaSignedAdminEmail({ investorName: investor.full_name, tier: investor.tier, accessCode: investor.access_code }).catch(console.error)
      toast('MOA Signed Successfully! Welcome.', 'success')
    } catch {
      toast('Failed to save signature. Please try again.', 'error')
    }
  }

  const handleRequestPayout = async (payoutData) => {
    if (!investor) return
    setRequestingPayout(true)
    try {
      const details = `Name: ${payoutData.accountName} | Account: ${payoutData.accountNumber}`
      const { error } = await supabase.from('investor_payout_requests').insert({
        investor_id: investor.id, requested_amount: Number(payoutData.amount),
        payout_method: payoutData.method, account_details: details, status: 'pending'
      })
      if (error) throw error
      await sendPayoutRequestedAdminEmail({ investorName: investor.full_name, amount: payoutData.amount, tier: investor.tier, method: payoutData.method })
      toast('Payout request submitted!', 'success')
      setShowPayoutModal(false)
    } catch {
      toast('Failed to submit payout request.', 'error')
    } finally {
      setRequestingPayout(false)
    }
  }

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>

  if (!investor) return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <h2 style={{ color: 'var(--text-primary)' }}>Access Denied</h2>
      <p style={{ color: 'var(--text-muted)' }}>Please log in via the partner portal.</p>
      <a href="/portal" className="btn-primary" style={{ marginTop: 20, display: 'inline-block', textDecoration: 'none' }}>Go to Portal</a>
    </div>
  )

  // ── Derived data ────────────────────────────────────────────
  const rate = TIER_RATES[investor.tier] || 0.12
  const activeLoans  = loans.filter(l => ['Active', 'Partially Paid', 'Overdue'].includes(l.status))
  const paidLoans    = loans.filter(l => l.status === 'Paid')
  const activeCapital = activeLoans.reduce((s, l) => s + Number(l.loan_amount), 0)
  const totalInvested = Number(investor.total_capital || 0)

  // Total earnings = interest earned from paid loans + live accrual on active
  const paidEarnings = paidLoans.reduce((s, l) => s + Number(l.loan_amount) * rate, 0)
  const activeEarnings = liveAccrual
  const totalEarnings = paidEarnings + activeEarnings

  const roi = totalInvested > 0 ? ((totalEarnings / totalInvested) * 100).toFixed(2) : '0.00'

  // Interest earned sum (interest on paid loans + accrued on active based on daily rate)
  const interestEarned = paidEarnings
  const principalRepaid = paidLoans.reduce((s, l) => s + Number(l.loan_amount), 0)
  const totalReturns = interestEarned + principalRepaid

  // Loan status donut
  const loanStatusData = [
    { name: 'Ongoing', value: activeLoans.length, color: t.accent },
    { name: 'Paid',    value: paidLoans.length,   color: t.green },
    { name: 'Other',   value: loans.filter(l => !['Active','Partially Paid','Overdue','Paid'].includes(l.status)).length, color: t.gold },
  ].filter(d => d.value > 0)

  // Loan amount distribution by purpose/type (just use first word of loan_purpose if available, else group by status)
  const loanDistData = [
    { name: 'Active',  value: Math.round((activeCapital / (totalInvested || 1)) * 100), color: t.accent },
    { name: 'Repaid',  value: Math.round((principalRepaid / (totalInvested || 1)) * 100), color: t.green },
    { name: 'Idle',    value: Math.max(0, 100 - Math.round((activeCapital / (totalInvested || 1)) * 100) - Math.round((principalRepaid / (totalInvested || 1)) * 100)), color: '#94A3B8' },
  ].filter(d => d.value > 0)

  // Recent activity — last 5 loan events
  const recentActivity = [...loans]
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
    .slice(0, 5)
    .map(l => ({
      label: l.status === 'Paid'
        ? `${l.borrowers?.full_name} loan fully repaid`
        : l.status === 'Active'
        ? `Loan to ${l.borrowers?.full_name} disbursed`
        : `${l.borrowers?.full_name} — ${l.status}`,
      time: new Date(l.updated_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
    }))

  // ── Styles ──────────────────────────────────────────────────
  const card = {
    background: t.cardBg,
    border: `1px solid ${t.cardBorder}`,
    borderRadius: 14,
  }

  const sectionHeader = {
    fontFamily: 'Syne, sans-serif',
    fontWeight: 800,
    fontSize: 14,
    color: '#FFFFFF',
    background: t.accent,
    padding: '10px 18px',
    borderRadius: '12px 12px 0 0',
    margin: 0,
    display: 'block',
  }

  const sectionHeaderLight = {
    ...sectionHeader,
    background: t.accent,
    color: '#fff',
  }

  return (
    <div style={{ minHeight: '100vh', background: t.bg, fontFamily: 'DM Sans, sans-serif', transition: 'background 0.3s' }}>

      {/* ── HEADER ── */}
      <div style={{ background: t.headerBg, padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `2px solid ${t.accent}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg,#3B82F6,#8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Syne, sans-serif', fontWeight: 900, fontSize: 16, color: '#fff' }}>M</div>
            <div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 900, fontSize: 16, color: '#fff', lineHeight: 1 }}>MONEYFEST</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.12em', fontWeight: 600 }}>LENDING</div>
            </div>
          </div>
          <div style={{ width: 1, height: 36, background: 'rgba(255,255,255,0.2)' }} />
          <div>
            <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 20, color: '#fff', margin: 0 }}>Investor Dashboard</h1>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 1 }}>
              {investor.full_name} · <span style={{ color: '#F59E0B', fontWeight: 700 }}>{investor.tier} Partner</span> · ID: {investor.access_code}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Light/Dark Toggle */}
          <button
            onClick={() => setIsDark(d => !d)}
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 14px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}>
            {isDark ? <Sun size={14} /> : <Moon size={14} />}
            {isDark ? 'Light' : 'Dark'}
          </button>
          <button onClick={() => setShowAgreementModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            <Info size={14} /> Agreement
          </button>
          <button onClick={() => window.print()}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            <Printer size={14} /> Export
          </button>
          <button onClick={fetchData}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button onClick={() => { localStorage.removeItem('lm_partner_code'); window.location.href = '/portal' }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 20, border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.15)', color: '#FCA5A5', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </div>

      {/* ── MAIN AREA ── */}
      <div style={{ maxWidth: 1300, margin: '0 auto', padding: '28px 24px' }}>

        {/* ── ROW 1: 3 Hero Metric Cards ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 24 }}>
          {[
            { label: 'Total Invested', value: formatCurrency(totalInvested), valueColor: t.green, sub: `${investor.tier} Tier Capital Pool`, icon: <Wallet size={22} style={{ color: '#fff' }} /> },
            { label: 'Funds Deployed', value: formatCurrency(activeCapital), valueColor: '#F59E0B', sub: `${activeLoans.length} active loan${activeLoans.length !== 1 ? 's' : ''} · ${(rate * 100).toFixed(0)}% per cycle`, icon: <TrendingUp size={22} style={{ color: '#fff' }} /> },
            { label: 'Total Earnings', value: formatCurrency(totalEarnings), valueColor: t.green, sub: `Live accrual: +${formatCurrency(liveAccrual)} today · Overall: +${formatCurrency(overallAccrual)}`, icon: <CreditCard size={22} style={{ color: '#fff' }} /> },
          ].map(c => (
            <div key={c.label} style={{ ...card, padding: 0, overflow: 'hidden', boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 20px rgba(0,0,0,0.1)' }}>
              <div style={{ background: t.accent, padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {c.icon}
                </div>
                <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, color: '#fff' }}>{c.label}</span>
              </div>
              <div style={{ padding: '18px 20px' }}>
                <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 900, fontSize: 32, color: c.valueColor, lineHeight: 1, marginBottom: 6 }}>{c.value}</div>
                <div style={{ fontSize: 12, color: t.textMuted }}>{c.sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── ROW 2: Active Loans Table + Earnings Overview ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 20, marginBottom: 24 }}>

          {/* My Active Loans */}
          <div style={{ ...card, overflow: 'hidden', boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 20px rgba(0,0,0,0.08)' }}>
            <div style={sectionHeaderLight}>📋 My Active Loans</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: t.tableHead, borderBottom: `1px solid ${t.divider}` }}>
                    {['Borrower', 'Loan Amount', 'Interest Rate', 'Status'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, color: t.accent, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loans.length === 0 && (
                    <tr><td colSpan={4} style={{ padding: '24px 16px', textAlign: 'center', color: t.textMuted, fontSize: 13 }}>No loans deployed yet.</td></tr>
                  )}
                  {loans.map((loan, i) => {
                    const isActive = ['Active', 'Partially Paid', 'Overdue'].includes(loan.status)
                    const isPaid   = loan.status === 'Paid'
                    const lRate    = (rate * 100).toFixed(1) + '%'
                    return (
                      <tr key={i} style={{ borderBottom: `1px solid ${t.divider}`, background: i % 2 === 0 ? t.tableRow : t.tableRowH, transition: 'background 0.15s' }}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 700, color: t.accent, fontSize: 13, cursor: 'pointer' }}>{loan.borrowers?.full_name || '—'}</div>
                          <div style={{ fontSize: 11, color: t.textMuted }}>{loan.borrowers?.department}</div>
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: t.text }}>{formatCurrency(loan.loan_amount)}</td>
                        <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: t.text }}>{lRate}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 20,
                            background: isPaid ? `${t.green}20` : isActive ? `${t.accent}20` : `${t.gold}20`,
                            color: isPaid ? t.green : isActive ? t.accent : t.gold,
                            border: `1px solid ${isPaid ? t.green : isActive ? t.accent : t.gold}40`
                          }}>
                            {isPaid ? 'Paid' : isActive ? 'On Going' : loan.status}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '12px 16px', borderTop: `1px solid ${t.divider}`, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setShowPayoutModal(true)}
                style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: `linear-gradient(135deg,${t.accent},${t.accent2})`, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Syne, sans-serif' }}>
                💳 Request Payout
              </button>
            </div>
          </div>

          {/* Earnings Overview */}
          <div style={{ ...card, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 20px rgba(0,0,0,0.08)' }}>
            <div style={sectionHeaderLight}>📈 Earnings Overview</div>
            <div style={{ padding: '14px 18px 8px', flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: t.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>ROI Growth</div>
              <div style={{ height: 160 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={forecastData}>
                    <defs>
                      <linearGradient id="roiGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={t.accent} stopOpacity={0.35} />
                        <stop offset="95%" stopColor={t.accent} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={t.divider} />
                    <XAxis dataKey="month" tick={{ fill: t.textMuted, fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis hide domain={['dataMin - 1000', 'dataMax + 1000']} />
                    <Tooltip
                      contentStyle={{ background: isDark ? '#141B2D' : '#fff', border: `1px solid ${t.cardBorder}`, borderRadius: 10, fontSize: 12, color: t.text }}
                      formatter={v => [`₱${v.toLocaleString('en-PH')}`, 'Value']}
                    />
                    <Area type="monotone" dataKey="value" stroke={t.accent} strokeWidth={2.5} fillOpacity={1} fill="url(#roiGrad)"
                      dot={{ fill: t.accent, r: 3 }} activeDot={{ r: 5 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            {/* Summary row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', borderTop: `1px solid ${t.divider}` }}>
              {[
                { label: 'Interest Earned', val: formatCurrency(interestEarned), col: t.text },
                { label: 'Principal Repaid', val: formatCurrency(principalRepaid), col: t.text },
                { label: 'Total Returns',   val: formatCurrency(totalReturns),   col: t.green },
              ].map((s, i) => (
                <div key={i} style={{ padding: '12px 14px', background: t.accent, textAlign: 'center', borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.15)' : 'none' }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{s.label}</div>
                  <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 800, fontSize: 15, color: i === 2 ? '#86EFAC' : '#fff' }}>{s.val}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── ROW 3: Recent Activity + Investment Snapshot ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 20 }}>

          {/* Recent Activity */}
          <div style={{ ...card, overflow: 'hidden', boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 20px rgba(0,0,0,0.08)' }}>
            <div style={sectionHeaderLight}>🕐 Recent Activity</div>
            <div style={{ padding: '8px 0' }}>
              {recentActivity.length === 0 && (
                <div style={{ padding: '24px 20px', textAlign: 'center', color: t.textMuted, fontSize: 13 }}>No recent activity.</div>
              )}
              {recentActivity.map((a, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: i < recentActivity.length - 1 ? `1px solid ${t.divider}` : 'none' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: `${t.green}20`, border: `1px solid ${t.green}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 14 }}>✓</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{a.label}</div>
                    <div style={{ fontSize: 11, color: t.textMuted, marginTop: 1 }}>{a.time}</div>
                  </div>
                </div>
              ))}
            </div>
            {/* Live Accrual ticker */}
            <div style={{ borderTop: `1px solid ${t.divider}`, background: isDark ? 'rgba(34,197,94,0.04)' : '#F0FDF4' }}>
              {[
                { label: "Today's Live Accrual", value: liveAccrual, live: true },
                { label: "Yesterday's Accrual", value: yesterdayAccrual, live: false },
                { label: 'Overall Accrued Interest', value: overallAccrual, live: false },
              ].map((row, i) => (
                <div key={i} style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: i > 0 ? `1px solid ${t.divider}` : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {row.live ? (
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.green, boxShadow: `0 0 8px ${t.green}`, animation: 'pulse 2s infinite' }} />
                    ) : (
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: i === 2 ? t.accent : t.gold, opacity: 0.7 }} />
                    )}
                    <span style={{ fontSize: 12, color: t.textMuted, fontWeight: 600 }}>{row.label}</span>
                  </div>
                  <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 800, fontSize: i === 2 ? 16 : 14, color: i === 0 ? t.green : i === 1 ? t.gold : t.accent }}>+{formatCurrency(row.value)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Investment Snapshot */}
          <div style={{ ...card, overflow: 'hidden', boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 20px rgba(0,0,0,0.08)' }}>
            <div style={sectionHeaderLight}>💡 Investment Snapshot</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', padding: '18px 16px', gap: 8 }}>
              {/* Loan Distribution */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: t.accent, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Loan Distribution</div>
                <div style={{ height: 140 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={loanDistData} cx="45%" cy="50%" outerRadius={55} innerRadius={26} dataKey="value" paddingAngle={3}>
                        {loanDistData.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: isDark ? '#141B2D' : '#fff', border: `1px solid ${t.cardBorder}`, borderRadius: 8, fontSize: 12 }}
                        formatter={v => [`${v}%`, '']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {loanDistData.map(d => (
                    <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: t.text }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                      <span style={{ fontWeight: 700, color: d.color }}>{d.name} {d.value}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Repayment Status */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: t.accent, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Repayment Status</div>
                <div style={{ height: 140 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={loanStatusData} cx="45%" cy="50%" outerRadius={55} innerRadius={26} dataKey="value" paddingAngle={3}>
                        {loanStatusData.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: isDark ? '#141B2D' : '#fff', border: `1px solid ${t.cardBorder}`, borderRadius: 8, fontSize: 12 }}
                        formatter={v => [v, 'loans']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {loanStatusData.map(d => {
                    const pct = loans.length > 0 ? Math.round((d.value / loans.length) * 100) : 0
                    return (
                      <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: t.text }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                        <span style={{ fontWeight: 700, color: d.color }}>{d.name} {pct}%</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Portfolio Insights Row */}
            <div style={{ borderTop: `1px solid ${t.divider}`, padding: '12px 16px', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
              {[
                { label: 'Risk Level', val: 'Low (Secured)', col: t.green },
                { label: 'Partner Tier', val: `${investor.tier}`, col: '#F59E0B' },
                { label: 'Next Payout', val: new Date(Date.now() + 15 * 86400000).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }), col: t.accent },
              ].map((s, i) => (
                <div key={i} style={{ textAlign: 'center', padding: '8px 4px', background: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFF', borderRadius: 8, border: `1px solid ${t.divider}` }}>
                  <div style={{ fontSize: 10, color: t.textMuted, textTransform: 'uppercase', marginBottom: 3 }}>{s.label}</div>
                  <div style={{ fontWeight: 800, fontSize: 12, color: s.col }}>{s.val}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      <PayoutRequestModal isOpen={showPayoutModal} onClose={() => setShowPayoutModal(false)} onSubmit={handleRequestPayout} investor={investor} requesting={requestingPayout} t={t} />
      <AgreementModal isOpen={showAgreementModal} onClose={() => setShowAgreementModal(false)} investor={investor} onSign={handleSignMoa} />
    </div>
  )
}
