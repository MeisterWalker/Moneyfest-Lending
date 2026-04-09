const { createClient } = require('@supabase/supabase-js');

// FIX 2: Guard against missing required environment variables at startup
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    'Missing required environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'
  );
}

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

  // FIX 1: Using service role key to bypass RLS for server-side cron operations
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // 1. Fetch active/partially paid installment loans
  const { data: loans, error: loansErr } = await supabase
    .from('loans')
    .select('*, borrowers(id, full_name, email, credit_score)')
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
      // 2. Robust State-Based Penalty Calculation
      // Retrieve past penalty deductions for this specific loan
      const { data: pastLogs } = await supabase
        .from('wallet_transactions')
        .select('amount')
        .eq('loan_id', loan.id)
        .eq('type', 'penalty_deduction');

      let totalPreviouslyCharged = 0;
      if (pastLogs) {
        pastLogs.forEach(log => {
          totalPreviouslyCharged += Math.abs(log.amount || 0);
        });
      }

      // 3. Catch-up Penalty logic: calculate what is owed minus what was already charged
      const expectedTotalPenalty = daysLate * 20;
      let penalty = expectedTotalPenalty - totalPreviouslyCharged;

      if (penalty <= 0) {
        console.log(`[CRON] Loan ${loan.id} is up to date with penalty deductions.`);
        continue; // skip, already billed correctly
      }

      console.log(`[CRON] Loan ${loan.id} is ${daysLate} days late. Processing catch-up penalty of ₱${penalty}...`);
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

      // Decrement Credit Score logic (-10 points per late day)
      const pointsToDeduct = (penalty / 20) * 10;
      const currentScore = Number(loan.borrowers?.credit_score || 750);
      const newScore = Math.max(300, currentScore - pointsToDeduct);
      
      await supabase.from('borrowers').update({ credit_score: newScore }).eq('id', loan.borrower_id);

      // Record transaction history for portal visibility
      await supabase.from('wallet_transactions').insert({
        borrower_id: loan.borrower_id,
        loan_id: loan.id,
        type: 'penalty_deduction',
        amount: -penalty,
        description: `Daily overdue penalty (Day ${daysLate}). ${holdToDeduct > 0 ? `₱${holdToDeduct} deducted from Hold.` : ''} ${addedToBalance > 0 ? `₱${addedToBalance} added to Balance.` : ''}`.trim(),
        status: 'completed'
      });

      // 4. Send Email using the Supabase edge function mechanism directly to avoid importing React ES modules here.
      if (loan.borrowers?.email) {
        // Send via edge function or direct
        const subject = `🔴 Action Required: Installment is ${daysLate} days OVERDUE`;
        
        const html = `
          <div style="font-family:sans-serif;background:#0B0F1A;padding:32px;color:#F0F4FF;border-radius:12px;">
            <div style="border-left:4px solid #EF4444;padding-left:14px;background:rgba(239,68,68,0.1);padding:14px;border-radius:0 8px 8px 0;margin-bottom:20px;">
              <h2 style="margin:0;color:#EF4444;font-size:18px;">⚠️ Account Overdue Warning</h2>
              <p style="margin:8px 0 0;font-size:14px;line-height:1.5;">Hi <strong>${loan.borrowers.full_name}</strong>, your loan installment due on <strong>${nextDue.toLocaleDateString('en-PH')}</strong> is currently <strong>${daysLate} days overdue.</strong></p>
            </div>
            
            <div style="background:#141B2D;border:1px solid #1E2640;border-radius:8px;padding:20px;margin-bottom:20px;">
              <p style="margin:0 0 10px;color:#8892B0;">We have automatically applied a deduction of <strong>₱${penalty}</strong> to your account for accrued overdue penalties.</p>
              <ul style="margin:0;padding-left:20px;color:#CBD5F0;font-size:14px;line-height:1.6;">
                <li><strong>Remaining Security Hold:</strong> ₱${(currentHold - holdToDeduct).toLocaleString()}</li>
                <li><strong>Amount added to Principal Balance:</strong> ₱${addedToBalance > 0 ? addedToBalance.toLocaleString() : '0'}</li>
                <li><strong>New Total Outstanding Balance:</strong> ₱${((Number(loan.remaining_balance) + addedToBalance)).toLocaleString()}</li>
              </ul>
              <div style="margin-top:14px;padding-top:14px;border-top:1px solid rgba(255,255,255,0.05);">
                <p style="margin:0;color:#F97316;font-size:13px;">⚠️ <strong>Credit Impact:</strong> Your credit score has been lowered by ${pointsToDeduct} points (Now: ${newScore}).</p>
              </div>
            </div>
            <p style="font-size:13px;color:#8892B0;">Please settle your payment immediately via your Borrower Portal to stop daily compounding penalties.</p>
            <a href="${process.env.REACT_APP_PORTAL_URL || 'https://moneyfestlending.loan/portal'}" style="display:inline-block;padding:12px 24px;background:#3B82F6;color:#FFF;text-decoration:none;font-weight:bold;border-radius:8px;margin-top:10px;">Login to Portal</a>
          </div>
        `;

        // POST to Mail Edge Function
        try {
          await fetch(`${process.env.SUPABASE_URL}/functions/v1/send-email`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
            },
            body: JSON.stringify({ to: loan.borrowers.email, subject, html })
          });
          console.log(`[CRON] Email sent to ${loan.borrowers.email}`);
        } catch (e) {
          console.error('[CRON] Email err:', e);
        }
      }

      processedCount++;
    }
  }

  res.status(200).json({ success: true, processed: processedCount, message: 'Daily deductions calculated.' });
};
