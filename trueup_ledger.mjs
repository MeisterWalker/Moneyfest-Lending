import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://swwedyfgbqhtavxmbmhv.supabase.co';
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'sb_publishable_V0lMalSTF9sgeK3WHG5UIw_qbEXx9Su';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Fetching all released loans...");
  
  // 1. Fetch all borrowers to map names
  const { data: borrowers } = await supabase.from('borrowers').select('id, full_name');
  const bMap = {};
  if (borrowers) {
    borrowers.forEach(b => bMap[b.id] = b.full_name);
  }

  // 2. Fetch all loans that are ALREADY released
  const { data: loans, error } = await supabase
    .from('loans')
    .select('*')
    .in('status', ['Active', 'Partially Paid', 'Paid', 'Defaulted']);

  if (error) {
    console.error("Error fetching loans:", error);
    return;
  }

  console.log(`Found ${loans.length} historically released loans.`);

  // 3. Fetch all existing CASH OUT elements in capital_flow to avoid duplicates
  const { data: flows } = await supabase
    .from('capital_flow')
    .select('*')
    .eq('type', 'CASH OUT')
    .eq('category', 'Loan Disbursed');

  // We consider an entry a duplicate if it matches the approximate amount and date.
  const existingNotes = flows ? flows.map(f => f.notes && f.notes.toLowerCase()) : [];
  
  let insertedCount = 0;
  let skippedCount = 0;

  for (const loan of loans) {
    const bName = bMap[loan.borrower_id] || 'Unknown';
    const amountReleased = loan.funds_released || (loan.loan_amount - (loan.security_hold || 0));
    const releaseDate = loan.release_date || new Date(loan.created_at).toISOString().slice(0, 10);
    
    // Check if we already logged this one
    // e.g. "Loan Disbursed — John Paul"
    const alreadyExists = existingNotes.some(note => note && note.includes(bName.toLowerCase()) && note.includes('disbursed'));

    if (alreadyExists) {
      console.log(`[SKIPPED] ${bName} (₱${amountReleased}) - Already exists in ledger.`);
      skippedCount++;
      continue;
    }

    // Insert missing Cash Out
    console.log(`[INSERTING] ${bName} (₱${amountReleased}) on ${releaseDate}...`);
    const { error: insErr } = await supabase.from('capital_flow').insert({
      entry_date: releaseDate,
      type: 'CASH OUT',
      category: 'Loan Disbursed',
      amount: amountReleased,
      notes: `Loan Disbursed (Historical True-up) — ${bName} (${loan.loan_type === 'quickloan' ? 'QuickLoan' : 'Installment'})`
    });

    if (insErr) {
      console.error(`Failed to insert for ${bName}:`, insErr);
    } else {
      insertedCount++;
    }
  }

  console.log(`\n✅ Done! Successfully inserted ${insertedCount} missing Cash Out entries. Skipped ${skippedCount}.`);
}

run();
