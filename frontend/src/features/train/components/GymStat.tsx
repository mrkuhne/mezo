// ============================================================
// Mezo · GymStat — one meta cell in the GymPage meso-meta card.
// DS-migrated (mezo-setx.6.4): it renders the shared StatStrip CELL vocabulary
// (`.statstrip-c/-v/-l`, 20/700 value over a 9/700/0.18em label) so the meta
// card measures the same as every other DS glance strip. It stays a feature
// component rather than becoming `<StatStrip>` because it carries two things
// the domain-free primitive deliberately does not model: a per-cell accent
// COLOR and a `sub` caption line (`.statstrip-s`).
// ============================================================
interface GymStatProps {
  label: string
  val: string | number
  sub: string
  color: string
}

export function GymStat({ label, val, sub, color }: GymStatProps) {
  return (
    <div className="statstrip-c">
      <div className="statstrip-v" style={{ color }}>{val}</div>
      <div className="statstrip-l">{label}</div>
      <div className="statstrip-s">{sub}</div>
    </div>
  )
}
