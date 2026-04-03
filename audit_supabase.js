/**
 * Moneyfest Lending — Supabase Diagnostic Audit
 * Run with: node audit_supabase.js
 */

const SUPABASE_URL = 'https://swwedyfgbqhtavxmbmhv.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3d2VkeWZnYnFodGF2eG1ibWh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNzY2MDEsImV4cCI6MjA4ODY1MjYwMX0.IFVKtSVFmNytOYMD23yFXgEyGyBNVQ31SknoxpGvuio'

const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
}

async function query(table, params = '') {
  const url = `${SUPABASE_URL}/rest/v1/${table}${params ? '?' + params : ''}`
  const res = await fetch(url, { headers })
  if (!res.ok) {
    const text = await res.text()
    console.error(`  ❌ Failed to query ${table}: ${res.status} ${text}`)
    return null
  }
  return res.json()
}

async function main() {
  console.log('═══════════════════════════════════════════════════════')
  console.log('   MONEYFEST LENDING — SUPABASE DIAGNOSTIC AUDIT')
  console.log('═══════════════════════════════════════════════════════\n')

  // ─── 1. Investors ──────────────────────────────────────────────
  console.log('📊 INVESTORS TABLE')
  console.log('─'.repeat(55))
  const investors = await query('investors', 'select=*&order=created_at.asc')
  if (!investors || investors.length === 0) {
    console.log('  ⚠️  No investors found!')
  } else {
    console.log(`  Total investors: ${investors.length}\n`)
    investors.forEach(i => {
      console.log(`  👤 ${i.full_name}`)
      console.log(`     Tier: ${i.tier} | Capital: ₱${Number(i.total_capital).toLocaleString()}`)
      console.log(`     Code: ${i.access_code} | Auto-reinvest: ${i.auto_reinvest}`)
      console.log(`     Signed: ${i.signed_at ? '✅ ' + new Date(i.signed_at).toLocaleDateString() : '❌ Not signed'}`)
      console.log(`     Created: ${new Date(i.created_at).toLocaleDateString()}`)
      console.log('')
    })
  }

  // ─── 2. Borrowers ─────────────────────────────────────────────
  console.log('\n📊 BORROWERS TABLE')
  console.log('─'.repeat(55))
  const borrowers = await query('borrowers', 'select=*&order=created_at.asc')
  if (!borrowers || borrowers.length === 0) {
    console.log('  ⚠️  No borrowers found!')
  } else {
    console.log(`  Total borrowers: ${borrowers.length}\n`)
    borrowers.forEach(b => {
      console.log(`  👤 ${b.full_name}`)
      console.log(`     Dept: ${b.department || b.department_id || '—'} | Credit: ${b.credit_score} | Risk: ${b.risk_score}`)
      console.log(`     Badge: ${b.loyalty_badge} | Loan Limit: ₱${Number(b.loan_limit).toLocaleString()} (L${b.loan_limit_level})`)
      console.log(`     Code: ${b.access_code || '—'}`)
      console.log('')
    })
  }

  // ─── 3. Loans ──────────────────────────────────────────────────
  console.log('\n📊 LOANS TABLE')
  console.log('─'.repeat(55))
  const loans = await query('loans', 'select=*,borrowers(full_name,department)&order=created_at.desc')
  if (!loans || loans.length === 0) {
    console.log('  ⚠️  No loans found!')
  } else {
    console.log(`  Total loans: ${loans.length}\n`)
    
    const statusCounts = {}
    let totalDeployed = 0
    let totalWithInvestor = 0
    
    loans.forEach(l => {
      statusCounts[l.status] = (statusCounts[l.status] || 0) + 1
      totalDeployed += Number(l.loan_amount)
      if (l.investor_id) totalWithInvestor++
      
      console.log(`  📄 Loan → ${l.borrowers?.full_name || '(no borrower linked)'}`)
      console.log(`     Amount: ₱${Number(l.loan_amount).toLocaleString()} | Status: ${l.status}`)
      console.log(`     Rate: ${(Number(l.interest_rate) * 100).toFixed(1)}% | Remaining: ₱${Number(l.remaining_balance || 0).toLocaleString()}`)
      console.log(`     Released: ${l.release_date} | Due: ${l.due_date}`)
      console.log(`     Investor-linked: ${l.investor_id ? '✅' : '❌'}`)
      console.log(`     Payments: ${l.payments_made || 0} | Type: ${l.loan_type || 'regular'}`)
      console.log(`     Created: ${new Date(l.created_at).toLocaleString()}`)
      console.log('')
    })
    
    console.log('  📈 LOAN SUMMARY')
    console.log('  ' + '─'.repeat(40))
    console.log(`  Total deployed: ₱${totalDeployed.toLocaleString()}`)
    console.log(`  Investor-linked: ${totalWithInvestor} / ${loans.length}`)
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`)
    })
  }

  // ─── 4. Investor-specific loan analysis ────────────────────────
  if (investors && investors.length > 0) {
    for (const inv of investors) {
      console.log(`\n\n📊 INVESTOR PORTFOLIO: ${inv.full_name} (${inv.tier})`)
      console.log('─'.repeat(55))
      
      const invLoans = loans ? loans.filter(l => l.investor_id === inv.id) : []
      const activeLoans = invLoans.filter(l => ['Active', 'Partially Paid', 'Overdue'].includes(l.status))
      const paidLoans = invLoans.filter(l => l.status === 'Paid')
      
      const activeCapital = activeLoans.reduce((s, l) => s + Number(l.loan_amount), 0)
      const tierRates = { 'Starter': 0.07, 'Standard': 0.08, 'Premium': 0.09 }
      const qRate = tierRates[inv.tier] || 0.08
      const dailyRate = qRate / 90
      const dailyProfit = activeCapital * dailyRate
      
      // Calculate overall accrual
      const now = new Date()
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      let overallAccrual = 0
      activeLoans.forEach(l => {
        const loanStart = new Date(l.created_at)
        const daysActive = Math.max(0, Math.floor((todayStart - loanStart) / 86400000))
        overallAccrual += Number(l.loan_amount) * dailyRate * daysActive
      })
      
      console.log(`  Total Capital: ₱${Number(inv.total_capital).toLocaleString()}`)
      console.log(`  Active Loans: ${activeLoans.length} (₱${activeCapital.toLocaleString()} deployed)`)
      console.log(`  Paid Loans: ${paidLoans.length}`)
      console.log(`  Quarterly Rate: ${(qRate * 100)}%`)
      console.log(`  Daily Rate: ${(dailyRate * 100).toFixed(4)}%`)
      console.log(`  Daily Profit: ₱${dailyProfit.toFixed(2)}`)
      console.log(`  Yesterday's Accrual: ₱${dailyProfit.toFixed(2)}`)
      console.log(`  Overall Accrued Interest: ₱${overallAccrual.toFixed(2)}`)
      console.log('')
      
      activeLoans.forEach(l => {
        const loanStart = new Date(l.created_at)
        const daysActive = Math.max(0, Math.floor((todayStart - loanStart) / 86400000))
        const loanAccrued = Number(l.loan_amount) * dailyRate * daysActive
        console.log(`  📌 ${l.borrowers?.full_name}: ₱${Number(l.loan_amount).toLocaleString()} × ${daysActive} days = ₱${loanAccrued.toFixed(2)} accrued`)
      })
    }
  }

  // ─── 5. Installments ──────────────────────────────────────────
  console.log('\n\n📊 INSTALLMENTS TABLE')
  console.log('─'.repeat(55))
  const installments = await query('installments', 'select=*,loans(borrower_id,borrowers(full_name))&order=due_date.asc')
  if (!installments || installments.length === 0) {
    console.log('  ⚠️  No installments found')
  } else {
    console.log(`  Total installments: ${installments.length}`)
    const paid = installments.filter(i => i.is_paid).length
    const unpaid = installments.length - paid
    console.log(`  Paid: ${paid} | Unpaid: ${unpaid}`)
  }

  // ─── 6. Payout requests ───────────────────────────────────────
  console.log('\n📊 INVESTOR PAYOUT REQUESTS')
  console.log('─'.repeat(55))
  const payouts = await query('investor_payout_requests', 'select=*&order=created_at.desc')
  if (!payouts || payouts.length === 0) {
    console.log('  No payout requests found')
  } else {
    console.log(`  Total requests: ${payouts.length}`)
    payouts.forEach(p => {
      console.log(`  💰 ₱${Number(p.requested_amount).toLocaleString()} via ${p.payout_method} — ${p.status}`)
    })
  }

  // ─── 7. Settings ───────────────────────────────────────────────
  console.log('\n📊 SETTINGS')
  console.log('─'.repeat(55))
  const settings = await query('settings', 'select=*')
  if (settings && settings.length > 0) {
    const s = settings[0]
    console.log(`  Starting Capital: ₱${Number(s.starting_capital).toLocaleString()}`)
    console.log(`  Interest Rate: ${(Number(s.interest_rate) * 100).toFixed(1)}%`)
    console.log(`  Max Loan Amount: ₱${Number(s.max_loan_amount).toLocaleString()}`)
    console.log(`  Reinvestment Mode: ${s.reinvestment_mode ? 'ON' : 'OFF'}`)
  }

  // ─── 8. Data Integrity Checks ─────────────────────────────────
  console.log('\n\n🔍 DATA INTEGRITY CHECKS')
  console.log('═'.repeat(55))
  
  let issues = 0
  
  // Check: loans with missing borrower_id
  if (loans) {
    const orphanLoans = loans.filter(l => !l.borrower_id)
    if (orphanLoans.length > 0) {
      console.log(`  ⚠️  ${orphanLoans.length} loan(s) missing borrower_id`)
      issues++
    }
  }
  
  // Check: investor capital vs deployed
  if (investors && loans) {
    for (const inv of investors) {
      const invLoans = loans.filter(l => l.investor_id === inv.id)
      const deployed = invLoans
        .filter(l => ['Active', 'Partially Paid', 'Overdue'].includes(l.status))
        .reduce((s, l) => s + Number(l.loan_amount), 0)
      if (deployed > Number(inv.total_capital)) {
        console.log(`  ⚠️  ${inv.full_name}: Deployed ₱${deployed.toLocaleString()} > Capital ₱${Number(inv.total_capital).toLocaleString()}`)
        issues++
      } else {
        console.log(`  ✅ ${inv.full_name}: Capital ₱${Number(inv.total_capital).toLocaleString()} ≥ Deployed ₱${deployed.toLocaleString()}`)
      }
    }
  }
  
  // Check: loans with future created_at
  if (loans) {
    const futureLoans = loans.filter(l => new Date(l.created_at) > new Date())
    if (futureLoans.length > 0) {
      console.log(`  ⚠️  ${futureLoans.length} loan(s) have future created_at dates`)
      issues++
    } else {
      console.log(`  ✅ All loan created_at dates are in the past`)
    }
  }
  
  // Check: Active loans with 0 remaining balance
  if (loans) {
    const zeroBalance = loans.filter(l => ['Active', 'Partially Paid'].includes(l.status) && Number(l.remaining_balance) <= 0)
    if (zeroBalance.length > 0) {
      console.log(`  ⚠️  ${zeroBalance.length} active loan(s) with ₱0 remaining balance (should be Paid?)`)
      issues++
    } else {
      console.log(`  ✅ No active loans with zero remaining balance`)
    }
  }

  // Check: Unsigned investors
  if (investors) {
    const unsigned = investors.filter(i => !i.signed_at)
    if (unsigned.length > 0) {
      console.log(`  ⚠️  ${unsigned.length} investor(s) haven't signed MOA: ${unsigned.map(i => i.full_name).join(', ')}`)
      issues++
    } else {
      console.log(`  ✅ All investors have signed MOA`)
    }
  }
  
  console.log('\n' + '═'.repeat(55))
  if (issues === 0) {
    console.log('  ✅ ALL CHECKS PASSED — Data is in good shape!')
  } else {
    console.log(`  ⚠️  ${issues} issue(s) found — review above`)
  }
  console.log('═'.repeat(55))
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err)
  process.exit(1)
})
