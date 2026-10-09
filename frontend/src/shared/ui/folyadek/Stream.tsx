import type { ReactNode } from 'react'

export interface StreamItem { time: string; title: string; sub?: string; right?: ReactNode; now?: boolean; onClick?: () => void }

/** Time-ordered pills on a liquid line; the current one is filled. */
export function Stream(p: { items: StreamItem[] }) {
  return (
    <div className="fo-stream">
      {p.items.map((o, i) => {
        const cls = o.now ? 'fo-stream-item now' : 'fo-stream-item'
        const inner = (
          <>
            <span className="fo-stream-time">{o.time}</span>
            <span className="fo-stream-txt"><strong>{o.title}</strong>{o.sub && <small>{o.sub}</small>}</span>
            {o.right != null && <em>{o.right}</em>}
          </>
        )
        return o.onClick
          ? <button key={i} type="button" className={cls} onClick={o.onClick}>{inner}</button>
          : <div key={i} className={cls}>{inner}</div>
      })}
    </div>
  )
}
