import type { CSSProperties } from 'react'
import { clamp, useSvgId } from './util'

const SHAPE = 'M50 5C72 5 92 20 93 44 94 70 76 95 50 95 24 95 6 70 7 44 8 20 28 5 50 5Z'

/** One of the five domain drops (bottom bar, switcher, header orb): a calm round shell with a liquid level. */
export function Drop(p: { pct: number; color: string; size?: number; alive?: boolean }) {
  const id = useSvgId('fodrop')
  const y = 100 - clamp(p.pct, 6, 100)
  const d = `M-20 ${y} Q-10 ${y - 4} 0 ${y} T20 ${y} T40 ${y} T60 ${y} T80 ${y} T100 ${y} T120 ${y} T140 ${y} V110 H-20Z`
  return (
    <span className={p.alive ? 'fo-drop alive' : 'fo-drop'} style={{ '--s': `${p.size ?? 48}px`, '--c': p.color } as CSSProperties}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <defs>
          <clipPath id={id}><path d={SHAPE} /></clipPath>
          <radialGradient id={`${id}s`} cx="35%" cy="25%" r="75%">
            <stop offset="0" stopColor="#fff" stopOpacity=".45" /><stop offset=".5" stopColor="#fff" stopOpacity=".06" /><stop offset="1" stopColor="#000" stopOpacity=".35" />
          </radialGradient>
        </defs>
        <g className="body">
          <path className="shell" d={SHAPE} />
          <g clipPath={`url(#${id})`}><g className="wave"><path className="liq" d={d} /></g></g>
          <path className="sheen" d={SHAPE} fill={`url(#${id}s)`} />
          <path className="hi" d="M28 24 Q36 14 48 12" />
        </g>
      </svg>
    </span>
  )
}
