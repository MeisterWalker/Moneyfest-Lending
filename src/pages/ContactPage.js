import { useState, useCallback } from 'react'
import { usePageVisit } from '../hooks/usePageVisit'
import ChatBot from '../components/ChatBot'

function ContactCard({ initials, gradient, badge, badgeBg, badgeBorder, badgeColor, name, role, email, teamsEmail, expandedContent, accentColor, accentBg, accentBorder, glowColor }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback((e) => {
    e.stopPropagation()
    if (!email) return
    navigator.clipboard.writeText(email).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [email])
  const [open, setOpen] = useState(false)

  return (
    <div
      onClick={() => setOpen(o => !o)}
      style={{
        background: open
          ? `linear-gradient(145deg,${accentBg},rgba(255,255,255,0.02))`
          : 'linear-gradient(145deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))',
        border: `1px solid ${open ? accentBorder : 'rgba(255,255,255,0.08)'}`,
        borderRadius: 22,
        padding: '28px 26px',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: open ? `0 16px 48px ${glowColor}` : 'none',
      }}
      onMouseEnter={e => { if (!open) e.currentTarget.style.borderColor = accentBorder; e.currentTarget.style.transform = 'translateY(-2px)' }}
      onMouseLeave={e => { if (!open) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.transform = 'translateY(0)' }}
    >
      {/* Glow orb */}
      <div style={{ position: 'absolute', top: -40, right: -40, width: 140, height: 140, borderRadius: '50%', background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)`, pointerEvents: 'none', opacity: open ? 1 : 0.4, transition: 'opacity 0.3s' }} />

      {/* Badge */}
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 12px', borderRadius: 20, background: badgeBg, border: `1px solid ${badgeBorder}`, fontSize: 10, fontWeight: 800, color: badgeColor, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 20 }}>
        {badge}
      </div>

      {/* Avatar + Name row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22 }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          {open && <div style={{ position: 'absolute', inset: -5, borderRadius: '50%', background: glowColor, animation: 'pulseRing 2s ease-out infinite', opacity: 0.3 }} />}
          <div style={{ width: 54, height: 54, borderRadius: '50%', background: gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 800, fontSize: 18, color: '#fff', position: 'relative', zIndex: 1 }}>
            {initials}
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 800, fontSize: 16, color: '#F0F4FF', marginBottom: 3 }}>{name}</div>
          <div style={{ fontSize: 12, color: '#7A8AAA' }}>{role}</div>
        </div>
        {/* Expand toggle */}
        <div style={{ width: 30, height: 30, borderRadius: '50%', background: open ? accentBg : 'rgba(255,255,255,0.05)', border: `1px solid ${open ? accentBorder : 'rgba(255,255,255,0.1)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s' }}>
          <span style={{ color: open ? accentColor : '#4B5580', fontSize: 18, lineHeight: 1, display: 'block', transform: open ? 'rotate(45deg)' : 'rotate(0deg)', transition: 'transform 0.25s ease', fontWeight: 300 }}>+</span>
        </div>
      </div>

      {/* Contact rows — always visible */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: open ? 20 : 0, transition: 'margin 0.3s' }}>
        {email && (
          <div
            onClick={handleCopy}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 12, background: copied ? 'rgba(34,197,94,0.1)' : accentBg, border: `1px solid ${copied ? 'rgba(34,197,94,0.4)' : accentBorder}`, cursor: 'pointer', transition: 'all 0.2s' }}
          >
            <div style={{ width: 32, height: 32, borderRadius: 9, background: copied ? 'rgba(34,197,94,0.15)' : accentBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1px solid ${copied ? 'rgba(34,197,94,0.4)' : accentBorder}`, transition: 'all 0.2s' }}>
              {copied
                ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="3" /><path d="m2 7 8.5 6a2.5 2.5 0 0 0 3 0L22 7" /></svg>
              }
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, color: copied ? '#22C55E' : accentColor, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2, transition: 'color 0.2s' }}>Email — {copied ? 'Copied! ✓' : 'Click to Copy'}</div>
              <div style={{ fontSize: 12, color: '#CBD5F0', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, wordBreak: 'break-all', lineHeight: 1.4 }}>{email}</div>
            </div>
            <div style={{ fontSize: 11, color: copied ? '#22C55E' : '#4B5580', flexShrink: 0, transition: 'color 0.2s' }}>{copied ? '✓' : '⎘'}</div>
          </div>
        )}
        <a
          href={teamsEmail ? `https://teams.microsoft.com/l/chat/0/0?users=${teamsEmail}` : '#'}
          target="_blank"
          rel="noreferrer"
          onClick={e => e.stopPropagation()}
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', textDecoration: 'none', transition: 'all 0.2s' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.08)'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.25)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.025)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)' }}
        >
          <div style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#a78bfa', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Microsoft Teams</div>
            <div style={{ fontSize: 12, color: '#7A8AAA' }}>Click to open chat in Teams →</div>
          </div>
        </a>
      </div>

      {/* Expanded content */}
      {open && (
        <div style={{ borderTop: `1px solid ${accentBorder}`, paddingTop: 18, animation: 'fadeSlideIn 0.25s ease forwards' }}>
          <div style={{ fontSize: 11, color: accentColor, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>Handles</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {expandedContent.map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '11px 14px', borderRadius: 11, background: 'rgba(0,0,0,0.25)', border: `1px solid ${accentBorder}` }}>
                <div style={{ width: 24, height: 24, borderRadius: 7, background: accentBg, border: `1px solid ${accentBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 13 }}>
                  {item.icon}
                </div>
                <div>
                  <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: 13, color: '#F0F4FF', marginBottom: 2 }}>{item.title}</div>
                  <div style={{ fontSize: 12, color: '#7A8AAA', lineHeight: 1.6 }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 10, background: accentBg, border: `1px solid ${accentBorder}`, fontSize: 12, color: accentColor, lineHeight: 1.6 }}>
            💬 Click the email button above to send a message directly.
          </div>
        </div>
      )}

      {/* Hint when collapsed */}
      {!open && (
        <div style={{ marginTop: 14, fontSize: 11, color: '#4B5580', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
          <span>Click to see what {name.split(' ')[0]} handles</span>
          <span style={{ fontSize: 14 }}>↓</span>
        </div>
      )}
    </div>
  )
}

export default function ContactPage() {
  usePageVisit('contact')

  return (
    <div style={{ minHeight: '100vh', background: '#07090F', fontFamily: 'DM Sans, sans-serif', overflowX: 'hidden' }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Syne:wght@700;800;900&family=Space+Grotesk:wght@400;600;700;800&display=swap');

        @keyframes heroFade    { from { opacity:0; transform:translateY(28px); } to { opacity:1; transform:translateY(0); } }
        @keyframes shimmer     { 0% { background-position:-200% center; } 100% { background-position:200% center; } }
        @keyframes fadeSlideIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulseRing   { 0% { transform:scale(0.9); opacity:0.5; } 100% { transform:scale(1.6); opacity:0; } }

        .contact-hero-1 { animation: heroFade 0.8s ease forwards; opacity:0; }
        .contact-hero-2 { animation: heroFade 0.8s 0.15s ease forwards; opacity:0; }
        .contact-hero-3 { animation: heroFade 0.8s 0.3s ease forwards; opacity:0; }
        .contact-hero-4 { animation: heroFade 0.8s 0.45s ease forwards; opacity:0; }

        .shimmer-text {
          background: linear-gradient(90deg,#60a5fa,#a78bfa,#34d399,#60a5fa);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: shimmer 4s linear infinite;
        }
        .cta-primary { transition: all 0.2s ease; }
        .cta-primary:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(99,102,241,0.4); }
        .cta-secondary { transition: all 0.2s ease; }
        .cta-secondary:hover { border-color: rgba(255,255,255,0.3) !important; color: #F0F4FF !important; }
        .nav-lh { transition: all 0.2s ease; }
        .nav-lh:hover { color:#F0F4FF !important; border-color:rgba(255,255,255,0.25) !important; }
        .footer-lh { transition: color 0.2s; }
        .footer-lh:hover { color:#7A8AAA !important; }
        .info-card { transition: transform 0.2s ease, box-shadow 0.2s ease; }
        .info-card:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,0.3); }

        @media (max-width: 640px) {
          .cards-grid { grid-template-columns: 1fr !important; }
          .info-grid  { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* Background */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', opacity: 0.03, backgroundImage: 'linear-gradient(rgba(255,255,255,0.8) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.8) 1px,transparent 1px)', backgroundSize: '48px 48px', zIndex: 0 }} />
      <div style={{ position: 'fixed', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle,rgba(59,130,246,0.1) 0%,transparent 70%)', top: '-8%', right: '-8%', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', width: 350, height: 350, borderRadius: '50%', background: 'radial-gradient(circle,rgba(139,92,246,0.08) 0%,transparent 70%)', bottom: '5%', left: '-5%', pointerEvents: 'none', zIndex: 0 }} />

      <div style={{ position: 'relative', zIndex: 1 }}>

        {/* ── NAV ── */}
        <nav style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(7,9,15,0.85)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0 32px' }}>
          <div style={{ maxWidth: 1080, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
            <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
              <img src="/favicon-96x96.png" alt="MoneyfestLending" style={{ width: 32, height: 32, objectFit: 'contain' }} />
              <span style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: 17, color: '#F0F4FF', letterSpacing: -0.3 }}>
                Moneyfest<span className="shimmer-text">Lending</span>
              </span>
            </a>
            <div style={{ display: 'flex', gap: 8 }}>
              <a href="/faq" className="nav-lh" style={{ padding: '8px 16px', borderRadius: 9, background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#7A8AAA', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                <img src="/faq.png" alt="" style={{ width: 13, height: 13, objectFit: 'contain', marginRight: 6, verticalAlign: 'middle' }} />FAQ
              </a>
              <a href="/portal" className="nav-lh" style={{ padding: '8px 16px', borderRadius: 9, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#CBD5F0', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                My Portal
              </a>
              <a href="/apply" className="cta-primary" style={{ padding: '8px 18px', borderRadius: 9, background: 'linear-gradient(135deg,#6366F1,#8B5CF6)', color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none', fontFamily: 'Syne,sans-serif' }}>
                Apply Now
              </a>
            </div>
          </div>
        </nav>

        {/* ── HERO ── */}
        <section style={{ padding: '80px 32px 52px', textAlign: 'center', position: 'relative' }}>
          <div style={{ position: 'absolute', width: 360, height: 360, borderRadius: '50%', background: 'radial-gradient(circle,rgba(99,102,241,0.1) 0%,transparent 70%)', top: 0, left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none' }} />

          <div className="contact-hero-1" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px', borderRadius: 20, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)', marginBottom: 24 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#60A5FA', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Get in Touch</span>
          </div>

          <h1 className="contact-hero-2" style={{ fontFamily: 'Syne,sans-serif', fontWeight: 900, fontSize: 'clamp(36px,6vw,60px)', color: '#F0F4FF', lineHeight: 1.1, letterSpacing: -2, margin: '0 0 16px' }}>
            We're here to <span className="shimmer-text">help you.</span>
          </h1>

          <p className="contact-hero-3" style={{ fontSize: 'clamp(14px,1.8vw,17px)', color: '#7A8AAA', lineHeight: 1.8, maxWidth: 520, margin: '0 auto 12px' }}>
            Have a question about your loan, application, or account? Reach out and we'll get back to you.
          </p>
          <p className="contact-hero-3" style={{ fontSize: 13, color: '#4B5580', marginBottom: 52 }}>
            👇 Click on a card below to see what each admin handles
          </p>

          {/* ── CONTACT CARDS ── */}
          <div className="contact-hero-4 cards-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, maxWidth: 820, margin: '0 auto 32px' }}>

            <ContactCard
              initials="JP"
              gradient="linear-gradient(135deg,#3B82F6,#8B5CF6)"
              badge="Admin & Developer"
              badgeBg="rgba(59,130,246,0.12)"
              badgeBorder="rgba(59,130,246,0.3)"
              badgeColor="#60A5FA"
              name="John Paul Lacaron"
              role="Developer · System Admin"
              email="johnpaullacaron@moneyfestlending.loan"
              teamsEmail="john.lacaron@mysourcesolutions.com"
              accentColor="#60A5FA"
              accentBg="rgba(59,130,246,0.08)"
              accentBorder="rgba(59,130,246,0.25)"
              glowColor="rgba(59,130,246,0.12)"
              expandedContent={[
                { icon: '🐛', title: 'Bug & Glitch Reports', desc: 'If the website, portal, or any feature is broken or behaving unexpectedly — report it directly to JP.' },
                { icon: '⚙️', title: 'System & Technical Issues', desc: 'Access problems, login issues, portal errors, or anything technical on the platform.' },
                { icon: '🌐', title: 'Website Improvements', desc: 'Suggestions for new features, design feedback, or improvements to the system.' },
                { icon: '💳', title: 'Payment & Transaction Concerns', desc: 'Issues with recorded payments, wrong amounts, or discrepancies in your loan balance.' },
              ]}
            />

            <ContactCard
              initials="CJ"
              gradient="linear-gradient(135deg,#14B8A6,#3B82F6)"
              badge="Admin"
              badgeBg="rgba(20,184,166,0.1)"
              badgeBorder="rgba(20,184,166,0.25)"
              badgeColor="#2DD4BF"
              name="Charlou June Ramil"
              role="Admin"
              email="jramil725@gmail.com"
              teamsEmail="charlou.ramil@mysourcesolutions.com"
              accentColor="#2DD4BF"
              accentBg="rgba(20,184,166,0.07)"
              accentBorder="rgba(20,184,166,0.2)"
              glowColor="rgba(20,184,166,0.1)"
              expandedContent={[
                { icon: '✅', title: 'Loan Qualification Questions', desc: 'Not sure if you qualify or what documents you need? CJ can walk you through the requirements.' },
                { icon: '💬', title: 'Personal & Sensitive Matters', desc: 'Concerns you prefer to keep discreet — CJ handles things privately and with care.' },
                { icon: '📅', title: 'Payment Schedule & Cutoffs', desc: 'Questions about your due dates, semi-monthly cutoffs, or upcoming payment schedules.' },
                { icon: '📋', title: 'Application Status Follow-ups', desc: 'If you submitted an application and want a manual status update, reach out to CJ via Teams.' },
              ]}
            />

          </div>

          {/* ── INFO CARDS ── */}
          <div className="info-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, maxWidth: 820, margin: '0 auto' }}>
            {[
              { icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>, color: '#F59E0B', bg: 'rgba(245,158,11,0.07)', border: 'rgba(245,158,11,0.2)', label: 'Response Time', value: 'Within 12 hrs', sub: 'On business days' },
              { icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>, color: '#22C55E', bg: 'rgba(34,197,94,0.07)', border: 'rgba(34,197,94,0.2)', label: 'Office Hours', value: 'Mon – Fri', sub: '8:00 AM – 5:00 PM' },
              { icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>, color: '#a78bfa', bg: 'rgba(139,92,246,0.07)', border: 'rgba(139,92,246,0.2)', label: 'Fastest Way', value: 'Send an Email', sub: 'Goes straight to Admins' },
            ].map((c, i) => (
              <div key={i} className="info-card" style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 16, padding: '20px 18px', textAlign: 'center' }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: c.bg, border: `1px solid ${c.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>{c.icon}</div>
                <div style={{ fontSize: 11, color: c.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{c.label}</div>
                <div style={{ fontFamily: 'Space Grotesk,sans-serif', fontWeight: 800, fontSize: 15, color: '#F0F4FF', marginBottom: 3 }}>{c.value}</div>
                <div style={{ fontSize: 11, color: '#4B5580' }}>{c.sub}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── BOTTOM CTA ── */}
        <section style={{ padding: '20px 32px 80px' }}>
          <div style={{ maxWidth: 820, margin: '0 auto' }}>
            <div style={{ background: 'linear-gradient(135deg,rgba(59,130,246,0.08),rgba(139,92,246,0.08))', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 22, padding: '36px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 28, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 900, fontSize: 22, color: '#F0F4FF', marginBottom: 6 }}>Looking for quick answers?</div>
                <div style={{ fontSize: 14, color: '#7A8AAA', lineHeight: 1.7 }}>Most questions are already covered in our FAQ — check there first before sending a message.</div>
              </div>
              <div style={{ display: 'flex', gap: 10, flexShrink: 0, flexWrap: 'wrap' }}>
                <a href="/faq" className="cta-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '12px 24px', borderRadius: 11, background: 'linear-gradient(135deg,#6366F1,#8B5CF6)', color: '#fff', textDecoration: 'none', fontSize: 13, fontWeight: 700, fontFamily: 'Syne,sans-serif' }}>
                  <img src="/faq.png" alt="" style={{ width: 15, height: 15, objectFit: 'contain' }} />Browse FAQ
                </a>
                <a href="/apply" className="cta-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '12px 22px', borderRadius: 11, background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: '#CBD5F0', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>
                  <img src="/startup.png" alt="" style={{ width: 14, height: 14, objectFit: 'contain' }} />Apply Now
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
            {[{ label: 'Apply', href: '/apply' }, { label: 'My Portal', href: '/portal' }, { label: 'FAQ', href: '/faq' }, { label: 'Privacy Notice', href: '/privacy' }, { label: 'Terms & Conditions', href: '/terms' }].map((l, i) => (
              <a key={i} href={l.href} className="footer-lh" style={{ fontSize: 12, color: '#4B5580', textDecoration: 'none' }}>{l.label}</a>
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
        <ChatBot />
      </div>
    </div>
  )
}
