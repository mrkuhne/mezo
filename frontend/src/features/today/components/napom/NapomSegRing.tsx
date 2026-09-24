// A napom · the six-segment day ring (prototype uveg-napod-body.html `segRing()`, owner OK
// 2026-09-24). One arc per dimension in `DAY_DIMENSIONS` order, each in its own `--dv-*` hue
// with the kit's glow; the lit core in the middle carries whatever the page puts there (N/6 on
// an open day, the gradient numeral on a scored one, the honest "számolom" while loading).
import type { CSSProperties, ReactNode } from 'react'

export interface SegRingSegment {
  /** 0–100 fill of this dimension's arc. */
  pct: number
  /** The arc's colour — a `var(--dv-*)` token. */
  color: string
}

const R = 42
const GAP = 3.2

export function NapomSegRing({ segments, label, children }: {
  segments: readonly SegRingSegment[]
  /** The ring's accessible name — the centre's meaning in words, never a bare numeral. */
  label: string
  children?: ReactNode
}) {
  const n = segments.length
  const seg = 100 / n - GAP
  return (
    <div className="napom-segring" role="img" aria-label={label}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        {segments.map(({ pct, color }, i) => {
          const off = -(i * (100 / n) + GAP / 2)
          const fill = seg * Math.min(1, Math.max(0, pct) / 100)
          return (
            <g key={i} style={{ '--c': color } as CSSProperties}>
              <circle className="napom-seg-t" cx="50" cy="50" r={R} pathLength={100}
                strokeDasharray={`${seg} ${100 - seg}`} strokeDashoffset={off} />
              {/* No progress → the track alone: a round cap on a ~0-length dash would draw a dot. */}
              {fill > 0 && (
                <circle className="napom-seg-p" cx="50" cy="50" r={R} pathLength={100}
                  strokeDasharray={`${fill} ${100 - fill}`} strokeDashoffset={off} />
              )}
            </g>
          )
        })}
      </svg>
      <div className="napom-core">{children}</div>
    </div>
  )
}
