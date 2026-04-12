const { createClient } = require('@supabase/supabase-client')
require('dotenv').config()

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://swwedyfgbqhtavxmbmhv.supabase.co'
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY 

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkLoans() {
  const { data: borrowers, error: bErr } = await supabase
    .from('borrowers')
    .select('id, full_name')
    .or('full_name.ilike.%Mary Edelyn%,full_name.ilike.%Ria Durang%')

  if (bErr) {
    console.error('Borrower error:', bErr)
    return
  }

  console.log('Found borrowers:', borrowers)

  for (const b of borrowers) {
    const { data: loans, error: lErr } = await supabase
      .from('loans')
      .select('*')
      .eq('borrower_id', b.id)
    
    console.log(`Loans for ${b.full_name}:`, loans)
  }
}

checkLoans()
