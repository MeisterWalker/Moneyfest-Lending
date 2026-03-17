import { useState, useEffect, useRef } from 'react'

const TIERS = [
  {
    amount: '₱5,000',
    rate: '8%',
    earn: '₱600',
    annual: '₱2,400',
    annualRate: '48%',
    label: 'Starter',
    color: '#94A3B8',
    bg: 'rgba(148,163,184,0.06)',
    border: 'rgba(148,163,184,0.2)',
    glow: 'rgba(148,163,184,0.08)',
  },
  {
    amount: '₱10,000',
    rate: '10%',
    earn: '₱1,500',
    annual: '₱6,000',
    annualRate: '60%',
    label: 'Standard',
    color: '#F59E0B',
    bg: 'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.35)',
    glow: 'rgba(245,158,11,0.12)',
    featured: true,
  },
  {
    amount: '₱20,000+',
    rate: '12%',
    earn: '₱3,600',
    annual: '₱14,400',
    annualRate: '72%',
    label: 'Premium',
    color: '#22C55E',
    bg: 'rgba(34,197,94,0.08)',
    border: 'rgba(34,197,94,0.3)',
    glow: 'rgba(34,197,94,0.1)',
  },
]

const COMPARISONS = [
  { label: 'BDO / BPI Savings', rate: '0.0625% p.a.', annual: '~₱6', color: '#EF4444', bar: 1, note: 'Actual current rate as of 2026' },
  { label: 'BDO / BPI Time Deposit', rate: '0.75–1.07% p.a.', annual: '~₱75–107', color: '#F97316', bar: 5, note: '90–360 day term' },
  { label: 'UITF / Mutual Fund', rate: '8–12% avg', annual: '~₱800–1,200', color: '#F59E0B', bar: 35, note: 'Variable — not guaranteed' },
  { label: 'MoneyfestLending', rate: '8–12% per 3 months', annual: '₱2,400–14,400', color: '#22C55E', bar: 100, highlight: true },
]

const FAQS = [
  { q: 'Is my investment guaranteed?', a: 'Returns are projected based on our active lending performance. This is not a bank deposit and is not PDIC-insured. Only invest what you are comfortable holding for 3 months.' },
  { q: 'What happens if a borrower defaults?', a: 'We have multiple safeguards — Security Hold, penalty system, credit scoring, and trustee/guarantor requirements. In the unlikely event of default, your principal remains intact; only that cycle\'s return may be affected.' },
  { q: 'How do I get paid?', a: 'Payouts are processed every 3 months. You receive your original investment plus the agreed interest rate, coordinated directly with the admin via Teams Chat.' },
  { q: 'Can I withdraw early?', a: 'Investments are locked for the full 3-month term to align with our lending cycle. Early withdrawal is not available once a cycle has started.' },
  { q: 'How is MoneyfestLending different from 5-6?', a: 'We charge borrowers 7% per month (14% total over the 2-month loan) — far below the 20% per month that 5-6 schemes charge. We\'re a fair, digital, colleague-first program. No collectors, no harassment, no predatory rates.' },
]

function Counter({ target, duration = 1500, prefix = '', suffix = '' }) {
  const [count, setCount] = useState(0)
  const ref = useRef(null)
  const started = useRef(false)

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !started.current) {
        started.current = true
        const start = performance.now()
        const tick = (now) => {
          const p = Math.min((now - start) / duration, 1)
          const ease = 1 - Math.pow(1 - p, 3)
          setCount(Math.round(ease * target))
          if (p < 1) requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      }
    }, { threshold: 0.5 })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [target, duration])

  return <span ref={ref}>{prefix}{count.toLocaleString()}{suffix}</span>
}

