import type { HTMLAttributes, ReactNode } from 'react'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'
import { Acts, Btn, Lk } from './Btn'
import { Bub } from './Bub'
import { cx, type PassProps } from './util'

/** A status pill with its leading dot. q = quiet, plan = planned, ok / warn / bad = state. */
export function St(p: { tone?: 'q' | 'ok' | 'warn' | 'bad' | 'plan'; className?: string; children: ReactNode }) {
  return <span className={cx('fo-st', p.tone ?? 'q', p.className)}>{p.children}</span>
}

/** Quiet info chips (each with a small drop), with an optional lead label. */
export function Chips(p: { items: ReactNode[]; lead?: ReactNode; className?: string }) {
  return (
    <div className={cx('fo-chips', p.className)}>
      {p.lead != null && <b>{p.lead}</b>}
      {p.items.map((x, i) => <span key={i}>{x}</span>)}
    </div>
  )
}

/** A fact strip: big value over a small caption, 2–4 across. */
export function Facts(p: { items: [ReactNode, ReactNode][]; className?: string }) {
  return (
    <div className={cx('fo-facts', p.className)} style={{ gridTemplateColumns: `repeat(${p.items.length},1fr)` }}>
      {p.items.map(([big, small], i) => <div key={i}><b>{big}</b><small>{small}</small></div>)}
    </div>
  )
}

/** A faint footnote under a card's content. */
export function Note({ className, ...rest }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cx('fo-note', className)} {...rest} />
}

/** Body text. */
export function Txt({ className, ...rest }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cx('fo-txt', className)} {...rest} />
}

/** The "why" callout: a tinted line with a small bubble icon in front. */
export function Why({ icon, className, children, ...rest }: PassProps & { icon: Icon3DName; className?: string; children: ReactNode }) {
  return <p className={cx('fo-txt fo-why', className)} {...rest}><Bub icon={icon} size={24} /><span>{children}</span></p>
}

/** A field label (a real `<label>` when `htmlFor` is given). */
export function Lab(p: { htmlFor?: string; id?: string; className?: string; children: ReactNode }) {
  return p.htmlFor
    ? <label htmlFor={p.htmlFor} id={p.id} className={cx('fo-lab', p.className)}>{p.children}</label>
    : <span id={p.id} className={cx('fo-lab', p.className)}>{p.children}</span>
}

/** The empty state: icon, a sentence, optional actions. */
export function Empty(p: { icon?: Icon3DName; actions?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <div className={cx('fo-empty', p.className)}>
      {p.icon && <Icon3D name={p.icon} size={44} />}
      {p.children}
      {p.actions != null && <Acts center>{p.actions}</Acts>}
    </div>
  )
}

/** A load-error row: the info glyph, the message, a retry button. */
export function ErrorRow(p: { message: ReactNode; onRetry?: () => void; retryLabel?: string }) {
  return (
    <div className="fo-row" role="alert">
      <span className="si"><Icon3D name="t-info" size={26} /></span>
      <span className="g"><strong>{p.message}</strong></span>
      {p.onRetry && <Btn sm ghost onClick={p.onRetry}>{p.retryLabel ?? 'Újra'}</Btn>}
    </div>
  )
}

/** A card header: icon bubble, title, optional link on the right. */
export function Head(p: { icon?: Icon3DName; title: ReactNode; titleId?: string; link?: ReactNode; onLink?: () => void }) {
  return (
    <div className="fo-head">
      {p.icon && <Bub icon={p.icon} size={40} />}
      <h3 id={p.titleId}>{p.title}</h3>
      {p.link != null && (p.onLink ? <Lk onClick={p.onLink}>{p.link} ›</Lk> : <span className="fo-head-link">{p.link}</span>)}
    </div>
  )
}
