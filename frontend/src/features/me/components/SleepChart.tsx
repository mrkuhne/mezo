import { phaseBreakdown } from '@/features/me/logic/sleepPhases'
import type { SleepEntry } from '@/data/types'

type Period = '7d' | '14d'

function sliceForPeriod(entries: SleepEntry[], period: Period): SleepEntry[] {
  return period === '7d' ? entries.slice(-7) : entries.slice(-14)
}

export function SleepChart({
  entries,
  period,
}: {
  entries: SleepEntry[]
  period: Period
}) {
  const data = sliceForPeriod(entries, period)
  if (data.length < 2) return null

  // Drives which legend entries render (FIX 2) — computed once against the whole rendered
  // window so the legend always matches what's actually drawn below it.
  const hasPhaseNight = data.some(d => phaseBreakdown(d) !== null)
  const hasPlainNight = data.some(d => phaseBreakdown(d) === null)

  const W = 380
  const H = 150
  const padX = 8
  const padY = 14
  const innerW = W - padX * 2
  const innerH = H - padY * 2

  // Zero baseline: stacking is only truthful when the bar's height IS the duration.
  // The old truncated scale (min 5.5h) exaggerated differences and cannot carry segments.
  const maxDur = Math.max(9, ...data.map(d => d.duration)) + 0.2

  const barW = (innerW / data.length) * 0.7
  const stepX = innerW / data.length

  const xFor = (i: number) => padX + i * stepX + stepX / 2
  const yForDur = (v: number) => padY + (1 - v / maxDur) * innerH
  const yForQual = (q: number) => padY + (1 - q / 10) * innerH

  const qualPath = data.map((d, i) => (i === 0 ? 'M' : 'L') + xFor(i) + ' ' + yForQual(d.quality)).join(' ')

  return (
    <div className="sch glass">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: 'block', overflow: 'visible' }}>
        <defs>
          <linearGradient id="sleep-bar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--lav)" stopOpacity="0.8" />
            <stop offset="100%" stopColor="var(--lav)" stopOpacity="0.25" />
          </linearGradient>
        </defs>

        {/* Duration bars — split into deep/light/REM where the night carries phase data;
            phase-less nights stay one plain bar so the gaps in the series remain visible. */}
        {data.map((d, i) => {
          const x = xFor(i) - barW / 2
          const top = yForDur(d.duration)
          const total = padY + innerH - top
          const phases = phaseBreakdown(d)
          if (!phases) {
            // Plain bars are provenance, not verdict (whole-branch review FIX 5): they mean
            // "no phase data for this night," never "short" or "low-quality" — that judgement
            // used to live here as an amber `isLow` tint, but the zero baseline already makes
            // duration legible from bar height, and the quality polyline already plots quality
            // explicitly in the same SVG. One constant fill for every phase-less night.
            return (
              <rect key={i} data-plain="" x={x} y={top} width={barW} height={total}
                    fill="url(#sleep-bar)" />
            )
          }
          const stack = [
            { key: 'deep', min: phases.deep, color: 'var(--ph-deep)' },
            { key: 'light', min: phases.light, color: 'var(--ph-light)' },
            { key: 'rem', min: phases.rem, color: 'var(--ph-rem)' },
          ] as const
          let offset = 0
          return (
            <g key={i}>
              {stack.map(s => {
                const h = (s.min / phases.asleep) * total
                const y = top + total - offset - h
                offset += h
                return (
                  <rect key={s.key} data-phase={s.key} x={x} y={y} width={barW} height={h}
                        fill={s.color} opacity={0.9} />
                )
              })}
            </g>
          )
        })}

        {/* Quality line — the amber quality trace glows over the columns (üveg U6) */}
        <path
          className="sch-qline"
          d={qualPath}
          fill="none"
          stroke="var(--dv-amber)"
          strokeWidth="1.8"
        />

        {/* Quality dots */}
        {data.map((d, i) => (
          <circle
            key={i}
            className="sch-qdot"
            cx={xFor(i)}
            cy={yForQual(d.quality)}
            r="3"
            fill="var(--dv-amber)"
            stroke="var(--page)"
            strokeWidth="1.2"
          />
        ))}
      </svg>
      <div className="sch-legend">
        {/* Gated on what's actually on screen (whole-branch review FIX 2): the phase swatches
            named colours that could be absent from every bar in the window, and a plain-bar
            window had no key for the colour it showed. A mixed window — the common case —
            shows both; the quality entry always stays. */}
        {hasPhaseNight && [
          { label: 'mély', color: 'var(--ph-deep)' },
          { label: 'könnyű', color: 'var(--ph-light)' },
          { label: 'REM', color: 'var(--ph-rem)' },
        ].map(l => (
          <div className="sch-lg" key={l.label}>
            <i style={{ background: l.color }} />
            <span>{l.label}</span>
          </div>
        ))}
        {hasPlainNight && (
          <div className="sch-lg">
            <i style={{ background: 'var(--lav)' }} />
            <span>időtartam</span>
          </div>
        )}
        <div className="sch-lg is-q">
          <i style={{ background: 'var(--dv-amber)' }} />
          <span>minőség 1-10</span>
        </div>
      </div>
    </div>
  )
}
