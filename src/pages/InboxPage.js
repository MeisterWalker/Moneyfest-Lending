import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/Toast'
import { Mail, Inbox, RefreshCw, Star, Trash2, ChevronLeft, Search, Circle } from 'lucide-react'

const EDGE_URL = `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/zoho-inbox`
const ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY

function callInbox(params = {}) {
  const qs = new URLSearchParams(params).toString()
  return fetch(`${EDGE_URL}?${qs}`, {
    headers: { Authorization: `Bearer ${ANON_KEY}` }
  }).then(r => r.json())
}

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const date = new Date(Number(dateStr))
  const now = new Date()
  const diff = Math.floor((now - date) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

function stripHtml(html) {
  return html?.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() ?? ''
}

export default function InboxPage() {
  const { toast } = useToast()
  const [messages, setMessages]   = useState([])
  const [selected, setSelected]   = useState(null)
  const [content, setContent]     = useState(null)
  const [loading, setLoading]     = useState(true)
  const [loadingMsg, setLoadingMsg] = useState(false)
  const [search, setSearch]       = useState('')
  const [page, setPage]           = useState(0)
  const PAGE_SIZE = 20

  const fetchMessages = useCallback(async (p = 0) => {
    setLoading(true)
    try {
      const data = await callInbox({ action: 'list', start: p * PAGE_SIZE, limit: PAGE_SIZE })
      setMessages(data?.data ?? [])
      setPage(p)
    } catch (e) {
      toast('Failed to load inbox', 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  const fetchMessage = async (msg) => {
    setSelected(msg)
    setContent(null)
    setLoadingMsg(true)
    try {
      const data = await callInbox({ action: 'message', messageId: msg.messageId })
      setContent(data?.data ?? null)
    } catch (e) {
      toast('Failed to load email', 'error')
    } finally {
      setLoadingMsg(false)
    }
  }

  useEffect(() => { fetchMessages(0) }, [fetchMessages])

  const filtered = messages.filter(m => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      m.subject?.toLowerCase().includes(q) ||
      m.sender?.toLowerCase().includes(q) ||
      m.fromAddress?.toLowerCase().includes(q)
    )
  })

  return (
    <div style={{ padding: '28px 24px', minHeight: '100vh', background: 'var(--bg)' }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Mail size={20} color="#fff" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, fontFamily: 'Syne', color: 'var(--text)' }}>Inbox</h1>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>support@moneyfestlending.loan</p>
          </div>
        </div>
        <button
          onClick={() => { setSelected(null); setContent(null); fetchMessages(0) }}
          style={{
            display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px',
            background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)',
            borderRadius: 10, color: '#60A5FA', fontWeight: 600, fontSize: 13, cursor: 'pointer'
          }}
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* ── Layout ── */}
      <div style={{ display: 'grid', gridTemplateColumns: selected ? '360px 1fr' : '1fr', gap: 16 }}>

        {/* ── Message List ── */}
        <div style={{
          background: 'var(--card)', borderRadius: 16, border: '1px solid var(--border)',
          overflow: 'hidden', display: 'flex', flexDirection: 'column'
        }}>
          {/* Search */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search messages..."
                style={{
                  width: '100%', paddingLeft: 34, paddingRight: 12, paddingTop: 8, paddingBottom: 8,
                  background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8,
                  color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          {/* List */}
          <div style={{ flex: 1, overflowY: 'auto', maxHeight: 'calc(100vh - 220px)' }}>
            {loading ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
                Loading inbox...
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
                <Inbox size={32} style={{ marginBottom: 10, opacity: 0.4 }} />
                <div style={{ fontSize: 14 }}>No messages found</div>
              </div>
            ) : filtered.map(msg => {
              const isUnread  = msg.status === '0' || msg.status === 0
              const isActive  = selected?.messageId === msg.messageId
              return (
                <div
                  key={msg.messageId}
                  onClick={() => fetchMessage(msg)}
                  style={{
                    padding: '14px 16px',
                    borderBottom: '1px solid var(--border)',
                    cursor: 'pointer',
                    background: isActive
                      ? 'rgba(59,130,246,0.1)'
                      : isUnread ? 'rgba(59,130,246,0.04)' : 'transparent',
                    borderLeft: isActive ? '3px solid #3B82F6' : '3px solid transparent',
                    transition: 'background 0.15s'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                      {isUnread && <Circle size={7} fill="#3B82F6" color="#3B82F6" style={{ flexShrink: 0 }} />}
                      <span style={{
                        fontSize: 13, fontWeight: isUnread ? 700 : 500,
                        color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                      }}>
                        {msg.sender || msg.fromAddress || 'Unknown Sender'}
                      </span>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, marginLeft: 8 }}>
                      {timeAgo(msg.receivedTime || msg.sentDateInGMT)}
                    </span>
                  </div>
                  <div style={{
                    fontSize: 13, fontWeight: isUnread ? 600 : 400,
                    color: isUnread ? 'var(--text)' : 'var(--text-muted)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 3
                  }}>
                    {msg.subject || '(No Subject)'}
                  </div>
                  <div style={{
                    fontSize: 12, color: 'var(--text-muted)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                  }}>
                    {stripHtml(msg.summary || '')}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Pagination */}
          {!loading && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', borderTop: '1px solid var(--border)' }}>
              <button
                onClick={() => fetchMessages(Math.max(0, page - 1))}
                disabled={page === 0}
                style={{ fontSize: 12, color: page === 0 ? 'var(--text-muted)' : '#60A5FA', background: 'none', border: 'none', cursor: page === 0 ? 'default' : 'pointer' }}
              >← Newer</button>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Page {page + 1}</span>
              <button
                onClick={() => fetchMessages(page + 1)}
                disabled={filtered.length < PAGE_SIZE}
                style={{ fontSize: 12, color: filtered.length < PAGE_SIZE ? 'var(--text-muted)' : '#60A5FA', background: 'none', border: 'none', cursor: filtered.length < PAGE_SIZE ? 'default' : 'pointer' }}
              >Older →</button>
            </div>
          )}
        </div>

        {/* ── Message Detail ── */}
        {selected && (
          <div style={{
            background: 'var(--card)', borderRadius: 16, border: '1px solid var(--border)',
            overflow: 'hidden', display: 'flex', flexDirection: 'column'
          }}>
            {/* Detail Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                onClick={() => { setSelected(null); setContent(null) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
              >
                <ChevronLeft size={18} />
              </button>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>
                  {selected.subject || '(No Subject)'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  From: <strong style={{ color: 'var(--text)' }}>{selected.sender || selected.fromAddress}</strong>
                  &nbsp;·&nbsp;{timeAgo(selected.receivedTime || selected.sentDateInGMT)}
                </div>
              </div>
            </div>

            {/* Detail Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', maxHeight: 'calc(100vh - 220px)' }}>
              {loadingMsg ? (
                <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)', fontSize: 14 }}>
                  Loading email...
                </div>
              ) : content ? (
                <div style={{
                  fontSize: 14, lineHeight: 1.8, color: 'var(--text)',
                  background: 'rgba(255,255,255,0.02)', borderRadius: 12,
                  padding: 20, border: '1px solid var(--border)'
                }}>
                  {content.htmlContent ? (
                    <iframe
                      srcDoc={content.htmlContent}
                      style={{ width: '100%', minHeight: 400, border: 'none', borderRadius: 8, background: '#fff' }}
                      title="email-content"
                      sandbox="allow-same-origin"
                    />
                  ) : (
                    <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }}>
                      {content.content || stripHtml(content.htmlContent || '') || '(Empty message)'}
                    </pre>
                  )}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
                  Could not load email content.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
