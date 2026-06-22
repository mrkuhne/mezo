export function TrendCell({
  label,
  rate,
  avg,
}: {
  label: string
  rate: number
  // The EWMA trend weight — only the 7-day cell has a real value; omitted for 4w.
  avg?: number
}) {
  return (
    <div className="flex-1 card notch-4" style={{ padding: 12 }}>
      <span className="label-mono" style={{ fontSize: 9 }}>{label}</span>
      <div
        style={{
          fontFamily: 'var(--ff-display)',
          fontSize: 22,
          fontWeight: 600,
          color: 'var(--text-primary)',
          marginTop: 4,
          lineHeight: 1,
        }}
      >
        {rate > 0 ? '+' : ''}{rate.toFixed(2)}
        <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 10, color: 'var(--text-tertiary)', marginLeft: 3 }}>kg/hét</span>
      </div>
      {avg !== undefined && (
        <div className="row mt-sm" style={{ justifyContent: 'space-between' }}>
          <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 10, color: 'var(--text-tertiary)' }}>trend</span>
          <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 10, color: 'var(--text-tertiary)' }}>{avg.toFixed(1)} kg</span>
        </div>
      )}
    </div>
  )
}
