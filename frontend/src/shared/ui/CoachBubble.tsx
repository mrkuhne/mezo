import { cn } from '@/shared/lib/cn'
import type { ReactNode } from 'react'

/**
 * The Coach voice card (DS §CoachBubble): Geist 200 ultralight at 22px —
 * the same quiet typography as the hero numerals. Never italic (Fraunces
 * stays reserved for narrative meta-text). Coral-tinted bubble with a
 * 2px primary left border; avatar optional.
 */
export function CoachBubble({ children, time, eyebrow = 'COACH', avatar = true, className }: {
  children: ReactNode
  time?: string
  eyebrow?: string
  avatar?: boolean
  className?: string
}) {
  return (
    <div className={cn('coach-bubble', className)}>
      {avatar && <div className="cb-avatar" aria-hidden="true" />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="cb-head">
          <span className="cb-eyebrow">{eyebrow}</span>
          {time && <span className="cb-time">{time}</span>}
        </div>
        <div className="cb-body">{children}</div>
      </div>
    </div>
  )
}
