// ── Payment Accounts Configuration ────────────────────────────────
// FE-06 FIX: Centralized payment account details instead of hardcoding
// in BorrowerPortalPage.js JSX. Update here to change across the entire app.
//
// To move to Supabase settings table in the future, replace this file
// with a fetch from: supabase.from('settings').select('payment_accounts')

export const PAYMENT_ACCOUNTS = [
  {
    id: 'gcash',
    logo: '/gcash-logo.png',
    label: 'GCash',
    holder: 'Charlou June Ramil',
    accountNumber: '09665835179',
    fee: 'GCash Free',
    feeColor: '#3B82F6',
    accent: 'rgba(59,130,246,0.05)',
    glow: 'rgba(59,130,246,0.2)',
    desc: 'Send via GCash to Charlou June Ramil.',
    steps: [
      'Open GCash and select Send Money',
      { label: 'Send to: 09665835179 (Charlou June R.)', copy: '09665835179' },
      'Send the exact installment amount',
      '⚠️ Note: GCash to GCash is free. You must cover fees if using Bank-to-GCash or 3rd party apps.',
      'Screenshot and upload the successful transaction',
    ],
  },
  {
    id: 'rcbc',
    logo: '/rcbc-logo.png',
    label: 'RCBC',
    holder: 'John Paul Lacaron',
    accountNumber: '9051147397',
    fee: 'Free (RCBC/DiskarTech)',
    feeColor: '#22C55E',
    accent: 'rgba(34,197,94,0.05)',
    glow: 'rgba(34,197,94,0.2)',
    desc: 'Transfer to RCBC or DiskarTech.',
    steps: [
      'Open RCBC or DiskarTech app',
      { label: 'Transfer to: 9051147397 (John Paul Lacaron)', copy: '9051147397' },
      'Send the exact installment amount',
      '✅ RCBC to RCBC and DiskarTech transfers are FREE',
      'Screenshot and upload the successful transaction',
    ],
  },
  {
    id: 'maribank',
    logo: '/maribank.png',
    label: 'MariBank',
    holder: 'Charlou June Ramil',
    accountNumber: '12476681477',
    fee: 'Free (Maya/Maribank)',
    feeColor: '#22C55E',
    accent: 'rgba(139,92,246,0.05)',
    glow: 'rgba(139,92,246,0.2)',
    desc: 'Transfer via Maya or MariBank.',
    steps: [
      'Open Maya or MariBank app',
      { label: 'Transfer to: 12476681477 (Charlou June Ramil)', copy: '12476681477' },
      'Send the exact installment amount',
      'Screenshot and upload the successful transaction',
    ],
  },
]
