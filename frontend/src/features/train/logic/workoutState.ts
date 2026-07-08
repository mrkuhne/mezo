// ============================================================
// Mezo · Active-workout session state — pure, React-free model.
//
// A Session is the in-flight state of one active workout, keyed by
// exerciseId (not array index). All exported functions are PURE:
// no side effects, no mutation — they always return a new Session.
// Later slices import these names verbatim.
// ============================================================
import type { PrescribedSet } from '@/data/types'

export interface LoggedSet {
  weight: number
  reps: number
  rir: number
}

export interface Session {
  /** Exercise ids in session (display) order. Reorder = replace this array. */
  order: string[]
  /** Cursor: next set index for the current exercise. */
  setIdx: number
  /** Completed sets per exerciseId, in completion order. */
  logged: Record<string, LoggedSet[]>
  /** Extra (ad-hoc) sets added beyond the plan, per exerciseId. */
  extra: Record<string, number>
  /** Exercise ids the user chose to skip. */
  skipped: string[]
  /** Planned set count per exerciseId (immutable baseline). */
  planned: Record<string, number>
  /** Per-exercise prescribed targets (warmup then working), aligned to setIndex. */
  prescribed: Record<string, PrescribedSet[]>
}

/**
 * The shape makeSession/seedFromOpen consume: the recipe (warmup + working set
 * counts) plus the aligned prescribed targets. Matches LoggedWorkoutExercise.
 */
export interface SessionExerciseInput {
  id: string
  warmupSets: number
  workingSets: number
  prescribedSets: PrescribedSet[] | null
}

/** Build a fresh session from the planned exercise list. */
export function makeSession(exercises: SessionExerciseInput[]): Session {
  const order = exercises.map((e) => e.id)
  const planned: Record<string, number> = {}
  const prescribed: Record<string, PrescribedSet[]> = {}
  for (const e of exercises) {
    planned[e.id] = e.warmupSets + e.workingSets
    prescribed[e.id] = e.prescribedSets ?? []
  }
  return { order, setIdx: 0, logged: {}, extra: {}, skipped: [], planned, prescribed }
}

/** The prescribed target for a given set index of an exercise (null past the plan / no prescription). */
export function prescribedAt(s: Session, id: string, idx: number): PrescribedSet | null {
  return s.prescribed[id]?.[idx] ?? null
}

/** Planned sets + any extra sets added for this exercise. */
export function effectiveSetCount(s: Session, id: string): number {
  return (s.planned[id] ?? 0) + (s.extra[id] ?? 0)
}

/**
 * Returns the first non-skipped, not-fully-logged exercise id in `order`.
 * When EVERY exercise is fully logged or skipped, returns the LAST id in
 * `order` — the "workout complete" sentinel. Assumes a non-empty exercise
 * list (an active workout always has ≥1 exercise — the screen's guard).
 */
export function currentExerciseId(s: Session): string {
  for (const id of s.order) {
    if (s.skipped.includes(id)) continue
    const done = s.logged[id]?.length ?? 0
    if (done < effectiveSetCount(s, id)) return id
  }
  return s.order[s.order.length - 1]
}

/** Append a completed set to the current exercise and advance the cursor. */
export function completeSet(s: Session, set: LoggedSet): Session {
  const id = currentExerciseId(s)
  const next = [...(s.logged[id] ?? []), set]
  return {
    ...s,
    logged: { ...s.logged, [id]: next },
    setIdx: next.length,
  }
}

/** Re-sync the cursor to the (re-derived) current exercise. */
export function advance(s: Session): Session {
  const id = currentExerciseId(s)
  return { ...s, setIdx: s.logged[id]?.length ?? 0 }
}

/** Grow the effective set count for one exercise by a single extra set. */
export function addExtraSet(s: Session, id: string): Session {
  return { ...s, extra: { ...s.extra, [id]: (s.extra[id] ?? 0) + 1 } }
}

/** Mark an exercise as skipped (idempotent). */
export function skipExercise(s: Session, id: string): Session {
  if (s.skipped.includes(id)) return s
  return { ...s, skipped: [...s.skipped, id] }
}

/** Persisted-set shape used when resuming an in-flight workout. */
interface PersistedSet {
  exerciseId: string
  setIndex: number
  weightKg?: number | null
  reps?: number | null
  rir?: number | null
  /** Whole-exercise skip marker (no perf data) — routes to `skipped`, not `logged`. */
  skipped?: boolean
}

/**
 * Rebuild a session from persisted sets (resume an open workout):
 * group sets by exerciseId (ordered by setIndex) into `logged`, then
 * point the cursor at the next set of the current exercise. A persisted
 * skip marker (`skipped === true`, null perf) adds its exerciseId to
 * `session.skipped` instead of `logged` so a resume lands past it.
 */
export function seedFromOpen(
  exercises: SessionExerciseInput[],
  open: { sets: PersistedSet[] },
): Session {
  const base = makeSession(exercises)
  const logged: Record<string, LoggedSet[]> = {}
  const skipped: string[] = []
  // setIndex only ORDERS the sets here, not the stored index — `logged[id].length`
  // is a pure count, so we assume the persistence layer emits contiguous (gap-free) indices.
  const ordered = [...open.sets].sort((x, y) => x.setIndex - y.setIndex)
  for (const set of ordered) {
    if (set.skipped) {
      if (!skipped.includes(set.exerciseId)) skipped.push(set.exerciseId)
      continue
    }
    const entry: LoggedSet = {
      weight: Number(set.weightKg ?? 0),
      reps: set.reps ?? 0,
      rir: set.rir ?? 0,
    }
    ;(logged[set.exerciseId] ??= []).push(entry)
  }
  const seeded: Session = { ...base, logged, skipped }
  return { ...seeded, setIdx: seeded.logged[currentExerciseId(seeded)]?.length ?? 0 }
}
