import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { formatCurrency } from '../lib/helpers'
import { 
  Building2, 
  Smartphone, 
  CreditCard, 
  Wallet, 
  TrendingUp, 
  ShieldCheck, 
  Clock, 
  ArrowUpRight, 
  ChevronRight, 
  HelpCircle,
  FileText,
  PenTool,
  XCircle,
  Info,
  LogOut,
  RefreshCw,
  BarChart3,
  LayoutDashboard,
  Printer
} from 'lucide-react'
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer
} from 'recharts'
import { useToast } from '../components/Toast'
import { SignaturePad } from '../components/SignaturePad'
import { sendPayoutRequestedAdminEmail, sendMoaSignedAdminEmail } from '../lib/emailService'

const TIER_RATES = {
  'Starter': 0.105,  // 7% * 1.5 cycles
  'Standard': 0.12,  // 8% * 1.5 cycles
  'Premium': 0.135   // 9% * 1.5 cycles
}

// --- Payout Modal ---
function PayoutRequestModal({ isOpen, onClose, onSubmit, investor, requesting }) {
  const [method, setMethod] = useState('GCash')
  const [accountName, setAccountName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [confirmAccountNumber, setConfirmAccountNumber] = useState('')
  const [amount, setAmount] = useState(investor?.total_capital || '')

  if (!isOpen) return null

  const isMatching = accountNumber === confirmAccountNumber
  const isComplete = accountName && accountNumber && confirmAccountNumber && isMatching

  return (
    <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="card" style={{ maxWidth: 460, width: '100%', padding: 32, background: 'linear-gradient(135deg,#141B2D,#0E1320)', border: '1px solid rgba(255,255,255,0.1)', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 20, right: 20, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
          <XCircle size={24} />
        </button>

        <h3 style={{ fontFamily: 'Syne', fontSize: 24, fontWeight: 800, margin: '0 0 8px', color: 'var(--text-primary)' }}>Request Payout</h3>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>Select your preferred method for receiving your capital.</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            {['GCash', 'Bank Transfer'].map(m => (
              <button 
                key={m}
                onClick={() => setMethod(m)}
                style={{ flex: 1, padding: '12px', borderRadius: 12, border: '1px solid', borderColor: method === m ? '#3B82F6' : 'rgba(255,255,255,0.05)', background: method === m ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.02)', color: method === m ? '#3B82F6' : 'var(--text-muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                {m === 'GCash' ? <Smartphone size={16} /> : <Building2 size={16} />} {m}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6, display: 'block' }}>Account Holder's Name</label>
              <input 
                type="text"
                placeholder="Full Legal Name"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                style={{ width: '100%', padding: '12px 14px', borderRadius: 12, background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 14, outline: 'none' }}
              />
            </div>
            
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6, display: 'block' }}>Account Number</label>
              <input 
                type="text"
                placeholder={method === 'GCash' ? '0917 XXX XXXX' : 'XXXX-XXXX-XX'}
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                style={{ width: '100%', padding: '12px 14px', borderRadius: 12, background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 14, outline: 'none' }}
              />
            </div>

            <div>
              <label style={{ fontSize: 11, color: isMatching ? 'var(--text-muted)' : '#EF4444', textTransform: 'uppercase', marginBottom: 6, display: 'block' }}>
                Confirm Account Number {!isMatching && confirmAccountNumber && '— Mismatch!'}
              </label>
              <input 
                type="text"
                placeholder="Repeat Account Number"
                value={confirmAccountNumber}
                onChange={(e) => setConfirmAccountNumber(e.target.value)}
                style={{ width: '100%', padding: '12px 14px', borderRadius: 12, background: 'rgba(0,0,0,0.2)', border: `1px solid ${!isMatching && confirmAccountNumber ? '#EF4444' : 'rgba(255,255,255,0.1)'}`, color: '#fff', fontSize: 14, outline: 'none' }}
              />
            </div>
          </div>

          <div style={{ padding: 16, background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.1)', borderRadius: 12 }}>
            <div style={{ fontSize: 11, color: '#3B82F6', fontWeight: 700, marginBottom: 4 }}>⭐ PREMIUM SERVICE</div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
              Since you are a <strong>{investor?.tier} member</strong> and we take care of our investors, we will handle any transaction fees necessary in transferring the funds.
            </p>
          </div>

          <button 
            className="btn-primary"
            disabled={!isComplete || requesting}
            onClick={() => onSubmit({ method, accountName, accountNumber, amount })}
            style={{ width: '100%', height: 48, marginTop: 10, opacity: isComplete ? 1 : 0.5 }}>
            {requesting ? 'Processing...' : 'Submit Payout Request'}
          </button>
        </div>
      </div>
    </div>
  )
}

// --- Agreement Modal ---
function AgreementModal({ isOpen, onClose, investor, onSign }) {
  const [showPad, setShowPad] = useState(false)
  const isSigned = !!investor?.signed_at

  if (!isOpen || !investor) return null
  
  const handlePrint = () => {
    window.print()
  }

  const handleSignatureSave = (signatureData) => {
    onSign(signatureData)
    setShowPad(false)
  }

  return (
    <div className="modal-overlay agreement-modal-root" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(12px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 0' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=Inter:wght@300;400;700&display=swap');
        
        .moa-container {
          background: white;
          width: 100%;
          max-width: 850px;
          max-height: 90vh;
          margin: 0 auto;
          padding: 60px 80px;
          box-shadow: 0 20px 50px rgba(0,0,0,0.3);
          position: relative;
          font-family: 'Cormorant Garamond', serif;
          color: #1a1a1a;
          line-height: 1.6;
          overflow-y: auto;
          border-radius: 4px;
        }

        .moa-header {
          text-align: center;
          margin-bottom: 40px;
          border-bottom: 2px solid #333;
          padding-bottom: 20px;
        }

        .moa-header h1 {
          margin: 0;
          font-size: 32px;
          text-transform: uppercase;
          letter-spacing: 3px;
          font-weight: 700;
          color: #111;
        }

        .moa-header p {
          margin: 8px 0 0;
          font-family: 'Inter', sans-serif;
          font-size: 12px;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 2px;
        }

        .moa-witness {
          text-align: center;
          font-weight: 700;
          margin: 30px 0;
          font-size: 18px;
          text-transform: uppercase;
          font-style: italic;
        }

        .moa-section-title {
          font-size: 20px;
          text-transform: uppercase;
          border-bottom: 1px solid #eee;
          padding-bottom: 8px;
          margin-top: 35px;
          margin-bottom: 15px;
          font-weight: 700;
          color: #000;
        }

        .moa-clause {
          margin-bottom: 20px;
          font-size: 18px;
          text-align: justify;
        }

        .moa-terms-grid {
          margin: 25px 0;
          border: 1px solid #ddd;
          padding: 25px;
          background: #fafafa;
        }

        .moa-term-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 12px;
          border-bottom: 1px dotted #bbb;
          padding-bottom: 6px;
        }

        .moa-term-label {
          font-weight: 700;
          font-family: 'Inter', sans-serif;
          font-size: 13px;
          color: #555;
          text-transform: uppercase;
        }

        .moa-term-value {
          font-weight: 700;
          font-size: 18px;
          color: #000;
        }

        .moa-signatures {
          margin-top: 60px;
          display: flex;
          justify-content: space-between;
          gap: 60px;
        }

        .moa-sig-block {
          flex: 1;
          text-align: center;
        }

        .moa-sig-line {
          border-top: 1px solid #000;
          margin-top: 40px;
          padding-top: 12px;
          font-family: 'Inter', sans-serif;
          font-size: 13px;
          font-weight: 700;
          text-transform: uppercase;
        }

        .moa-sig-sub {
          font-family: 'Inter', sans-serif;
          font-size: 11px;
          color: #777;
          margin-top: 4px;
        }

        @media print {
          body * { visibility: hidden; }
          .moa-container, .moa-container * { visibility: visible; }
          .moa-container { 
            position: absolute; 
            left: 0; 
            top: 0; 
            width: 100%; 
            max-height: none; 
            box-shadow: none; 
            padding: 20px;
          }
          .no-print { display: none !important; }
        }

        .moa-close-btn {
          position: fixed;
          top: 30px;
          right: 30px;
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.2);
          color: white;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: 0.2s;
          z-index: 1002;
        }

        .moa-close-btn:hover {
          background: rgba(239, 68, 68, 0.2);
          border-color: #EF4444;
          color: #EF4444;
        }

        .moa-print-fab {
          position: fixed;
          bottom: 40px;
          right: 40px;
          background: #1a1a1a;
          color: white;
          padding: 14px 28px;
          border-radius: 50px;
          font-family: 'Inter', sans-serif;
          font-weight: 700;
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 10px;
          border: 1px solid #444;
          cursor: pointer;
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
          transition: 0.2s;
          z-index: 1002;
        }

        .moa-print-fab:hover {
          background: #000;
          transform: translateY(-2px);
          box-shadow: 0 15px 40px rgba(0,0,0,0.6);
        }

        .signature-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2000;
        }
      `}</style>
      
      {isSigned && (
        <button className="moa-close-btn no-print" onClick={onClose}>
          <XCircle size={24} />
        </button>
      )}

      {isSigned && (
        <button className="moa-print-fab no-print" onClick={handlePrint}>
          <Printer size={18} /> Print Agreement
        </button>
      )}
      
      <div className="moa-container">
        <div className="moa-header">
          <h1>Memorandum of Agreement</h1>
          <p>Investment Partnership · Moneyfest Lending</p>
        </div>

        <div className="moa-witness">
          Known to all men by these presents:
        </div>

        {!isSigned && (
          <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', padding: 20, borderRadius: 12, marginBottom: 30, textAlign: 'center' }} className="no-print">
            <p style={{ fontFamily: 'Inter', fontSize: 13, color: '#9A3412', margin: '0 0 12px' }}>
              <strong>Signature Required:</strong> Please sign this legal agreement with your official digital pen before proceeding to the dashboard.
            </p>
            <button 
              onClick={() => setShowPad(true)}
              style={{ background: '#EA580C', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: 8, fontFamily: 'Inter', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, margin: '0 auto' }}>
              <PenTool size={18} /> Sign Document Officially
            </button>
          </div>
        )}

        <div className="moa-clause">
          This Agreement is made and entered into this <strong>{new Date().getDate()}</strong> day of <strong>{new Date().toLocaleString('default', { month: 'long' })}</strong>, 2026, by and between:
          
          <div style={{ marginTop: 20, paddingLeft: 20, borderLeft: '3px solid #eee' }}>
            <p><strong>MONEYFEST LENDING</strong>, a workplace-integrated lending program represented by <strong>JOHN PAUL LACARON</strong> and/or <strong>CHARLOU JUNE RAMIL</strong>, hereinafter referred to as the <strong>"PLATFORM"</strong>;</p>
            <p style={{ textAlign: 'center', margin: '15px 0', fontSize: 14, fontWeight: 700 }}>- and -</p>
            <p><strong>{investor.full_name.toUpperCase()}</strong>, of legal age, residing at ________________________________________, hereinafter referred to as the <strong>"PARTNER"</strong>.</p>
          </div>
        </div>

        <div className="moa-section-title">Section 1: Purpose of Agreement</div>
        <div className="moa-clause">
          The PARTNER desires to provide investment capital to be deployed as short-term liquidity loans to pre-verified employees through the Platform’s automated lending system. The Platform agrees to manage the deployment, collection, and risk mitigation of said capital in exchange for the agreed operational spread.
        </div>

        <div className="moa-section-title">Section 2: Investment Terms</div>
        <div className="moa-terms-grid">
          <div className="moa-term-row">
            <span className="moa-term-label">TOTAL INVESTMENT AMOUNT</span>
            <span className="moa-term-value">₱ {Number(investor.total_capital).toLocaleString()}</span>
          </div>
          <div className="moa-term-row">
            <span className="moa-term-label">COMMENCEMENT DATE</span>
            <span className="moa-term-value">{new Date().toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
          </div>
          <div className="moa-term-row">
            <span className="moa-term-label">INVESTMENT DURATION</span>
            <span className="moa-term-value">90 Calendar Days of Active Deployment</span>
          </div>
          <div className="moa-term-row">
            <span className="moa-term-label">AGREED RETURN RATE (PER CYCLE)</span>
            <span className="moa-term-value" style={{ color: '#22C55E' }}>{(TIER_RATES[investor.tier]*100).toFixed(1)}%</span>
          </div>
        </div>

        <div className="moa-section-title">Section 3: Use of Capital & Deployment</div>
        <div className="moa-clause">
          <strong>Platform Prowess and Management:</strong> The Platform shall utilize its proprietary automation system to select eligible borrowers, verify IDs, and process loan disbursements. Each 90-day cycle consists of approximately 1.5 lending intervals (2-month loans).
        </div>

        <div className="moa-section-title">Section 4: Deployment-Based Accrual</div>
        <div className="moa-clause">
          The PARTNER acknowledges that interest does <strong>not</strong> begin accruing upon the date of capital transfer. Instead, the Accrual Period shall officially commence only upon the <strong>Actual Deployment Date</strong>—defined as the date when the Partner’s Principal is successfully released to a verified borrower.
          <br /><br />
          Principal held in the Platform’s Standing Pool awaiting a borrower assignment does not accrue interest. The Platform shall provide electronic notification to the PARTNER upon successful deployment.
        </div>

        <div className="moa-section-title">Section 5: The "Moneyfest" Spread</div>
        <div className="moa-clause">
          The Platform shall retain any interest collected from borrowers in excess of the Agreed Return Rate specified in Section 2. This spread covers operations, cloud infrastructure, SMS automation, and default risk pooling.
        </div>

        <div className="moa-section-title">Section 6: Risk Mitigation & Default</div>
        <div className="moa-clause">
          The Platform shall employ its standard "Tri-Layer Defense" to protect the Partner’s Principal, including 10-20% Security Holds from borrowers and strict Credit Score minimums (750+). In the event of a borrower default, the Platform shall utilize pooled administrative spreads to prioritize the restoration of the Partner’s Principal.
        </div>

        <div className="moa-section-title">Section 7: Confidentiality & Binding Effect</div>
        <div className="moa-clause">
          This agreement is strictly private and confidential. The PARTNER agrees not to disclose borrower identities or internal platform logic to third parties. This agreement shall be binding upon the parties, their heirs, and assigns.
        </div>

        <div className="moa-signatures">
          <div className="moa-sig-block">
            <div style={{ minHeight: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {investor.signature_data ? (
                <img src={investor.signature_data} alt="Signature" style={{ maxHeight: 80, maxWidth: '100%' }} />
              ) : (
                <div style={{ fontStyle: 'italic', color: '#ccc', fontSize: 24, opacity: 0.5 }}>PENDING SIGNATURE</div>
              )}
            </div>
            <div className="moa-sig-line">{investor.full_name}</div>
            <div className="moa-sig-sub">PARTNER / INVESTOR SIGNATURE</div>
            <div style={{ fontSize: 9, color: '#999', marginTop: 4 }}>
              {isSigned ? `Signed Digitally · Timestamp: ${new Date(investor.signed_at).toLocaleString()}` : `Secure Token: ${investor.access_code}`}
            </div>
          </div>
          <div className="moa-sig-block">
            <div style={{ minHeight: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {investor.admin_signature_data ? (
                <img src={investor.admin_signature_data} alt="Admin Signature" style={{ maxHeight: 80, maxWidth: '100%' }} />
              ) : (
                <div style={{ minHeight: 80 }}></div>
              )}
            </div>
            <div className="moa-sig-line">JOHN PAUL LACARON & CHARLOU JUNE RAMIL</div>
            <div className="moa-sig-sub">AUTHORIZED REPRESENTATIVES</div>
            <div style={{ fontSize: 9, color: '#999', marginTop: 4 }}>
              {investor.admin_signed_at 
                ? `Counter-signed: ${new Date(investor.admin_signed_at).toLocaleDateString()}` 
                : 'Company Serial: ML-2026-AUTH'
              }
            </div>
          </div>
        </div>
      </div>

      {showPad && (
        <div className="signature-overlay no-print">
          <SignaturePad 
            onSave={handleSignatureSave}
            onCancel={() => setShowPad(false)}
          />
        </div>
      )}
    </div>
  )
}

function StatCard({ title, value, subtitle, icon: Icon, trend, color = 'blue' }) {
  const colors = {
    blue: { bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.2)', icon: '#3B82F6' },
    green: { bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.2)', icon: '#22C55E' },
    purple: { bg: 'rgba(139,92,246,0.1)', border: 'rgba(139,92,246,0.2)', icon: '#8B5CF6' },
    gold: { bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.2)', icon: '#F59E0B' }
  }
  const c = colors[color] || colors.blue

  return (
    <div className="card" style={{ 
      padding: '20px 24px', 
      background: 'rgba(255,255,255,0.02)', 
      border: `1px solid ${c.border}`,
      position: 'relative',
      overflow: 'hidden'
    }}>
      <div style={{ position: 'absolute', top: -10, right: -10, opacity: 0.1 }}>
        <Icon size={80} style={{ color: c.icon }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{title}</div>
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 24, color: 'var(--text-primary)', marginBottom: 4 }}>{value}</div>
          <div style={{ fontSize: 11, color: trend > 0 ? 'var(--green)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
            {trend > 0 && <ArrowUpRight size={12} />}
            {subtitle}
          </div>
        </div>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: c.bg, border: `1px solid ${c.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={20} style={{ color: c.icon }} />
        </div>
      </div>
    </div>
  )
}

export default function InvestorDashboard() {
  const [investor, setInvestor] = useState(null)
  const [loans, setLoans] = useState([])
  const [loading, setLoading] = useState(true)
  const [requestingPayout, setRequestingPayout] = useState(false)
  const [showPayoutModal, setShowPayoutModal] = useState(false)
  const [showAgreementModal, setShowAgreementModal] = useState(false)
  const [autoReinvest, setAutoReinvest] = useState(true)
  const [forecastData, setForecastData] = useState([])
  const [dailyData, setDailyData] = useState([])
  const [liveAccrual, setLiveAccrual] = useState(0)
  const { toast } = useToast()

  const fetchData = useCallback(async () => {
    const partnerCode = localStorage.getItem('lm_partner_code')
    if (!partnerCode) {
      setLoading(false)
      return
    }

    const { data: inv, error: invErr } = await supabase
      .from('investors')
      .select('*')
      .eq('access_code', partnerCode)
      .single()

    if (invErr || !inv) {
      setLoading(false)
      return
    }

    setInvestor(inv)
    setAutoReinvest(inv.auto_reinvest !== false)
    
    // Auto-show MOA if not signed
    if (!inv.signed_at) {
      setShowAgreementModal(true)
    }

    // Fetch loans funded by this investor
    const { data: lData } = await supabase
      .from('loans')
      .select('*, borrowers(full_name, department, building)')
      .eq('investor_id', inv.id)
      .order('created_at', { ascending: false })

    setLoans(lData || [])

    // Calculate active capital (sum of Active, Partially Paid, Overdue)
    const activeCapital = (lData || [])
      .filter(l => ['Active', 'Partially Paid', 'Overdue'].includes(l.status))
      .reduce((sum, l) => sum + Number(l.loan_amount), 0)

    // Generate forecast (12 months compounding quarterly)
    const rate = TIER_RATES[inv.tier] || 0.12
    const totalCapital = Number(inv.total_capital || 0)
    const months = Array.from({ length: 13 }, (_, i) => {
      let projected
      if (inv.auto_reinvest !== false) {
        const quarters = Math.floor(i / 3)
        projected = totalCapital * Math.pow(1 + rate, quarters)
      } else {
        projected = totalCapital + (totalCapital * rate * (i / 3))
      }
      return {
        month: i === 0 ? 'Now' : `Month ${i}`,
        value: Math.round(projected),
        earnings: Math.round(projected - totalCapital)
      }
    })
    setForecastData(months)

    // Generate Daily Market View (Last 30 days)
    const dailyRate = inv.tier === 'Premium' ? 0.0015 : inv.tier === 'Standard' ? 0.00133 : 0.00116
    const days = Array.from({ length: 30 }, (_, i) => {
      const dayIndex = i + 1
      const accrual = activeCapital * (dailyRate * dayIndex)
      return {
        day: `Day ${dayIndex}`,
        accrual: Math.round(accrual)
      }
    })
    setDailyData(days)

    setLoading(false)
  }, [])

  const handleToggleAutoReinvest = async () => {
    const nextValue = !autoReinvest
    setAutoReinvest(nextValue)
    if (investor) {
      await supabase
        .from('investors')
        .update({ auto_reinvest: nextValue })
        .eq('id', investor.id)
    }
    // Refresh forecast logic
    fetchData()
  }

  const handleSignMoa = async (signatureData) => {
    if (!investor) return
    try {
      const now = new Date().toISOString()
      const { error } = await supabase
        .from('investors')
        .update({
          signed_at: now,
          signature_data: signatureData
        })
        .eq('id', investor.id)

      if (error) throw error
      
      setInvestor({ ...investor, signed_at: now, signature_data: signatureData })
      
      // Notify admin (non-blocking)
      sendMoaSignedAdminEmail({
        investorName: investor.full_name,
        tier: investor.tier,
        accessCode: investor.access_code
      }).catch(err => console.error('Admin alert failed:', err))

      toast('MOA Signed Successfully! Welcome to the Dashboard.', 'success')
      // Modal remains open but close button will appear, or we can close it automatically
      // setShowAgreementModal(false) 
    } catch (err) {
      console.error('Signing failed:', err)
      toast('Failed to save signature. Please try again.', 'error')
    }
  }

  const handleRequestPayout = async (payoutData) => {
    if (!investor) return
    setRequestingPayout(true)
    try {
      // Consolidate details for the database
      const details = `Name: ${payoutData.accountName} | Account: ${payoutData.accountNumber}`

      const { error } = await supabase
        .from('investor_payout_requests')
        .insert({
          investor_id: investor.id,
          requested_amount: Number(payoutData.amount),
          payout_method: payoutData.method,
          account_details: details,
          status: 'pending'
        })

      if (error) throw error

      await sendPayoutRequestedAdminEmail({
        investorName: investor.full_name,
        amount: payoutData.amount,
        tier: investor.tier,
        method: payoutData.method
      })

      toast('Payout request submitted successfully!', 'success')
      setShowPayoutModal(false)
    } catch (err) {
      console.error('Payout request failed:', err)
      toast('Failed to submit payout request. Please try again.', 'error')
    } finally {
      setRequestingPayout(false)
    }
  }

  // Live Accrual Simulation (Updates every 5s)
  useEffect(() => {
    if (!investor || !loans.length) {
      setLiveAccrual(0)
      return
    }
    
    // Calculate active capital (sum of Active, Partially Paid, Overdue)
    const activeCapital = loans
      .filter(l => ['Active', 'Partially Paid', 'Overdue'].includes(l.status))
      .reduce((sum, l) => sum + Number(l.loan_amount), 0)

    if (activeCapital <= 0) {
      setLiveAccrual(0)
      return
    }

    const dailyRate = investor.tier === 'Premium' ? 0.0015 : investor.tier === 'Standard' ? 0.00133 : 0.00116
    const dailyProfit = activeCapital * dailyRate
    
    // Simulate current day's progress based on time
    const now = new Date()
    const secondsInDay = (now.getHours() * 3600) + (now.getMinutes() * 60) + now.getSeconds()
    const dayProgress = secondsInDay / 86400
    
    setLiveAccrual(dailyProfit * dayProgress)

    const interval = setInterval(() => {
      setLiveAccrual(prev => prev + (dailyProfit / (86400 / 5)))
    }, 5000)

    return () => clearInterval(interval)
  }, [investor, loans])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>

  if (!investor) return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <h2 style={{ color: 'var(--text-primary)' }}>Access Denied</h2>
      <p style={{ color: 'var(--text-muted)' }}>Please log in via the partner portal.</p>
      <a href="/portal" className="btn-primary" style={{ marginTop: 20, display: 'inline-block', textDecoration: 'none' }}>Go to Portal</a>
    </div>
  )

  const activeCapital = loans
    .filter(l => ['Active', 'Partially Paid', 'Overdue'].includes(l.status))
    .reduce((sum, l) => sum + Number(l.loan_amount), 0)

  const totalEarned = loans
    .filter(l => l.status === 'Paid')
    .reduce((sum, l) => sum + (Number(l.loan_amount) * (TIER_RATES[investor.tier] || 0.12)), 0)

  return (
    <div className="page-container" style={{ padding: '24px 32px' }}>
      <header style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ padding: '6px 12px', background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 20, fontSize: 11, fontWeight: 700, color: '#8B5CF6', textTransform: 'uppercase' }}>
              {investor.tier} Partner
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>ID: {investor.access_code}</span>
          </div>
          <h1 style={{ fontFamily: 'Space Grotesk', fontSize: 32, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Welcome back, <span style={{ background: 'linear-gradient(90deg,#3B82F6,#8B5CF6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{investor.full_name.split(' ')[0]}</span>
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-secondary" onClick={() => setShowAgreementModal(true)} style={{ padding: '8px 14px' }}>
            <Info size={14} /> View Agreement
          </button>
          <button className="btn-secondary" onClick={() => window.print()} style={{ padding: '8px 14px' }}>
            <CreditCard size={14} /> Export Report
          </button>
          <button className="btn-secondary" onClick={fetchData} style={{ padding: '8px 14px' }}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button className="btn-secondary" 
            onClick={() => { localStorage.removeItem('lm_partner_code'); window.location.href = '/portal' }} 
            style={{ 
              padding: '8px 14px',
              background: 'rgba(239,68,68,0.08)',
              borderColor: 'rgba(239,68,68,0.15)',
              color: '#EF4444'
            }}>
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24, marginBottom: 32 }}>
        <StatCard title="Total Capital" value={formatCurrency(investor.total_capital)} subtitle="Active Working Fund" icon={Wallet} color="blue" />
        <StatCard title="Active Capital" value={formatCurrency(activeCapital)} subtitle={`${loans.filter(l => l.status === 'Active').length} Borrowers Active`} icon={TrendingUp} color="purple" trend={1} />
        <StatCard title="Accumulated Returns" value={formatCurrency(totalEarned)} subtitle={`+${(TIER_RATES[investor.tier]*100).toFixed(1)}% Yield to Date`} icon={BarChart3} color="green" trend={1} />
        
        {/* Market Tracker Card */}
        <div className="card" style={{ padding: '20px 24px', background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(139,92,246,0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Today's Accrual</div>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', boxShadow: '0 0 10px var(--green)' }} />
          </div>
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 24, color: 'var(--text-primary)', marginBottom: 4 }}>
            +{formatCurrency(liveAccrual)}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Auto-Reinvest</span>
            <div 
              onClick={handleToggleAutoReinvest}
              style={{ width: 44, height: 22, background: autoReinvest ? 'var(--green)' : '#334155', borderRadius: 20, cursor: 'pointer', position: 'relative', transition: '0.3s' }}>
              <div style={{ position: 'absolute', top: 3, left: autoReinvest ? 25 : 3, width: 16, height: 16, background: '#fff', borderRadius: '50%', transition: '0.3s' }} />
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 32, marginBottom: 32 }}>
        <div className="card" style={{ padding: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
            <div>
              <h3 style={{ fontFamily: 'Syne', fontWeight: 800, margin: '0 0 6px', fontSize: 18 }}>12-Month Performance</h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Compounding Forecast (Policy: {autoReinvest ? 'REINVESTMENT' : 'CASH PAYOUT'})</p>
            </div>
            <div style={{ background: 'rgba(59,130,246,0.1)', padding: '6px 12px', borderRadius: 8, fontSize: 11, color: '#3B82F6', fontWeight: 700 }}>{investor.tier} Tier Tracking</div>
          </div>
          <div style={{ height: 300, width: '100%', marginLeft: -20 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={forecastData}>
                <defs>
                  <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `₱${val/1000}k`} />
                <Tooltip 
                  contentStyle={{ background: '#141B2D', border: '1px solid var(--card-border)', borderRadius: 12 }}
                  itemStyle={{ color: '#fff', fontSize: 12, fontWeight: 700 }}
                  labelStyle={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 4 }}
                />
                <Area type="monotone" dataKey="value" stroke="#8B5CF6" strokeWidth={3} fillOpacity={1} fill="url(#colorVal)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card" style={{ padding: 32 }}>
          <div>
            <h3 style={{ fontFamily: 'Syne', fontWeight: 800, margin: '0 0 6px', fontSize: 18 }}>Market View</h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>30rd-Day Accumulation (Accruing Now)</p>
          </div>
          <div style={{ height: 300, width: '100%', marginLeft: -20, marginTop: 24 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyData}>
                <defs>
                  <linearGradient id="colorGreen" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--green)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--green)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" hide />
                <YAxis hide domain={['dataMin', 'dataMax']} />
                <Tooltip 
                  contentStyle={{ background: '#141B2D', border: '1px solid var(--card-border)', borderRadius: 12 }}
                  labelStyle={{ color: 'var(--text-muted)', marginBottom: 4 }}
                />
                <Area type="stepAfter" dataKey="accrual" stroke="var(--green)" strokeWidth={2} fillOpacity={1} fill="url(#colorGreen)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 1fr', gap: 32 }}>
        <div className="card">
          <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontFamily: 'Syne', fontWeight: 800, margin: 0, fontSize: 18 }}>Capital Deployment</h3>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Portfolio Diversification: High</div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--card-border)' }}>
                  <th style={{ textAlign: 'left', padding: '16px 32px', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Borrower</th>
                  <th style={{ textAlign: 'left', padding: '16px 24px', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Building</th>
                  <th style={{ textAlign: 'left', padding: '16px 24px', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Lent</th>
                  <th style={{ textAlign: 'left', padding: '16px 24px', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Your Share</th>
                  <th style={{ textAlign: 'left', padding: '16px 24px', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {loans.map((loan, i) => {
                  const rate = TIER_RATES[investor.tier] || 0.12
                  const share = Number(loan.loan_amount) * rate
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s' }}>
                      <td style={{ padding: '16px 32px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{loan.borrowers?.full_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{loan.borrowers?.department}</div>
                      </td>
                      <td style={{ padding: '16px 24px', fontSize: 13 }}>{loan.borrowers?.building}</td>
                      <td style={{ padding: '16px 24px', fontSize: 13, fontWeight: 500 }}>
                        {formatCurrency(loan.loan_amount)}
                      </td>
                      <td style={{ padding: '16px 24px', fontWeight: 700, color: 'var(--green)' }}>
                        +{formatCurrency(share)}
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <span style={{ fontSize: 12, color: loan.status === 'Paid' ? 'var(--green)' : 'var(--blue)' }}>
                          {loan.status}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div className="card" style={{ padding: 24, background: 'linear-gradient(135deg,#1e1b4b,#0E1320)' }}>
            <h4 style={{ fontFamily: 'Syne', fontWeight: 800, margin: '0 0 16px', fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
              <LayoutDashboard size={18} /> Portfolio Insights
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Risk Level</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  Low-Risk (Secured) <Info size={12} />
                </div>
              </div>
              <div style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Next Distribution</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {new Date(new Date().getTime() + 15 * 24 * 60 * 60 * 1000).toLocaleDateString()}
                </div>
              </div>
              <div style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Partner Tier</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#F59E0B' }}>
                  {investor?.tier} Benefits Active
                </div>
              </div>
            </div>
            <button 
              className="btn-primary" 
              onClick={() => setShowPayoutModal(true)}
              style={{ width: '100%', marginTop: 24, fontSize: 13, height: 42 }}>
              Request Capital Payout
            </button>
          </div>

          <div className="card" style={{ padding: 20, borderStyle: 'dashed' }}>
            <h5 style={{ margin: '0 0 8px', fontSize: 13 }}>💡 Partner Support</h5>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
              Need to increase your capital or change your payout methods? Contact Moneyfest Lending admin directly through the portal info.
            </p>
          </div>
        </div>
      </div>

      <PayoutRequestModal 
        isOpen={showPayoutModal} 
        onClose={() => setShowPayoutModal(false)}
        onSubmit={handleRequestPayout}
        investor={investor}
        requesting={requestingPayout}
      />

      <AgreementModal 
        isOpen={showAgreementModal}
        onClose={() => setShowAgreementModal(false)}
        investor={investor}
        onSign={handleSignMoa}
      />
    </div>
  )
}
