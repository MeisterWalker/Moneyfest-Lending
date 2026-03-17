import { useState, useEffect, useRef, useCallback } from 'react'
import { Bell, X, CheckCheck, FileText, Clock, BellOff, Eye } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const VAPID_PUBLIC = 'BH38yVjqloXzB2UF9aDXCV8qdOiKhPoQ1rRTYSyRtWZiDe8qOcFFW8ZNOMA-yw0xlf0O0jcPBnrK99xyZsjzpRE'

function playChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    function beep(freq, startTime, duration) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, startTime)
      gain.gain.setValueAtTime(0, startTime)
      gain.gain.linearRampToValueAtTime(0.3, startTime + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration)
      osc.start(startTime); osc.stop(startTime + duration)
    }
    const now = ctx.currentTime
    beep(880, now, 0.25)
    beep(1100, now + 0.18, 0.3)
  } catch (e) {}
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

async function registerPushSubscription(userEmail) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false
  try {
    const reg = await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready
    const existing = await reg.pushManager.getSubscription()
    const sub = existing || await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC)
    })
    await supabase.from('push_subscriptions').upsert({
      user_email: userEmail, subscription: sub.toJSON()
    }, { onConflict: 'user_email,subscription' })
    return true
  } catch (e) { return false }
}

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago'
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago'
  return new Date(dateStr).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
}

