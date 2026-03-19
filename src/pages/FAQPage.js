import { useState } from 'react'
import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { usePageVisit } from '../hooks/usePageVisit'

function FAQItem({ question, answer, children }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${open ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.06)'}`, borderRadius: 14, overflow: 'hidden', transition: 'border-color 0.2s' }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', padding: '18px 22px', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <span style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 15, color: '#F0F4FF', textAlign: 'left', lineHeight: 1.4 }}>{question}</span>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: open ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${open ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.08)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s' }}>
          <span style={{ color: open ? '#3B82F6' : '#4B5580', fontSize: 18, lineHeight: 1, transition: 'transform 0.2s', display: 'block', transform: open ? 'rotate(45deg)' : 'rotate(0deg)' }}>+</span>
        </div>
      </button>
      {open && (
        <div style={{ padding: '0 22px 20px', fontSize: 14, color: '#7A8AAA', lineHeight: 1.8, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ paddingTop: 16 }}>{answer}{children}</div>
        </div>
      )}
    </div>
  )
}

const CATEGORIES = [
  { id: 'eligibility', label: 'Eligibility',  img: '/candidate.png' },
  { id: 'amounts',     label: 'Amounts',      img: '/money.png' },
  { id: 'payments',    label: 'Payments',     img: '/calendar.png' },
  { id: 'release',     label: 'Release',      img: '/payment-method.png' },
  { id: 'quickloan',   label: '⚡ QuickLoan', img: '/calculator.png' },
  { id: 'other',       label: 'Other',        img: '/boxes.png' },
]

