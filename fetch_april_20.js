require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

async function calculateApril20() {
  // Fetch all pending installments due on April 20, 2026
  const { data: installments, error } = await supabase
    .from('installments')
    .select(`
      id,
      amount_due,
      loans (
        id,
        loan_amount,
        total_repayment,
        status
      )
    `)
    .eq('due_date', '2026-04-20')
    .eq('is_paid', false);

  if (error) {
    console.error('Error fetching installments:', error);
    return;
  }

  let totalCollected = 0;
  let totalPrincipal = 0;
  let totalInterest = 0;
  let loanCount = new Set();

  for (const inst of installments) {
    if (!inst.loans) continue;
    loanCount.add(inst.loans.id);
    const loan = inst.loans;
    
    // Total interest on the loan
    const loanTotalInterest = (loan.total_repayment || 0) - (loan.loan_amount || 0);
    
    // We need to know how many installments the loan has to split the interest
    // Alternatively, we can fetch the count
    const { count } = await supabase
      .from('installments')
      .select('*', { count: 'exact', head: true })
      .eq('loan_id', loan.id);
      
    const numInstallments = count || 1;
    let interestPerInstallment = loanTotalInterest / numInstallments;
    let principalPerInstallment = inst.amount_due - interestPerInstallment;
    
    if (principalPerInstallment < 0) {
       // fallback for Edge Cases
       principalPerInstallment = 0;
       interestPerInstallment = inst.amount_due;
    }

    totalCollected += inst.amount_due;
    totalPrincipal += principalPerInstallment;
    totalInterest += interestPerInstallment;
  }

  console.log(`--- APRIL 20 EXPECTED COLLECTIONS ---`);
  console.log(`Number of Loans: ${loanCount.size}`);
  console.log(`Total Amount Due (Expected Cash In): ₱${totalCollected.toFixed(2)}`);
  console.log(`To Capital Rotation Vault (Principal): ₱${totalPrincipal.toFixed(2)}`);
  console.log(`To True Profit (Interest): ₱${totalInterest.toFixed(2)}`);
}

calculateApril20();
