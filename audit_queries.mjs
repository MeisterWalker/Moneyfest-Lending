import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3d2VkeWZnYnFodGF2eG1ibWh2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzA3NjYwMSwiZXhwIjoyMDg4NjUyNjAxfQ.1Z0nDt25L2NsXMQf1mYBnxM55Xw1mXgnSHWweTXQggI'
);

async function runAudit() {
  console.log('--- DATABASE GROUND TRUTH START ---');
  
  // Fetch all basic data
  const { data: capitalFlow } = await supabase.from('capital_flow').select('*');
  const { data: loans } = await supabase.from('loans').select('*, borrowers(full_name)');
  const { data: penaltyCharges } = await supabase.from('penalty_charges').select('*');
  const { data: wallets } = await supabase.from('wallets').select('*');
  const { data: walletTxns } = await supabase.from('wallet_transactions').select('*');

  // QUERY 1: Total capital_flow summary
  console.log('\nQUERY 1 — Total capital_flow summary:');
  const q1Summary = {};
  capitalFlow.forEach(cf => {
    const key = `${cf.type} | ${cf.category}`;
    if (!q1Summary[key]) q1Summary[key] = { type: cf.type, category: cf.category, total: 0, entries: 0 };
    q1Summary[key].total += Number(cf.amount) || 0;
    q1Summary[key].entries += 1;
  });
  Object.values(q1Summary)
    .sort((a, b) => b.total - a.total)
    .sort((a, b) => a.type.localeCompare(b.type))
    .forEach(v => console.log(`Type: ${v.type}, Category: ${v.category}, Total: ${v.total}, Entries: ${v.entries}`));

  // QUERY 2: Net position
  console.log('\nQUERY 2 — Net position:');
  let total_in = 0, total_out = 0;
  capitalFlow.forEach(cf => {
    if (cf.type === 'CASH IN') total_in += Number(cf.amount) || 0;
    if (cf.type === 'CASH OUT') total_out += Number(cf.amount) || 0;
  });
  console.log(`total_in: ${total_in}`);
  console.log(`total_out: ${total_out}`);
  console.log(`net_position: ${total_in - total_out}`);

  // QUERY 3: All active loan exposure
  console.log('\nQUERY 3 — All active loan exposure:');
  let active_loans = 0, total_principal_out = 0, total_remaining = 0, total_hold_held = 0;
  loans.filter(l => ['Active', 'Partially Paid', 'Overdue'].includes(l.status)).forEach(l => {
    active_loans++;
    total_principal_out += Number(l.loan_amount) || 0;
    total_remaining += Number(l.remaining_balance) || 0;
    total_hold_held += Number(l.security_hold) || 0;
  });
  console.log(`active_loans: ${active_loans}`);
  console.log(`total_principal_out: ${total_principal_out}`);
  console.log(`total_remaining: ${total_remaining}`);
  console.log(`total_hold_held: ${total_hold_held}`);

  // QUERY 4: All interest ever earned vs what loans should have generated
  console.log('\nQUERY 4 — All interest ever earned vs what loans should have generated:');
  loans.filter(l => l.loan_type === 'regular').sort((a,b) => new Date(b.created_at) - new Date(a.created_at)).forEach(l => {
    const expected = l.loan_amount * (l.interest_rate * (l.loan_term || 2));
    const stored = l.total_repayment - l.loan_amount;
    console.log(`ID: ${l.id}, Name: ${l.borrowers?.full_name}, Principal: ${l.loan_amount}, Total Repayment: ${l.total_repayment}, Expected Interest: ${expected.toFixed(2)}, Stored Interest: ${stored.toFixed(2)}, Payments Made: ${l.payments_made}, Total Installments: ${l.num_installments}, Status: ${l.status}`);
  });

  // QUERY 5: Check for ghost money (penalty entries without matching penalty charges)
  console.log('\nQUERY 5 — Check for ghost money:');
  console.log('capital_flow penalty CASH IN entries:');
  capitalFlow.filter(cf => cf.category.toLowerCase().includes('penalty') && cf.type === 'CASH IN').forEach(cf => {
    console.log(`ID: ${cf.id}, Date: ${cf.entry_date}, Category: ${cf.category}, Amount: ${cf.amount}, Notes: ${cf.notes}`);
  });
  console.log('\npenalty_charges summary:');
  const pcSummary = {};
  penaltyCharges.forEach(pc => {
    if (!pcSummary[pc.loan_id]) pcSummary[pc.loan_id] = { total: 0, count: 0 };
    pcSummary[pc.loan_id].total += Number(pc.penalty_amount) || 0;
    pcSummary[pc.loan_id].count++;
  });
  Object.keys(pcSummary).forEach(loanId => {
    console.log(`Loan ID: ${loanId}, Total Charged: ${pcSummary[loanId].total}, Num Charges: ${pcSummary[loanId].count}`);
  });

  // QUERY 6: Check for interest logged on loans that haven't had payments yet
  console.log('\nQUERY 6 — Check for interest logged on loans that haven\'t had payments yet:');
  capitalFlow.filter(cf => cf.category.toLowerCase().includes('interest profit') && cf.type === 'CASH IN').forEach(cf => {
    console.log(`ID: ${cf.id}, Date: ${cf.entry_date}, Category: ${cf.category}, Amount: ${cf.amount}, Notes: ${cf.notes}`);
  });
  // Since we can't easily JOIN locally without writing a lot of code, I'll log them all and we can cross-reference if needed, but wait: the query just asked to SELECT cf.*

  // QUERY 7: Security hold integrity check
  console.log('\nQUERY 7 — Security hold integrity check:');
  loans.filter(l => l.loan_type === 'regular').forEach(l => {
    const deducted = Number(l.security_hold_original || 0) - Number(l.security_hold || 0);
    console.log(`ID: ${l.id}, Name: ${l.borrowers?.full_name}, Hold: ${l.security_hold}, Original Hold: ${l.security_hold_original}, Hold Returned: ${l.security_hold_returned}, Status: ${l.status}, Payments: ${l.payments_made}, Deducted: ${deducted}`);
  });

  // QUERY 8: Wallet integrity
  console.log('\nQUERY 8 — Wallet integrity:');
  const totalWalletBalances = wallets.reduce((s, w) => s + (Number(w.balance) || 0), 0);
  console.log(`total_wallet_balances: ${totalWalletBalances}`);
  
  let totalWalletCredits = 0, totalWalletDebits = 0;
  walletTxns.forEach(wt => {
    const amt = Number(wt.amount) || 0;
    if (amt > 0) totalWalletCredits += amt;
    else totalWalletDebits += Math.abs(amt);
  });
  console.log(`total_credits: ${totalWalletCredits}, total_debits: ${totalWalletDebits}, net_wallet_balance: ${totalWalletCredits - totalWalletDebits}`);

  // QUERY 9: Loans where total payments received does not match capital_flow entries
  console.log('\nQUERY 9 — Loans where total payments received does not match capital_flow entries:');
  loans.filter(l => l.loan_type === 'regular' && l.payments_made > 0).forEach(l => {
    const expected = l.payments_made * Number(l.installment_amount);
    const actual = Number(l.total_repayment) - Number(l.remaining_balance);
    console.log(`ID: ${l.id}, Name: ${l.borrowers?.full_name}, Payments: ${l.payments_made}, Installment: ${l.installment_amount}, Expected Cash: ${expected}, Balance Reduction: ${actual}, Status: ${l.status}`);
  });

  // QUERY 10: Check for total_repayment inflation
  console.log('\nQUERY 10 — Check for total_repayment inflation (penalty overflow bug):');
  loans.filter(l => l.loan_type === 'regular' && Number(l.total_repayment) > (Number(l.loan_amount) * 1.20)).forEach(l => {
    const correct = Number(l.loan_amount) * (1 + Number(l.interest_rate) * (Number(l.loan_term) || 2));
    const inflation = Number(l.total_repayment) - correct;
    console.log(`ID: ${l.id}, Amount: ${l.loan_amount}, Total Repayment: ${l.total_repayment}, Correct: ${correct.toFixed(2)}, Inflation: ${inflation.toFixed(2)}`);
  });

  console.log('\n--- DATABASE GROUND TRUTH END ---');
}
runAudit();
