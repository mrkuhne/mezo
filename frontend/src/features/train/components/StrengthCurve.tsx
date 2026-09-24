// ============================================================
// Mezo · StrengthCurve („Az erőd íve") — Train parity P2 Task 5 (mezo-lf3cv).
// The exercise story's one graphic: the backend's `e1rmSeries` (ExerciseRecord-
// Response, Task 2) drawn as the prototype's `.gy-curve` line
// (docs/design_2.0/prototypes/companion-titanium/gyak-pages.js `curve()`:55-68).
//
// THREE deliberate departures from the prototype, all in the direction of honesty:
//
// 1. NO DASHED BRANCH. The prototype draws a second, dashed polyline for
//    `history.projected` — „a terv várakozása". Production has no model that
//    forecasts an e1RM, so there is nothing to draw and nothing is drawn. The
//    caption says what the line IS (what has happened) instead of promising a
//    future, and names the estimate („becslés, nem mérés").
//
// 2. THE X AXIS IS TIME, NOT INDEX. The prototype spaces points evenly
//    (`step = w / (points.length - 1)`), which is only truthful for a gapless
//    series. Task 2's wire OMITS a session with no eligible set rather than
//    emitting a zero, so even spacing would silently redraw a three-week hole as
//    one ordinary week-to-week step. Here x is the point's DATE, mapped over the
//    series' own span, so a hole is a wide, flat stretch — the time it really was.
//
// 3. A REAL GAP BREAKS THE LINE. A time axis alone still draws ink across the
//    hole, which reads as „I was measured the whole way, just slowly". So an
//    interval longer than `GAP_FACTOR` × the series' own MEDIAN interval starts a
//    new polyline: the stroke stops at the last measurement and resumes at the
//    next one. The factor is relative (not a fixed „14 days") because a series'
//    normal cadence is whatever that exercise's own rhythm is — twice a week or
//    once a month — and a gap only means anything against that rhythm. A
//    segment left with a single point still gets a dot, so no measurement ever
//    disappears just because both its neighbours are far away.
//
//    WHERE THE MEDIAN RULE IS WEAK: on a very short series the median is pulled
//    up by the gap itself. With three points the median of TWO intervals is their
//    mean, so the hole is half of its own yardstick and has to be roughly 7× the
//    normal step before the stroke breaks (measured: `[7d, 49d]` still draws
//    continuous, `[7d, 60d]` breaks). Under-breaking is the safer direction —
//    an unbroken line over a hole understates a story the reader can still read
//    off the time axis (the flat stretch is there either way), while breaking too
//    eagerly on three points would invent a hole out of an ordinary cadence.
//
// Under two points there is no line to draw and none is faked: the component
// says so in one sentence (0 points and 1 point say different, true things).
//
// Üveg (mezo-me75u.4): the drawn curve is ONE glass card (`.gy-curve-box.glass`) whose
// `--c` is the caller's inherited `--mus-color`, the line glowing in it (the svg keeps
// `overflow: visible` so the glow is not clipped to the box). The two honest sentences
// stay plain text — glass around "nothing to draw" would promise a graphic.
// ============================================================
import type { E1rmPoint } from '@/data/train/trainApi'
import { hu1 } from '@/shared/lib/huNum'
import { huMonthDayAged } from '@/shared/lib/dates'

/** Prototype geometry, verbatim (`curve()`): the 300×76 box and its 8/20 insets. */
const W = 300
const H = 76
const PAD_BOTTOM = 8
const PLOT_H = H - 20

/** An interval this many times the series' own median interval is a GAP, not a step. */
const GAP_FACTOR = 1.75

const dayNumber = (iso: string): number => {
  const [y, m, d] = iso.split('-').map(Number)
  return Math.round(Date.UTC(y, (m ?? 1) - 1, d ?? 1) / 86_400_000)
}

