import type { ReactNode } from 'react'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'
import { cx } from './util'

export const Chev = () => (
  <svg className="chev" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
)

export interface RowProps {
  icon?: Icon3DName; title: ReactNode; sub?: ReactNode; value?: ReactNode; right?: ReactNode; onClick?: () => void
  /** Replaces the icon slot (a Tick, a Mark, a Mini, a Badge…). */
  left?: ReactNode
  /** Rendered under title/sub (a Level, Chips, an open text…). */
  more?: ReactNode
  className?: string
  state?: 'now' | 'done' | 'dim'
  /** `div` keeps the row a plain container even with `onClick`: the title part becomes the button, so `left` / `right` may hold their own buttons. */
  as?: 'div' | 'button'
  'aria-label'?: string
}

/** A list row: bubble icon (or `left`), title + sub (+ `more`), value, optional right slot; a button when clickable. */
export function Row(p: RowProps) {
  const cls = cx('fo-row', p.state, p.className)
  const icon = p.icon && <span className="si"><Icon3D name={p.icon} size={26} /></span>
  const text = <span className="g"><strong>{p.title}</strong>{p.sub != null && <small>{p.sub}</small>}{p.more}</span>
  const value = p.value != null && <span className="v">{p.value}</span>
  if (p.onClick && p.as === 'div') {
    return (
      <div className={cls}>
        {p.left}
        <button type="button" className="fo-row-main" onClick={p.onClick} aria-label={p['aria-label']}>{icon}{text}{value}</button>
        {p.right}
      </div>
    )
  }
  const inner = <>{p.left}{icon}{text}{value}{p.right}{p.onClick && p.right == null && <Chev />}</>
  return p.onClick
    ? <button type="button" className={cls} onClick={p.onClick} aria-label={p['aria-label']}>{inner}</button>
    : <div className={cls}>{inner}</div>
}
