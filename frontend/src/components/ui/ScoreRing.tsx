export function ScoreRing({ pct, size = 56, stroke = 4, color = 'var(--brand-glow)', label, labelColor = 'var(--text-primary)', sublabel }:
  { pct: number; size?: number; stroke?: number; color?: string; label?: string; labelColor?: string; sublabel?: string }) {
  const r = size / 2 - stroke
  const c = 2 * Math.PI * r
  const offset = c - Math.max(0, Math.min(1, pct)) * c
  const hasCustomLabelColor = labelColor !== 'var(--text-primary)'
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.6s ease', filter: `drop-shadow(0 0 4px ${color})` }} />
      </svg>
      {label != null && (
        <span style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--ff-display)',
          fontSize: size * 0.28, color: labelColor,
          textShadow: hasCustomLabelColor ? `0 0 14px color-mix(in srgb, ${labelColor} 40%, transparent)` : undefined }}>
          {label}
          {sublabel != null && (
            <span style={{ fontFamily: 'var(--ff-mono)', fontSize: size * 0.13,
              color: 'var(--text-tertiary)', textShadow: 'none' }}>{sublabel}</span>
          )}
        </span>
      )}
    </div>
  )
}
