import React, { useRef } from 'react'
import { Printer, Download, PenTool } from 'lucide-react'

const TIER_RATES = {
  'Premium': 0.09,
  'Standard': 0.08,
  'Starter': 0.07
}

export default function InvestorMoa({ investor, onSign, isAdmin = false, currentAdminSlot = null }) {
  const printRef = useRef()

  if (!investor) return null

  const isSigned = !!investor.signed_at
  const admin1Signed = !!investor.admin_signature_data
  const admin2Signed = !!investor.admin2_signature_data

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="moa-outer-container">
      <style>{`
        .moa-container { 
          background: #fff; 
          color: #000; 
          padding: 60px 80px; 
          border-radius: 8px; 
          max-width: 850px; 
          margin: 0 auto;
          box-shadow: 0 4px 20px rgba(0,0,0,0.1);
          font-family: 'Times New Roman', serif;
          line-height: 1.5;
        }
        .moa-header { text-align: center; margin-bottom: 40px; }
        .moa-header h1 { font-family: 'Inter', sans-serif; font-size: 24px; font-weight: 800; text-transform: uppercase; margin-bottom: 8px; margin-top: 0; }
        .moa-header p { font-family: 'Inter', sans-serif; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; color: #555; }
        .moa-section-title { font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 800; text-transform: uppercase; margin: 30px 0 15px; border-bottom: 2px solid #000; padding-bottom: 5px; }
        .moa-clause { margin-bottom: 15px; font-size: 13px; text-align: justify; }
        .moa-terms-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; background: #f9fafb; padding: 20px; border-radius: 8px; border: 1px solid #eee; margin: 20px 0; }
        .moa-term-row { margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 8px; display: flex; flex-direction: column; }
        .moa-term-label { font-family: 'Inter', sans-serif; font-size: 9px; font-weight: 700; color: #777; text-transform: uppercase; margin-bottom: 4px; }
        .moa-term-value { font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 700; color: #000; }
        .moa-signatures { margin-top: 40px; display: flex; justify-content: space-between; gap: 20px; flex-wrap: wrap; }
        .moa-sig-block { flex: 1; min-width: 200px; text-align: center; }
        .moa-sig-line { border-top: 1px solid #000; margin-top: 30px; padding-top: 10px; font-family: 'Inter', sans-serif; font-size: 12px; font-weight: 700; text-transform: uppercase; }
        .moa-sig-sub { font-family: 'Inter', sans-serif; font-size: 10px; color: #777; margin-top: 4px; }
        
        .no-print-actions {
          margin-top: 30px;
          display: flex;
          justify-content: center;
          gap: 12px;
        }

        @media print {
          /* Reset whole body for print */
          @page {
            size: A4;
            margin: 15mm;
          }
          body {
            background: #fff !important;
            color: #000 !important;
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
          }
          /* Hide everything first */
          body * { 
            visibility: hidden; 
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          /* Show ONLY the MOA container */
          .moa-outer-container, 
          .moa-outer-container *,
          .moa-container,
          .moa-container * { 
            visibility: visible !important; 
          }
          /* Force it to start at the top and take full width */
          .moa-outer-container { 
            display: block !important;
            position: absolute !important; 
            left: 0 !important; 
            top: 0 !important; 
            width: 100% !important; 
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
          }
          .moa-container { 
            display: block !important;
            box-shadow: none !important; 
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: none !important;
            border: none !important;
            overflow: visible !important;
          }
          .no-print-actions { display: none !important; }
          /* Ensure text sizes are readable on paper */
          .moa-clause { font-size: 14pt !important; line-height: 1.6 !important; }
          .moa-header h1 { font-size: 20pt !important; margin-bottom: 5mm !important; }
          .moa-header p { font-size: 10pt !important; }
          .moa-term-value { font-size: 14pt !important; }
          .moa-signatures { margin-top: 15mm !important; }
        }
      `}</style>

      <div className="moa-container" ref={printRef}>
        <div className="moa-header">
          <h1>Memorandum of Agreement</h1>
          <p>Moneyfest Lending Workplace Partner Program</p>
        </div>

        <div className="moa-clause">
          This Agreement is made and entered into this <strong>{new Date(investor.signed_at || new Date()).getDate()}</strong> day of <strong>{new Date(investor.signed_at || new Date()).toLocaleString('default', { month: 'long' })}</strong>, 2026, by and between:
          
          <div style={{ marginTop: 20, paddingLeft: 20, borderLeft: '3px solid #eee' }}>
            <p><strong>MONEYFEST LENDING</strong>, a workplace-integrated lending program represented by <strong>JOHN PAUL LACARON</strong> and/or <strong>CHARLOU JUNE RAMIL</strong>, hereinafter referred to as the <strong>"PLATFORM"</strong>;</p>
            <p style={{ textAlign: 'center', margin: '15px 0', fontSize: 14, fontWeight: 700 }}>- and -</p>
            <p><strong>{investor.full_name.toUpperCase()}</strong>, of legal age, hereinafter referred to as the <strong>"PARTNER"</strong>.</p>
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
            <span className="moa-term-value">{new Date(investor.signed_at || new Date()).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
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

        <div className="moa-section-title">Section 3: Deployment-Based Accrual</div>
        <div className="moa-clause">
          The PARTNER acknowledges that interest does <strong>not</strong> begin accruing upon the date of capital transfer. Instead, the Accrual Period shall officially commence only upon the <strong>Actual Deployment Date</strong>. Principal held in the Standing Pool does not accrue interest.
        </div>

        <div className="moa-section-title">Section 4: Risk Mitigation</div>
        <div className="moa-clause">
          The Platform shall employ its standard "Tri-Layer Defense" to protect the Partner’s Principal, including 10-20% Security Holds from borrowers and strict Credit Score minimums (750+).
        </div>

        <div className="moa-section-title">Section 5: Confidentiality</div>
        <div className="moa-clause">
          This agreement is strictly private and confidential. The PARTNER agrees not to disclose borrower identities or internal platform logic to third parties.
        </div>

        <div className="moa-signatures">
          {/* Partner Signature */}
          <div className="moa-sig-block">
            <div style={{ minHeight: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {investor.signature_data ? (
                <img src={investor.signature_data} alt="Partner Signature" style={{ maxHeight: 80, maxWidth: '100%' }} />
              ) : (
                <div style={{ fontStyle: 'italic', color: '#ccc', fontSize: 16 }}>PENDING SIGNATURE</div>
              )}
            </div>
            <div className="moa-sig-line">{investor.full_name}</div>
            <div className="moa-sig-sub">PARTNER / INVESTOR SIGNATURE</div>
            {investor.signed_at && (
              <div style={{ fontSize: 9, color: '#999', marginTop: 4 }}>
                Digitally Signed: {new Date(investor.signed_at).toLocaleString()}
              </div>
            )}
          </div>

          {/* Admin Slot 1: John Paul Lacaron */}
          <div className="moa-sig-block" style={{ flex: '1 1 45%' }}>
            <div style={{ minHeight: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {investor.admin_signature_data ? (
                <img src={investor.admin_signature_data} alt="Admin Signature JP" style={{ maxHeight: 80, maxWidth: '100%' }} />
              ) : isAdmin && currentAdminSlot === 1 ? (
                <button onClick={() => onSign(1)} style={{ background: 'rgba(139,92,246,0.1)', color: '#8B5CF6', border: '1px dashed #8B5CF6', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
                  <PenTool size={14} style={{ marginRight: 6 }} /> CLICK TO COUNTER-SIGN
                </button>
              ) : (
                <div style={{ fontStyle: 'italic', color: '#ccc', fontSize: 14 }}>PENDING: JOHN PAUL LACARON</div>
              )}
            </div>
            <div className="moa-sig-line">JOHN PAUL LACARON</div>
            <div className="moa-sig-sub">AUTHORIZED REPRESENTATIVE</div>
            {investor.admin_signed_at && (
              <div style={{ fontSize: 9, color: '#999', marginTop: 4 }}>
                Signed: {new Date(investor.admin_signed_at).toLocaleString()}
              </div>
            )}
          </div>

          {/* Admin Slot 2: Charlou June Ramil */}
          <div className="moa-sig-block" style={{ flex: '1 1 45%', marginTop: '20px' }}>
            <div style={{ minHeight: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {investor.admin2_signature_data ? (
                <img src={investor.admin2_signature_data} alt="Admin Signature CJ" style={{ maxHeight: 80, maxWidth: '100%' }} />
              ) : isAdmin && currentAdminSlot === 2 ? (
                <button onClick={() => onSign(2)} style={{ background: 'rgba(107,114,128,0.1)', color: '#6B7280', border: '1px dashed #6B7280', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
                  <PenTool size={14} style={{ marginRight: 6 }} /> CLICK TO COUNTER-SIGN
                </button>
              ) : (
                <div style={{ fontStyle: 'italic', color: '#ccc', fontSize: 14 }}>PENDING: CHARLOU JUNE RAMIL</div>
              )}
            </div>
            <div className="moa-sig-line">CHARLOU JUNE RAMIL</div>
            <div className="moa-sig-sub">AUTHORIZED REPRESENTATIVE</div>
            {investor.admin2_signed_at && (
              <div style={{ fontSize: 9, color: '#999', marginTop: 4 }}>
                Signed: {new Date(investor.admin2_signed_at).toLocaleString()}
              </div>
            )}
          </div>
        </div>

        <div className="no-print-actions">
          <button onClick={handlePrint} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: '#f5f5f5', border: '1px solid #ddd', color: '#333' }}>
            <Printer size={18} /> Print/Save as PDF
          </button>
          <button onClick={handlePrint} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: '#0B0F1A', border: '1px solid #22D3EE', color: '#fff' }}>
            <Download size={18} /> Official Download
          </button>
        </div>
      </div>
    </div>
  )
}
