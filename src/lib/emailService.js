// ── MoneyfestLending Email Service ──────────────────────────────────────
// All emails are sent via Supabase Edge Function → Privateemail SMTP
// --- Admin Notifications ---

export async function sendLoanAgreementSignedAdminEmail({ borrowerName, loanAmount, loanType, accessCode }) {
  const isQuickLoan = loanType?.toLowerCase() === 'quickloan'
  const subject = `✍️ Loan Agreement Signed: ${borrowerName}`
  
  const html = `
    <div style="font-family:sans-serif;background:#0B0F1A;padding:32px;border-radius:16px;color:#F0F4FF;max-width:600px;margin:0 auto;">
      <div style="background:linear-gradient(135deg,#141B2D,#1a1040);border-radius:16px;padding:24px;margin-bottom:20px;border:1px solid rgba(139,92,246,0.3);text-align:center;">
        <div style="font-size:24px;font-weight:900;margin-bottom:4px;">Moneyfest<span style="color:#8B5CF6;">Lending</span></div>
        <div style="font-size:12px;color:#4B5580;text-transform:uppercase;letter-spacing:0.1em;">Admin Notification</div>
      </div>

      <div style="background:#141B2D;border-radius:16px;padding:28px;margin-bottom:16px;border:1px solid rgba(255,255,255,0.05);">
        <h2 style="margin:0 0 16px;font-size:18px;color:#F0F4FF;text-align:center;">Agreement Signed! ✍️</h2>
        <p style="color:#8892B0;font-size:14px;line-height:1.7;margin:0;text-align:center;">
          Borrower <strong>${borrowerName}</strong> has just signed their Loan Agreement in the portal.
        </p>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
        <div style="background:rgba(255,255,255,0.03);padding:16px;border-radius:12px;border:1px solid rgba(255,255,255,0.05);text-align:center;">
          <div style="font-size:11px;color:#4B5580;text-transform:uppercase;margin-bottom:4px;">Loan Type</div>
          <div style="font-size:16px;font-weight:700;color:${isQuickLoan ? '#F59E0B' : '#60A5FA'};">${isQuickLoan ? '⚡ QuickLoan' : '📅 Installment'}</div>
        </div>
        <div style="background:rgba(255,255,255,0.03);padding:16px;border-radius:12px;border:1px solid rgba(255,255,255,0.05);text-align:center;">
          <div style="font-size:11px;color:#4B5580;text-transform:uppercase;margin-bottom:4px;">Amount</div>
          <div style="font-size:16px;font-weight:700;color:#22C55E;">₱${Number(loanAmount).toLocaleString()}</div>
        </div>
      </div>

      <div style="background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.2);border-radius:16px;padding:20px;text-align:center;margin-bottom:24px;">
        <div style="font-size:11px;color:#4B5580;text-transform:uppercase;margin-bottom:6px;">Borrower Access Code</div>
        <div style="font-size:20px;font-weight:800;color:#F0F4FF;letter-spacing:0.1em;">${accessCode}</div>
      </div>

      <a href="https://moneyfestlending.loan/admin/loans" style="display:block;background:linear-gradient(135deg,#6366F1,#8B5CF6);color:#fff;text-decoration:none;padding:14px;border-radius:12px;text-align:center;font-weight:700;font-size:14px;">View Loan in Admin Dashboard →</a>

      <div style="text-align:center;margin-top:24px;border-top:1px solid rgba(255,255,255,0.05);padding-top:16px;">
        <div style="font-size:11px;color:#4B5580;">This is an automated system notification.</div>
      </div>
    </div>
  `

  return sendEmail({
    to: 'administrator@moneyfestlending.loan',
    subject,
    html
  })
}

