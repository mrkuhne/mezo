import type { ButtonHTMLAttributes, HTMLAttributes, KeyboardEvent, ReactNode } from 'react'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'
import { cx, type PassProps } from './util'

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

/** Removable chips (prototype `.fx-cats`): what is switched on right now — active filters, the context of a request.
 *  Each chip is ONE button: tapping it takes it off (the × is its drawn hint). The caller names the action per chip
 *  (`ariaLabel`: „Hús szűrő levétele"). 32 px drawn, the kit owns the 44 px touch area. */
export function RemoveChips({ items, className, ...rest }: Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  items: { key: string; label: ReactNode; ariaLabel: string; onRemove: () => void }[]
}) {
  return (
    <div className={cx('fo-rmc', className)} {...rest}>
      {items.map((it) => (
        <button key={it.key} type="button" aria-label={it.ariaLabel} onClick={it.onRemove}>{it.label}<b aria-hidden="true">×</b></button>
      ))}
    </div>
  )
}

export interface SegItem<K extends string = string> { key: K; label: ReactNode; dot?: boolean }

/** A segmented control. With `tabs` it is a tablist (arrow keys move the selection); otherwise a group of pressed buttons. */
export function Seg<K extends string>({ items, value, onChange, tabs, className, ...rest }: PassProps & { items: SegItem<K>[]; value: K; onChange: (key: K) => void; tabs?: boolean; className?: string }) {
  const p = { items, value, onChange, tabs }
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
    <div className={cx('fo-seg', className)} role={p.tabs ? 'tablist' : 'group'} {...rest} onKeyDown={onKey}>
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
