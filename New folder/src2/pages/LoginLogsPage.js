import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { Shield, CheckCircle, XCircle, RefreshCw, Monitor } from 'lucide-react'

export default function LoginLogsPage() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all') // all | success | failed

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('login_logs')
      .select('*')
      .order('logged_at', { ascending: false })
      .limit(100)
    setLogs(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  const filtered = filter === 'all' ? logs : logs.filter(l => filter === 'success' ? l.success : !l.success)

  const successCount = logs.filter(l => l.success).length
  const failCount = logs.filter(l => !l.success).length

  return (
    <div style={{ padding: '32px 28px', maxWidth: 900, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(135deg,rgba(59,130,246,0.2),rgba(139,92,246,0.2))', border: '1px solid rgba(139,92,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Shield size={20} color="#8B5CF6" />
          </div>
          <div>
            <h1 style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 22, color: '#F0F4FF', margin: 0 }}>Login Logs</h1>
            <div style={{ fontSize: 13, color: '#4B5580', marginTop: 2 }}>Admin access history with IP & location</div>
          </div>
        </div>
        <button onClick={fetchLogs} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 9, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#7A8AAA', fontSize: 13, cursor: 'pointer' }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total Attempts', value: logs.length, color: '#F0F4FF', bg: 'rgba(255,255,255,0.03)', border: 'rgba(255,255,255,0.08)' },
          { label: 'Successful Logins', value: successCount, color: '#22C55E', bg: 'rgba(34,197,94,0.06)', border: 'rgba(34,197,94,0.2)' },
          { label: 'Failed Attempts', value: failCount, color: '#EF4444', bg: 'rgba(239,68,68,0.06)', border: 'rgba(239,68,68,0.2)' },
        ].map((s, i) => (
          <div key={i} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 14, padding: '16px 20px' }}>
            <div style={{ fontSize: 11, color: '#4B5580', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 28, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[['all', 'All'], ['success', 'Successful'], ['failed', 'Failed']].map(([val, label]) => (
          <button key={val} onClick={() => setFilter(val)} style={{ padding: '7px 16px', borderRadius: 8, border: `1px solid ${filter === val ? 'rgba(139,92,246,0.4)' : 'rgba(255,255,255,0.07)'}`, background: filter === val ? 'rgba(139,92,246,0.12)' : 'transparent', color: filter === val ? '#a78bfa' : '#4B5580', fontSize: 13, fontWeight: filter === val ? 700 : 400, cursor: 'pointer' }}>
            {label}
          </button>
        ))}
      </div>

      {/* Log table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#4B5580' }}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Shield size={40} color="rgba(255,255,255,0.08)" style={{ marginBottom: 12 }} />
          <div style={{ color: '#4B5580', fontSize: 14 }}>No login records yet.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map((log, i) => (
            <div key={i} style={{ background: '#141B2D', border: `1px solid ${log.success ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.15)'}`, borderRadius: 14, padding: '16px 20px', display: 'grid', gridTemplateColumns: '28px 1fr auto', gap: 14, alignItems: 'center' }}>
              {/* Status icon */}
              <div>
                {log.success
                  ? <CheckCircle size={20} color="#22C55E" />
                  : <XCircle size={20} color="#EF4444" />}
              </div>

              {/* Details */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, alignItems: 'center' }}>
                {/* Email + status */}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#F0F4FF', marginBottom: 2 }}>{log.email}</div>
                  <div style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, display: 'inline-block', background: log.success ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: log.success ? '#22C55E' : '#EF4444', fontWeight: 700 }}>
                    {log.success ? 'Success' : 'Failed'}
                  </div>
                  {!log.success && log.fail_reason && (
                    <div style={{ fontSize: 11, color: '#EF4444', marginTop: 3, opacity: 0.7 }}>{log.fail_reason}</div>
                  )}
                </div>

                {/* Location */}
                <div>
                  <div style={{ fontSize: 13, color: '#F0F4FF', fontWeight: 600 }}>{log.location_display || 'Unknown'}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                    <Monitor size={11} color="#4B5580" />
                    <span style={{ fontSize: 11, color: '#4B5580', fontFamily: 'monospace' }}>{log.ip_address}</span>
                  </div>
                </div>

                {/* Browser */}
                <div style={{ fontSize: 11, color: '#4B5580', lineHeight: 1.5 }}>
                  {log.user_agent
                    ? (() => {
                        const ua = log.user_agent
                        const browser = ua.includes('Chrome') ? 'Chrome' : ua.includes('Firefox') ? 'Firefox' : ua.includes('Safari') ? 'Safari' : ua.includes('Edge') ? 'Edge' : 'Unknown Browser'
                        const os = ua.includes('Windows') ? 'Windows' : ua.includes('Mac') ? 'macOS' : ua.includes('Linux') ? 'Linux' : ua.includes('Android') ? 'Android' : ua.includes('iPhone') ? 'iPhone' : 'Unknown OS'
                        return `${browser} · ${os}`
                      })()
                    : 'Unknown'}
                </div>
              </div>

              {/* Timestamp */}
              <div style={{ textAlign: 'right', fontSize: 12, color: '#4B5580', whiteSpace: 'nowrap' }}>
                <div>{new Date(log.logged_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                <div style={{ marginTop: 2 }}>{new Date(log.logged_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
