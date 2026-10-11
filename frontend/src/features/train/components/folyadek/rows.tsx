import type { CSSProperties, ReactNode } from 'react'
import { Level, Split, Tags, type TagItem } from '@/shared/ui/folyadek'
import { clamp, cx } from '@/shared/ui/folyadek/util'
import { Mchp } from './Mchp'
import { deepMuscle } from './muscleLiquid'

/** A muscle's line: its chip, the name (+ a quiet sub), a value, and its level in the muscle's deepened colour
 *  (prototype `mus`). `split` draws done + still-coming in one vessel instead of the level; `right` replaces both. */
export function MuscleRow(p: { muscle: string; label: ReactNode; sub?: ReactNode; value?: ReactNode; pct?: number; color?: string
  split?: { a: number; b: number }; right?: ReactNode; onClick?: () => void; ariaLabel?: string; className?: string }) {
  const c = p.color ?? deepMuscle(p.muscle)
  const inner = (
    <>
      <Mchp muscle={p.muscle} sm />
      <span className="l">{p.label}{p.sub != null && <small>{p.sub}</small>}</span>
      {p.value != null && <span className="v">{p.value}</span>}
      {p.right ?? (p.split ? <Split a={p.split.a} b={p.split.b} color={c} /> : p.pct != null ? <Level pct={p.pct} color={c} height={12} /> : null)}
    </>
  )
  return p.onClick
    ? <button type="button" className={cx('ex-mus', p.className)} onClick={p.onClick} aria-label={p.ariaLabel}>{inner}</button>
    : <div className={cx('ex-mus', p.className)}>{inner}</div>
}

/** A record as a capsule: the liquid stands above the old record's dashed line (`prev` %, none = no earlier record). */
export function Rcap(p: { prev?: number | null; color?: string; className?: string }) {
  return (
    <span className={cx('ex-rc', p.className)} style={{ '--c': p.color ?? 'var(--fo-gold)' } as CSSProperties} aria-hidden="true">
      <i />
      {p.prev != null && <u style={{ bottom: `${clamp(p.prev, 8, 92)}%` }} />}
    </span>
  )
}

/** The round number (or short weekday) in front of a day's row. */
export function DayNum(p: { children: ReactNode; className?: string }) {
  return <span className={cx('ex-day', p.className)}>{p.children}</span>
}

/** Tags led by muscle chips (the muscles a day or a session works). */
export function MuscleTags(p: { items: { muscle: string; label: ReactNode }[]; className?: string }) {
  const items: TagItem[] = p.items.map((x) => ({ label: x.label, left: <Mchp muscle={x.muscle} size={24} /> }))
  return <Tags items={items} className={p.className} />
}
