import type { CSSProperties, ReactNode } from 'react'

export type SkeletonVariant = 'line' | 'block' | 'card' | 'circle' | 'stat'

const VARIANT_DEFAULTS: Record<SkeletonVariant, CSSProperties> = {
  line: { height: 11, borderRadius: 7 },
  block: { borderRadius: 7 },
  card: { borderRadius: 11 },
  circle: { borderRadius: '50%' },
  stat: { width: 30, height: 30, borderRadius: 8 },
}

export function Skeleton({
  variant = 'line', width, height, radius, className, style,
}: {
  variant?: SkeletonVariant
  width?: string | number
  height?: string | number
  radius?: string | number
  className?: string
  style?: CSSProperties
}) {
  const base = VARIANT_DEFAULTS[variant]
  return (
    <div
      aria-hidden="true"
      className={`sk sk--${variant}${className ? ` ${className}` : ''}`}
      style={{
        ...base,
        ...(width !== undefined ? { width } : null),
        ...(height !== undefined ? { height } : null),
        ...(radius !== undefined ? { borderRadius: radius } : null),
        ...style,
      }}
    />
  )
}

/** Vertical stack of line skeletons with tapering widths (animated GhostState shape). */
export function SkeletonText({ lines = 3, widths }: { lines?: number; widths?: string[] }) {
  return (
    <div className="col gap-sm" aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} variant="line" width={widths?.[i] ?? `${Math.max(70 - i * 15, 25)}%`} />
      ))}
    </div>
  )
}

/** A surface-1 card container wrapping skeleton children (the card-list building block). */
export function SkeletonCard({ children, className, style }: {
  children: ReactNode; className?: string; style?: CSSProperties
}) {
  return (
    <div className={`card notch-12${className ? ` ${className}` : ''}`} style={{ padding: 14, ...style }}>
      {children}
    </div>
  )
}
