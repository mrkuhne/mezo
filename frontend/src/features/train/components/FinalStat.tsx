// ============================================================
// Mezo · FinalStat — one resolved MEV/MAV/MRV cell in the VolumeBar
// `03 · Eredő · most` stage: tiny mono label + signed delta vs. baseline
// and the big Antonio (display-font) value. Highlighted variant tints the
// MRV cell with the brand border + glow value.
// Ported from prototype mesocycles.jsx FinalStat.
// ============================================================
interface FinalStatProps {
  label: string
  val: number
  delta: number
  highlight?: boolean
}

export function FinalStat({ label, val, delta, highlight = false }: FinalStatProps) {
  return (
    <div
      className="col flex-1"
      style={{
        padding: '8px 10px',
        background: 'var(--surface-1)',
        border: `1px solid ${highlight ? 'var(--border-brand)' : 'var(--border-subtle)'}`,
      }}
    >
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span className="label-mono" style={{ fontSize: 8, color: 'var(--text-tertiary)' }}>
          {label}
        </span>
        {delta !== 0 && (
          <span
            className="label-mono"
            style={{ fontSize: 8, color: delta > 0 ? 'var(--brand-glow)' : 'var(--warning)' }}
          >
            {delta > 0 ? '+' : ''}
            {delta}
          </span>
        )}
      </div>
      <span
        style={{
          fontFamily: 'var(--ff-display)',
          fontSize: 18,
          fontWeight: 600,
          color: highlight ? 'var(--brand-glow)' : 'var(--text-primary)',
          marginTop: 2,
          lineHeight: 1,
        }}
      >
        {val}
      </span>
    </div>
  )
}
