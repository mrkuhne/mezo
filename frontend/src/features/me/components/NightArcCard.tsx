import type { SleepEntry } from '@/data/types'
import { PhaseRail } from '@/features/me/components/PhaseRail'
import {
  deepFrontLoadPct, halfNightSplit, parseHypnogram, type Stage,
} from '@/features/me/logic/sleepPhases'

/** How far each stage dips from the top baseline. Deep hangs lowest — the same reading
 *  direction as the tracker's own curve; an upward silhouette would invert the metaphor
 *  and make "deep" look like "more". */
const DEPTH: Record<Stage, number> = { A: 0.2, R: 0.52, L: 0.74, D: 1 }
const COLOR: Record<Stage, string> = {
  A: 'var(--ph-awake)', R: 'var(--ph-rem)', L: 'var(--ph-light)', D: 'var(--ph-deep)',
}

const W = 400
const H = 132
const TOP = 4
const AXIS_H = 18
const INNER_H = H - TOP - AXIS_H
/** Hour ticks nearer than this to either end would collide with the bed/wake labels. */
const EDGE_GUARD_MIN = 26

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/**
 * Hour ticks across the (possibly midnight-crossing) span. Walks absolute minutes from the
 * next full hour after `startMin` — never re-derives an hour from a wrapped local clock — so
 * a 23:15 bedtime still yields an ascending 00, 01, 02… sequence instead of looping back
 * through 23. Both ends are guarded so a tick never collides with the pinned bed/wake labels.
 */
function hourTicks(startMin: number, spanMin: number) {
  const ticks: { x: number; label: string }[] = []
  for (let m = Math.ceil(startMin / 60) * 60; m <= startMin + spanMin; m += 60) {
    const offset = m - startMin
    if (offset < EDGE_GUARD_MIN || offset > spanMin - EDGE_GUARD_MIN) continue
    ticks.push({
      x: (offset / spanMin) * W,
      label: String(Math.floor(m / 60) % 24).padStart(2, '0'),
    })
  }
  return ticks
}

/**
 * "Az éjszaka íve" (mezo-fk9a) — the quantised hypnogram as a hanging depth silhouette,
 * plus the two half-night rails and the front-load sentence. Returns null when the row has
 * no valid hypnogram, so callers need no guard. Üveg (mezo-me75u.6): a lavender glass card,
 * the silhouette glows (`.alv-page .nac-bars` in the `── uveg en alvas (` block).
 */
export function NightArcCard({ entry }: { entry: SleepEntry }) {
  const stages = parseHypnogram(entry)
  if (!stages) return null

  const bucketMin = entry.hypnogram?.bucketMin ?? 15
  const spanMin = stages.length * bucketMin
  const barW = W / stages.length
  const { first, second } = halfNightSplit(stages, bucketMin)
  const frontLoad = deepFrontLoadPct(stages)
  const ticks = hourTicks(toMin(entry.bedtime), spanMin)

  return (
    <div className="nac glass">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', overflow: 'visible' }}
           role="img" aria-label="Az éjszaka lefutása fázisonként">
        <g className="nac-bars">
        {stages.map((s, i) => (
          <rect
            key={i}
            data-stage={s}
            x={i * barW + 0.6}
            y={TOP}
            width={barW - 1.2}
            height={INNER_H * DEPTH[s]}
            rx={Math.min(2.2, barW / 3)}
            fill={COLOR[s]}
            opacity={s === 'A' ? 0.45 : 0.92}
          />
        ))}
        </g>
        {ticks.map(t => (
          <g key={t.label}>
            <line x1={t.x} y1={TOP} x2={t.x} y2={TOP + INNER_H} stroke="var(--divider)" strokeWidth="1" />
            <text data-hour-tick x={t.x} y={H - 5} textAnchor="middle" fontSize="8.5" fontWeight="800" fill="var(--text-muted)">
              {t.label}
            </text>
          </g>
        ))}
        <text x={0} y={H - 5} textAnchor="start" fontSize="8.5" fontWeight="800" fill="var(--text-muted)">
          {entry.bedtime}
        </text>
        <text x={W} y={H - 5} textAnchor="end" fontSize="8.5" fontWeight="800" fill="var(--text-muted)">
          {entry.wakeup}
        </text>
      </svg>

      <div className="nac-halves">
        <span className="nac-eb">
          Első fél
        </span>
        {/* showLegend MUST stay false: `first` is built from hypnogram bucket counts
            (halfNightSplit), and PhaseRail's legend would print a phase % computed from those
            counts — exactly the ADR-0015-banned computation (display-only hypnogram, never a
            ratio statistic). */}
        <div className="nac-rail"><PhaseRail breakdown={first} showLegend={false} /></div>
        <span className="nac-eb">
          Második fél
        </span>
        {/* Same constraint as the first-half rail above — `second` is equally bucket-derived. */}
        <div className="nac-rail"><PhaseRail breakdown={second} showLegend={false} /></div>
      </div>

      {frontLoad != null && (
        <p className="nac-lead">
          A mély alvásod <b>{frontLoad}%-a</b> az éjszaka
          első felében volt — ez a normális minta. A REM a hajnali órákban sűrűsödik, ezért a
          korán kelés aránytalanul azt vágja le.
        </p>
      )}

      <p className="nac-foot">
        A sziluett magassága a fázist kódolja, nem mért mélységet. {bucketMin} perces felbontás.
      </p>
    </div>
  )
}
