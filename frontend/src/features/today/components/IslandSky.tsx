// ============================================================
// Mezo · IslandSky — the non-scrolling sky the three islands live in
// (mezo-euze). Owns exactly two layout states: the normal sky (three
// islands, one big) and the anchor melt (?day=rough) where the
// islands collapse and one warm anchor island fills the screen.
// ============================================================
import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'

export interface IslandSkyProps {
  anchor: boolean
  anchorContent: ReactNode
  children: ReactNode
}

export function IslandSky({ anchor, anchorContent, children }: IslandSkyProps) {
  return (
    <div className={cn('sky-islands', anchor && 'is-anchor')}>
      {children}
      <section className="isl isl-anchor" aria-hidden={!anchor || undefined}>
        <div className="isl-blob" />
        <div className="isl-bigview">{anchor ? anchorContent : null}</div>
      </section>
    </div>
  )
}
