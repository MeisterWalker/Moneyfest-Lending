const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://swwedyfgbqhtavxmbmhv.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3d2VkeWZnYnFodGF2eG1ibWh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNzY2MDEsImV4cCI6MjA4ODY1MjYwMX0.IFVKtSVFmNytOYMD23yFXgEyGyBNVQ31SknoxpGvuio'

const supabase = createClient(supabaseUrl, supabaseKey)

async function investigateSheena() {
  console.log('--- Investigating Sheena Urgel Transaction History ---')

  // Find the borrower ID first
  const { data: borrowers } = await supabase
    .from('borrowers')
    .select('id, full_name')
    .ilike('full_name', '%Sheena%')

  if (!borrowers || borrowers.length === 0) {
    console.log('No borrower found matching Sheena.')
    return
  }

  const bId = borrowers[0].id
  console.log(`Found Borrower: ${borrowers[0].full_name} (ID: ${bId})`)

  // Check all loans for this borrower (including Paid ones)
  const { data: loans } = await supabase
    .from('loans')
    .select('*')
    .eq('borrower_id', bId)
    .order('created_at', { ascending: false })

  console.log(`\nFound ${loans.length} total loans for Sheena:`)
  loans.forEach(l => {
    console.log(`- ${l.status} | ${l.loan_amount} | Released: ${l.release_date} | Total Repayment: ${l.total_repayment}`)
  })

  // Check audit logs for payment mentions
  const { data: logs } = await supabase
    .from('audit_logs')
    .select('*')
    .ilike('description', '%Sheena%')
    .order('created_at', { ascending: false })

  console.log(`\nFound ${logs?.length || 0} audit log entries:`)
  logs?.forEach(log => {
    console.log(`[${log.created_at}] ${log.action_type}: ${log.description}`)
  })
}

investigateSheena()