const median = (xs: readonly number[]): number => {
  const sorted = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/**
 * Split the series where the calendar gap between two consecutive points is out of
 * character for the series itself (see note 3 above). Exported for the test — the rule
 * is the honest part of this component, so it is asserted directly rather than through
 * pixel coordinates.
 */
export function splitOnGaps(points: readonly E1rmPoint[]): E1rmPoint[][] {
  if (points.length < 2) return points.length ? [[...points]] : []
  const days = points.map((p) => dayNumber(p.date))
  const intervals = days.slice(1).map((d, i) => d - days[i])
  const limit = GAP_FACTOR * median(intervals)
  const segments: E1rmPoint[][] = [[points[0]]]
  for (let i = 1; i < points.length; i++) {
    if (intervals[i - 1] > limit) segments.push([points[i]])
    else segments[segments.length - 1].push(points[i])
  }
  return segments
}

export interface StrengthCurveProps {
  /** Task 2's wire series — OLDEST FIRST, gaps omitted (never zeroed). */
  points: readonly E1rmPoint[]
}

export function StrengthCurve({ points }: StrengthCurveProps) {
  if (points.length === 0) {
    return (
      <p className="pl-foot-say">
        Ehhez a gyakorlathoz még nincs becsülhető maximumod — az ív az első terhelt szettjeid után rajzolódik ki.
      </p>
    )
  }
  if (points.length === 1) {
    // One point is a dot, not a trend. Drawing a flat line through it would claim a
    // history of holding a level that was measured exactly once.
    return (
      <p className="pl-foot-say">
        Egyetlen becslésed van eddig ({huMonthDayAged(points[0].date)} · {hu1(points[0].e1rm)} kg) — a vonal a másodiktól kezd ívelni.
      </p>
    )
  }

  const values = points.map((p) => p.e1rm)
  const low = Math.min(...values)
  const span = Math.max(...values) - low || 1
  const days = points.map((p) => dayNumber(p.date))
  const t0 = days[0]
  const tSpan = days[days.length - 1] - t0 || 1

  const x = (iso: string) => ((dayNumber(iso) - t0) / tSpan) * W
  const y = (v: number) => H - PAD_BOTTOM - ((v - low) / span) * PLOT_H
  const at = (p: E1rmPoint) => `${x(p.date).toFixed(1)},${y(p.e1rm).toFixed(1)}`

  const segments = splitOnGaps(points)
  const last = points[points.length - 1]
  const first = points[0]
  const gaps = segments.length - 1

  return (
    <div className="gy-curve-box glass">
      <span className="gy-curve-val">
        {/* The LATEST estimate, not the best one — this is „hol tartasz most". The
            record itself is the „BECSÜLT 1RM" card above. */}
        <b>{hu1(last.e1rm)}</b>
        <small>kg most</small>
      </span>
      <svg
        className="gy-curve"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={
          `Becsült maximumod alakulása ${huMonthDayAged(first.date)} óta: ${points.length} mérés, ` +
          `${hu1(first.e1rm)} kg-tól ${hu1(last.e1rm)} kg-ig` +
          (gaps > 0 ? `, ${gaps} kihagyott időszakkal — ott a vonal megszakad.` : '.')
        }
      >
        {segments.map((seg, i) =>
          seg.length > 1 ? (
            <polyline key={i} className="gy-curve-was" points={seg.map(at).join(' ')} />
          ) : (
            // A measurement stranded between two gaps — a dot, so it is not lost.
            <circle key={i} className="gy-curve-now" cx={x(seg[0].date)} cy={y(seg[0].e1rm)} r={3} />
          ),
        )}
        <circle className="gy-curve-now" cx={x(last.date)} cy={y(last.e1rm)} r={4} />
      </svg>
      <span className="gy-curve-cap">
        <i>ami eddig megtörtént · {huMonthDayAged(first.date)} óta</i>
        <i>becslés, nem mérés</i>
      </span>
    </div>
  )
}
