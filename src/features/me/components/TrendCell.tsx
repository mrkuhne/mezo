export function TrendCell({
  label,
  avg,
  delta,
  rate,
  onTrack,
}: {
  label: string
  avg: number
  delta: number
  rate: number
  onTrack: boolean
}) {
  return (
    <div className="flex-1 card notch-4" style={{ padding: 12 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span className="label-mono" style={{ fontSize: 9 }}>{label}</span>
        <span className="label-mono" style={{ fontSize: 8, color: onTrack ? 'var(--success)' : 'var(--warning)' }}>
          {onTrack ? 'ON TRACK' : 'OFF'}
        </span>
      </div>
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
        {avg.toFixed(1)}
        <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 10, color: 'var(--text-tertiary)', marginLeft: 3 }}>kg</span>
      </div>
      <div className="row mt-sm" style={{ justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 10, color: delta < 0 ? 'var(--brand-glow)' : 'var(--warning)' }}>
          {delta > 0 ? '+' : ''}{delta.toFixed(1)} kg
        </span>
        <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 10, color: 'var(--text-tertiary)' }}>
          {rate.toFixed(2)}/hét
        </span>
      </div>
    </div>
  )
}
