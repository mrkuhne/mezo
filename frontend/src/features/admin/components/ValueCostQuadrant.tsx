import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { AdminFeatureRow } from '@/data/admin/adminInsightsApi'
import { valueScore } from '@/features/admin/lib/adminViz'
import { featureLabel } from '@/features/admin/lib/labels'
import { huInt, usd } from '@/shared/lib/huNum'

// Value/cost quadrant (mezo-kxnn Task 2, plan Rulings) — hand-rolled SVG scatter, x = valueScore
// (adminViz.ts), y = sqrt(costUsd) (a raw-dollar y axis would let one very expensive AI feature
// crush every other point into a single row near y=0). Non-system rows only, AND rows with zero
// uses excluded (a used-nothing feature has no honest cost/value reading to plot) — the note
// below the chart says so ("csak a használt funkciók") rather than silently dropping them.
//
// Axis orientation: x grows right (higher value); y is inverted in SCREEN space so a HIGHER cost
// sits nearer the TOP of the chart (`scaleY`) — the intuitive "up and to the right is the
// expensive-and-valuable corner" reading. That makes the four corners, clockwise from
// top-right: high value + high cost ("ezért kérhetünk pénzt" — reader pays for exactly this),
// high value + low cost, bottom-right ("ingyenes csali" — cheap value, hooks people in), low
// value + high cost, top-left ("spórolni itt lehet" — money going somewhere unrewarding), low
// value + low cost, bottom-left ("figyelni" — nothing dramatic yet, just watch it).
//
// Median-split boundary lines (not mean) per the ruling, with the on-screen note
// "a felezővonalak a középértékek" so a reader never mistakes them for a fixed/absolute
// threshold. Point radius scales with `uniqueUsers`; fill color is the row's `kind` (reusing the
// scorecard's own reading, not a fourth palette). `<title>` gives every point a hover tooltip
// (RTL's `getByTitle` finds the child `<title>` element same as an attribute — see the test);
// click navigates to the feature's detail page, same target as a scorecard row's `Link`.
//
// Fix round 1 (visual pass, controller browser check @1440px): the viewBox aspect was ~2:1
// (640×320), and with no height cap on the sp12 tile it rendered ~900px tall, pushing the
// scorecard below the fold — widened to a ~2.4:1 aspect (720×300) AND capped via CSS
// `max-height` (`.ad-quad-svg`, prototype.css) so the tile reads like the other chart tiles.
// The right-side corner captions were clipping ("EZÉRT KÉRHETÜNK PÉ…") even though they already
// used `textAnchor="end"` at `x = W - PAD` — SVG `letter-spacing` (`.cap`'s CSS) adds trailing
// space AFTER the last glyph even under `text-anchor="end"` in some engines, pushing the visible
// glyphs past the anchor point; `CAP_INSET_RIGHT` below adds extra clearance beyond the plot's
// own `PAD` specifically for the caption anchors (the plot lines/points still use `PAD`).
const KIND_COLOR: Record<'ai' | 'domain' | 'both', string> = {
  ai: '#5D4FA0',
  domain: '#4E6B42',
  both: '#C9962E',
}

const W = 720
const H = 300
const PAD = 46
const CAP_INSET_RIGHT = 18

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

export function ValueCostQuadrant({ rows }: { rows: AdminFeatureRow[] }) {
  const navigate = useNavigate()

  const points = useMemo(
    () => rows
      .filter((r) => r.kind !== 'system' && r.uniqueUsers > 0)
      .map((r) => ({ row: r, x: valueScore(r), y: Math.sqrt(r.costUsd) })),
    [rows],
  )

  if (points.length === 0) {
    return (
      <div className="ad-quadrant">
        <p className="ad-mut">Nincs használt funkció ebben az időszakban.</p>
        <p className="ad-mut ad-quad-note">csak a használt funkciók</p>
      </div>
    )
  }

  const xMax = Math.max(...points.map((p) => p.x), 1)
  const yMax = Math.max(...points.map((p) => p.y), 1)
  const userMax = Math.max(...points.map((p) => p.row.uniqueUsers), 1)
  const xMed = median(points.map((p) => p.x))
  const yMed = median(points.map((p) => p.y))

  const scaleX = (x: number) => PAD + (x / xMax) * (W - PAD * 2)
  const scaleY = (y: number) => H - PAD - (y / yMax) * (H - PAD * 2)
  const radius = (uniqueUsers: number) => 5 + (uniqueUsers / userMax) * 11

  return (
    <div className="ad-quadrant">
      <svg
        className="ad-quad-svg"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Érték/költség négyesmátrix"
      >
        <line className="split" x1={scaleX(xMed)} y1={PAD} x2={scaleX(xMed)} y2={H - PAD} />
        <line className="split" x1={PAD} y1={scaleY(yMed)} x2={W - PAD} y2={scaleY(yMed)} />
        <text className="cap" x={W - PAD - CAP_INSET_RIGHT} y={PAD + 14} textAnchor="end">ezért kérhetünk pénzt</text>
        <text className="cap" x={W - PAD - CAP_INSET_RIGHT} y={H - PAD - 8} textAnchor="end">ingyenes csali</text>
        <text className="cap" x={PAD} y={PAD + 14} textAnchor="start">spórolni itt lehet</text>
        <text className="cap" x={PAD} y={H - PAD - 8} textAnchor="start">figyelni</text>
        {points.map(({ row, x, y }) => {
          const label = featureLabel(row.key)
          const kind = row.kind as 'ai' | 'domain' | 'both'
          const cx = scaleX(x)
          const cy = scaleY(y)
          const r = radius(row.uniqueUsers)
          // Naive label placement (no collision solver, per the fix-round ask): to the right of
          // the dot by default, flipped to the left for a dot close enough to the right edge
          // that a right-side label would clip the same way the corner captions did above.
          const nearRightEdge = cx > W - PAD * 1.6
          return (
            <g key={row.key}>
              <circle
                className="pt"
                cx={cx}
                cy={cy}
                r={r}
                fill={KIND_COLOR[kind]}
                onClick={() => navigate(`/admin/features/${row.key}`)}
              >
                <title>
                  {`${label.label}${label.missing ? ' (nincs címke)' : ''} · érték ${huInt(Math.round(x))} · ${usd(row.costUsd)} · ${huInt(row.uniqueUsers)} felhasználó`}
                </title>
              </circle>
              <text
                className="pt-label"
                x={nearRightEdge ? cx - r - 4 : cx + r + 4}
                y={cy + 3}
                textAnchor={nearRightEdge ? 'end' : 'start'}
              >
                {label.label}
              </text>
            </g>
          )
        })}
      </svg>
      <p className="ad-mut ad-quad-note">a felezővonalak a középértékek</p>
      <p className="ad-mut ad-quad-note">csak a használt funkciók</p>
    </div>
  )
}
