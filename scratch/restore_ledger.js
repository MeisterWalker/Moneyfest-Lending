const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://swwedyfgbqhtavxmbmhv.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3d2VkeWZnYnFodGF2eG1ibWh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNzY2MDEsImV4cCI6MjA4ODY1MjYwMX0.IFVKtSVFmNytOYMD23yFXgEyGyBNVQ31SknoxpGvuio";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const auditedEntries = [
  { entry_date: '2024-01-01', type: 'CASH IN', category: 'Initial Pool (Installment)', amount: 35000, notes: 'Audited Initial Pool Split' },
  { entry_date: '2024-01-01', type: 'CASH IN', category: 'Initial Pool (QuickLoan)', amount: 9000, notes: 'Audited Initial Pool Split' },
  { entry_date: '2026-04-05', type: 'CASH IN', category: 'Capital Top-up (JP)', amount: 200, notes: 'Top-up for loan release correction' },
  { entry_date: '2026-04-05', type: 'CASH IN', category: 'Capital Top-up (Charlou)', amount: 3525, notes: 'Reconciled Top-up for April Expansion' },
  { entry_date: '2026-04-05', type: 'CASH IN', category: 'Interest Profit (Installment)', amount: 1175, notes: 'Audited cumulative profit' },
  { entry_date: '2026-04-11', type: 'CASH IN', category: 'Interest Profit (QuickLoan)', amount: 600, notes: 'Admin verification: Urgel Profit (100) + Extensions (500)' }
];

async function restoreLedger() {
  console.log("🚀 Starting Surgical Ledger Restoration...");
  
  // 1. Wipe existing entries
  console.log("🧹 Wiping current capital_flow table...");
  const { error: deleteError } = await supabase.from('capital_flow').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  
  if (deleteError) {
    console.error("❌ Failed to wipe table:", deleteError);
    return;
  }
  
  console.log("✅ Table wiped.");

  // 2. Insert audited entries
  console.log("📥 Inserting audited entries...");
  const { error: insertError } = await supabase.from('capital_flow').insert(auditedEntries);
  
  if (insertError) {
    console.error("❌ Failed to insert audited data:", insertError);
    return;
  }
  
  console.log("✅ Audited state restored successfully!");
  console.log("💰 Total Audited Value: ₱49,500.00");
}

restoreLedger();
