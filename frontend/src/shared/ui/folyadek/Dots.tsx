import { cx } from './util'

/** Step progress as segments: 0…`at` are done, the rest up to `core` are the must-answer ones. `label` names it for screen readers. */
export function Dots(p: { count: number; at: number; core?: number; label?: string; className?: string }) {
  return (
    <div className={cx('fo-dots', p.className)} role={p.label ? 'img' : undefined} aria-label={p.label} aria-hidden={p.label ? undefined : true}>
      {Array.from({ length: p.count }, (_, i) => <i key={i} className={i <= p.at ? 'on' : i < (p.core ?? 0) ? 'core' : undefined} />)}
    </div>
  )
}
