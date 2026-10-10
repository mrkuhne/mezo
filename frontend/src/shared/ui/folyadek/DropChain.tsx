import type { ReactNode } from 'react'
import { cx } from './util'

export interface DropChainItem { state?: 'done' | 'now' | 'missed' | 'empty'; label?: ReactNode; ariaLabel?: string; onClick?: () => void }

const CLS = { done: 'd', now: 'now', missed: 'x', empty: '' } as const

/** Linked drops: done = full, now = ringed, missed = dashed, empty = hollow. A drop with `onClick` is a button. */
export function DropChain(p: { items: DropChainItem[]; big?: boolean; className?: string; 'aria-label'?: string }) {
  return (
    <div className={cx('fo-drops', p.big && 'big', p.className)} role={p['aria-label'] ? 'group' : undefined} aria-label={p['aria-label']}>
      {p.items.map((o, i) => {
        const cls = cx('fo-dr', CLS[o.state ?? 'empty'])
        const inner = <><i />{o.label != null && <small>{o.label}</small>}</>
        return o.onClick
          ? <button key={i} type="button" className={cls} aria-label={o.ariaLabel} onClick={o.onClick}>{inner}</button>
          : <span key={i} className={cls} role={o.ariaLabel ? 'img' : undefined} aria-label={o.ariaLabel}>{inner}</span>
      })}
    </div>
  )
}
