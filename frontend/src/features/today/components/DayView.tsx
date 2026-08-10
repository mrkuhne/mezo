// ============================================================
// Mezo · DayView — the frame a daypart's content sits in (mezo-puci).
// The point of this component is what it does NOT draw: there is no
// card, no border, no blob, no shadow. The content sits straight on
// the canvas, exactly like the mezo message band above it — boxes
// exist only INSIDE (fact strip, ItemRows, chips). The `key={tone}`
// on the root is what makes a tab switch cross-fade rather than
// mutate in place (the isl-phasein motion, reused).
// `DayHeroLine` is the daypart's one big number, left-aligned.
// ============================================================
import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'
import type { DayFace } from '@/features/today/logic/dayFace'

export function DayView({ tone, night, children }: {
  tone: DayFace
  /** The evening's night phase — the VIEW darkens, since there is no card to darken. */
  night?: boolean
  children: ReactNode
}) {
  return (
    <div className={cn('dayview', night && 'is-night')} data-tone={tone} key={tone}>
      {children}
    </div>
  )
}

export function DayHeroLine({ value, unit, sub }: {
  value: string
  unit?: string | null
  sub?: string | null
}) {
  return (
    <div className="dv-hero">
      <span className="dv-hero-v">
        {value}
        {unit && <span className="dv-hero-u"> {unit}</span>}
      </span>
      {sub && <span className="dv-hero-sub">{sub}</span>}
    </div>
  )
}