export async function sendPayoutRequestedAdminEmail({ investorName, amount, tier }) {
  const subject = `💸 Payout Requested: ${investorName}`
  
  const html = `
    <div style="font-family:sans-serif;background:#0B0F1A;padding:32px;border-radius:16px;color:#F0F4FF;max-width:600px;margin:0 auto;">
      <div style="background:linear-gradient(135deg,#141B2D,#1a1040);border-radius:16px;padding:24px;margin-bottom:20px;border:1px solid rgba(245,158,11,0.3);text-align:center;">
        <div style="font-size:24px;font-weight:900;margin-bottom:4px;">Moneyfest<span style="color:#8B5CF6;">Lending</span></div>
        <div style="font-size:12px;color:#4B5580;text-transform:uppercase;letter-spacing:0.1em;">Admin Notification</div>
      </div>

      <div style="background:#141B2D;border-radius:16px;padding:28px;margin-bottom:16px;border:1px solid rgba(255,255,255,0.05);">
        <h2 style="margin:0 0 16px;font-size:18px;color:#F0F4FF;text-align:center;">Payout Requested! 💸</h2>
        <p style="color:#8892B0;font-size:14px;line-height:1.7;margin:0;text-align:center;">
          Investment Partner <strong>${investorName}</strong> has requested a capital payout.
        </p>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
        <div style="background:rgba(255,255,255,0.03);padding:16px;border-radius:12px;border:1px solid rgba(255,255,255,0.05);text-align:center;">
          <div style="font-size:11px;color:#4B5580;text-transform:uppercase;margin-bottom:4px;">Partner Tier</div>
          <div style="font-size:16px;font-weight:700;color:#F59E0B;">${tier}</div>
        </div>
        <div style="background:rgba(255,255,255,0.03);padding:16px;border-radius:12px;border:1px solid rgba(255,255,255,0.05);text-align:center;">
          <div style="font-size:11px;color:#4B5580;text-transform:uppercase;margin-bottom:4px;">Requested Payout</div>
          <div style="font-size:16px;font-weight:700;color:#22C55E;">₱${Number(amount).toLocaleString()}</div>
        </div>
      </div>

      <a href="https://moneyfestlending.loan/admin/approvals" style="display:block;background:linear-gradient(135deg,#6366F1,#8B5CF6);color:#fff;text-decoration:none;padding:14px;border-radius:12px;text-align:center;font-weight:700;font-size:14px;">Review in Admin Dashboard →</a>

      <div style="text-align:center;margin-top:24px;border-top:1px solid rgba(255,255,255,0.05);padding-top:16px;">
        <div style="font-size:11px;color:#4B5580;">This is an automated system notification.</div>
      </div>
    </div>
  `

  return sendEmail({
    to: 'administrator@moneyfestlending.loan',
    subject,
    html
  })
}

export async function sendMoaSignedAdminEmail({ investorName, tier, accessCode }) {
  const subject = `✍️ MOA Signed: ${investorName}`
  
  const html = `
    <div style="font-family:sans-serif;background:#0B0F1A;padding:32px;border-radius:16px;color:#F0F4FF;max-width:600px;margin:0 auto;">
      <div style="background:linear-gradient(135deg,#141B2D,#1a1040);border-radius:16px;padding:24px;margin-bottom:20px;border:1px solid rgba(139,92,246,0.3);text-align:center;">
        <div style="font-size:24px;font-weight:900;margin-bottom:4px;">Moneyfest<span style="color:#8B5CF6;">Lending</span></div>
        <div style="font-size:12px;color:#4B5580;text-transform:uppercase;letter-spacing:0.1em;">Admin Notification</div>
      </div>

      <div style="background:#141B2D;border-radius:16px;padding:28px;margin-bottom:16px;border:1px solid rgba(255,255,255,0.05);">
        <h2 style="margin:0 0 16px;font-size:18px;color:#F0F4FF;text-align:center;">Memorandum Signed! ✍️</h2>
        <p style="color:#8892B0;font-size:14px;line-height:1.7;margin:0;text-align:center;">
          Investment Partner <strong>${investorName}</strong> has just signed their digital MOA. It is now awaiting your counter-signature.
        </p>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
        <div style="background:rgba(255,255,255,0.03);padding:16px;border-radius:12px;border:1px solid rgba(255,255,255,0.05);text-align:center;">
          <div style="font-size:11px;color:#4B5580;text-transform:uppercase;margin-bottom:4px;">Partner Tier</div>
          <div style="font-size:16px;font-weight:700;color:#F59E0B;">${tier}</div>
        </div>
        <div style="background:rgba(255,255,255,0.03);padding:16px;border-radius:12px;border:1px solid rgba(255,255,255,0.05);text-align:center;">
          <div style="font-size:11px;color:#4B5580;text-transform:uppercase;margin-bottom:4px;">Access Code</div>
          <div style="font-size:16px;font-weight:700;color:#60A5FA;">${accessCode}</div>
        </div>
      </div>

      <a href="https://moneyfestlending.loan/admin/approvals" style="display:block;background:linear-gradient(135deg,#6366F1,#8B5CF6);color:#fff;text-decoration:none;padding:14px;border-radius:12px;text-align:center;font-weight:700;font-size:14px;">Review & Counter-Sign MOA →</a>

      <div style="text-align:center;margin-top:24px;border-top:1px solid rgba(255,255,255,0.05);padding-top:16px;">
        <div style="font-size:11px;color:#4B5580;">This is an automated system notification.</div>
      </div>
    </div>
  `

  return sendEmail({
    to: 'administrator@moneyfestlending.loan',
    subject,
    html
  })
}

