import type { HTMLAttributes, ReactNode } from 'react'
import { cx } from './util'

export interface HeroProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  label?: ReactNode; verdict: ReactNode; sub?: ReactNode; warn?: boolean; children?: ReactNode; actions?: ReactNode
  /** A graphic (Badge / Jar / Bub) beside label + verdict + sub (prototype `hero({left})`). */
  left?: ReactNode
}

/** The ONE thing to look at: a vessel whose action row (or closing strip) is the liquid. Passes `id`, `role`, `data-*`, `aria-*` through. */
export function Hero({ label, verdict, sub, warn, left, children, actions, className, ...rest }: HeroProps) {
  const text = (
    <>
      {label != null && label !== '' && <span className="fo-hero-lbl">{label}</span>}
      <p className="fo-hero-verdict">{verdict}</p>
      {sub != null && sub !== false && sub !== '' && <p className="fo-hero-sub">{sub}</p>}
    </>
  )
  return (
    <section className={cx('fo-card fo-hero', warn && 'warn', className)} data-closed={actions ? 'false' : 'true'} {...rest}>
      {left != null && left !== false
        ? <div className="fo-hero-row"><span className="fo-hero-left">{left}</span><div className="fo-hero-tx">{text}</div></div>
        : text}
      {children}
      {actions && <div className="fo-hero-acts">{actions}</div>}
    </section>
  )
}
