import { useState, useEffect, useRef } from 'react'
import { usePageVisit } from '../hooks/usePageVisit'

function useCountUp(target, duration = 1800, start = false) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!start) return
    const steps = 60
    const step = target / steps
    let current = 0
    const interval = setInterval(() => {
      current += step
      if (current >= target) { setVal(target); clearInterval(interval) }
      else setVal(Math.floor(current))
    }, duration / steps)
    return () => clearInterval(interval)
  }, [target, duration, start])
  return val
}

function StatCard({ value, suffix, label, color, bg, border, started }) {
  const num = useCountUp(value, 1600, started)
  return (
    <div style={{ textAlign: 'center', padding: '28px 20px', background: bg, border: `1px solid ${border}`, borderRadius: 18 }}>
      <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 900, fontSize: 44, color, lineHeight: 1, marginBottom: 8 }}>
        {num.toLocaleString()}{suffix}
      </div>
      <div style={{ fontSize: 13, color: '#7A8AAA', lineHeight: 1.5 }}>{label}</div>
    </div>
  )
}

export default function PartnersPage() {
  usePageVisit('partners')
  const [statsVisible, setStatsVisible] = useState(false)
  const statsRef = useRef(null)

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setStatsVisible(true) }, { threshold: 0.3 })
    if (statsRef.current) obs.observe(statsRef.current)
    return () => obs.disconnect()
  }, [])

  const stats = [
    { value: 98, suffix: '%', label: 'Repayment success rate across active loans', color: '#22C55E', bg: 'rgba(34,197,94,0.05)', border: 'rgba(34,197,94,0.15)' },
    { value: 12, suffix: 'hrs', label: 'Average admin response time for borrower queries', color: '#60A5FA', bg: 'rgba(59,130,246,0.05)', border: 'rgba(59,130,246,0.15)' },
    { value: 0, suffix: ' defaults', label: 'Loan defaults since program inception', color: '#a78bfa', bg: 'rgba(139,92,246,0.05)', border: 'rgba(139,92,246,0.15)' },
    { value: 7, suffix: '%/mo', label: 'Fixed monthly interest — transparent and compliant with RA 3765', color: '#F59E0B', bg: 'rgba(245,158,11,0.05)', border: 'rgba(245,158,11,0.15)' },
  ]

  const pillars = [
    {
      icon: '🏗️',
      title: 'Built Infrastructure',
      desc: 'A fully operational lending platform with borrower portal, credit scoring, automated installment tracking, e-signatures, and payment proof management — already running.',
      color: '#60A5FA', bg: 'rgba(59,130,246,0.06)', border: 'rgba(59,130,246,0.15)',
    },
    {
      icon: '📊',
      title: 'Proven Model',
      desc: 'A structured, compliant lending program with a credit tiering system, security hold mechanism, loyalty rewards, and a 0-default track record. Not a prototype — a live program.',
      color: '#22C55E', bg: 'rgba(34,197,94,0.06)', border: 'rgba(34,197,94,0.15)',
    },
    {
      icon: '⚡',
      title: 'Scalable by Design',
      desc: 'The technology, processes, and admin tools are built to scale. Adding a new employer group, a new borrower cohort, or a new loan product requires minimal overhead.',
      color: '#a78bfa', bg: 'rgba(139,92,246,0.06)', border: 'rgba(139,92,246,0.15)',
    },
    {
      icon: '🔒',
      title: 'Compliance First',
      desc: 'Every loan agreement is generated in full compliance with RA 3765 (Truth in Lending Act), RA 10173 (Data Privacy Act), and RA 8792 (E-Commerce Act). Legal from day one.',
      color: '#F59E0B', bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.15)',
    },
  ]

  const partnerTypes = [
    {
      badge: 'Platform Licensing',
      icon: '🏢',
      title: 'Your brand. Our platform.',
      desc: 'License the full MoneyfestLending system under your own brand. Your organization gets a complete, production-ready lending platform — customized, deployed, and yours to operate.',
      perks: [
        'White-labeled admin dashboard (your logo, your colors)',
        'Borrower portal — application, e-signature, loan tracking',
        'Credit scoring engine with loyalty tiers & security hold',
        'Automated installment scheduling & payment proof uploads',
        'Real-time notifications & portal activity logs',
        'Rebate Credits reward system & withdrawal management',
        'QuickLoan module (short-term, daily-interest loans)',
        'Full RA 3765 / RA 10173 compliant loan agreement generation',
        'Supabase backend — PostgreSQL, Row-Level Security, Realtime DB',
        'Hosted, maintained, and supported by our dev team',
      ],
      color: '#60A5FA', border: 'rgba(59,130,246,0.25)', bg: 'rgba(59,130,246,0.05)',
    },
    {
      badge: 'Capital Partners',
      icon: '🤝',
      title: 'Grow with us',
      desc: 'Strategic partners who see the opportunity in workplace micro-lending and want to help us expand our reach, lending capacity, and product suite across more organizations.',
      perks: ['Transparent reporting', 'Structured repayment backed by payroll cycle', 'co-managed expansion', 'Early partnership terms'],
      color: '#a78bfa', border: 'rgba(139,92,246,0.25)', bg: 'rgba(139,92,246,0.05)',
    },
    {
      badge: 'Network Partners',
      icon: '🌐',
      title: 'Refer and grow together',
      desc: 'Industry professionals, HR consultants, or financial advisors who can introduce MoneyfestLending to organizations in their network as an added employee benefit.',
      perks: ['Revenue share model', 'Zero management responsibility', 'Backed by live platform', 'Referral transparency'],
      color: '#2DD4BF', border: 'rgba(20,184,166,0.25)', bg: 'rgba(20,184,166,0.05)',
    },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#07090F', fontFamily: 'DM Sans, sans-serif', overflowX: 'hidden' }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Syne:wght@700;800;900&family=Space+Grotesk:wght@400;600;700;800&display=swap');
        @keyframes heroFade { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
        @keyframes shimmer { 0% { background-position:-200% center; } 100% { background-position:200% center; } }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        .p-h1 { animation: heroFade 0.8s ease forwards; opacity:0; }
        .p-h2 { animation: heroFade 0.8s 0.15s ease forwards; opacity:0; }
        .p-h3 { animation: heroFade 0.8s 0.3s ease forwards; opacity:0; }
        .p-h4 { animation: heroFade 0.8s 0.45s ease forwards; opacity:0; }
        .shimmer-text {
          background: linear-gradient(90deg,#60a5fa,#a78bfa,#34d399,#60a5fa);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: shimmer 4s linear infinite;
        }
        .cta-primary { transition: all 0.2s ease; }
        .cta-primary:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(99,102,241,0.4); }
        .cta-sec { transition: all 0.2s ease; }
        .cta-sec:hover { border-color: rgba(255,255,255,0.3) !important; color: #F0F4FF !important; }
        .nav-lh { transition: all 0.2s ease; }
        .nav-lh:hover { color:#F0F4FF !important; border-color:rgba(255,255,255,0.25) !important; }
        .partner-card { transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease; }
        .partner-card:hover { transform: translateY(-4px); }
        .pillar-card { transition: transform 0.2s ease, border-color 0.2s ease; }
        .pillar-card:hover { transform: translateY(-3px); }
        .footer-lh { transition: color 0.2s; }
        .footer-lh:hover { color:#7A8AAA !important; }
        @media (max-width: 700px) { .partners-grid { grid-template-columns: 1fr !important; } .stats-grid { grid-template-columns: 1fr 1fr !important; } }
        @media (max-width: 480px) { .stats-grid { grid-template-columns: 1fr !important; } }
      `}</style>

      {/* Background */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', opacity: 0.025, backgroundImage: 'linear-gradient(rgba(255,255,255,0.8) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.8) 1px,transparent 1px)', backgroundSize: '48px 48px', zIndex: 0 }} />
      <div style={{ position: 'fixed', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle,rgba(99,102,241,0.08) 0%,transparent 70%)', top: '-10%', right: '-10%', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle,rgba(20,184,166,0.06) 0%,transparent 70%)', bottom: '0%', left: '-8%', pointerEvents: 'none', zIndex: 0 }} />

      <div style={{ position: 'relative', zIndex: 1 }}>

        {/* ── NAV ── */}
        <nav style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(7,9,15,0.88)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0 32px' }}>
          <div style={{ maxWidth: 1080, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
            <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
              <img src="/favicon-96x96.png" alt="MoneyfestLending" style={{ width: 32, height: 32, objectFit: 'contain' }} />
              <span style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: 17, color: '#F0F4FF', letterSpacing: -0.3 }}>
                Moneyfest<span className="shimmer-text">Lending</span>
              </span>
            </a>
            <div style={{ display: 'flex', gap: 8 }}>
              <a href="/" className="nav-lh" style={{ padding: '8px 16px', borderRadius: 9, background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#7A8AAA', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>Home</a>
              <a href="/contact" className="nav-lh" style={{ padding: '8px 16px', borderRadius: 9, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#CBD5F0', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>Contact</a>
              <a href="/apply" className="cta-primary" style={{ padding: '8px 18px', borderRadius: 9, background: 'linear-gradient(135deg,#6366F1,#8B5CF6)', color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none', fontFamily: 'Syne,sans-serif' }}>Apply Now</a>
            </div>
          </div>
        </nav>

        {/* ── HERO ── */}
        <section style={{ padding: '90px 32px 64px', textAlign: 'center', position: 'relative', maxWidth: 900, margin: '0 auto' }}>
          <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle,rgba(99,102,241,0.08) 0%,transparent 70%)', top: -60, left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none' }} />

          <div className="p-h1" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 18px', borderRadius: 20, background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.25)', marginBottom: 28 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#a78bfa', animation: 'float 2s ease-in-out infinite' }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#a78bfa', letterSpacing: '0.07em', textTransform: 'uppercase' }}>Partnership Opportunities</span>
          </div>

          <h1 className="p-h2" style={{ fontFamily: 'Syne,sans-serif', fontWeight: 900, fontSize: 'clamp(38px,6vw,64px)', color: '#F0F4FF', lineHeight: 1.05, letterSpacing: -2, margin: '0 0 22px' }}>
            Let's build something<br /><span className="shimmer-text">bigger, together.</span>
          </h1>

          <p className="p-h3" style={{ fontSize: 'clamp(15px,1.8vw,18px)', color: '#7A8AAA', lineHeight: 1.85, maxWidth: 580, margin: '0 auto 36px' }}>
            MoneyfestLending is a live, compliant, and growing workplace lending platform. We're not looking for attention — we're looking for the right people to grow with.
          </p>

          <div className="p-h4" style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="/contact" className="cta-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 30px', borderRadius: 12, background: 'linear-gradient(135deg,#6366F1,#8B5CF6)', color: '#fff', textDecoration: 'none', fontSize: 15, fontWeight: 700, fontFamily: 'Syne,sans-serif' }}>
              Let's Talk →
            </a>
            <a href="#what-we-built" className="cta-sec" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 26px', borderRadius: 12, background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: '#CBD5F0', textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>
              See the platform ↓
            </a>
          </div>
        </section>

        {/* ── STATS ── */}
        <section ref={statsRef} style={{ padding: '0 32px 80px' }}>
          <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, maxWidth: 1000, margin: '0 auto' }}>
            {stats.map((s, i) => (
              <StatCard key={i} {...s} started={statsVisible} />
            ))}
          </div>
        </section>

        {/* ── WHAT WE BUILT ── */}
        <section id="what-we-built" style={{ padding: '0 32px 80px' }}>
          <div style={{ maxWidth: 1000, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 48 }}>
              <div style={{ fontSize: 11, color: '#a78bfa', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>The Platform</div>
              <h2 style={{ fontFamily: 'Syne,sans-serif', fontWeight: 900, fontSize: 'clamp(26px,4vw,38px)', color: '#F0F4FF', margin: '0 0 14px', letterSpacing: -1 }}>
                This isn't an idea. It's running.
              </h2>
              <p style={{ fontSize: 13, color: '#4B5580', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, letterSpacing: '0.05em', marginBottom: 10 }}>PostgreSQL · Supabase · REST API · Realtime DB · Row-Level Security · Edge Functions</p>
              <p style={{ fontSize: 15, color: '#7A8AAA', maxWidth: 520, margin: '0 auto', lineHeight: 1.8 }}>
                We've already built the hard things. The infrastructure, the compliance layer, the admin tooling — all live in production.
              </p>
            </div>
            <div className="partners-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
              {pillars.map((p, i) => (
                <div key={i} className="pillar-card" style={{ background: p.bg, border: `1px solid ${p.border}`, borderRadius: 20, padding: '26px 24px' }}>
                  <div style={{ width: 48, height: 48, borderRadius: 14, background: p.bg, border: `1px solid ${p.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 18 }}>{p.icon}</div>
                  <div style={{ fontFamily: 'Space Grotesk,sans-serif', fontWeight: 800, fontSize: 17, color: '#F0F4FF', marginBottom: 10 }}>{p.title}</div>
                  <div style={{ fontSize: 14, color: '#7A8AAA', lineHeight: 1.8 }}>{p.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── OPPORTUNITY BAND ── */}
        <section style={{ padding: '0 32px 80px' }}>
          <div style={{ maxWidth: 1000, margin: '0 auto', background: 'linear-gradient(135deg,rgba(99,102,241,0.07),rgba(20,184,166,0.05))', border: '1px solid rgba(99,102,241,0.18)', borderRadius: 24, padding: '48px 44px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 11, color: '#60A5FA', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>The Opportunity</div>
                <h2 style={{ fontFamily: 'Syne,sans-serif', fontWeight: 900, fontSize: 'clamp(24px,3vw,34px)', color: '#F0F4FF', margin: '0 0 18px', letterSpacing: -1, lineHeight: 1.2 }}>
                  Workplace micro-lending is an untapped category.
                </h2>
                <p style={{ fontSize: 14, color: '#7A8AAA', lineHeight: 1.85, margin: '0 0 18px' }}>
                  Most employees who need short-term cash have two options: informal borrowing from colleagues, or high-interest consumer lenders. Neither is structured, tracked, or safe.
                </p>
                <p style={{ fontSize: 14, color: '#7A8AAA', lineHeight: 1.85 }}>
                  MoneyfestLending is purpose-built to sit between those two extremes — a private, structured, compliant lending channel that benefits both borrower and employer.
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[
                  { icon: '🏦', text: 'Employees access loans at fair rates — no predatory lenders, no awkward colleague asks' },
                  { icon: '📈', text: 'Repayments are tied to payroll cycles — structurally low default risk' },
                  { icon: '⚙️', text: 'Peer-managed within the organization — a trusted colleague-run program, with no dependency on third party infrastructure' },
                  { icon: '🌏', text: 'Designed for the Philippine workforce, with full regulatory compliance built in' },
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12 }}>
                    <span style={{ fontSize: 20, flexShrink: 0, marginTop: 1 }}>{item.icon}</span>
                    <span style={{ fontSize: 13, color: '#9AA4BC', lineHeight: 1.7 }}>{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── PARTNER TYPES ── */}
        <section style={{ padding: '0 32px 80px' }}>
          <div style={{ maxWidth: 1000, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 48 }}>
              <div style={{ fontSize: 11, color: '#2DD4BF', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Who We Work With</div>
              <h2 style={{ fontFamily: 'Syne,sans-serif', fontWeight: 900, fontSize: 'clamp(26px,4vw,38px)', color: '#F0F4FF', margin: '0 0 14px', letterSpacing: -1 }}>
                Three kinds of partners.
              </h2>
              <p style={{ fontSize: 15, color: '#7A8AAA', maxWidth: 460, margin: '0 auto', lineHeight: 1.8 }}>
                Whether you run a company, manage capital, or know the right people — there's a way to work with us.
              </p>
            </div>
            <div className="partners-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 18 }}>
              {partnerTypes.map((pt, i) => (
                <div key={i} className="partner-card" style={{ background: pt.bg, border: `1px solid ${pt.border}`, borderRadius: 22, padding: '30px 26px', boxShadow: `0 0 0 0 ${pt.border}` }}
                  onMouseEnter={e => e.currentTarget.style.boxShadow = `0 12px 40px ${pt.border}`}
                  onMouseLeave={e => e.currentTarget.style.boxShadow = '0 0 0 0 transparent'}
                >
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '3px 12px', borderRadius: 20, background: 'rgba(255,255,255,0.05)', border: `1px solid ${pt.border}`, fontSize: 10, fontWeight: 700, color: pt.color, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 20 }}>
                    {pt.badge}
                  </div>
                  <div style={{ fontSize: 28, marginBottom: 14 }}>{pt.icon}</div>
                  <div style={{ fontFamily: 'Space Grotesk,sans-serif', fontWeight: 800, fontSize: 17, color: '#F0F4FF', marginBottom: 12, lineHeight: 1.3 }}>{pt.title}</div>
                  <div style={{ fontSize: 13, color: '#7A8AAA', lineHeight: 1.8, marginBottom: 20 }}>{pt.desc}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {pt.perks.map((perk, j) => (
                      <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#9AA4BC' }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: pt.color, flexShrink: 0 }} />
                        {perk}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA BAND ── */}
        <section style={{ padding: '0 32px 80px' }}>
          <div style={{ maxWidth: 1000, margin: '0 auto', textAlign: 'center', background: 'linear-gradient(135deg,rgba(99,102,241,0.08),rgba(139,92,246,0.08))', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 26, padding: '60px 40px' }}>
            <div style={{ fontSize: 40, marginBottom: 20 }}>🤝</div>
            <h2 style={{ fontFamily: 'Syne,sans-serif', fontWeight: 900, fontSize: 'clamp(26px,4vw,40px)', color: '#F0F4FF', margin: '0 0 16px', letterSpacing: -1 }}>
              Interested in working together?
            </h2>
            <p style={{ fontSize: 15, color: '#7A8AAA', lineHeight: 1.85, maxWidth: 520, margin: '0 auto 32px' }}>
              We keep our conversations private and our expectations clear. If you're curious about what a partnership looks like, reach out — no commitment, no pressure.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <a href="/contact" className="cta-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '15px 34px', borderRadius: 13, background: 'linear-gradient(135deg,#6366F1,#8B5CF6)', color: '#fff', textDecoration: 'none', fontSize: 15, fontWeight: 700, fontFamily: 'Syne,sans-serif' }}>
                Start the conversation →
              </a>
              <a href="/faq" className="cta-sec" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '15px 26px', borderRadius: 13, background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: '#CBD5F0', textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>
                <img src="/faq.png" alt="" style={{ width: 14, height: 14, objectFit: 'contain' }} />Learn how the platform works
              </a>
            </div>
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '28px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src="/favicon-96x96.png" alt="" style={{ width: 22, height: 22, objectFit: 'contain' }} />
            <span style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 13, color: '#4B5580' }}>MoneyfestLending</span>
            <span style={{ fontSize: 12, color: '#4B5580' }}>· Workplace Lending Program</span>
          </div>
          <div style={{ display: 'flex', gap: 20 }}>
            {[{ label: 'Apply', href: '/apply' }, { label: 'FAQ', href: '/faq' }, { label: 'Contact', href: '/contact' }, { label: 'Privacy Notice', href: '/privacy' }, { label: 'Terms', href: '/terms' }].map((l, i) => (
              <a key={i} href={l.href} className="footer-lh" style={{ fontSize: 12, color: '#4B5580', textDecoration: 'none' }}>{l.label}</a>
            ))}
          </div>
          <div style={{ fontSize: 11, color: '#323a52' }}>
            <span style={{ fontFamily: 'Space Grotesk', fontWeight: 700, background: 'linear-gradient(90deg,#3B82F6,#8B5CF6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>John Paul Lacaron</span>
            <span style={{ color: '#323a52' }}> · Developer</span>
          </div>
        </footer>

      </div>
    </div>
  )
}
