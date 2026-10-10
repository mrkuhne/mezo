import type { CSSProperties, KeyboardEvent, ReactNode } from 'react'
import { cx } from './util'

/** The 1–10 scale as ten small vials, filled up to the chosen one. A radio group: arrows move the choice. */
export function Scale(p: { value?: number | null; onPick: (n: number) => void; 'aria-label'?: string; 'aria-labelledby'?: string; className?: string }) {
  const v = p.value ?? 0
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0
    if (!d) return
    e.preventDefault()
    const n = Math.max(1, Math.min(10, (v || (d > 0 ? 0 : 11)) + d))
    p.onPick(n)
    e.currentTarget.querySelectorAll<HTMLButtonElement>('button')[n - 1]?.focus()
  }
  return (
    <div className={cx('fo-scale', p.className)} role="radiogroup" aria-label={p['aria-label']} aria-labelledby={p['aria-labelledby']} onKeyDown={onKey}>
      {Array.from({ length: 10 }, (_, i) => {
        const n = i + 1
        return (
          <button key={n} type="button" role="radio" aria-checked={n === v} aria-label={String(n)} tabIndex={n === (v || 1) ? 0 : -1}
            className={n < v ? 'f' : n === v ? 'a' : undefined} style={{ '--k': n } as CSSProperties} onClick={() => p.onPick(n)}>
            <span>{n}</span>
          </button>
        )
      })}
    </div>
  )
}

/** The low / high captions under a `Scale`. */
export function Ends(p: { low: ReactNode; high: ReactNode }) {
  return <div className="fo-ends"><span>{p.low}</span><span>{p.high}</span></div>
}
