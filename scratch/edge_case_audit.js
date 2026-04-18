const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://swwedyfgbqhtavxmbmhv.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function audit() {
  console.log('--- Edge Case Audit ---');
  
  // 1. Potential Overcharges (Wallet Txns vs Penalty Charges)
  const { data: wTxns } = await supabase.from('wallet_transactions').select('loan_id').eq('type', 'penalty_deduction');
  const { data: pCharges } = await supabase.from('penalty_charges').select('loan_id');
  
  const wIds = new Set((wTxns || []).map(t => t.loan_id));
  const pIds = new Set((pCharges || []).map(c => c.loan_id));
  const orphans = [...wIds].filter(id => !pIds.has(id));
  
  console.log('1. Orphans in Wallet (Potential Overcharge):', orphans.length);
  if (orphans.length > 0) {
    console.log('   Orphaned Loan IDs:', orphans);
  }

  // 2. Overflow Penalties (Hold hit zero)
  const { data: overflowCheck } = await supabase
    .from('loans')
    .select('id, security_hold, remaining_balance, total_repayment, loan_amount')
    .eq('status', 'Overdue')
    .eq('security_hold', 0);
  
  console.log('2. Loans with 0 Hold (Potential Undercharge in Balance):', overflowCheck.length);
  if (overflowCheck.length > 0) {
    console.log('   Exhausted Loans:', JSON.stringify(overflowCheck, null, 2));
  }
}

audit();
