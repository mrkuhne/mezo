import type { ReactNode } from 'react'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'

/** S6 (mezo-d6ivw.6): a collapsible topic group (prototype `grp()`) — a flat fold button, the
 *  body mounted only while open. The caller owns `open` (search auto-opens hit groups). */
export function HubFold({ id, icon, label, count, hint, open, onToggle, children }: {
  id: string
  icon: Icon3DName
  label: string
  count: string
  hint?: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <>
      <button type="button" className="th-fold" data-g={id} aria-expanded={open} onClick={onToggle}>
        <Icon3D name={icon} size={22} />
        <span>{label} · {count}{hint ? <small>{hint}</small> : null}</span>
        <span className="th-fold-chev" aria-hidden="true">{open ? '⌃' : '⌄'}</span>
      </button>
      {open && children}
    </>
  )
}
