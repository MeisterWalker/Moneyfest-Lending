const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://swwedyfgbqhtavxmbmhv.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3d2VkeWZnYnFodGF2eG1ibWh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNzY2MDEsImV4cCI6MjA4ODY1MjYwMX0.IFVKtSVFmNytOYMD23yFXgEyGyBNVQ31SknoxpGvuio'

const supabase = createClient(supabaseUrl, supabaseKey)

async function fixData() {
  console.log('--- Starting Capital Ledger Fix ---')

  // 1. Delete the incorrect 5k entry
  const { error: delErr } = await supabase
    .from('capital_flow')
    .delete()
    .eq('category', 'Interest Profit')
    .eq('amount', 5000)

  if (delErr) {
    console.error('Error deleting wrong entry:', delErr)
  } else {
    console.log('✓ Successfully removed incorrect ₱5,000 profit entry.')
  }

  // 2. Insert the correct Interest Profit (Apr 5)
  const { error: ins1Err } = await supabase
    .from('capital_flow')
    .insert({
      entry_date: '2026-04-05',
      type: 'CASH IN',
      category: 'Interest Profit',
      amount: 1225.00,
      notes: 'Audited Interest Profit from April 5th Collection'
    })

  if (ins1Err) {
    console.error('Error inserting profit:', ins1Err)
  } else {
    console.log('✓ Successfully added corrected ₱1,225 interest profit.')
  }

  // 3. Insert the Charlou Top-up (to reconcile 49k total)
  const { error: ins2Err } = await supabase
    .from('capital_flow')
    .insert({
      entry_date: '2026-04-05',
      type: 'CASH IN',
      category: 'Capital Top-up (Charlou)',
      amount: 3775.00,
      notes: 'Reconciled Capital Top-up to match current ₱49k system total'
    })

  if (ins2Err) {
    console.error('Error inserting top-up:', ins2Err)
  } else {
    console.log('✓ Successfully added ₱3,775 top-up from Charlou.')
  }

  console.log('--- Fix Complete! ---')
}

fixData()
