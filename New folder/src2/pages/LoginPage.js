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

function LedgerIcon({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Book spine */}
      <rect x="5" y="4" width="4" height="24" rx="1.5" fill="rgba(255,255,255,0.25)" />
      {/* Book cover */}
      <rect x="8" y="4" width="19" height="24" rx="2" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
      {/* Spine binding line */}
      <line x1="9" y1="4" x2="9" y2="28" stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
      {/* Lines representing ledger entries */}
      <line x1="13" y1="10" x2="23" y2="10" stroke="rgba(255,255,255,0.7)" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="13" y1="14" x2="23" y2="14" stroke="rgba(255,255,255,0.5)" strokeWidth="1" strokeLinecap="round" />
      <line x1="13" y1="18" x2="20" y2="18" stroke="rgba(255,255,255,0.5)" strokeWidth="1" strokeLinecap="round" />
      {/* Peso sign at bottom of ledger */}
      <text x="13" y="26" fontSize="7" fontWeight="bold" fill="rgba(255,255,255,0.9)" fontFamily="sans-serif">₱</text>
      {/* Small checkmark / tick */}
      <polyline points="21,22 23,24 26,20" stroke="rgba(255,255,255,0.8)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [isSetup, setIsSetup] = useState(false)
  const { signIn, signUp } = useAuth()
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

  const handleSetup = async (e) => {
    e.preventDefault()
    if (!email || !password) return toast('Please fill in all fields', 'error')
    if (password.length < 8) return toast('Password must be at least 8 characters', 'error')
    setLoading(true)
    const { error } = await signUp(email, password)
    setLoading(false)
    if (error) toast(error.message, 'error')
    else {
      toast('Admin account created! Please sign in.', 'success')
      setIsSetup(false)
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
            background: 'linear-gradient(135deg, var(--blue), var(--purple))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 8px 32px rgba(59,130,246,0.3)'
          }}>
            <LedgerIcon size={32} />
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
            {isSetup ? 'Create your admin account' : 'Admin access only'}
          </p>
        </div>

        {/* Card */}
        <div className="card" style={{ padding: 32 }}>
          <form onSubmit={isSetup ? handleSetup : handleLogin}>
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
                    placeholder={isSetup ? 'Min. 8 characters' : 'Enter password'}
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
                {loading ? 'Please wait...' : isSetup ? 'Create Admin Account' : 'Sign In'}
              </button>
            </div>
          </form>

          <div className="divider" />

          <div style={{ textAlign: 'center' }}>
            <button
              onClick={() => setIsSetup(!isSetup)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--blue)', fontSize: 13 }}
            >
              {isSetup ? "← Back to sign in" : "First time? Create admin account →"}
            </button>
          </div>
        </div>

        <p style={{ textAlign: 'center', marginTop: 24, color: 'var(--text-muted)', fontSize: 12 }}>
          MoneyfestLending • Private Admin System
        </p>
      </div>
    </div>
  )
}
