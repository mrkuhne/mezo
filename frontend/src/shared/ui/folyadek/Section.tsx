import type { ReactNode } from 'react'

/** A heading with the numbered drop badge. */
export function Section(p: { n?: number; title: string; link?: ReactNode; className?: string }) {
  return (
    <h2 className={p.className ? `fo-sec ${p.className}` : 'fo-sec'}>
      {p.n != null && <b>{p.n}</b>}
      <span>{p.title}</span>
      {p.link != null && <span className="fo-sec-link">{p.link}</span>}
    </h2>
  )
}
