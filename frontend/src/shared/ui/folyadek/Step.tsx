import type { ReactNode } from 'react'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'
import { Chev } from './Row'
import { cx } from './util'

/** A row on the stream with an optional time: `now` is the filled next step. A card of Steps draws the flow line itself. */
export function Step(p: { time?: ReactNode; icon?: Icon3DName; title: ReactNode; sub?: ReactNode; right?: ReactNode; now?: boolean; onClick?: () => void; className?: string }) {
  const cls = cx('fo-step', p.now && 'now', p.className)
  const main = (
    <>
      {p.time != null && <time>{p.time}</time>}
      {p.icon && <span className="si"><Icon3D name={p.icon} size={26} /></span>}
      <span className="g"><strong>{p.title}</strong>{p.sub != null && <small>{p.sub}</small>}</span>
    </>
  )
  if (p.onClick && p.right != null) {
    return <div className={cls}><button type="button" className="fo-row-main" onClick={p.onClick}>{main}</button>{p.right}</div>
  }
  return p.onClick
    ? <button type="button" className={cls} onClick={p.onClick}>{main}<Chev /></button>
    : <div className={cls}>{main}{p.right}</div>
}
