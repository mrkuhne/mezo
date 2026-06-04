export function ScoreRing({ pct, size = 56, stroke = 4, color = 'var(--brand-glow)', label }:
  { pct: number; size?: number; stroke?: number; color?: string; label?: string }) {
  const r = size / 2 - stroke
  const c = 2 * Math.PI * r
  const offset = c - Math.max(0, Math.min(1, pct)) * c
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.6s ease', filter: `drop-shadow(0 0 4px ${color})` }} />
      </svg>
      {label != null && (
        <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontFamily: 'var(--ff-display)', fontSize: size * 0.28,
          color: 'var(--text-primary)' }}>{label}</span>
      )}
    </div>
  )
}
