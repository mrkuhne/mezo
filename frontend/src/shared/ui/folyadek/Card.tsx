import type { ReactNode } from 'react'

export function Card(p: { className?: string; children: ReactNode }) {
  return <section className={p.className ? `fo-card ${p.className}` : 'fo-card'}>{p.children}</section>
}
