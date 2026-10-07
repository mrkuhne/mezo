// Életvonal — pure plot geometry (mezo-lhqw7). The approved prototype's `elvChart()`
// (docs/design_2.0/prototypes/elo/en.html) with its literals turned into a scale computed from
// the data: point → x/y, the Catmull-Rom → Bézier stroke, the area, the grid values, the target
// line and the projection. No React, no DOM — unit-tested on its own.
import type { Lifeline } from '@/features/me/logic/lifeline'

/** The prototype's frame: a 320×128 plot inside a 332×142 viewBox; the curve ends at x1 so the
 *  dotted projection has room to run to xp, and the kg labels sit right-aligned at labelX. */
export const PLOT = { w: 320, h: 128, vbW: 332, vbH: 142, x0: 10, x1: 262, x1Wide: 300, xp: 306, labelX: 330, top: 6, bottomPad: 8 } as const

export interface PlotPoint { x: number; y: number }
export interface LifelineGeometry {
  pts: PlotPoint[]
  path: string
  area: string
  grid: { value: number; y: number }[]
  /** null unless the lifeline projects toward its target. */
  targetY: number | null
  projection: string | null
}

const f = (n: number): string => n.toFixed(1)

/** One smoothed stroke through every point (Catmull-Rom converted to cubic Béziers, tension 1/6). */
export function catmullRomPath(pts: PlotPoint[]): string {
  if (pts.length === 0) return ''
  let d = `M${f(pts[0].x)} ${f(pts[0].y)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2
    d += ` C${f(p1.x + (p2.x - p0.x) / 6)} ${f(p1.y + (p2.y - p0.y) / 6)}`
      + ` ${f(p2.x - (p3.x - p1.x) / 6)} ${f(p2.y - (p3.y - p1.y) / 6)} ${f(p2.x)} ${f(p2.y)}`
  }
  return d
}

const GRID_STEPS = [0.5, 1, 2, 3, 5, 10, 20, 50]

/** At most three round kg values inside [lo, hi], top first — the finest step that fits three. */
export function gridValues(lo: number, hi: number): number[] {
  for (const step of GRID_STEPS) {
    const top = Math.floor(hi / step), bottom = Math.ceil(lo / step)
    const count = top - bottom + 1
    if (count < 1 || count > 3) continue
    return Array.from({ length: count }, (_, k) => (top - k) * step)
  }
  return []
}

export function lifelineGeometry(l: Lifeline): LifelineGeometry {
  const values = l.points.map((p) => p.avgKg)
  const target = l.project ? l.targetKg : null
  const all = target != null ? [...values, target] : values
  const min = Math.min(...all), max = Math.max(...all)
  // Breathing room above and below; also what keeps a flat series from dividing by zero.
  const pad = Math.max(0.4, (max - min) * 0.07)
  const lo = min - pad, hi = max + pad

  const x1 = target != null ? PLOT.x1 : PLOT.x1Wide
  const n = l.points.length
  const X = (i: number): number => (n > 1 ? PLOT.x0 + (i * (x1 - PLOT.x0)) / (n - 1) : PLOT.x0)
  const Y = (v: number): number => PLOT.top + ((hi - v) / (hi - lo)) * (PLOT.h - PLOT.top - PLOT.bottomPad)

  const pts = values.map((v, i) => ({ x: X(i), y: Y(v) }))
  const path = catmullRomPath(pts)
  const last = pts[pts.length - 1]
  const targetY = target != null ? Y(target) : null
  return {
    pts, path,
    area: `${path} L${f(last.x)} ${PLOT.h} L${PLOT.x0} ${PLOT.h}Z`,
    grid: gridValues(lo, hi).map((value) => ({ value, y: Y(value) })),
    targetY,
    projection: targetY != null ? `M${f(last.x)} ${f(last.y)} L${PLOT.xp} ${f(targetY)}` : null,
  }
}
