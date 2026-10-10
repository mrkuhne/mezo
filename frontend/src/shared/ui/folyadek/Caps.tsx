import type { CSSProperties, ReactNode } from 'react'
import { cx } from './util'

/** A set (a week, a day) is a capsule: `n` small capsules, the first `done` full, `cur` half full (the current one).
 *  `on` fills explicit indexes instead of the first `done`; `labels` stands a caption in each (the week strip, with `size="wide"`).
 *  `size`: wide = stretches across its row, big = the exercise hero, xs = the tiny warm-up ones. `label` names it for screen readers. */
export function Caps(p: { n: number; done?: number; cur?: number; on?: number[]; color?: string; size?: 'wide' | 'big' | 'xs'; labels?: ReactNode[]; label?: string; className?: string }) {
  const full = (j: number) => (p.on ? p.on.includes(j) : j < (p.done ?? 0))
  return (
    <span className={cx('fo-caps', p.size, p.labels && 'wk', p.className)} style={{ '--c': p.color ?? 'var(--dom)' } as CSSProperties}
      role={p.label ? 'img' : undefined} aria-label={p.label} aria-hidden={p.label ? undefined : true}>
      {Array.from({ length: Math.max(0, p.n) }, (_, j) => (
        <i key={j} className={full(j) ? 'f' : j === p.cur ? 'h' : undefined}>{p.labels?.[j] != null && <b>{p.labels[j]}</b>}</i>
      ))}
    </span>
  )
}
