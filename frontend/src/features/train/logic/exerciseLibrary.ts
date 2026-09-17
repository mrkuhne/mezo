// ============================================================
// Mezo · exerciseLibrary (Train parity P2 Task 4, mezo-lf3cv) — the Gyakorlatok
// catalogue's pure joins: the exercise catalogue × the per-exercise records ×
// the medals, plus the search/region filtering and the three hero counts the
// poster shows. No hooks, no fetching — ExercisesPage owns the rendering.
//
// Identity: `recordFor` (logic/recordFor.ts) is the ONE precedence rule in the
// house — catalogId when both sides carry one, else an exact name match — and it
// is reused here for BOTH joins (the record row and every medal, via
// `joinByIdentity`), so the catalogue can never disagree with the workout glass
// about which record belongs to which exercise.
//
// Mirrors the prototype's `exercise-state.js` (`exerciseList`, `libraryCounts`)
// — docs/design_2.0/prototypes/companion-titanium/exercise-state.js:14-43.
// ============================================================
import { E1RM_SERIES_MAX_POINTS, type ExerciseRecordResponse } from '@/data/train/trainApi'
import type { Medal } from '@/data/train/medalTypes'
import { MUSCLE_LABELS } from '@/data/train/train'
import type { ExerciseKind, ExerciseLibraryItem } from '@/data/types'
import { muscleRegion, REGION_LABELS, REGION_ORDER, type RegionKey } from './muscleColors'
import { recordFor } from './recordFor'

/** One catalogue exercise with everything the card and its story route need. */
export interface LibraryRow {
  /** Route key for `/train/exercises/:key` — the catalog id when there is one,
   *  else the local catalogue row's own id (mock mode has no catalogId). */
  key: string
  id: string
  catalogId?: string
  name: string
  muscle: string
  /** The muscle's Hungarian label (falls back to the raw token for an unmapped one). */
  muscleLabel: string
  type: ExerciseKind
  region: RegionKey | null
  /** The record row for this exercise, or null when it was never logged. */
  record: ExerciseRecordResponse | null
  /** Best estimated 1RM in kg, or null — an exercise can be logged (bodyweight,
   *  above the rep cap) and still have no trustworthy estimate. */
  bestE1rm: number | null
  /** How many medals this exercise earned (0 is a real answer, never hidden). */
  medalCount: number
}

/** The route key of a catalogue row: catalogId when present, else its own id. */
export function exerciseKey(item: { catalogId?: string; id: string }): string {
  return item.catalogId ?? item.id
}

/**
 * Accent-blind, case-folded search text: „Bicepsz (hosszú fej)" → "bicepsz (hosszu fej)",
 * so „hosszu" typed without accents still finds it. NFD splits an accented letter into
 * its base + a combining mark, which the Diacritic class then drops.
 *
 * Note this has no bearing on `recordFor`'s own name matching (below) — that stays
 * EXACT, deliberately: the search field is forgiving for a human typing, the identity
 * join is not, because it now has to agree with the backend's own `"n:" + name` grouping
 * key for a catalogId-less record. The retired page's case-insensitive name join was the
 * anomaly, not this one — do not re-loosen `recordFor` to "help" a near-miss name match.
 */
export function foldAccents(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
}

/** A medal's identity in the shape `recordFor` matches on. */
const medalIdentity = (m: Medal) => ({ catalogId: m.catalogId ?? undefined, name: m.exerciseName })

/** What both joins match on — a structural subset of a record row and of a medal. */
export interface Identity { catalogId?: string; name: string }

/**
 * „catalogId when BOTH sides carry one, else the name" — expressed as two `recordFor`
 * calls rather than as a second precedence rule:
 *   1. `recordFor` itself: a catalogue row WITH a catalogId is matched only against a
 *      row carrying that same catalogId (a same-named foreign row never substitutes).
 *   2. the name fallback among the rows that carry NO catalogId — a live record can be
 *      name-grouped (no catalogId) while its catalogue row has one (mezo-u5gk/mezo-7ndk),
 *      and dropping it would tell the reader an exercise they logged was never logged.
 */
function joinByIdentity<T extends Identity>(rows: readonly T[], item: Identity): T | undefined {
  return recordFor(rows, item) ?? recordFor(rows.filter((r) => !r.catalogId), { name: item.name })
}

/**
 * The catalogue joined to its records and medals — one row per catalogue exercise,
 * in the catalogue's own order. Records/medals that match no catalogue row are left
 * out: this page is the CATALOGUE, and a row it cannot show is not counted either.
 */
