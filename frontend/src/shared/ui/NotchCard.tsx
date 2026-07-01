import { cn } from '@/shared/lib/cn'
import type { CSSProperties, ReactNode } from 'react'

type Notch = 4 | 8 | 12
type Accent = 'brand' | 'warning' | 'error' | 'tendency'
const ACCENT_COLOR: Record<Accent, string> = {
  brand: 'var(--brand-glow)',
  warning: 'var(--warning)',
  error: 'var(--error)',
  tendency: 'var(--cat-tendency)',
}

interface NotchCardProps {
  children: ReactNode
  notch?: Notch
  glass?: boolean
  accent?: Accent
  className?: string
  style?: CSSProperties
}

export function NotchCard({ children, notch = 8, glass = false, accent, className, style }: NotchCardProps) {
  return (
    <div
      className={cn('card', glass && 'glass', `notch-${notch}`, className)}
      style={{ position: accent ? 'relative' : undefined, ...style }}
    >
      {accent && (
        <span
          className="accent-strip"
          style={{ background: ACCENT_COLOR[accent], boxShadow: `0 0 8px ${ACCENT_COLOR[accent]}` }}
        />
      )}
      {children}
    </div>
  )
}
