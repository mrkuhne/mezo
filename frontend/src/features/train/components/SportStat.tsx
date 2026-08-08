// ============================================================
// Mezo · SportStat — one stat cell in the SportPage hero card.
// DS-migrated (mezo-setx.6.5) onto the shared StatStrip CELL vocabulary
// (`.statstrip-c/-v/-l` + the optional `.statstrip-s` sub-caption), the same
// move GymStat made in mezo-setx.6.4 — so every glance strip in Train measures
// alike. It stays a feature component because the domain-free <StatStrip>
// models neither the rose `highlight` accent nor a sub line.
// The accent stays: a stat VALUE is data-viz, which is where the domain
// colours are still legal (ADR 0018 D5) — unlike buttons, which this bead
// moves off rose.
// ============================================================
interface SportStatProps {
  label: string
  val: string | number
  sub?: string
  highlight?: boolean
}

export function SportStat({ label, val, sub, highlight = false }: SportStatProps) {
  return (
    <div className="statstrip-c">
      <div
        className="statstrip-v"
        style={highlight ? { color: 'var(--tag-sport)' } : undefined}
      >
        {val}
      </div>
      <div className="statstrip-l">{label}</div>
      {sub && <div className="statstrip-s">{sub}</div>}
    </div>
  )
}
