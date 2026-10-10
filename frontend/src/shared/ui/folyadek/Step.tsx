import type { ReactNode } from 'react'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'
import { Chev } from './Row'
import { cx, splitAria, type PassProps } from './util'

/** A row on the stream with an optional time: `now` is the filled next step. A card of Steps draws the flow line itself.
 *  `id`, `role`, `data-*` land on the root; `aria-*` on the interactive element. */
export function Step({ time, icon, title, sub, right, now, onClick, className, ...rest }: PassProps & { time?: ReactNode; icon?: Icon3DName; title: ReactNode; sub?: ReactNode; right?: ReactNode; now?: boolean; onClick?: () => void; className?: string }) {
  const cls = cx('fo-step', now && 'now', className)
  const main = (
    <>
      {time != null && <time>{time}</time>}
      {icon && <span className="si"><Icon3D name={icon} size={26} /></span>}
      <span className="g"><strong>{title}</strong>{sub != null && <small>{sub}</small>}</span>
    </>
  )
  if (onClick && right != null) {
    const [aria, other] = splitAria(rest)
    return <div className={cls} {...other}><button type="button" className="fo-row-main" onClick={onClick} {...aria}>{main}</button>{right}</div>
  }
  return onClick
    ? <button type="button" className={cls} onClick={onClick} {...rest}>{main}<Chev /></button>
    : <div className={cls} {...rest}>{main}{right}</div>
}
