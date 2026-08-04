import { cn } from '@/shared/lib/cn'

export interface TrendSeries {
  /** Legend name */
  name: string
  /** Y values, evenly spaced along X; null gaps are skipped */
  points: Array<number | null>
  /** CSS color — a data-viz token per the DS band rules */
  color: string
  /** Dashed rendering (e.g. plan trajectory vs actual) */
  dashed?: boolean
  /** Soft area fill under the line (first/actual series only, typically) */
  area?: boolean
}

const W = 360
const H = 140
const PAD = 6

function toPath(points: Array<number | null>, min: number, max: number): string {
  const span = max - min || 1
  const step = points.length > 1 ? W / (points.length - 1) : 0
  let d = ''
  points.forEach((v, i) => {
    if (v == null) return
    const x = i * step
    const y = PAD + (H - 2 * PAD) * (1 - (v - min) / span)
    d += (d === '' ? 'M' : ' L') + `${x.toFixed(1)} ${y.toFixed(1)}`
  })
  return d
}

/**
 * SVG trend-chart primitive (DS §TrendChart) — no charting library. Renders
 * 1–3 series over dashed gridlines; series colors come from the data-viz band
 * (var(--dv-*) / var(--macro-*)), never from UI-role tokens. Legend below.
 * The Y domain spans all series (plus optional explicit min/max).
 */
export function TrendChart({ series, min, max, legend = true, ariaLabel, className }: {
  series: TrendSeries[]
  min?: number
  max?: number
  legend?: boolean
  ariaLabel: string
  className?: string
}) {
  const values = series.flatMap(s => s.points.filter((v): v is number => v != null))
  const lo = min ?? Math.min(...values)
  const hi = max ?? Math.max(...values)
  const gradId = `tc-${series[0]?.name?.replace(/\W/g, '') ?? 'g'}`
  return (
    <div className={cn(className)}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label={ariaLabel} style={{ display: 'block' }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={series[0]?.color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={series[0]?.color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map(f => (
          <line key={f} x1="0" y1={H * f} x2={W} y2={H * f} stroke="var(--divider)" strokeDasharray="3,3" />
        ))}
        {series.map(s => {
          const d = toPath(s.points, lo, hi)
          if (d === '') return null
          return (
            <g key={s.name}>
              {s.area && <path d={`${d} L ${W} ${H} L 0 ${H} Z`} fill={`url(#${gradId})`} />}
              <path
                d={d}
                fill="none"
                stroke={s.color}
                strokeWidth={s.dashed ? 2 : 2.5}
                strokeDasharray={s.dashed ? '4,4' : undefined}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          )
        })}
      </svg>
      {legend && (
        <div className="adher-legend" style={{ paddingTop: 10, borderTop: '1px dashed var(--divider)' }}>
          {series.map(s => (
            <span key={s.name} className="adher-key">
              <span className="swatch" style={{ background: s.color, height: 2, width: 12 }} aria-hidden="true" />
              <span className="name">{s.name}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
