const RESEND_API_KEY = process.env.REACT_APP_RESEND_API_KEY
const FROM_EMAIL = 'onboarding@resend.dev'
const APP_NAME = 'Loan Manifest'

function generateReminderHTML({ borrowerName, installmentNum, amount, dueDate, loanAmount, remainingBalance, daysUntilDue, customMessages, customFooter }) {
  const urgencyColor = daysUntilDue === 0 ? '#EF4444' : daysUntilDue === 1 ? '#F59E0B' : '#3B82F6'
  const urgencyLabel = daysUntilDue === 0 ? 'DUE TODAY' : daysUntilDue === 1 ? 'DUE TOMORROW' : `DUE IN ${daysUntilDue} DAYS`
  const urgencyEmoji = daysUntilDue === 0 ? '🔴' : daysUntilDue === 1 ? '🟡' : '🔵'

  const paidInstallments = installmentNum - 1
  const progressPercent = (paidInstallments / 4) * 100

  const STORAGE_KEY = 'lm_email_settings'
  let savedSettings = {}
  try { savedSettings = JSON.parse(typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) || '{}' : '{}') } catch {}
  const msgs = customMessages || savedSettings
  const footerText = customFooter || savedSettings.footer || 'From LM Management'

  const defaultUpcoming = `Your next installment is coming up in <strong>${daysUntilDue} days</strong>. We're reaching out early so you have enough time to prepare. Staying on top of your payments keeps your credit score healthy and ensures continued access to our lending program.`
  const defaultTomorrow = `Your installment is due <strong>tomorrow</strong>. Please prepare your payment and coordinate with your admin at your earliest convenience to avoid any late fees or credit score deductions.`
  const defaultToday = `Your installment is due <strong>today</strong>. Please make sure to settle your payment before the cutoff ends. Timely payments help maintain your credit standing and unlock higher loan limits in the future.`

  const rawMessage = daysUntilDue === 0
    ? (msgs?.today || defaultToday)
    : daysUntilDue === 1
    ? (msgs?.tomorrow || defaultTomorrow)
    : (msgs?.upcoming || defaultUpcoming)

  const reminderMessage = rawMessage.replace('{days}', daysUntilDue)

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Payment Reminder — Loan Manifest</title>
</head>
<body style="margin:0;padding:0;background:#0B0F1A;font-family:'Segoe UI',Arial,sans-serif;">

  <!-- Outer wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0B0F1A;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:560px;" cellpadding="0" cellspacing="0">

          <!-- HEADER: Logo + Brand -->
          <tr>
            <td style="background:linear-gradient(135deg,#0d1226 0%,#141B2D 60%,#1a1040 100%);border-radius:16px 16px 0 0;padding:32px 36px;border-bottom:1px solid rgba(139,92,246,0.3);">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <!-- Logo icon -->
                    <div style="display:inline-block;width:42px;height:42px;background:linear-gradient(135deg,#3B82F6,#8B5CF6);border-radius:10px;text-align:center;line-height:42px;font-size:20px;margin-bottom:12px;">💼</div>
                    <div style="font-size:26px;font-weight:900;color:#F0F4FF;letter-spacing:-1px;margin-bottom:2px;">
                      Loan<span style="background:linear-gradient(90deg,#60a5fa,#a78bfa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">Manifest</span>
                    </div>
                    <div style="font-size:12px;color:#4B5580;letter-spacing:0.08em;text-transform:uppercase;">Workplace Lending System</div>
                  </td>
                  <td align="right" valign="top">
                    <div style="background:${urgencyColor}20;border:1px solid ${urgencyColor}60;border-radius:20px;padding:6px 14px;display:inline-block;">
                      <span style="font-size:11px;font-weight:800;color:${urgencyColor};letter-spacing:0.08em;">${urgencyEmoji} ${urgencyLabel}</span>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- GREETING -->
          <tr>
            <td style="background:#141B2D;padding:28px 36px 0;">
              <p style="font-size:15px;color:#CBD5F0;margin:0 0 6px;">Hi <strong style="color:#F0F4FF;">${borrowerName}</strong>,</p>
              <p style="font-size:14px;color:#8892B0;margin:0 0 20px;line-height:1.7;">
                ${reminderMessage}
              </p>
            </td>
          </tr>

          <!-- AMOUNT DUE CARD -->
          <tr>
            <td style="background:#141B2D;padding:0 36px 24px;">
              <div style="background:linear-gradient(135deg,#0f1729,#1a1040);border:1px solid rgba(139,92,246,0.3);border-radius:14px;padding:24px;text-align:center;position:relative;overflow:hidden;">
                <!-- Glow effect via border -->
                <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#4B5580;margin-bottom:8px;">Amount Due</div>
                <div style="font-size:42px;font-weight:900;color:#22C55E;letter-spacing:-1px;margin-bottom:4px;">
                  ₱${amount?.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div style="font-size:13px;color:#4B5580;">
                  Installment <strong style="color:#8B5CF6;">${installmentNum}</strong> of <strong style="color:#8B5CF6;">4</strong>
                  &nbsp;·&nbsp;
                  Due <strong style="color:#F0F4FF;">${dueDate}</strong>
                </div>
              </div>
            </td>
          </tr>

          <!-- LOAN DETAILS -->
          <tr>
            <td style="background:#141B2D;padding:0 36px 24px;">
              <div style="background:#0B0F1A;border:1px solid #1E2640;border-radius:12px;overflow:hidden;">
                <div style="padding:12px 20px;border-bottom:1px solid #1E2640;display:flex;justify-content:space-between;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="font-size:13px;color:#4B5580;padding:8px 0;border-bottom:1px solid #1E2640;">Loan Principal</td>
                      <td align="right" style="font-size:13px;font-weight:700;color:#F0F4FF;padding:8px 0;border-bottom:1px solid #1E2640;">₱${loanAmount?.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                    </tr>
                    <tr>
                      <td style="font-size:13px;color:#4B5580;padding:8px 0;border-bottom:1px solid #1E2640;">Installment No.</td>
                      <td align="right" style="font-size:13px;font-weight:700;color:#F0F4FF;padding:8px 0;border-bottom:1px solid #1E2640;">${installmentNum} of 4</td>
                    </tr>
                    <tr>
                      <td style="font-size:13px;color:#4B5580;padding:8px 0;">Remaining Balance</td>
                      <td align="right" style="font-size:13px;font-weight:700;color:#EF4444;padding:8px 0;">₱${remainingBalance?.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  </table>
                </div>
              </div>
            </td>
          </tr>

          <!-- PROGRESS BAR -->
          <tr>
            <td style="background:#141B2D;padding:0 36px 28px;">
              <div style="font-size:12px;color:#4B5580;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.06em;">Repayment Progress</div>
              <!-- Track -->
              <div style="height:8px;background:#1E2640;border-radius:4px;overflow:hidden;margin-bottom:12px;">
                <div style="height:100%;width:${progressPercent}%;background:linear-gradient(90deg,#8B5CF6,#22C55E);border-radius:4px;"></div>
              </div>
              <!-- Step circles -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  ${[1,2,3,4].map(i => `
                  <td align="center">
                    <div style="width:28px;height:28px;border-radius:50%;background:${i < installmentNum ? 'linear-gradient(135deg,#8B5CF6,#22C55E)' : i === installmentNum ? '#3B82F6' : '#1E2640'};margin:0 auto;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:${i <= installmentNum ? '#fff' : '#4B5580'};line-height:28px;text-align:center;">
                      ${i < installmentNum ? '✓' : i}
                    </div>
                    <div style="font-size:10px;color:${i < installmentNum ? '#22C55E' : i === installmentNum ? '#3B82F6' : '#4B5580'};margin-top:5px;text-align:center;">${i < installmentNum ? 'Paid' : i === installmentNum ? 'Due' : 'Sched'}</div>
                  </td>
                  `).join('')}
                </tr>
              </table>
            </td>
          </tr>

          <!-- REMINDER NOTE -->
          <tr>
            <td style="background:#141B2D;padding:0 36px 28px;">
              <div style="background:rgba(59,130,246,0.07);border-left:3px solid #3B82F6;border-radius:0 8px 8px 0;padding:14px 16px;">
                <p style="font-size:13px;color:#8892B0;margin:0;line-height:1.7;">
                  📌 <strong style="color:#CBD5F0;">Reminder:</strong> Payments are collected every <strong style="color:#F0F4FF;">5th and 20th</strong> of the month. Late or missed payments affect your credit score and may freeze your loan limit increase. For questions or concerns, please reach out to your admin directly.
                </p>
              </div>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background:#0d1226;border-top:1px solid #1E2640;border-radius:0 0 16px 16px;padding:24px 36px;text-align:center;">
              <p style="font-size:13px;color:#CBD5F0;margin:0 0 4px;font-weight:600;">${footerText}</p>
              <p style="font-size:11px;color:#4B5580;margin:0 0 12px;">This is an automated reminder. Please do not reply to this email.</p>
              <div style="width:40px;height:2px;background:linear-gradient(90deg,#3B82F6,#8B5CF6);margin:0 auto;border-radius:2px;"></div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>
  `
}

export async function sendReminderEmail({ to, borrowerName, installmentNum, amount, dueDate, loanAmount, remainingBalance, daysUntilDue, customMessages, customFooter }) {
  if (!RESEND_API_KEY) return { success: false, error: 'API key not configured' }
  if (!to || !to.includes('@')) return { success: false, error: 'Invalid email address' }

  const urgencyPrefix = daysUntilDue === 0 ? '🔴 Due Today' : daysUntilDue === 1 ? '🟡 Due Tomorrow' : `📅 Due in ${daysUntilDue} days`

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: `${APP_NAME} <${FROM_EMAIL}>`,
        to: [to],
        subject: `${urgencyPrefix} — ₱${amount?.toLocaleString('en-PH')} installment due ${dueDate}`,
        html: generateReminderHTML({ borrowerName, installmentNum, amount, dueDate, loanAmount, remainingBalance, daysUntilDue, customMessages, customFooter })
      })
    })
    const data = await response.json()
    if (!response.ok) return { success: false, error: data.message || 'Failed to send' }
    return { success: true, id: data.id }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

export async function sendBulkReminders({ events, daysAhead = 2 }) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const results = []

  const targetEvents = events.filter(ev => {
    if (ev.isPaid) return false
    if (!ev.borrower?.email) return false
    const daysUntil = Math.ceil((ev.date - today) / (1000 * 60 * 60 * 24))
    return daysUntil >= 0 && daysUntil <= daysAhead
  })

  for (const ev of targetEvents) {
    const daysUntilDue = Math.ceil((ev.date - today) / (1000 * 60 * 60 * 24))
    const dueDate = ev.date.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })

    const result = await sendReminderEmail({
      to: ev.borrower.email,
      borrowerName: ev.borrower.full_name,
      installmentNum: ev.installmentNum,
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
