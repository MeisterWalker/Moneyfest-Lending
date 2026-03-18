import { TrendingUp, Calendar } from 'lucide-react'

function ComingSoon({ icon: Icon, title, description, phase }) {
  return (
    <div style={{ padding: '32px 28px', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div style={{ textAlign: 'center', maxWidth: 400 }}>
        <div style={{
          width: 72, height: 72, borderRadius: 20,
          background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px'
        }}>
          <Icon size={32} color="var(--blue)" />
        </div>
        <h2 style={{ fontFamily: 'Syne', fontSize: 22, fontWeight: 700, marginBottom: 10 }}>{title}</h2>
        <p style={{ color: 'var(--text-label)', fontSize: 14, marginBottom: 16 }}>{description}</p>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', fontSize: 12, color: 'var(--blue)' }}>
          🔨 Coming in {phase}
        </div>
      </div>
    </div>
  )
}

export function ForecastPage() {
  return <ComingSoon icon={TrendingUp} title="Profit Forecast" description="3-month, 6-month, and 1-year projections with compound growth simulation." phase="Phase 5" />
}

export function CollectionPage() {
  return <ComingSoon icon={Calendar} title="Collection Schedule" description="Calendar view of all upcoming 5th and 20th cutoff payment dates." phase="Phase 5" />
}
