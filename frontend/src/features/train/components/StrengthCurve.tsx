// ============================================================
// Mezo · StrengthCurve („Az erőd íve") — Train parity P2 Task 5 (mezo-lf3cv).
// The exercise story's one graphic: the backend's `e1rmSeries` (ExerciseRecord-
// Response, Task 2) originally drawn as the Titanium prototype's curve line
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
// Folyadék (mezo-n4wf5.3, prototype vilagos/edzes.js `exercise()` hero): the curve is the
// kit's liquid `Area` in the muscle's colour — the latest estimate as the big numeral above it,
// the „now" mark (ink point + dashed drop line) on the last point, a gold record drop on the
// points where an estimated-1RM record was set (matched by date from the medals the page
// already holds), month captions under it, and the two honest captions below.
// The kit's `Area` spaces its points EVENLY and cannot break its line, so departures 2 and 3
// above no longer shape the drawing: `splitOnGaps` still counts the out-of-character holes and
// the graphic's spoken label names them, but the surface itself is continuous. The two honest
// sentences (0 points, 1 point) are unchanged.
// ============================================================
import type { E1rmPoint } from '@/data/train/trainApi'
import { hu1 } from '@/shared/lib/huNum'
import { huMonthDay, huMonthDayAged } from '@/shared/lib/dates'
import { Area, Big, EmptyTank, Note, type AreaMark } from '@/shared/ui/folyadek'
import { deepMuscle, muscleLiquid } from '@/features/train/components/folyadek'

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
  /** The exercise's muscle: the liquid's colour. Without it the domain liquid. */
  muscle?: string
  /** ISO dates on which an estimated-1RM record was set — each gets a record drop on its point. */
  recordDates?: readonly string[]
}

/** 'Szep 23' → 'szep': the month caption under the curve. */
const monthOf = (iso: string) => huMonthDay(iso).split(' ')[0].toLowerCase()

/** Up to four evenly spaced month captions over the series (first … last). */
function monthLabels(points: readonly E1rmPoint[]): string[] {
  const n = Math.min(4, points.length)
  return Array.from({ length: n }, (_, i) => monthOf(points[Math.round((i * (points.length - 1)) / (n - 1))].date))
}

export function StrengthCurve({ points, muscle, recordDates }: StrengthCurveProps) {
  if (points.length === 0) {
    return (
      <EmptyTank icon="t-ring">
        Ehhez a gyakorlathoz még nincs becsülhető maximumod — az ív az első terhelt szettjeid után rajzolódik ki.
      </EmptyTank>
    )
  }
  if (points.length === 1) {
    // One point is a dot, not a trend. Drawing a flat line through it would claim a
    // history of holding a level that was measured exactly once.
    return (
      <Note>
        Egyetlen becslésed van eddig ({huMonthDayAged(points[0].date)} · {hu1(points[0].e1rm)} kg) — a vonal a másodiktól kezd ívelni.
      </Note>
    )
  }

  const values = points.map((p) => p.e1rm)
  const last = points[points.length - 1]
  const first = points[0]
  const gaps = splitOnGaps(points).length - 1
  const lastIdx = points.length - 1

  // Record drops: the points whose date carries an e1RM record. The last point already wears the
  // „now" mark; only the highest record is captioned, so the drops never write over each other.
  const recIdx = points.flatMap((p, i) => (i !== lastIdx && recordDates?.includes(p.date) ? [i] : []))
  const topRec = recIdx.reduce<number | null>((best, i) => (best === null || values[i] > values[best] ? i : best), null)
  const marks: AreaMark[] = [
    ...recIdx.map((i): AreaMark => ({ i, kind: 'pr', label: i === topRec ? hu1(values[i]) : undefined })),
    { i: lastIdx, kind: 'now', label: hu1(last.e1rm) },
  ]

  return (
    <div className="er-curve">
      {/* The LATEST estimate, not the best one — this is „hol tartasz most". The
          record itself is the „Becsült 1RM" row below. */}
      <Big value={hu1(last.e1rm)} unit="kg most" />
      <div
        className="fo-hero-g ar"
        role="img"
        aria-label={
          `Becsült maximumod alakulása ${huMonthDayAged(first.date)} óta: ${points.length} mérés, ` +
          `${hu1(first.e1rm)} kg-tól ${hu1(last.e1rm)} kg-ig` +
          (gaps > 0 ? `, ${gaps} kihagyott időszakkal.` : '.')
        }
      >
        <Area
          values={values}
          height={140}
          labels={monthLabels(points)}
          min={Math.min(...values) - 4}
          max={Math.max(...values) + 4}
          color={muscle ? muscleLiquid(muscle) : undefined}
          color2={muscle ? deepMuscle(muscle) : undefined}
          marks={marks}
        />
      </div>
      <div className="fo-ft">
        <span>ami eddig megtörtént · {huMonthDayAged(first.date)} óta</span>
        <span>becslés, nem mérés</span>
      </div>
    </div>
  )
}
