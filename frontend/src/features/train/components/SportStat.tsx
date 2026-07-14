// ============================================================
// Mezo · SportStat — one stat cell in the SportPage hero card:
// tiny mono label / big Antonio value / mono sub. The highlighted
// variant glows in the Napiv --tag-sport (volleyball) accent.
// Ported from prototype sport.jsx SportStat.
// ============================================================
interface SportStatProps {
  label: string
  val: string | number
  sub?: string
  highlight?: boolean
}

export function SportStat({ label, val, sub, highlight = false }: SportStatProps) {
  return (
    <div className="col flex-1">
      <span className="label-mono" style={{ fontSize: 8 }}>
        {label}
      </span>
      <div
        style={{
          fontFamily: 'var(--ff-display)',
          fontSize: 22,
          fontWeight: 600,
          marginTop: 2,
          lineHeight: 1,
          color: highlight ? 'var(--tag-sport)' : 'var(--text-primary)',
          textShadow: highlight ? '0 0 12px color-mix(in srgb, var(--tag-sport) 40%, transparent)' : 'none',
        }}
      >
        {val}
      </div>
      {sub && (
        <span className="text-tertiary" style={{ fontSize: 9, fontFamily: 'var(--ff-mono)', marginTop: 2 }}>
          {sub}
        </span>
      )}
    </div>
  )
}
