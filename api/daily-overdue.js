const { createClient } = require('@supabase/supabase-js');

// ── Guard: fail fast if env vars are absent ──────────────────────
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing required env vars: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

// ── Installment due-date helper (mirrors frontend logic) ─────────
function getInstallmentDates(releaseDateStr, numInstallments) {
  if (!releaseDateStr) return [];
  const [y, m, d] = String(releaseDateStr).slice(0, 10).split('-').map(Number);
  let year = y, month = m - 1;
  const release = new Date(year, month, d);
  const dates = [];

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

// ── Format date as 'YYYY-MM-DD' (local, not UTC) ─────────────────
function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── Main handler ─────────────────────────────────────────────────
module.exports = async (req, res) => {
  console.log('[CRON] ═══════════════════════════════════════════');
  console.log('[CRON] Starting daily-overdue at', new Date().toISOString());

  // ── Auth guard: Vercel sends CRON_SECRET as Authorization: Bearer <secret>
  // when invoking cron jobs. Reject any request that doesn't carry it.
  const authHeader = req.headers['authorization'];
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.warn('[CRON] ⛔ Unauthorized request — missing or invalid Authorization header');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = toDateStr(today);

  // ── 1. Fetch active/overdue installment loans ─────────────────
  const { data: loans, error: loansErr } = await supabase
    .from('loans')
    .select('*, borrowers(id, full_name, email, credit_score)')
    .in('status', ['Active', 'Partially Paid', 'Overdue'])
    .neq('loan_type', 'quickloan');

  if (loansErr) {
    console.error('[CRON] ❌ Failed to fetch loans:', loansErr.message);
    return res.status(500).json({ error: 'Failed to fetch loans', detail: loansErr.message });
  }
  if (!loans || loans.length === 0) {
    console.log('[CRON] No active/overdue loans found. Done.');
    return res.status(200).json({ success: true, processed: 0, message: 'No overdue loans found.' });
  }
  console.log(`[CRON] Loaded ${loans.length} active/overdue loans`);

  // ── 2. Batch-fetch all existing penalty_charges so we can deduplicate ──
  const loanIds = loans.map(l => l.id);

  const { data: existingPenalties, error: penFetchErr } = await supabase
    .from('penalty_charges')
    .select('loan_id, penalty_amount, created_at')
    .in('loan_id', loanIds);

  if (penFetchErr) {
    console.error('[CRON] ❌ Failed to fetch existing penalty_charges:', penFetchErr.message);
    return res.status(500).json({ error: 'Failed to fetch penalty_charges', detail: penFetchErr.message });
  }

  // Build lookup: "loanId|dateStr" → total already charged on that date
  const chargedTodaySet = new Set();
  const totalChargedByLoan = {};
  for (const p of (existingPenalties || [])) {
    // Use created_at date portion for dedup (charged_date column doesn't exist)
    const dateStr = p.created_at ? p.created_at.slice(0, 10) : '';
    const key = `${p.loan_id}|${dateStr}`;
    chargedTodaySet.add(key); // used to prevent duplicate today entries
    totalChargedByLoan[p.loan_id] = (totalChargedByLoan[p.loan_id] || 0) + (parseFloat(p.penalty_amount) || 0);
  }

  // ── 3. Also fetch wallet_transactions for backward compat (existing penalty_deductions) ──
  const { data: allPenaltyTxns } = await supabase
    .from('wallet_transactions')
    .select('loan_id, amount')
    .in('loan_id', loanIds)
    .eq('type', 'penalty_deduction');

  const walletChargedMap = {};
  for (const txn of (allPenaltyTxns || [])) {
    walletChargedMap[txn.loan_id] = (walletChargedMap[txn.loan_id] || 0) + Math.abs(txn.amount || 0);
  }

  // ── 4. Process each loan ──────────────────────────────────────
  const loanUpdates      = [];
  const borrowerUpdates  = [];
  const walletTxInserts  = [];
  const penaltyInserts   = [];   // → penalty_charges
  const auditLogRows     = [];   // → audit_logs
  const emailPromises    = [];
  let processedCount     = 0;
  let skippedCount       = 0;

  for (const loan of loans) {
    const dates  = getInstallmentDates(loan.release_date, loan.num_installments || 4);
    const nextDue = dates[loan.payments_made];
    if (!nextDue) {
      console.log(`[CRON] Loan ${loan.id}: no due date at index ${loan.payments_made} — skipping`);
      continue;
    }

    nextDue.setHours(0, 0, 0, 0);
    const daysLate = Math.floor((today - nextDue) / (1000 * 60 * 60 * 24));

    if (daysLate <= 0) {
      skippedCount++;
      continue; // not overdue
    }

    // ── Duplicate guard: skip if we already charged this loan today ──
    const todayKey = `${loan.id}|${todayStr}`;
    if (chargedTodaySet.has(todayKey)) {
      console.log(`[CRON] Loan ${loan.id}: penalty already charged for ${todayStr} — skipping duplicate`);
      skippedCount++;
      continue;
    }

    // ── Cumulative penalty math: ₱20 × days_late, minus already charged ──
    const expectedTotal    = daysLate * 20;
    // Use penalty_charges table as source of truth; fall back to wallet_transactions
    const alreadyCharged   = totalChargedByLoan[loan.id] || walletChargedMap[loan.id] || 0;
    const penaltyToCharge  = expectedTotal - alreadyCharged;

    if (penaltyToCharge <= 0) {
      console.log(`[CRON] Loan ${loan.id}: ${daysLate} days late but fully caught up (charged ₱${alreadyCharged}) — skipping`);
      skippedCount++;
      continue;
    }

    console.log(`[CRON] Loan ${loan.id}: ${daysLate} days late | expected ₱${expectedTotal} | charged ₱${alreadyCharged} | charging ₱${penaltyToCharge} today`);

    // ── security_hold deduction (never < 0) ──
    const currentHold  = Math.max(0, Number(loan.security_hold || 0));
    const holdDeduct   = Math.min(currentHold, penaltyToCharge);
    const addToBalance = penaltyToCharge - holdDeduct;
    const newHold      = Math.max(0, currentHold - holdDeduct);

    // ── Loan update payload ──
    const loanUpdatePayload = {
      security_hold: newHold,
      status: 'Overdue',
    };
    if (addToBalance > 0) {
      loanUpdatePayload.remaining_balance = Number(loan.remaining_balance || 0) + addToBalance;
    }
    loanUpdates.push({ id: loan.id, payload: loanUpdatePayload });

    // ── Credit score (once per catch-up, only if first penalty ever) ──
    const isFirstPenalty = alreadyCharged === 0;
    if (isFirstPenalty) {
      const currentScore = Number(loan.borrowers?.credit_score || 750);
      const newScore     = Math.max(300, currentScore - 10);
      borrowerUpdates.push({ id: loan.borrower_id, loan_id: loan.id, credit_score: newScore });
      console.log(`[CRON] Loan ${loan.id}: credit score ${currentScore} → ${newScore}`);
    }

    // ── penalty_charges insert (one row per catch-up run) ──
    penaltyInserts.push({
      loan_id:            loan.id,
      borrower_id:        loan.borrower_id,
      installment_number: (loan.payments_made || 0) + 1,
      days_late:          daysLate,
      penalty_per_day:    20,
      penalty_amount:     penaltyToCharge,
      cap_applied:        false,
    });

    // ── audit_logs insert ──
    auditLogRows.push({
      action_type:  'PENALTY_CHARGED',
      module:       'Loan',
      description:  `Overdue penalty ₱${penaltyToCharge} charged — Loan ${loan.id}, Day ${daysLate}. Hold: ₱${currentHold} → ₱${newHold}.`,
      changed_by:   'system-cron',
    });

    // ── wallet_transactions (borrower portal visibility) ──
    walletTxInserts.push({
      borrower_id: loan.borrower_id,
      loan_id:     loan.id,
      type:        'penalty_deduction',
      amount:      -penaltyToCharge,
      description: `Daily overdue penalty (Day ${daysLate}). ₱${holdDeduct} from Hold${addToBalance > 0 ? `, ₱${addToBalance} added to Balance` : ''}.`,
      status:      'completed',
    });

    // ── Overdue notification email ──
    if (loan.borrowers?.email) {
      const borrowerName  = loan.borrowers.full_name;
      const borrowerEmail = loan.borrowers.email;
      const currentScore  = Number(loan.borrowers?.credit_score || 750);
      const newScore      = isFirstPenalty ? Math.max(300, currentScore - 10) : currentScore;
      const pointsLost    = isFirstPenalty ? 10 : 0;

      const subject = `🔴 Action Required: Loan installment is ${daysLate} day${daysLate !== 1 ? 's' : ''} OVERDUE`;
      const html = `
        <div style="font-family:sans-serif;background:#0B0F1A;padding:32px;color:#F0F4FF;border-radius:12px;">
          <div style="border-left:4px solid #EF4444;padding:14px;background:rgba(239,68,68,0.1);border-radius:0 8px 8px 0;margin-bottom:20px;">
            <h2 style="margin:0;color:#EF4444;font-size:18px;">⚠️ Account Overdue Warning</h2>
            <p style="margin:8px 0 0;font-size:14px;line-height:1.5;">
              Hi <strong>${borrowerName}</strong>, your installment due on
              <strong>${nextDue.toLocaleDateString('en-PH')}</strong> is
              <strong>${daysLate} day${daysLate !== 1 ? 's' : ''} overdue</strong>.
            </p>
          </div>
          <div style="background:#141B2D;border:1px solid #1E2640;border-radius:8px;padding:20px;margin-bottom:20px;">
            <p style="margin:0 0 10px;color:#8892B0;">
              A penalty of <strong>₱${penaltyToCharge}</strong> has been applied to your account.
            </p>
            <ul style="margin:0;padding-left:20px;color:#CBD5F0;font-size:14px;line-height:1.6;">
              <li><strong>Security Hold remaining:</strong> ₱${newHold.toLocaleString()}</li>
              <li><strong>Amount added to balance:</strong> ₱${addToBalance > 0 ? addToBalance.toLocaleString() : '0'}</li>
              <li><strong>New outstanding balance:</strong> ₱${(Number(loan.remaining_balance || 0) + addToBalance).toLocaleString()}</li>
            </ul>
            ${pointsLost > 0 ? `
            <div style="margin-top:14px;padding-top:14px;border-top:1px solid rgba(255,255,255,0.05);">
              <p style="margin:0;color:#F97316;font-size:13px;">
                ⚠️ <strong>Credit Impact:</strong> Credit score reduced by ${pointsLost} points (Now: ${newScore}).
              </p>
            </div>` : ''}
          </div>
          <p style="font-size:13px;color:#8892B0;">Please settle immediately via your Borrower Portal to stop daily penalties.</p>
          <a href="${process.env.REACT_APP_PORTAL_URL || 'https://moneyfestlending.loan/portal'}"
             style="display:inline-block;padding:12px 24px;background:#3B82F6;color:#FFF;text-decoration:none;font-weight:bold;border-radius:8px;margin-top:10px;">
            Login to Portal
          </a>
        </div>
      `;

      emailPromises.push(
        fetch(`${process.env.SUPABASE_URL}/functions/v1/send-email`, {
          method:  'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({ to: borrowerEmail, subject, html }),
        })
          .then(() => console.log(`[CRON] ✅ Email sent to ${borrowerEmail}`))
          .catch(e  => console.error(`[CRON] ❌ Email failed for ${borrowerEmail}:`, e.message))
      );
    }

    processedCount++;
  }

  // ── 5. Execute all DB writes ──────────────────────────────────
  console.log(`[CRON] Writing: ${loanUpdates.length} loan updates, ${penaltyInserts.length} penalty_charges, ${auditLogRows.length} audit_logs`);

  // Loan updates (one-by-one to keep error granularity)
  for (const { id, payload } of loanUpdates) {
    const { error: luErr } = await supabase.from('loans').update(payload).eq('id', id);
    if (luErr) console.error(`[CRON] ❌ Loan update failed for ${id}:`, luErr.message);
    else        console.log(`[CRON] ✅ Loan ${id} updated (hold → ${payload.security_hold})`);
  }

  // Borrower credit score updates
  for (const { id, loan_id, credit_score } of borrowerUpdates) {
    const { error: buErr } = await supabase.from('borrowers').update({ credit_score }).eq('id', id);
    if (buErr) console.error(`[CRON] ❌ Borrower update failed for ${id}:`, buErr.message);
    else {
      await supabase
        .from('loans')
        .update({ overdue_credit_deducted: true })
        .eq('id', loan_id);
    }
  }

  // penalty_charges — insert (dedup handled by chargedTodaySet above)
  if (penaltyInserts.length > 0) {
    const { error: penErr } = await supabase
      .from('penalty_charges')
      .insert(penaltyInserts);
    if (penErr) console.error('[CRON] ❌ penalty_charges insert failed:', penErr.message);
    else        console.log(`[CRON] ✅ ${penaltyInserts.length} penalty_charges rows inserted`);
  }

  // audit_logs
  if (auditLogRows.length > 0) {
    const { error: alErr } = await supabase.from('audit_logs').insert(auditLogRows);
    if (alErr) console.error('[CRON] ❌ audit_logs insert failed:', alErr.message);
    else       console.log(`[CRON] ✅ ${auditLogRows.length} audit_log rows inserted`);
  }

  // wallet_transactions (legacy / portal)
  if (walletTxInserts.length > 0) {
    const { error: wtErr } = await supabase.from('wallet_transactions').insert(walletTxInserts);
    if (wtErr) console.error('[CRON] ❌ wallet_transactions insert failed:', wtErr.message);
    else       console.log(`[CRON] ✅ ${walletTxInserts.length} wallet_transaction rows inserted`);
  }

  // Fire-and-forget emails
  Promise.allSettled(emailPromises).then(results => {
    const sent = results.filter(r => r.status === 'fulfilled').length;
    console.log(`[CRON] Email batch: ${sent}/${results.length} sent`);
  });

  const totalProfit = penaltyInserts.reduce((sum, p) => sum + Number(p.penalty_amount), 0);

  console.log(`[CRON] Done. Processed: ${processedCount}, Skipped: ${skippedCount}`);
  console.log(`[CRON] Performance Summary:`);
  console.log(`       - Total Principal Rotate: ₱0.00 (Daily Penalty Run)`);
  console.log(`       - Total Profit Earned:    ₱${totalProfit.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`);
  console.log('[CRON] ═══════════════════════════════════════════');

  return res.status(200).json({
    success:   true,
    processed: processedCount,
    skipped:   skippedCount,
    message:   `Daily overdue run complete. ${processedCount} loan(s) charged, ${skippedCount} skipped.`,
  });
};
