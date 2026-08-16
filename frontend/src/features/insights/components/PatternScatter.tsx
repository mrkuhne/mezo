import { fitLine } from '@/features/insights/logic/patternHistory'
import type { AlignedDay, PatternMonitorPair } from '@/data/types'

// viewBox geometry — mirrors the approved mockup (spec: 2026-08-14-patterns-dashboard-redesign-mockup.html, screen 2).
const W = 340
const H = 190
const AXIS_X0 = 42
const AXIS_X1 = 330
const AXIS_Y0 = 158 // bottom
const AXIS_Y1 = 14 // top
const PLOT_X0 = 56
const PLOT_X1 = 318
const PLOT_Y0 = 138 // low value
const PLOT_Y1 = 32 // high value

/**
 * Hand-drawn scatter of the aligned days behind a pattern pair (mezo-tk88.5) — x = metric A,
 * y = metric B, a least-squares trend line, and the latest day picked out in accent. `null` on
 * fewer than 2 days; the page shows the empty-state copy instead (Task 13).
 */
export function PatternScatter({ days, pair }: { days: AlignedDay[]; pair: PatternMonitorPair }) {
  if (days.length < 2) return null

  const aValues = days.map((d) => d.a)
  const bValues = days.map((d) => d.b)
  const minA = Math.min(...aValues)
  const maxA = Math.max(...aValues)
  const minB = Math.min(...bValues)
  const maxB = Math.max(...bValues)
  const rangeA = maxA - minA || 1
  const rangeB = maxB - minB || 1

  const scaleX = (a: number) => PLOT_X0 + ((a - minA) / rangeA) * (PLOT_X1 - PLOT_X0)
  const scaleY = (b: number) => PLOT_Y0 - ((b - minB) / rangeB) * (PLOT_Y0 - PLOT_Y1)

  const latest = days.reduce((acc, d) => (d.date > acc.date ? d : acc), days[0])
  const fit = fitLine(days)

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: '100%', height: 'auto' }}
      role="img"
      aria-label={`Szórásdiagram: ${pair.metricALabel} és ${pair.metricBLabel} kapcsolata ${days.length} napon`}
    >
      <line x1={AXIS_X0} y1={AXIS_Y0} x2={AXIS_X1} y2={AXIS_Y0} stroke="var(--border-strong)" strokeWidth="1" />
      <line x1={AXIS_X0} y1={AXIS_Y1} x2={AXIS_X0} y2={AXIS_Y0} stroke="var(--border-strong)" strokeWidth="1" />

      {fit && (
        <line
          x1={scaleX(minA)}
          y1={scaleY(fit.slope * minA + fit.intercept)}
          x2={scaleX(maxA)}
          y2={scaleY(fit.slope * maxA + fit.intercept)}
          stroke="var(--primary-base)"
          strokeWidth="2"
          strokeDasharray="6 5"
          opacity="0.85"
        />
      )}

      <g fill="var(--dv-lav)">
        {days.map((d) => (
          <circle key={d.date} cx={scaleX(d.a)} cy={scaleY(d.b)} r="4.5" />
        ))}
      </g>

      <circle cx={scaleX(latest.a)} cy={scaleY(latest.b)} r="8" fill="none" stroke="var(--accent-base)" strokeWidth="2" />

      <text x={AXIS_X0 + 4} y={AXIS_Y0 + 18} fill="var(--text-disabled)" fontSize="9" textAnchor="start">alacsony</text>
      <text x={AXIS_X1} y={AXIS_Y0 + 18} fill="var(--text-disabled)" fontSize="9" textAnchor="end">magas</text>
      <text
        x={14}
        y={(AXIS_Y0 + AXIS_Y1) / 2}
        fill="var(--text-disabled)"
        fontSize="9.5"
        textAnchor="middle"
        transform={`rotate(-90 14 ${(AXIS_Y0 + AXIS_Y1) / 2})`}
      >
        {pair.metricBLabel}
      </text>
    </svg>
  )
}
