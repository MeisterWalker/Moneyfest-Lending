import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function TermsPage() {
  const [interestRate, setInterestRate] = useState(0.07)
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
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>MoneyfestLending — Terms and Conditions</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&family=Space+Grotesk:wght@700;800;900&display=swap" rel="stylesheet"/>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'DM Sans',sans-serif; background:#fff; color:#111; padding:40px; max-width:860px; margin:0 auto; font-size:13px; line-height:1.7; }
  h1,h2 { font-family:'Space Grotesk',sans-serif; color:#111; }
  .print-title { color:#111 !important; }
  .print-subtitle { color:#555 !important; }
  .print-body { color:#333 !important; }
  .print-muted { color:#777 !important; }
  .print-highlight { color:#111 !important; font-weight:700; }
  .print-header { border-bottom:2px solid #111; padding-bottom:20px; margin-bottom:28px; }
  .print-section { background:#f9f9f9; border:1px solid #ddd; border-radius:8px; padding:16px 18px; margin-bottom:18px; }
  .section-num { background:#111; color:#fff; width:28px; height:28px; border-radius:6px; display:inline-flex; align-items:center; justify-content:center; font-family:'Space Grotesk',sans-serif; font-weight:800; font-size:11px; margin-right:10px; flex-shrink:0; }
  .print-badge { border:1px solid #b45309; background:#fffbeb; color:#92400e; padding:10px 14px; border-radius:8px; margin-top:14px; font-size:12px; }
  .print-row { background:#f5f5f5; border:1px solid #e5e5e5; border-radius:6px; padding:8px 12px; margin-bottom:6px; font-size:12px; }
  .print-footer { border-top:2px solid #111; padding-top:16px; margin-top:28px; font-size:11px; color:#777; }
  .signature-box { border-bottom:1px solid #333; padding-bottom:8px; margin-bottom:16px; }
  .no-print { display:none !important; }
  @media print { @page { size:A4; margin:15mm 18mm; } }
</style>
</head>
<body>
${content.innerHTML}
</body>
</html>`
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `MoneyfestLending_Terms_and_Conditions.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0B0F1A', fontFamily: 'DM Sans, sans-serif' }}>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-container {
            background: #fff !important;
            color: #000 !important;
            padding: 32px !important;
            max-width: 100% !important;
            margin: 0 !important;
          }
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

      {/* Nav — hidden on print */}
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

      {/* Download/Print bar — hidden on print */}
      <div className="no-print" style={{ background: 'rgba(34,197,94,0.06)', borderBottom: '1px solid rgba(34,197,94,0.15)', padding: '12px 28px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src="/verified.png" alt="verified" style={{ width: 18, height: 18, objectFit: 'contain' }} />
            <span style={{ fontSize: 13, color: '#86EFAC', fontWeight: 600 }}>
              Save a copy of this document for your records.
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleDownload}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 9, background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)', color: '#60a5fa', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Space Grotesk' }}>
              ⬇️ Download HTML
            </button>
            <button onClick={handlePrint}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 9, background: 'linear-gradient(135deg,#22C55E,#16A34A)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Space Grotesk' }}>
              🖨️ Print / Save as PDF
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="print-container" style={{ maxWidth: 860, margin: '0 auto', padding: '48px 28px 80px' }}>

        {/* Header */}
        <div className="print-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 28, marginBottom: 36 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <img src="/favicon-96x96.png" alt="MoneyfestLending" className="no-print" style={{ width: 40, height: 40, objectFit: 'contain' }} />
                <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 22, color: '#F0F4FF' }} className="print-title">
                  MoneyfestLending
                </div>
              </div>
              <h1 style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 32, color: '#F0F4FF', margin: '0 0 8px', letterSpacing: -1 }} className="print-title">
                Terms & Conditions
              </h1>
              <p style={{ fontSize: 14, color: '#7A8AAA', margin: 0, lineHeight: 1.6 }} className="print-subtitle">
                Workplace Micro-Lending Program — Internal Use Only
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, color: '#4B5580', marginBottom: 4 }} className="print-muted">Effective Date</div>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 14, color: '#F0F4FF' }} className="print-title">{effectiveDate}</div>
              <div style={{ fontSize: 12, color: '#4B5580', marginTop: 8 }} className="print-muted">Version 1.0</div>
            </div>
          </div>

          {/* Notice */}
          <div style={{ marginTop: 20, padding: '12px 16px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, fontSize: 13, color: '#FDE68A', lineHeight: 1.7 }} className="print-badge">
            <strong>Important:</strong> By submitting a loan application through MoneyfestLending, you confirm that you have read, understood, and agreed to all terms and conditions stated in this document. This is a legally binding agreement between you (the Borrower) and MoneyfestLending (the Lender).
          </div>
        </div>

        {/* Sections */}
        {[
          {
            num: '1',
            title: 'Definitions',
            content: null,
            items: [
              { term: '"Lender"', def: 'refers to MoneyfestLending and its administrators, John Paul Lacaron and Charlou June Ramil.' },
              { term: '"Borrower"', def: 'refers to the active team member who submits a loan application and is approved.' },
              { term: '"Loan Amount" or "Principal"', def: 'refers to the actual amount of money borrowed, exclusive of interest.' },
              { term: '"Finance Charge"', def: 'refers to the total peso amount of interest charged on the principal.' },
              { term: '"Installment"', def: 'refers to each equal payment due every 5th and 20th of the month. A 2-month loan has 4 installments; a 3-month loan has 6 installments.' },
              { term: '"Cutoff Date"', def: 'refers to the 5th and 20th of each month, which are the scheduled payment collection dates.' },
              { term: '"Rebate Credits"', def: 'refers to the in-app reward balance credited to a Borrower who pays the final installment early or whose Security Hold is returned.' },
              { term: '"Security Hold"', def: 'refers to the percentage of the approved loan amount withheld upon release, returned to the Borrower\'s Rebate Credits upon full repayment.' },
            ]
          },
          {
            num: '2',
            title: 'Eligibility',
            content: 'To qualify for a loan under MoneyfestLending, the Borrower must:',
            items: [
              { term: null, def: 'Be an active team member in good standing within the office.' },
              { term: null, def: 'Not have an existing active loan that has not been fully repaid.' },
              { term: null, def: 'Submit a valid government-issued ID for identity verification.' },
              { term: null, def: 'Provide accurate and truthful information in the loan application.' },
            ]
          },
          {
            num: '3',
            title: 'Loan Amount and Limits',
            content: 'Loan amounts are subject to the Level Attainment System:',
            items: [
              { term: 'Level 1 (First-time Borrower)', def: '₱5,000 — All first-time borrowers are approved at this level regardless of amount requested.' },
              { term: 'Level 2 (After 1 clean loan)', def: '₱7,000' },
              { term: 'Level 3 (After 2 clean loans)', def: '₱9,000' },
              { term: 'Level 4 (After 3 clean loans)', def: '₱10,000 (Maximum)' },
            ],
            footer: 'A "clean loan" means a fully repaid loan with no defaults. Loan limit upgrades are subject to the Borrower maintaining a credit score of at least 750.'
          },
          {
            num: '4',
            title: 'Interest Rate and Finance Charges',
            content: null,
            items: [
              { term: 'Monthly Interest Rate', def: `${flatRate}% per month. For a 2-month term the total interest charge is ${totalRate}% of the principal; for a 3-month term it is ${(interestRate * 3 * 100).toFixed(0)}%. Interest does not compound.` },
              { term: 'Effective Annual Rate', def: `Approximately ${effectiveAnnual}% per annum (monthly rate × 12), in compliance with Republic Act No. 3765 (Truth in Lending Act).` },
              { term: 'Finance Charge Example', def: `A ₱5,000 loan on a 2-month term incurs a finance charge of ₱700.00 (${flatRate}% × 2 months), for a total repayment of ₱5,700.00 in 4 installments of ₱1,425.00 each. On a 3-month term: finance charge ₱1,050.00 (${flatRate}% × 3 months), total ₱6,050.00 in 6 installments of ₱1,008.33 each.` },
              { term: 'No Hidden Fees', def: 'There are no application fees, processing fees, or any other charges beyond the stated monthly interest rate and applicable late payment penalties.' },
            ]
          },
          {
            num: '5',
            title: 'Repayment Schedule',
            content: null,
            items: [
              { term: 'Number of Payments', def: 'Equal installments every 5th and 20th of the month — 4 installments for a 2-month term, 6 installments for a 3-month term.' },
              { term: 'Installment Rounding', def: 'Where the total repayment amount does not divide evenly into equal installments, each installment is rounded up to the nearest whole peso (₱1.00). This rounding is applied uniformly across all installments and is disclosed in the Borrower\'s loan agreement at the time of approval.' },
              { term: 'Payment Dates', def: 'Every 5th and 20th of the month for the duration of the chosen loan term (2 or 3 months) following the release date.' },
              { term: 'Payment Methods', def: 'Physical cash (in person), GCash transfer, RCBC bank transfer, or other bank transfer as arranged with the Lender.' },
              { term: 'Proof of Payment', def: 'The Borrower must upload a screenshot or receipt as proof of payment through the Borrower Portal within the same cutoff day.' },
            ]
          },
          {
            num: '6',
            title: 'Early Payoff Rebate Credits',
            content: 'MoneyfestLending rewards Borrowers who settle their final installment ahead of schedule:',
            items: [
              { term: 'Fixed 1% Rebate', def: 'A fixed rebate of 1% of the original loan amount is credited to the Borrower\'s Rebate Credits balance when the final installment is paid at least 1 to 2 weeks (7–14 days) before its due date. The rate is fixed at 1% regardless of how many days early the payment is made, provided the minimum early payment threshold is met.' },
              { term: 'Rebate Credits Withdrawal', def: 'Rebate Credits can be withdrawn once the balance reaches a minimum of ₱500. Withdrawal requests are subject to admin approval.' },
              { term: 'Scope', def: 'The rebate applies exclusively to the final installment of the loan. All prior installments do not qualify for any rebate regardless of timing.' },
            ]
          },
          {
            num: '7',
            title: 'Late Payment and Default',
            content: null,
            items: [
              { term: 'Late Payment Penalty', def: 'A penalty of ₱20.00 per calendar day is charged starting the day after the missed cutoff date (5th or 20th of the month). The penalty accrues daily with no cap until the installment is fully settled.' },
              { term: 'Credit Score Deduction', def: 'Late installment payments result in a deduction of 10 points per late installment. A loan default results in a deduction of 150 points.' },
              { term: 'Security Hold — Penalty Deduction', def: 'Late payment penalties will be automatically deducted from the Borrower\'s Security Hold balance. The Security Hold amount returned upon full loan completion will reflect any penalty deductions applied during the loan term.' },
              { term: 'Loan Limit Freeze', def: 'Consistent late payments may result in the Borrower\'s loan limit being frozen at the current level.' },
              { term: 'Default', def: 'A loan is considered in default if two (2) consecutive installments are missed without prior arrangement with the Lender.' },
              { term: 'Future Eligibility', def: 'A defaulted loan may permanently affect the Borrower\'s eligibility for future loans under MoneyfestLending.' },
            ]
          },
          {
            num: '8',
            title: 'Credit Score System',
            content: null,
            items: [
              { term: 'Starting Score', def: '750 points for all new borrowers.' },
              { term: 'On-time Payment Bonus', def: '+15 points per confirmed on-time installment payment.' },
              { term: 'Late Payment Deduction', def: '-10 points per late installment payment.' },
              { term: 'Loan Completion Bonus', def: '+25 bonus points upon full repayment of a loan.' },
              { term: 'Default Penalty', def: '-150 points upon loan being marked as defaulted.' },
              { term: 'Score Range', def: '300 (minimum) to 1,000 (maximum). Starting score is 750.' },
              { term: 'Impact', def: 'Credit scores determine borrower tier, loan limit level, and Security Hold rate. Borrowers with scores below 600 are classified as High Risk.' },
            ]
          },
          {
            num: '9',
            title: 'Security Hold',
            content: 'To protect the lending program, a Security Hold is withheld from the approved loan amount upon fund release:',
            items: [
              { term: 'Rate', def: 'The Security Hold rate is determined by the Borrower\'s credit score: VIP (1000) — 5%, Reliable (920+) — 6%, Trusted (835+) — 8%, Standard (750+) — 10%, Caution (500+) — 15%, High Risk (below 500) — 20%.' },
              { term: 'Deductions', def: 'Late payment penalties are automatically deducted from the Security Hold balance before return.' },
              { term: 'Return', def: 'The remaining Security Hold balance is automatically credited to the Borrower\'s Rebate Credits upon confirmed payment of the final installment.' },
            ]
          },
          {
            num: '10',
            title: 'Borrower Obligations',
            content: 'By accepting a loan, the Borrower agrees to:',
            items: [
              { term: null, def: 'Provide accurate, truthful, and complete information in the application.' },
              { term: null, def: 'Make payments on or before the scheduled cutoff dates.' },
              { term: null, def: 'Upload valid proof of payment through the Borrower Portal.' },
              { term: null, def: 'Notify the Lender immediately of any changes in employment status or personal contact information.' },
              { term: null, def: 'Not transfer or assign the loan obligation to another person.' },
            ]
          },
          {
            num: '11',
            title: 'Lender Rights and Remedies',
            content: 'MoneyfestLending, as the Lender, reserves the following rights:',
            items: [
              { term: 'Loan Approval Discretion', def: 'The Lender reserves the right to approve, reject, or adjust any loan application at its sole discretion, without obligation to disclose specific reasons for rejection.' },
              { term: 'Disclosure Compliance', def: 'The Lender will disclose all finance charges and terms clearly before loan release, in compliance with RA 3765 (Truth in Lending Act).' },
              { term: 'Data Protection', def: 'The Lender will protect all personal information in accordance with RA 10173 (Data Privacy Act of 2012) as stated in the Privacy Notice.' },
              { term: 'No Extra Charges', def: 'The Lender will not charge fees beyond the stated monthly interest rate and applicable late payment penalties.' },
              { term: 'Notification', def: 'The Lender will notify the Borrower of approval or rejection of the loan application via email or the Borrower Portal.' },
              { term: 'Demand for Full Payment', def: 'In the event of default or consecutive missed payments, the Lender reserves the right to declare the entire outstanding loan balance immediately due and payable, pursuant to the terms of this agreement and applicable Philippine law.' },
              { term: 'Legal Remedies', def: 'In cases of default, persistent non-payment, or willful evasion of loan obligations, the Lender reserves the right to pursue all available legal remedies under Philippine law, including but not limited to the filing of a civil complaint for collection of sum of money under the Rules of Court, referral to the appropriate barangay for conciliation under the Katarungang Pambarangay Law (RA 7160) prior to court action, and other remedies available under RA 9474 (Lending Company Regulation Act of 2007). The Borrower shall be liable for all costs of collection, including reasonable attorney\'s fees, if legal action becomes necessary.' },
              { term: 'Program Suspension', def: 'The Lender reserves the right to suspend or terminate the Borrower\'s participation in the MoneyfestLending program in cases of fraud, misrepresentation, or repeated non-compliance with these terms.' },
            ]
          },
          {
            num: '12',
            title: 'Data Privacy',
            content: `Personal information collected during the application process is handled in strict compliance with Republic Act No. 10173 — the Data Privacy Act of 2012. The Borrower's data is used solely for loan processing, identity verification, and internal record-keeping. Full details are available in the MoneyfestLending Privacy Notice at moneyfestlending.online/privacy.`,
            items: null
          },
          {
            num: '13',
            title: 'Truth in Lending Disclosure (RA 3765)',
            content: `In compliance with Republic Act No. 3765 (Truth in Lending Act), MoneyfestLending discloses the following for all loans: the principal amount, the finance charge in peso terms, the monthly interest rate of ${flatRate}% (applied over the chosen loan term of 2 or 3 months), the effective annual interest rate of approximately ${effectiveAnnual}%, the total amount payable, and the full installment schedule. This disclosure is accessible at any time through the Borrower Portal.`,
            items: null
          },
          {
            num: '14',
            title: 'Amendments',
            content: 'MoneyfestLending reserves the right to amend these Terms & Conditions at any time. Any changes will be communicated to active borrowers via the Borrower Portal or email. Continued use of the MoneyfestLending platform after such changes constitutes acceptance of the updated terms.',
            items: null
          },
          {
            num: '15',
            title: 'Governing Law',
            content: 'These Terms & Conditions shall be governed by and construed in accordance with the laws of the Republic of the Philippines. Any disputes arising from or in connection with these terms shall be settled amicably between the parties in accordance with the Katarungang Pambarangay Law (RA 7160) before escalation to formal legal proceedings. If amicable settlement fails, disputes shall be resolved through the appropriate courts or agencies of the Philippines having jurisdiction over the matter.',
            items: null
          },
        ].map((sec, idx) => (
          <div key={idx} style={{ marginBottom: 28 }}>
            <div className="print-section" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '20px 22px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: sec.content || sec.items ? 14 : 0 }}>
                <div className="section-num" style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 12, color: '#818CF8' }}>
                  {sec.num}
                </div>
                <h2 className="print-title" style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 16, color: '#F0F4FF', margin: 0, paddingTop: 4 }}>{sec.title}</h2>
              </div>
              {sec.content && (
                <p className="print-body" style={{ fontSize: 13, color: '#8892B0', lineHeight: 1.85, margin: '0 0 12px 44px' }}>{sec.content}</p>
              )}
              {sec.items && (
                <div style={{ marginLeft: 44, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {sec.items.map((item, j) => (
                    <div key={j} className="print-row" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 8, padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#6366F1', flexShrink: 0, marginTop: 6 }} />
                      <div style={{ fontSize: 13, color: '#8892B0', lineHeight: 1.7 }} className="print-body">
                        {item.term && <strong className="print-highlight" style={{ color: '#CBD5F0' }}>{item.term}: </strong>}
                        {item.def}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {sec.footer && (
                <p style={{ fontSize: 12, color: '#4B5580', margin: '10px 0 0 44px', fontStyle: 'italic' }} className="print-muted">{sec.footer}</p>
              )}
            </div>
          </div>
        ))}

        {/* Signature Block */}
        <div style={{ marginTop: 40, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '28px 24px' }}>
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 15, color: '#F0F4FF', marginBottom: 6 }} className="print-title">Borrower Acknowledgment</div>
          <p style={{ fontSize: 13, color: '#7A8AAA', lineHeight: 1.7, marginBottom: 28 }} className="print-body">
            By submitting a loan application through MoneyfestLending, I confirm that I have read, understood, and agreed to all of the above Terms & Conditions. I acknowledge that this constitutes a binding agreement.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            {[
              { label: 'Borrower\'s Full Name', line: true },
              { label: 'Signature over Printed Name', line: true },
              { label: 'Date Signed', line: true },
              { label: 'Access Code / Loan Reference', line: true },
            ].map((field, i) => (
              <div key={i} className="signature-box" style={{ borderBottom: '1px solid rgba(255,255,255,0.15)', paddingBottom: 8 }}>
                <div style={{ fontSize: 11, color: '#4B5580', marginBottom: 24, textTransform: 'uppercase', letterSpacing: '0.06em' }} className="print-muted">{field.label}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 32, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div>
              <div style={{ fontSize: 11, color: '#4B5580', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }} className="print-muted">Approved by</div>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 13, color: '#F0F4FF' }} className="print-title">John Paul Lacaron</div>
              <div style={{ fontSize: 12, color: '#4B5580' }} className="print-muted">Administrator / Developer — MoneyfestLending</div>
              <div style={{ borderBottom: '1px solid rgba(255,255,255,0.15)', marginTop: 20, paddingBottom: 8 }} className="signature-box">
                <div style={{ fontSize: 11, color: '#4B5580', textTransform: 'uppercase', letterSpacing: '0.06em' }} className="print-muted">Signature</div>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#4B5580', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }} className="print-muted">Approved by</div>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 13, color: '#F0F4FF' }} className="print-title">Charlou June Ramil</div>
              <div style={{ fontSize: 12, color: '#4B5580' }} className="print-muted">Administrator — MoneyfestLending</div>
              <div style={{ borderBottom: '1px solid rgba(255,255,255,0.15)', marginTop: 20, paddingBottom: 8 }} className="signature-box">
                <div style={{ fontSize: 11, color: '#4B5580', textTransform: 'uppercase', letterSpacing: '0.06em' }} className="print-muted">Signature</div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="print-footer" style={{ marginTop: 36, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ fontSize: 12, color: '#4B5580' }} className="print-muted">
            MoneyfestLending · Workplace Lending Program · moneyfestlending.online
          </div>
          <div style={{ fontSize: 12, color: '#4B5580' }} className="print-muted">
            Effective: {effectiveDate} · Version 1.0
          </div>
          <div style={{ fontSize: 11, color: '#4B5580', width: '100%' }} className="print-muted">
            In compliance with: RA 3765 (Truth in Lending Act) · RA 10173 (Data Privacy Act of 2012) · RA 9474 (Lending Company Regulation Act)
          </div>
        </div>

      </div>

      {/* Bottom buttons — hidden on print */}
      <div className="no-print" style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 100, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button onClick={handleDownload}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 20px', borderRadius: 12, background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(59,130,246,0.4)', color: '#60a5fa', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Space Grotesk', backdropFilter: 'blur(8px)' }}>
          ⬇️ Download
        </button>
        <button onClick={handlePrint}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 20px', borderRadius: 12, background: 'linear-gradient(135deg,#22C55E,#16A34A)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Space Grotesk', boxShadow: '0 4px 20px rgba(34,197,94,0.4)' }}>
          🖨️ Print / PDF
        </button>
      </div>

    </div>
  )
}
