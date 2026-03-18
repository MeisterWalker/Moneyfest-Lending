export default function InstallmentProgressBar({ paid, total = 4, remainingBalance, nextDueDate }) {
  const pct = Math.round((paid / total) * 100)

  // Color ramps through purple → teal → green as progress increases
  const getDotColor = (i, t) => {
    const third = Math.ceil(t / 3)
    if (i <= third) return 'var(--purple)'
    if (i <= third * 2) return 'var(--teal)'
    return 'var(--green)'
  }

  const barColor = paid === 0 ? '#374151'
    : paid < Math.ceil(total / 3) ? 'var(--purple)'
    : paid < Math.ceil(total * 2 / 3) ? 'var(--teal)'
    : 'var(--green)'

  const label = paid === 0 ? 'Not started'
    : paid === total ? 'Fully paid'
    : `${paid} of ${total} installments paid — ${pct}%`

  return (
    <div style={{ marginTop: 12 }}>
      {/* Bar track */}
      <div style={{ height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: paid === total
            ? 'linear-gradient(90deg, var(--teal), var(--green))'
            : paid >= Math.ceil(total * 2 / 3)
            ? 'linear-gradient(90deg, var(--purple), var(--teal))'
            : barColor,
          borderRadius: 4,
          transition: 'width 0.5s ease',
          boxShadow: paid > 0 ? `0 0 8px ${barColor}60` : 'none'
        }} />
      </div>

      {/* Segment dots — dynamic count */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        {Array.from({ length: total }, (_, idx) => idx + 1).map(i => (
          <div key={i} style={{
            width: 20, height: 20, borderRadius: '50%',
            background: i <= paid ? getDotColor(i, total) : 'rgba(255,255,255,0.06)',
            border: `2px solid ${i <= paid ? getDotColor(i, total) : 'rgba(255,255,255,0.1)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 700,
            color: i <= paid ? '#fff' : 'var(--text-muted)',
            transition: 'all 0.3s ease'
          }}>
            {i <= paid ? '✓' : i}
          </div>
        ))}
      </div>

      {/* Labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: paid === total ? 'var(--green)' : 'var(--text-label)' }}>
          {label}
        </span>
        {paid < total && remainingBalance > 0 && (
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Balance: ₱{remainingBalance?.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
          </span>
        )}
      </div>

      {nextDueDate && paid < total && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
          Next due: {new Date(nextDueDate).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
        </div>
      )}
    </div>
  )
}
