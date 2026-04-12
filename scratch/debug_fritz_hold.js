const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://swwedyfgbqhtavxmbmhv.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3d2VkeWZnYnFodGF2eG1ibWh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNzY2MDEsImV4cCI6MjA4ODY1MjYwMX0.IFVKtSVFmNytOYMD23yFXgEyGyBNVQ31SknoxpGvuio'

const supabase = createClient(supabaseUrl, supabaseKey)

async function debugFritzHold() {
  console.log('--- Debugging Fritz Quintero Security Hold ---')

  const { data: loan, error } = await supabase
    .from('loans')
    .select('*, borrowers(full_name, credit_score)')
    .ilike('borrowers.full_name', '%Fritz%')
    .eq('status', 'Overdue')
    .single()

  if (error || !loan) {
    console.error('Error fetching Fritz loan:', error || 'Not found')
    return
  }

  console.log(`Loan ID: ${loan.id}`)
  console.log(`Borrower: ${loan.borrowers.full_name}`)
  console.log(`Credit Score: ${loan.borrowers.credit_score}`)
  console.log(`Security Hold (DB Value): ${loan.security_hold}`)
  console.log(`Security Hold Returned: ${loan.security_hold_returned}`)
  console.log(`Release Date: ${loan.release_date}`)

  // Check penalties
  const { data: penalties } = await supabase
    .from('penalty_charges')
    .select('*')
    .eq('loan_id', loan.id)

  console.log(`\nFound ${penalties?.length || 0} penalty entries:`)
  penalties?.forEach(p => {
    console.log(`- Amount: ${p.penalty_amount} | Date: ${p.created_at}`)
  })
}

debugFritzHold()
