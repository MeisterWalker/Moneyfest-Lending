import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { usePageVisit } from '../hooks/usePageVisit'
import ChatBot from '../components/ChatBot'

export default function HomePage() {
  usePageVisit('home')
  const [interestRate, setInterestRate] = useState(0.07)
  const [visible, setVisible] = useState({})
  const sectionRefs = useRef({})

  useEffect(() => {
    supabase.from('settings').select('interest_rate').eq('id', 1).single()
      .then(({ data }) => { if (data?.interest_rate) setInterestRate(data.interest_rate) })
  }, [])

  // Intersection observer for scroll reveals
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) setVisible(prev => ({ ...prev, [e.target.dataset.id]: true }))
      })
    }, { threshold: 0.15 })
    Object.values(sectionRefs.current).forEach(el => { if (el) observer.observe(el) })
    return () => observer.disconnect()
  }, [])

  const ref = (id) => (el) => {
    sectionRefs.current[id] = el
    if (el) el.dataset.id = id
  }

  const features = [
    { icon: '/philippine-peso.png', title: `Only ${(interestRate * 100).toFixed(0)}% monthly interest`, desc: 'One of the lowest rates in Cebu — no hidden fees, no compounding, no surprise deductions ever.' },
    { icon: '/startup.png', title: 'Pre-qualify in minutes', desc: 'Fill out a simple form, get approved fast, and have funds released straight to you.' },
    { icon: '/giftbox.png', title: 'Earn Rebate Credits', desc: 'Pay your final installment early and get automatically rewarded with Rebate Credits.' },
    { icon: '/padlock.png', title: 'Private & exclusive', desc: 'An internal program just for our team — not open to the public, no outsiders.' },
    { icon: '/handshake.png', title: 'No collectors, no stress', desc: 'Everything is handled digitally — payments, proofs, and approvals online.' },
    { icon: '/verified.png', title: 'Transparent & fair', desc: 'Fixed rates, clear schedules, zero surprises. What you see is exactly what you get.' },
  ]

  const stats = [
    { value: `${(interestRate * 100).toFixed(0)}%`, label: 'Monthly interest rate', sub: 'No compounding' },
    { value: '₱10K', label: 'Maximum loan', sub: 'For trusted borrowers' },
    { value: '4–6', label: 'Easy installments', sub: 'Over 2 or 3 months' },
    { value: '14hrs', label: 'Avg. approval time', sub: 'Manual review by admin' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#07090F', fontFamily: 'DM Sans, sans-serif', overflowX: 'hidden' }}>

      <style>{`
        @media (max-width: 768px) {
          .hero-stats { grid-template-columns: repeat(2,1fr) !important; }
          .hero-ctas { flex-direction: column !important; align-items: stretch !important; }
          .hero-ctas a { justify-content: center !important; }
          .rewards-tier-grid { grid-template-columns: repeat(2,1fr) !important; }
          .rewards-bottom-grid { grid-template-columns: 1fr !important; }
          .how-steps-grid { grid-template-columns: repeat(2,1fr) !important; }
          .features-grid { grid-template-columns: repeat(2,1fr) !important; }
        }
        @media (max-width: 480px) {
          .hero-stats { grid-template-columns: repeat(2,1fr) !important; }
          .rewards-tier-grid { grid-template-columns: 1fr !important; }
          .how-steps-grid { grid-template-columns: 1fr !important; }
          .features-grid { grid-template-columns: 1fr !important; }
        }
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Syne:wght@700;800;900&display=swap');

        @keyframes heroFade { from { opacity: 0; transform: translateY(32px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes float { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-10px); } }
        @keyframes pulse-ring { 0% { transform: scale(0.9); opacity: 0.6; } 100% { transform: scale(1.4); opacity: 0; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }

        .hero-title { animation: heroFade 0.9s ease forwards; opacity: 0; }
        .hero-sub   { animation: heroFade 0.9s 0.2s ease forwards; opacity: 0; }
        .hero-ctas  { animation: heroFade 0.9s 0.4s ease forwards; opacity: 0; }
        .hero-stats { animation: heroFade 0.9s 0.6s ease forwards; opacity: 0; }
        .hero-logo  { animation: float 4s ease-in-out infinite; }

        .reveal { opacity: 0; transform: translateY(36px); transition: opacity 0.7s ease, transform 0.7s ease; }
        .reveal.visible { opacity: 1; transform: translateY(0); }
        .reveal-delay-1 { transition-delay: 0.1s; }
        .reveal-delay-2 { transition-delay: 0.2s; }
        .reveal-delay-3 { transition-delay: 0.3s; }
        .reveal-delay-4 { transition-delay: 0.4s; }
        .reveal-delay-5 { transition-delay: 0.5s; }

        .feature-card { transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease; cursor: default; }
        .feature-card:hover { transform: translateY(-4px); border-color: rgba(99,102,241,0.4) !important; box-shadow: 0 12px 32px rgba(99,102,241,0.15); }

        .cta-primary { transition: all 0.2s ease; }
        .cta-primary:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(99,102,241,0.4); }
        .cta-secondary { transition: all 0.2s ease; }
        .cta-secondary:hover { border-color: rgba(255,255,255,0.3) !important; color: #F0F4FF !important; }

        .shimmer-text {
          background: linear-gradient(90deg, #60a5fa, #a78bfa, #34d399, #60a5fa);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: shimmer 4s linear infinite;
        }

        .mesh-bg {
          position: absolute; inset: 0; pointer-events: none;
          background:
            radial-gradient(ellipse 60% 50% at 20% 30%, rgba(99,102,241,0.12) 0%, transparent 60%),
            radial-gradient(ellipse 50% 40% at 80% 70%, rgba(139,92,246,0.1) 0%, transparent 60%),
            radial-gradient(ellipse 40% 60% at 60% 10%, rgba(59,130,246,0.08) 0%, transparent 60%);
        }

        .grid-bg {
          position: absolute; inset: 0; pointer-events: none; opacity: 0.03;
          background-image: linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px);
          background-size: 48px 48px;
        }

        .stat-card { transition: all 0.2s ease; }
        .stat-card:hover { background: rgba(99,102,241,0.1) !important; border-color: rgba(99,102,241,0.3) !important; }
      `}</style>

      {/* ── NAV ─────────────────────────────────────────────── */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(7,9,15,0.85)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0 16px', overflow: 'hidden' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/favicon-96x96.png" alt="MoneyfestLending" style={{ width: 32, height: 32, objectFit: 'contain' }} />
            <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 17, color: '#F0F4FF', letterSpacing: -0.3 }}>
              Moneyfest<span className="shimmer-text">Lending</span>
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <a href="/faq" className="nav-lh" style={{ padding: '8px 16px', borderRadius: 9, background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#7A8AAA', fontSize: 13, fontWeight: 600, textDecoration: 'none', transition: 'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#F0F4FF'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#7A8AAA'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}>
              <img src="/faq.png" alt="faq" style={{ width: 13, height: 13, objectFit: 'contain', marginRight: 6, verticalAlign: 'middle' }} />FAQ
            </a>
            <a href="/partners" className="nav-lh" style={{ padding: '8px 16px', borderRadius: 9, background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#7A8AAA', fontSize: 13, fontWeight: 600, textDecoration: 'none', transition: 'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#F0F4FF'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#7A8AAA'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}>
              Work With Us
            </a>
            <a href="/contact" className="nav-lh" style={{ padding: '8px 16px', borderRadius: 9, background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#7A8AAA', fontSize: 13, fontWeight: 600, textDecoration: 'none', transition: 'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#F0F4FF'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#7A8AAA'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}>
              Contact Us
            </a>
            <a href="/portal" className="nav-lh" style={{ padding: '8px 16px', borderRadius: 9, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#CBD5F0', fontSize: 13, fontWeight: 600, textDecoration: 'none', transition: 'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#F0F4FF' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#CBD5F0' }}>
              My Portal
            </a>
            <a href="/apply" className="cta-primary" style={{ padding: '8px 18px', borderRadius: 9, background: 'linear-gradient(135deg,#6366F1,#8B5CF6)', color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none', fontFamily: 'Syne, sans-serif' }}>
              Apply Now
            </a>
          </div>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────────── */}
      <section style={{ position: 'relative', minHeight: '92vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 32px', overflow: 'hidden' }}>
        <div className="mesh-bg" />
        <div className="grid-bg" />

        {/* Glowing orbs */}
        <div style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)', top: '10%', left: '-5%', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)', bottom: '15%', right: '5%', pointerEvents: 'none' }} />

        <div style={{ maxWidth: 780, textAlign: 'center', position: 'relative', zIndex: 1 }}>

          {/* Badge */}
          <div className="hero-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px', borderRadius: 20, background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)', marginBottom: 28 }}>
            <img src="/padlock.png" alt="" style={{ width: 14, height: 14, objectFit: 'contain' }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#a78bfa', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Exclusive · Internal Program</span>
          </div>

          {/* Main heading */}
          <h1 className="hero-title" style={{ fontFamily: 'Syne, sans-serif', fontWeight: 900, fontSize: 'clamp(40px, 7vw, 72px)', color: '#F0F4FF', lineHeight: 1.08, letterSpacing: -2, margin: '0 0 12px' }}>
            Your salary<br />
            <span className="shimmer-text">shouldn't be</span><br />
            your ceiling.
          </h1>

          <p className="hero-sub" style={{ fontSize: 'clamp(15px, 2vw, 18px)', color: '#7A8AAA', lineHeight: 1.8, maxWidth: 560, margin: '0 auto 36px', fontWeight: 400 }}>
            A private micro-lending program built by and for our team. Whether it's a medical bill, an unexpected expense, or something you've been wanting — we've got you covered.
          </p>

          {/* CTAs */}
          <div className="hero-ctas" style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 60 }}>
            <a href="/apply" className="cta-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '15px 32px', borderRadius: 12, background: 'linear-gradient(135deg,#6366F1,#8B5CF6)', color: '#fff', textDecoration: 'none', fontSize: 15, fontWeight: 700, fontFamily: 'Syne, sans-serif' }}>
              <img src="/startup.png" alt="" style={{ width: 18, height: 18, objectFit: 'contain' }} />
              Pre-qualify Now
            </a>
            <a href="/portal" className="cta-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '15px 28px', borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', color: '#CBD5F0', textDecoration: 'none', fontSize: 15, fontWeight: 600 }}>
              <img src="/padlock.png" alt="" style={{ width: 16, height: 16, objectFit: 'contain' }} />
              My Portal
            </a>
            <a href="/faq" className="cta-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '15px 28px', borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', color: '#CBD5F0', textDecoration: 'none', fontSize: 15, fontWeight: 600 }}>
              <img src="/faq.png" alt="" style={{ width: 16, height: 16, objectFit: 'contain' }} />
              Learn More
            </a>
          </div>

          {/* Stats row */}
          <div className="hero-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, maxWidth: 700, margin: '0 auto' }}>
            {stats.map((s, i) => (
              <div key={i} className="stat-card" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '16px 12px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 900, fontSize: 26, color: '#F0F4FF', letterSpacing: -1, marginBottom: 3 }}>{s.value}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#CBD5F0', marginBottom: 2 }}>{s.label}</div>
                <div style={{ fontSize: 11, color: '#4B5580' }}>{s.sub}</div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ── CHOOSE YOUR LOAN ─────────────────────────────────── */}
      <section style={{ padding: '80px 32px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 14px', borderRadius: 20, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', marginBottom: 16 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#F59E0B', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Two Loan Types</span>
            </div>
            <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 900, fontSize: 'clamp(28px,4vw,44px)', color: '#F0F4FF', letterSpacing: -1, margin: '0 0 12px' }}>
              Pick the right loan<br />for your situation.
            </h2>
            <p style={{ fontSize: 15, color: '#7A8AAA', maxWidth: 480, margin: '0 auto', lineHeight: 1.7 }}>
              Need cash fast for a few weeks? QuickLoan. Need more for a bigger expense over 2–3 months? Installment Loan. Both are fair, digital, and exclusive to our team.
            </p>
          </div>

          <div className="loan-cards-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, maxWidth: 860, margin: '0 auto' }}>

            {/* Installment Loan card */}
            <div style={{ background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 24, padding: '32px 28px' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginBottom: 20, padding: '5px 14px', borderRadius: 20, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)' }}>
                <img src="/money.png" alt="" style={{ width: 14, height: 14, objectFit: 'contain' }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: '#60A5FA', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Installment Loan</span>
              </div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 900, fontSize: 36, color: '#F0F4FF', letterSpacing: -1, marginBottom: 4 }}>Up to ₱10,000</div>
              <div style={{ fontSize: 13, color: '#7A8AAA', marginBottom: 24 }}>7% monthly · 2–3 month term</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
                {[
                  '4 or 6 semi-monthly installments',
                  'Pay every 5th & 20th of the month',
                  'Fixed repayment — no surprises',
                  'Earn loyalty tiers & higher limits',
                  'Security Hold returned after full payment',
                ].map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, fontSize: 13, color: '#8892B0' }}>
                    <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                      <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#60A5FA' }} />
                    </div>
                    {f}
                  </div>
                ))}
              </div>
              <div style={{ padding: '12px 16px', background: 'rgba(59,130,246,0.08)', borderRadius: 12, fontSize: 12, color: '#60A5FA', marginBottom: 20 }}>
                💡 Best for: Bills, tuition, rent, medical — anything that needs a bigger amount repaid gradually.
              </div>
              <a href="/apply" style={{ display: 'block', textAlign: 'center', padding: '13px', borderRadius: 12, background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', color: '#60A5FA', textDecoration: 'none', fontSize: 14, fontWeight: 700, fontFamily: 'Syne, sans-serif' }}>
                Apply for Installment Loan →
              </a>
            </div>

            {/* QuickLoan card */}
            <div style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 24, padding: '32px 28px', position: 'relative' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginBottom: 20, padding: '5px 14px', borderRadius: 20, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}>
                <span style={{ fontSize: 13 }}>⚡</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#F59E0B', letterSpacing: '0.08em', textTransform: 'uppercase' }}>QuickLoan</span>
              </div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 900, fontSize: 36, color: '#F0F4FF', letterSpacing: -1, marginBottom: 4 }}>Up to ₱3,000</div>
              <div style={{ fontSize: 13, color: '#7A8AAA', marginBottom: 24 }}>10% monthly · pay any time · daily interest</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
                {[
                  'Pay toward principal anytime — reduces your daily interest instantly',
                  'Target due: Day 15 from release',
                  '₱10/day on ₱3,000 · ₱3.33/day on ₱1,000',
                  '₱100 extension fee if Day 15 is missed',
                  'No Security Hold — receive full amount',
                ].map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, fontSize: 13, color: '#8892B0' }}>
                    <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                      <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#F59E0B' }} />
                    </div>
                    {f}
                  </div>
                ))}
              </div>
              <div style={{ padding: '12px 16px', background: 'rgba(245,158,11,0.08)', borderRadius: 12, fontSize: 12, color: '#F59E0B', marginBottom: 20 }}>
                💡 Best for: Short cash gaps — a week before payday, a quick emergency, something small and immediate.
              </div>
              <a href="/apply" style={{ display: 'block', textAlign: 'center', padding: '13px', borderRadius: 12, background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.35)', color: '#F59E0B', textDecoration: 'none', fontSize: 14, fontWeight: 700, fontFamily: 'Syne, sans-serif' }}>
                Apply for QuickLoan →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ────────────────────────────────────────── */}
      <section style={{ padding: '80px 32px', position: 'relative' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>

          <div ref={ref('features-header')} className={`reveal ${visible['features-header'] ? 'visible' : ''}`} style={{ textAlign: 'center', marginBottom: 52 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 14px', borderRadius: 20, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', marginBottom: 16 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#22C55E', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Why MoneyfestLending</span>
            </div>
            <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 900, fontSize: 'clamp(28px, 4vw, 44px)', color: '#F0F4FF', letterSpacing: -1, margin: '0 0 12px' }}>
              Unlike <em style={{ fontStyle: 'italic', color: '#6366F1' }}>anything</em> else in Cebu.
            </h2>
            <p style={{ fontSize: 16, color: '#7A8AAA', maxWidth: 500, margin: '0 auto', lineHeight: 1.7 }}>
              No <em>5-6</em> schemes. No loan sharks. No predatory rates. Just a fair, digital, team-first lending program.
            </p>
          </div>

          <div className="features-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {features.map((f, i) => (
              <div
                key={i}
                ref={ref(`feat-${i}`)}
                className={`feature-card reveal reveal-delay-${i % 3 + 1} ${visible[`feat-${i}`] ? 'visible' : ''}`}
                style={{ background: 'linear-gradient(145deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, padding: '26px 24px' }}
              >
                <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18, padding: 8 }}>
                  <img src={f.icon} alt={f.title} style={{ width: 28, height: 28, objectFit: 'contain' }} />
                </div>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 15, color: '#F0F4FF', marginBottom: 8 }}>{f.title}</div>
                <div style={{ fontSize: 13, color: '#7A8AAA', lineHeight: 1.7 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* ── REWARDS & TIERS ─────────────────────────────────── */}
      <section style={{ padding: '80px 32px' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>

          {/* Header */}
          <div ref={ref('rewards-header')} className={`reveal ${visible['rewards-header'] ? 'visible' : ''}`} style={{ textAlign: 'center', marginBottom: 52 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 14px', borderRadius: 20, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', marginBottom: 16 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#F59E0B', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Loyalty Rewards</span>
            </div>
            <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 900, fontSize: 'clamp(28px,4vw,44px)', color: '#F0F4FF', letterSpacing: -1, margin: '0 0 14px', lineHeight: 1.1 }}>
              The more you pay,<br />
              <span style={{ background: 'linear-gradient(90deg,#F59E0B,#22C55E)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>the more you earn.</span>
            </h2>
            <p style={{ fontSize: 16, color: '#7A8AAA', maxWidth: 520, margin: '0 auto', lineHeight: 1.7 }}>
              MoneyfestLending rewards good borrowers with lower Security Hold rates, higher loan limits, and exclusive perks — automatically.
            </p>
          </div>

          {/* Tier Cards */}
          <div ref={ref('tiers')} className={`reveal ${visible['tiers'] ? 'visible' : ''}`} style={{ position: 'relative', marginBottom: 24 }}>
            {/* Connector arrow line */}
            <div style={{ position: 'absolute', top: 52, left: '12%', right: '12%', height: 2, background: 'linear-gradient(90deg,#7A8AAA,#F59E0B,#3B82F6,#8B5CF6)', borderRadius: 1, zIndex: 0, pointerEvents: 'none' }} />
            {/* Arrow heads */}
            {[33, 66].map((pos, i) => (
              <div key={i} style={{ position: 'absolute', top: 44, left: pos + '%', zIndex: 1, fontSize: 16, color: '#4B5580', pointerEvents: 'none' }}>›</div>
            ))}

            <div className="rewards-tier-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, position: 'relative', zIndex: 1 }}>
              {[
                { badge: '🌱', tier: 'New', hold: '10%', limit: '₱5,000', loans: 'Starting', color: '#7A8AAA', bg: 'rgba(122,138,170,0.08)', border: 'rgba(122,138,170,0.2)', score: '750', perks: ['Standard access', 'Apply immediately', '10% Security Hold'] },
                { badge: '⭐', tier: 'Trusted', hold: '8%', limit: '₱7,000', loans: '1 clean loan', color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.3)', score: '835+', perks: ['Hold reduced to 8%', 'Limit raised to ₱7K', '1 clean loan needed'] },
                { badge: '🤝', tier: 'Reliable', hold: '6%', limit: '₱9,000', loans: '2 clean loans', color: '#3B82F6', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.3)', score: '920+', perks: ['Hold reduced to 6%', 'Limit raised to ₱9K', 'Priority processing'] },
                { badge: '👑', tier: 'VIP', hold: '5%', limit: '₱10,000', loans: '3 clean loans', color: '#8B5CF6', bg: 'rgba(139,92,246,0.1)', border: 'rgba(139,92,246,0.4)', score: '1000', perks: ['Lowest hold — just 5%', 'Max limit ₱10K', 'Top borrower status'] },
              ].map((t, i) => (
                <div key={i} style={{ background: t.bg, border: `1px solid ${t.border}`, borderRadius: 20, padding: '28px 20px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
                  {/* Glow */}
                  <div style={{ position: 'absolute', top: -20, left: '50%', transform: 'translateX(-50%)', width: 80, height: 80, borderRadius: '50%', background: `radial-gradient(circle, ${t.color}22 0%, transparent 70%)`, pointerEvents: 'none' }} />
                  {/* Badge */}
                  <div style={{ fontSize: 36, marginBottom: 10 }}>{t.badge}</div>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 900, fontSize: 16, color: t.color, marginBottom: 4 }}>{t.tier}</div>
                  <div style={{ fontSize: 11, color: '#4B5580', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t.loans}</div>

                  {/* Hold & Limit */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                    <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 10, padding: '10px 8px' }}>
                      <div style={{ fontSize: 10, color: '#4B5580', marginBottom: 3, textTransform: 'uppercase' }}>Hold</div>
                      <div style={{ fontFamily: 'Syne', fontWeight: 900, fontSize: 20, color: t.color }}>{t.hold}</div>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 10, padding: '10px 8px' }}>
                      <div style={{ fontSize: 10, color: '#4B5580', marginBottom: 3, textTransform: 'uppercase' }}>Limit</div>
                      <div style={{ fontFamily: 'Syne', fontWeight: 900, fontSize: 13, color: '#F0F4FF', marginTop: 3 }}>{t.limit}</div>
                    </div>
                  </div>

                  {/* Perks */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {t.perks.map((p, j) => (
                      <div key={j} style={{ fontSize: 11, color: '#7A8AAA', display: 'flex', alignItems: 'center', gap: 5, textAlign: 'left' }}>
                        <div style={{ width: 5, height: 5, borderRadius: '50%', background: t.color, flexShrink: 0 }} />
                        {p}
                      </div>
                    ))}
                  </div>

                  {/* Score badge */}
                  <div style={{ marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 20, background: 'rgba(0,0,0,0.25)', border: `1px solid ${t.border}`, fontSize: 10, color: t.color, fontWeight: 700 }}>
                    Score {t.score}{t.score === '750' ? ' (Start)' : '+'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom callouts */}
          <div ref={ref('rewards-bottom')} className={`reveal rewards-bottom-grid ${visible['rewards-bottom'] ? 'visible' : ''}`} style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 28 }}>
            {[
              { icon: '/giftbox.png', text: 'Security Hold drops from 10% down to just 5% as you level up', color: '#F59E0B' },
              { icon: '/philippine-peso.png', text: 'Loan limit grows from ₱5,000 all the way up to ₱10,000', color: '#22C55E' },
              { icon: '/verified.png', text: 'Most borrowers reach ⭐ Trusted after just 1 clean loan', color: '#3B82F6' },
            ].map((c, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14 }}>
                <img src={c.icon} alt="" style={{ width: 28, height: 28, objectFit: 'contain', flexShrink: 0 }} />
                <div style={{ fontSize: 13, color: '#8892B0', lineHeight: 1.6 }}>{c.text}</div>
              </div>
            ))}
          </div>

          {/* CTA nudge */}
          <div ref={ref('rewards-cta')} className={`reveal ${visible['rewards-cta'] ? 'visible' : ''}`} style={{ textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '14px 28px', borderRadius: 14, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
              <span style={{ fontSize: 13, color: '#8892B0' }}>Start at 🌱 New today —</span>
              <a href="/apply" style={{ fontSize: 13, fontWeight: 700, color: '#a78bfa', textDecoration: 'none' }}>work your way to 👑 VIP →</a>
            </div>
          </div>

        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────────── */}
      <section style={{ padding: '80px 32px', background: 'rgba(255,255,255,0.01)', borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <div ref={ref('how-header')} className={`reveal ${visible['how-header'] ? 'visible' : ''}`} style={{ textAlign: 'center', marginBottom: 52 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 14px', borderRadius: 20, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', marginBottom: 16 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#60A5FA', letterSpacing: '0.08em', textTransform: 'uppercase' }}>How it works</span>
            </div>
            <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 900, fontSize: 'clamp(28px, 4vw, 44px)', color: '#F0F4FF', letterSpacing: -1, margin: 0 }}>
              Simple. Fast. Done.
            </h2>
          </div>

          <div className="how-steps-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, position: 'relative' }}>
            {/* Connector line */}
            <div style={{ position: 'absolute', top: 36, left: '12.5%', right: '12.5%', height: 1, background: 'linear-gradient(90deg,transparent,rgba(99,102,241,0.3),rgba(139,92,246,0.3),transparent)', pointerEvents: 'none' }} />
            {[
              { step: '01', icon: '/list.png', title: 'Fill the form', desc: 'Enter your details, upload a valid ID, and choose your loan amount.' },
              { step: '02', icon: '/summary-check.png', title: 'Admin reviews', desc: 'Our team checks your application — usually within 14 hours (manual review by admin).' },
              { step: '03', icon: '/payment-method.png', title: 'Funds released', desc: 'Once approved, funds are released on the next cutoff date.' },
              { step: '04', icon: '/calendar.png', title: 'Pay in 4 cuts', desc: 'Pay every 5th and 20th. Pay early on your last and earn Rebate Credits!' },
            ].map((s, i) => (
              <div key={i} ref={ref(`step-${i}`)} className={`reveal reveal-delay-${i + 1} ${visible[`step-${i}`] ? 'visible' : ''}`}
                style={{ textAlign: 'center', padding: '28px 20px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18 }}>
                <div style={{ position: 'relative', display: 'inline-block', marginBottom: 16 }}>
                  <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg,rgba(99,102,241,0.2),rgba(139,92,246,0.15))', border: '1px solid rgba(99,102,241,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                    <img src={s.icon} alt={s.title} style={{ width: 28, height: 28, objectFit: 'contain' }} />
                  </div>
                  <div style={{ position: 'absolute', top: -6, right: -10, width: 22, height: 22, borderRadius: '50%', background: 'linear-gradient(135deg,#6366F1,#8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#fff', fontFamily: 'Syne' }}>{s.step}</div>
                </div>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 14, color: '#F0F4FF', marginBottom: 8 }}>{s.title}</div>
                <div style={{ fontSize: 12, color: '#7A8AAA', lineHeight: 1.7 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── REBATE CREDITS CALLOUT ───────────────────────────── */}
      <section ref={ref('rebate')} className={`reveal ${visible['rebate'] ? 'visible' : ''}`} style={{ padding: '80px 32px' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <div style={{ background: 'linear-gradient(135deg,rgba(34,197,94,0.08),rgba(59,130,246,0.06))', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 24, padding: '48px 52px', display: 'flex', alignItems: 'center', gap: 48, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 280 }}>
              <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 900, fontSize: 'clamp(24px,3.5vw,38px)', color: '#F0F4FF', letterSpacing: -1, margin: '0 0 16px', lineHeight: 1.15 }}>
                Pay early.<br />
                <span style={{ color: '#22C55E' }}>Get rewarded.</span>
              </h2>
              <p style={{ fontSize: 14, color: '#7A8AAA', lineHeight: 1.8, marginBottom: 24 }}>
                MoneyfestLending is the only workplace lending program that gives you back a portion of your interest when you pay ahead of schedule. Earn Rebate Credits automatically — no forms, no requests.
              </p>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {[
                  { label: 'Pay final installment at least 1–2 weeks early', value: '1% back', color: '#22C55E' },
                ].map((r, i) => (
                  <div key={i} style={{ padding: '10px 18px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: `1px solid ${r.color}33` }}>
                    <div style={{ fontFamily: 'Syne', fontWeight: 900, fontSize: 18, color: r.color }}>{r.value}</div>
                    <div style={{ fontSize: 11, color: '#7A8AAA', marginTop: 2 }}>{r.label}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ flexShrink: 0, textAlign: 'center' }}>
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <div style={{ position: 'absolute', inset: -16, borderRadius: '50%', background: 'rgba(34,197,94,0.08)', animation: 'pulse-ring 2s ease-out infinite' }} />
                <img src="/giftbox.png" alt="rebate" className="hero-logo" style={{ width: 120, height: 120, objectFit: 'contain', position: 'relative', zIndex: 1 }} />
              </div>
              <div style={{ marginTop: 16, fontFamily: 'Syne', fontWeight: 800, fontSize: 13, color: '#22C55E' }}>Rebate Credits</div>
              <div style={{ fontSize: 11, color: '#4B5580', marginTop: 4 }}>Min. ₱500 to withdraw</div>
            </div>
          </div>
        </div>
      </section>

      {/* AI Assistant Callout */}
      <section style={{ padding: '0 32px', marginBottom: 20 }}>
        <div style={{ maxWidth: 700, margin: '0 auto', background: '#0E1320', border: '1.5px solid rgba(139,92,246,0.35)', borderRadius: 24, padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 15, color: '#F0F4FF', fontWeight: 600, lineHeight: 1.6 }}>
            💬 Have questions? Ask SaulX, our AI assistant — available 24/7 in the chat bubble below. Speaks English and Bisaya!
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ────────────────────────────────────────── */}
      <section ref={ref('cta')} className={`reveal ${visible['cta'] ? 'visible' : ''}`} style={{ padding: '80px 32px 100px' }}>
        <div style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
          <img src="/verified.png" alt="" className="hero-logo" style={{ width: 64, height: 64, objectFit: 'contain', marginBottom: 24 }} />
          <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 900, fontSize: 'clamp(28px,5vw,52px)', color: '#F0F4FF', letterSpacing: -1.5, margin: '0 0 16px', lineHeight: 1.1 }}>
            Ready to get started?
          </h2>
          <p style={{ fontSize: 16, color: '#7A8AAA', lineHeight: 1.8, marginBottom: 36, maxWidth: 480, margin: '0 auto 36px' }}>
            Join your workmates who already trust MoneyfestLending for fast, fair, and stress-free borrowing.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="/apply" className="cta-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '16px 36px', borderRadius: 12, background: 'linear-gradient(135deg,#6366F1,#8B5CF6)', color: '#fff', textDecoration: 'none', fontSize: 16, fontWeight: 700, fontFamily: 'Syne, sans-serif' }}>
              <img src="/startup.png" alt="" style={{ width: 18, height: 18, objectFit: 'contain' }} />
              Pre-qualify Now
            </a>
            <a href="/portal" className="cta-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '16px 28px', borderRadius: 12, background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: '#CBD5F0', textDecoration: 'none', fontSize: 16, fontWeight: 600 }}>
              <img src="/padlock.png" alt="" style={{ width: 16, height: 16, objectFit: 'contain' }} />
              Access My Portal
            </a>
          </div>
          <div style={{ marginTop: 48, fontSize: 12, color: '#4B5580' }}>
            <img src="/padlock.png" alt="" style={{ width: 12, height: 12, objectFit: 'contain', marginRight: 5, verticalAlign: 'middle', opacity: 0.5 }} />
            Private & exclusive — for our team members only. Not open to the public.{' '}·{' '}
            <a href="/privacy" style={{ color: '#4B5580', textDecoration: 'underline' }}>Privacy Notice</a>
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────── */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '28px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src="/favicon-96x96.png" alt="" style={{ width: 22, height: 22, objectFit: 'contain' }} />
          <span style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 13, color: '#4B5580' }}>MoneyfestLending</span>
          <span style={{ fontSize: 12, color: '#4B5580' }}>· Workplace Lending Program</span>
        </div>
        <div style={{ display: 'flex', gap: 20 }}>
          {[{ label: 'Apply', href: '/apply' }, { label: 'My Portal', href: '/portal' }, { label: 'FAQ', href: '/faq' }, { label: 'Contact Us', href: '/contact' }, { label: 'Privacy Notice', href: '/privacy' }, { label: 'Terms & Conditions', href: '/terms' }].map((l, i) => (
            <a key={i} href={l.href} style={{ fontSize: 12, color: '#4B5580', textDecoration: 'none', transition: 'color 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.color = '#7A8AAA'}
              onMouseLeave={e => e.currentTarget.style.color = '#4B5580'}>{l.label}</a>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <div style={{ fontSize: 12, color: '#4B5580' }}>"Borrow smart. Pay early. Get rewarded."</div>
          <div style={{ fontSize: 11, color: '#323a52', display: 'flex', alignItems: 'center', gap: 5 }}>
            <span>Designed & developed by</span>
            <span style={{
              fontFamily: 'Space Grotesk', fontWeight: 700, color: '#3d4766',
              background: 'linear-gradient(90deg,#3B82F6,#8B5CF6)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
            }}>
              John Paul Lacaron
            </span>
          </div>
        </div>
      </footer>
      <ChatBot />
    </div>
  )
}
