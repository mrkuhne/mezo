// ============================================================
// Mezo · MuscleChip — zoom-crop anatomy icon (mezo-88iwa.4)
// One muscle token, cropped tight on its own drawable shapes: the silhouette faint behind,
// the shapes themselves lit in the region color. Same lazy dynamic-import idiom as BodyMap
// (the geometry is ~90kB of paths and only needed once a token resolves). The crop is the
// prototype's `muscleIcon` math (docs/design_2.0/prototypes/companion-titanium/muscles.js):
// union bbox of the token's shapes → 30% air on every side (`side = max(w,h) * 1.6`),
// centered, squared. jsdom has no `getBBox`, so the first paint always uses the generated
// `BODY[view].b` boxes; in a real browser the first mounted instance per shape-set refines
// the crop once via `getBBox()` and the measurement is cached module-wide so later instances
// (and re-renders) skip remeasuring.
// ============================================================
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/shared/lib/cn'
import type { BodyView } from '../logic/bodyGeometry.gen'
import { shapesFor } from '../logic/bodyMapShapes'
import { muscleRegion, regionColor } from '../logic/muscleColors'

type Geometry = Record<BodyView, { vb: string; p: Record<string, string[]>; b: Record<string, [number, number, number, number]> }>
type Box = [number, number, number, number]
type Crop = { cx: number; cy: number; side: number }

// getBBox() measurement cache, keyed by "<view>/<slug1>,<slug2>,…" — measured once per
// distinct shape set across every mounted instance (module-level: outlives remounts).
const cropCache = new Map<string, Crop>()

function unionBox(boxes: Box[]): Box | null {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const [bx, by, bw, bh] of boxes) {
    x0 = Math.min(x0, bx); y0 = Math.min(y0, by)
    x1 = Math.max(x1, bx + bw); y1 = Math.max(y1, by + bh)
  }
  return Number.isFinite(x0) ? [x0, y0, x1 - x0, y1 - y0] : null
}

function cropFor([x0, y0, w, h]: Box): Crop {
  return { cx: x0 + w / 2, cy: y0 + h / 2, side: Math.max(w, h) * 1.6 }
}

export function MuscleChip({ token, size = 40, className }: {
  token: string
  size?: number
  className?: string
}) {
  const [geometry, setGeometry] = useState<Geometry | null>(null)
  const groupRef = useRef<SVGGElement>(null)
  const [, refine] = useState(0)

  useEffect(() => {
    let cancelled = false
    import('../logic/bodyGeometry.gen').then((mod) => {
      if (!cancelled) setGeometry(mod.BODY)
    })
    return () => { cancelled = true }
  }, [])

  const shapes = shapesFor(token)
  const view: BodyView | undefined = shapes[0]?.[0]
  const slugs = view ? shapes.filter(([v]) => v === view).map(([, slug]) => slug) : []
  const cacheKey = view && slugs.length ? `${view}/${slugs.join(',')}` : null

  const fallbackBox = geometry && view
    ? unionBox(slugs.map((slug) => geometry[view].b[slug]).filter((b): b is Box => Boolean(b)))
    : null
  const crop = (cacheKey && cropCache.get(cacheKey)) ?? (fallbackBox ? cropFor(fallbackBox) : null)

  // Refine the crop once real geometry is on-screen: getBBox() is absent in jsdom (bbox stays
  // undefined there, so this is a no-op) but measures the exact rendered shape group in a
  // browser. Runs on every render — cheap, since it bails out the instant the shape set is
  // cached — so it catches the group appearing once `geometry` resolves.
  useEffect(() => {
    if (!cacheKey || cropCache.has(cacheKey)) return
    const bbox = groupRef.current?.getBBox?.()
    if (bbox && bbox.width) {
      cropCache.set(cacheKey, cropFor([bbox.x, bbox.y, bbox.width, bbox.height]))
      refine((n) => n + 1)
    }
  })

  if (!view || slugs.length === 0 || !geometry || !crop) return null

  const body = geometry[view]
  const region = muscleRegion(token)
  const fill = region ? regionColor(region).rail : 'var(--mz-ink-mut)'
  const vb = `${crop.cx - crop.side / 2} ${crop.cy - crop.side / 2} ${crop.side} ${crop.side}`

  return (
    <svg
      viewBox={vb}
      width={size}
      height={size}
      className={cn('muscle-chip', className)}
      aria-hidden="true"
    >
      <g fill="var(--mz-ink-mut)" opacity={0.42}>
        {Object.values(body.p).flat().map((d, i) => <path key={i} d={d} />)}
      </g>
      <g ref={groupRef} fill={fill} opacity={0.95} stroke="#ffffff2e" strokeWidth={2}>
        {slugs.map((slug) => body.p[slug]?.map((d, i) => <path key={`${slug}-${i}`} d={d} />))}
      </g>
    </svg>
  )
}
