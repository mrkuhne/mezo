// ============================================================
// Mezo · mesoCompare (mezo-meyc.4) — the pure composition behind MesoComparePage.
//
// There is NO compare endpoint: the page fetches two frozen `MesocycleReportResponse`s
// (one `useMesoReport` each) and these three helpers line them up client-side. That is
// the whole design decision — a report is already a self-contained close-time snapshot,
// so a pairwise comparison is a view over two of them, not new server state.
//
// The one rule every helper obeys: **a missing measurement stays null.** Two runs never
// carry the same shape (different lengths, different muscles, different exercises, a
// context that was never aggregated), so every side of every row is nullable and a hole
// is never filled with 0 — a fabricated zero would read as "we measured no volume /
// no sleep", which is a different claim than "we have no data".
// ============================================================
import type {
  MesoContextTotals,
  MesoStrengthDelta,
  MesocycleReportResponse,
} from '@/data/train/trainApi'

/** One week of one muscle, both runs on the same row. Null = that run has no such week. */
export interface CompareVolumeWeekRow {
  week: number
  aPlanned: number | null
  aActual: number | null
  bPlanned: number | null
  bActual: number | null
}

export interface CompareVolumeMuscle {
  muscle: string
  weeks: CompareVolumeWeekRow[]
}

/** One exercise trained in BOTH runs, with each run's close-time deltas. */
export interface CompareStrengthRow {
  exerciseName: string
  muscle: string
  aDeltaKg: number | null
  aDeltaPct: number | null
  bDeltaKg: number | null
  bDeltaPct: number | null
}

export interface CompareContextRow {
  label: string
  aValue: number | null
  bValue: number | null
  unit: string
}

/** Insertion-ordered union — a's own order first, then whatever only b has. */
function unionBy<T, K>(items: T[], key: (t: T) => K): K[] {
  const out: K[] = []
  for (const it of items) {
    const k = key(it)
    if (!out.includes(k)) out.push(k)
  }
  return out
}

/**
 * The per-muscle, per-week volume grid of the two runs.
 *
 * Muscles are the UNION of both arcs (a's order first, then b-only ones — deterministic,
 * so the pill switch never reshuffles between renders). Weeks are aligned by **week
 * number** — which in this data is the 1-based index into the run — so W1 faces W1 and a
 * shorter run simply has null cells past its end (`W1..max(weeks)`). A report whose
 * `volume` is null contributes nothing at all; if NEITHER has one the result is empty and
 * the page drops the whole block.
 */
export function alignVolumeWeeks(
  a: MesocycleReportResponse,
  b: MesocycleReportResponse,
): CompareVolumeMuscle[] {
  const aMuscles = a.volume?.muscles ?? []
  const bMuscles = b.volume?.muscles ?? []

  return unionBy([...aMuscles, ...bMuscles], (m) => m.muscle).map((muscle) => {
    const av = aMuscles.find((m) => m.muscle === muscle)
    const bv = bMuscles.find((m) => m.muscle === muscle)
    const weeks = unionBy([...(av?.weeks ?? []), ...(bv?.weeks ?? [])], (w) => w.week)
      .sort((x, y) => x - y)
      .map((week) => {
        const aw = av?.weeks.find((w) => w.week === week)
        const bw = bv?.weeks.find((w) => w.week === week)
        return {
          week,
          aPlanned: aw?.planned ?? null,
          aActual: aw?.actual ?? null,
          bPlanned: bw?.planned ?? null,
          bActual: bw?.actual ?? null,
        }
      })
    return { muscle, weeks }
  })
}

/**
 * Same exercise in both runs? `catalogId` decides whenever BOTH sides have one (a renamed
 * catalog row is still the same lift); otherwise the names must match exactly — a fuzzy
 * name match would silently equate "Incline DB Press" with "Incline Press", which would
 * put two different lifts' loads on one row.
 */
