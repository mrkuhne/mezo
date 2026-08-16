import { strengthSeries } from '@/features/insights/logic/patternHistory'
import type { PatternEvent } from '@/data/types'

// viewBox geometry — mirrors the approved mockup (spec: 2026-08-14-patterns-dashboard-redesign-mockup.html, screen 2).
const W = 340
const H = 150
const X_START = 52
const X_END = 310
const GUIDE_X0 = 36
const GUIDE_X1 = 330
const LABEL_Y = 140

// Calibrated against the two named guides so the |r| axis reads honestly at a glance —
// "érezhető" (0.3) and "határozott" (0.6) sit exactly on their dashed lines.
const Y_AT_03 = 100
const Y_AT_06 = 48
const SLOPE = (Y_AT_06 - Y_AT_03) / (0.6 - 0.3)
const Y_MIN = 14
const Y_MAX = 138

function yForAbsR(absR: number): number {
  const y = Y_AT_03 + (absR - 0.3) * SLOPE
  return Math.min(Y_MAX, Math.max(Y_MIN, y))
}

const HU_MONTHS = ['jan', 'feb', 'már', 'ápr', 'máj', 'jún', 'júl', 'aug', 'szep', 'okt', 'nov', 'dec']

function tickLabel(iso: string): string {
  const [, m, d] = iso.split('-').map(Number)
  return `${HU_MONTHS[m - 1]} ${d}`
}

/**
 * Hand-drawn strength-over-time chart (mezo-tk88.5) — |r| per snapshot, dashed guides at the
 * "érezhető"/"határozott" bands, the confirm point picked out in accent. `null` on fewer than 2
 * points; the page shows the empty-state copy instead (Task 13).
 */
export function PatternStrengthChart({ events }: { events: PatternEvent[] }) {
  const points = strengthSeries(events)
  if (points.length < 2) return null

  const xFor = (i: number) =>
    points.length === 1 ? X_START : X_START + (i * (X_END - X_START)) / (points.length - 1)

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i)} ${yForAbsR(p.absR)}`).join(' ')

  const first = points[0]
  const last = points[points.length - 1]

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: '100%', height: 'auto' }}
      role="img"
      aria-label={`A jel erőssége ${first.absR.toFixed(2)}-ról ${last.absR.toFixed(2)}-ra változott ${tickLabel(first.date)} és ${tickLabel(last.date)} között`}
    >
      <line x1={GUIDE_X0} y1={Y_AT_03} x2={GUIDE_X1} y2={Y_AT_03} stroke="var(--border-strong)" strokeWidth="1" strokeDasharray="3 4" />
      <line x1={GUIDE_X0} y1={Y_AT_06} x2={GUIDE_X1} y2={Y_AT_06} stroke="var(--border-strong)" strokeWidth="1" strokeDasharray="3 4" />
      <text x={GUIDE_X1} y={Y_AT_03 - 6} fill="var(--text-disabled)" fontSize="8.5" textAnchor="end">érezhető · 0.3</text>
      <text x={GUIDE_X1} y={Y_AT_06 - 6} fill="var(--text-disabled)" fontSize="8.5" textAnchor="end">határozott · 0.6</text>

      <path d={linePath} fill="none" stroke="var(--success-base)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

      {points.map((p, i) => {
        const cx = xFor(i)
        const cy = yForAbsR(p.absR)
        if (p.kind === 'confirmed') {
          return (
            <g key={`${p.date}-${p.kind}`}>
              <circle cx={cx} cy={cy} r={8} fill="none" stroke="var(--accent-base)" strokeWidth="2" />
              <circle cx={cx} cy={cy} r={5} fill="var(--accent-base)" />
            </g>
          )
        }
        return <circle key={`${p.date}-${p.kind}`} cx={cx} cy={cy} r={4} fill="var(--success-base)" />
      })}

      {points.map((p, i) => (
        <text
          key={`label-${p.date}-${p.kind}`}
          x={xFor(i)}
          y={LABEL_Y}
          fill={p.kind === 'confirmed' ? 'var(--accent-base)' : 'var(--text-disabled)'}
          fontSize="9"
          fontWeight={p.kind === 'confirmed' ? 700 : 400}
          textAnchor="middle"
        >
          {tickLabel(p.date)}
          {p.kind === 'confirmed' ? ' ✓' : ''}
        </text>
      ))}
    </svg>
  )
}