export default function NotificationBell() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [permission, setPermission] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'default')
  const panelRef = useRef(null)
  const seenIds = useRef(new Set())

  // Load persisted notifications from DB
  const loadNotifications = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_email', user.email)
      .order('created_at', { ascending: false })
      .limit(50)
    if (data) {
      setNotifications(data)
      data.forEach(n => seenIds.current.add(n.id))
    }
    setLoading(false)
  }, [user])

  useEffect(() => { loadNotifications() }, [loadNotifications])

  const addNotif = useCallback(async (type, title, message, shouldSound) => {
    if (!user) return
    const id = type + '-' + Date.now()
    if (seenIds.current.has(id)) return

    // Save to DB
    const { data, error } = await supabase.from('notifications').insert({
      id, user_email: user.email, type, title, message, read: false
    }).select().single()

    if (!error && data) {
      seenIds.current.add(id)
      setNotifications(prev => [data, ...prev].slice(0, 50))
      if (shouldSound && !document.hidden) playChime()
    }
  }, [user])

  // Check due-tomorrow on mount
  useEffect(() => {
    if (!user || loading) return
    async function checkDue() {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const y = tomorrow.getFullYear()
      const m = String(tomorrow.getMonth() + 1).padStart(2, '0')
      const d = String(tomorrow.getDate()).padStart(2, '0')
      const tomorrowStr = y + '-' + m + '-' + d

      const { data: loans } = await supabase
        .from('loans').select('*, borrowers(full_name)')
        .in('status', ['Active', 'Partially Paid'])
      if (!loans) return

      loans.forEach(loan => {
        if (!loan.release_date) return
        const release = new Date(loan.release_date + 'T00:00:00')
        for (let i = 1; i <= 4 - (loan.payments_made || 0); i++) {
          const cutoff = new Date(release)
          if (release.getDate() <= 5) {
            cutoff.setMonth(cutoff.getMonth() + Math.floor((i - 1) / 2))
            cutoff.setDate(i % 2 === 1 ? 20 : 5)
          } else {
            cutoff.setMonth(cutoff.getMonth() + Math.ceil(i / 2))
            cutoff.setDate(i % 2 === 1 ? 5 : 20)
          }
          const cs = cutoff.getFullYear() + '-' + String(cutoff.getMonth()+1).padStart(2,'0') + '-' + String(cutoff.getDate()).padStart(2,'0')
          if (cs === tomorrowStr) {
            const name = loan.borrowers?.full_name || 'Unknown'
            const msg = name + ' - P' + Number(loan.installment_amount).toLocaleString() + ' installment due tomorrow'
            // Only add if not already notified today
            const todayKey = 'due-' + loan.id + '-' + tomorrowStr
            if (!seenIds.current.has(todayKey)) {
              seenIds.current.add(todayKey)
              addNotif('due', 'Due Tomorrow', msg, false)
            }
          }
        }
      })
    }
    checkDue()
  }, [user, loading, addNotif])

  // Real-time new applications
  useEffect(() => {
    if (!user) return
    const channel = supabase.channel('new-applications-bell')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'applications' },
        payload => {
          const app = payload.new
          const msg = app.full_name + ' applied for P' + Number(app.loan_amount).toLocaleString()
          addNotif('application', 'New Application', msg, true)
        })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [user, addNotif])

  // Close on outside click
  useEffect(() => {
    function handleClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  async function markRead(id) {
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  async function markAllRead() {
    if (!user) return
    await supabase.from('notifications').update({ read: true }).eq('user_email', user.email)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  async function dismiss(id) {
    await supabase.from('notifications').delete().eq('id', id)
    setNotifications(prev => prev.filter(n => n.id !== id))
    seenIds.current.delete(id)
  }

  async function clearAll() {
    if (!user) return
    await supabase.from('notifications').delete().eq('user_email', user.email)
    setNotifications([])
    seenIds.current.clear()
  }

  async function handleEnablePush() {
    if (!('Notification' in window)) return
    const result = await Notification.requestPermission()
    setPermission(result)
    if (result === 'granted') await registerPushSubscription(user.email)
  }

  const unread = notifications.filter(n => !n.read).length

  if (!user) return null

  return (
    <div ref={panelRef} style={{ position: 'fixed', bottom: 28, right: 28, zIndex: 1000 }}>
      {/* Bell Button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: 52, height: 52, borderRadius: '50%',
          background: unread > 0 ? 'var(--blue)' : '#1E2A45',
          border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: unread > 0 ? '0 0 0 4px rgba(59,130,246,0.25), 0 4px 20px rgba(0,0,0,0.4)' : '0 4px 20px rgba(0,0,0,0.4)',
          transition: 'all 0.2s ease', position: 'relative',
        }}
      >
        <Bell size={20} color="#fff" style={{ animation: unread > 0 ? 'bellRing 1.5s ease infinite' : 'none' }} />
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4, background: '#EF4444', color: '#fff',
            fontSize: 10, fontWeight: 800, fontFamily: 'Space Grotesk',
            minWidth: 18, height: 18, borderRadius: 9,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 4px', border: '2px solid #0B0F1A'
          }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div style={{
          position: 'absolute', bottom: 64, right: 0, width: 350, maxHeight: 540,
          background: '#141B2D', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          animation: 'slideUp 0.2s ease'
        }}>

          {/* Header */}
          <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 14, color: '#F0F4FF' }}>Notifications</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                {unread > 0 ? unread + ' unread' : 'All caught up'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {unread > 0 && (
                <button onClick={markAllRead} title="Mark all read"
                  style={{ background: 'rgba(255,255,255,0.05)', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '5px 8px', borderRadius: 7, display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                  <Eye size={13} /> Mark all read
                </button>
              )}
              {notifications.length > 0 && (
                <button onClick={clearAll} title="Clear all"
                  style={{ background: 'rgba(255,255,255,0.05)', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '5px 8px', borderRadius: 7, display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                  <CheckCheck size={13} /> Clear all
                </button>
              )}
              <button onClick={() => setOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center' }}>
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Push permission banner */}
          {permission !== 'granted' && permission !== 'denied' && (
            <div style={{ padding: '10px 16px', background: 'rgba(59,130,246,0.08)', borderBottom: '1px solid rgba(59,130,246,0.15)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <BellOff size={14} color="var(--blue)" style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, fontSize: 11, color: 'var(--text-label)', lineHeight: 1.4 }}>
                Enable system notifications to get alerted in the background
              </div>
              <button onClick={handleEnablePush}
                style={{ background: 'var(--blue)', border: 'none', borderRadius: 6, color: '#fff', fontSize: 11, fontWeight: 700, padding: '5px 10px', cursor: 'pointer', flexShrink: 0 }}>
                Enable
              </button>
            </div>
          )}

          {permission === 'granted' && (
            <div style={{ padding: '8px 16px', background: 'rgba(34,197,94,0.06)', borderBottom: '1px solid rgba(34,197,94,0.1)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', flexShrink: 0 }} />
              <div style={{ fontSize: 11, color: 'var(--green)' }}>System notifications active</div>
            </div>
          )}

          {/* List */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {loading ? (
              <div style={{ padding: '36px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading...</div>
              </div>
            ) : notifications.length === 0 ? (
              <div style={{ padding: '36px 20px', textAlign: 'center' }}>
                <Bell size={32} color="rgba(255,255,255,0.1)" style={{ marginBottom: 10 }} />
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No notifications yet</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', marginTop: 4 }}>New applications and due dates will appear here</div>
              </div>
            ) : notifications.map(n => (
              <div key={n.id} style={{
                padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)',
                display: 'flex', gap: 12, alignItems: 'flex-start',
                background: n.read ? 'transparent' : 'rgba(59,130,246,0.06)',
                transition: 'background 0.2s'
              }}>
                {/* Unread dot */}
                <div style={{ paddingTop: 6, flexShrink: 0 }}>
                  <div style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: n.read ? 'transparent' : 'var(--blue)',
                    border: n.read ? '1px solid rgba(255,255,255,0.1)' : 'none',
                    transition: 'all 0.2s'
                  }} />
                </div>
                {/* Icon */}
                <div style={{
                  width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                  background: n.type === 'application' ? 'rgba(139,92,246,0.15)' : 'rgba(245,158,11,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  {n.type === 'application' ? <FileText size={15} color="#8B5CF6" /> : <Clock size={15} color="#F59E0B" />}
                </div>
                {/* Text */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#F0F4FF', fontFamily: 'Space Grotesk' }}>{n.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-label)', marginTop: 2, lineHeight: 1.4, wordBreak: 'break-word' }}>{n.message}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{timeAgo(n.created_at)}</div>
                </div>
                {/* Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                  {!n.read && (
                    <button onClick={() => markRead(n.id)} title="Mark as read"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--blue)', padding: 2, display: 'flex', alignItems: 'center' }}>
                      <Eye size={13} />
                    </button>
                  )}
                  <button onClick={() => dismiss(n.id)} title="Dismiss"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.2)', padding: 2, display: 'flex', alignItems: 'center' }}>
                    <X size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes bellRing {
          0%,100%{transform:rotate(0)} 10%{transform:rotate(15deg)} 20%{transform:rotate(-12deg)} 30%{transform:rotate(10deg)} 40%{transform:rotate(-8deg)} 50%{transform:rotate(0)}
        }
        @keyframes slideUp {
          from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)}
        }
      `}</style>
    </div>
  )
}
