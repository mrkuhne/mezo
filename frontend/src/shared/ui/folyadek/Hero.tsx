import type { ReactNode } from 'react'

/** The ONE thing to look at: a vessel whose action row (or closing strip) is the liquid. */
export function Hero(p: { label?: string; verdict: ReactNode; sub?: ReactNode; warn?: boolean; children?: ReactNode; actions?: ReactNode }) {
  return (
    <section className={p.warn ? 'fo-card fo-hero warn' : 'fo-card fo-hero'} data-closed={p.actions ? 'false' : 'true'}>
      {p.label && <span className="fo-hero-lbl">{p.label}</span>}
      <p className="fo-hero-verdict">{p.verdict}</p>
      {p.sub && <p className="fo-hero-sub">{p.sub}</p>}
      {p.children}
      {p.actions && <div className="fo-hero-acts">{p.actions}</div>}
    </section>
  )
}
