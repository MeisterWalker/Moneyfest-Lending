import { usePageVisit } from '../hooks/usePageVisit'

export default function ContactPage() {
  usePageVisit('contact')

  return (
    <div style={{ minHeight: '100vh', background: '#07090F', fontFamily: 'DM Sans, sans-serif', overflowX: 'hidden' }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Syne:wght@700;800;900&family=Space+Grotesk:wght@400;600;700;800&display=swap');

        @keyframes heroFade { from { opacity: 0; transform: translateY(28px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes float    { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        @keyframes shimmer  { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
        @keyframes pulse-ring { 0% { transform: scale(0.9); opacity: 0.5; } 100% { transform: scale(1.5); opacity: 0; } }

        .contact-hero-title { animation: heroFade 0.8s ease forwards; opacity: 0; }
        .contact-hero-sub   { animation: heroFade 0.8s 0.2s ease forwards; opacity: 0; }
        .contact-hero-cards { animation: heroFade 0.8s 0.4s ease forwards; opacity: 0; }

        .shimmer-text {
          background: linear-gradient(90deg, #60a5fa, #a78bfa, #34d399, #60a5fa);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: shimmer 4s linear infinite;
        }

        .contact-card {
          transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .contact-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 16px 40px rgba(59,130,246,0.15);
          border-color: rgba(59,130,246,0.4) !important;
        }

        .email-link {
          text-decoration: none;
          transition: all 0.2s ease;
        }
        .email-link:hover {
          opacity: 0.85;
        }

        .info-card {
          transition: transform 0.2s ease, border-color 0.2s ease;
        }
        .info-card:hover {
          transform: translateY(-3px);
        }

        .cta-primary { transition: all 0.2s ease; }
        .cta-primary:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(99,102,241,0.4); }
        .cta-secondary { transition: all 0.2s ease; }
        .cta-secondary:hover { border-color: rgba(255,255,255,0.3) !important; color: #F0F4FF !important; }

        .nav-link-hover { transition: all 0.2s ease; }
        .nav-link-hover:hover { color: #F0F4FF !important; border-color: rgba(255,255,255,0.25) !important; }

        .footer-link { transition: color 0.2s ease; }
        .footer-link:hover { color: #7A8AAA !important; }

        @media (max-width: 640px) {
          .contact-admin-grid { grid-template-columns: 1fr !important; }
          .contact-info-grid  { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* Background decoration */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', opacity: 0.03, backgroundImage: 'linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)', backgroundSize: '48px 48px', zIndex: 0 }} />
      <div style={{ position: 'fixed', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 70%)', top: '-8%', right: '-8%', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', width: 350, height: 350, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 70%)', bottom: '5%', left: '-5%', pointerEvents: 'none', zIndex: 0 }} />

      <div style={{ position: 'relative', zIndex: 1 }}>

        {/* ── NAV ── */}
        <nav style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(7,9,15,0.85)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0 32px' }}>
          <div style={{ maxWidth: 1080, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
            <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
              <img src="/favicon-96x96.png" alt="MoneyfestLending" style={{ width: 32, height: 32, objectFit: 'contain' }} />
              <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 17, color: '#F0F4FF', letterSpacing: -0.3 }}>
                Moneyfest<span className="shimmer-text">Lending</span>
              </span>
            </a>
            <div style={{ display: 'flex', gap: 8 }}>
              <a href="/faq" className="nav-link-hover" style={{ padding: '8px 16px', borderRadius: 9, background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#7A8AAA', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                <img src="/faq.png" alt="" style={{ width: 13, height: 13, objectFit: 'contain', marginRight: 6, verticalAlign: 'middle' }} />FAQ
              </a>
              <a href="/portal" className="nav-link-hover" style={{ padding: '8px 16px', borderRadius: 9, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#CBD5F0', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                My Portal
              </a>
              <a href="/apply" className="cta-primary" style={{ padding: '8px 18px', borderRadius: 9, background: 'linear-gradient(135deg,#6366F1,#8B5CF6)', color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none', fontFamily: 'Syne, sans-serif' }}>
                Apply Now
              </a>
            </div>
          </div>
        </nav>

        {/* ── HERO ── */}
        <section style={{ padding: '80px 32px 60px', textAlign: 'center', position: 'relative' }}>
          <div style={{ position: 'absolute', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)', top: '0%', left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none' }} />

          <div className="contact-hero-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px', borderRadius: 20, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)', marginBottom: 24 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#60A5FA', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Get in Touch</span>
          </div>

          <h1 className="contact-hero-title" style={{ fontFamily: 'Syne, sans-serif', fontWeight: 900, fontSize: 'clamp(36px, 6vw, 60px)', color: '#F0F4FF', lineHeight: 1.1, letterSpacing: -2, margin: '0 0 16px' }}>
            We're here to <span className="shimmer-text">help you.</span>
          </h1>

          <p className="contact-hero-sub" style={{ fontSize: 'clamp(14px, 1.8vw, 17px)', color: '#7A8AAA', lineHeight: 1.8, maxWidth: 520, margin: '0 auto 56px' }}>
            Have a question about your loan, application, or account? Reach out and we'll get back to you as soon as possible.
          </p>

          {/* ── ADMIN CONTACT CARDS ── */}
          <div className="contact-hero-cards contact-admin-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, maxWidth: 760, margin: '0 auto 32px' }}>

            {/* JP Card — Primary / Email */}
            <div className="contact-card" style={{ background: 'linear-gradient(145deg,rgba(59,130,246,0.07),rgba(99,102,241,0.04))', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 22, padding: '32px 28px', textAlign: 'left', position: 'relative', overflow: 'hidden' }}>
              {/* Glow */}
              <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />

              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 20, background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)', fontSize: 10, fontWeight: 800, color: '#60A5FA', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 20 }}>
                Admin & Developer
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <div style={{ position: 'absolute', inset: -4, borderRadius: '50%', background: 'rgba(59,130,246,0.1)', animation: 'pulse-ring 2.5s ease-out infinite' }} />
                  <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg,#3B82F6,#8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 18, color: '#fff', position: 'relative', zIndex: 1 }}>
                    JP
                  </div>
                </div>
                <div>
                  <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 16, color: '#F0F4FF', marginBottom: 3 }}>John Paul Lacaron</div>
                  <div style={{ fontSize: 12, color: '#7A8AAA' }}>Developer · System Admin</div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Email CTA */}
                <a href="mailto:johnpaullacaron@moneyfestlending.loan" className="email-link" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', borderRadius: 12, background: 'linear-gradient(135deg,rgba(59,130,246,0.18),rgba(99,102,241,0.12))', border: '1px solid rgba(59,130,246,0.35)' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(59,130,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#60A5FA" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="4" width="20" height="16" rx="3" />
                      <path d="m2 7 8.5 6a2.5 2.5 0 0 0 3 0L22 7" />
                    </svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, color: '#60A5FA', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 1 }}>Email</div>
                    <div style={{ fontSize: 12, color: '#CBD5F0', fontFamily: 'Space Grotesk', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>johnpaullacaron@moneyfestlending.loan</div>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.7 }}>
                    <path d="M7 17L17 7M17 7H7M17 7v10" />
                  </svg>
                </a>

                {/* Teams */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: '#a78bfa', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 1 }}>Microsoft Teams</div>
                    <div style={{ fontSize: 12, color: '#7A8AAA' }}>Chat via Teams — internal only</div>
                  </div>
                </div>
              </div>
            </div>

            {/* CJ Card */}
            <div className="contact-card" style={{ background: 'linear-gradient(145deg,rgba(20,184,166,0.06),rgba(59,130,246,0.04))', border: '1px solid rgba(20,184,166,0.2)', borderRadius: 22, padding: '32px 28px', textAlign: 'left', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'radial-gradient(circle, rgba(20,184,166,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />

              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 20, background: 'rgba(20,184,166,0.1)', border: '1px solid rgba(20,184,166,0.25)', fontSize: 10, fontWeight: 800, color: '#2DD4BF', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 20 }}>
                Admin
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg,#14B8A6,#3B82F6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 18, color: '#fff', flexShrink: 0 }}>
                  CJ
                </div>
                <div>
                  <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 16, color: '#F0F4FF', marginBottom: 3 }}>Charlou June Ramil</div>
                  <div style={{ fontSize: 12, color: '#7A8AAA' }}>Admin</div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Teams */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', borderRadius: 12, background: 'rgba(20,184,166,0.07)', border: '1px solid rgba(20,184,166,0.2)' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(20,184,166,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2DD4BF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: '#2DD4BF', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 1 }}>Microsoft Teams</div>
                    <div style={{ fontSize: 12, color: '#7A8AAA' }}>Chat via Teams — internal only</div>
                  </div>
                </div>

                <div style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', fontSize: 12, color: '#4B5580', lineHeight: 1.6 }}>
                  For loan-related concerns — payments, schedules, and approval questions.
                </div>
              </div>
            </div>
          </div>

          {/* ── INFO CARDS ── */}
          <div className="contact-info-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, maxWidth: 760, margin: '0 auto' }}>
            {[
              {
                icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                  </svg>
                ),
                color: '#F59E0B',
                bg: 'rgba(245,158,11,0.07)',
                border: 'rgba(245,158,11,0.2)',
                label: 'Response Time',
                value: 'Within 12 hrs',
                sub: 'On business days',
              },
              {
                icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                ),
                color: '#22C55E',
                bg: 'rgba(34,197,94,0.07)',
                border: 'rgba(34,197,94,0.2)',
                label: 'Office Hours',
                value: 'Mon – Fri',
                sub: '8:00 AM – 5:00 PM',
              },
              {
                icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                  </svg>
                ),
                color: '#a78bfa',
                bg: 'rgba(139,92,246,0.07)',
                border: 'rgba(139,92,246,0.2)',
                label: 'Fastest Way',
                value: 'Send an Email',
                sub: 'Goes straight to JP',
              },
            ].map((card, i) => (
              <div key={i} className="info-card" style={{ background: card.bg, border: `1px solid ${card.border}`, borderRadius: 16, padding: '20px 18px', textAlign: 'center' }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: `${card.bg}`, border: `1px solid ${card.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                  {card.icon}
                </div>
                <div style={{ fontSize: 11, color: card.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{card.label}</div>
                <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 15, color: '#F0F4FF', marginBottom: 3 }}>{card.value}</div>
                <div style={{ fontSize: 11, color: '#4B5580' }}>{card.sub}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── BOTTOM CTA ── */}
        <section style={{ padding: '32px 32px 80px' }}>
          <div style={{ maxWidth: 760, margin: '0 auto' }}>
            <div style={{ background: 'linear-gradient(135deg,rgba(59,130,246,0.08),rgba(139,92,246,0.08))', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 22, padding: '36px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 28, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 900, fontSize: 22, color: '#F0F4FF', marginBottom: 6 }}>Looking for quick answers?</div>
                <div style={{ fontSize: 14, color: '#7A8AAA', lineHeight: 1.7 }}>Most questions are already answered in our FAQ — check there first before sending a message.</div>
              </div>
              <div style={{ display: 'flex', gap: 10, flexShrink: 0, flexWrap: 'wrap' }}>
                <a href="/faq" className="cta-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '12px 24px', borderRadius: 11, background: 'linear-gradient(135deg,#6366F1,#8B5CF6)', color: '#fff', textDecoration: 'none', fontSize: 13, fontWeight: 700, fontFamily: 'Syne, sans-serif' }}>
                  <img src="/faq.png" alt="" style={{ width: 15, height: 15, objectFit: 'contain' }} />
                  Browse FAQ
                </a>
                <a href="/apply" className="cta-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '12px 22px', borderRadius: 11, background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: '#CBD5F0', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>
                  <img src="/startup.png" alt="" style={{ width: 14, height: 14, objectFit: 'contain' }} />
                  Apply Now
                </a>
              </div>
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
            {[
              { label: 'Apply', href: '/apply' },
              { label: 'My Portal', href: '/portal' },
              { label: 'FAQ', href: '/faq' },
              { label: 'Privacy Notice', href: '/privacy' },
              { label: 'Terms & Conditions', href: '/terms' },
            ].map((l, i) => (
              <a key={i} href={l.href} className="footer-link" style={{ fontSize: 12, color: '#4B5580', textDecoration: 'none' }}>{l.label}</a>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            <div style={{ fontSize: 12, color: '#4B5580' }}>"Borrow smart. Pay early. Get rewarded."</div>
            <div style={{ fontSize: 11, color: '#323a52', display: 'flex', alignItems: 'center', gap: 5 }}>
              <span>Designed & developed by</span>
              <span style={{ fontFamily: 'Space Grotesk', fontWeight: 700, background: 'linear-gradient(90deg,#3B82F6,#8B5CF6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                John Paul Lacaron
              </span>
            </div>
          </div>
        </footer>

      </div>
    </div>
  )
}
