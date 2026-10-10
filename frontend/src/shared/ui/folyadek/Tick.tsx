import { cx } from './util'

const Check = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
)

/** The round tick button of a routine row. */
export function Tick(p: { on: boolean; label: string; onClick?: () => void; disabled?: boolean; className?: string }) {
  return (
    <button type="button" className={cx('fo-tk', p.on && 'on', p.className)} aria-label={p.label} aria-pressed={p.on} disabled={p.disabled} onClick={p.onClick}>
      <Check />
    </button>
  )
}

/** A non-interactive status node: done (green tick), now (domain ring), empty (dashed). */
export function Mark(p: { state: 'done' | 'now' | 'empty'; label?: string }) {
  return (
    <span className={cx('fo-mk', p.state === 'done' && 'd', p.state === 'now' && 'now')} role={p.label ? 'img' : undefined} aria-label={p.label}>
      {p.state === 'done' && <Check />}
    </span>
  )
}
