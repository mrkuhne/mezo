import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { clamp, cx, useSvgId } from '@/shared/ui/folyadek/util'
import type { BodyView } from '../../logic/bodyGeometry.gen'
import { shapesFor } from '../../logic/bodyMapShapes'
import { deepMuscle, muscleLiquid } from './muscleLiquid'

export interface BodyLiqEntry { muscle: string
  /** Already done, 0..1 (the deep liquid). */
  done?: number
  /** Planned, 0..1 (the light liquid). */
  planned?: number }

type Box = [number, number, number, number]
type Geometry = Record<BodyView, { vb: string; p: Record<string, string[]>; b: Record<string, Box> }>

/** The wave edge of a liquid surface: `n` crests of amplitude `a` across `w` from (x, y). */
function wave(x: number, y: number, w: number, n = 4, a = 7): string {
  const s = w / (2 * n)
  let d = `M${x} ${y}`
  for (let i = 0; i < n; i++) d += ` q${s / 2} ${-a} ${s} 0 q${s / 2} ${a} ${s} 0`
  return d
}

/** One row per drawable shape of `view`. Shapes shared by several muscles take the highest level, and the colour of the
 *  muscle that set it. */
function shapeRows(view: BodyView, entries: BodyLiqEntry[]) {
  const rows = new Map<string, { muscle: string; done: number; planned: number }>()
  for (const { muscle, done = 0, planned = 0 } of entries) {
    for (const [v, slug] of shapesFor(muscle)) {
      if (v !== view) continue
      const o = rows.get(slug) ?? { muscle, done: 0, planned: 0 }
      if (done >= o.done && planned >= o.planned) o.muscle = muscle
      o.done = Math.max(o.done, done)
      o.planned = Math.max(o.planned, planned)
      rows.set(slug, o)
    }
  }
  return rows
}

/** The BodyMap silhouette as a vessel (prototype `bodyLiq`): every muscle shape is its own little tank. Light liquid = the
 *  planned load, deep liquid = already done. Each shape carries its colours as `--c` / `--cd` and the stylesheet fills with them
 *  directly (no shared gradient: bible §8.1). The geometry chunk loads lazily, as in BodyMap; the box keeps its place meanwhile.
 *  `width` in px (default 84); `caption` stands under the figure; `off` dims it. With `ariaLabel` it is an image, else decoration. */
export function BodyLiq(p: { view: BodyView; entries: BodyLiqEntry[]; width?: number; caption?: ReactNode; off?: boolean; ariaLabel?: string; className?: string }) {
  const id = useSvgId('exbl')
  const [geometry, setGeometry] = useState<Geometry | null>(null)

  useEffect(() => {
    let cancelled = false
    import('../../logic/bodyGeometry.gen')
      .then((mod) => { if (!cancelled) setGeometry(mod.BODY) })
      .catch((err) => { if (!cancelled) console.warn('BodyLiq: failed to load body geometry chunk', err) })
    return () => { cancelled = true }
  }, [])

  const body = geometry?.[p.view]
  const figure = (
    <span className={cx('ex-body', p.caption == null && p.off && 'off', p.caption == null && p.className)} data-view={p.view}
      style={p.width != null && p.caption == null ? ({ '--w': `${p.width}px` } as CSSProperties) : undefined}
      role={p.ariaLabel ? 'img' : undefined} aria-label={p.ariaLabel} aria-hidden={p.ariaLabel ? undefined : true}>
      {body && (
        <svg viewBox={body.vb}>
          <g className="sil">{Object.values(body.p).flat().map((d, i) => <path key={i} d={d} />)}</g>
          {[...shapeRows(p.view, p.entries)].map(([slug, o], i) => {
            const paths = body.p[slug], box = body.b[slug]
            if (!paths || !box) return null
            const [x, y, w, h] = box
            const c = muscleLiquid(o.muscle)
            const Y = (v: number) => y + h * (1 - clamp(v, 0, 1) * 0.94)
            const liquid = (v: number) => `${wave(x - 6, Y(v), w + 12)} V${y + h + 8} H${x - 6}Z`
            return (
              <g key={slug} data-shape={`${p.view}/${slug}`} style={{ '--c': c, '--cd': deepMuscle(o.muscle) } as CSSProperties}>
                <clipPath id={`${id}${i}`}>{paths.map((d, k) => <path key={k} d={d} />)}</clipPath>
                <g className="sh">
                  {paths.map((d, k) => <path key={k} d={d} />)}
                </g>
                <g clipPath={`url(#${id}${i})`}>
                  {o.planned > 0 && <path className="pl" d={liquid(o.planned)} />}
                  {o.done > 0 && <path className="dn" d={liquid(o.done)} />}
                </g>
              </g>
            )
          })}
        </svg>
      )}
    </span>
  )
  if (p.caption == null) return figure
  return (
    <span className={cx('ex-hb', p.off && 'off', p.className)} style={p.width != null ? ({ '--w': `${p.width}px` } as CSSProperties) : undefined}>
      {figure}
      <small>{p.caption}</small>
    </span>
  )
}

/** Front and back side by side. `size`: sm = beside a row's text, md / xl = a card's own graphic. */
export function DuoBody(p: { entries: BodyLiqEntry[]; size?: 'sm' | 'md' | 'xl'; ariaLabel?: string; className?: string }) {
  return (
    <span className={cx('ex-duo', p.size, p.className)} role={p.ariaLabel ? 'img' : undefined} aria-label={p.ariaLabel}>
      <BodyLiq view="front" entries={p.entries} />
      <BodyLiq view="back" entries={p.entries} />
    </span>
  )
}
