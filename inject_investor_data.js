/**
 * Moneyfest Lending — Investor Data Injection Script
 * Run with: node inject_investor_data.js
 * 
 * This script:
 * 1. Creates a sample investor (Julie Pertino, Premium Partner)
 * 2. Creates 3 sample borrowers
 * 3. Creates 3 installment loans pre-assigned to the investor
 */

const SUPABASE_URL = 'https://swwedyfgbqhtavxmbmhv.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3d2VkeWZnYnFodGF2eG1ibWh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNzY2MDEsImV4cCI6MjA4ODY1MjYwMX0.IFVKtSVFmNytOYMD23yFXgEyGyBNVQ31SknoxpGvuio'

const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
}

async function api(method, table, body, queryParams = '') {
  const url = `${SUPABASE_URL}/rest/v1/${table}${queryParams ? '?' + queryParams : ''}`
  const opts = { method, headers }
  if (body) opts.body = JSON.stringify(body)
  const res = await fetch(url, opts)
  const text = await res.text()
  if (!res.ok) {
    console.error(`❌ ${method} ${table} failed:`, res.status, text)
    throw new Error(`API error: ${res.status}`)
  }
  return text ? JSON.parse(text) : null
}

async function main() {
  console.log('🚀 Starting Moneyfest Investor Data Injection...\n')

  // ─── Step 1: Create Investor ───────────────────────────────────
  console.log('📌 Step 1: Creating investor...')
  
  // First check if investor already exists
  const existingRes = await fetch(`${SUPABASE_URL}/rest/v1/investors?access_code=eq.MF-X004&select=id`, { headers })
  const existing = await existingRes.json()
  
  let investorId
  
  if (existing && existing.length > 0) {
    investorId = existing[0].id
    console.log(`   ✅ Investor already exists (ID: ${investorId}), skipping creation`)
  } else {
    const [investor] = await api('POST', 'investors', {
      full_name: 'Julie Pertino',
      email: 'julie.pertino@moneyfest.ph',
      access_code: 'MF-X004',
      tier: 'Premium',
      total_capital: 20000,
      auto_reinvest: true,
      signed_at: new Date().toISOString(),
    })
    investorId = investor.id
    console.log(`   ✅ Investor created: Julie Pertino (ID: ${investorId})`)
  }

  // ─── Step 2: Create Sample Borrowers ───────────────────────────
  console.log('\n📌 Step 2: Creating sample borrowers...')
  
  const borrowerData = [
    { full_name: 'Maria Carmen Santos', department: 'Minto Money', building: 'Epic', credit_score: 800, risk_score: 'Low', loyalty_badge: 'Trusted', loan_limit: 7000, loan_limit_level: 2, access_code: 'DEMO-MCS' },
    { full_name: 'Jose Emmanuel Reyes', department: 'Credit Serve', building: 'Ng Khai', credit_score: 775, risk_score: 'Low', loyalty_badge: 'Trusted', loan_limit: 7000, loan_limit_level: 2, access_code: 'DEMO-JER' },
    { full_name: 'Ana Patricia Cruz', department: 'Essential Lending', building: 'Epic', credit_score: 825, risk_score: 'Low', loyalty_badge: 'Reliable', loan_limit: 9000, loan_limit_level: 3, access_code: 'DEMO-APC' },
  ]

  const borrowerIds = []
  for (const bd of borrowerData) {
    // Check if exists
    const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/borrowers?access_code=eq.${bd.access_code}&select=id`, { headers })
    const checkData = await checkRes.json()
    
    if (checkData && checkData.length > 0) {
      borrowerIds.push(checkData[0].id)
      console.log(`   ✅ ${bd.full_name} already exists (ID: ${checkData[0].id})`)
    } else {
      const [created] = await api('POST', 'borrowers', bd)
      borrowerIds.push(created.id)
      console.log(`   ✅ Created: ${bd.full_name} (ID: ${created.id})`)
    }
  }

  // ─── Step 3: Create Installment Loans ──────────────────────────
  console.log('\n📌 Step 3: Creating installment loans assigned to investor...')
  
  const loanData = [
    {
      borrower_id: borrowerIds[0],
      loan_amount: 8000,
      interest_rate: 0.07,
      loan_term: 2,
      num_installments: 4,
      total_repayment: 9120,   // 8000 * (1 + 0.07*2) = 9120
      installment_amount: 2280, // 9120 / 4
      release_date: '2026-03-15',
      payments_made: 1,
      remaining_balance: 6840,  // 9120 - 2280
      status: 'Partially Paid',
      loan_type: 'regular',
      loan_purpose: 'Home renovation and repairs',
      investor_id: investorId,
      security_hold: 800,
      funds_released: 7200,
      security_hold_returned: false,
      agreement_confirmed: true,
      e_signature_name: 'Maria Carmen Santos',
      e_signature_date: '2026-03-14T10:00:00.000Z',
      notes: 'Assigned to investor portfolio',
    },
    {
      borrower_id: borrowerIds[1],
      loan_amount: 5000,
      interest_rate: 0.07,
      loan_term: 2,
      num_installments: 4,
      total_repayment: 5700,   // 5000 * (1 + 0.07*2) = 5700
      installment_amount: 1425, // 5700 / 4
      release_date: '2026-03-20',
      payments_made: 0,
      remaining_balance: 5700,
      status: 'Active',
      loan_type: 'regular',
      loan_purpose: 'Emergency medical expenses',
      investor_id: investorId,
      security_hold: 500,
      funds_released: 4500,
      security_hold_returned: false,
      agreement_confirmed: true,
      e_signature_name: 'Jose Emmanuel Reyes',
      e_signature_date: '2026-03-19T14:00:00.000Z',
      notes: 'Assigned to investor portfolio',
    },
    {
      borrower_id: borrowerIds[2],
      loan_amount: 7000,
      interest_rate: 0.07,
      loan_term: 2,
      num_installments: 4,
      total_repayment: 7980,   // 7000 * (1 + 0.07*2) = 7980
      installment_amount: 1995, // 7980 / 4
      release_date: '2026-03-10',
      payments_made: 2,
      remaining_balance: 3990,  // 7980 - (1995*2)
      status: 'Partially Paid',
      loan_type: 'regular',
      loan_purpose: 'Child tuition and school fees',
      investor_id: investorId,
      security_hold: 700,
      funds_released: 6300,
      security_hold_returned: false,
      agreement_confirmed: true,
      e_signature_name: 'Ana Patricia Cruz',
      e_signature_date: '2026-03-09T09:00:00.000Z',
      notes: 'Assigned to investor portfolio',
    },
  ]

  for (const ld of loanData) {
    // Check if a loan already exists for this borrower+investor combo
    const checkRes = await fetch(
      `${SUPABASE_URL}/rest/v1/loans?borrower_id=eq.${ld.borrower_id}&investor_id=eq.${investorId}&select=id`,
      { headers }
    )
    const checkData = await checkRes.json()
    
    if (checkData && checkData.length > 0) {
      console.log(`   ✅ Loan for borrower ${ld.borrower_id} already exists, skipping`)
    } else {
      const [created] = await api('POST', 'loans', ld)
      console.log(`   ✅ Created loan: ₱${ld.loan_amount.toLocaleString()} → ${ld.e_signature_name} (ID: ${created.id})`)
    }
  }

  // ─── Step 4: Verify ────────────────────────────────────────────
  console.log('\n📌 Step 4: Verifying data...')
  
  const verifyInvestor = await fetch(`${SUPABASE_URL}/rest/v1/investors?select=id,full_name,tier,total_capital,access_code`, { headers })
  const investors = await verifyInvestor.json()
  console.log(`   Investors: ${investors.length}`)
  investors.forEach(i => console.log(`     → ${i.full_name} (${i.tier}, ₱${i.total_capital}, Code: ${i.access_code})`))

  const verifyLoans = await fetch(
    `${SUPABASE_URL}/rest/v1/loans?investor_id=eq.${investorId}&select=id,loan_amount,status,borrowers(full_name)`,
    { headers }
  )
  const investorLoans = await verifyLoans.json()
  console.log(`   Investor-linked loans: ${investorLoans.length}`)
  investorLoans.forEach(l => console.log(`     → ₱${l.loan_amount} · ${l.status} · ${l.borrowers?.full_name || '?'}`))

  console.log('\n✅ All done! The investor dashboard should now show live data.')
  console.log('   Login code: MF-X004')
  console.log('   Total capital deployed: ₱' + loanData.reduce((s, l) => s + l.loan_amount, 0).toLocaleString())
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err)
  process.exit(1)
})
