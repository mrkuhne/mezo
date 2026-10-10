import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'
import { cx, splitAria, type PassProps } from './util'

export const Chev = () => (
  <svg className="chev" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
)

export interface RowProps extends PassProps {
  icon?: Icon3DName; title: ReactNode; sub?: ReactNode; value?: ReactNode; right?: ReactNode; onClick?: () => void
  /** Makes the row a real link (with the chevron). */
  to?: string
  /** Replaces the icon slot (a Tick, a Mark, a Mini, a Badge…). */
  left?: ReactNode
  /** Rendered under title/sub (a Level, Chips, an open text…). */
  more?: ReactNode
  className?: string
  state?: 'now' | 'done' | 'dim'
  /** `div` keeps the row a plain container even with `onClick`: the title part becomes the button, so `left` / `right` may hold their own buttons. */
  as?: 'div' | 'button'
}

/** A list row: bubble icon (or `left`), title + sub (+ `more`), value, optional right slot; a button when clickable, a link with `to`.
 *  `id`, `role`, `data-*` land on the root; `aria-*` on the interactive element (the root, or the title-part button of `as="div"`). */
export function Row({ icon: ic, title, sub, value: val, right, onClick, to, left, more, className, state, as, ...rest }: RowProps) {
  const cls = cx('fo-row', state, className)
  const icon = ic && <span className="si"><Icon3D name={ic} size={26} /></span>
  const text = <span className="g"><strong>{title}</strong>{sub != null && <small>{sub}</small>}{more}</span>
  const value = val != null && <span className="v">{val}</span>
  if (onClick && as === 'div') {
    const [aria, other] = splitAria(rest)
    return (
      <div className={cls} {...other}>
        {left}
        <button type="button" className="fo-row-main" onClick={onClick} {...aria}>{icon}{text}{value}</button>
        {right}
      </div>
    )
  }
  const inner = <>{left}{icon}{text}{value}{right}{(onClick || to != null) && right == null && <Chev />}</>
  if (to != null) return <Link to={to} className={cls} onClick={onClick} {...rest}>{inner}</Link>
  return onClick
    ? <button type="button" className={cls} onClick={onClick} {...rest}>{inner}</button>
    : <div className={cls} {...rest}>{inner}</div>
}
