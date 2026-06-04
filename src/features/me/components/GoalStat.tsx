export function GoalStat({
  label,
  val,
  unit,
  sub,
  highlight = false,
}: {
  label: string
  val: string
  unit?: string
  sub?: string
  highlight?: boolean
}) {
  return (
    <div className="col flex-1">
      <span className="label-mono" style={{ fontSize: 8 }}>{label}</span>
      <span
        style={{
          fontFamily: 'var(--ff-display)',
          fontSize: 16,
          fontWeight: 600,
          lineHeight: 1,
          marginTop: 4,
          color: highlight ? 'var(--brand-glow)' : 'var(--text-primary)',
          whiteSpace: 'nowrap',
        }}
      >
        {val}
        {unit && (
          <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 9, color: 'var(--text-tertiary)', marginLeft: 2 }}>
            {unit}
          </span>
        )}
      </span>
      {sub && (
        <span className="text-tertiary" style={{ fontSize: 9, fontFamily: 'var(--ff-mono)', marginTop: 2 }}>
          {sub}
        </span>
      )}
    </div>
  )
}
