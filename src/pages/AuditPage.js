import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { Search, Download, History, Filter } from 'lucide-react'

const ACTION_COLORS = {
  BORROWER_ADDED:   { color: 'var(--green)',  bg: 'rgba(34,197,94,0.12)'  },
  BORROWER_EDITED:  { color: 'var(--blue)',   bg: 'rgba(59,130,246,0.12)' },
  BORROWER_DELETED: { color: 'var(--red)',    bg: 'rgba(239,68,68,0.12)'  },
  LOAN_CREATED:     { color: 'var(--purple)', bg: 'rgba(139,92,246,0.12)' },
  LOAN_EDITED:      { color: 'var(--blue)',   bg: 'rgba(59,130,246,0.12)' },
  LOAN_DELETED:     { color: 'var(--red)',    bg: 'rgba(239,68,68,0.12)'  },
  LOAN_RENEWED:     { color: 'var(--teal)',   bg: 'rgba(20,184,166,0.12)' },
  LOAN_DEFAULTED:   { color: 'var(--red)',    bg: 'rgba(239,68,68,0.12)'  },
  INSTALLMENT_PAID: { color: 'var(--green)',  bg: 'rgba(34,197,94,0.12)'  },
  SETTINGS_UPDATED: { color: 'var(--gold)',   bg: 'rgba(245,158,11,0.12)' },
  DEPT_ADDED:       { color: 'var(--teal)',   bg: 'rgba(20,184,166,0.12)' },
  DEPT_DELETED:     { color: 'var(--red)',    bg: 'rgba(239,68,68,0.12)'  },
  DASHBOARD_RESET:  { color: 'var(--red)',    bg: 'rgba(239,68,68,0.12)'  },
}

const ACTION_ICONS = {
  BORROWER_ADDED: '👤', BORROWER_EDITED: '✏️', BORROWER_DELETED: '🗑️',
  LOAN_CREATED: '📄', LOAN_EDITED: '✏️', LOAN_DELETED: '🗑️',
  LOAN_RENEWED: '🔄', LOAN_DEFAULTED: '❌', INSTALLMENT_PAID: '✅',
  SETTINGS_UPDATED: '⚙️', DEPT_ADDED: '🏢', DEPT_DELETED: '🏢',
  DASHBOARD_RESET: '⚠️',
}

const MODULE_COLORS = {
  Borrower: 'var(--blue)',
  Loan: 'var(--purple)',
  Settings: 'var(--gold)',
}

function ActionBadge({ action }) {
  const cfg = ACTION_COLORS[action] || { color: 'var(--text-label)', bg: 'rgba(255,255,255,0.06)' }
  const icon = ACTION_ICONS[action] || '•'
  const label = action?.replace(/_/g, ' ') || action
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
      color: cfg.color, background: cfg.bg, whiteSpace: 'nowrap'
    }}>
      {icon} {label}
    </span>
  )
}

