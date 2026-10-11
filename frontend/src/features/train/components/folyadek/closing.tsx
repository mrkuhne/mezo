// Edzés · the closing screens' own pieces (mezo-n4wf5.4; prototype vilagos/edzes.js `kcalBowl`, `.vs-mt`).
// CSS: `.ex-bowl`, `.ex-mstar` in folyadek-edzes-kozos.css. The stage itself (stars, cup, the one pass) is the kit's
// `CupStage` / `useCeremonyPass`.
import type { ReactNode } from 'react'
import { ratioStars } from '@/shared/ui/folyadek'
import { clamp, cx, useSvgId } from '@/shared/ui/folyadek/util'
import { Mchp } from './Mchp'
import { StarRow } from './medals'

/** How the bowl is filled: the day's frame (from the Fuel day) and what today's movement adds on top, as % of the bowl.
 *  The two together always reach the same height (92%), so the picture says „this much of it is the workout".
 *  Null when the frame is unknown — then there is no bowl, only the number. */
export function kcalBowlShares(dayKcal: number | null | undefined, addKcal: number): { base: number; add: number } | null {
  if (dayKcal == null || !(dayKcal > 0) || !(addKcal > 0)) return null
  const add = (addKcal / (dayKcal + addKcal)) * 92
  return { base: 92 - add, add }
}

const BOWL = 'M8 38 H92 C92 66 74 88 50 88 C26 88 8 66 8 38Z'
const surface = (y: number) => `M-10 ${y}${' q7.5 -2.5 15 0 q7.5 2.5 15 0'.repeat(4)} V100 H-10Z`

/** The bowl of the day: the frame in the Fuel green, today's movement poured on top in gold. `base` / `add` in % of the bowl. */
export function KcalBowl(p: { base: number; add: number; className?: string }) {
  const id = useSvgId('exbowl')
  const y = (pct: number) => 88 - clamp(pct) * 0.5
  return (
    <svg className={cx('ex-bowl', p.className)} viewBox="0 0 100 100" aria-hidden="true">
      <defs><clipPath id={id}><path d={BOWL} /></clipPath></defs>
      <path d={BOWL} fill="#fff" stroke="rgba(10,42,60,.12)" strokeWidth="1.8" />
      <g clipPath={`url(#${id})`}>
        <path className="a" d={surface(y(p.base + p.add))} />
        <path className="b" d={surface(y(p.base))} />
      </g>
      <path d="M32 95 H68" stroke="rgba(10,42,60,.16)" strokeWidth="4" strokeLinecap="round" />
    </svg>
  )
}

/** A muscle of today's workout with its own stars: chip, name, the stars of its done/planned `ratio` (0–1), „n / m szett". */
export function MuscleStarRow(p: { muscle: string; label: ReactNode; ratio: number; done: number; plan: number; className?: string }) {
  return (
    <div className={cx('ex-mus ex-mstar', p.className)}>
      <Mchp muscle={p.muscle} sm />
      <span className="l">{p.label}</span>
      <StarRow stars={ratioStars(p.ratio)} />
      <span className="v">{p.done} / {p.plan} szett</span>
    </div>
  )
}
