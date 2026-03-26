import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, FileText, TrendingUp,
  Calendar, History, Settings, LogOut, ClipboardList, Shield, CheckSquare, Briefcase
} from 'lucide-react'

function LedgerIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="4" width="4" height="24" rx="1.5" fill="rgba(255,255,255,0.25)" />
      <rect x="8" y="4" width="19" height="24" rx="2" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
      <line x1="9" y1="4" x2="9" y2="28" stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
      <line x1="13" y1="10" x2="23" y2="10" stroke="rgba(255,255,255,0.7)" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="13" y1="14" x2="23" y2="14" stroke="rgba(255,255,255,0.5)" strokeWidth="1" strokeLinecap="round" />
      <line x1="13" y1="18" x2="20" y2="18" stroke="rgba(255,255,255,0.5)" strokeWidth="1" strokeLinecap="round" />
      <text x="13" y="26" fontSize="7" fontWeight="bold" fill="rgba(255,255,255,0.9)" fontFamily="sans-serif">₱</text>
      <polyline points="21,22 23,24 26,20" stroke="rgba(255,255,255,0.8)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
}
import { useAuth } from '../context/AuthContext'
import { useToast } from './Toast'

const navItems = [
  { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/borrowers', icon: Users, label: 'Borrowers' },
  { to: '/admin/loans', icon: FileText, label: 'Loans' },
  { to: '/admin/collection', icon: Calendar, label: 'Collection Schedule' },
  { to: '/admin/forecast', icon: TrendingUp, label: 'Profit Forecast' },
  { to: '/admin/audit', icon: History, label: 'Audit History' },
  { to: '/admin/applications', icon: ClipboardList, label: 'Applications' },
  { to: '/admin/assessments', icon: CheckSquare, label: 'Assessments' },
  { to: '/admin/approvals', icon: CheckSquare, label: 'Approvals' },
  { to: '/admin/investor-pitch', icon: Briefcase, label: 'Investor Pitch' },
  { to: '/admin/login-logs', icon: Shield, label: 'Login Logs' },
]

export default function Sidebar() {
  const { signOut, user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    toast('Signed out successfully', 'info')
    navigate('/login')
  }

  return (
    <aside style={{
      width: 240,
      minWidth: 240,
      background: 'var(--bg)',
      borderRight: '1px solid var(--card-border)',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      position: 'sticky',
      top: 0,
      zIndex: 100
    }}>
      {/* Logo */}
      <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid var(--card-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/favicon-96x96.png" alt="MoneyfestLending" style={{ width: 36, height: 36, objectFit: 'contain' }} />
          <div>
            <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 800, fontSize: 15, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
              MoneyfestLending
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Admin Panel</div>
          </div>
        </div>
      </div>

      {/* Nav items */}
      <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 12px',
              borderRadius: 10,
              textDecoration: 'none',
              fontSize: 14,
              fontWeight: 500,
              position: 'relative',
              transition: 'all 0.15s ease',
              background: isActive ? 'rgba(99,102,241,0.15)' : 'transparent',
              color: isActive ? 'var(--text-primary)' : 'var(--text-label)',
              borderLeft: isActive ? '3px solid var(--blue)' : '3px solid transparent',
            })}
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Bottom: user + settings + logout */}
      <div style={{ padding: '10px', borderTop: '1px solid var(--card-border)' }}>
        <NavLink
          to="/admin/settings"
          style={({ isActive }) => ({
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px', borderRadius: 10, textDecoration: 'none',
            fontSize: 14, fontWeight: 500, transition: 'all 0.15s ease',
            background: isActive ? 'rgba(99,102,241,0.15)' : 'transparent',
            color: isActive ? 'var(--text-primary)' : 'var(--text-label)',
            borderLeft: isActive ? '3px solid var(--blue)' : '3px solid transparent',
            marginBottom: 4
          })}
        >
          <Settings size={18} />
          Settings
        </NavLink>

        <div style={{ padding: '8px 12px', marginBottom: 8 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Signed in as</div>
          <div style={{ fontSize: 12, color: 'var(--text-label)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.email}
          </div>
        </div>

        <button
          onClick={handleSignOut}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px', borderRadius: 10,
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', fontSize: 14, fontWeight: 500,
            width: '100%', transition: 'all 0.15s ease'
          }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--red)'; e.currentTarget.style.background = 'rgba(239,68,68,0.08)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'none' }}
        >
          <LogOut size={18} />
          Sign Out
        </button>
      </div>
    </aside>
  )
}
