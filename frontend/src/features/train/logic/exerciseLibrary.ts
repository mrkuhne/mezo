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
import type { ExerciseRecordResponse } from '@/data/train/trainApi'
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
interface Identity { catalogId?: string; name: string }

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
  return catalog.map((item) => {
    const record = joinByIdentity(records, item) ?? null
    // Same rule, one medal at a time: ask the join whether THIS medal belongs to the row,
    // rather than writing a second identity rule here.
    const medalCount = medals.filter((m) => joinByIdentity([medalIdentity(m)], item) !== undefined).length
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