export default function InvestorPitchPage() {
  const [openFaq, setOpenFaq] = useState(null)
  const [visible, setVisible] = useState({})
  const refs = useRef({})

  useEffect(() => {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) setVisible(v => ({ ...v, [e.target.dataset.id]: true }))
      })
    }, { threshold: 0.1 })
    Object.values(refs.current).forEach(el => { if (el) obs.observe(el) })
    return () => obs.disconnect()
  }, [])

  const ref = (id) => (el) => {
    refs.current[id] = el
    if (el) el.dataset.id = id
  }

  return (
    <div style={{ minHeight: '100vh', background: '#080A0F', fontFamily: 'DM Sans, sans-serif', color: '#F0F4FF', overflowX: 'hidden' }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Cormorant+Garamond:wght@400;500;600;700;800&display=swap');

        @keyframes fadeUp   { from { opacity:0; transform:translateY(28px); } to { opacity:1; transform:translateY(0); } }
        @keyframes shimmerG { 0%,100% { opacity:.6; } 50% { opacity:1; } }
        @keyframes floatY   { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-8px); } }
        @keyframes barGrow  { from { width:0; } to { width:var(--w); } }

        .hero-1 { animation: fadeUp .8s ease forwards; opacity:0; }
        .hero-2 { animation: fadeUp .8s .15s ease forwards; opacity:0; }
        .hero-3 { animation: fadeUp .8s .3s ease forwards; opacity:0; }
        .hero-4 { animation: fadeUp .8s .45s ease forwards; opacity:0; }

        .reveal { opacity:0; transform:translateY(24px); transition: opacity .7s ease, transform .7s ease; }
        .reveal.on { opacity:1; transform:translateY(0); }
        .d1 { transition-delay:.05s; } .d2 { transition-delay:.15s; } .d3 { transition-delay:.25s; }

        .tier-card { transition: transform .25s ease, box-shadow .25s ease, border-color .25s ease; }
        .tier-card:hover { transform: translateY(-6px); }

        .faq-item { transition: background .2s ease; cursor: pointer; }
        .faq-item:hover { background: rgba(245,158,11,0.04) !important; }

        .gold-text {
          background: linear-gradient(90deg, #F59E0B, #FBBF24, #F59E0B);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: shimmerG 3s linear infinite;
        }

        .grain {
          position: fixed; inset: 0; pointer-events: none; z-index: 0; opacity: .025;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
        }
      `}</style>

      <div className="grain" />

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 32px', overflow: 'hidden' }}>

        {/* Background orbs */}
        <div style={{ position: 'absolute', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(245,158,11,0.06) 0%, transparent 70%)', top: '-10%', right: '-10%', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(34,197,94,0.05) 0%, transparent 70%)', bottom: '5%', left: '-5%', pointerEvents: 'none' }} />
        {/* Grid */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(245,158,11,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(245,158,11,0.04) 1px, transparent 1px)', backgroundSize: '64px 64px', pointerEvents: 'none', opacity: 0.6 }} />

        <div style={{ maxWidth: 860, textAlign: 'center', position: 'relative', zIndex: 1 }}>

          {/* Admin badge */}
          <div className="hero-1" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 18px', borderRadius: 20, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', marginBottom: 32 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#F59E0B' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#F59E0B', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Private · Admin Reference Only</span>
          </div>

          <h1 className="hero-2" style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 700, fontSize: 'clamp(48px,7vw,88px)', color: '#F0F4FF', lineHeight: 1.0, letterSpacing: -2, margin: '0 0 8px' }}>
            Your money.<br />
            <span className="gold-text">Working harder.</span>
          </h1>

          <p className="hero-3" style={{ fontSize: 'clamp(16px,2vw,20px)', color: '#7A8AAA', lineHeight: 1.8, maxWidth: 580, margin: '24px auto 48px', fontWeight: 400 }}>
            Partner with MoneyfestLending and earn up to <strong style={{ color: '#F59E0B' }}>12% every 3 months</strong> — that's <strong style={{ color: '#22C55E' }}>72% per year</strong> — on capital deployed through our verified colleague lending program.
          </p>

          {/* Hero stats */}
          <div className="hero-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, maxWidth: 720, margin: '0 auto' }}>
            {[
              { value: 72, suffix: '%', label: 'Max annual return', color: '#22C55E' },
              { value: 3, suffix: ' months', label: 'Lock-in period', color: '#F59E0B' },
              { value: 5000, prefix: '₱', label: 'Minimum investment', color: '#60A5FA' },
              { value: 0, suffix: '%', label: 'Platform fees', color: '#a78bfa' },
            ].map((s, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '20px 12px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 700, fontSize: 32, color: s.color, lineHeight: 1, marginBottom: 6 }}>
                  <Counter target={s.value} prefix={s.prefix || ''} suffix={s.suffix || ''} />
                </div>
                <div style={{ fontSize: 11, color: '#4B5580', lineHeight: 1.4 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── VS BANKS ─────────────────────────────────────────── */}
      <section style={{ padding: '80px 32px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>

          <div ref={ref('vs-h')} className={`reveal ${visible['vs-h'] ? 'on' : ''}`} style={{ textAlign: 'center', marginBottom: 52 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 14px', borderRadius: 20, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', marginBottom: 16 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#EF4444', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Why not just use a bank?</span>
            </div>
            <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 700, fontSize: 'clamp(32px,5vw,52px)', color: '#F0F4FF', letterSpacing: -1, margin: '0 0 12px' }}>
              Banks keep the profits.<br /><span className="gold-text">We share them.</span>
            </h2>
            <p style={{ fontSize: 15, color: '#7A8AAA', maxWidth: 500, margin: '0 auto' }}>
              On ₱10,000 invested for 1 year. Numbers don't lie.
            </p>
          </div>

          <div ref={ref('vs-bars')} className={`reveal ${visible['vs-bars'] ? 'on' : ''}`} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {COMPARISONS.map((c, i) => (
              <div key={i} style={{ background: c.highlight ? 'rgba(34,197,94,0.05)' : 'rgba(255,255,255,0.02)', border: `1px solid ${c.highlight ? 'rgba(34,197,94,0.25)' : 'rgba(255,255,255,0.06)'}`, borderRadius: 14, padding: '18px 24px', display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 180 }}>
                  <div style={{ fontSize: 14, fontWeight: c.highlight ? 700 : 500, color: c.highlight ? '#F0F4FF' : '#7A8AAA' }}>{c.label}</div>
                  {c.note && <div style={{ fontSize: 11, color: '#4B5580', marginTop: 2 }}>{c.note}</div>}
                </div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ height: 8, background: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: visible['vs-bars'] ? c.bar + '%' : '0%', background: c.color, borderRadius: 4, transition: `width 1s ${i * 0.15}s ease` }} />
                  </div>
                </div>
                <div style={{ textAlign: 'right', minWidth: 100 }}>
                  <div style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 700, fontSize: 22, color: c.color }}>{c.annual}</div>
                  <div style={{ fontSize: 11, color: '#4B5580' }}>per year on ₱10K</div>
                </div>
              </div>
            ))}
          </div>

          <div ref={ref('vs-note')} className={`reveal ${visible['vs-note'] ? 'on' : ''}`} style={{ marginTop: 20, padding: '16px 22px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 12, fontSize: 13, color: '#7A8AAA', lineHeight: 1.7 }}>
            💡 <strong style={{ color: '#F59E0B' }}>Put simply:</strong> BDO and BPI savings accounts currently earn just 0.0625% per year — that's ₱6.25 on ₱10,000. Their time deposits aren't much better at 0.75–1.07%. They take your money, lend it out at 6–15%, and keep the difference. MoneyfestLending gives you up to ₱6,000 on the same ₱10,000 — every single year. Same concept — we just share the profit with you.
          </div>
        </div>
      </section>


      {/* ── HOW THE SPREAD WORKS ─────────────────────────────── */}
      <section style={{ padding: '80px 32px', borderTop: '1px solid rgba(255,255,255,0.04)', background: 'rgba(255,255,255,0.01)' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>

          <div ref={ref('spread-h')} className={`reveal ${visible['spread-h'] ? 'on' : ''}`} style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 14px', borderRadius: 20, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', marginBottom: 16 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#818CF8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Full Transparency</span>
            </div>
            <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 700, fontSize: 'clamp(32px,4vw,48px)', color: '#F0F4FF', letterSpacing: -1, margin: '0 0 14px' }}>
              Where does the <span className="gold-text">money flow?</span>
            </h2>
            <p style={{ fontSize: 15, color: '#7A8AAA', maxWidth: 520, margin: '0 auto', lineHeight: 1.7 }}>
              Borrowers pay 7% per month (14% total over the 2-month loan). Here is exactly where every peso goes — no hidden fees, no surprises.
            </p>
          </div>

          {/* Flow diagram */}
          <div ref={ref('spread-cards')} className={`reveal ${visible['spread-cards'] ? 'on' : ''}`}>

            {/* Top — Borrower pays */}
            <div style={{ textAlign: 'center', marginBottom: 0 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '10px 24px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, marginBottom: 0 }}>
                <img src="/list.png" alt="" style={{ width: 16, height: 16, objectFit: 'contain' }} />
                <span style={{ fontSize: 13, color: '#7A8AAA' }}>Borrower takes a <strong style={{ color: '#F0F4FF' }}>₱10,000 loan</strong></span>
              </div>
            </div>

            {/* Arrow down */}
            <div style={{ textAlign: 'center', fontSize: 24, color: '#4B5580', margin: '8px 0' }}>↓</div>

            {/* Main spread card */}
            <div style={{ background: 'linear-gradient(135deg, rgba(10,12,20,0.9), rgba(20,15,40,0.9))', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 24, padding: '36px 40px', position: 'relative', overflow: 'hidden', marginBottom: 20 }}>

              {/* Background glow */}
              <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(245,158,11,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />

              <div style={{ fontSize: 12, fontWeight: 700, color: '#4B5580', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 24, textAlign: 'center' }}>
                14% total interest split (7%/mo × 2 months)
              </div>

              {/* Three rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

                {/* Row 1 — Total */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '18px 24px', background: 'rgba(255,255,255,0.03)', borderRadius: '14px 14px 0 0', border: '1px solid rgba(255,255,255,0.07)', borderBottom: 'none' }}>
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <img src="/philippine-peso.png" alt="" style={{ width: 24, height: 24, objectFit: 'contain' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 700, fontSize: 18, color: '#F0F4FF' }}>Borrower pays</div>
                    <div style={{ fontSize: 12, color: '#4B5580', marginTop: 2 }}>Total interest on ₱10,000 loan</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 700, fontSize: 32, color: '#F0F4FF' }}>14%</div>
                    <div style={{ fontSize: 12, color: '#4B5580' }}>= ₱1,400 total (7%/mo × 2)</div>
                  </div>
                </div>

                {/* Divider */}
                <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(245,158,11,0.3), rgba(34,197,94,0.3), transparent)' }} />

                {/* Row 2 — Investor */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '18px 24px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderBottom: 'none', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: '#F59E0B', borderRadius: '0 2px 2px 0' }} />
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <img src="/giftbox.png" alt="" style={{ width: 24, height: 24, objectFit: 'contain' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 700, fontSize: 18, color: '#F59E0B' }}>You earn ← </div>
                    <div style={{ fontSize: 12, color: '#7A8AAA', marginTop: 2 }}>Your return for providing the capital</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 700, fontSize: 32, color: '#F59E0B' }}>10%</div>
                    <div style={{ fontSize: 12, color: '#7A8AAA' }}>= ₱1,000 per cycle (₱1,500 per 3 months)</div>
                  </div>
                </div>

                {/* Row 3 — Platform */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '18px 24px', background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '0 0 14px 14px', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: '#6366F1', borderRadius: '0 2px 2px 0' }} />
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <img src="/verified.png" alt="" style={{ width: 24, height: 24, objectFit: 'contain' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 700, fontSize: 18, color: '#818CF8' }}>Platform keeps ←</div>
                    <div style={{ fontSize: 12, color: '#7A8AAA', marginTop: 2 }}>Covers operations, risk management & technology</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 700, fontSize: 32, color: '#818CF8' }}>4%</div>
                    <div style={{ fontSize: 12, color: '#4B5580' }}>= ₱400 per cycle</div>
                  </div>
                </div>

              </div>
            </div>

            {/* What the 2% covers */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
              {[
                { icon: '/list.png',            label: 'Platform & Tech',     desc: 'The system you are using right now',       color: 'rgba(99,102,241,0.12)',  border: 'rgba(99,102,241,0.25)'  },
                { icon: '/warning.png',         label: 'Default Risk',        desc: 'Security Hold & penalties reduce default exposure',  color: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.2)'    },
                { icon: '/summary-check.png',   label: 'Collections',         desc: 'Admin time managing repayments',           color: 'rgba(34,197,94,0.08)',   border: 'rgba(34,197,94,0.2)'    },
                { icon: '/padlock.png',         label: 'Operations',          desc: 'ID verification, approvals, payouts',      color: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.2)'   },
              ].map((item, i) => (
                <div key={i} style={{ background: item.color, border: '1px solid ' + item.border, borderRadius: 14, padding: '18px 16px', textAlign: 'center' }}>
                  <img src={item.icon} alt="" style={{ width: 26, height: 26, objectFit: 'contain', marginBottom: 10 }} />
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#CBD5F0', marginBottom: 5 }}>{item.label}</div>
                  <div style={{ fontSize: 11, color: '#7A8AAA', lineHeight: 1.6 }}>{item.desc}</div>
                </div>
              ))}
            </div>

          </div>
        </div>
      </section>

      {/* ── TIERS ────────────────────────────────────────────── */}
      <section style={{ padding: '80px 32px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>

          <div ref={ref('tiers-h')} className={`reveal ${visible['tiers-h'] ? 'on' : ''}`} style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 14px', borderRadius: 20, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', marginBottom: 16 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#22C55E', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Investment Tiers</span>
            </div>
            <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 700, fontSize: 'clamp(32px,5vw,52px)', color: '#F0F4FF', letterSpacing: -1, margin: 0 }}>
              Choose your <span className="gold-text">position.</span>
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20 }}>
            {TIERS.map((t, i) => (
              <div key={i}
                ref={ref(`tier-${i}`)}
                className={`tier-card reveal d${i+1} ${visible[`tier-${i}`] ? 'on' : ''}`}
                style={{
                  background: t.featured ? `linear-gradient(145deg, ${t.bg}, rgba(0,0,0,0.2))` : t.bg,
                  border: `1px solid ${t.border}`,
                  borderRadius: 20, padding: '32px 28px', position: 'relative', overflow: 'hidden',
                  boxShadow: t.featured ? `0 0 40px ${t.glow}, 0 20px 40px rgba(0,0,0,0.3)` : '0 4px 20px rgba(0,0,0,0.2)',
                }}>
                {/* Glow top */}
                <div style={{ position: 'absolute', top: -30, left: '50%', transform: 'translateX(-50%)', width: 120, height: 120, borderRadius: '50%', background: `radial-gradient(circle, ${t.glow} 0%, transparent 70%)`, pointerEvents: 'none' }} />

                {t.featured && (
                  <div style={{ position: 'absolute', top: 16, right: 16, padding: '3px 10px', borderRadius: 20, background: t.color, fontSize: 10, fontWeight: 800, color: '#000', letterSpacing: '0.06em' }}>MOST POPULAR</div>
                )}

                <div style={{ fontSize: 12, fontWeight: 700, color: t.color, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>{t.label}</div>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 700, fontSize: 36, color: '#F0F4FF', marginBottom: 4 }}>{t.amount}</div>
                <div style={{ fontSize: 13, color: '#4B5580', marginBottom: 28 }}>minimum investment</div>

                {/* Rate */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
                  <div style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 700, fontSize: 56, color: t.color, lineHeight: 1 }}>{t.rate}</div>
                  <div style={{ fontSize: 13, color: '#4B5580' }}>per 3 months</div>
                </div>

                <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '20px 0' }} />

                {/* Stats */}
                {[
                  { label: 'You earn (3 months)', value: t.earn, color: t.color },
                  { label: 'Annual return', value: t.annual, color: '#F0F4FF' },
                  { label: 'Annual rate', value: t.annualRate, color: '#22C55E' },
                  { label: 'Lock-in period', value: '3 months', color: '#7A8AAA' },
                  { label: 'Platform fees', value: 'None', color: '#7A8AAA' },
                ].map((row, j) => (
                  <div key={j} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: j < 4 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                    <span style={{ fontSize: 12, color: '#4B5580' }}>{row.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: row.color }}>{row.value}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* 3-month cycle note */}
          <div ref={ref('cycle-note')} className={`reveal ${visible['cycle-note'] ? 'on' : ''}`} style={{ marginTop: 20, padding: '16px 22px', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.18)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 14 }}>
            <img src="/calendar.png" alt="cycle" style={{ width: 28, height: 28, objectFit: 'contain', flexShrink: 0 }} />
            <div style={{ fontSize: 13, color: '#7A8AAA', lineHeight: 1.7 }}>
              <strong style={{ color: '#F0F4FF' }}>How the 3-month cycle works:</strong> We run 1.5 lending cycles in 3 months (each loan is 2 months, charged at 7%/month). Your investment is deployed immediately, earns 14% total interest per cycle (2 months × 7%), then you receive your principal + returns at the end of month 3. Payouts are coordinated directly with the admin.
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────── */}
      <section style={{ padding: '80px 32px', borderTop: '1px solid rgba(255,255,255,0.04)', background: 'rgba(255,255,255,0.01)' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>

          <div ref={ref('how-h')} className={`reveal ${visible['how-h'] ? 'on' : ''}`} style={{ textAlign: 'center', marginBottom: 48 }}>
            <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 700, fontSize: 'clamp(32px,4vw,48px)', color: '#F0F4FF', letterSpacing: -1, margin: 0 }}>
              Simple. <span className="gold-text">Transparent.</span> Done.
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, position: 'relative' }}>
            <div style={{ position: 'absolute', top: 32, left: '12%', right: '12%', height: 1, background: 'linear-gradient(90deg,transparent,rgba(245,158,11,0.3),rgba(34,197,94,0.3),transparent)', pointerEvents: 'none' }} />
            {[
              { step: '01', icon: '/philippine-peso.png', title: 'Commit capital', desc: 'Tell the admin how much you want to invest and at which tier. Sign a simple written agreement.' },
              { step: '02', icon: '/startup.png', title: 'We deploy it', desc: 'Your funds are deployed as loans to verified colleagues through the MoneyfestLending platform.' },
              { step: '03', icon: '/calendar.png', title: 'Wait 3 months', desc: 'Borrowers repay every 5th and 20th. Each 2-month cycle earns 14% interest (7%/mo × 2). Your returns accumulate over 1.5 lending cycles.' },
              { step: '04', icon: '/giftbox.png', title: 'Collect returns', desc: 'Receive your original investment plus the agreed interest. Reinvest or cash out — your choice.' },
            ].map((s, i) => (
              <div key={i} ref={ref(`step-${i}`)} className={`reveal d${i+1} ${visible[`step-${i}`] ? 'on' : ''}`}
                style={{ textAlign: 'center', padding: '28px 18px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 18, position: 'relative', zIndex: 1 }}>
                <div style={{ position: 'relative', display: 'inline-block', marginBottom: 16 }}>
                  <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                    <img src={s.icon} alt="" style={{ width: 28, height: 28, objectFit: 'contain' }} />
                  </div>
                  <div style={{ position: 'absolute', top: -6, right: -8, width: 22, height: 22, borderRadius: '50%', background: 'linear-gradient(135deg,#F59E0B,#22C55E)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#000' }}>{s.step}</div>
                </div>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 700, fontSize: 16, color: '#F0F4FF', marginBottom: 8 }}>{s.title}</div>
                <div style={{ fontSize: 12, color: '#4B5580', lineHeight: 1.7 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PROJECTION CALCULATOR ────────────────────────────── */}
      <section style={{ padding: '80px 32px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div ref={ref('calc-h')} className={`reveal ${visible['calc-h'] ? 'on' : ''}`} style={{ textAlign: 'center', marginBottom: 48 }}>
            <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 700, fontSize: 'clamp(32px,4vw,48px)', color: '#F0F4FF', letterSpacing: -1, margin: 0 }}>
              What <span className="gold-text">₱10,000</span> becomes with reinvestment.
            </h2>
          </div>

          <div ref={ref('calc')} className={`reveal ${visible['calc'] ? 'on' : ''}`} style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            {[
              { period: '3 months',  capital: 10000, earn: 1500, total: 11500, rate: '10% × 1.5 cycles' },
              { period: '6 months',  capital: 11500, earn: 3225, total: 13225, rate: 'compounding' },
              { period: '9 months',  capital: 13225, earn: 5209, total: 15209, rate: 'compounding' },
              { period: '12 months', capital: 15209, earn: 7490, total: 17490, rate: '≈74.9% actual' },
            ].map((r, i) => (
              <div key={i} style={{ background: i === 3 ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.02)', border: `1px solid ${i === 3 ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.06)'}`, borderRadius: 16, padding: '22px 18px', textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#4B5580', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{r.period}</div>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 700, fontSize: 28, color: i === 3 ? '#22C55E' : '#F0F4FF', marginBottom: 4 }}>₱{r.total.toLocaleString()}</div>
                <div style={{ fontSize: 12, color: '#22C55E', marginBottom: 8 }}>+₱{r.earn.toLocaleString()} earned</div>
                <div style={{ fontSize: 10, color: '#4B5580' }}>{r.rate}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, fontSize: 11, color: '#4B5580', textAlign: 'center' }}>
            Based on 10% rate (₱10,000 Standard tier) with full reinvestment each cycle. Actual results may vary.
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────── */}
      <section style={{ padding: '80px 32px', borderTop: '1px solid rgba(255,255,255,0.04)', background: 'rgba(255,255,255,0.01)' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <div ref={ref('faq-h')} className={`reveal ${visible['faq-h'] ? 'on' : ''}`} style={{ textAlign: 'center', marginBottom: 40 }}>
            <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 700, fontSize: 'clamp(32px,4vw,48px)', color: '#F0F4FF', letterSpacing: -1, margin: 0 }}>
              Common <span className="gold-text">questions.</span>
            </h2>
          </div>

          <div ref={ref('faqs')} className={`reveal ${visible['faqs'] ? 'on' : ''}`} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {FAQS.map((f, i) => (
              <div key={i} className="faq-item"
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                style={{ background: openFaq === i ? 'rgba(245,158,11,0.06)' : 'rgba(255,255,255,0.02)', border: `1px solid ${openFaq === i ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.07)'}`, borderRadius: 14, padding: '18px 22px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: openFaq === i ? '#F59E0B' : '#F0F4FF' }}>{f.q}</div>
                  <div style={{ fontSize: 18, color: '#4B5580', flexShrink: 0, transform: openFaq === i ? 'rotate(45deg)' : 'none', transition: 'transform .2s' }}>+</div>
                </div>
                {openFaq === i && (
                  <div style={{ fontSize: 13, color: '#7A8AAA', lineHeight: 1.85, marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    {f.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ─────────────────────────────────────────── */}
      <section style={{ padding: '80px 32px 100px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <div style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
          <div ref={ref('cta')} className={`reveal ${visible['cta'] ? 'on' : ''}`}>
            <img src="/philippine-peso.png" alt="" style={{ width: 64, height: 64, objectFit: 'contain', marginBottom: 24, animation: 'floatY 3s ease-in-out infinite' }} />
            <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 700, fontSize: 'clamp(36px,5vw,60px)', color: '#F0F4FF', letterSpacing: -1.5, margin: '0 0 16px', lineHeight: 1.1 }}>
              Ready to put your<br /><span className="gold-text">money to work?</span>
            </h2>
            <p style={{ fontSize: 16, color: '#7A8AAA', lineHeight: 1.8, marginBottom: 36, maxWidth: 480, margin: '0 auto 36px' }}>
              Reach out to the admins via Microsoft Teams to get started. Investments are taken on a per-cycle basis and subject to available capital slots.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 40 }}>
              {[
                { initials: 'JP', name: 'John Paul Lacaron', gradient: 'linear-gradient(135deg,#3B82F6,#8B5CF6)' },
                { initials: 'CJ', name: 'Charlou June Ramil', gradient: 'linear-gradient(135deg,#14B8A6,#3B82F6)' },
              ].map(a => (
                <div key={a.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: a.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#fff' }}>{a.initials}</div>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#F0F4FF' }}>{a.name}</div>
                    <div style={{ fontSize: 11, color: '#4B5580' }}>Admin · Microsoft Teams</div>
                  </div>
                </div>
              ))}
            </div>
            {/* Legal disclaimer */}
            <div style={{ padding: '16px 24px', background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 12, fontSize: 11, color: '#4B5580', lineHeight: 1.8 }}>
              <strong style={{ color: '#EF4444' }}>Important Disclaimer:</strong> This is not a bank deposit and is not insured by PDIC. Returns are projected and not guaranteed. Past performance does not guarantee future results. This investment opportunity is offered strictly on a private, invitation-only basis to trusted individuals. By investing, you acknowledge understanding of the risks involved. MoneyfestLending reserves the right to decline any investment without disclosure of specific reasons.
            </div>
          </div>
        </div>
      </section>

    </div>
  )
}
