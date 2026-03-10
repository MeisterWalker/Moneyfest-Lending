const fs = require('fs')
const filePath = require('path').join(__dirname, 'src', 'pages', 'PublicApplyPage.js')
let content = fs.readFileSync(filePath, 'utf8')

const start = content.indexOf('        {/* Payment Methods */}')
const end = content.indexOf('        {/* FAQ */}')

if (start === -1 || end === -1) {
  console.log('❌ Could not find section markers. Positions:', start, end)
  process.exit(1)
}

const newSection = `        {/* Payment Methods */}
        <div style={{ marginTop: 40 }}>
          <h3 style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 16, color: '#F0F4FF', marginBottom: 4, textAlign: 'center' }}>
            \u{1F4B3} Accepted Payment Methods
          </h3>
          <p style={{ fontSize: 12, color: '#4B5580', textAlign: 'center', marginBottom: 16 }}>When paying your installments, you may use any of the following:</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { logo: '/cash-logo.png', label: 'Physical Cash', fee: '\u2713 Free', desc: 'Pay in person. No fees.', freebie: true, border: 'rgba(34,197,94,0.25)' },
              { logo: '/gcash-logo.png', label: 'GCash', fee: '\u20B115 or 1%', desc: 'Whichever is higher.', freebie: false, border: 'rgba(0,163,255,0.25)' },
              { logo: '/rcbc-logo.png', label: 'RCBC to RCBC', fee: '\u2713 Free', desc: 'Same bank transfer.', freebie: true, border: 'rgba(220,38,38,0.25)' },
              { logo: '/bank-logo.png', label: 'Other Bank', fee: 'You cover fee', desc: 'Instapay/PESONet. Send exact amount due.', freebie: false, border: 'rgba(139,92,246,0.25)' },
            ].map((item, i) => (
              <div key={i} style={{ background: '#141B2D', border: \`1px solid \${item.border}\`, borderRadius: 14, padding: '20px 16px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <img src={item.logo} alt={item.label} style={{ height: 44, objectFit: 'contain' }} />
                <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 13, color: '#F0F4FF' }}>{item.label}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: item.freebie ? '#22C55E' : '#F59E0B', background: item.freebie ? 'rgba(34,197,94,0.08)' : 'rgba(245,158,11,0.08)', padding: '3px 12px', borderRadius: 20, border: \`1px solid \${item.freebie ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.2)'}\` }}>{item.fee}</div>
                <div style={{ fontSize: 11, color: '#4B5580', lineHeight: 1.5 }}>{item.desc}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10, padding: '10px 14px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 9, fontSize: 12, color: '#F59E0B', textAlign: 'center' }}>
            \u26A0\uFE0F Always send proof of payment to your admin after every transaction.
          </div>
        </div>

`

content = content.substring(0, start) + newSection + content.substring(end)
fs.writeFileSync(filePath, content, 'utf8')
console.log('\u2705 Payment method cards fixed! Run: git add . && git commit -m "fix payment cards" && git push')
