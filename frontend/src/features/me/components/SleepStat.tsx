export function SleepStat({
  label,
  val,
  unit,
  highlight = false,
}: {
  label: string
  val: string | number
  unit?: string
  highlight?: boolean
}) {
  return (
    <div className="col flex-1">
      <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--faint)' }}>{label}</span>
      <span
        style={{
          fontFamily: 'var(--ff-display)',
          fontSize: 18,
          fontWeight: 600,
          lineHeight: 1,
          marginTop: 4,
          color: highlight ? 'var(--sage-deep)' : 'var(--text-primary)',
          whiteSpace: 'nowrap',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {val}
        {unit && (
          <span style={{ fontSize: 9, color: 'var(--text-tertiary)', marginLeft: 3 }}>
            {unit}
          </span>
        )}
      </span>
    </div>
  )
}
