// ============================================================
// Mezo · MetaStat — one cell in the ActiveMesoCard meta row.
// DS-migrated (mezo-setx.6.8) onto the shared StatStrip CELL vocabulary
// (`.statstrip-c/-v/-l` + the optional `.statstrip-s`), the third component to
// make that move after GymStat (.6.4) and SportStat (.6.5) — every glance strip
// in Train now measures alike.
// No `nowrap` here, unlike the ported original: these values are PHRASES
// ("Pull / Push", "RP · 6-8 rep"), and a nowrap phrase in a three-across strip
// silently overflows the card at phone widths (the `.loadrow` lesson, .6.3).
// ============================================================
interface MetaStatProps {
  label: string
  val: string
  sub?: string
}

export function MetaStat({ label, val, sub }: MetaStatProps) {
  return (
    <div className="statstrip-c">
      {/* Caption size, not the strip's 20px numeral size: these values are PHRASES
          ("Pull / Push / Legs"), and at 20 the split cell broke over three lines.
          Same call the `.loadtile` values make (.6.3). */}
      <div className="statstrip-v" style={{ fontSize: 14 }}>{val}</div>
      <div className="statstrip-l">{label}</div>
      {sub ? <div className="statstrip-s">{sub}</div> : null}
    </div>
  )
}
