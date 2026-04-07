const { createClient } = require('@supabase/supabase-js');

// Helper to calculate exact installment due dates (same logic as frontend)
function getInstallmentDates(releaseDateStr, numInstallments) {
  if (!releaseDateStr) return [];
  const [y, m, d] = String(releaseDateStr).slice(0, 10).split('-').map(Number);
  let year = y;
  let month = m - 1;
  const release = new Date(year, month, d);
  const dates = [];

  // Determine first cutoff
  let day;
  if (release.getDate() <= 5) {
    day = 20;
  } else {
    day = 5;
    month += 1;
    if (month > 11) { month = 0; year += 1; }
  }

  for (let i = 0; i < numInstallments; i++) {
    dates.push(new Date(year, month, day));
    if (day === 5) {
      day = 20;
    } else {
      day = 5;
      month += 1;
      if (month > 11) { month = 0; year += 1; }
    }
  }
  return dates;
}

module.exports = async (req, res) => {
  // Allow manual invocation or cron. Vercel automatically passes an auth header for cron but we can leave it open for admin testing if needed, or secure it via secret.
  console.log('[CRON] Starting daily overdue script...');

  const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Missing Supabase environment variables' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // 1. Fetch active/partially paid installment loans
  const { data: loans, error: loansErr } = await supabase
    .from('loans')
    .select('*, borrowers(id, full_name, email)')
    .in('status', ['Active', 'Partially Paid', 'Overdue'])
    .neq('loan_type', 'quickloan');

  if (loansErr) return res.status(500).json({ error: loansErr.message });

  let processedCount = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10); // YYYY-MM-DD

  for (const loan of loans) {
    // Determine if overdue
    const dates = getInstallmentDates(loan.release_date, loan.num_installments || 4);
    const nextDue = dates[loan.payments_made];
    if (!nextDue) continue; // fully paid or invalid

    nextDue.setHours(0, 0, 0, 0);
    const daysLate = Math.floor((today - nextDue) / (1000 * 60 * 60 * 24));

    if (daysLate > 0) {
      // 2. Check if we already processed a penalty for this exact loan today (prevent duplicate cron runs)
      const { data: logs } = await supabase
        .from('wallet_transactions')
        .select('id')
        .eq('loan_id', loan.id)
        .eq('type', 'penalty_deduction')
        .gte('created_at', new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString())
        .limit(1);

      if (logs && logs.length > 0) {
        console.log(`[CRON] Already processed penalty for loan ${loan.id} today.`);
        continue; // skip
      }

      console.log(`[CRON] Loan ${loan.id} is ${daysLate} days late. Processing penalty...`);

      // 3. Penalty logic: ₱20 per day 
      let penalty = 20;
      let holdToDeduct = 0;
      let addedToBalance = 0;

      const currentHold = Number(loan.security_hold || 0);

      if (currentHold >= penalty) {
        holdToDeduct = penalty;
      } else {
        // Hold is smaller than penalty (e.g. 0)
        holdToDeduct = currentHold; // Deduct whatever is left
        addedToBalance = penalty - currentHold; // Compound the rest!
      }

      // Update loan record
      const updatePayload = {
        security_hold: currentHold - holdToDeduct,
        // Mark as overdue if not already
        status: 'Overdue'
      };

      if (addedToBalance > 0) {
        updatePayload.remaining_balance = Number(loan.remaining_balance) + addedToBalance;
        // Total repayment must optionally increase so formulas still balance
        updatePayload.total_repayment = Number(loan.total_repayment) + addedToBalance;
      }

      await supabase.from('loans').update(updatePayload).eq('id', loan.id);

      // Record transaction history for portal visibility
      await supabase.from('wallet_transactions').insert({
        borrower_id: loan.borrower_id,
        loan_id: loan.id,
        type: 'penalty_deduction',
        amount: -penalty,
        description: \`Daily overdue penalty (Day \${daysLate}). \${holdToDeduct > 0 ? \`₱\${holdToDeduct} deducted from Hold.\` : ''} \${addedToBalance > 0 ? \`₱\${addedToBalance} added to Balance.\` : ''}\`.trim(),
        status: 'completed'
      });

      // 4. Send Email using the Supabase edge function mechanism directly to avoid importing React ES modules here.
      if (loan.borrowers?.email) {
        // Send via edge function or direct
        const subject = \`🔴 Action Required: Installment is \${daysLate} days OVERDUE\`;
        
        const html = \`
          <div style="font-family:sans-serif;background:#0B0F1A;padding:32px;color:#F0F4FF;border-radius:12px;">
            <div style="border-left:4px solid #EF4444;padding-left:14px;background:rgba(239,68,68,0.1);padding:14px;border-radius:0 8px 8px 0;margin-bottom:20px;">
              <h2 style="margin:0;color:#EF4444;font-size:18px;">⚠️ Account Overdue Warning</h2>
              <p style="margin:8px 0 0;font-size:14px;line-height:1.5;">Hi <strong>\${loan.borrowers.full_name}</strong>, your loan installment due on <strong>\${nextDue.toLocaleDateString('en-PH')}</strong> is currently <strong>\${daysLate} days overdue.</strong></p>
            </div>
            
            <div style="background:#141B2D;border:1px solid #1E2640;border-radius:8px;padding:20px;margin-bottom:20px;">
              <p style="margin:0 0 10px;color:#8892B0;">We have automatically applied today's <strong>₱20 daily penalty</strong> to your account.</p>
              <ul style="margin:0;padding-left:20px;color:#CBD5F0;font-size:14px;line-height:1.6;">
                <li><strong>Remaining Security Hold:</strong> ₱\${(currentHold - holdToDeduct).toLocaleString()}</li>
                <li><strong>Amount added to Principal Balance:</strong> ₱\${addedToBalance > 0 ? addedToBalance.toLocaleString() : '0'}</li>
                <li><strong>New Total Outstanding Balance:</strong> ₱\${((Number(loan.remaining_balance) + addedToBalance)).toLocaleString()}</li>
              </ul>
            </div>
            <p style="font-size:13px;color:#8892B0;">Please settle your payment immediately via your Borrower Portal to stop daily compounding penalties.</p>
            <a href="\${process.env.REACT_APP_PORTAL_URL || 'https://moneyfestlending.loan/portal'}" style="display:inline-block;padding:12px 24px;background:#3B82F6;color:#FFF;text-decoration:none;font-weight:bold;border-radius:8px;margin-top:10px;">Login to Portal</a>
          </div>
        \`;

        // POST to Mail Edge Function
        try {
          await fetch(\`\${supabaseUrl}/functions/v1/send-email\`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': \`Bearer \${supabaseKey}\`
            },
            body: JSON.stringify({ to: loan.borrowers.email, subject, html })
          });
          console.log(\`[CRON] Email sent to \${loan.borrowers.email}\`);
        } catch (e) {
          console.error('[CRON] Email err:', e);
        }
      }

      processedCount++;
    }
  }

  res.status(200).json({ success: true, processed: processedCount, message: 'Daily deductions calculated.' });
};