export function buildLibraryRows(
  catalog: readonly ExerciseLibraryItem[],
  records: readonly ExerciseRecordResponse[],
  medals: readonly Medal[],
): LibraryRow[] {
  // Each medal is claimed by AT MOST ONE row, in the catalogue's own order. A name-only
  // medal matches every catalogue row carrying that name, so without this two same-named
  // rows (neither with a `catalogId`) would both count it and the poster's Σ would read
  // higher than the medals the reader actually owns. Names are unique server-side today —
  // this is the guard, not a fix for a live symptom (see `libraryCounts`).
  const claimed = new Set<number>()
  return catalog.map((item) => {
    const record = joinByIdentity(records, item) ?? null
    // Same rule, one medal at a time: ask the join whether THIS medal belongs to the row,
    // rather than writing a second identity rule here.
    const medalCount = medals.reduce((n, m, i) => {
      if (claimed.has(i) || joinByIdentity([medalIdentity(m)], item) === undefined) return n
      claimed.add(i)
      return n + 1
    }, 0)
    return {
      key: exerciseKey(item),
      id: item.id,
      catalogId: item.catalogId,
      name: item.name,
      muscle: item.muscle,
      muscleLabel: MUSCLE_LABELS[item.muscle] ?? item.muscle,
      type: item.type,
      region: muscleRegion(item.muscle),
      record,
      bestE1rm: record?.bestE1rm?.value ?? null,
      medalCount,
    }
  })
}

export interface LibraryCounts {
  /** Exercises in the catalogue. */
  total: number
  /** Of those, the ones that carry a record row. */
  logged: number
  /** Σ medals across the catalogue's exercises. */
  medals: number
}

/**
 * The poster's three foot facts — all three real, all three honest at zero.
 *
 * `medals` is CATALOGUE-SCOPED: it sums `LibraryRow.medalCount`, which `buildLibraryRows`
 * only ever attaches to a row that exists in the catalogue (see its own comment — a medal
 * matching no catalogue row is left out, not invented a row). So a medal earned on an
 * exercise that has since left the catalogue (or was never in it) is excluded here, and
 * this poster count can legitimately read LOWER than the medal vitrine's own total.
 *
 * It can never read HIGHER: `buildLibraryRows` lets each medal be claimed by at most ONE row
 * (see its own comment), so two catalogue rows sharing a name — both name-only, no
 * `catalogId` — cannot both count the same medal into this Σ.
 */
export function libraryCounts(rows: readonly LibraryRow[]): LibraryCounts {
  return {
    total: rows.length,
    logged: rows.filter((r) => r.record !== null).length,
    medals: rows.reduce((sum, r) => sum + r.medalCount, 0),
  }
}

export interface LibraryRegion {
  key: RegionKey
  label: string
  /** Catalogue rows in this region — the chip exists because these exist. */
  count: number
}

/**
 * The region chips beside „Mind": one per region the catalogue ACTUALLY has rows in,
 * in the house region order. A chip for an empty region would filter to nothing.
 */
export function libraryRegions(rows: readonly LibraryRow[]): LibraryRegion[] {
  return REGION_ORDER
    .map((key) => ({ key, label: REGION_LABELS[key], count: rows.filter((r) => r.region === key).length }))
    .filter((r) => r.count > 0)
}

/**
 * Search + region filter. The query matches the exercise NAME or its MUSCLE LABEL,
 * accent-blind and case-blind („bicepsz" finds „Bicepsz (hosszú fej)" rows by muscle);
 * an empty query matches everything. `region` null/'' means „Mind".
 */
export function filterLibraryRows(
  rows: readonly LibraryRow[],
  query: string,
  region: RegionKey | null,
): LibraryRow[] {
  const q = foldAccents(query.trim())
  return rows.filter((r) => {
    if (region && r.region !== region) return false
    if (q === '') return true
    return foldAccents(r.name).includes(q) || foldAccents(r.muscleLabel).includes(q)
  })
}

// ── the exercise STORY's own derivations (Train parity P2 Task 5, mezo-lf3cv) ──────────
// All three below are pure and live here rather than in the page, and all three reuse
// `joinByIdentity` above — the story must never disagree with the catalogue card about
// which record/medal/plan row belongs to which exercise.

/** Does this catalogue row own that identity (a medal, a planned exercise, …)? */
export function belongsToExercise(item: Identity, other: Identity): boolean {
  return joinByIdentity([other], item) !== undefined
}

/** Every medal earned on ONE catalogue row, newest first. */
export function medalsForExercise(medals: readonly Medal[], item: Identity): Medal[] {
  return medals
    .filter((m) => belongsToExercise(item, medalIdentity(m)))
    .sort((a, b) => b.date.localeCompare(a.date))
}

/**
 * The first date this exercise can honestly claim („… óta" in the hero foot).
 *
 * The wire carries no „first logged" field, so the earliest date the record row can
 * actually SHOW is used: the oldest e1RM point when there is a series, else the oldest
 * date among the dated set refs it carries. `null` when the row dates nothing at all —
 * the fact is then omitted rather than guessed.
 */
export function firstSeenDate(record: ExerciseRecordResponse): string | null {
  const dates = [
    ...(record.e1rmSeries ?? []).map((p) => p.date),
    ...(record.bestSet ? [record.bestSet.date] : []),
    ...(record.bestE1rm ? [record.bestE1rm.set.date] : []),
    ...(record.bestSessionVolume ? [record.bestSessionVolume.date] : []),
    ...record.repRecords.map((s) => s.date),
    ...record.recentTopSets.map((s) => s.date),
  ]
  return dates.length ? dates.reduce((a, b) => (a < b ? a : b)) : null
}

