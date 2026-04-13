import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'
import { supabase } from '../lib/supabase'
import { Mail, Lock, Eye, EyeOff } from 'lucide-react'

async function logLoginAttempt({ email, success, failReason = null }) {
  try {
    // Get IP + geo from ip-api.com (free, no key needed)
    const geo = await fetch('http://ip-api.com/json/?fields=status,city,regionName,country,countryCode,query')
      .then(r => r.json()).catch(() => null)

    const ip = geo?.query || 'Unknown'
    const city = geo?.city || ''
    const region = geo?.regionName || ''
    const country = geo?.country || ''
    const countryCode = geo?.countryCode || ''
    const location = [city, region, country].filter(Boolean).join(', ') || 'Unknown location'
    const flag = countryCode
      ? String.fromCodePoint(...[...countryCode.toUpperCase()].map(c => 0x1F1E6 - 65 + c.charCodeAt(0)))
      : ''

    await supabase.from('login_logs').insert({
      email,
      success,
      fail_reason: failReason,
      ip_address: ip,
      city,
      region,
      country,
      location_display: `${flag} ${location}`.trim(),
      user_agent: navigator.userAgent,
      logged_at: new Date().toISOString()
    })
  } catch (e) {
    console.warn('Login log failed:', e)
  }
}

function MoneyfestLogo({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="logo-gradient" x1="0" y1="64" x2="64" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#6366F1" />
          <stop offset="1" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>
      {/* Abstract 'M' formed by two soaring upward strokes */}
      <path 
        d="M12 52L24 16L32 38" 
        stroke="url(#logo-gradient)" 
        strokeWidth="7" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
      <path 
        d="M32 38L40 16L52 52" 
        stroke="url(#logo-gradient)" 
        strokeWidth="7" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
      {/* Manifestation energy/growth spark at the peak */}
      <path 
        d="M32 32V8M32 8L28 12M32 8L36 12" 
        stroke="#F59E0B" 
        strokeWidth="4" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
      <circle cx="32" cy="8" r="3" fill="#F59E0B" />
      {/* Core currency symbol at the center of gravity */}
      <text 
        x="32" y="54" 
        textAnchor="middle" 
        fill="#F0F4FF" 
        opacity="0.5" 
        fontSize="12" 
        fontWeight="bold" 
        fontFamily="sans-serif"
      >
        ₱
      </text>
    </svg>
  )
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const { signIn } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const handleLogin = async (e) => {
    e.preventDefault()
    if (!email || !password) return toast('Please enter email and password', 'error')
    setLoading(true)
    const { error } = await signIn(email, password)
    setLoading(false)
    if (error) {
      logLoginAttempt({ email, success: false, failReason: error.message })
      if (error.message.includes('Invalid login')) toast('Invalid email or password', 'error')
      else toast(error.message, 'error')
    } else {
      logLoginAttempt({ email, success: true })
      toast('Welcome back!', 'success')
      navigate('/dashboard')
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background glow */}
      <div style={{
        position: 'absolute',
        top: '20%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 600,
        height: 600,
        background: 'radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)',
        pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute',
        bottom: '10%',
        right: '10%',
        width: 400,
        height: 400,
        background: 'radial-gradient(circle, rgba(139,92,246,0.05) 0%, transparent 70%)',
        pointerEvents: 'none'
      }} />

      <div style={{ width: '100%', maxWidth: 420, position: 'relative' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 18,
            background: '#0F172A',
            border: '1.5px solid rgba(139,92,246,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 0 30px rgba(139,92,246,0.2)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {/* Subtle internal glow */}
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 0%, rgba(139,92,246,0.15), transparent 70%)', pointerEvents: 'none' }} />
            <MoneyfestLogo size={36} />
          </div>
          <h1 style={{
            fontFamily: 'Space Grotesk, sans-serif',
            fontSize: 32,
            fontWeight: 800,
            letterSpacing: '-0.04em',
            background: 'linear-gradient(135deg, #F0F4FF 30%, #93C5FD 70%, #C4B5FD 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            marginBottom: 6,
            lineHeight: 1.1
          }}>
            MoneyfestLending
          </h1>
          <p style={{ color: 'var(--text-label)', fontSize: 14 }}>
            Admin access only
          </p>
        </div>

        {/* Card */}
        <div className="card" style={{ padding: 32 }}>
          <form onSubmit={handleLogin}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                  <input
                    type="email"
                    placeholder="admin@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    style={{ paddingLeft: 38 }}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    style={{ paddingLeft: 38, paddingRight: 38 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="btn-primary"
                disabled={loading}
                style={{ width: '100%', justifyContent: 'center', padding: '12px 20px', marginTop: 4, fontSize: 15 }}
              >
                {loading ? 'Please wait...' : 'Sign In'}
              </button>
            </div>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: 24, color: 'var(--text-muted)', fontSize: 12 }}>
          MoneyfestLending • Private Admin System
        </p>
      </div>
    </div>
  )
}