export default function AuditPage() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [moduleFilter, setModuleFilter] = useState('All')
  const [actionFilter, setActionFilter] = useState('All')
  const [page, setPage] = useState(0)
  const PER_PAGE = 25

  const fetchLogs = useCallback(async () => {
    const { data } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
    setLogs(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  const modules = ['All', ...new Set(logs.map(l => l.module).filter(Boolean))]
  const actions = ['All', ...new Set(logs.map(l => l.action_type).filter(Boolean))]

  const filtered = logs.filter(l => {
    const matchSearch = !search ||
      l.description?.toLowerCase().includes(search.toLowerCase()) ||
      l.changed_by?.toLowerCase().includes(search.toLowerCase()) ||
      l.action_type?.toLowerCase().includes(search.toLowerCase())
    const matchModule = moduleFilter === 'All' || l.module === moduleFilter
    const matchAction = actionFilter === 'All' || l.action_type === actionFilter
    return matchSearch && matchModule && matchAction
  })

  const paginated = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE)
  const totalPages = Math.ceil(filtered.length / PER_PAGE)

  const exportCSV = () => {
    const headers = ['Timestamp', 'Action', 'Module', 'Description', 'Changed By']
    const rows = filtered.map(l => [
      new Date(l.created_at).toLocaleString('en-PH'),
      l.action_type, l.module, `"${l.description}"`, l.changed_by
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `LoanManifest_Audit_${new Date().toISOString().slice(0,10)}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  return (
    <div style={{ padding: '32px 28px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Audit History</h1>
          <p className="page-subtitle">{logs.length} total records — permanent, read-only</p>
        </div>
        <button onClick={exportCSV} className="btn-edit" style={{ gap: 6 }}>
          <Download size={15} /> Export CSV
        </button>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 14, marginBottom: 22 }}>
        {[
          { label: 'Total Actions', value: logs.length, color: 'var(--blue)' },
          { label: 'Loan Actions', value: logs.filter(l => l.module === 'Loan').length, color: 'var(--purple)' },
          { label: 'Borrower Actions', value: logs.filter(l => l.module === 'Borrower').length, color: 'var(--green)' },
          { label: 'Payments Recorded', value: logs.filter(l => l.action_type === 'INSTALLMENT_PAID').length, color: 'var(--teal)' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '14px 18px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 22, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="search-bar" style={{ flex: 1, minWidth: 200 }}>
          <Search size={15} />
          <input placeholder="Search description, user, action..." value={search} onChange={e => { setSearch(e.target.value); setPage(0) }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Filter size={14} color="var(--text-muted)" />
          <select
            value={moduleFilter}
            onChange={e => { setModuleFilter(e.target.value); setPage(0) }}
            style={{ background: 'var(--card)', border: '1px solid var(--card-border)', color: 'var(--text-primary)', borderRadius: 8, padding: '8px 12px', fontSize: 13, cursor: 'pointer' }}
          >
            {modules.map(m => <option key={m} value={m}>{m === 'All' ? 'All Modules' : m}</option>)}
          </select>
          <select
            value={actionFilter}
            onChange={e => { setActionFilter(e.target.value); setPage(0) }}
            style={{ background: 'var(--card)', border: '1px solid var(--card-border)', color: 'var(--text-primary)', borderRadius: 8, padding: '8px 12px', fontSize: 13, cursor: 'pointer' }}
          >
            {actions.map(a => <option key={a} value={a}>{a === 'All' ? 'All Actions' : a.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
      </div>

      {/* Log table */}
      {loading ? (
        <div className="empty-state"><p>Loading audit history...</p></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <History size={48} />
          <h3>No records found</h3>
          <p>{search ? 'Try a different search term' : 'Actions will appear here as they happen'}</p>
        </div>
      ) : (
        <>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {/* Table header */}
            <div style={{
              display: 'grid', gridTemplateColumns: '180px 1fr 100px 150px',
              padding: '12px 22px', borderBottom: '1px solid var(--card-border)',
              background: 'rgba(255,255,255,0.015)'
            }}>
              {['Action', 'Description', 'Module', 'Timestamp'].map(h => (
                <div key={h} style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{h}</div>
              ))}
            </div>

            {/* Rows */}
            {paginated.map((log, i) => (
              <div
                key={log.id}
                style={{
                  display: 'grid', gridTemplateColumns: '180px 1fr 100px 150px',
                  padding: '14px 22px',
                  borderBottom: i < paginated.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none',
                  transition: 'background 0.1s ease',
                  cursor: 'default'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.015)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <ActionBadge action={log.action_type} />
                </div>
                <div style={{ paddingRight: 16 }}>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 3, lineHeight: 1.4 }}>{log.description}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>by {log.changed_by || 'system'}</div>
                </div>
                <div>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6,
                    color: MODULE_COLORS[log.module] || 'var(--text-label)',
                    background: 'rgba(255,255,255,0.04)'
                  }}>
                    {log.module}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {new Date(log.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                  <div style={{ fontSize: 11, marginTop: 2 }}>
                    {new Date(log.created_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 20 }}>
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--card-border)', borderRadius: 8, padding: '6px 16px', cursor: page === 0 ? 'not-allowed' : 'pointer', color: 'var(--text-label)', opacity: page === 0 ? 0.4 : 1, fontSize: 13 }}
              >
                ← Prev
              </button>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                Page {page + 1} of {totalPages} · {filtered.length} records
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--card-border)', borderRadius: 8, padding: '6px 16px', cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer', color: 'var(--text-label)', opacity: page >= totalPages - 1 ? 0.4 : 1, fontSize: 13 }}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
