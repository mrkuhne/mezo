export function ConcentricAvatar({ size = 72 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="11" stroke="var(--border-brand)" strokeWidth="0.6" />
      <circle cx="12" cy="12" r="7" stroke="var(--brand-primary)" strokeWidth="0.8" />
      <circle cx="12" cy="12" r="3.5" stroke="var(--brand-glow)" strokeWidth="1" />
      <circle cx="12" cy="12" r="1.5" fill="var(--brand-glow)" />
    </svg>
  )
}
