// Run this in your project root:
// node fix-payment-methods.js

const fs = require('fs')
const path = require('path')

const filePath = path.join(__dirname, 'src', 'pages', 'PublicApplyPage.js')
let content = fs.readFileSync(filePath, 'utf8')

const oldSection = `          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { logo: '/cash-logo.png', label: 'Physical Cash', desc: 'Receive loan in cash directly. No fees.', border: 'rgba(34,197,94,0.25)' },
              { logo: '/gcash-logo.png', label: 'GCash', desc: 'Send installment via GCash. Details upon approval.', border: 'rgba(0,163,255,0.25)' },
              { logo: '/rcbc-logo.png', label: 'RCBC', desc: 'Bank transfer via RCBC. Free for RCBC to RCBC.', border: 'rgba(220,38,38,0.25)' },
              { logo: '/bank-logo.png', label: 'Other Bank', desc: 'Instapay/PESONet. Fee: ₱15–₱50 varies per bank.', border: 'rgba(139,92,246,0.25)' },
            ].map((item, i) => (
              <div key={i} style={{ background: '#141B2D', border: \`1px solid \${item.border}\`, borderRadius: 14, padding: '18px 20px', textAlign: 'center' }}>
                <img src={item.logo} alt={item.label} style={{ height: 40, objectFit: 'contain', marginBottom: 10 }} />
                <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 13, color: '#F0F4FF', marginBottom: 4 }}>{item.label}</div>
                <div style={{ fontSize: 12, color: '#7A8AAA', lineHeight: 1.6 }}>{item.desc}</div>
              </div>
            ))}`

const newSection = `          <div style={{ background: '#141B2D', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, overflow: 'hidden' }}>
            {[
              { logo: '/cash-logo.png', label: 'Physical Cash', fee: 'Free', freebie: true },
              { logo: '/gcash-logo.png', label: 'GCash', fee: '₱15 or 1% (whichever is higher)', freebie: false },
              { logo: '/rcbc-logo.png', label: 'RCBC to RCBC', fee: 'Free', freebie: true },
              { logo: '/bank-logo.png', label: 'Other Bank (Instapay/PESONet)', fee: '₱15–₱50 (varies per bank)', freebie: false },
            ].map((item, i, arr) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <img src={item.logo} alt={item.label} style={{ width: 36, height: 36, objectFit: 'contain', flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#CBD5F0' }}>{item.label}</span>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: item.freebie ? '#22C55E' : '#F59E0B', background: item.freebie ? 'rgba(34,197,94,0.08)' : 'rgba(245,158,11,0.08)', padding: '4px 12px', borderRadius: 20, border: \`1px solid \${item.freebie ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.2)'}\`, whiteSpace: 'nowrap' }}>
                  {item.freebie ? '✓ Free' : item.fee}
                </span>
              </div>
            ))}`

if (content.includes(oldSection)) {
  content = content.replace(oldSection, newSection)
  // Also fix the heading subtitle
  content = content.replace(
    `            💳 Accepted Payment Methods
          </h3>`,
    `            💳 Accepted Payment Methods
          </h3>
          <p style={{ fontSize: 12, color: '#4B5580', textAlign: 'center', marginBottom: 16 }}>When paying your installments, you may use any of the following:</p>`
  )
  fs.writeFileSync(filePath, content, 'utf8')
  console.log('✅ Successfully patched PublicApplyPage.js!')
} else {
  console.log('❌ Could not find the target section. File may already be updated or structure differs.')
}

// Also fix other bank fee description
content = content.replace(
  `{ logo: '/bank-logo.png', label: 'Other Bank (Instapay/PESONet)', fee: '₱15–₱50 (varies per bank)', freebie: false }`,
  `{ logo: '/bank-logo.png', label: 'Other Bank (Instapay/PESONet)', fee: 'Borrower covers transfer fee', freebie: false }`
)
fs.writeFileSync(filePath, content, 'utf8')
console.log('✅ Other bank fee description updated!')
