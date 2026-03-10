const fs = require('fs'), path = require('path')
const p = f => path.join(__dirname, 'src', f)
let count = 0

function patch(filePath, oldStr, newStr, label) {
  let content = fs.readFileSync(filePath, 'utf8')
  if (content.includes(oldStr)) {
    fs.writeFileSync(filePath, content.replace(oldStr, newStr))
    console.log('OK: ' + label)
    count++
  } else {
    console.log('SKIP (already applied): ' + label)
  }
}

// 1. helpers.js - never fail silently
patch(p('lib/helpers.js'),
`export async function logAudit({ action_type, module, description, changed_by }) {
  try {
    await supabase.from('audit_logs').insert({
      action_type,
      module,
      description,
      changed_by: changed_by || 'system'
    })
  } catch (e) {
    console.error('Audit log failed:', e)
  }
}`,
`export async function logAudit({ action_type, module, description, changed_by }) {
  try {
    const { error } = await supabase.from('audit_logs').insert({
      action_type: action_type || 'UNKNOWN',
      module: module || 'System',
      description: description || '',
      changed_by: changed_by || 'admin',
      created_at: new Date().toISOString()
    })
    if (error) console.error('Audit log insert error:', error)
  } catch (e) {
    console.error('Audit log failed:', e)
  }
}`,
'helpers.js - robust logAudit')

// 2. CollectionPage - wrong column name
patch(p('pages/CollectionPage.js'),
`  const handleAuditLog = async (action) => {
    await supabase.from('audit_logs').insert({
      module: 'Collection', action: 'Email Sent', description: action, created_at: new Date().toISOString()
    })
  }`,
`  const handleAuditLog = async (action) => {
    await supabase.from('audit_logs').insert({
      action_type: 'EMAIL_SENT',
      module: 'Collection',
      description: action,
      changed_by: 'admin',
      created_at: new Date().toISOString()
    })
  }`,
'CollectionPage - fixed wrong column name')

// 3. LoansPage - handleStatusUpdate missing audit
patch(p('pages/LoansPage.js'),
`  const handleStatusUpdate = async (loanId, newStatus) => {
    await supabase.from('loans').update({ status: newStatus }).eq('id', loanId)
    fetchData()
  }`,
`  const handleStatusUpdate = async (loanId, newStatus) => {
    await supabase.from('loans').update({ status: newStatus }).eq('id', loanId)
    const loan = loans.find(l => l.id === loanId)
    const borrower = borrowers.find(b => b.id === loan?.borrower_id)
    await logAudit({
      action_type: 'LOAN_STATUS_CHANGED',
      module: 'Loan',
      description: 'Loan status manually changed to "' + newStatus + '" for ' + (borrower?.full_name || 'Unknown'),
      changed_by: user?.email
    })
    fetchData()
  }`,
'LoansPage - handleStatusUpdate now logged')

// 4. LoansPage - improve LOAN_EDITED description
patch(p('pages/LoansPage.js'),
`      await logAudit({ action_type: 'LOAN_EDITED', module: 'Loan', description: \`Loan edited for borrower\`, changed_by: user?.email })`,
`      const editedBorrower = borrowers.find(b => b.id === form.borrower_id)
      await logAudit({ action_type: 'LOAN_EDITED', module: 'Loan', description: 'Loan edited for ' + (editedBorrower?.full_name || 'Unknown') + ' - P' + (form.loan_amount?.toLocaleString()), changed_by: user?.email })`,
'LoansPage - LOAN_EDITED now includes borrower name')

// 5. DashboardPage - add useAuth import
patch(p('pages/DashboardPage.js'),
`import { useNavigate } from 'react-router-dom'`,
`import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'`,
'DashboardPage - useAuth import added')

// 6. DashboardPage - add user destructure
patch(p('pages/DashboardPage.js'),
`export default function DashboardPage() {`,
`export default function DashboardPage() {
  const { user } = useAuth()`,
'DashboardPage - user context added')

// 7. DashboardPage - handleMarkPaid audit
patch(p('pages/DashboardPage.js'),
`  const handleMarkPaid = async (loan) => {
    const newPaid = loan.payments_made + 1
    const newBalance = Math.max(0, loan.remaining_balance - loan.installment_amount)
    const newStatus = newPaid >= 4 ? 'Paid' : 'Partially Paid'
    await supabase.from('loans').update({ payments_made: newPaid, remaining_balance: newBalance, status: newStatus }).eq('id', loan.id)
    const b = borrowers.find(x => x.id === loan.borrower_id)
    if (b) {
      const newScore = Math.min(850, b.credit_score + 15)
      await supabase.from('borrowers').update({ credit_score: newScore, risk_score: newScore >= 650 ? 'Low' : newScore >= 550 ? 'Medium' : 'High' }).eq('id', b.id)
    }
    fetchData()
  }`,
`  const handleMarkPaid = async (loan) => {
    const newPaid = loan.payments_made + 1
    const newBalance = Math.max(0, loan.remaining_balance - loan.installment_amount)
    const newStatus = newPaid >= 4 ? 'Paid' : 'Partially Paid'
    await supabase.from('loans').update({ payments_made: newPaid, remaining_balance: newBalance, status: newStatus }).eq('id', loan.id)
    const b = borrowers.find(x => x.id === loan.borrower_id)
    if (b) {
      const newScore = Math.min(850, b.credit_score + 15)
      await supabase.from('borrowers').update({ credit_score: newScore, risk_score: newScore >= 650 ? 'Low' : newScore >= 550 ? 'Medium' : 'High' }).eq('id', b.id)
    }
    await logAudit({
      action_type: 'INSTALLMENT_PAID',
      module: 'Loan',
      description: 'Installment ' + newPaid + ' of 4 recorded via Dashboard for ' + (b?.full_name || 'Unknown') + ' - P' + (loan.installment_amount?.toLocaleString('en-PH', { minimumFractionDigits: 2 })),
      changed_by: user?.email
    })
    fetchData()
  }`,
'DashboardPage - handleMarkPaid now logged')

// 8. BorrowersPage - BORROWER_EDITED shows what changed
patch(p('pages/BorrowersPage.js'),
`      await logAudit({ action_type: 'BORROWER_EDITED', module: 'Borrower', description: \`Borrower profile updated: \${form.full_name}\`, changed_by: user?.email })`,
`      const editChanges = []
      if (editing.full_name !== form.full_name) editChanges.push('name')
      if (editing.department !== form.department) editChanges.push('department')
      if (editing.phone !== form.phone) editChanges.push('phone')
      if (editing.email !== form.email) editChanges.push('email')
      if (editing.admin_notes !== form.admin_notes) editChanges.push('admin notes')
      if (String(editing.loan_limit) !== String(form.loan_limit)) editChanges.push('loan limit to P' + parseFloat(form.loan_limit)?.toLocaleString())
      const changeDesc = editChanges.length > 0 ? ' (changed: ' + editChanges.join(', ') + ')' : ''
      await logAudit({ action_type: 'BORROWER_EDITED', module: 'Borrower', description: 'Borrower profile updated: ' + form.full_name + changeDesc, changed_by: user?.email })`,
'BorrowersPage - BORROWER_EDITED now shows what changed')

console.log('\n' + count + ' fix(es) applied.')
console.log('Run: git add . && git commit -m "complete audit log coverage" && git push')