/**
 * What the hero's middle foot fact may HONESTLY say about how far back this exercise goes.
 *
 * `firstSeenDate` above is the oldest date the row CARRIES, and the wire's e1RM series keeps
 * only the newest `E1RM_SERIES_MAX_POINTS` points. For a long-running exercise that oldest
 * date is therefore the WINDOW's start, not the first session — „60 alkalom · Ápr 21 óta"
 * tells a two-year lifter he started this April, so the copy has to say the bounded thing
 * („ebből az utolsó N látszik") instead.
 *
 * The tell is the POINT COUNT AT THE CAP, not `sessionCount > points`. Points are lost to two
 * different causes and only one of them is a window: the cap, and ELIGIBILITY — a session with
 * nothing e1RM-eligible (bodyweight-only, all warm-up, all skipped, every set above the rep
 * cap) is omitted from the series while still counting in `sessionCount`. Reading the mere
 * shortfall as a window made the copy state a falsehood in the ordinary case: 21 logged
 * sessions of which 6 produced a point are not „the last 6 of 21" — nothing was cut off the
 * FRONT, the missing 15 are scattered all through the history. So the window is claimed only
 * when the series is genuinely full (`points === E1RM_SERIES_MAX_POINTS`, where the server did
 * drop the oldest); below the cap the row's oldest carried date is the oldest thing it knows,
 * and that absolute fact is what gets said.
 *
 * With NO series at all (a bodyweight row: nothing is ever e1RM-eligible) the same fallback
 * applies for the same reason.
 */
export type SinceFact =
  | { kind: 'since'; date: string }
  | { kind: 'window'; sessions: number }

export function sinceFact(record: ExerciseRecordResponse): SinceFact | null {
  const points = record.e1rmSeries?.length ?? 0
  // `>=` rather than `===`: if a future server ever ships a longer series, a full window is
  // still a window — the branch must not fall silently back to an absolute start date.
  if (points >= E1RM_SERIES_MAX_POINTS && record.sessionCount > points) {
    return { kind: 'window', sessions: points }
  }
  const date = firstSeenDate(record)
  return date ? { kind: 'since', date } : null
}

export interface NextTarget {
  /** Load to aim at, kg — null for a bodyweight best set (no load to repeat). */
  kg: number | null
  /** Reps to aim at: the best set's reps + 1. */
  reps: number
  /** The prototype's own note — a TARGET you set, never a prediction the app makes. */
  note: string
}

/**
 * „Következő cél" — DERIVED from the best set, never predicted: the same load, one rep
 * more. Nothing models this; it is the smallest honest next step past a record you
 * already own, which is why the copy says „cél" and the note says what to do rather than
 * what will happen. `null` when there is no best set to step past.
 *
 * A best set with no load (a bodyweight/plyo record — `weightKg` absent or 0) keeps the
 * rep step and drops the kg: there is no weight to repeat.
 */
export function nextTarget(record: ExerciseRecordResponse): NextTarget | null {
  const best = record.bestSet
  if (!best) return null
  const kg = best.weightKg != null && best.weightKg > 0 ? best.weightKg : null
  return {
    kg,
    reps: best.reps + 1,
    note: kg != null ? 'ugyanaz a súly, egy ismétléssel több' : 'ugyanaz a mozdulat, egy ismétléssel több',
  }
}

export interface WhereUsedDay {
  /** The run this day belongs to — the row's route target. */
  mesoId: string
  /** 'Hét'..'Vas' */
  day: string
  /** The day's type („Pull Day"). */
  type: string
}
export interface WhereUsedTemplate {
  id: string
  name: string
}
export interface WhereUsed {
  days: WhereUsedDay[]
  templates: WhereUsedTemplate[]
}

/**
 * „Hol szerepel" — derived CLIENT-SIDE (no endpoint): the running plan's days and the
 * shelf's templates that actually prescribe this exercise.
 *
 * Mirrors the prototype's `whereUsed` (exercise-state.js:24) including its one
 * subtraction: the template the ACTIVE run was started from is left out, because its week
 * is the very same week the day rows above already list — showing both would tell the
 * reader the exercise appears twice when it appears once.
 */
export function whereUsed(
  item: Identity,
  activeMeso: { id: string; templateId?: string | null; days?: { day: string; type: string; exercises: Identity[] }[] } | null,
  templates: readonly { id: string; title: string; days: { exercises: Identity[] }[] }[],
): WhereUsed {
  const days = (activeMeso?.days ?? [])
    .filter((d) => d.exercises.some((e) => belongsToExercise(item, e)))
    .map((d) => ({ mesoId: activeMeso!.id, day: d.day, type: d.type }))
  const templateRows = templates
    .filter((t) => t.id !== activeMeso?.templateId && t.days.some((d) => d.exercises.some((e) => belongsToExercise(item, e))))
    .map((t) => ({ id: t.id, name: t.title }))
  return { days, templates: templateRows }
}
