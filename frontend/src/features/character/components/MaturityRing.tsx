// ============================================================
// Mezo · Karakter — MaturityRing (mezo-1gim.13)
// Source: karakter-body.html `buildRing()` — a 7-segment SVG ring, one arc per
// CORE dimension, expert domain-color, arc length = maturity/100, center
// count-up % (the aggregate "érettség"). v1 renders the ring only — NO
// self-portrait line under it (spec: non-v1, backend doesn't serve one yet).
// ============================================================
import type { CSSProperties } from 'react'
import { useCountUp } from '@/shared/ui/mozaik/motion'
import { expertColor } from '@/features/character/expertColors'
import type { CharacterDimensionSummary } from '@/data/character/characterApi'

export interface MaturityRingProps {
  /** The dossier's dimensions — only the CORE ones (max 7) draw an arc; a CHAPTER
   *  dimension, if present, is ignored (the ring is the 7 core-domain hero, verbatim). */
  dimensions: CharacterDimensionSummary[]
  /** 148px in the 330px prototype frame -> 175 at ×1.18 (EnHubPage's convention). */
  size?: number
}

export function MaturityRing({ dimensions, size = 175 }: MaturityRingProps) {
  const core = dimensions.filter((d) => d.kind === 'CORE').slice(0, 7)
  const avg = core.length > 0 ? Math.round(core.reduce((sum, d) => sum + d.maturity, 0) / core.length) : 0
  const swept = useCountUp(avg, 900)

  const cx = size / 2
  const cy = size / 2
  const r = size * 0.34
  const circumference = 2 * Math.PI * r
  const n = 7
  const gap = circumference * 0.018
  const seg = circumference / n

  return (
    <div className="kr-ring" style={{ width: size, height: size } as CSSProperties} role="img"
      aria-label={`Karakter érettség: ${avg}%`}>
      <svg viewBox={`0 0 ${size} ${size}`}>
        <g transform={`rotate(-90 ${cx} ${cy})`}>
          <circle className="kr-segbg" cx={cx} cy={cy} r={r} strokeWidth={10} />
          {core.map((d, i) => {
            const slot = seg - gap
            const filled = slot * (d.maturity / 100)
            const offset = -(i * seg)
            return (
              <circle
                key={d.key}
                className="kr-seg"
                style={{ '--sd': `${i * 90}ms` } as CSSProperties}
                cx={cx}
                cy={cy}
                r={r}
                stroke={expertColor(d.expertKey)}
                strokeWidth={10}
                strokeLinecap="round"
                strokeDasharray={`${filled} ${circumference - filled}`}
                strokeDashoffset={offset}
              />
            )
          })}
        </g>
      </svg>
      <div className="kr-hole">
        <div className="num">{swept}%</div>
        <div className="lbl">érettség</div>
      </div>
    </div>
  )
}
