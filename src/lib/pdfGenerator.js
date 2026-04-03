import jsPDF from 'jspdf'
import 'jspdf-autotable'
import { formatCurrency } from './helpers'

// ── Shared branding constants ──
const BRAND = {
  primary: [30, 64, 175],        // #1E40AF
  primaryLight: [59, 130, 246],  // #3B82F6
  dark: [11, 15, 26],            // #0B0F1A
  gold: [245, 158, 11],          // #F59E0B
  green: [34, 197, 94],          // #22C55E
  red: [239, 68, 68],            // #EF4444
  text: [15, 23, 42],            // #0F172A
  muted: [100, 116, 139],        // #64748B
  white: [255, 255, 255],
  bg: [248, 250, 255],           // #F8FAFF
}

const TIER_RATES = { Starter: 0.07, Standard: 0.08, Premium: 0.09 }

// ── Helper: Draw branded header ──
function drawHeader(doc, title, subtitle) {
  // Header bar
  doc.setFillColor(...BRAND.primary)
  doc.rect(0, 0, 210, 35, 'F')
  
  // Logo block
  doc.setFillColor(255, 255, 255, 40)
  doc.roundedRect(14, 7, 22, 22, 3, 3, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(...BRAND.white)
  doc.text('M', 25, 21, { align: 'center' })

  // Title
  doc.setFontSize(14)
  doc.text('MONEYFEST LENDING', 42, 15)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text(title, 42, 22)
  doc.setFontSize(7)
  doc.text(subtitle, 42, 27)

  // Date
  doc.setFontSize(8)
  doc.text(
    `Generated: ${new Date().toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}`,
    196, 15, { align: 'right' }
  )
}

// ── Helper: Draw footer ──
function drawFooter(doc, pageNum, totalPages) {
  const y = 285
  doc.setDrawColor(200, 200, 200)
  doc.line(14, y, 196, y)
  doc.setFontSize(7)
  doc.setTextColor(...BRAND.muted)
  doc.text('Moneyfest Lending · Confidential', 14, y + 4)
  doc.text(`Page ${pageNum} of ${totalPages}`, 196, y + 4, { align: 'right' })
}

// ═══════════════════════════════════════════════════════════════
// 1. QUARTERLY REPORT PDF
// ═══════════════════════════════════════════════════════════════
export function generateQuarterlyReport(investor, loans, installments = []) {
  const doc = new jsPDF('p', 'mm', 'a4')
  const rate = TIER_RATES[investor.tier] || 0.08
  const dailyRate = rate / 90
  const totalCapital = Number(investor.total_capital || 0)
  
  const activeLoans = loans.filter(l => ['Active', 'Partially Paid', 'Overdue'].includes(l.status))
  const paidLoans = loans.filter(l => l.status === 'Paid')
  const activeCapital = activeLoans.reduce((s, l) => s + Number(l.loan_amount), 0)
  
  // Calculate accrual
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let overallAccrual = 0
  activeLoans.forEach(l => {
    const deployDate = l.release_date ? new Date(l.release_date) : new Date(l.created_at)
    const daysActive = Math.max(0, Math.floor((todayStart - deployDate) / 86400000))
    overallAccrual += Number(l.loan_amount) * dailyRate * daysActive
  })

  const paidEarnings = paidLoans.reduce((s, l) => s + Number(l.loan_amount) * rate, 0)
  const totalEarnings = paidEarnings + overallAccrual
  const roi = totalCapital > 0 ? ((totalEarnings / totalCapital) * 100).toFixed(2) : '0.00'

  // ── PAGE 1 ──
  drawHeader(doc, 'Quarterly Investment Report', `Prepared for ${investor.full_name} · ${investor.tier} Partner`)

  let y = 44

  // Investor info section
  doc.setFillColor(...BRAND.bg)
  doc.roundedRect(14, y, 182, 24, 3, 3, 'F')
  doc.setFontSize(8)
  doc.setTextColor(...BRAND.muted)
  doc.text('INVESTOR', 20, y + 6)
  doc.text('TIER', 80, y + 6)
  doc.text('ACCESS CODE', 120, y + 6)
  doc.text('REPORT PERIOD', 160, y + 6)
  
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...BRAND.text)
  doc.text(investor.full_name, 20, y + 14)
  doc.setTextColor(...BRAND.gold)
  doc.text(investor.tier, 80, y + 14)
  doc.setTextColor(...BRAND.text)
  doc.text(investor.access_code || '—', 120, y + 14)
  doc.setFontSize(9)
  doc.text(now.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' }), 160, y + 14)

  y += 32

  // ── Key Metrics (4 boxes) ──
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...BRAND.primary)
  doc.text('KEY PERFORMANCE METRICS', 14, y)
  y += 6

  const metrics = [
    { label: 'Total Invested', value: formatCurrency(totalCapital), color: BRAND.primary },
    { label: 'Funds Deployed', value: formatCurrency(activeCapital), color: BRAND.gold },
    { label: 'Total Earnings', value: formatCurrency(totalEarnings), color: BRAND.green },
    { label: 'ROI', value: `${roi}%`, color: BRAND.green },
  ]
  
  const boxW = 42
  metrics.forEach((m, i) => {
    const x = 14 + i * (boxW + 4)
    doc.setFillColor(250, 250, 255)
    doc.setDrawColor(220, 225, 240)
    doc.roundedRect(x, y, boxW, 22, 2, 2, 'FD')
    doc.setFontSize(7)
    doc.setTextColor(...BRAND.muted)
    doc.text(m.label.toUpperCase(), x + 4, y + 7)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...m.color)
    doc.text(m.value, x + 4, y + 17)
    doc.setFont('helvetica', 'normal')
  })

  y += 30

  // ── Accrual Summary ──
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...BRAND.primary)
  doc.text('ACCRUAL SUMMARY', 14, y)
  y += 4

  doc.autoTable({
    startY: y,
    head: [['Metric', 'Value']],
    body: [
      ['Daily Rate', `${(dailyRate * 100).toFixed(4)}%`],
      ['Active Capital', formatCurrency(activeCapital)],
      ['Daily Interest', formatCurrency(activeCapital * dailyRate)],
      ['Overall Accrued Interest', formatCurrency(overallAccrual)],
      ['Interest from Paid Loans', formatCurrency(paidEarnings)],
      ['Total Lifetime Earnings', formatCurrency(totalEarnings)],
    ],
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: BRAND.primary, textColor: BRAND.white, fontStyle: 'bold', fontSize: 7 },
    alternateRowStyles: { fillColor: [248, 250, 255] },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 }, 1: { halign: 'right' } },
    margin: { left: 14, right: 14 },
  })

  y = doc.lastAutoTable.finalY + 10

  // ── Loan Portfolio ──
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...BRAND.primary)
  doc.text('LOAN PORTFOLIO BREAKDOWN', 14, y)
  y += 4

  const loanRows = loans.map(l => {
    const deployDate = l.release_date ? new Date(l.release_date) : new Date(l.created_at)
    const daysActive = Math.max(0, Math.floor((todayStart - deployDate) / 86400000))
    const accrued = Number(l.loan_amount) * dailyRate * daysActive
    return [
      l.borrowers?.full_name || '—',
      formatCurrency(l.loan_amount),
      deployDate.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }),
      `${daysActive}d`,
      formatCurrency(accrued),
      l.status,
      `${l.payments_made || 0}/${l.num_installments || 4}`,
    ]
  })

  doc.autoTable({
    startY: y,
    head: [['Borrower', 'Amount', 'Released', 'Days', 'Accrued', 'Status', 'Payments']],
    body: loanRows,
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 2.5 },
    headStyles: { fillColor: BRAND.primary, textColor: BRAND.white, fontStyle: 'bold', fontSize: 6.5 },
    alternateRowStyles: { fillColor: [248, 250, 255] },
    columnStyles: {
      0: { cellWidth: 36 },
      1: { halign: 'right', cellWidth: 22 },
      4: { halign: 'right', cellWidth: 22, textColor: BRAND.green },
      5: { cellWidth: 20 },
    },
    margin: { left: 14, right: 14 },
  })

  y = doc.lastAutoTable.finalY + 10

  // ── Transaction History ──
  if (y > 230) {
    drawFooter(doc, 1, 2)
    doc.addPage()
    drawHeader(doc, 'Quarterly Investment Report', `${investor.full_name} · Transaction History`)
    y = 44
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...BRAND.primary)
  doc.text('TRANSACTION HISTORY', 14, y)
  y += 4

  // Build events
  const events = []
  loans.forEach(loan => {
    const bName = loan.borrowers?.full_name || 'Unknown'
    events.push({ date: loan.release_date || loan.created_at, type: 'Deployed', borrower: bName, amount: -Number(loan.loan_amount) })
    const loanInst = installments.filter(inst => inst.loan_id === loan.id && inst.is_paid)
    loanInst.forEach(inst => {
      events.push({ date: inst.paid_at || inst.due_date, type: 'Payment', borrower: bName, amount: Number(inst.amount_due) })
    })
    if (loanInst.length === 0 && (loan.payments_made || 0) > 0) {
      for (let p = 1; p <= loan.payments_made; p++) {
        events.push({ date: loan.updated_at, type: 'Payment', borrower: bName, amount: Number(loan.installment_amount || 0) })
      }
    }
    if (loan.status === 'Paid') {
      events.push({ date: loan.updated_at, type: 'Completed', borrower: bName, amount: 0 })
    }
  })
  events.sort((a, b) => new Date(a.date) - new Date(b.date))

  let balance = totalCapital
  const txRows = events.map(e => {
    balance += e.amount
    return [
      new Date(e.date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }),
      e.type,
      e.borrower,
      e.amount >= 0 ? `+${formatCurrency(Math.abs(e.amount))}` : `-${formatCurrency(Math.abs(e.amount))}`,
      formatCurrency(balance),
    ]
  })

  if (txRows.length > 0) {
    doc.autoTable({
      startY: y,
      head: [['Date', 'Event', 'Borrower', 'Amount', 'Balance']],
      body: txRows,
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 2.5 },
      headStyles: { fillColor: BRAND.primary, textColor: BRAND.white, fontStyle: 'bold', fontSize: 6.5 },
      alternateRowStyles: { fillColor: [248, 250, 255] },
      columnStyles: {
        3: { halign: 'right' },
        4: { halign: 'right', fontStyle: 'bold' },
      },
      margin: { left: 14, right: 14 },
    })
  }

  // Footer
  const totalPages = doc.internal.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    drawFooter(doc, i, totalPages)
  }

  // Disclaimer on last page
  doc.setPage(totalPages)
  const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 10 : 200
  doc.setFontSize(6.5)
  doc.setTextColor(...BRAND.muted)
  doc.text(
    'DISCLAIMER: This report is generated automatically by Moneyfest Lending for informational purposes only. Past performance does not guarantee future results.',
    14, Math.min(finalY, 275), { maxWidth: 182 }
  )

  doc.save(`Moneyfest_Report_${investor.full_name.replace(/\s/g, '_')}_${now.toISOString().slice(0, 10)}.pdf`)
}


