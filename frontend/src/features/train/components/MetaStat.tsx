// ============================================================
// Mezo · MetaStat — one cell in the ActiveMesoCard meta row:
// tiny mono label / Antonio (display-font) value / optional mono sub.
// Ported from prototype mesocycles.jsx MetaStat.
// ============================================================
interface MetaStatProps {
  label: string
  val: string
  sub?: string
}

export function MetaStat({ label, val, sub }: MetaStatProps) {
  return (
    <div className="col flex-1">
      <span className="label-mono" style={{ fontSize: 8 }}>
        {label}
      </span>
      <span
        style={{
          fontFamily: 'var(--ff-display)',
          fontSize: 14,
          color: 'var(--text-primary)',
          marginTop: 4,
          whiteSpace: 'nowrap',
        }}
      >
        {val}
      </span>
      {sub ? (
        <span className="text-tertiary" style={{ fontSize: 10, marginTop: 2, fontFamily: 'var(--ff-mono)' }}>
          {sub}
        </span>
      ) : null}
    </div>
  )
}
