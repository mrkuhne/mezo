// ============================================================
// Mezo · GymStat — one meta cell in the GymView meso-meta card:
// tiny mono label / big Antonio (display-font) value / mono sub.
// Ported from prototype train-views.jsx GymStat.
// ============================================================
interface GymStatProps {
  label: string
  val: string | number
  sub: string
  color: string
}

export function GymStat({ label, val, sub, color }: GymStatProps) {
  return (
    <div className="col flex-1" style={{ minWidth: 0 }}>
      <span className="label-mono" style={{ fontSize: 8, color: 'var(--text-tertiary)' }}>{label}</span>
      <span
        style={{
          fontFamily: 'var(--ff-display)',
          fontSize: 18,
          fontWeight: 600,
          color,
          lineHeight: 1,
          marginTop: 4,
        }}
      >
        {val}
      </span>
      <span className="text-tertiary" style={{ fontSize: 9, fontFamily: 'var(--ff-mono)', marginTop: 2 }}>{sub}</span>
    </div>
  )
}
