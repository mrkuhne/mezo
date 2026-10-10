import type { CSSProperties } from 'react'
import { cx } from '@/shared/ui/folyadek/util'
import { shapesFor } from '../../logic/bodyMapShapes'
import { MuscleChip } from '../MuscleChip'
import { muscleLiquid } from './muscleLiquid'

/** The MuscleChip on white: the kept anatomy crop in a round tinted chip of the muscle's colour (prototype `mchp`).
 *  40px by default, `sm` = 32px, or an explicit `size`. An unknown muscle key renders nothing. */
export function Mchp(p: { muscle: string; sm?: boolean; size?: number; className?: string }) {
  if (shapesFor(p.muscle).length === 0) return null
  const s = p.size ?? (p.sm ? 32 : 40)
  return (
    <span className={cx('ex-mchp', p.className)} style={{ '--c': muscleLiquid(p.muscle), '--s': `${s}px` } as CSSProperties} aria-hidden="true">
      <MuscleChip token={p.muscle} size={s} />
    </span>
  )
}

/** Up to three muscle chips overlapping (the muscles of a day or a template). */
export function MuscleStack(p: { muscles: string[]; max?: number; className?: string }) {
  return <span className={cx('ex-stk', p.className)}>{p.muscles.slice(0, p.max ?? 3).map((k) => <Mchp key={k} muscle={k} sm />)}</span>
}
