import type { ReactNode } from 'react'
import { clamp, useSvgId } from './util'

/** ANY silhouette filled with liquid to pct (a bowl, a moon, a glass, a heart…). The path lives in `viewBox`
 *  (default 0 0 100 100); children are drawn above the liquid. Clip + gradient ids are unique per instance. */
export function Fill(p: { d: string; viewBox?: string; pct: number; size?: number; color?: string; color2?: string; className?: string; children?: ReactNode }) {
  const id = useSvgId('fofill')
  const vb = p.viewBox ?? '0 0 100 100'
  const [x, y, w, h] = vb.split(' ').map(Number)
  const ly = y + h * (1 - clamp(p.pct) / 100)
  const a = w / 8
  const wave = `M${x - w} ${ly} q${a / 2} ${-h / 36} ${a} 0${` t${a} 0`.repeat(15)} V${y + h} H${x - w}Z`
  return (
    <svg className={p.className ? `fo-fill ${p.className}` : 'fo-fill'} viewBox={vb} style={{ width: p.size ?? 120 }} aria-hidden="true">
      <defs>
        <clipPath id={id}><path d={p.d} /></clipPath>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.color ?? 'var(--liq1)'} />
          <stop offset="1" stopColor={p.color2 ?? 'var(--liq2)'} />
        </linearGradient>
      </defs>
      <path d={p.d} fill="#fff" stroke="rgba(10,42,60,.10)" strokeWidth={w / 60} />
      <g clipPath={`url(#${id})`}><g className="fo-fill-wv"><path fill={`url(#${id}g)`} d={wave} /></g></g>
      <path d={p.d} fill="none" stroke="rgba(255,255,255,.55)" strokeWidth={w / 90} />
      {p.children}
    </svg>
  )
}
