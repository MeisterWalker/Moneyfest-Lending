const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// ── CONFIG ────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // Need service role to bypass RLS

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── REPLICATED HELPER ─────────────────────────────────────────────
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

function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── MAIN SYNC ─────────────────────────────────────────────────────
async function syncPenalties(isDryRun = true) {
  console.log(`[RESCUE] ════════ ${isDryRun ? 'DRY RUN' : 'EXE MODE'} ════════`);
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = toDateStr(today);

  // 1. Fetch Loans
  const { data: loans, error: loansErr } = await supabase
    .from('loans')
    .select('*, borrowers(id, full_name, credit_score)')
    .in('status', ['Active', 'Partially Paid', 'Overdue'])
    .neq('loan_type', 'quickloan');

  if (loansErr) throw loansErr;
  console.log(`[RESCUE] Found ${loans.length} active installment loans.`);

  // 2. Fetch Penalties
  const loanIds = loans.map(l => l.id);
  const { data: penalties } = await supabase.from('penalty_charges').select('*').in('loan_id', loanIds);
  const { data: walletTxns } = await supabase.from('wallet_transactions').select('*').in('loan_id', loanIds).eq('type', 'penalty_deduction');

  const totalChargedByLoan = {};
  for (const p of (penalties || [])) {
    totalChargedByLoan[p.loan_id] = (totalChargedByLoan[p.loan_id] || 0) + (parseFloat(p.penalty_amount) || 0);
  }
  for (const t of (walletTxns || [])) {
    // Only count wallet txns if they aren't already in penalty_charges to avoid double-counting
    // (Existing system might have migration legacy)
    if (!penalties?.find(p => p.loan_id === t.loan_id && p.penalty_amount === Math.abs(t.amount))) {
       // totalChargedByLoan[t.loan_id] = (totalChargedByLoan[t.loan_id] || 0) + Math.abs(t.amount);
    }
  }

  const results = [];

  for (const loan of loans) {
    const dates = getInstallmentDates(loan.release_date, loan.num_installments || 4);
    const nextDue = dates[loan.payments_made];
    if (!nextDue) continue;

    nextDue.setHours(0, 0, 0, 0);
    const daysLate = Math.floor((today - nextDue) / (1000 * 60 * 60 * 24));

    if (daysLate <= 0) continue;

    const expectedTotal = daysLate * 20;
    const alreadyCharged = totalChargedByLoan[loan.id] || 0;
    const penaltyToCharge = expectedTotal - alreadyCharged;

    if (penaltyToCharge > 0) {
      console.log(`[RESCUE] Loan ${loan.id} (${loan.borrowers?.full_name}):`);
      console.log(`   - Status: ${loan.status} | Late: ${daysLate} days`);
      console.log(`   - Expected: ₱${expectedTotal} | Charged: ₱${alreadyCharged} | TO CHARGE: ₱${penaltyToCharge}`);
      
      const currentHold = Number(loan.security_hold || 0);
      const holdDeduct = Math.min(currentHold, penaltyToCharge);
      const newHold = currentHold - holdDeduct;
      
      console.log(`   - Hold Change: ₱${currentHold} → ₱${newHold}`);
      
      if (!isDryRun) {
        // Execute Update
        const { error: updErr } = await supabase.from('loans').update({ security_hold: newHold, status: 'Overdue' }).eq('id', loan.id);
        if (updErr) console.error(`   ❌ Failed to update loan:`, updErr.message);
        
        // Insert Penalty Record
        await supabase.from('penalty_charges').insert({
          loan_id: loan.id,
          borrower_id: loan.borrower_id,
          penalty_amount: penaltyToCharge,
          days_late: daysLate,
          charged_date: todayStr,
          description: `Rescue sync for Day ${daysLate} overdue`
        });

        // Audit Log
        await supabase.from('audit_logs').insert({
          action_type: 'PENALTY_CHARGED',
          module: 'Loan',
          description: `Manual rescue sync: ₱${penaltyToCharge} charged (Day ${daysLate}). Hold: ${currentHold}→${newHold}.`,
          changed_by: 'system-rescue',
          reference_id: loan.id
        });
      }
    }
  }
}

const dryRun = process.argv.includes('--execute') ? false : true;
syncPenalties(dryRun).then(() => console.log('Done.'));
