import { useState, useRef, useEffect } from 'react'

const SUPABASE_URL = 'https://swwedyfgbqhtavxmbmhv.supabase.co'
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3d2VkeWZnYnFodGF2eG1ibWh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNzY2MDEsImV4cCI6MjA4ODY1MjYwMX0.IFVKtSVFmNytOYMD23yFXgEyGyBNVQ31SknoxpGvuio'

const SUGGESTIONS = [
  'How do I apply for a loan?',
  'What is the interest rate?',
  'What is a QuickLoan?',
  'How does the Security Hold work?',
  'Unsay interest rate sa loan?',
  'Pila ang maximum na loan?',
]

function TypingDots() {
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '4px 0' }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 7, height: 7, borderRadius: '50%',
          background: 'rgba(139,92,246,0.7)',
          animation: `jpBounce 1.2s ease-in-out ${i * 0.2}s infinite`
        }} />
      ))}
    </div>
  )
}

function Avatar() {
  return (
    <div style={{
      width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
      background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 14, fontWeight: 900, color: '#fff', fontFamily: 'Space Grotesk',
      boxShadow: '0 0 10px rgba(139,92,246,0.4)'
    }}>Paul</div>
  )
}

export default function ChatBot() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([
    { role: 'assistant', text: "Hi! I'm **Paul**, your AI assistant by Moneyfest 😊 I'm here to help you with loans, interest rates, eligibility, and more! I can understand and respond in both **English** and **Cebuano (Bisaya)** — feel free to ask me anything!" }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [unread, setUnread] = useState(0)
  const [showSuggestions, setShowSuggestions] = useState(true)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (open) {
      setUnread(0)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const sendMessage = async (text) => {
    const userText = text ?? input.trim()
    if (!userText || loading) return
    setInput('')
    setShowSuggestions(false)

    const newMessages = [...messages, { role: 'user', text: userText }]
    setMessages(newMessages)
    setLoading(true)

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/chat-assistant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ANON_KEY}`,
          'apikey': ANON_KEY
        },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, text: m.text }))
        })
      })
      const data = await res.json()
      const reply = data.reply ?? "Sorry, I'm having trouble right now. Please try again!"
      setMessages(prev => [...prev, { role: 'assistant', text: reply }])
      if (!open) setUnread(u => u + 1)
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', text: "Oops! Something went wrong. Please try again." }])
    } finally {
      setLoading(false)
    }
  }

  const handleKey = e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  // Render markdown-lite: bold **text**, newlines
  const renderText = (text) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g)
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} style={{ color: '#F0F4FF' }}>{part.slice(2, -2)}</strong>
      }
      return part.split('\n').map((line, j, arr) => (
        <span key={`${i}-${j}`}>{line}{j < arr.length - 1 && <br />}</span>
      ))
    })
  }

  return (
    <>
      <style>{`
        @keyframes jpBounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
          30% { transform: translateY(-6px); opacity: 1; }
        }
        @keyframes jpFadeIn {
          from { opacity: 0; transform: translateY(16px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes jpPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(139,92,246,0.5); }
          50%       { box-shadow: 0 0 0 10px rgba(139,92,246,0); }
        }
        @keyframes jpSlideIn {
          from { opacity: 0; transform: translateX(-8px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .jp-msg-user { animation: jpSlideIn 0.2s ease; }
        .jp-msg-bot  { animation: jpSlideIn 0.25s ease; }
        .jp-send-btn:hover { background: linear-gradient(135deg,#2563EB,#7C3AED) !important; transform: scale(1.05); }
        .jp-chip:hover { background: rgba(139,92,246,0.15) !important; border-color: rgba(139,92,246,0.5) !important; color: #c4b5fd !important; }
        .jp-close:hover { background: rgba(255,255,255,0.1) !important; }
        .jp-input:focus { border-color: rgba(139,92,246,0.5) !important; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(139,92,246,0.3); border-radius: 4px; }
      `}</style>

      {/* ── Floating bubble ── */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: 'fixed', bottom: 28, right: 28, zIndex: 9999,
          width: 60, height: 60, borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)',
          boxShadow: '0 8px 32px rgba(139,92,246,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: open ? 'none' : 'jpPulse 2.5s ease-in-out infinite',
          transition: 'transform 0.2s, box-shadow 0.2s',
          transform: open ? 'scale(1.05)' : 'scale(1)',
        }}
        title="Chat with JP"
      >
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        ) : (
          <span style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 18, color: '#fff', letterSpacing: -0.5 }}>Paul</span>
        )}
        {unread > 0 && !open && (
          <div style={{
            position: 'absolute', top: -4, right: -4,
            width: 20, height: 20, borderRadius: '50%',
            background: '#EF4444', border: '2px solid #07090F',
            fontSize: 10, fontWeight: 800, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>{unread}</div>
        )}
      </button>

      {/* ── Chat window ── */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 100, right: 28, zIndex: 9998,
          width: 370, maxWidth: 'calc(100vw - 40px)',
          background: '#0B0F1A',
          border: '1px solid rgba(139,92,246,0.25)',
          borderRadius: 20,
          boxShadow: '0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(139,92,246,0.1)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          animation: 'jpFadeIn 0.25s cubic-bezier(0.34,1.56,0.64,1)',
          maxHeight: 'calc(100vh - 140px)',
        }}>

          {/* Header */}
          <div style={{
            background: 'linear-gradient(135deg, #0f1729, #1a1040)',
            padding: '14px 16px',
            borderBottom: '1px solid rgba(139,92,246,0.2)',
            display: 'flex', alignItems: 'center', gap: 12
          }}>
            <div style={{ position: 'relative' }}>
              <Avatar />
              <div style={{
                position: 'absolute', bottom: 0, right: 0,
                width: 10, height: 10, borderRadius: '50%',
                background: '#22C55E', border: '2px solid #0B0F1A'
              }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 15, color: '#F0F4FF', letterSpacing: -0.3 }}>
                Paul <span style={{ fontWeight: 400, fontSize: 12, color: 'rgba(139,92,246,0.9)' }}>by LacaroNexus</span>
              </div>
              <div style={{ fontSize: 11, color: '#22C55E', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22C55E', display: 'inline-block' }} />
                Online · AI Loan Assistant
              </div>
            </div>
            <button
              className="jp-close"
              onClick={() => setOpen(false)}
              style={{
                width: 30, height: 30, borderRadius: '50%',
                border: 'none', background: 'rgba(255,255,255,0.06)',
                color: '#7A8AAA', cursor: 'pointer', fontSize: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.15s'
              }}
            >✕</button>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: '16px 14px',
            display: 'flex', flexDirection: 'column', gap: 12,
            minHeight: 0
          }}>
            {/* Suggestion chips — shown only at start */}
            {showSuggestions && messages.length <= 1 && (
              <div style={{ marginBottom: 4 }}>
                <div style={{ fontSize: 11, color: '#4B5580', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  Quick questions
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {SUGGESTIONS.map((s, i) => (
                    <button
                      key={i}
                      className="jp-chip"
                      onClick={() => sendMessage(s)}
                      style={{
                        padding: '6px 12px', borderRadius: 20,
                        background: 'rgba(139,92,246,0.08)',
                        border: '1px solid rgba(139,92,246,0.25)',
                        color: '#a78bfa', fontSize: 12, fontWeight: 500,
                        cursor: 'pointer', transition: 'all 0.15s',
                        fontFamily: 'DM Sans, sans-serif'
                      }}
                    >{s}</button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={msg.role === 'user' ? 'jp-msg-user' : 'jp-msg-bot'}
                style={{
                  display: 'flex',
                  flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                  alignItems: 'flex-end', gap: 8
                }}
              >
                {msg.role === 'assistant' && <Avatar />}
                <div style={{
                  maxWidth: '78%',
                  padding: '10px 14px',
                  borderRadius: msg.role === 'user'
                    ? '18px 18px 4px 18px'
                    : '18px 18px 18px 4px',
                  background: msg.role === 'user'
                    ? 'linear-gradient(135deg, #3B82F6, #7C3AED)'
                    : 'rgba(255,255,255,0.05)',
                  border: msg.role === 'assistant' ? '1px solid rgba(255,255,255,0.07)' : 'none',
                  fontSize: 13.5, color: '#E2E8F0', lineHeight: 1.65,
                  fontFamily: 'DM Sans, sans-serif',
                  boxShadow: msg.role === 'user'
                    ? '0 4px 16px rgba(139,92,246,0.25)'
                    : 'none',
                }}>
                  {renderText(msg.text)}
                </div>
              </div>
            ))}

            {loading && (
              <div className="jp-msg-bot" style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                <Avatar />
                <div style={{
                  padding: '10px 16px',
                  borderRadius: '18px 18px 18px 4px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.07)'
                }}>
                  <TypingDots />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{
            padding: '12px 14px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(255,255,255,0.02)',
            display: 'flex', gap: 8, alignItems: 'flex-end'
          }}>
            <textarea
              ref={inputRef}
              className="jp-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask Paul anything... (English or Bisaya)"
              rows={1}
              style={{
                flex: 1, background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 12, padding: '10px 13px',
                color: '#F0F4FF', fontSize: 13,
                outline: 'none', resize: 'none',
                fontFamily: 'DM Sans, sans-serif',
                lineHeight: 1.5, maxHeight: 100,
                overflowY: 'auto',
                transition: 'border-color 0.2s'
              }}
            />
            <button
              className="jp-send-btn"
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              style={{
                width: 40, height: 40, borderRadius: 12, border: 'none',
                background: input.trim() && !loading
                  ? 'linear-gradient(135deg, #3B82F6, #8B5CF6)'
                  : 'rgba(255,255,255,0.07)',
                cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, transition: 'all 0.15s',
                boxShadow: input.trim() && !loading ? '0 4px 12px rgba(139,92,246,0.3)' : 'none'
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M22 2L11 13" stroke={input.trim() && !loading ? '#fff' : '#4B5580'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke={input.trim() && !loading ? '#fff' : '#4B5580'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>

          {/* Footer */}
          <div style={{
            padding: '6px 14px 10px',
            textAlign: 'center', fontSize: 10,
            color: '#64748B', letterSpacing: '0.04em'
          }}>
            Paul · Powered by LacaroNexus — Where Infrastructure Meets Intelligence.
          </div>
        </div>
      )}
    </>
  )
}