export async function sendApplicationReceivedAdminEmail({ borrowerName, loanAmount, accessCode, loanType = 'Installment Loan' }) {
  const subject = `📥 New Application: ${borrowerName}`
  
  const html = `
    <div style="font-family:sans-serif;background:#0B0F1A;padding:32px;border-radius:16px;color:#F0F4FF;max-width:600px;margin:0 auto;">
      <div style="background:linear-gradient(135deg,#141B2D,#1a1040);border-radius:16px;padding:24px;margin-bottom:20px;border:1px solid rgba(59,130,246,0.3);text-align:center;">
        <div style="font-size:24px;font-weight:900;margin-bottom:4px;">Moneyfest<span style="color:#8B5CF6;">Lending</span></div>
        <div style="font-size:12px;color:#4B5580;text-transform:uppercase;letter-spacing:0.1em;">Admin Notification</div>
      </div>

      <div style="background:#141B2D;border-radius:16px;padding:28px;margin-bottom:16px;border:1px solid rgba(255,255,255,0.05);">
        <h2 style="margin:0 0 16px;font-size:18px;color:#F0F4FF;text-align:center;">New Application Received! 📥</h2>
        <p style="color:#8892B0;font-size:14px;line-height:1.7;margin:0;text-align:center;">
          Borrower <strong>${borrowerName}</strong> has submitted a new loan application for review.
        </p>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
        <div style="background:rgba(255,255,255,0.03);padding:16px;border-radius:12px;border:1px solid rgba(255,255,255,0.05);text-align:center;">
          <div style="font-size:11px;color:#4B5580;text-transform:uppercase;margin-bottom:4px;">Loan Type</div>
          <div style="font-size:16px;font-weight:700;color:#60A5FA;">${loanType}</div>
        </div>
        <div style="background:rgba(255,255,255,0.03);padding:16px;border-radius:12px;border:1px solid rgba(255,255,255,0.05);text-align:center;">
          <div style="font-size:11px;color:#4B5580;text-transform:uppercase;margin-bottom:4px;">Requested Amount</div>
          <div style="font-size:16px;font-weight:700;color:#22C55E;">₱${Number(loanAmount).toLocaleString()}</div>
        </div>
      </div>

      <div style="background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.2);border-radius:16px;padding:20px;text-align:center;margin-bottom:24px;">
        <div style="font-size:11px;color:#4B5580;text-transform:uppercase;margin-bottom:6px;">Internal Access Code</div>
        <div style="font-size:20px;font-weight:800;color:#F0F4FF;letter-spacing:0.1em;">${accessCode}</div>
      </div>

      <a href="https://moneyfestlending.loan/admin/applications" style="display:block;background:linear-gradient(135deg,#6366F1,#8B5CF6);color:#fff;text-decoration:none;padding:14px;border-radius:12px;text-align:center;font-weight:700;font-size:14px;">Review Application →</a>

      <div style="text-align:center;margin-top:24px;border-top:1px solid rgba(255,255,255,0.05);padding-top:16px;">
        <div style="font-size:11px;color:#4B5580;">This is an automated system notification.</div>
      </div>
    </div>
  `

  return sendEmail({
    to: 'administrator@moneyfestlending.loan',
    subject,
    html
  })
}

// --- Reminders ---

// ────────────────────────────────────────────────────────────────────────

const SUPABASE_URL = 'https://swwedyfgbqhtavxmbmhv.supabase.co'
const PORTAL_URL = process.env.REACT_APP_PORTAL_URL || 'https://moneyfestlending.loan/portal'
const FROM_NAME = 'Moneyfest Lending'

// ── Core sender ──────────────────────────────────────────────────────────
async function sendEmail({ to, subject, html }) {
  if (!to || !to.includes('@')) return { success: false, error: 'Invalid email address' }
  try {
    const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY
    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({ to, subject, html })
    })
    const data = await res.json()
    if (!res.ok) return { success: false, error: data.error || data.message || 'Send failed' }
    return { success: true, messageId: data.messageId }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

