const RESEND_API_KEY = process.env.REACT_APP_RESEND_API_KEY
const FROM_EMAIL = 'onboarding@resend.dev'
const APP_NAME = 'Loan Manifest'

function generateReminderHTML({ borrowerName, installmentNum, amount, dueDate, loanAmount, remainingBalance, daysUntilDue }) {
  const urgencyColor = daysUntilDue <= 1 ? '#EF4444' : daysUntilDue <= 3 ? '#F59E0B' : '#3B82F6'
  const urgencyText = daysUntilDue === 0 ? '🔴 Due Today!' : daysUntilDue === 1 ? '🟡 Due Tomorrow!' : `🔵 Due in ${daysUntilDue} days`

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Payment Reminder</title>
</head>
<body style="margin:0;padding:0;background:#f0f4ff;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:520px;margin:32px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1a1a3e,#2d1b69);padding:28px 32px;">
      <div style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">
        💼 Loan<span style="background:linear-gradient(135deg,#60a5fa,#a78bfa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">Manifest</span>
      </div>
      <div style="font-size:13px;color:rgba(255,255,255,0.5);margin-top:4px;">Payment Reminder</div>
    </div>

    <!-- Urgency Banner -->
    <div style="background:${urgencyColor}15;border-left:4px solid ${urgencyColor};padding:14px 32px;font-size:13px;font-weight:600;color:${urgencyColor};">
      ${urgencyText}
    </div>

    <!-- Body -->
    <div style="padding:28px 32px;">
      <p style="font-size:16px;color:#1a1a2e;margin:0 0 20px;line-height:1.5;">
        Hi <strong>${borrowerName}</strong>,
      </p>
      <p style="font-size:14px;color:#4a5568;margin:0 0 24px;line-height:1.6;">
        This is a friendly reminder that your loan installment is due on <strong style="color:#1a1a2e;">${dueDate}</strong>. Please make sure to coordinate with your admin before the cutoff.
      </p>

      <!-- Amount Box -->
      <div style="background:linear-gradient(135deg,#f0f4ff,#e8f5e9);border:1px solid #c8d8f0;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px;">
        <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.06em;color:#7A8AAA;margin-bottom:6px;">Amount Due</div>
        <div style="font-size:32px;font-weight:800;color:#22C55E;">₱${amount?.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
        <div style="font-size:12px;color:#7A8AAA;margin-top:4px;">Installment ${installmentNum} of 4</div>
      </div>

      <!-- Details -->
      <div style="background:#f8faff;border-radius:10px;padding:16px 20px;margin-bottom:24px;">
        <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #e8ecf5;font-size:13px;">
          <span style="color:#7A8AAA;">Loan Principal</span>
          <span style="font-weight:600;color:#1a1a2e;">₱${loanAmount?.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #e8ecf5;font-size:13px;">
          <span style="color:#7A8AAA;">Installment</span>
          <span style="font-weight:600;color:#1a1a2e;">${installmentNum} of 4</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;">
          <span style="color:#7A8AAA;">Remaining Balance</span>
          <span style="font-weight:700;color:#EF4444;">₱${remainingBalance?.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
        </div>
      </div>

      <!-- Progress -->
      <div style="margin-bottom:24px;">
        <div style="font-size:12px;color:#7A8AAA;margin-bottom:8px;">Repayment Progress</div>
        <div style="height:8px;background:#e8ecf5;border-radius:4px;overflow:hidden;">
          <div style="height:100%;width:${((installmentNum - 1) / 4) * 100}%;background:linear-gradient(90deg,#8B5CF6,#22C55E);border-radius:4px;"></div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:6px;">
          ${[1,2,3,4].map(i => `
            <div style="width:24px;height:24px;border-radius:50%;background:${i < installmentNum ? '#22C55E' : '#e8ecf5'};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:${i < installmentNum ? '#fff' : '#7A8AAA'};">
              ${i < installmentNum ? '✓' : i}
            </div>
          `).join('')}
        </div>
      </div>

      <p style="font-size:13px;color:#7A8AAA;line-height:1.6;margin:0;">
        Please coordinate with your admin for payment. This is an automated reminder from ${APP_NAME}.
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#f8faff;padding:16px 32px;text-align:center;border-top:1px solid #e8ecf5;">
      <p style="font-size:11px;color:#7A8AAA;margin:0;">
        ${APP_NAME} · Private Workplace Lending System<br/>
        Please do not reply to this email.
      </p>
    </div>
  </div>
</body>
</html>
  `
}

export async function sendReminderEmail({ to, borrowerName, installmentNum, amount, dueDate, loanAmount, remainingBalance, daysUntilDue }) {
  if (!RESEND_API_KEY) {
    console.error('Resend API key not configured')
    return { success: false, error: 'API key not configured' }
  }
  if (!to || !to.includes('@')) {
    return { success: false, error: 'Invalid email address' }
  }

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
        html: generateReminderHTML({ borrowerName, installmentNum, amount, dueDate, loanAmount, remainingBalance, daysUntilDue })
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

    results.push({
      borrower: ev.borrower.full_name,
      email: ev.borrower.email,
      daysUntilDue,
      ...result
    })

    // Small delay between emails to avoid rate limiting
    await new Promise(r => setTimeout(r, 300))
  }

  return results
}
