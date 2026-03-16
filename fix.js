const fs = require('fs');
const path = 'src/pages/FAQPage.js';
let content = fs.readFileSync(path, 'utf8');
const lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('Do I need to submit a valid ID?')) {
    lines[i] = `      { q: 'Do I need to submit a valid ID?', a: "Yes. Upload a clear photo of the front and back of any government-issued ID. Accepted IDs: Philippine National ID (PhilSys), Passport, Driver's License, SSS/GSIS ID, PhilHealth ID, Voter's ID, Postal ID, TIN ID, and PRC ID. Both front and back must be visible and legible. Applications without a valid ID submission will not be processed." },`;
    console.log('Fixed line ' + (i + 1));
  }
}
fs.writeFileSync(path, lines.join('\n'), 'utf8');
console.log('Done');