export default function FAQPage() {
  usePageVisit('faq')
  const [activeCategory, setActiveCategory] = useState('eligibility')
  const [interestRate, setInterestRate] = useState(0.07)

  useEffect(() => {
    supabase.from('settings').select('interest_rate').eq('id', 1).single()
      .then(({ data }) => { if (data?.interest_rate) setInterestRate(data.interest_rate) })
  }, [])

  const faqByCategory = {
    eligibility: [
      { q: 'Who can apply for a loan?', a: 'MoneyfestLending is an exclusive workplace lending program — only active team members within our office who are in good standing are eligible to apply. This is a private, internal program and is not open to the general public. If you are unsure about your eligibility, reach out to the admins via Microsoft Teams.' },
      { q: 'Do I need a trustee to apply?', a: 'No — Moneyfest Lending no longer requires a trustee or guarantor to apply for a loan. Simply fill out your personal information and submit a valid government-issued ID.' },
      
      { q: 'What is the Security Hold?', a: 'When your loan is approved, a percentage of the loan amount is withheld as a Security Hold — you receive the rest. The exact rate depends on your credit score: VIP borrowers (780+) pay only 5%, Reliable (720+) pay 6%, Trusted (650+) pay 8%, standard (580+) pay 10%, Caution (500+) pay 15%, and High Risk (below 500) pay 20%. For example, a standard borrower on a ₱5,000 loan receives ₱4,500 and ₱500 is held. Interest is computed on the full approved amount. The Security Hold is automatically returned to your Rebate Credits after your final installment is paid. It is not a fee — you always get it back in full.' },
      { q: 'What is the credit score system?', a: 'Every borrower starts with a credit score of 750. The maximum score is 1,000 which is the VIP tier. Your score goes up by 15 points for each on-time installment payment, and you earn a bonus of 25 points when you fully pay off any loan — installment or QuickLoan. So 1 perfect 2-month installment loan adds 85 points total (60 from 4 payments + 25 bonus), and a 3-month loan adds 115 points. QuickLoans earn the +25 completion bonus too, but have no per-payment scoring since there are no installments. Late installment payments deduct 10 points each. A loan default deducts 150 points for any loan type. Your credit score directly affects your Security Hold rate and your borrower tier.' },
      { q: 'What are the borrower tiers and perks?', a: 'MoneyfestLending has 4 borrower tiers. 🌱 New — starting at score 750, 10% Security Hold, ₱5,000 limit. ⭐ Trusted — score 835+ (after 1 perfect loan), 8% hold, ₱7,000 limit. 🤝 Reliable — score 920+ (after 2 perfect loans), 6% hold, ₱9,000 limit. 👑 VIP — score 1,000 (after 3 perfect loans), 5% hold, ₱10,000 limit. The maximum possible score is 1,000.' },
      { q: 'How do I reduce my Security Hold rate?', a: 'Pay every installment on time to earn +15 points per payment, plus +25 bonus when you complete the full loan. After 1 perfect loan your score goes from 750 to 835 — unlocking ⭐ Trusted status and dropping your hold from 10% to 8%. After 2 perfect loans (score 920) you become 🤝 Reliable at 6%. After 3 perfect loans you hit the maximum score of 1,000 — 👑 VIP status with only 5% hold.' },
      { q: 'Can I apply if I already have an active loan?', a: 'No. You must fully settle your current loan before applying for a new one. No rollovers or loan stacking is allowed under any circumstance.' },
      { q: 'Do I need to submit a valid ID?', a: "Yes. Upload a clear photo of the front and back of any government-issued ID. Accepted IDs: Philippine National ID (PhilSys), Passport, Driver's License, SSS/GSIS ID, PhilHealth ID, Voter's ID, Postal ID, TIN ID, and PRC ID. Both front and back must be visible and legible. Applications without a valid ID submission will not be processed." },
    ],
    amounts: [
      { q: 'How much can I borrow?', a: 'First-time borrowers start at ₱5,000. Your borrowing limit increases as you build a clean repayment history — all the way up to ₱10,000 at Level 4.' },
      { q: 'What is the Level Attainment System?', children: (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { level: 'Level 1', amount: '₱5,000', desc: 'New borrower — starting limit' },
            { level: 'Level 2', amount: '₱7,000', desc: 'After 1 fully paid clean loan' },
            { level: 'Level 3', amount: '₱9,000', desc: 'After 2 fully paid clean loans' },
            { level: 'Level 4', amount: '₱10,000', desc: 'After 3 fully paid clean loans (max)' },
          ].map((l, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'rgba(139,92,246,0.06)', borderRadius: 9, border: '1px solid rgba(139,92,246,0.12)' }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#8B5CF6', minWidth: 52 }}>{l.level}</span>
              <span style={{ fontWeight: 800, color: '#22C55E', minWidth: 64, fontFamily: 'Space Grotesk' }}>{l.amount}</span>
              <span style={{ fontSize: 12, color: '#4B5580' }}>{l.desc}</span>
            </div>
          ))}
          <div style={{ fontSize: 12, color: '#4B5580', marginTop: 4, padding: '10px 14px', background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 9 }}>
            In some cases, the admin may approve a higher starting amount based on their review — this is not guaranteed and is at the admin's discretion.
          </div>
        </div>
      )},
      { q: `How is the interest calculated?`, a: `We charge ${(interestRate * 100).toFixed(0)}% interest per month, applied over your chosen loan term. For a 2-month loan the total interest is ${(interestRate * 2 * 100).toFixed(0)}% — for example, a ₱5,000 loan has a total repayment of ₱${(5000 * (1 + interestRate * 2)).toLocaleString('en-PH', { minimumFractionDigits: 2 })}, split into 4 installments of ₱${(5000 * (1 + interestRate * 2) / 4).toLocaleString('en-PH', { minimumFractionDigits: 2 })} each. For a 3-month loan the total interest is ${(interestRate * 3 * 100).toFixed(0)}% — a ₱5,000 loan repays ₱${(5000 * (1 + interestRate * 3)).toLocaleString('en-PH', { minimumFractionDigits: 2 })} in 6 installments. The interest does not compound — it is fixed at approval and will not change.` },
    ],
    payments: [
      { q: 'When are payments due?', a: 'Payments are collected every 5th and 20th of the month — that\'s 2 payments per month. A 2-month loan is fully paid after 4 installments; a 3-month loan after 6 installments.' },
      { q: 'What are the accepted repayment methods?', children: (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { logo: '/cash-logo.png', label: 'Physical Cash', fee: 'Free', desc: 'Pay your admin directly in person. No fees, no transfer needed.', freebie: true, border: 'rgba(34,197,94,0.25)' },
            { logo: '/gcash-logo.png', label: 'GCash', fee: '₱15', desc: 'Send to the admin GCash number. Free if GCash to GCash — otherwise a ₱15 transaction fee applies.', freebie: false, border: 'rgba(0,163,255,0.25)' },
            { logo: '/rcbc-logo.png', label: 'RCBC to RCBC', fee: 'Free', desc: 'Transfer directly to the admin RCBC account. Same-bank transfers are free.', freebie: true, border: 'rgba(220,38,38,0.25)' },
            { logo: '/bank-logo.png', label: 'Other Bank (Instapay/PESONet)', fee: 'You cover fee', desc: 'Transfer from any other bank. You must send the exact amount due — transfer fees are on your end.', freebie: false, border: 'rgba(139,92,246,0.25)' },
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, background: '#0B0F1A', border: `1px solid ${item.border}`, borderRadius: 12, padding: '14px 16px' }}>
              <img src={item.logo} alt={item.label} style={{ width: 38, height: 38, objectFit: 'contain', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 13, color: '#F0F4FF' }}>{item.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: item.freebie ? '#22C55E' : '#F59E0B', background: item.freebie ? 'rgba(34,197,94,0.08)' : 'rgba(245,158,11,0.08)', padding: '2px 10px', borderRadius: 20 }}>{item.fee}</span>
                </div>
                <div style={{ fontSize: 12, color: '#4B5580', lineHeight: 1.5 }}>{item.desc}</div>
              </div>
            </div>
          ))}
          <div style={{ marginTop: 4, padding: '12px 16px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 9, fontSize: 13, color: '#F59E0B', lineHeight: 1.6 }}>
            📸 Always upload your proof of payment through the <strong>Borrower Portal</strong> after every transaction so your admin can confirm it.
          </div>
        </div>
      )},
      { q: 'What happens if I miss a payment?', a: 'A late penalty of ₱20 per day is charged starting the day after the due date (5th or 20th of the month). The penalty accrues daily with no cap until the installment is fully settled. Late penalties are automatically deducted from your Security Hold balance. Late payments also deduct 10 points from your credit score. The Security Hold returned at the end of your loan will reflect any penalty deductions. Consistent non-payment may result in your loan being flagged as defaulted.' },
      { q: 'Can I earn rewards for paying early?', a: 'Yes! Pay your final installment even 1 day early and earn a fixed 1% rebate on your original loan amount. For example on a ₱5,000 loan that is ₱50 credited to your Rebate Credits. The 1% rate is fixed regardless of how many days early you pay. The rebate only applies to the last installment and is automatically credited when the admin records your payment.' },
    ],
    release: [
      { q: 'How will my loan be released?', a: 'Once approved, your loan will be released via your chosen method — Physical Cash, GCash, RCBC, or Other Bank Transfer. Release fees vary: Physical Cash and RCBC-to-RCBC are free, GCash is free if sending GCash to GCash — otherwise a ₱15 fee applies, and other bank transfers require the borrower to cover the transfer fee. Fees are deducted from your approved amount before release.' },
      { q: 'When will my loan be released after approval?', a: 'Your release will be scheduled on the nearest 5th or 20th cutoff date following approval. You will be able to see your scheduled release date on the Borrower Portal.' },
      { q: 'How long does approval take?', a: 'Applications are reviewed manually by the admin — usually within 12 hours. You will be notified via email and can track your status anytime through the Borrower Portal using your access code.' },
    ],
    other: [
      { q: 'How do I track my application?', a: 'After submitting, you will receive an access code. Use this code to log in to the Borrower Portal at moneyfestlending.online/portal — you can track your application status, view your loan schedule, and upload payment proofs from there.' },
      { q: 'What are Rebate Credits and how do they work?', a: 'Rebate Credits is your in-app rewards balance. Two things are credited here automatically by the system: (1) Early Payoff Rebates — a fixed 1% of your loan amount is credited if you pay your final installment at least 1 day early. (2) Security Hold Return — once you fully pay your final installment, the Security Hold that was withheld when your loan was released is automatically returned here in full. You cannot add funds manually. Once your total Rebate Credits balance reaches ₱500, a withdrawal button becomes available in the Borrower Portal. Withdrawal requests are reviewed and processed by the admin.' },
      { q: 'Who can I contact for questions?', children: (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { initials: 'JP', name: 'John Paul Lacaron', gradient: 'linear-gradient(135deg,#3B82F6,#8B5CF6)', role: 'Admin & Developer · Microsoft Teams Chat' },
            { initials: 'CJ', name: 'Charlou June Ramil', gradient: 'linear-gradient(135deg,#14B8A6,#3B82F6)', role: 'Admin · Microsoft Teams Chat' },
          ].map((p, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 10, padding: '12px 16px' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: p.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 14, color: '#fff', flexShrink: 0 }}>{p.initials}</div>
              <div>
                <div style={{ fontWeight: 700, color: '#F0F4FF', fontSize: 14 }}>{p.name}</div>
                <div style={{ fontSize: 12, color: '#3B82F6' }}>{p.role}</div>
              </div>
            </div>
          ))}
        </div>
      )},
    ],
    quickloan: [
      { q: 'What is a QuickLoan?', a: 'QuickLoan is a short-term cash loan of up to ₱3,000 with a flexible repayment schedule. Unlike the installment loan with fixed semi-monthly installments, QuickLoan lets you pay it off any time you want. Interest accrues daily, so the earlier you pay, the less you owe.' },
      { q: 'How is QuickLoan interest calculated?', a: 'QuickLoan uses a 10% monthly rate, converted to a daily rate of 0.3333%/day (10% ÷ 30). On a ₱3,000 loan, that\'s ₱10/day. On a ₱1,000 loan, it\'s ₱3.33/day. The interest simply multiplies by the number of days you\'ve had the loan — no compounding, no hidden fees.' },
      { q: 'When is the QuickLoan due?', a: 'The target due date is Day 15 from the release date — this is when we expect full repayment of principal plus accrued interest. If you can\'t pay on Day 15, a ₱100 extension fee is charged and your principal rolls over to a hard deadline of Day 30. After Day 30, a ₱25/day penalty accrues on top of the daily interest until fully settled.' },
      { q: 'What happens if I miss the Day 15 target?', a: 'If you don\'t pay by Day 15, the admin will collect the 15 days of accrued interest plus a one-time ₱100 extension fee — for a ₱3,000 loan that\'s ₱150 + ₱100 = ₱250. Your ₱3,000 principal then rolls over to Day 30 as the final deadline, with interest still running daily.' },
      { q: 'What happens after Day 30?', a: 'Day 30 is the hard deadline. After that, you still owe the full balance (principal + all accrued interest + extension fee) and a ₱25/day penalty starts accruing on top. There is no cap on this penalty — the longer you wait, the more you owe. Since all borrowers are salaried colleagues, we expect settlement to happen at the next payday at the latest.' },
      { q: 'Can I pay a QuickLoan early?', a: 'Yes — in fact, paying early saves you money. If you pay on Day 7 instead of Day 15, you only pay 7 days of interest instead of 15. On a ₱3,000 loan, that\'s ₱70 instead of ₱150. There is no prepayment penalty.' },
      { q: 'Does QuickLoan have a Security Hold?', a: 'No. QuickLoan does not have a Security Hold — you receive the full approved amount. The interest structure (daily accrual + extension fee + penalty) is the risk management mechanism instead.' },
      { q: 'Does QuickLoan affect my credit score?', a: 'Yes — in two ways. When you fully pay off a QuickLoan, you earn +25 points to your credit score, the same completion bonus as an installment loan. This means QuickLoans count toward your journey from New → Trusted → Reliable → VIP. However, there are no per-payment score changes (+15 on-time / -10 late) since QuickLoan has no installments — just a single full payoff. If a QuickLoan is marked as defaulted, the standard -150 point deduction applies. Bottom line: pay it off and you grow your score. Default and it hurts just as much as an installment loan default.' },
      { q: 'Can I have both a installment loan and a QuickLoan at the same time?', a: 'No. Only one active loan is allowed per borrower at any time, regardless of type. You must fully settle your current loan — regular or QuickLoan — before applying for a new one.' },
    ],
  }

  const activeFAQs = faqByCategory[activeCategory] || []

  return (
    <div style={{ minHeight: '100vh', background: '#07090F', fontFamily: 'DM Sans, sans-serif', position: 'relative', overflowX: 'hidden' }}>
      <style>{`
        .faq-grid-bg {
          position: fixed; inset: 0; pointer-events: none; opacity: 0.03; z-index: 0;
          background-image: linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px);
          background-size: 48px 48px;
        }
      `}</style>
      <div className="faq-grid-bg" />
      <div style={{ position: 'fixed', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)', top: '-5%', right: '-5%', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 70%)', bottom: '10%', left: '-3%', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'relative', zIndex: 1 }}>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg,#0d1226,#141B2D)', borderBottom: '1px solid rgba(139,92,246,0.2)', padding: '20px 24px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
            <img src="/favicon-96x96.png" alt="MoneyfestLending" style={{ width: 44, height: 44, objectFit: 'contain' }} />
            <div>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 20, color: '#F0F4FF' }}>
                Moneyfest<span style={{ background: 'linear-gradient(90deg,#60a5fa,#a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Lending</span>
              </div>
              <div style={{ fontSize: 11, color: '#4B5580', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Help & FAQs</div>
            </div>
          </a>
          <div style={{ display: 'flex', gap: 8 }}>
            <a href="/apply" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, background: 'linear-gradient(135deg,rgba(59,130,246,0.15),rgba(139,92,246,0.15))', border: '1px solid rgba(139,92,246,0.3)', color: '#a78bfa', fontSize: 13, fontWeight: 700, textDecoration: 'none', fontFamily: 'Space Grotesk', whiteSpace: 'nowrap' }}>
              <img src="/startup.png" alt="launch" style={{ width: 15, height: 15, objectFit: 'contain', marginRight: 5 }} />Apply Now
            </a>
            <a href="/portal" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#7A8AAA', fontSize: 13, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}>
              My Portal
            </a>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '40px 24px 60px' }}>

        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ marginBottom: 14 }}><img src="/faq.png" alt="faq" style={{ width: 44, height: 44, objectFit: 'contain', marginBottom: 14 }} /></div>
          <h1 style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 32, color: '#F0F4FF', margin: '0 0 12px', letterSpacing: -1 }}>Frequently Asked Questions</h1>
          <p style={{ color: '#7A8AAA', fontSize: 15, maxWidth: 500, margin: '0 auto', lineHeight: 1.7 }}>Everything you need to know about the MoneyfestLending employee lending program.</p>
        </div>

        {/* Two-column layout: Category tabs left, FAQs right */}
        <div className="faq-layout" style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 24, alignItems: 'start' }}>

          {/* Category sidebar */}
          <div style={{ background: '#141B2D', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 12, position: 'sticky', top: 24 }}>
            <div style={{ fontSize: 11, color: '#4B5580', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, padding: '4px 10px 10px' }}>Categories</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {CATEGORIES.map(cat => (
                <button key={cat.id} onClick={() => setActiveCategory(cat.id)} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: 'none', background: activeCategory === cat.id ? (cat.id === 'quickloan' ? 'rgba(245,158,11,0.12)' : 'rgba(59,130,246,0.12)') : 'transparent', color: activeCategory === cat.id ? (cat.id === 'quickloan' ? '#F59E0B' : '#60A5FA') : '#7A8AAA', fontSize: 13, fontWeight: activeCategory === cat.id ? 700 : 400, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s', borderLeft: `3px solid ${activeCategory === cat.id ? (cat.id === 'quickloan' ? '#F59E0B' : '#3B82F6') : 'transparent'}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <img src={cat.img} alt={cat.label} style={{ width: 18, height: 18, objectFit: 'contain', flexShrink: 0 }} />
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* FAQ list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {activeFAQs.map((faq, i) => (
              <FAQItem key={i} question={faq.q} answer={faq.a}>
                {faq.children}
              </FAQItem>
            ))}
          </div>

        </div>

        {/* Bottom CTA */}
        <div style={{ marginTop: 48, background: 'linear-gradient(135deg,rgba(59,130,246,0.08),rgba(139,92,246,0.08))', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 20, padding: '32px 36px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 20, color: '#F0F4FF', marginBottom: 6 }}>Ready to apply?</div>
            <div style={{ fontSize: 14, color: '#7A8AAA' }}>Fill out the form and get your access code instantly.</div>
          </div>
          <style>{`
            @keyframes rocketFly {
              0%   { transform: translate(0, 0) rotate(-45deg); }
              25%  { transform: translate(3px, -4px) rotate(-45deg); }
              50%  { transform: translate(6px, -8px) rotate(-45deg); }
              75%  { transform: translate(3px, -4px) rotate(-45deg); }
              100% { transform: translate(0, 0) rotate(-45deg); }
            }
            .rocket-btn:hover .rocket-icon {
              animation: rocketFly 0.6s ease-in-out infinite;
            }
            .rocket-btn .rocket-icon {
              transition: transform 0.3s ease;
            }
          `}</style>
          <a href="/apply" className="rocket-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '13px 28px', borderRadius: 12, background: 'linear-gradient(135deg,#3B82F6,#8B5CF6)', color: '#fff', textDecoration: 'none', fontSize: 14, fontWeight: 700, fontFamily: 'Space Grotesk', whiteSpace: 'nowrap' }}>
            <img src="/startup.png" alt="launch" className="rocket-icon" style={{ width: 18, height: 18, objectFit: 'contain', marginRight: 7 }} />Start Application
          </a>
        </div>

      </div>
      </div>
    </div>
  )
}
