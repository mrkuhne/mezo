// ============================================================
// Mezo · BodyMap — two-view real-anatomy heat component (mezo-88iwa.4)
// Draws the week's muscle load on the MuscleMap silhouette (see NOTICE.md):
// a faint ink outline of the whole body, then one lit <g> per drawable shape
// carrying heat. `views:'auto'` shows whichever side (front/back) carries more
// heat — two bodies side by side reads as decoration, one reads as you (the
// prototype's `bodyMap` rule); `views:'both'` shows the full front+back load
// map (`bodyMapDuo`). The geometry is ~90kB of paths, so it is loaded lazily
// and lands in its own chunk; the root reserves its aspect-ratio box before
// it arrives so nothing below the component jumps.
// ============================================================
import { useEffect, useState } from 'react'
import { cn } from '@/shared/lib/cn'
import type { BodyView } from '../logic/bodyGeometry.gen'
import { shapesFor } from '../logic/bodyMapShapes'
import { muscleRegion, regionColor } from '../logic/muscleColors'

export type BodyHeat = { token: string; level: 'none' | 'below' | 'entering' | 'in' | 'over' }

// weekZone.ts's WeekZoneStatus vocabulary ('below' | 'entering' | 'in' | 'over') plus the
// untouched 'none' state — the prototype's opacity scale, with 'entering' interpolated
// between 'below' and 'in'.
const OPACITY: Record<BodyHeat['level'], number> = {
  none: 0.13,
  below: 0.42,
  entering: 0.58,
  in: 0.72,
  over: 1,
}

type Geometry = Record<BodyView, { vb: string; p: Record<string, string[]> }>

const VIEWS: readonly BodyView[] = ['front', 'back']

/** One row per drawable shape in `view`: its opacity and which token colors it.
 *  Shared shapes (several tokens land on one shape — see bodyMapShapes.ts) take the MAX
 *  opacity of their tokens, not the sum: heat is a scale (how hot is this muscle right now),
 *  never an additive quantity, so two tokens on one shape can't push it past what the
 *  hottest one alone would show. */
function shapeRows(view: BodyView, heat: BodyHeat[]): Map<string, { opacity: number; token: string }> {
  const rows = new Map<string, { opacity: number; token: string }>()
  for (const { token, level } of heat) {
    const opacity = OPACITY[level]
    for (const [shapeView, slug] of shapesFor(token)) {
      if (shapeView !== view) continue
      const existing = rows.get(slug)
      if (!existing || opacity > existing.opacity) rows.set(slug, { opacity, token })
    }
  }
  return rows
}

function viewLoad(view: BodyView, heat: BodyHeat[]): number {
  let total = 0
  for (const { opacity } of shapeRows(view, heat).values()) total += opacity
  return total
}

function BodyFigure({ view, heat, geometry }: { view: BodyView; heat: BodyHeat[]; geometry: Geometry }) {
  const body = geometry[view]
  const rows = shapeRows(view, heat)
  return (
    <svg viewBox={body.vb} className="body-map-figure" aria-hidden="true">
      <g fill="var(--mz-ink-mut)" opacity={0.42}>
        {Object.values(body.p).flat().map((d, i) => <path key={i} d={d} />)}
      </g>
      {[...rows.entries()].map(([slug, { opacity, token }]) => {
        const paths = body.p[slug]
        if (!paths) return null
        const region = muscleRegion(token)
        const fill = region ? regionColor(region).rail : 'var(--mz-ink-mut)'
        return (
          <g
            key={slug}
            data-shape={`${view}/${slug}`}
            fill={fill}
            opacity={opacity}
            className="body-map-shape"
          >
            {paths.map((d, i) => <path key={i} d={d} />)}
          </g>
        )
      })}
    </svg>
  )
}

export function BodyMap({ heat, views = 'auto', className, ariaLabel }: {
  heat: BodyHeat[]
  views?: 'auto' | 'both'
  className?: string
  ariaLabel: string
}) {
  const [geometry, setGeometry] = useState<Geometry | null>(null)

  useEffect(() => {
    let cancelled = false
    import('../logic/bodyGeometry.gen').then((mod) => {
      if (!cancelled) setGeometry(mod.BODY)
    })
    return () => { cancelled = true }
  }, [])

  const activeViews: BodyView[] = views === 'both'
    ? [...VIEWS]
    : [viewLoad('back', heat) > viewLoad('front', heat) ? 'back' : 'front']

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className={cn('body-map', views === 'both' ? 'body-map-duo' : 'body-map-single', className)}
      style={{ aspectRatio: views === 'both' ? '132 / 64' : '66 / 64' }}
    >
      {geometry && activeViews.map((view) => (
        <BodyFigure key={view} view={view} heat={heat} geometry={geometry} />
      ))}
    </div>
  )
}
