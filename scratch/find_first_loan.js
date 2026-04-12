const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://swwedyfgbqhtavxmbmhv.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3d2VkeWZnYnFodGF2eG1ibWh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNzY2MDEsImV4cCI6MjA4ODY1MjYwMX0.IFVKtSVFmNytOYMD23yFXgEyGyBNVQ31SknoxpGvuio'

const supabase = createClient(supabaseUrl, supabaseKey)

async function findFirstLoan() {
  console.log('--- Finding the First Ever Loan Release ---')

  const { data: loans, error } = await supabase
    .from('loans')
    .select('*, borrowers(full_name)')
    .order('release_date', { ascending: true })
    .limit(5)

  if (error) {
    console.error('Error fetching loans:', error)
    return
  }

  console.log('First 5 loans released:')
  loans.forEach(l => {
    console.log(`- Borrower: ${l.borrowers?.full_name} | Released: ${l.release_date} | Principal: ${l.loan_amount} | Status: ${l.status}`)
  })
}

findFirstLoan()