// ── Shared email chrome ──────────────────────────────────────────────────
function emailShell({ accentColor = '#3B82F6', badgeText = '', badgeEmoji = '', headerBorder = 'rgba(59,130,246,0.3)', body }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>MoneyfestLending</title>
</head>
<body style="margin:0;padding:0;background:#0B0F1A;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0B0F1A;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;" cellpadding="0" cellspacing="0">

        <!-- HEADER -->
        <tr><td style="background:linear-gradient(135deg,#0d1226 0%,#141B2D 60%,#1a1040 100%);border-radius:16px 16px 0 0;padding:32px 36px;border-bottom:1px solid ${headerBorder};">
          <table width="100%" cellpadding="0" cellspacing="0"><tr>
            <td>
              <div style="display:inline-block;width:42px;height:42px;background:linear-gradient(135deg,#3B82F6,#8B5CF6);border-radius:10px;text-align:center;line-height:42px;font-size:20px;margin-bottom:12px;">💼</div>
              <div style="font-size:26px;font-weight:900;color:#F0F4FF;letter-spacing:-1px;margin-bottom:2px;">
                Moneyfest<span style="background:linear-gradient(90deg,#60a5fa,#a78bfa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;"> Lending</span>
              </div>
              <div style="font-size:12px;color:#4B5580;letter-spacing:0.08em;text-transform:uppercase;">Workplace Lending Program</div>
            </td>
            ${badgeText ? `<td align="right" valign="top">
              <div style="background:${accentColor}20;border:1px solid ${accentColor}60;border-radius:20px;padding:6px 14px;display:inline-block;">
                <span style="font-size:11px;font-weight:800;color:${accentColor};letter-spacing:0.08em;">${badgeEmoji} ${badgeText}</span>
              </div>
            </td>` : ''}
          </tr></table>
        </td></tr>

        <!-- BODY -->
        ${body}

        <!-- FOOTER -->
        <tr><td style="background:#0d1226;border-top:1px solid #1E2640;border-radius:0 0 16px 16px;padding:24px 36px;text-align:center;">
          <p style="font-size:13px;color:#CBD5F0;margin:0 0 4px;font-weight:600;">Moneyfest Lending Workplace Lending Program</p>
          <p style="font-size:11px;color:#4B5580;margin:0;">This is an automated notification. Please do not reply to this email.</p>
          <div style="width:40px;height:2px;background:linear-gradient(90deg,#3B82F6,#8B5CF6);margin:12px auto 0;border-radius:2px;"></div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function infoTable(rows) {
  return `
  <div style="background:#0B0F1A;border:1px solid #1E2640;border-radius:12px;overflow:hidden;">
    <table width="100%" cellpadding="0" cellspacing="0">
      ${rows.map((r, i) => `
      <tr>
        <td style="font-size:13px;color:#4B5580;padding:10px 20px;${i < rows.length - 1 ? 'border-bottom:1px solid #1E2640;' : ''}">${r.label}</td>
        <td align="right" style="font-size:13px;font-weight:700;color:${r.color || '#F0F4FF'};padding:10px 20px;${i < rows.length - 1 ? 'border-bottom:1px solid #1E2640;' : ''}">${r.value}</td>
      </tr>`).join('')}
    </table>
  </div>`
}

function accessCodeBlock(accessCode, portalUrl, btnLabel = 'View My Loan Portal →') {
  return `
  <div style="background:linear-gradient(135deg,#0f1729,#1a1040);border:2px solid rgba(139,92,246,0.4);border-radius:14px;padding:24px;text-align:center;">
    <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.1em;color:#4B5580;margin-bottom:10px;">Your Portal Access Code</div>
    <div style="font-size:36px;font-weight:900;letter-spacing:8px;color:#F0F4FF;font-family:monospace;margin-bottom:10px;">${accessCode}</div>
    <div style="font-size:12px;color:#4B5580;margin-bottom:16px;">Use this code to access your borrower portal</div>
    <a href="${portalUrl}" style="display:inline-block;background:linear-gradient(135deg,#3B82F6,#8B5CF6);color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-size:14px;font-weight:700;">${btnLabel}</a>
  </div>`
}

function banner(emoji, color, title, subtitle) {
  return `
  <div style="background:${color}15;border:1px solid ${color}40;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px;">
    <div style="font-size:36px;margin-bottom:8px;">${emoji}</div>
    <div style="font-size:20px;font-weight:900;color:${color};margin-bottom:4px;">${title}</div>
    <div style="font-size:14px;color:#8892B0;">${subtitle}</div>
  </div>`
}

function note(text) {
  return `
  <div style="background:rgba(59,130,246,0.07);border-left:3px solid #3B82F6;border-radius:0 8px 8px 0;padding:14px 16px;">
    <p style="font-size:13px;color:#8892B0;margin:0;line-height:1.8;">${text}</p>
  </div>`
}

// ════════════════════════════════════════════════════════════════════════
// 1. APPLICATION RECEIVED
// ════════════════════════════════════════════════════════════════════════
export async function sendApplicationReceivedEmail({ to, borrowerName, accessCode, loanAmount, loanType = 'Installment Loan' }) {
  const html = emailShell({
    accentColor: '#F59E0B',
    badgeText: 'Under Review',
    badgeEmoji: '📋',
    headerBorder: 'rgba(245,158,11,0.3)',
    body: `
      <tr><td style="background:#141B2D;padding:28px 36px 0;">
        ${banner('📋', '#F59E0B', 'Application Received!',
          `Hi <strong style="color:#F0F4FF;">${borrowerName}</strong>, your application for <strong style="color:#F0F4FF;">₱${Number(loanAmount).toLocaleString()}</strong> (${loanType}) is now under review.`)}
      </td></tr>
      <tr><td style="background:#141B2D;padding:0 36px 24px;">
        ${infoTable([
          { label: 'Applicant', value: borrowerName },
          { label: 'Loan Type', value: loanType },
          { label: 'Amount Requested', value: `₱${Number(loanAmount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`, color: '#F59E0B' },
          { label: 'Status', value: '⏳ Pending Review', color: '#F59E0B' },
        ])}
      </td></tr>
      <tr><td style="background:#141B2D;padding:0 36px 24px;">
        ${accessCodeBlock(accessCode, PORTAL_URL, 'Track My Application →')}
      </td></tr>
      <tr><td style="background:#141B2D;padding:0 36px 28px;">
        ${note(`<strong style="color:#CBD5F0;">What happens next?</strong><br/>
        1. Our admin team will review your application<br/>
        2. You'll receive an email once a decision is made<br/>
        3. Track your status anytime using your access code at the portal<br/>
        4. For follow-ups, visit our <a href="https://moneyfestlending.loan/contact" style="color:#60A5FA;">Contact Us</a> page`)}
      </td></tr>`
  })
  return sendEmail({ to, subject: `📋 Application Received — Your access code is ${accessCode}`, html })
}

// ════════════════════════════════════════════════════════════════════════
// 2. APPLICATION APPROVED
// ════════════════════════════════════════════════════════════════════════
export async function sendApplicationApprovedEmail({ to, borrowerName, accessCode, loanAmount, loanType = 'Installment Loan', releaseDate, installmentAmount, totalRepayment, loanTerm = 2, numInstallments = 4 }) {
  const html = emailShell({
    accentColor: '#22C55E',
    badgeText: 'Approved',
    badgeEmoji: '✅',
    headerBorder: 'rgba(34,197,94,0.3)',
    body: `
      <tr><td style="background:#141B2D;padding:28px 36px 0;">
        ${banner('🎉', '#22C55E', 'Loan Approved!',
          `Hi <strong style="color:#F0F4FF;">${borrowerName}</strong>, your loan application has been approved.`)}
      </td></tr>
      <tr><td style="background:#141B2D;padding:0 36px 24px;">
        ${infoTable([
          { label: 'Loan Amount', value: `₱${Number(loanAmount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`, color: '#22C55E' },
          { label: 'Loan Type', value: loanType },
          { label: `Total Repayment (7%/mo × ${loanTerm} months)`, value: `₱${Number(totalRepayment).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` },
          { label: `Per Installment (${numInstallments} payments)`, value: `₱${Number(installmentAmount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`, color: '#8B5CF6' },
          { label: 'Expected Release Date', value: releaseDate, color: '#F59E0B' },
        ])}
      </td></tr>
      <tr><td style="background:#141B2D;padding:0 36px 24px;">
        ${accessCodeBlock(accessCode, PORTAL_URL, 'View My Loan Portal →')}
      </td></tr>
      <tr><td style="background:#141B2D;padding:0 36px 28px;">
        ${note(`<strong style="color:#CBD5F0;">How to use your portal:</strong><br/>
        1. Visit the portal and enter your access code: <strong style="color:#F0F4FF;">${accessCode}</strong><br/>
        2. View your loan balance, schedule, and payment history<br/>
        3. Upload payment proof directly from the portal<br/>
        4. Payments are due every <strong style="color:#F0F4FF;">5th and 20th</strong> of the month`)}
      </td></tr>`
  })
  return sendEmail({ to, subject: `🎉 Your Loan is Approved — Access Code: ${accessCode}`, html })
}

// ════════════════════════════════════════════════════════════════════════
// 3. APPLICATION REJECTED
// ════════════════════════════════════════════════════════════════════════
export async function sendApplicationRejectedEmail({ to, borrowerName, loanAmount, loanType = 'Installment Loan', reason = 'Your application did not meet our current eligibility requirements.' }) {
  const html = emailShell({
    accentColor: '#EF4444',
    badgeText: 'Not Approved',
    badgeEmoji: '❌',
    headerBorder: 'rgba(239,68,68,0.3)',
    body: `
      <tr><td style="background:#141B2D;padding:28px 36px 0;">
        ${banner('😔', '#EF4444', 'Application Not Approved',
          `Hi <strong style="color:#F0F4FF;">${borrowerName}</strong>, we were unable to approve your application at this time.`)}
      </td></tr>
      <tr><td style="background:#141B2D;padding:0 36px 24px;">
        ${infoTable([
          { label: 'Applicant', value: borrowerName },
          { label: 'Loan Type', value: loanType },
          { label: 'Amount Requested', value: `₱${Number(loanAmount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` },
          { label: 'Status', value: '❌ Not Approved', color: '#EF4444' },
        ])}
      </td></tr>
      <tr><td style="background:#141B2D;padding:0 36px 24px;">
        <div style="background:rgba(239,68,68,0.07);border:1px solid rgba(239,68,68,0.25);border-radius:12px;padding:20px;">
          <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#EF4444;font-weight:700;margin-bottom:10px;">Reason</div>
          <p style="font-size:14px;color:#CBD5F0;margin:0;line-height:1.8;">${reason}</p>
        </div>
      </td></tr>
      <tr><td style="background:#141B2D;padding:0 36px 28px;">
        ${note(`You may re-apply after addressing the above. For questions or clarifications, please visit our <a href="https://moneyfestlending.loan/contact" style="color:#60A5FA;">Contact Us</a> page to reach our admin team directly.`)}
      </td></tr>`
  })
  return sendEmail({ to, subject: `Application Update — MoneyfestLending`, html })
}

// ════════════════════════════════════════════════════════════════════════
// 4. FUNDS RELEASED
// ════════════════════════════════════════════════════════════════════════
export async function sendFundsReleasedEmail({ to, borrowerName, accessCode, loanAmount, loanType = 'Installment Loan', releaseDate, firstDueDate, numInstallments = 4, installmentAmount }) {
  const html = emailShell({
    accentColor: '#3B82F6',
    badgeText: 'Funds Released',
    badgeEmoji: '💸',
    headerBorder: 'rgba(59,130,246,0.3)',
    body: `
      <tr><td style="background:#141B2D;padding:28px 36px 0;">
        ${banner('💸', '#3B82F6', 'Funds Released!',
          `Hi <strong style="color:#F0F4FF;">${borrowerName}</strong>, your loan funds have been released to your account.`)}
      </td></tr>
      <tr><td style="background:#141B2D;padding:0 36px 24px;">
        ${infoTable([
          { label: 'Amount Released', value: `₱${Number(loanAmount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`, color: '#22C55E' },
          { label: 'Loan Type', value: loanType },
          { label: 'Release Date', value: releaseDate, color: '#3B82F6' },
          { label: `Per Installment (${numInstallments} payments)`, value: `₱${Number(installmentAmount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`, color: '#8B5CF6' },
          { label: 'First Payment Due', value: firstDueDate, color: '#F59E0B' },
        ])}
      </td></tr>
      <tr><td style="background:#141B2D;padding:0 36px 24px;">
        ${accessCodeBlock(accessCode, PORTAL_URL, 'View Payment Schedule →')}
      </td></tr>
      <tr><td style="background:#141B2D;padding:0 36px 28px;">
        ${note(`<strong style="color:#CBD5F0;">Important reminders:</strong><br/>
        • Payments are due every <strong style="color:#F0F4FF;">5th and 20th</strong> of the month<br/>
        • Upload your payment proof in the portal after each payment<br/>
        • Late or missed payments affect your credit score and loan limit<br/>
        • For concerns, visit our <a href="https://moneyfestlending.loan/contact" style="color:#60A5FA;">Contact Us</a> page`)}
      </td></tr>`
  })
  return sendEmail({ to, subject: `💸 Your Funds Have Been Released — MoneyfestLending`, html })
}

// ════════════════════════════════════════════════════════════════════════
// 5. PAYMENT DUE REMINDER
// ════════════════════════════════════════════════════════════════════════
export async function sendPaymentReminderEmail({ to, borrowerName, installmentNum, numInstallments = 4, amount, dueDate, loanAmount, remainingBalance, daysUntilDue, customMessages, customFooter }) {
  const urgencyColor = daysUntilDue === 0 ? '#EF4444' : daysUntilDue === 1 ? '#F59E0B' : '#3B82F6'
  const urgencyLabel = daysUntilDue === 0 ? 'DUE TODAY' : daysUntilDue === 1 ? 'DUE TOMORROW' : `DUE IN ${daysUntilDue} DAYS`
  const urgencyEmoji = daysUntilDue === 0 ? '🔴' : daysUntilDue === 1 ? '🟡' : '📅'

  const defaultMsg = daysUntilDue === 0
    ? `Your installment is due <strong>today</strong>. Please settle your payment before the cutoff. Timely payments protect your credit standing and unlock higher limits.`
    : daysUntilDue === 1
    ? `Your installment is due <strong>tomorrow</strong>. Please prepare your payment and coordinate with admin to avoid late fees.`
    : `Your next installment is coming up in <strong>${daysUntilDue} days</strong>. We're reaching out early so you can prepare on time.`

  const message = customMessages?.[daysUntilDue === 0 ? 'today' : daysUntilDue === 1 ? 'tomorrow' : 'upcoming'] || defaultMsg
  const paidInstallments = installmentNum - 1
  const progressPercent = Math.round((paidInstallments / numInstallments) * 100)

  const html = emailShell({
    accentColor: urgencyColor,
    badgeText: urgencyLabel,
    badgeEmoji: urgencyEmoji,
    headerBorder: `${urgencyColor}60`,
    body: `
      <tr><td style="background:#141B2D;padding:28px 36px 0;">
        <p style="font-size:15px;color:#CBD5F0;margin:0 0 8px;">Hi <strong style="color:#F0F4FF;">${borrowerName}</strong>,</p>
        <p style="font-size:14px;color:#8892B0;margin:0 0 24px;line-height:1.8;">${message}</p>
      </td></tr>
      <tr><td style="background:#141B2D;padding:0 36px 24px;">
        <div style="background:linear-gradient(135deg,#0f1729,#1a1040);border:1px solid rgba(139,92,246,0.3);border-radius:14px;padding:24px;text-align:center;">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#4B5580;margin-bottom:8px;">Amount Due</div>
          <div style="font-size:42px;font-weight:900;color:#22C55E;letter-spacing:-1px;margin-bottom:4px;">
            ₱${Number(amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
          </div>
          <div style="font-size:13px;color:#4B5580;">
            Installment <strong style="color:#8B5CF6;">${installmentNum}</strong> of <strong style="color:#8B5CF6;">${numInstallments}</strong>
            &nbsp;·&nbsp;
            Due <strong style="color:#F0F4FF;">${dueDate}</strong>
          </div>
        </div>
      </td></tr>
      <tr><td style="background:#141B2D;padding:0 36px 24px;">
        ${infoTable([
          { label: 'Loan Principal', value: `₱${Number(loanAmount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` },
          { label: 'Installment No.', value: `${installmentNum} of ${numInstallments}` },
          { label: 'Remaining Balance', value: `₱${Number(remainingBalance).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`, color: '#EF4444' },
        ])}
      </td></tr>
      <tr><td style="background:#141B2D;padding:0 36px 24px;">
        <div style="font-size:12px;color:#4B5580;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.06em;">Repayment Progress — ${progressPercent}%</div>
        <div style="height:8px;background:#1E2640;border-radius:4px;overflow:hidden;">
          <div style="height:100%;width:${progressPercent}%;background:linear-gradient(90deg,#8B5CF6,#22C55E);border-radius:4px;"></div>
        </div>
      </td></tr>
      <tr><td style="background:#141B2D;padding:0 36px 28px;">
        ${note(`📌 <strong style="color:#CBD5F0;">Reminder:</strong> Payments are collected every <strong style="color:#F0F4FF;">5th and 20th</strong> of the month. Upload your proof in the <a href="${PORTAL_URL}" style="color:#60A5FA;">borrower portal</a> after paying.`)}
      </td></tr>`
  })

  const subjectPrefix = daysUntilDue === 0 ? '🔴 Due Today' : daysUntilDue === 1 ? '🟡 Due Tomorrow' : `📅 Due in ${daysUntilDue} days`
  return sendEmail({ to, subject: `${subjectPrefix} — ₱${Number(amount).toLocaleString('en-PH')} installment`, html })
}

// ════════════════════════════════════════════════════════════════════════
// 6. PAYMENT CONFIRMED
// ════════════════════════════════════════════════════════════════════════
export async function sendPaymentConfirmedEmail({ to, borrowerName, accessCode, installmentNum, numInstallments = 4, amountPaid, paymentDate, remainingBalance, loanFullyPaid = false }) {
  const html = emailShell({
    accentColor: '#22C55E',
    badgeText: loanFullyPaid ? 'Loan Cleared! 🎊' : 'Payment Confirmed',
    badgeEmoji: '✅',
    headerBorder: 'rgba(34,197,94,0.3)',
    body: `
      <tr><td style="background:#141B2D;padding:28px 36px 0;">
        ${loanFullyPaid
          ? banner('🎊', '#22C55E', 'Loan Fully Paid!', `Hi <strong style="color:#F0F4FF;">${borrowerName}</strong>, congratulations — your loan has been fully settled!`)
          : banner('✅', '#22C55E', 'Payment Confirmed!', `Hi <strong style="color:#F0F4FF;">${borrowerName}</strong>, we've received and confirmed your payment.`)}
      </td></tr>
      <tr><td style="background:#141B2D;padding:0 36px 24px;">
        ${infoTable([
          { label: 'Amount Received', value: `₱${Number(amountPaid).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`, color: '#22C55E' },
          { label: 'Payment Date', value: paymentDate, color: '#3B82F6' },
          { label: 'Installment', value: `${installmentNum} of ${numInstallments}` },
          { label: 'Remaining Balance', value: loanFullyPaid ? '₱0.00 — Fully Paid ✓' : `₱${Number(remainingBalance).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`, color: loanFullyPaid ? '#22C55E' : '#F59E0B' },
        ])}
      </td></tr>
      <tr><td style="background:#141B2D;padding:0 36px 24px;">
        ${accessCodeBlock(accessCode, PORTAL_URL, loanFullyPaid ? 'View My Loan History →' : 'View My Updated Balance →')}
      </td></tr>
      <tr><td style="background:#141B2D;padding:0 36px 28px;">
        ${note(loanFullyPaid
          ? `🎉 Your loan record has been marked as <strong style="color:#22C55E;">Fully Paid</strong>. Your Security Hold has been returned to your Rebate Credits balance. Thank you for being a responsible borrower!`
          : `Your payment has been recorded. View your updated schedule and remaining balance anytime in the <a href="${PORTAL_URL}" style="color:#60A5FA;">borrower portal</a>. Keep it up!`)}
      </td></tr>`
  })
  return sendEmail({ to, subject: loanFullyPaid ? `🎊 Loan Fully Paid — MoneyfestLending` : `✅ Payment Confirmed — Installment ${installmentNum} of ${numInstallments}`, html })
}

// ════════════════════════════════════════════════════════════════════════
// BULK REMINDER (unchanged signature, calls new function)
// ════════════════════════════════════════════════════════════════════════
export async function sendBulkReminders({ events, daysAhead = 2 }) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const results = []

  const targets = events.filter(ev => {
    if (ev.isPaid) return false
    if (!ev.borrower?.email) return false
    const d = Math.ceil((ev.date - today) / (1000 * 60 * 60 * 24))
    return d >= 0 && d <= daysAhead
  })

  for (const ev of targets) {
    const daysUntilDue = Math.ceil((ev.date - today) / (1000 * 60 * 60 * 24))
    const dueDate = ev.date.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })
    const result = await sendPaymentReminderEmail({
      to: ev.borrower.email,
      borrowerName: ev.borrower.full_name,
      installmentNum: ev.installmentNum,
      numInstallments: ev.loan.num_installments || 4,
      amount: ev.amount,
      dueDate,
      loanAmount: ev.loan.loan_amount,
      remainingBalance: ev.loan.remaining_balance,
      daysUntilDue
    })
    results.push({ borrower: ev.borrower.full_name, email: ev.borrower.email, daysUntilDue, ...result })
    await new Promise(r => setTimeout(r, 300))
  }
  return results
}

// Legacy aliases so existing code doesn't break
export const sendPendingEmail = sendApplicationReceivedEmail
export const sendApprovalEmail = sendApplicationApprovedEmail
export const sendReminderEmail = sendPaymentReminderEmail
