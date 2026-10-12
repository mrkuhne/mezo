// „Ha feljebb vinnéd" (mezo-zeeq; Folyadék F5, mezo-n4wf5.5): the wire's `impact` is free text. The scorer's own
// "+0.04 score" shape is ONE number with ONE rounding (bible F4.8): `impactPoints` reads it as points on the hundred scale
// (the number the old page printed as "+4 pont"), and `formatImpact` prints the SAME points on the ten scale the rating
// itself is printed on ("+0,4"). Anything else is shown verbatim — never a fabricated number.
import { fmtNum } from '@/shared/lib/format'

const SCORE_RE = /^([+\-−])?\s*(\d+(?:[.,]\d+)?)\s*score$/i

/** The impact as signed points on the hundred scale (`+0.04 score` → 4), or `null` when the text is not the scorer's shape. */
export function impactPoints(impact: string): number | null {
  const m = SCORE_RE.exec(impact.trim())
  if (!m) return null
  const pts = Math.round(parseFloat(m[2].replace(',', '.')) * 100)
  return m[1] === '-' || m[1] === '−' ? -pts : pts
}

/** The impact on the ten scale, from the same points (`+0.04 score` → "+0,4" / "+0.4"); free text passes through. */
export function formatImpact(impact: string): string {
  const pts = impactPoints(impact)
  if (pts == null) return impact
  return `${pts < 0 ? '−' : '+'}${fmtNum(Math.abs(pts) / 10, 1)}`
}
