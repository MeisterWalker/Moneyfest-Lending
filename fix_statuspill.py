import re

with open('src/pages/DashboardPage.js', 'r', encoding='utf-8') as f:
    code = f.read()

status_pill_code = """
// ─── Status Pill ──────────────────────────────────────────────
function StatusPill({ status }) {
  let bg = 'rgba(255,255,255,0.05)'
  let color = 'var(--text-muted)'
  let label = status

  switch (status) {
    case 'Active':
      bg = 'rgba(34,197,94,0.15)'
      color = 'var(--green)'
      break
    case 'Partially Paid':
      bg = 'rgba(59,130,246,0.15)'
      color = 'var(--blue)'
      break
    case 'Overdue':
      bg = 'rgba(239,68,68,0.15)'
      color = 'var(--red)'
      break
    case 'Extended':
      bg = 'rgba(245,158,11,0.15)'
      color = 'var(--gold)'
      break
    case 'Paid':
    case 'Paid Off':
      bg = 'rgba(16,185,129,0.1)'
      color = '#10B981'
      label = 'Paid'
      break
  }

  return (
    <span style={{
      display: 'inline-block',
      padding: '4px 8px',
      borderRadius: '6px',
      fontSize: '11px',
      fontWeight: '700',
      background: bg,
      color: color,
      textTransform: 'uppercase',
      letterSpacing: '0.05em'
    }}>
      {label}
    </span>
  )
}
"""

if "function StatusPill" not in code:
    insert_pos = code.find("// ─── Stat Card ────────────────────────────────────────────────")
    code = code[:insert_pos] + status_pill_code + "\n" + code[insert_pos:]
    with open('src/pages/DashboardPage.js', 'w', encoding='utf-8') as f:
        f.write(code)
    print("StatusPill inserted")
else:
    print("StatusPill already exists")