// ═══════════════════════════════════════════════════════════════
// 2. MOA PDF
// ═══════════════════════════════════════════════════════════════
export function generateMoaPDF(investor) {
  const doc = new jsPDF('p', 'mm', 'a4')
  const rate = TIER_RATES[investor.tier] || 0
  const principal = Number(investor.total_capital || 0)
  const grossReturn = (principal * rate).toFixed(2)
  const totalReturn = (principal * (1 + rate)).toFixed(2)

  const signDate = investor.signed_at ? new Date(investor.signed_at) : new Date()
  const day = signDate.getDate()
  const month = signDate.toLocaleString('default', { month: 'long' })
  const year = signDate.getFullYear()
  const fmtCurrency = (v) => `Philippine Peso (₱) ${Number(v).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' }) : '________________'

  // ── Decorative border ──
  doc.setDrawColor(200, 185, 154)
  doc.setLineWidth(0.3)
  doc.rect(10, 10, 190, 277)

  let y = 28

  // ── Header ──
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(138, 117, 96)
  doc.text('MONEYFEST LENDING · REPUBLIC OF THE PHILIPPINES', 105, y, { align: 'center' })
  y += 10
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(26, 26, 26)
  doc.text('MEMORANDUM OF AGREEMENT', 105, y, { align: 'center' })
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(138, 117, 96)
  doc.text('Investment Partnership Agreement', 105, y, { align: 'center' })
  y += 4
  doc.setDrawColor(26, 26, 26)
  doc.setLineWidth(0.5)
  doc.line(75, y, 135, y)

  // ── Meta Info ──
  y += 8
  doc.setFontSize(7)
  doc.setTextColor(150, 150, 150)
  doc.text(`Document No.: ML-MOA-${investor.access_code || '______'}`, 20, y)
  doc.text('Series of 2026', 105, y, { align: 'center' })
  doc.text('Page 1', 190, y, { align: 'right' })

  // ── Preamble ──
  y += 10
  doc.setFontSize(10)
  doc.setTextColor(...BRAND.text)
  doc.setFont('helvetica', 'normal')
  const preamble = `This Memorandum of Agreement (hereinafter referred to as the "Agreement") is entered into this ${day} day of ${month}, ${year}, in the City of Iloilo, Republic of the Philippines, by and between:`
  const pLines = doc.splitTextToSize(preamble, 170)
  doc.text(pLines, 20, y)
  y += pLines.length * 5 + 4

  // ── Witnesseth ──
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(100, 100, 100)
  doc.text('— WITNESSETH —', 105, y, { align: 'center' })
  y += 8

  // ── Party blocks ──
  // Platform
  doc.setFillColor(250, 249, 246)
  doc.setDrawColor(200, 185, 154)
  doc.roundedRect(20, y, 170, 18, 1, 1, 'FD')
  doc.setFontSize(7)
  doc.setTextColor(138, 117, 96)
  doc.text('FIRST PARTY — THE PLATFORM', 24, y + 5)
  doc.setFontSize(8.5)
  doc.setTextColor(...BRAND.text)
  const platformText = 'MONEYFEST LENDING, a workplace-integrated lending program, represented by JOHN PAUL LACARON and CHARLOU JUNE RAMIL, hereinafter the "PLATFORM".'
  const pltLines = doc.splitTextToSize(platformText, 162)
  doc.text(pltLines, 24, y + 10)
  y += 22

  doc.setFontSize(8)
  doc.setTextColor(170, 170, 170)
  doc.text('— AND —', 105, y, { align: 'center' })
  y += 5

  // Partner
  doc.setFillColor(250, 249, 246)
  doc.roundedRect(20, y, 170, 18, 1, 1, 'FD')
  doc.setFontSize(7)
  doc.setTextColor(138, 117, 96)
  doc.text('SECOND PARTY — THE PARTNER / INVESTOR', 24, y + 5)
  doc.setFontSize(8.5)
  doc.setTextColor(...BRAND.text)
  const partnerText = `${(investor.full_name || '________________').toUpperCase()}, of legal age, Filipino citizen, with address at ${investor.address || '_____________________________'}, hereinafter the "PARTNER".`
  const prtLines = doc.splitTextToSize(partnerText, 162)
  doc.text(prtLines, 24, y + 10)
  y += 24

  // ── Section 2: Investment Terms Table ──
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(138, 117, 96)
  doc.text('SECTION 2 · INVESTMENT TERMS AND CONDITIONS', 20, y)
  y += 4

  doc.autoTable({
    startY: y,
    head: [['Term', 'Details']],
    body: [
      ['Total Investment / Principal', fmtCurrency(principal)],
      ['Commencement Date', `${month} ${day}, ${year}`],
      ['Deployment Date', investor.signed_at ? fmtDate(investor.signed_at) : 'As confirmed by Platform'],
      ['Investment Duration', '90 Calendar Days'],
      ['Partner Tier', investor.tier || '—'],
      ['Agreed Return Rate', `${(rate * 100).toFixed(1)}% per 90-day cycle`],
      ['Expected Gross Return', fmtCurrency(grossReturn)],
      ['Total Payout (Principal + Return)', fmtCurrency(totalReturn)],
      ['Mode of Return', 'GCash / Bank Transfer / Physical Cash'],
    ],
    theme: 'grid',
    styles: { fontSize: 7.5, cellPadding: 3, textColor: BRAND.text },
    headStyles: { fillColor: [26, 26, 26], textColor: BRAND.white, fontStyle: 'bold', fontSize: 7 },
    alternateRowStyles: { fillColor: [250, 249, 246] },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 55 } },
    margin: { left: 20, right: 20 },
  })

  y = doc.lastAutoTable.finalY + 8

  // ── Key Sections Summary ──
  const sections = [
    ['Section 3', 'Deployment: Capital used exclusively for short-term liquidity loans to pre-verified employees.'],
    ['Section 4', 'Accrual: Interest starts only on Actual Deployment Date, not transfer date.'],
    ['Section 5', 'Spread: Platform retains interest above the Agreed Return Rate as operational compensation.'],
    ['Section 6', 'Risk: Investment involves inherent risks. Tri-layer mitigation (Security Hold, credit score, employment verification).'],
    ['Section 9', 'Term: Effective upon signing for one 90-day cycle. 30-day written notice for termination.'],
    ['Section 10', 'Disputes: Amicable negotiation → Mediation → Courts of Iloilo City.'],
    ['Section 11', 'Governing Law: Civil Code (RA 386), Lending Company Act (RA 9474), Data Privacy Act (RA 10173).'],
  ]

  // Check if we need a new page
  if (y + sections.length * 7 > 270) {
    doc.addPage()
    doc.setDrawColor(200, 185, 154)
    doc.setLineWidth(0.3)
    doc.rect(10, 10, 190, 277)
    y = 22
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(138, 117, 96)
  doc.text('KEY PROVISIONS SUMMARY', 20, y)
  y += 5

  sections.forEach(([sec, text]) => {
    if (y > 270) {
      doc.addPage()
      doc.setDrawColor(200, 185, 154)
      doc.setLineWidth(0.3)
      doc.rect(10, 10, 190, 277)
      y = 22
    }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(138, 117, 96)
    doc.text(sec, 20, y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...BRAND.text)
    const lines = doc.splitTextToSize(text, 146)
    doc.text(lines, 44, y)
    y += lines.length * 4 + 3
  })

  // ── Signatures ──
  y += 6
  if (y > 230) {
    doc.addPage()
    doc.setDrawColor(200, 185, 154)
    doc.setLineWidth(0.3)
    doc.rect(10, 10, 190, 277)
    y = 22
  }

  doc.setFont('helvetica', 'italic')
  doc.setFontSize(9)
  doc.setTextColor(80, 80, 80)
  doc.text('IN WITNESS WHEREOF, the Parties have hereunto set their hands.', 105, y, { align: 'center' })
  y += 10

  // Partner signature
  doc.setDrawColor(26, 26, 26)
  if (investor.signature_data) {
    try {
      doc.addImage(investor.signature_data, 'PNG', 25, y, 60, 20)
    } catch (e) { /* signature might not be loadable */ }
  }
  doc.line(20, y + 22, 90, y + 22)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(26, 26, 26)
  doc.text(investor.full_name || '________________________________', 55, y + 27, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(150, 150, 150)
  doc.text('Partner / Investor — Signature', 55, y + 31, { align: 'center' })
  doc.text(`Date: ${fmtDate(investor.signed_at)}`, 55, y + 35, { align: 'center' })

  // Admin 1 signature
  if (investor.admin_signature_data) {
    try {
      doc.addImage(investor.admin_signature_data, 'PNG', 125, y, 60, 20)
    } catch (e) { /* */ }
  }
  doc.line(120, y + 22, 190, y + 22)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(26, 26, 26)
  doc.text('John Paul Lacaron', 155, y + 27, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(150, 150, 150)
  doc.text('Authorized Representative', 155, y + 31, { align: 'center' })
  doc.text(`Date: ${fmtDate(investor.admin_signed_at)}`, 155, y + 35, { align: 'center' })

  y += 42

  // Admin 2 signature (centered)
  if (investor.admin2_signature_data) {
    try {
      doc.addImage(investor.admin2_signature_data, 'PNG', 75, y, 60, 20)
    } catch (e) { /* */ }
  }
  doc.line(70, y + 22, 140, y + 22)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(26, 26, 26)
  doc.text('Charlou June Ramil', 105, y + 27, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(150, 150, 150)
  doc.text('Authorized Representative', 105, y + 31, { align: 'center' })
  doc.text(`Date: ${fmtDate(investor.admin2_signed_at)}`, 105, y + 35, { align: 'center' })

  // Footer on all pages
  const totalPages = doc.internal.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    const fy = 285
    doc.setDrawColor(232, 228, 220)
    doc.line(20, fy, 190, fy)
    doc.setFontSize(6.5)
    doc.setTextColor(187, 187, 187)
    doc.text('Moneyfest Lending · MOA Investment Partnership', 20, fy + 3.5)
    doc.text('Confidential — For Authorized Parties Only', 105, fy + 3.5, { align: 'center' })
    doc.text(`Series 2026 · Page ${i} of ${totalPages}`, 190, fy + 3.5, { align: 'right' })
  }

  doc.save(`Moneyfest_MOA_${investor.full_name.replace(/\s/g, '_')}.pdf`)
}
