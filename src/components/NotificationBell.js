import { useState, useEffect, useRef, useCallback } from 'react'
import { Bell, X, CheckCheck, FileText, Clock, BellOff } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

function playChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    function beep(freq, startTime, duration) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, startTime)
      gain.gain.setValueAtTime(0, startTime)
      gain.gain.linearRampToValueAtTime(0.3, startTime + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration)
      osc.start(startTime)
      osc.stop(startTime + duration)
    }
    const now = ctx.currentTime
    beep(880, now, 0.25)
    beep(1100, now + 0.18, 0.3)
  } catch (e) {}
}

function sendPush(title, body, url) {
  if (!('serviceWorker' in navigator)) return
  navigator.serviceWorker.ready.then(reg => {
    reg.showNotification(title, {
      body, icon: '/favicon-96x96.png', badge: '/favicon-96x96.png',
      vibrate: [200, 100, 200], data: { url },
      tag: 'loan-manifest-' + Date.now()
    })
  }).catch(() => {})
}

async function registerSW() {
  if (!('serviceWorker' in navigator)) return false
  try { await navigator.serviceWorker.register('/sw.js'); return true }
  catch (e) { return false }
}

async function requestPermission() {
  if (!('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  return await Notification.requestPermission()
}

function makeAppNotif(app) {
  return {
    id: 'app-' + app.id, type: 'application', title: 'New Application',
    message: app.full_name + ' applied for P' + Number(app.loan_amount).toLocaleString(),
    time: new Date(app.created_at), read: false,
  }
}

function makeDueNotif(loan, borrowerName) {
  return {
    id: 'due-' + loan.id, type: 'due', title: 'Due Tomorrow',
    message: borrowerName + ' - P' + Number(loan.installment_amount).toLocaleString() + ' installment due',
    time: new Date(), read: false,
  }
}

function timeAgo(date) {
  const diff = Math.floor((Date.now() - date) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago'
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago'
  return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
}

export default function NotificationBell() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [permission, setPermission] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'default')
  const [swReady, setSwReady] = useState(false)
  const panelRef = useRef(null)
  const seenIds = useRef(new Set())

  useEffect(() => {
    registerSW().then(ok => setSwReady(ok))
  }, [])

  const addNotif = useCallback((notif, shouldSound) => {
    if (seenIds.current.has(notif.id)) return
    seenIds.current.add(notif.id)
    setNotifications(prev => [notif, ...prev].slice(0, 50))
    if (!shouldSound) return
    if (document.hidden) {
      if (Notification.permission === 'granted') {
        sendPush(notif.title, notif.message,
          notif.type === 'application' ? '/admin/applications' : '/admin/loans')
      }
    } else {
      playChime()
    }
  }, [])

  useEffect(() => {
    if (!user) return
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
            addNotif(makeDueNotif(loan, loan.borrowers?.full_name || 'Unknown'), false)
          }
        }
      })
    }
    checkDue()
  }, [user, addNotif])

  useEffect(() => {
    if (!user) return
    const channel = supabase.channel('new-applications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'applications' },
        payload => addNotif(makeAppNotif(payload.new), true))
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [user, addNotif])

  useEffect(() => {
    function handleClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const unread = notifications.filter(n => !n.read).length

  async function handleEnablePush() {
    const result = await requestPermission()
    setPermission(result)
    if (result === 'granted' && !swReady) setSwReady(await registerSW())
  }

  if (!user) return null

  return (
    <div ref={panelRef} style={{ position: 'fixed', bottom: 28, right: 28, zIndex: 1000 }}>
      <button
        onClick={() => { setOpen(o => !o); if (unread > 0) setNotifications(prev => prev.map(n => ({ ...n, read: true }))) }}
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

      {open && (
        <div style={{
          position: 'absolute', bottom: 64, right: 0, width: 340, maxHeight: 520,
          background: '#141B2D', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          animation: 'slideUp 0.2s ease'
        }}>
          <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 14, color: '#F0F4FF' }}>Notifications</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                {notifications.length === 0 ? 'All clear' : notifications.length + ' alert' + (notifications.length !== 1 ? 's' : '')}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {notifications.length > 0 && (
                <button onClick={() => { setNotifications([]); seenIds.current.clear() }} title="Clear all"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center' }}>
                  <CheckCheck size={15} />
                </button>
              )}
              <button onClick={() => setOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center' }}>
                <X size={15} />
              </button>
            </div>
          </div>

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

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '36px 20px', textAlign: 'center' }}>
                <Bell size={32} color="rgba(255,255,255,0.1)" style={{ marginBottom: 10 }} />
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No notifications yet</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', marginTop: 4 }}>New applications and due dates will appear here</div>
              </div>
            ) : notifications.map(n => (
              <div key={n.id} style={{
                padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)',
                display: 'flex', gap: 12, alignItems: 'flex-start',
                background: n.read ? 'transparent' : 'rgba(59,130,246,0.04)',
              }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                  background: n.type === 'application' ? 'rgba(139,92,246,0.15)' : 'rgba(245,158,11,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  {n.type === 'application' ? <FileText size={15} color="#8B5CF6" /> : <Clock size={15} color="#F59E0B" />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#F0F4FF', fontFamily: 'Space Grotesk' }}>{n.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-label)', marginTop: 2, lineHeight: 1.4, wordBreak: 'break-word' }}>{n.message}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{timeAgo(n.time)}</div>
                </div>
                <button onClick={() => { setNotifications(prev => prev.filter(x => x.id !== n.id)); seenIds.current.delete(n.id) }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.2)', padding: 2, flexShrink: 0, marginTop: 2 }}>
                  <X size={13} />
                </button>
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
