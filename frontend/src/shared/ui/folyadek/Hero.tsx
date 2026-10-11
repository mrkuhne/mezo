import type { HTMLAttributes, ReactNode } from 'react'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'
import { cx } from './util'

export interface HeroProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  label?: ReactNode; verdict: ReactNode; sub?: ReactNode; warn?: boolean; children?: ReactNode; actions?: ReactNode
  /** A graphic (Badge / Jar / Bub) beside label + verdict + sub (prototype `hero({left})`). */
  left?: ReactNode
  /** The big tilted glyph in the top right corner of a hero that has no graphic of its own (prototype `hero({art})`, `.fh-art`). */
  art?: Icon3DName
  /** The verdict one size up — a session's or a plan's name is the verdict (prototype `hero({big:true})`). */
  big?: boolean
}

/** The ONE thing to look at: a vessel whose action row (or closing strip) is the liquid. Passes `id`, `role`, `data-*`, `aria-*` through.
 *  A `Note` among the `actions` is the quiet white line on the liquid, under the buttons. */
export function Hero({ label, verdict, sub, warn, left, art, big, children, actions, className, ...rest }: HeroProps) {
  const text = (
    <>
      {label != null && label !== '' && <span className="fo-hero-lbl">{label}</span>}
      <p className="fo-hero-verdict">{verdict}</p>
      {sub != null && sub !== false && sub !== '' && <p className="fo-hero-sub">{sub}</p>}
    </>
  )
  return (
    <section className={cx('fo-card fo-hero', warn && 'warn', big && 'big', art && 'has-art', className)} data-closed={actions ? 'false' : 'true'} {...rest}>
      {art && <span className="fo-hero-art" aria-hidden="true"><Icon3D name={art} size={96} /></span>}
      {left != null && left !== false
        ? <div className="fo-hero-row"><span className="fo-hero-left">{left}</span><div className="fo-hero-tx">{text}</div></div>
        : text}
      {children}
      {actions && <div className="fo-hero-acts">{actions}</div>}
    </section>
  )
}

/** The hero's graphic slot, under the text (prototype `.vs-hg`): tubes, a curve, a body. `wide` lets a curve reach the edges (`.ar`). */
export function HeroGraphic({ wide, className, ...rest }: HTMLAttributes<HTMLDivElement> & { wide?: boolean }) {
  return <div className={cx('fo-hero-g', wide && 'ar', className)} {...rest} />
}

/** The captions under a graphic (prototype `.vs-ft`): start · (middle) · end. */
export function Ft({ items, className }: { items: ReactNode[]; className?: string }) {
  return <div className={cx('fo-ft', className)}>{items.map((x, i) => <span key={i}>{x}</span>)}</div>
}