function sameExercise(x: MesoStrengthDelta, y: MesoStrengthDelta): boolean {
  if (x.catalogId != null && y.catalogId != null) return x.catalogId === y.catalogId
  return x.exerciseName === y.exerciseName
}

/** The row's ordering key: the LOUDER of the two e1RM percentages, magnitude only. */
function pctMagnitude(row: CompareStrengthRow): number | null {
  const present = [row.aDeltaPct, row.bDeltaPct].filter((v): v is number => v != null)
  return present.length === 0 ? null : Math.max(...present.map(Math.abs))
}

/**
 * The heart of the comparison: the exercises trained in BOTH runs, each with the two runs'
 * deltas. Exercises unique to one run are dropped — there is nothing to compare about them.
 *
 * Sorted by the bigger |deltaPct| descending (magnitude, so a big regression ranks as high
 * as a big gain — both are the interesting rows), lifts with no percentage on either side
 * last. `deltaKg` is the top-set LOAD move and `deltaPct` is measured on e1RM, exactly as
 * on the report page — the two are NOT redundant (same weight + more reps = 0 kg, real %).
 */
export function sharedStrengthDeltas(
  a: MesocycleReportResponse,
  b: MesocycleReportResponse,
): CompareStrengthRow[] {
  const rows: CompareStrengthRow[] = []
  for (const as of a.strength) {
    // First match wins: a report lists an exercise once, and on the freak chance it does
    // not, pairing with the first occurrence beats inventing a cross product.
    const bs = b.strength.find((x) => sameExercise(as, x))
    if (!bs) continue
    rows.push({
      exerciseName: as.exerciseName,
      muscle: as.muscle || bs.muscle,
      aDeltaKg: as.deltaKg ?? null,
      aDeltaPct: as.deltaPct ?? null,
      bDeltaKg: bs.deltaKg ?? null,
      bDeltaPct: bs.deltaPct ?? null,
    })
  }
  return rows.sort((x, y) => {
    const mx = pctMagnitude(x)
    const my = pctMagnitude(y)
    if (mx == null && my == null) return 0
    if (mx == null) return 1
    if (my == null) return -1
    return my - mx
  })
}

/**
 * The lifestyle rows, in a fixed order. Deliberately the TOTALS only (not the weekly
 * buckets): a per-week context table for two runs of different lengths would be a grid of
 * holes, while the averages are the thing that actually answers "which block did I live
 * better through".
 */
const CONTEXT_METRICS: { label: string; unit: string; pick: (t: MesoContextTotals) => number | null }[] = [
  { label: 'Alvás', unit: 'h', pick: (t) => t.sleepAvgH ?? null },
  { label: 'Kcal', unit: 'kcal', pick: (t) => t.kcalAvg ?? null },
  { label: 'Energia', unit: '', pick: (t) => t.energyAvg ?? null },
  { label: 'Stressz', unit: '', pick: (t) => t.stressAvg ?? null },
  { label: 'Súlyváltozás', unit: 'kg', pick: (t) => t.weightChangeKg ?? null },
  { label: 'Sport', unit: 'perc', pick: (t) => t.sportMinutes ?? null },
]

/**
 * The context averages of the two runs, side by side. A metric NEITHER run measured is
 * dropped entirely (an all-"–" row says nothing); a metric only one run measured stays,
 * because "7,4 h vs nincs adat" is itself informative. A report with a null `context` (the
 * async aggregation never ran, or the run predates it) contributes nulls, not zeros.
 */
export function contextDiff(
  a: MesocycleReportResponse,
  b: MesocycleReportResponse,
): CompareContextRow[] {
  const at = a.context?.totals ?? null
  const bt = b.context?.totals ?? null
  return CONTEXT_METRICS.map((m) => ({
    label: m.label,
    aValue: at ? m.pick(at) : null,
    bValue: bt ? m.pick(bt) : null,
    unit: m.unit,
  })).filter((r) => r.aValue != null || r.bValue != null)
}
