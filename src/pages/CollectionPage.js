import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { formatCurrency, formatDate, getInstallmentDates, formatDateValue, getQuickLoanDueDates, calcQuickLoanBalance, QUICKLOAN_CONFIG } from '../lib/helpers'
import { Calendar, List, ChevronLeft, ChevronRight, CheckCircle, Clock, AlertTriangle, Mail, Send, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { sendBulkReminders } from '../lib/emailService'
import { logAutomatedPayment } from '../lib/accounting'
import { logAudit } from '../lib/helpers'
import { useToast } from '../components/Toast'

function toLocalDateKey(date) {
  return formatDateValue(date)
}

function buildSchedule(loans, borrowers, loanTypeFilter = 'all') {
  const events = []
  for (const loan of loans) {
    if (!['Pending', 'Active', 'Partially Paid', 'Overdue'].includes(loan.status)) continue
    const loanType = loan.loan_type || 'regular'
    if (loanTypeFilter !== 'all' && loanType !== loanTypeFilter) continue
    const borrower = borrowers.find(b => b.id === loan.borrower_id)

    if (loanType === 'quickloan') {
      // QuickLoan: show Day 15 and Day 30 as events
      const { day15, day30 } = getQuickLoanDueDates(loan.release_date)
      const today = new Date(); today.setHours(0, 0, 0, 0)
      if (day15) {
        const isPaid = loan.payments_made >= 1
        const isPast = false // Day 15 target is not a hard overdue deadline
        const isNext = !isPaid
        const balance = calcQuickLoanBalance(loan)
        events.push({
          date: day15, dateKey: toLocalDateKey(day15), loan, borrower,
          installmentNum: 1, isPaid, isNext, isPast,
          amount: parseFloat((loan.loan_amount + loan.loan_amount * QUICKLOAN_CONFIG.DAILY_RATE * 15).toFixed(2)),
          isQuickLoan: true, label: 'Day 15 Target', balance
        })
      }
      if (day30) {
        const isPaid = loan.payments_made >= 1
        const isPast = day30 < today && !isPaid
        const isNext = !isPaid && loan.extension_fee_charged
        events.push({
          date: day30, dateKey: toLocalDateKey(day30), loan, borrower,
          installmentNum: 1, isPaid, isNext, isPast,
          amount: parseFloat((loan.loan_amount + loan.loan_amount * QUICKLOAN_CONFIG.DAILY_RATE * 30 + (loan.extension_fee_charged ? QUICKLOAN_CONFIG.EXTENSION_FEE : 0)).toFixed(2)),
          isQuickLoan: true, label: 'Day 30 Deadline', isDeadline: true
        })
      }
    } else {
      const dates = getInstallmentDates(loan.release_date, loan.num_installments || 4)
      dates.forEach((date, i) => {
        const installmentNum = i + 1
        const isPaid = installmentNum <= loan.payments_made
        const isNext = installmentNum === loan.payments_made + 1
        const today = new Date(); today.setHours(0, 0, 0, 0)
        const isPast = date < today && !isPaid
        events.push({ date, dateKey: toLocalDateKey(date), loan, borrower, installmentNum, isPaid, isNext, isPast, amount: loan.installment_amount, isQuickLoan: false })
      })
    }
  }
  return events.sort((a, b) => a.date - b.date)
}

function EventDot({ isPaid, isPast, isNext }) {
  const color = isPaid ? 'var(--green)' : isPast ? 'var(--red)' : isNext ? 'var(--blue)' : 'var(--text-muted)'
  return <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
}

function EmailReminderModal({ events, onClose, onLog }) {
  const [daysAhead, setDaysAhead] = useState(2)
  const [sending, setSending] = useState(false)
  const [results, setResults] = useState(null)
  const today = new Date(); today.setHours(0, 0, 0, 0)

  const eligible = events.filter(ev => {
    if (ev.isPaid) return false
    if (!ev.borrower?.email) return false
    const daysUntil = Math.ceil((ev.date - today) / (1000 * 60 * 60 * 24))
    return daysUntil >= 0 && daysUntil <= daysAhead
  })

  const noEmail = events.filter(ev => !ev.isPaid && !ev.isPast && !ev.borrower?.email)
    .reduce((acc, ev) => {
      if (!acc.find(b => b?.id === ev.borrower?.id)) acc.push(ev.borrower)
      return acc
    }, [])

  const handleSend = async () => {
    setSending(true)
    const res = await sendBulkReminders({ events, daysAhead })
    setResults(res)
    setSending(false)
    const sent = res.filter(r => r.success)
    if (sent.length > 0 && onLog) {
      await onLog(`Email reminders sent to ${sent.length} borrower(s): ${sent.map(r => r.borrower).join(', ')}`)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#141B2D', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Mail size={20} color="var(--blue)" />
            <div>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 16 }}>Send Email Reminders</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Notify borrowers of upcoming installments</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '20px 24px' }}>
          {!results ? (
            <>
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>
                  Send reminders for installments due within:
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[1, 2, 3, 5].map(d => (
                    <button key={d} onClick={() => setDaysAhead(d)} style={{
                      padding: '8px 16px', borderRadius: 8, border: `1px solid ${daysAhead === d ? 'var(--blue)' : 'var(--card-border)'}`,
                      background: daysAhead === d ? 'rgba(59,130,246,0.15)' : 'transparent',
                      color: daysAhead === d ? 'var(--blue)' : 'var(--text-muted)',
                      cursor: 'pointer', fontSize: 13, fontWeight: 600
                    }}>
                      {d} {d === 1 ? 'day' : 'days'}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10 }}>
                  Will receive emails ({eligible.length}):
                </div>
                {eligible.length === 0 ? (
                  <div style={{ padding: 14, background: 'rgba(255,255,255,0.03)', borderRadius: 8, fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
                    No borrowers have installments due within {daysAhead} day{daysAhead > 1 ? 's' : ''}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {eligible.map((ev, i) => {
                      const daysUntil = Math.ceil((ev.date - today) / (1000 * 60 * 60 * 24))
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 8, fontSize: 13 }}>
                          <div>
                            <div style={{ fontWeight: 600 }}>{ev.borrower?.full_name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{ev.borrower?.email} · Installment {ev.installmentNum}/4</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 700 }}>{formatCurrency(ev.amount)}</div>
                            <div style={{ fontSize: 11, color: daysUntil === 0 ? 'var(--red)' : daysUntil === 1 ? 'var(--gold)' : 'var(--blue)' }}>
                              {daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `In ${daysUntil} days`}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {noEmail.length > 0 && (
                <div style={{ padding: '12px 14px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, fontSize: 12, color: 'var(--gold)', marginBottom: 20 }}>
                  <img src="/warning.png" alt="warning" style={{ width: 14, height: 14, objectFit: 'contain', verticalAlign: 'middle', marginRight: 4 }} />{noEmail.length} borrower{noEmail.length > 1 ? 's have' : ' has'} no email: {noEmail.map(b => b?.full_name).join(', ')}. Update their profile to include them.
                </div>
              )}

              <button onClick={handleSend} disabled={sending || eligible.length === 0}
                style={{
                  width: '100%', padding: 12, borderRadius: 10, border: 'none',
                  background: eligible.length === 0 ? 'rgba(255,255,255,0.05)' : 'var(--blue)',
                  color: eligible.length === 0 ? 'var(--text-muted)' : '#fff',
                  fontSize: 14, fontWeight: 700, cursor: eligible.length === 0 ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                }}>
                {sending
                  ? <><div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> Sending...</>
                  : <><Send size={15} /> Send {eligible.length} Reminder{eligible.length !== 1 ? 's' : ''}</>
                }
              </button>
            </>
          ) : (
            <div>
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>{results.filter(r => r.success).length === results.length ? "🎉" : "⚠️"}</div>
                <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 18, marginBottom: 4 }}>
                  {results.filter(r => r.success).length} of {results.length} sent successfully
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Reminders delivered to borrowers' inboxes</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
                {results.map((r, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: r.success ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)', border: `1px solid ${r.success ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`, borderRadius: 8, fontSize: 13 }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{r.borrower}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.email}</div>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: r.success ? 'var(--green)' : 'var(--red)' }}>
                      {r.success ? "✓ Sent" : `✗ ${r.error}`}
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={onClose} style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', background: 'var(--blue)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function CalendarView({ events, currentMonth, setCurrentMonth }) {
  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const [selected, setSelected] = useState(null)
  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  const getEventsForDay = (day) => {
    if (!day) return []
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return events.filter(e => e.dateKey === key)
  }
  const selectedEvents = selected ? getEventsForDay(selected) : []
  const isCutoff = (day) => day === 5 || day === 20
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <button onClick={() => setCurrentMonth(new Date(year, month - 1, 1))} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--card-border)', borderRadius: 8, width: 34, height: 34, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)' }}><ChevronLeft size={16} /></button>
        <span style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 18 }}>{currentMonth.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })}</span>
        <button onClick={() => setCurrentMonth(new Date(year, month + 1, 1))} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--card-border)', borderRadius: 8, width: 34, height: 34, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)' }}><ChevronRight size={16} /></button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => <div key={d} style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', padding: '6px 0' }}>{d}</div>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
        {cells.map((day, i) => {
          if (!day) return <div key={`e-${i}`} />
          const dayDate = new Date(year, month, day); dayDate.setHours(0,0,0,0)
          const isToday = dayDate.getTime() === today.getTime()
          const dayEvents = getEventsForDay(day)
          const isSelected = selected === day
          const cutoff = isCutoff(day)
          return (
            <div key={day} onClick={() => setSelected(isSelected ? null : day)} style={{ minHeight: 64, borderRadius: 8, padding: '6px 8px', cursor: dayEvents.length > 0 || cutoff ? 'pointer' : 'default', background: isSelected ? 'rgba(59,130,246,0.15)' : cutoff ? 'rgba(59,130,246,0.05)' : 'rgba(255,255,255,0.02)', border: `1px solid ${isSelected ? 'rgba(59,130,246,0.4)' : cutoff ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.04)'}`, transition: 'all 0.1s ease' }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isToday ? 'var(--blue)' : 'transparent', fontSize: 13, fontWeight: isToday ? 700 : 400, color: isToday ? '#fff' : cutoff ? 'var(--blue)' : 'var(--text-primary)', marginBottom: 4 }}>{day}</div>
              {cutoff && dayEvents.length === 0 && <div style={{ fontSize: 9, color: 'rgba(59,130,246,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cutoff</div>}
              {dayEvents.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>{dayEvents.slice(0,4).map((ev,i) => <EventDot key={i} isPaid={ev.isPaid} isPast={ev.isPast} isNext={ev.isNext} />)}{dayEvents.length > 4 && <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>+{dayEvents.length-4}</div>}</div>}
            </div>
          )
        })}
      </div>
      {selected && (
        <div style={{ marginTop: 16, padding: '16px 18px', background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 10 }}>
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 14, marginBottom: 12 }}>{new Date(year, month, selected).toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
          {selectedEvents.length === 0 ? <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{isCutoff(selected) ? "Cutoff day — no installments scheduled" : 'No installments this day'}</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {selectedEvents.map((ev, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><EventDot isPaid={ev.isPaid} isPast={ev.isPast} isNext={ev.isNext} /><span style={{ fontWeight: 500 }}>{ev.borrower?.full_name}</span><span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Installment {ev.installmentNum}/4</span></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontWeight: 700, color: ev.isPaid ? 'var(--green)' : ev.isPast ? 'var(--red)' : 'var(--text-primary)' }}>{formatCurrency(ev.amount)}</span>{ev.isPaid && <span style={{ fontSize: 11, color: 'var(--green)" }}>✓ Paid</span>}{ev.isPast && <span style={{ fontSize: 11, color: "var(--red)' }}>⚠ Overdue</span>}</div>
                </div>
              ))}
              <div style={{ borderTop: '1px solid rgba(59,130,246,0.15)', paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--text-muted)' }}>Total due</span>
                <span style={{ fontWeight: 700, color: 'var(--blue)' }}>{formatCurrency(selectedEvents.filter(e => !e.isPaid).reduce((s,e) => s+e.amount, 0))}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function AgendaView({ events, bulkMode, bulkSelected, onToggleSelection }) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const upcoming = events.filter(e => !e.isPaid && !e.isPast)
  const overdue = events.filter(e => e.isPast)
  const grouped = {}
  upcoming.forEach(e => { if (!grouped[e.dateKey]) grouped[e.dateKey] = []; grouped[e.dateKey].push(e) })
  return (
    <div>
      {overdue.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}><AlertTriangle size={15} color="var(--red)" /><span style={{ fontSize: 13, fontWeight: 700, color: 'var(--red)' }}>Overdue ({overdue.length})</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {overdue.map((ev, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8 }}>
                <div>
                  <span style={{ fontWeight: 500, fontSize: 13 }}>{ev.borrower?.full_name}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>
                    {ev.isQuickLoan 
                      ? `⚡ QuickLoan (${ev.label})` 
                      : `Installment ${ev.installmentNum}/${ev.loan?.num_installments || 4}`
                    } · {formatDate(ev.dateKey)}
                  </span>
                </div>
                <span style={{ fontWeight: 700, color: 'var(--red)' }}>{formatCurrency(ev.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {Object.keys(grouped).length === 0 ? (
        <div className="empty-state"><CheckCircle size={40} /><h3>All caught up!</h3><p>No upcoming installments scheduled</p></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {Object.entries(grouped).map(([dateKey, dayEvents]) => {
            const [yr, mo, dy] = dateKey.split('-').map(Number)
            const date = new Date(yr, mo - 1, dy)
            const daysLeft = Math.ceil((date - today) / (1000 * 60 * 60 * 24))
            const isToday = daysLeft === 0
            const total = dayEvents.reduce((s, e) => s + e.amount, 0)
            return (
              <div key={dateKey}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Calendar size={14} color={isToday ? 'var(--blue)' : 'var(--text-muted)'} />
                    <span style={{ fontWeight: 700, fontSize: 14, color: isToday ? 'var(--blue)' : 'var(--text-primary)' }}>
                      {date.toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                  <span style={{ fontSize: 11, color: isToday ? 'var(--blue)' : daysLeft < 0 ? 'var(--gold)' : 'var(--text-muted)', background: isToday ? 'rgba(59,130,246,0.1)' : daysLeft < 0 ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.04)', padding: '2px 8px', borderRadius: 10 }}>
                    {isToday ? "📅 Today" : daysLeft === 1 ? 'Tomorrow' : daysLeft < 0 ? '⏳ Extension Period' : `In ${daysLeft} days`}
                  </span>
                  <span style={{ marginLeft: 'auto', fontWeight: 700, color: 'var(--green)', fontSize: 14 }}>{formatCurrency(total)}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {dayEvents.map((ev, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: ev.isQuickLoan ? 'rgba(245,158,11,0.04)' : 'rgba(255,255,255,0.02)', border: `1px solid ${ev.isDeadline ? 'rgba(239,68,68,0.25)' : ev.isQuickLoan ? 'rgba(245,158,11,0.2)' : 'var(--card-border)'}`, borderRadius: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {bulkMode && !ev.isPaid && !ev.isQuickLoan && (
                          <input 
                            type="checkbox" 
                            checked={bulkSelected.has(`${ev.loan.id}-${ev.installmentNum}`)}
                            onChange={() => onToggleSelection(`${ev.loan.id}-${ev.installmentNum}`)}
                            style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--blue)' }}
                          />
                        )}
                        <Clock size={13} color="var(--text-muted)" />
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 500 }}>
                            {ev.borrower?.full_name}
                            {ev.isQuickLoan && <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: ev.isDeadline ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)', color: ev.isDeadline ? 'var(--red)' : '#F59E0B', border: `1px solid ${ev.isDeadline ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}` }}>⚡ {ev.label}</span>}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {ev.isQuickLoan
                              ? `${ev.borrower?.department} · QuickLoan · ${ev.isDeadline ? 'Hard deadline' : 'Target due date'}`
                              : `${ev.borrower?.department} · Installment ${ev.installmentNum} of ${ev.loan?.num_installments || 4}`
                            }
                          </div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 700, color: ev.isDeadline ? 'var(--red)' : ev.isQuickLoan ? '#F59E0B' : 'var(--text-primary)' }}>{formatCurrency(ev.amount)}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Principal: {formatCurrency(ev.loan.loan_amount)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function CollectionPage() {
  const [loans, setLoans] = useState([])
  const [borrowers, setBorrowers] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('agenda')
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [loanTypeFilter, setLoanTypeFilter] = useState('all')
  const [bulkMode, setBulkMode] = useState(false)
  const [bulkSelected, setBulkSelected] = useState(new Set())
  const [bulkProcessing, setBulkProcessing] = useState(false)
  const navigate = useNavigate()
  const { toast } = useToast()

  const fetchData = useCallback(async () => {
    const [{ data: l }, { data: b }] = await Promise.all([
      supabase.from('loans').select('*'),
      supabase.from('borrowers').select('*')
    ])
    setLoans(l || [])
    setBorrowers(b || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleAuditLog = async (action) => {
    await logAudit({
      action_type: 'EMAIL_SENT',
      module: 'Collection',
      description: action,
      changed_by: 'admin'
    })
  }

  const toggleBulkSelection = (key) => {
    const next = new Set(bulkSelected)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setBulkSelected(next)
  }

  const handleBulkRecord = async () => {
    if (bulkSelected.size === 0 || bulkProcessing) return
    setBulkProcessing(true)
    
    const toProcess = Array.from(bulkSelected).map(key => {
      const [loanId, instNum] = key.split('-')
      const ev = events.find(e => e.loan.id === loanId && e.installmentNum === parseInt(instNum))
      return ev
    }).filter(Boolean)

    let successCount = 0
    
    try {
      for (const ev of toProcess) {
        const loan = ev.loan
        const newPaymentsMade = loan.payments_made + 1
        const numInstallments = loan.num_installments || 4
        const installAmt = Math.ceil(loan.installment_amount)
        const newBalance = loan.remaining_balance - installAmt
        const newStatus = newPaymentsMade >= numInstallments ? 'Paid' : 'Partially Paid'

        const { error } = await supabase.from('loans').update({
          payments_made: newPaymentsMade,
          remaining_balance: Math.max(0, newBalance),
          status: newStatus,
          updated_at: new Date().toISOString()
        }).eq('id', loan.id)

        if (error) {
          console.error(`Bulk pay failed for loan ${loan.id}:`, error)
          continue
        }

        await logAutomatedPayment(loan, installAmt, 'hand')
        await logAudit({
          action_type: 'INSTALLMENT_PAID',
          module: 'Collection (Bulk)',
          description: `Bulk payment recorded for ${ev.borrower?.full_name} — Installment ${newPaymentsMade} of ${numInstallments} (₱${installAmt.toLocaleString()})`,
          changed_by: 'admin'
        })
        successCount++
      }
      
      toast(`✅ Successfully recorded ${successCount} payments`, 'success')
      setBulkSelected(new Set())
      setBulkMode(false)
      await fetchData() // fetchData resolves at the end
    } catch (err) {
      console.error('Bulk processing error:', err)
      toast('An error occurred during bulk processing', 'error')
    } finally {
      setBulkProcessing(false)
    }
  }

  const events = buildSchedule(loans, borrowers, loanTypeFilter)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const upcomingCount = events.filter(e => !e.isPaid && e.date >= today).length
  const overdueCount = events.filter(e => e.isPast).length
  const thisMonthTotal = events
    .filter(e => !e.isPaid && e.date.getMonth() === today.getMonth() && e.date.getFullYear() === today.getFullYear())
    .reduce((s, e) => s + e.amount, 0)
  const emailableCount = [...new Set(events.filter(e => !e.isPaid && !e.isPast && e.borrower?.email).map(e => e.borrower?.id))].length

  if (loading) return <div style={{ padding: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}><div style={{ color: 'var(--text-muted)' }}>Loading schedule...</div></div>

  return (
    <div style={{ padding: '32px 28px', maxWidth: 900, margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Collection Schedule</h1>
          <p className="page-subtitle">All upcoming installment due dates</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button 
            onClick={() => { setBulkMode(!bulkMode); setBulkSelected(new Set()) }}
            style={{ 
              display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 9, 
              border: `1px solid ${bulkMode ? 'var(--blue)' : 'rgba(255,255,255,0.1)'}`, 
              background: bulkMode ? 'rgba(59,130,246,0.1)' : 'transparent', 
              color: bulkMode ? 'var(--blue)' : 'var(--text-muted)', cursor: 'pointer', fontSize: 13, fontWeight: 600 
            }}
          >
            {bulkMode ? '✕ Cancel Bulk' : '✅ Bulk Record'}
          </button>
          <button onClick={() => setShowEmailModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 9, border: '1px solid rgba(59,130,246,0.35)', background: 'rgba(59,130,246,0.1)', color: 'var(--blue)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            <Mail size={15} />
            Send Reminders
            {emailableCount > 0 && <span style={{ background: 'var(--blue)', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>{emailableCount}</span>}
          </button>
          <div style={{ display: 'flex', gap: 6, background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 4 }}>
            {[['agenda', <List size={15} />, 'Agenda'], ['calendar', <Calendar size={15} />, 'Calendar']].map(([v, icon, label]) => (
              <button key={v} onClick={() => setView(v)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, background: view === v ? 'var(--blue)' : 'transparent', color: view === v ? '#fff' : 'var(--text-muted)', transition: 'all 0.15s ease' }}>
                {icon} {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Loan type filter */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 4, width: 'fit-content' }}>
        {[
          { key: 'all', label: 'All' },
          { key: 'regular', label: 'Regular' },
          { key: 'quickloan', label: '⚡ QuickLoan' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setLoanTypeFilter(tab.key)}
            style={{
              padding: '7px 16px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: loanTypeFilter === tab.key
                ? tab.key === 'quickloan' ? 'rgba(245,158,11,0.15)' : 'rgba(59,130,246,0.15)'
                : 'transparent',
              color: loanTypeFilter === tab.key
                ? tab.key === 'quickloan' ? '#F59E0B' : 'var(--blue)'
                : 'var(--text-muted)',
              transition: 'all 0.15s ease'
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Upcoming', value: upcomingCount, color: 'var(--blue)' },
          { label: 'Overdue', value: overdueCount, color: overdueCount > 0 ? 'var(--red)' : 'var(--text-muted)' },
          { label: 'This Month', value: formatCurrency(thisMonthTotal), color: 'var(--green)' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '14px 18px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 20, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        {[{ color: 'var(--blue)', label: 'Next due' }, { color: 'var(--green)', label: 'Paid' }, { color: 'var(--red)', label: 'Overdue' }, { color: 'var(--text-muted)', label: 'Scheduled' }].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: l.color }} />{l.label}
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: '22px 24px' }}>
        {view === 'calendar'
          ? <CalendarView events={events} currentMonth={currentMonth} setCurrentMonth={setCurrentMonth} />
          : <AgendaView events={events} bulkMode={bulkMode} bulkSelected={bulkSelected} onToggleSelection={toggleBulkSelection} />
        }
      </div>

      {/* Sticky Bulk Action Bar */}
      {bulkMode && bulkSelected.size > 0 && (
        <div style={{ position: 'fixed', bottom: 30, left: '50%', transform: 'translateX(-50%)', zIndex: 100, width: '100%', maxWidth: 500, padding: '0 20px', animation: 'jpSlideUp 0.3s ease' }}>
          <div style={{ background: 'var(--blue)', borderRadius: 16, padding: '14px 24px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ color: '#fff' }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{bulkSelected.size} selected</div>
              <div style={{ fontSize: 11, opacity: 0.8 }}>Total: {formatCurrency(Array.from(bulkSelected).reduce((sum, key) => {
                const [lId, iN] = key.split('-')
                const ev = events.find(e => e.loan.id === lId && e.installmentNum === parseInt(iN))
                return sum + (ev?.amount || 0)
              }, 0))}</div>
            </div>
            <button 
              disabled={bulkProcessing}
              onClick={handleBulkRecord}
              style={{ background: '#fff', color: 'var(--blue)', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 800, cursor: bulkProcessing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
            >
              {bulkProcessing ? 'Processing...' : `Record ${bulkSelected.size} Payments`}
            </button>
          </div>
        </div>
      )}

      {/* Animation Styles */}
      <style>{`
        @keyframes jpSlideUp {
          from { transform: translateX(-50%) translateY(40px); opacity: 0; }
          to { transform: translateX(-50%) translateY(0); opacity: 1; }
        }
      `}</style>

      {showEmailModal && <EmailReminderModal events={events} onClose={() => setShowEmailModal(false)} onLog={handleAuditLog} />}
    </div>
  )
}
