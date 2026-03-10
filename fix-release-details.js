const fs = require('fs'), path = require('path')

// ── PublicApplyPage ──────────────────────────────────────────────
const applyPath = path.join(__dirname, 'src', 'pages', 'PublicApplyPage.js')
let apply = fs.readFileSync(applyPath, 'utf8')
let changed = false

// 1. Form state
const oldState = `    loan_amount: '', loan_purpose: '', release_method: '', agreed: false`
const newState = `    loan_amount: '', loan_purpose: '', release_method: '',\n    gcash_number: '', gcash_name: '',\n    bank_account_number: '', bank_name: '',\n    agreed: false`
if (apply.includes(oldState)) { apply = apply.replace(oldState, newState); changed = true; console.log('✅ 1. Form state updated') }
else console.log('ℹ️  1. Already applied')

// 2. validateStep3
const oldV3 = `  const validateStep3 = () => {
    if (!form.loan_amount) return 'Please select a loan amount'
    if (!form.release_method) return 'Please select a preferred release method'
    if (!form.agreed) return 'You must agree to the terms'
    return null
  }`
const newV3 = `  const validateStep3 = () => {
    if (!form.loan_amount) return 'Please select a loan amount'
    if (!form.release_method) return 'Please select a preferred release method'
    if (form.release_method === 'GCash') {
      if (!form.gcash_number.trim()) return 'GCash number is required'
      if (!isValidPHPhone(form.gcash_number)) return 'Enter a valid GCash number (e.g. 09XX XXX XXXX)'
      if (!form.gcash_name.trim()) return 'GCash account name is required'
      if (!isValidName(form.gcash_name)) return 'Please enter a valid GCash account name'
    }
    if (form.release_method === 'RCBC') {
      if (!form.bank_account_number.trim()) return 'RCBC account number is required'
      if (!/^\\d{10,16}$/.test(form.bank_account_number.replace(/\\s/g, ''))) return 'Enter a valid RCBC account number (10\u201316 digits)'
    }
    if (form.release_method === 'Other Bank Transfer') {
      if (!form.bank_name.trim()) return 'Bank name is required'
      if (!form.bank_account_number.trim()) return 'Account number is required'
      if (!/^\\d{5,20}$/.test(form.bank_account_number.replace(/\\s/g, ''))) return 'Enter a valid account number'
    }
    if (!form.agreed) return 'You must agree to the terms'
    return null
  }`
if (apply.includes(oldV3)) { apply = apply.replace(oldV3, newV3); changed = true; console.log('✅ 2. Validation updated') }
else console.log('ℹ️  2. Already applied')

// 3. Supabase insert
const oldInsert = `      release_method: form.release_method,\n      status: 'Pending',`
const newInsert = `      release_method: form.release_method,\n      gcash_number: form.gcash_number.trim() || null,\n      gcash_name: form.gcash_name.trim() || null,\n      bank_account_number: form.bank_account_number.trim() || null,\n      bank_name: form.bank_name.trim() || null,\n      status: 'Pending',`
if (apply.includes(oldInsert)) { apply = apply.replace(oldInsert, newInsert); changed = true; console.log('✅ 3. Supabase insert updated') }
else console.log('ℹ️  3. Already applied')

// 4. Conditional fields in JSX
const oldFields = `                  {form.release_method && !['Physical Cash', 'RCBC'].includes(form.release_method) && (
                    <div style={{ marginTop: 8, padding: '9px 12px', background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, fontSize: 12, color: '#F59E0B' }}>
                      \u26A0\uFE0F The applicable transaction fee will be deducted from your approved loan amount before release.
                    </div>
                  )}
                </div>`
const newFields = `                  {form.release_method && !['Physical Cash', 'RCBC'].includes(form.release_method) && (
                    <div style={{ marginTop: 8, padding: '9px 12px', background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, fontSize: 12, color: '#F59E0B' }}>
                      \u26A0\uFE0F The applicable transaction fee will be deducted from your approved loan amount before release.
                    </div>
                  )}

                  {/* GCash details */}
                  {form.release_method === 'GCash' && (
                    <div style={{ marginTop: 12, padding: '16px', background: 'rgba(0,163,255,0.05)', border: '1px solid rgba(0,163,255,0.2)', borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                        <img src="/gcash-logo.png" alt="GCash" style={{ height: 20, objectFit: 'contain' }} />
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#60B8FF' }}>GCash Account Details</span>
                      </div>
                      <div>
                        <label style={labelStyle}>GCash Number *</label>
                        <input value={form.gcash_number} onChange={e => set('gcash_number', e.target.value)} placeholder="09XX XXX XXXX" style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>GCash Full Name *</label>
                        <input value={form.gcash_name} onChange={e => set('gcash_name', e.target.value)} placeholder="Full name linked to this GCash number" style={inputStyle} />
                      </div>
                    </div>
                  )}

                  {/* RCBC details */}
                  {form.release_method === 'RCBC' && (
                    <div style={{ marginTop: 12, padding: '16px', background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                        <img src="/rcbc-logo.png" alt="RCBC" style={{ height: 20, objectFit: 'contain' }} />
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#F87171' }}>RCBC Account Details</span>
                      </div>
                      <div>
                        <label style={labelStyle}>RCBC Account Number *</label>
                        <input value={form.bank_account_number} onChange={e => set('bank_account_number', e.target.value)} placeholder="Enter your RCBC account number" style={inputStyle} />
                      </div>
                    </div>
                  )}

                  {/* Other Bank details */}
                  {form.release_method === 'Other Bank Transfer' && (
                    <div style={{ marginTop: 12, padding: '16px', background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                        <img src="/bank-logo.png" alt="Bank" style={{ height: 20, objectFit: 'contain' }} />
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#A78BFA' }}>Bank Account Details</span>
                      </div>
                      <div>
                        <label style={labelStyle}>Bank Name *</label>
                        <input value={form.bank_name} onChange={e => set('bank_name', e.target.value)} placeholder="e.g. BDO, BPI, Metrobank, UnionBank" style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>Account Number *</label>
                        <input value={form.bank_account_number} onChange={e => set('bank_account_number', e.target.value)} placeholder="Enter your account number" style={inputStyle} />
                      </div>
                    </div>
                  )}
                </div>`
if (apply.includes(oldFields)) { apply = apply.replace(oldFields, newFields); changed = true; console.log('✅ 4. Conditional fields added') }
else console.log('ℹ️  4. Already applied')

if (changed) fs.writeFileSync(applyPath, apply)

console.log('\n\u2705 Done! Now run:\ngit add .\ngit commit -m "add release method detail fields"\ngit push')
