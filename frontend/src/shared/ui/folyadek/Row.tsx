import type { ReactNode } from 'react'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'

const Chev = () => (
  <svg className="chev" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
)

/** A list row: bubble icon, title + sub, value, optional right slot; a button when clickable. */
export function Row(p: { icon?: Icon3DName; title: ReactNode; sub?: ReactNode; value?: ReactNode; right?: ReactNode; onClick?: () => void }) {
  const inner = (
    <>
      {p.icon && <span className="si"><Icon3D name={p.icon} size={26} /></span>}
      <span className="g"><strong>{p.title}</strong>{p.sub != null && <small>{p.sub}</small>}</span>
      {p.value != null && <span className="v">{p.value}</span>}
      {p.right}
      {p.onClick && p.right == null && <Chev />}
    </>
  )
  return p.onClick
    ? <button type="button" className="fo-row" onClick={p.onClick}>{inner}</button>
    : <div className="fo-row">{inner}</div>
}
