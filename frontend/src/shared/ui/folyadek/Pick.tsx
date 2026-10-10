import type { ButtonHTMLAttributes, HTMLAttributes, KeyboardEvent, ReactNode } from 'react'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'
import { cx } from './util'

/** A filter chip: pressed = filled with the liquid. */
export function Pill({ on, icon, className, type = 'button', children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { on?: boolean; icon?: Icon3DName }) {
  return (
    <button type={type} aria-pressed={!!on} className={cx('fo-pill', on && 'on fo-on-liquid', className)} {...rest}>
      {icon && <Icon3D name={icon} size={18} />}
      {children}
    </button>
  )
}

/** The wrapping row of `Pill`s. */
export function Pills({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('fo-pills', className)} {...rest} />
}

export interface SegItem<K extends string = string> { key: K; label: ReactNode; dot?: boolean }

/** A segmented control. With `tabs` it is a tablist (arrow keys move the selection); otherwise a group of pressed buttons. */
export function Seg<K extends string>(p: { items: SegItem<K>[]; value: K; onChange: (key: K) => void; tabs?: boolean; className?: string; 'aria-label'?: string }) {
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!p.tabs || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft')) return
    const i = p.items.findIndex((it) => it.key === p.value)
    const next = p.items[(i + (e.key === 'ArrowRight' ? 1 : p.items.length - 1)) % p.items.length]
    if (!next) return
    e.preventDefault()
    p.onChange(next.key)
    const btns = e.currentTarget.querySelectorAll<HTMLButtonElement>('button')
    btns[p.items.indexOf(next)]?.focus()
  }
  return (
    <div className={cx('fo-seg', p.className)} role={p.tabs ? 'tablist' : 'group'} aria-label={p['aria-label']} onKeyDown={onKey}>
      {p.items.map((it) => {
        const on = it.key === p.value
        const a11y = p.tabs ? { role: 'tab', 'aria-selected': on, tabIndex: on ? 0 : -1 } : { 'aria-pressed': on }
        return (
          <button key={it.key} type="button" className={on ? 'on' : undefined} onClick={() => p.onChange(it.key)} {...a11y}>
            {it.label}{it.dot && <i className="fo-seg-dot" />}
          </button>
        )
      })}
    </div>
  )
}
