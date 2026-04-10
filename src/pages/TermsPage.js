import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import ChatBot from '../components/ChatBot'

export default function TermsPage() {
  const [interestRate, setInterestRate] = useState(0.07)
  const [termsTab, setTermsTab] = useState('installment')
  const effectiveDate = 'March 14, 2026'

  useEffect(() => {
    supabase.from('settings').select('interest_rate').eq('id', 1).single()
      .then(({ data }) => { if (data?.interest_rate) setInterestRate(data.interest_rate) })
  }, [])

  const flatRate = (interestRate * 100).toFixed(0)
  const totalRate = (interestRate * 2 * 100).toFixed(0)
  const effectiveAnnual = (interestRate * 12 * 100).toFixed(0)

  const handlePrint = () => window.print()

  const handleDownload = () => {
    const content = document.querySelector('.print-container')
    if (!content) return
    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><title>MoneyfestLending — Terms and Conditions</title><link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&family=Space+Grotesk:wght@700;800;900&display=swap" rel="stylesheet"/><style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:'DM Sans',sans-serif;background:#fff;color:#111;padding:40px;max-width:860px;margin:0 auto;font-size:13px;line-height:1.7;}h1,h2{font-family:'Space Grotesk',sans-serif;color:#111;}.print-title{color:#111!important;}.print-body{color:#333!important;}.print-muted{color:#777!important;}.print-highlight{color:#111!important;font-weight:700;}.print-header{border-bottom:2px solid #111;padding-bottom:20px;margin-bottom:28px;}.print-section{background:#f9f9f9;border:1px solid #ddd;border-radius:8px;padding:16px 18px;margin-bottom:18px;}.print-row{background:#f5f5f5;border:1px solid #e5e5e5;border-radius:6px;padding:8px 12px;margin-bottom:6px;font-size:12px;}.print-footer{border-top:2px solid #111;padding-top:16px;margin-top:28px;font-size:11px;color:#777;}.signature-box{border-bottom:1px solid #333;padding-bottom:8px;margin-bottom:16px;}.no-print{display:none!important;}@media print{@page{size:A4;margin:15mm 18mm;}}</style></head><body>${content.innerHTML}</body></html>`
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `MoneyfestLending_Terms_and_Conditions.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  const qlSections = [
    {
      num: '1', title: 'Nature of QuickLoan', content: null, items: [
        { term: 'Product', def: 'QuickLoan is a short-term cash loan offered exclusively to active team members of MoneyfestLending\'s workplace lending program.' },
        { term: 'Maximum Amount', def: 'P3,000 per loan.' },
        { term: 'No Fixed Term', def: 'Unlike the Installment Loan, QuickLoan has no fixed repayment schedule. Interest accrues daily and the Borrower may settle at any time.' },
      ]
    },
    {
      num: '2', title: 'Interest Rate and Daily Accrual', content: null, items: [
        { term: 'Monthly Rate', def: '10% per month, flat.' },
        { term: 'Daily Rate', def: '0.3333% per day (10% divided by 30 days). Interest is NOT compounded.' },
        { term: 'Daily Interest Amount', def: 'P3.33/day on a P1,000 loan. P6.67/day on a P2,000 loan. P10.00/day on a P3,000 loan.' },
        { term: 'Effective Annual Rate', def: 'Approximately 120% per annum (monthly rate x 12), in compliance with RA 3765.' },
        { term: 'Accrual Start', def: 'Interest begins accruing on the date of fund release.' },
      ]
    },
    {
      num: '3', title: 'Pay Anytime — Early Settlement', content: 'The Borrower may settle the full outstanding balance at any time before Day 15 or Day 30:', items: [
        { term: 'No Prepayment Penalty', def: 'Settling early saves money. Paying on Day 7 instead of Day 15 saves 8 days of interest.' },
        { term: 'Interest Stops', def: 'Interest stops accruing on the day payment is received and confirmed by the admin.' },
        { term: 'Full Payment Required', def: 'The full balance (principal + all accrued interest) must be paid in one transaction.' },
      ]
    },
    {
      num: '4', title: 'Day 15 Target Due Date', content: null, items: [
        { term: 'Target Date', def: '15 calendar days from the fund release date.' },
        { term: 'Amount Due on Day 15', def: 'Principal + 15 days of accrued interest. Example: P3,000 loan = P3,000 + P150 interest = P3,150 total.' },
        { term: 'Clean Closure', def: 'Paying in full by Day 15 closes the loan with no additional fees.' },
      ]
    },
    {
      num: '5', title: 'Day 15 Missed — Extension Fee', content: 'If the Borrower does not pay in full by Day 15:', items: [
        { term: 'Extension Fee', def: 'A one-time fee of P100.00 is charged.' },
        { term: 'Day 15 Collection', def: 'Admin collects: 15-day accrued interest + P100 extension fee. Example on a P3,000 loan: P150 + P100 = P250 collected.' },
        { term: 'Principal Rolls Over', def: 'The P3,000 principal remains outstanding and the deadline moves to Day 30.' },
        { term: 'Interest Continues', def: 'Daily interest continues to accrue on the outstanding principal during the extension period.' },
      ]
    },
    {
      num: '6', title: 'Day 30 Hard Deadline and Penalty', content: 'Day 30 from the fund release date is the absolute final deadline:', items: [
        { term: 'Hard Deadline', def: '30 calendar days from the release date.' },
        { term: 'Penalty Rate', def: 'P25.00 per calendar day, with no cap, beginning Day 31.' },
        { term: 'Simultaneous Charges', def: 'After Day 30, the P25/day penalty and daily interest both accrue simultaneously until fully settled.' },
        { term: 'Example (Day 35 on P3,000)', def: 'P3,000 principal + P350 interest (35 days x P10) + P100 extension fee + P125 penalty (5 days x P25) = P3,575 total.' },
      ]
    },
    {
      num: '7', title: 'No Security Hold', content: null, items: [
        { term: 'Full Release', def: 'QuickLoan carries no Security Hold deduction. The full approved loan amount is released to the Borrower upon activation.' },
        { term: 'Risk Management', def: 'The daily interest structure, extension fee, and post-Day 30 penalty serve as the risk management mechanism in place of a Security Hold.' },
      ]
    },
    {
      num: '8', title: 'Full Payoff Only', content: null, items: [
        { term: 'Single Payment', def: 'QuickLoan must be settled in a single full payment covering principal + all accrued interest + any extension fee + any penalty.' },
        { term: 'No Partial Principal Payments', def: 'Partial payments toward the principal are not accepted under the QuickLoan structure.' },
      ]
    },
    {
      num: '9', title: 'One Active Loan at a Time', content: null, items: [
        { term: 'One Loan Rule', def: 'A Borrower may not hold more than one active loan at a time, regardless of loan type.' },
        { term: 'Cross-Type Restriction', def: 'A Borrower with an active Installment Loan may not take a QuickLoan, and vice versa.' },
        { term: 'Prerequisite', def: 'The Borrower must fully settle any existing loan before applying for a new one.' },
      ]
    },
    {
      num: '10', title: 'Loan History and Credit Record', content: null, items: [
        { term: 'Clean Closure', def: 'A QuickLoan fully settled by Day 15 is recorded as a clean closure in the Borrower\'s history.' },
        { term: 'Extension Record', def: 'A QuickLoan that triggers the extension fee is recorded accordingly.' },
        { term: 'Penalty Record', def: 'A QuickLoan that incurs post-Day 30 penalties is recorded as a penalty case in the Borrower\'s loan history.' },
      ]
    },
    { num: '11', title: 'Data Privacy (RA 10173)', content: 'The Borrower\'s personal information is collected and processed solely for loan administration in compliance with Republic Act No. 10173 (Data Privacy Act of 2012).', items: null },
    { num: '12', title: 'Truth in Lending Disclosure (RA 3765)', content: 'In compliance with Republic Act No. 3765, MoneyfestLending discloses: the loan principal, the daily and monthly interest rate (10%/month, 0.3333%/day), the extension fee of P100 if Day 15 is missed, the penalty of P25/day after Day 30, and the total amount payable as of the date of settlement. The effective annual rate is approximately 120% per annum.', items: null },
    { num: '13', title: 'Amendments', content: 'MoneyfestLending reserves the right to amend these Terms and Conditions at any time. Any changes will be communicated to active Borrowers via the Borrower Portal or direct notification.', items: null },
    { num: '14', title: 'Governing Law', content: 'This agreement is governed by the laws of the Republic of the Philippines, including RA 3765 (Truth in Lending Act), RA 10173 (Data Privacy Act of 2012), and RA 8792 (E-Commerce Act of 2000). Disputes shall first be referred to barangay conciliation under RA 7160 before formal court proceedings. MoneyfestLending is a private colleague lending program and is not a bank, quasi-bank, or BSP-supervised financial institution.', items: null },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#0B0F1A', fontFamily: 'DM Sans, sans-serif' }}>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-container { background: #fff !important; color: #000 !important; padding: 32px !important; max-width: 100% !important; margin: 0 !important; }
          .print-header { border-bottom: 2px solid #000 !important; }
          .print-section { border: 1px solid #ccc !important; background: #f9f9f9 !important; }
          .section-num { background: #000 !important; color: #fff !important; }
          .print-title { color: #000 !important; }
          .print-subtitle { color: #333 !important; }
          .print-body { color: #222 !important; }
          .print-muted { color: #555 !important; }
          .print-highlight { color: #000 !important; font-weight: bold !important; }
          .print-badge { border: 1px solid #000 !important; color: #000 !important; background: #fff !important; }
          .print-row { background: #f5f5f5 !important; border: 1px solid #ddd !important; }
          .print-footer { border-top: 2px solid #000 !important; color: #333 !important; }
          .signature-box { border: 1px solid #000 !important; background: #fff !important; }
          @page { margin: 20mm; size: A4; }
        }
      `}</style>

      <div className="no-print" style={{ background: 'linear-gradient(135deg,#0d1226,#141B2D)', borderBottom: '1px solid rgba(139,92,246,0.2)', padding: '18px 28px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <img src="/favicon-96x96.png" alt="MoneyfestLending" style={{ width: 36, height: 36, objectFit: 'contain' }} />
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 18, color: '#F0F4FF' }}>
              Moneyfest<span style={{ background: 'linear-gradient(90deg,#60a5fa,#a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Lending</span>
            </div>
          </a>
          <div style={{ display: 'flex', gap: 8 }}>
            <a href="/privacy" style={{ padding: '7px 14px', borderRadius: 9, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#7A8AAA', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>Privacy Notice</a>
            <a href="/apply" style={{ padding: '7px 14px', borderRadius: 9, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#7A8AAA', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>Apply</a>
            <a href="/portal" style={{ padding: '7px 14px', borderRadius: 9, background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)', color: '#a78bfa', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>My Portal</a>
          </div>
        </div>
      </div>

      <div className="no-print" style={{ background: 'rgba(34,197,94,0.06)', borderBottom: '1px solid rgba(34,197,94,0.15)', padding: '12px 28px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src="/verified.png" alt="verified" style={{ width: 18, height: 18, objectFit: 'contain' }} />
            <span style={{ fontSize: 13, color: '#86EFAC', fontWeight: 600 }}>Save a copy of this document for your records.</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleDownload} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 9, background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)', color: '#60a5fa', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Space Grotesk' }}>
              Download HTML
            </button>
            <button onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 9, background: 'linear-gradient(135deg,#22C55E,#16A34A)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Space Grotesk' }}>
              Print / Save as PDF
            </button>
          </div>
        </div>
      </div>

      <div className="no-print" style={{ maxWidth: 860, margin: '0 auto', padding: '24px 28px 0' }}>
        <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 4, width: 'fit-content' }}>
          {[{ key: 'installment', label: 'Installment Loan' }, { key: 'quickloan', label: 'QuickLoan' }].map(tab => (
            <button key={tab.key} onClick={() => setTermsTab(tab.key)} style={{
              padding: '8px 20px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, transition: 'all 0.15s ease',
              background: termsTab === tab.key ? (tab.key === 'quickloan' ? 'rgba(245,158,11,0.2)' : 'rgba(139,92,246,0.15)') : 'transparent',
              color: termsTab === tab.key ? (tab.key === 'quickloan' ? '#F59E0B' : '#a78bfa') : '#7A8AAA',
            }}>{tab.label}</button>
          ))}
        </div>
      </div>

      {termsTab === 'quickloan' && (
        <div className="print-container" style={{ maxWidth: 860, margin: '0 auto', padding: '32px 28px 80px' }}>
          <div className="print-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 28, marginBottom: 36 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <img src="/favicon-96x96.png" alt="MoneyfestLending" className="no-print" style={{ width: 40, height: 40, objectFit: 'contain' }} />
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 22, color: '#F0F4FF' }} className="print-title">MoneyfestLending</div>
            </div>
            <h1 style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 32, color: '#F59E0B', margin: '0 0 8px', letterSpacing: -1 }}>QuickLoan Terms and Conditions</h1>
            <div style={{ fontSize: 13, color: '#7A8AAA', marginBottom: 20 }}>Effective: {effectiveDate} - Private and Exclusive Program</div>
            <div style={{ marginTop: 20, padding: '12px 16px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, fontSize: 13, color: '#FDE68A', lineHeight: 1.7 }} className="print-badge">
              <strong>Important:</strong> By submitting a QuickLoan application through MoneyfestLending, you confirm that you have read, understood, and agreed to all terms and conditions stated in this document. This is a legally binding agreement between you (the Borrower) and MoneyfestLending (the Lender).
            </div>
          </div>
          {qlSections.map((sec, idx) => (
            <div key={idx} style={{ marginBottom: 28 }}>
              <div className="print-section" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(245,158,11,0.12)', borderRadius: 14, padding: '20px 22px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: sec.content || sec.items ? 14 : 0 }}>
                  <div className="section-num" style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 12, color: '#F59E0B' }}>{sec.num}</div>
                  <h2 className="print-title" style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 16, color: '#F0F4FF', margin: 0, paddingTop: 4 }}>{sec.title}</h2>
                </div>
                {sec.content && <p className="print-body" style={{ fontSize: 13, color: '#8892B0', lineHeight: 1.85, margin: '0 0 12px 44px' }}>{sec.content}</p>}
                {sec.items && (
                  <div style={{ marginLeft: 44, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {sec.items.map((item, j) => (
                      <div key={j} className="print-row" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(245,158,11,0.08)', borderRadius: 8, padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#F59E0B', flexShrink: 0, marginTop: 6 }}></div>
                        <div style={{ fontSize: 13, color: '#8892B0', lineHeight: 1.7 }} className="print-body">
                          {item.term && <strong className="print-highlight" style={{ color: '#FDE68A' }}>{item.term}: </strong>}
                          {item.def}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          <div style={{ marginTop: 24, padding: '16px 20px', background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 12, fontSize: 12, color: '#7A8AAA', lineHeight: 1.7 }}>
            <strong style={{ color: '#F59E0B' }}>RA 3765 Truth in Lending Act Disclosure:</strong> QuickLoan carries a monthly interest rate of 10% (daily: 0.3333%). No compounding. Total finance charge depends on days outstanding. Extension fee of P100 applies if Day 15 is missed. Daily penalty of P25 applies after Day 30. MoneyfestLending is a private colleague lending program, not a BSP-regulated institution.
          </div>

          <div style={{ marginTop: 40, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '28px 24px' }}>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 15, color: '#F0F4FF', marginBottom: 6 }} className="print-title">Borrower Acknowledgment</div>
            <p style={{ fontSize: 13, color: '#7A8AAA', lineHeight: 1.7, marginBottom: 28 }} className="print-body">By submitting a QuickLoan application through MoneyfestLending, I confirm that I have read, understood, and agreed to all of the above Terms and Conditions, including the daily interest structure, extension fee, and post-Day 30 penalty.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              {['Borrower Full Name', 'Signature over Printed Name', 'Date Signed', 'Access Code / Loan Reference'].map((label, i) => (
                <div key={i} className="signature-box" style={{ borderBottom: '1px solid rgba(255,255,255,0.15)', paddingBottom: 8 }}>
                  <div style={{ fontSize: 11, color: '#4B5580', marginBottom: 24, textTransform: 'uppercase', letterSpacing: '0.06em' }} className="print-muted">{label}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 32, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              {[{ name: 'John Paul Lacaron', role: 'Administrator / Developer' }, { name: 'Charlou June Ramil', role: 'Administrator' }].map((admin, i) => (
                <div key={i}>
                  <div style={{ fontSize: 11, color: '#4B5580', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }} className="print-muted">Approved by</div>
                  <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 13, color: '#F0F4FF' }} className="print-title">{admin.name}</div>
                  <div style={{ fontSize: 12, color: '#4B5580' }} className="print-muted">{admin.role} - MoneyfestLending</div>
                  <div className="signature-box" style={{ borderBottom: '1px solid rgba(255,255,255,0.15)', marginTop: 20, paddingBottom: 8 }}>
                    <div style={{ fontSize: 11, color: '#4B5580', textTransform: 'uppercase', letterSpacing: '0.06em' }} className="print-muted">Signature</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="print-footer" style={{ marginTop: 36, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ fontSize: 12, color: '#4B5580' }} className="print-muted">MoneyfestLending - Workplace Lending Program - moneyfestlending.loan</div>
            <div style={{ fontSize: 12, color: '#4B5580' }} className="print-muted">Effective: {effectiveDate} - Version 1.0</div>
            <div style={{ fontSize: 11, color: '#4B5580', width: '100%' }} className="print-muted">In compliance with: RA 3765 (Truth in Lending Act) - RA 10173 (Data Privacy Act of 2012) - RA 8792 (E-Commerce Act of 2000)</div>
          </div>
        </div>
      )}

      {termsTab === 'installment' && (
        <div className="print-container" style={{ maxWidth: 860, margin: '0 auto', padding: '48px 28px 80px' }}>
          <div className="print-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 28, marginBottom: 36 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <img src="/favicon-96x96.png" alt="MoneyfestLending" className="no-print" style={{ width: 40, height: 40, objectFit: 'contain' }} />
                  <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 22, color: '#F0F4FF' }} className="print-title">MoneyfestLending</div>
                </div>
                <h1 style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 32, color: '#F0F4FF', margin: '0 0 8px', letterSpacing: -1 }} className="print-title">Terms and Conditions</h1>
                <p style={{ fontSize: 14, color: '#7A8AAA', margin: 0, lineHeight: 1.6 }} className="print-subtitle">Workplace Micro-Lending Program - Internal Use Only</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, color: '#4B5580', marginBottom: 4 }} className="print-muted">Effective Date</div>
                <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 14, color: '#F0F4FF' }} className="print-title">{effectiveDate}</div>
                <div style={{ fontSize: 12, color: '#4B5580', marginTop: 8 }} className="print-muted">Version 1.0</div>
              </div>
            </div>
            <div style={{ marginTop: 20, padding: '12px 16px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, fontSize: 13, color: '#FDE68A', lineHeight: 1.7 }} className="print-badge">
              Important: By submitting a loan application through MoneyfestLending, you confirm that you have read, understood, and agreed to all terms and conditions stated in this document.
            </div>
          </div>

          {[
            { num: '1', title: 'Definitions', content: null, items: [{ term: 'Lender', def: 'MoneyfestLending and its administrators, John Paul Lacaron and Charlou June Ramil.' }, { term: 'Borrower', def: 'The active team member who submits a loan application and is approved.' }, { term: 'Loan Amount or Principal', def: 'The actual amount of money borrowed, exclusive of interest.' }, { term: 'Finance Charge', def: 'The total peso amount of interest charged on the principal.' }, { term: 'Installment', def: 'Each equal payment due every 5th and 20th of the month.' }, { term: 'Cutoff Date', def: 'The 5th and 20th of each month, which are the scheduled payment collection dates.' }, { term: 'Rebate Credits', def: 'In-app reward balance credited when a Borrower pays the final installment early or whose Security Hold is returned.' }, { term: 'Security Hold', def: 'Percentage of the approved loan amount withheld upon release, returned upon full repayment.' }] },
            { num: '2', title: 'Eligibility', content: 'To qualify for a loan under MoneyfestLending, the Borrower must:', items: [{ term: null, def: 'Be an active team member in good standing within the office.' }, { term: null, def: 'Not have an existing active loan that has not been fully repaid.' }, { term: null, def: 'Submit a valid government-issued ID for identity verification.' }, { term: null, def: 'Provide accurate and truthful information in the loan application.' }] },
            { num: '3', title: 'Loan Amount and Limits', content: 'Loan amounts are subject to the Level Attainment System:', items: [{ term: 'Level 1 (First-time Borrower)', def: 'P5,000 - All first-time borrowers are approved at this level.' }, { term: 'Level 2 (After 1 clean loan)', def: 'P7,000' }, { term: 'Level 3 (After 2 clean loans)', def: 'P9,000' }, { term: 'Level 4 (After 3 clean loans)', def: 'P10,000 (Maximum)' }], footer: 'A clean loan means a fully repaid loan with no defaults.' },
            { num: '4', title: 'Interest Rate and Finance Charges', content: null, items: [{ term: 'Monthly Interest Rate', def: `${flatRate}% per month. For a 2-month term the total interest charge is ${totalRate}% of the principal. Interest does not compound.` }, { term: 'Effective Annual Rate', def: `Approximately ${effectiveAnnual}% per annum (monthly rate x 12), in compliance with RA 3765.` }, { term: 'Finance Charge Example', def: `A P5,000 loan on a 2-month term incurs a finance charge of P700.00 (${flatRate}% x 2 months), for a total repayment of P5,700.00 in 4 installments of P1,425.00 each.` }, { term: 'No Hidden Fees', def: 'There are no application fees, processing fees, or any other charges beyond the stated monthly interest rate and applicable late payment penalties.' }] },
            { num: '5', title: 'Repayment Schedule', content: null, items: [{ term: 'Number of Payments', def: 'Equal installments every 5th and 20th of the month - 4 installments for a 2-month term, 6 installments for a 3-month term.' }, { term: 'Installment Rounding', def: 'Where the total repayment does not divide evenly, each installment is rounded up to the nearest whole peso, applied uniformly across all installments.' }, { term: 'Payment Methods', def: 'Physical cash (in person), GCash transfer, RCBC bank transfer, or other bank transfer as arranged with the Lender.' }, { term: 'Proof of Payment', def: 'The Borrower must upload a screenshot or receipt through the Borrower Portal within the same cutoff day.' }] },
            { num: '6', title: 'Early Payoff Rebate Credits', content: 'MoneyfestLending rewards Borrowers who settle their final installment ahead of schedule:', items: [{ term: 'Fixed 1% Rebate', def: 'A fixed rebate of 1% of the original loan amount is credited to Rebate Credits when the final installment is paid at least 7-14 days before its due date.' }, { term: 'Rebate Credits Withdrawal', def: 'Rebate Credits can be withdrawn once the balance reaches a minimum of P500. Withdrawal requests are subject to admin approval.' }, { term: 'Scope', def: 'The rebate applies exclusively to the final installment of the loan.' }] },
            { num: '7', title: 'Late Payment and Default', content: null, items: [{ term: 'Late Payment Penalty', def: 'A penalty of P20.00 per calendar day is charged starting the day after the missed cutoff date. The penalty accrues daily with no cap until fully settled.' }, { term: 'Credit Score Deduction', def: 'Late installment payments result in a deduction of 10 points per late installment. A loan default results in a deduction of 150 points.' }, { term: 'Security Hold Deduction', def: 'Late payment penalties will be automatically deducted from the Security Hold balance.' }, { term: 'Default', def: 'A loan is considered in default if two consecutive installments are missed without prior arrangement with the Lender.' }] },
            { num: '8', title: 'Credit Score System', content: null, items: [{ term: 'Starting Score', def: '750 points for all new borrowers.' }, { term: 'On-time Payment Bonus', def: '+15 points per confirmed on-time installment payment.' }, { term: 'Late Payment Deduction', def: '-10 points per late installment payment.' }, { term: 'Loan Completion Bonus', def: '+25 bonus points upon full repayment of a loan.' }, { term: 'Default Penalty', def: '-150 points upon loan being marked as defaulted.' }] },
            { num: '9', title: 'Security Hold', content: 'A Security Hold is withheld from the approved loan amount upon fund release:', items: [{ term: 'Rate', def: 'VIP (1000) 5%, Reliable (920+) 6%, Trusted (835+) 8%, Standard (750+) 10%, Caution (500+) 15%, High Risk (below 500) 20%.' }, { term: 'Deductions', def: 'Late payment penalties are automatically deducted from the Security Hold balance before return.' }, { term: 'Return', def: 'The remaining Security Hold balance is credited to the Borrower Rebate Credits upon confirmed payment of the final installment.' }] },
            { num: '10', title: 'Borrower Obligations', content: 'By accepting a loan, the Borrower agrees to:', items: [{ term: null, def: 'Provide accurate, truthful, and complete information in the application.' }, { term: null, def: 'Make payments on or before the scheduled cutoff dates.' }, { term: null, def: 'Upload valid proof of payment through the Borrower Portal.' }, { term: null, def: 'Notify the Lender immediately of any changes in employment status.' }] },
            { num: '11', title: 'Lender Rights and Remedies', content: 'MoneyfestLending reserves the following rights:', items: [{ term: 'Loan Approval Discretion', def: 'The Lender reserves the right to approve, reject, or adjust any loan application at its sole discretion.' }, { term: 'Disclosure Compliance', def: 'The Lender will disclose all finance charges and terms clearly before loan release, in compliance with RA 3765.' }, { term: 'Legal Remedies', def: 'In cases of default, the Lender reserves the right to pursue all available legal remedies under Philippine law.' }] },
            { num: '12', title: 'Data Privacy', content: 'Personal information collected during the application process is handled in strict compliance with Republic Act No. 10173 (Data Privacy Act of 2012). The Borrower data is used solely for loan processing and internal record-keeping.', items: null },
            { num: '13', title: 'Truth in Lending Disclosure (RA 3765)', content: `In compliance with Republic Act No. 3765, MoneyfestLending discloses: the principal amount, the finance charge in peso terms, the monthly interest rate of ${flatRate}% applied over the chosen loan term, the effective annual interest rate of approximately ${effectiveAnnual}%, the total amount payable, and the full installment schedule.`, items: null },
            { num: '14', title: 'Amendments', content: 'MoneyfestLending reserves the right to amend these Terms and Conditions at any time. Any changes will be communicated to active borrowers via the Borrower Portal or email.', items: null },
            { num: '15', title: 'Governing Law', content: 'These Terms and Conditions shall be governed by the laws of the Republic of the Philippines. Disputes shall be settled amicably via Katarungang Pambarangay (RA 7160) before escalation to formal legal proceedings.', items: null },
          ].map((sec, idx) => (
            <div key={idx} style={{ marginBottom: 28 }}>
              <div className="print-section" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '20px 22px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: sec.content || sec.items ? 14 : 0 }}>
                  <div className="section-num" style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 12, color: '#818CF8' }}>{sec.num}</div>
                  <h2 className="print-title" style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 16, color: '#F0F4FF', margin: 0, paddingTop: 4 }}>{sec.title}</h2>
                </div>
                {sec.content && <p className="print-body" style={{ fontSize: 13, color: '#8892B0', lineHeight: 1.85, margin: '0 0 12px 44px' }}>{sec.content}</p>}
                {sec.items && (
                  <div style={{ marginLeft: 44, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {sec.items.map((item, j) => (
                      <div key={j} className="print-row" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 8, padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#6366F1', flexShrink: 0, marginTop: 6 }}></div>
                        <div style={{ fontSize: 13, color: '#8892B0', lineHeight: 1.7 }} className="print-body">
                          {item.term && <strong className="print-highlight" style={{ color: '#CBD5F0' }}>{item.term}: </strong>}
                          {item.def}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {sec.footer && <p style={{ fontSize: 12, color: '#4B5580', margin: '10px 0 0 44px', fontStyle: 'italic' }} className="print-muted">{sec.footer}</p>}
              </div>
            </div>
          ))}

          <div style={{ marginTop: 40, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '28px 24px' }}>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 15, color: '#F0F4FF', marginBottom: 6 }} className="print-title">Borrower Acknowledgment</div>
            <p style={{ fontSize: 13, color: '#7A8AAA', lineHeight: 1.7, marginBottom: 28 }} className="print-body">By submitting a loan application through MoneyfestLending, I confirm that I have read, understood, and agreed to all of the above Terms and Conditions.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              {['Borrower Full Name', 'Signature over Printed Name', 'Date Signed', 'Access Code / Loan Reference'].map((label, i) => (
                <div key={i} className="signature-box" style={{ borderBottom: '1px solid rgba(255,255,255,0.15)', paddingBottom: 8 }}>
                  <div style={{ fontSize: 11, color: '#4B5580', marginBottom: 24, textTransform: 'uppercase', letterSpacing: '0.06em' }} className="print-muted">{label}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 32, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              {[{ name: 'John Paul Lacaron', role: 'Administrator / Developer' }, { name: 'Charlou June Ramil', role: 'Administrator' }].map((admin, i) => (
                <div key={i}>
                  <div style={{ fontSize: 11, color: '#4B5580', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }} className="print-muted">Approved by</div>
                  <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 13, color: '#F0F4FF' }} className="print-title">{admin.name}</div>
                  <div style={{ fontSize: 12, color: '#4B5580' }} className="print-muted">{admin.role} - MoneyfestLending</div>
                  <div className="signature-box" style={{ borderBottom: '1px solid rgba(255,255,255,0.15)', marginTop: 20, paddingBottom: 8 }}>
                    <div style={{ fontSize: 11, color: '#4B5580', textTransform: 'uppercase', letterSpacing: '0.06em' }} className="print-muted">Signature</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="print-footer" style={{ marginTop: 36, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ fontSize: 12, color: '#4B5580' }} className="print-muted">MoneyfestLending - Workplace Lending Program - moneyfestlending.loan</div>
            <div style={{ fontSize: 12, color: '#4B5580' }} className="print-muted">Effective: {effectiveDate} - Version 1.0</div>
            <div style={{ fontSize: 11, color: '#4B5580', width: '100%' }} className="print-muted">In compliance with: RA 3765 (Truth in Lending Act) - RA 10173 (Data Privacy Act of 2012) - RA 9474 (Lending Company Regulation Act)</div>
          </div>
        </div>
      )}

      <div className="no-print" style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 100, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button onClick={handleDownload} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 20px', borderRadius: 12, background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(59,130,246,0.4)', color: '#60a5fa', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Space Grotesk', backdropFilter: 'blur(8px)' }}>Download</button>
        <button onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 20px', borderRadius: 12, background: 'linear-gradient(135deg,#22C55E,#16A34A)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Space Grotesk', boxShadow: '0 4px 20px rgba(34,197,94,0.4)' }}>Print / PDF</button>
      </div>

      <ChatBot />
    </div>
  )
}
