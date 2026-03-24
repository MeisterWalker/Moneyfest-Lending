import React from 'react'
import { PenTool } from 'lucide-react'

const TIER_RATES = {
  'Premium': 0.09,
  'Standard': 0.08,
  'Starter': 0.07
}

const MOA_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=EB+Garamond:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap');
  .moa-wrap{background:#e8e6e1;padding:40px 20px;font-family:'EB Garamond',serif;color:#111;}
  .moa-page{background:#fff;max-width:820px;margin:0 auto;padding:72px 88px;box-shadow:0 8px 40px rgba(0,0,0,0.15);position:relative;}
  .moa-page::before{content:'';position:absolute;top:16px;left:16px;right:16px;bottom:16px;border:1px solid #c8b99a;pointer-events:none;}
  .moa-hdr{text-align:center;margin-bottom:44px;}
  .moa-logo{font-family:'Inter',sans-serif;font-size:10px;font-weight:700;letter-spacing:4px;color:#8a7560;text-transform:uppercase;margin-bottom:12px;}
  .moa-title{font-size:30px;font-weight:700;letter-spacing:3px;text-transform:uppercase;line-height:1.2;color:#1a1a1a;}
  .moa-sub{font-family:'Inter',sans-serif;font-size:11px;color:#8a7560;letter-spacing:2px;text-transform:uppercase;margin-top:8px;}
  .moa-rule{margin:20px auto 0;width:80px;border:none;border-top:2px solid #1a1a1a;}
  .moa-meta{display:flex;justify-content:space-between;font-family:'Inter',sans-serif;font-size:10px;color:#888;letter-spacing:1px;text-transform:uppercase;margin-bottom:36px;padding-bottom:16px;border-bottom:1px solid #e8e4dc;}
  .moa-pre{font-size:17px;line-height:1.75;text-align:justify;margin-bottom:32px;}
  .moa-wit{text-align:center;font-size:14px;font-weight:700;font-family:'Inter',sans-serif;letter-spacing:3px;text-transform:uppercase;margin:28px 0;color:#555;}
  .moa-pb{background:#faf9f6;border-left:3px solid #c8b99a;padding:16px 20px;margin-bottom:12px;font-size:17px;line-height:1.7;}
  .moa-pr{font-family:'Inter',sans-serif;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#8a7560;margin-bottom:4px;}
  .moa-and{text-align:center;font-family:'Inter',sans-serif;font-size:11px;color:#aaa;letter-spacing:2px;margin:6px 0;}
  .moa-s2{font-family:'Inter',sans-serif;font-size:11px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:#1a1a1a;margin:36px 0 12px;padding-bottom:8px;border-bottom:1px solid #e8e4dc;}
  .moa-sn{color:#8a7560;margin-right:8px;}
  .moa-cl{font-size:17px;line-height:1.75;text-align:justify;margin-bottom:16px;}
  .moa-ci{font-size:17px;line-height:1.75;text-align:justify;margin-bottom:10px;padding-left:28px;position:relative;}
  .moa-cm{position:absolute;left:0;font-weight:600;color:#8a7560;}
  .moa-tt{width:100%;border-collapse:collapse;margin:16px 0 20px;font-size:15px;}
  .moa-tt th{font-family:'Inter',sans-serif;font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;background:#1a1a1a;color:#fff;padding:10px 14px;text-align:left;}
  .moa-tt td{padding:10px 14px;border-bottom:1px solid #e8e4dc;vertical-align:top;}
  .moa-tt tr:nth-child(even) td{background:#faf9f6;}
  .moa-tt td:first-child{font-family:'Inter',sans-serif;font-size:10px;font-weight:600;letter-spacing:0.5px;color:#555;width:48%;}
  .moa-ln{font-family:'Inter',sans-serif;font-size:10.5px;color:#8a7560;background:#faf9f6;border:1px solid #e8e4dc;border-radius:3px;padding:10px 14px;margin:12px 0 20px;line-height:1.6;}
  .moa-ln strong{color:#555;}
  .moa-rb{border:1.5px solid #c8b99a;padding:16px 20px;margin:20px 0;background:#fffdf8;}
  .moa-rbt{font-family:'Inter',sans-serif;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#8a7560;margin-bottom:8px;}
  .moa-rb p{font-size:15px;line-height:1.7;text-align:justify;}
  .moa-ss{margin-top:64px;}
  .moa-si{font-size:17px;line-height:1.75;text-align:center;margin-bottom:48px;font-style:italic;color:#444;}
  .moa-sg{display:grid;grid-template-columns:1fr 1fr;gap:60px;margin-bottom:32px;}
  .moa-sb{text-align:center;}
  .moa-sp{height:80px;border-bottom:1px solid #111;margin-bottom:10px;display:flex;align-items:flex-end;justify-content:center;padding-bottom:5px;}
  .moa-sn2{font-size:15px;font-weight:700;text-transform:uppercase;letter-spacing:1px;}
  .moa-sl{font-family:'Inter',sans-serif;font-size:10px;color:#888;letter-spacing:1px;text-transform:uppercase;margin-top:3px;}
  .moa-sd{margin-top:10px;font-family:'Inter',sans-serif;font-size:11px;color:#aaa;}
  .moa-aw{font-family:'Inter',sans-serif;font-size:10px;color:#aaa;font-style:italic;}
  .moa-btn{background:#1a1a1a;border:none;color:#fff;padding:6px 14px;font-size:10px;font-family:'Inter',sans-serif;font-weight:700;letter-spacing:1px;text-transform:uppercase;cursor:pointer;display:flex;align-items:center;gap:6px;border-radius:3px;margin:0 auto;}
  .moa-btn:hover{background:#333;}
  .moa-nb{margin-top:56px;padding-top:24px;border-top:1px solid #e8e4dc;}
  .moa-nt{font-family:'Inter',sans-serif;font-size:10px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:#8a7560;margin-bottom:14px;text-align:center;}
  .moa-ntx{font-size:15px;line-height:1.75;text-align:justify;color:#444;}
  .moa-ng{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:40px;}
  .moa-nl{border-bottom:1px solid #aaa;margin-bottom:8px;height:40px;}
  .moa-nla{font-family:'Inter',sans-serif;font-size:9px;color:#aaa;letter-spacing:1px;text-transform:uppercase;text-align:center;}
  .moa-ft{margin-top:48px;padding-top:16px;border-top:1px solid #e8e4dc;display:flex;justify-content:space-between;font-family:'Inter',sans-serif;font-size:9px;color:#bbb;letter-spacing:1px;}
  .moa-np{margin-top:30px;display:flex;justify-content:center;}
  .moa-pb2{background:#1a1a1a;color:#fff;border:none;padding:13px 26px;font-family:'Inter',sans-serif;font-size:12px;font-weight:600;letter-spacing:1px;text-transform:uppercase;cursor:pointer;border-radius:2px;}
  .moa-pb2:hover{background:#333;}
  @media print{
    @page{size:A4;margin:15mm;}
    body,.moa-wrap{background:#fff!important;padding:0!important;}
    .moa-page{box-shadow:none!important;padding:0!important;max-width:100%!important;}
    .moa-page::before{display:none!important;}
    .moa-np{display:none!important;}
  }
`

export default function InvestorMoa({ investor, onSign, isAdmin = false, currentAdminSlot = null }) {
  if (!investor) return null

  const signDate = investor.signed_at ? new Date(investor.signed_at) : new Date()
  const day = signDate.getDate()
  const month = signDate.toLocaleString('default', { month: 'long' })
  const year = signDate.getFullYear()

  const rate = TIER_RATES[investor.tier] || 0
  const principal = Number(investor.total_capital || 0)
  const grossReturn = (principal * rate).toLocaleString('en-PH', { minimumFractionDigits: 2 })
  const totalReturn = (principal * (1 + rate)).toLocaleString('en-PH', { minimumFractionDigits: 2 })
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' }) : '________________'

  const slot1Signed = !!investor.admin_signature_data
  const slot2Signed = !!investor.admin2_signature_data
  const showSlot1Btn = isAdmin && !slot1Signed && currentAdminSlot === 1
  const showSlot2Btn = isAdmin && slot1Signed && !slot2Signed && currentAdminSlot === 2

  return (
    <div className="moa-wrap">
      <style>{MOA_STYLES}</style>
      <div className="moa-page">

        {/* HEADER */}
        <div className="moa-hdr">
          <div className="moa-logo">Moneyfest Lending · Republic of the Philippines</div>
          <div className="moa-title">Memorandum of Agreement</div>
          <div className="moa-sub">Investment Partnership Agreement</div>
          <hr className="moa-rule" />
        </div>

        <div className="moa-meta">
          <span>Document No.: ML-MOA-{investor.access_code || '______'}</span>
          <span>Series of 2026</span>
          <span>Page 1 of 1</span>
        </div>

        <div className="moa-pre">
          This <strong>Memorandum of Agreement</strong> (hereinafter referred to as the <strong>"Agreement"</strong>) is entered into this <strong>{day} day of {month}, {year}</strong>, in the City of Iloilo, Republic of the Philippines, by and between:
        </div>

        <div className="moa-wit">— Witnesseth —</div>

        <div style={{ marginBottom: 32 }}>
          <div className="moa-pb">
            <div className="moa-pr">First Party — The Platform</div>
            <strong>MONEYFEST LENDING</strong>, a workplace-integrated lending program duly operating under the laws of the Republic of the Philippines, with principal office address at Mandurriao, Iloilo City, represented herein by its authorized representatives <strong>JOHN PAUL LACARON</strong> and <strong>CHARLOU JUNE RAMIL</strong>, hereinafter referred to as the <strong>"PLATFORM"</strong>;
          </div>
          <div className="moa-and">— AND —</div>
          <div className="moa-pb">
            <div className="moa-pr">Second Party — The Partner / Investor</div>
            <strong>{(investor.full_name || '________________').toUpperCase()}</strong>, of legal age, Filipino citizen, with residential address at {investor.address || '__________________________________________________'}, holder of a valid government-issued identification document, hereinafter referred to as the <strong>"PARTNER"</strong>.
          </div>
        </div>

        <div className="moa-cl">The PLATFORM and the PARTNER are hereinafter collectively referred to as the <strong>"Parties"</strong>.</div>

        {/* SECTION 1 */}
        <div className="moa-s2"><span className="moa-sn">Section 1</span> Recitals and Purpose</div>
        <div className="moa-cl">WHEREAS, the PLATFORM operates a technology-assisted, workplace-integrated lending program designed to provide short-term liquidity loans to pre-verified employees of accredited companies;</div>
        <div className="moa-cl">WHEREAS, the PARTNER possesses investable capital and desires to participate in the PLATFORM's lending activities as a financial contributor in exchange for an agreed rate of return;</div>
        <div className="moa-cl">WHEREAS, both Parties are legally capacitated to enter into this Agreement and do so freely, voluntarily, and with full understanding of the terms herein;</div>
        <div className="moa-cl">NOW, THEREFORE, for and in consideration of the mutual covenants and stipulations herein contained, and for other good and valuable consideration, the Parties hereby agree as follows:</div>
        <div className="moa-ln"><strong>Legal Basis:</strong> This Agreement is entered into pursuant to and in compliance with the Civil Code of the Philippines (Republic Act No. 386), Republic Act No. 9474 (Lending Company Regulation Act of 2007), and such other applicable laws and regulations of the Republic of the Philippines.</div>

        {/* SECTION 2 */}
        <div className="moa-s2"><span className="moa-sn">Section 2</span> Investment Terms and Conditions</div>
        <div className="moa-cl">The financial terms of this Agreement are as follows:</div>
        <table className="moa-tt">
          <thead><tr><th>Term</th><th>Details</th></tr></thead>
          <tbody>
            <tr><td>Total Investment / Principal Amount</td><td>Philippine Peso (₱) {principal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td></tr>
            <tr><td>Commencement / Transfer Date</td><td>{month} {day}, {year}</td></tr>
            <tr><td>Actual Deployment Date</td><td>{investor.signed_at ? fmtDate(investor.signed_at) : 'As confirmed by Platform in writing'}</td></tr>
            <tr><td>Investment Duration / Cycle</td><td>90 Calendar Days from the Actual Deployment Date</td></tr>
            <tr><td>Partner Tier</td><td>{investor.tier || '________________'}</td></tr>
            <tr><td>Agreed Return Rate</td><td>{(rate * 100).toFixed(1)}% per 90-day cycle</td></tr>
            <tr><td>Expected Gross Return</td><td>Philippine Peso (₱) {grossReturn}</td></tr>
            <tr><td>Expected Total Payout (Principal + Return)</td><td>Philippine Peso (₱) {totalReturn}</td></tr>
            <tr><td>Mode of Return Payment</td><td>As selected by Partner upon payout request (GCash / Bank Transfer / Physical Cash)</td></tr>
          </tbody>
        </table>

        {/* SECTION 3 */}
        <div className="moa-s2"><span className="moa-sn">Section 3</span> Deployment and Capital Management</div>
        <div className="moa-cl">3.1 The PLATFORM shall exclusively utilize the PARTNER's principal for deployment as short-term liquidity loans to pre-verified and accredited employee-borrowers within its partner companies.</div>
        <div className="moa-cl">3.2 The PLATFORM shall employ its proprietary automated system for borrower selection, identity verification, credit scoring, and loan disbursement. Each lending cycle shall consist of approximately one and a half (1.5) lending intervals, equivalent to approximately two (2) monthly loan terms.</div>
        <div className="moa-cl">3.3 The PLATFORM reserves the right to pool the PARTNER's capital with other investors' capital for efficient deployment, provided that individual accounting and return calculations shall be maintained on a per-partner basis.</div>

        {/* SECTION 4 */}
        <div className="moa-s2"><span className="moa-sn">Section 4</span> Accrual Period and Interest Computation</div>
        <div className="moa-cl">4.1 The PARTNER expressly acknowledges and agrees that interest shall <strong>not</strong> commence accruing upon the date of capital transfer. The <strong>Accrual Period</strong> shall officially begin only upon the <strong>Actual Deployment Date</strong> — defined as the date on which the PARTNER's principal has been successfully released and disbursed to a verified borrower.</div>
        <div className="moa-cl">4.2 Capital held in the PLATFORM's Standing Pool pending borrower assignment shall not bear interest. The PLATFORM shall issue electronic notification to the PARTNER within forty-eight (48) hours of successful deployment.</div>
        <div className="moa-cl">4.3 In the event capital remains undeployed for more than fifteen (15) calendar days from the Transfer Date, the Parties shall negotiate in good faith for appropriate arrangements.</div>
        <div className="moa-ln"><strong>Legal Basis (Interest Rate):</strong> Pursuant to Bangko Sentral ng Pilipinas (BSP) Circulars and the Supreme Court ruling in <em>Nacar v. Gallery Frames (G.R. No. 189871, August 13, 2013)</em>, agreed interest rates in private contracts shall be respected provided they are not unconscionable. The Agreed Return Rate stated in Section 2 has been freely stipulated by both Parties.</div>

        {/* SECTION 5 */}
        <div className="moa-s2"><span className="moa-sn">Section 5</span> Operational Spread and Platform Compensation</div>
        <div className="moa-cl">The PLATFORM shall retain, as its operational compensation, any and all interest collected from borrowers in excess of the Agreed Return Rate specified in Section 2. This spread shall cover, among others: platform operations, cloud infrastructure and automation costs, SMS/email notification systems, personnel compensation, default risk pooling, and regulatory compliance expenses.</div>

        {/* SECTION 6 */}
        <div className="moa-s2"><span className="moa-sn">Section 6</span> Risk Disclosure and Default Management</div>
        <div className="moa-rb">
          <div className="moa-rbt">⚠ Important Risk Disclosure</div>
          <p>The PARTNER acknowledges having read, understood, and voluntarily accepted the risk disclosures in this Section. Investment in lending activities involves inherent risks including but not limited to borrower default, delayed repayments, and force majeure events. Past performance of the PLATFORM does not guarantee future results. The Agreed Return Rate is contingent upon the successful collection from borrowers.</p>
        </div>
        <div className="moa-cl">6.1 <strong>Tri-Layer Risk Mitigation:</strong> The PLATFORM shall employ the following measures to protect the PARTNER's principal:</div>
        <div className="moa-ci"><span className="moa-cm">(a)</span>A Security Hold equivalent to ten percent (10%) to twenty percent (20%) of the loan amount, withheld from borrowers upon disbursement as a default buffer;</div>
        <div className="moa-ci"><span className="moa-cm">(b)</span>Minimum credit score requirements of seven hundred fifty (750) or equivalent for all borrowers; and</div>
        <div className="moa-ci"><span className="moa-cm">(c)</span>Verification of employment status and payroll deduction authority prior to any loan release.</div>
        <div className="moa-cl" style={{ marginTop: 14 }}>6.2 In the event of borrower default, the PLATFORM shall, as its primary obligation, utilize pooled operational spreads and security holds to prioritize the restoration of the PARTNER's principal before distributing returns.</div>
        <div className="moa-cl">6.3 The PLATFORM does <strong>not</strong> guarantee returns in cases of: (i) force majeure as defined under Philippine law; (ii) systemic financial crises; or (iii) extraordinary events beyond the PLATFORM's reasonable control.</div>

        {/* SECTION 7 */}
        <div className="moa-s2"><span className="moa-sn">Section 7</span> Representations and Warranties</div>
        <div className="moa-cl">7.1 <strong>The PLATFORM represents and warrants that:</strong></div>
        <div className="moa-ci"><span className="moa-cm">(a)</span>It is duly authorized to operate its lending program in accordance with applicable Philippine laws and regulations;</div>
        <div className="moa-ci"><span className="moa-cm">(b)</span>It has the full legal capacity to enter into this Agreement and perform its obligations hereunder; and</div>
        <div className="moa-ci"><span className="moa-cm">(c)</span>It shall maintain proper books of accounts and make the same available for the PARTNER's inspection upon reasonable written notice.</div>
        <div className="moa-cl" style={{ marginTop: 14 }}>7.2 <strong>The PARTNER represents and warrants that:</strong></div>
        <div className="moa-ci"><span className="moa-cm">(a)</span>The investment capital is lawfully owned and/or acquired, free from any liens, encumbrances, or legal claims;</div>
        <div className="moa-ci"><span className="moa-cm">(b)</span>The PARTNER has the full legal capacity to enter into this Agreement; and</div>
        <div className="moa-ci"><span className="moa-cm">(c)</span>The PARTNER has conducted independent due diligence on the PLATFORM and is not relying solely on representations made verbally outside of this Agreement.</div>

        {/* SECTION 8 */}
        <div className="moa-s2"><span className="moa-sn">Section 8</span> Data Privacy and Confidentiality</div>
        <div className="moa-cl">8.1 This Agreement and all matters relating thereto are strictly private and confidential. The PARTNER agrees not to disclose borrower identities, proprietary platform logic, system architecture, borrower data, or any non-public information of the PLATFORM to any third party without prior written consent.</div>
        <div className="moa-cl">8.2 The PLATFORM shall collect, process, and store the PARTNER's personal information solely for the purpose of administering this Agreement and shall not share such information with third parties except as required by law or regulation.</div>
        <div className="moa-ln"><strong>Legal Basis:</strong> The collection and processing of personal data under this Agreement is governed by <strong>Republic Act No. 10173</strong> (Data Privacy Act of 2012) and its Implementing Rules and Regulations. Both Parties acknowledge their respective obligations as personal information controllers and/or processors under said law.</div>

        {/* SECTION 9 */}
        <div className="moa-s2"><span className="moa-sn">Section 9</span> Term, Renewal, and Termination</div>
        <div className="moa-cl">9.1 This Agreement shall be effective upon signing by both Parties and shall remain in force for the duration of one (1) investment cycle as defined in Section 2, unless earlier terminated or mutually renewed in writing.</div>
        <div className="moa-cl">9.2 Either Party may terminate this Agreement upon thirty (30) days written notice, provided that all obligations incurred prior to such notice shall remain subsisting and enforceable.</div>
        <div className="moa-cl">9.3 Renewal of this Agreement for subsequent cycles shall be subject to mutual written agreement of the Parties and may incorporate amended terms as may be agreed upon.</div>

        {/* SECTION 10 */}
        <div className="moa-s2"><span className="moa-sn">Section 10</span> Dispute Resolution</div>
        <div className="moa-cl">10.1 The Parties agree to settle any dispute, controversy, or claim arising out of or in connection with this Agreement through amicable negotiation within thirty (30) calendar days from written notice of such dispute.</div>
        <div className="moa-cl">10.2 Failing amicable resolution, the Parties agree to submit the dispute to mediation under the auspices of the Philippine Mediation Center before resorting to litigation.</div>
        <div className="moa-cl">10.3 Should mediation fail, the Parties agree to submit the matter to the proper courts of Iloilo City, Philippines, which shall have exclusive jurisdiction over the dispute.</div>

        {/* SECTION 11 */}
        <div className="moa-s2"><span className="moa-sn">Section 11</span> Governing Law</div>
        <div className="moa-cl">This Agreement shall be governed by and construed in accordance with the laws of the Republic of the Philippines, including but not limited to:</div>
        <div className="moa-ci"><span className="moa-cm">(a)</span>Republic Act No. 386 — Civil Code of the Philippines;</div>
        <div className="moa-ci"><span className="moa-cm">(b)</span>Republic Act No. 9474 — Lending Company Regulation Act of 2007;</div>
        <div className="moa-ci"><span className="moa-cm">(c)</span>Republic Act No. 10173 — Data Privacy Act of 2012;</div>
        <div className="moa-ci"><span className="moa-cm">(d)</span>Republic Act No. 8799 — Securities Regulation Code, as applicable; and</div>
        <div className="moa-ci"><span className="moa-cm">(e)</span>Bangko Sentral ng Pilipinas Circulars and regulations as may be applicable.</div>

        {/* SECTION 12 */}
        <div className="moa-s2"><span className="moa-sn">Section 12</span> Miscellaneous Provisions</div>
        <div className="moa-cl">12.1 <strong>Entire Agreement.</strong> This Agreement constitutes the entire understanding between the Parties with respect to its subject matter and supersedes all prior negotiations, representations, and agreements, whether oral or written.</div>
        <div className="moa-cl">12.2 <strong>Amendments.</strong> No amendment, modification, or waiver of any provision of this Agreement shall be valid unless made in writing and duly signed by both Parties.</div>
        <div className="moa-cl">12.3 <strong>Severability.</strong> Should any provision of this Agreement be declared invalid or unenforceable by a court of competent jurisdiction, the remaining provisions shall continue in full force and effect.</div>
        <div className="moa-cl">12.4 <strong>Binding Effect.</strong> This Agreement shall be binding upon the Parties, their respective heirs, executors, administrators, legal representatives, successors, and permitted assigns.</div>
        <div className="moa-cl">12.5 <strong>Non-Assignment.</strong> Neither Party may assign or transfer any rights or obligations under this Agreement without the prior written consent of the other Party.</div>

        {/* ── SIGNATURES ── */}
        <div className="moa-ss">
          <div className="moa-si">IN WITNESS WHEREOF, the Parties have hereunto set their hands on the date and place first above written.</div>

          {/* Row 1: Partner + Admin 1 */}
          <div className="moa-sg">
            {/* Partner */}
            <div className="moa-sb">
              <div className="moa-sp">
                {investor.signature_data
                  ? <img src={investor.signature_data} alt="Partner Signature" style={{ maxHeight: 70, maxWidth: '100%', objectFit: 'contain' }} />
                  : <span className="moa-aw">Awaiting partner signature</span>}
              </div>
              <div className="moa-sn2">{investor.full_name || '________________________________'}</div>
              <div className="moa-sl">Partner / Investor — Signature</div>
              <div className="moa-sd">Date: {fmtDate(investor.signed_at)}</div>
            </div>

            {/* Admin 1 — John Paul Lacaron */}
            <div className="moa-sb">
              <div className="moa-sp">
                {slot1Signed
                  ? <img src={investor.admin_signature_data} alt="Admin Signature 1" style={{ maxHeight: 70, maxWidth: '100%', objectFit: 'contain' }} />
                  : showSlot1Btn
                    ? <button className="moa-btn" onClick={() => onSign(1)}><PenTool size={12} /> Counter-Sign</button>
                    : <span className="moa-aw">Awaiting signature</span>}
              </div>
              <div className="moa-sn2">John Paul Lacaron</div>
              <div className="moa-sl">Authorized Representative — Moneyfest Lending</div>
              <div className="moa-sd">Date: {fmtDate(investor.admin_signed_at)}</div>
            </div>
          </div>

          {/* Row 2: Admin 2 — centered */}
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
            <div className="moa-sb" style={{ width: '45%' }}>
              <div className="moa-sp">
                {slot2Signed
                  ? <img src={investor.admin2_signature_data} alt="Admin Signature 2" style={{ maxHeight: 70, maxWidth: '100%', objectFit: 'contain' }} />
                  : showSlot2Btn
                    ? <button className="moa-btn" onClick={() => onSign(2)}><PenTool size={12} /> Counter-Sign</button>
                    : <span className="moa-aw">{slot1Signed ? 'Awaiting second signature' : 'Pending first signature'}</span>}
              </div>
              <div className="moa-sn2">Charlou June Ramil</div>
              <div className="moa-sl">Authorized Representative — Moneyfest Lending</div>
              <div className="moa-sd">Date: {fmtDate(investor.admin2_signed_at)}</div>
            </div>
          </div>

          {/* Witnesses */}
          <div className="moa-s2" style={{ marginTop: 48 }}><span className="moa-sn">Witnesses</span></div>
          <div className="moa-sg">
            <div className="moa-sb">
              <div className="moa-sp" />
              <div className="moa-sn2">________________________________</div>
              <div className="moa-sl">Witness No. 1 — Full Name & Signature</div>
            </div>
            <div className="moa-sb">
              <div className="moa-sp" />
              <div className="moa-sn2">________________________________</div>
              <div className="moa-sl">Witness No. 2 — Full Name & Signature</div>
            </div>
          </div>
        </div>

        {/* NOTARIZATION */}
        <div className="moa-nb">
          <div className="moa-nt">Acknowledgment / Notarization</div>
          <div className="moa-ntx">
            REPUBLIC OF THE PHILIPPINES)<br />
            ILOILO CITY &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;) S.S.<br />
            CITY OF ILOILO &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;)<br /><br />
            BEFORE ME, a Notary Public for and in the above jurisdiction, personally appeared the following persons with their competent evidence of identity:
          </div>
          <table className="moa-tt" style={{ marginTop: 16 }}>
            <thead><tr><th>Name</th><th>ID Type</th><th>ID Number</th><th>Date / Place of Issue</th></tr></thead>
            <tbody>
              <tr><td>{investor.full_name || '________________________________'}</td><td>________________</td><td>________________</td><td>________________</td></tr>
              <tr><td>John Paul Lacaron</td><td>________________</td><td>________________</td><td>________________</td></tr>
              <tr><td>Charlou June Ramil</td><td>________________</td><td>________________</td><td>________________</td></tr>
            </tbody>
          </table>
          <div className="moa-ntx" style={{ marginTop: 16 }}>known to me and to me known to be the same persons who executed the foregoing instrument, and acknowledged to me that the same is their free and voluntary act and deed, and that of the entities they represent.</div>
          <div className="moa-ntx" style={{ marginTop: 12 }}>This instrument consisting of <strong>one (1) page</strong>, including this page where the acknowledgment is written, has been signed on the left margin of each and every page thereof by the Parties and their witnesses.</div>
          <div className="moa-ntx" style={{ marginTop: 12 }}>WITNESS MY HAND AND SEAL on the date and place first above written.</div>
          <div className="moa-ng">
            <div>
              <div className="moa-nl" />
              <div className="moa-nla">Notary Public</div>
              <div className="moa-nla" style={{ marginTop: 4 }}>PTR No.: ______________ / Until ___________</div>
              <div className="moa-nla">Roll No.: ______________ / IBP No.: ______________</div>
              <div className="moa-nla">MCLE Compliance No.: __________________________</div>
              <div className="moa-nla">Notarial Commission No.: ______________________</div>
            </div>
            <div>
              <div className="moa-nl" />
              <div className="moa-nla">Doc. No.: _____</div>
              <div className="moa-nla">Page No.: _____</div>
              <div className="moa-nla">Book No.: _____</div>
              <div className="moa-nla">Series of 2026</div>
            </div>
          </div>
        </div>

        {/* PAGE FOOTER */}
        <div className="moa-ft">
          <span>Moneyfest Lending · MOA Investment Partnership</span>
          <span>Confidential — For Authorized Parties Only</span>
          <span>Series 2026</span>
        </div>
      </div>

      {/* PRINT BUTTON */}
      <div className="moa-np">
        <button className="moa-pb2" onClick={() => window.print()}>⬇ Print / Save PDF</button>
      </div>
    </div>
  )
}
