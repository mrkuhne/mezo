export function Wave({ color = 'var(--liq1)', opacity = 1, className }: { color?: string; opacity?: number; className?: string }) {
  return (
    <svg className={className ? `fo-wave ${className}` : 'fo-wave'} viewBox="0 0 400 20" preserveAspectRatio="none" aria-hidden="true">
      <path style={{ fill: color }} opacity={opacity}
        d="M0 10 Q25 0 50 10 T100 10 T150 10 T200 10 T250 10 T300 10 T350 10 T400 10 T450 10 T500 10 V20 H0Z" />
    </svg>
  )
}
