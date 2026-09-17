// ============================================================
// Mezo · recordFor (mezo-88iwa.7, T6 Task 5) — pure helpers for the records glass:
// which ExerciseRecordResponse row belongs to a given exercise, and how today's
// logged sets compare against it. No hooks, no fetching — the caller (Workout-
// RecordsGlass) owns the rendering; these just answer the arithmetic honestly.
// ============================================================

/** The identity a record lookup needs — a structural subset of both
 *  LoggedWorkoutExercise and ExerciseRecordResponse. */
interface RecordIdentity {
  catalogId?: string | null
  name: string
}

/**
 * catalogId-when-present-else-name — the records idiom (a direct lookup rather
 * than a shared key): an exercise
 * carrying a catalogId is matched ONLY against a record with that same
 * catalogId (a same-named legacy row never substitutes for it); an exercise
 * with no catalogId (every mock-mode exercise, and any real one not yet
 * catalog-linked) falls back to an exact name match.
 */
export function recordFor<T extends RecordIdentity>(
  records: readonly T[],
  exercise: RecordIdentity,
): T | undefined {
  if (exercise.catalogId) {
    return records.find((r) => r.catalogId === exercise.catalogId)
  }
  return records.find((r) => r.name === exercise.name)
}

/** One logged set, in the shape both LoggedSet (session state) and RecordSetRef
 *  (the wire) can supply. */
export interface TodaySetLike {
  weight: number
  reps: number
}

export interface TodayBest {
  /** Best Epley e1RM among today's eligible sets (weight > 0, 1 ≤ reps ≤ REP_CAP), or
   *  null when nothing logged yet / nothing eligible. */
  e1rm: number | null
  /** The set that produced `e1rm` — carried alongside so the "LEGJOBB SZETT" bar can
   *  show its own kg × reps rather than a bare e1RM number. */
  e1rmSet: TodaySetLike | null
  /** Σ weight×reps of every logged set today (bodyweight sets — weight 0 — contribute 0,
   *  same as the backend's totalVolume convention). */
  volume: number
}

/** Reps above this are too high-rep for a trustworthy Epley estimate — mirrors the
 *  backend's OneRepMax.REP_CAP (backend/.../train/service/OneRepMax.java). */
const REP_CAP = 12

/** Epley e1RM: weight × (30 + reps) / 30 — mirrors OneRepMax.estimate. */
function epley(weight: number, reps: number): number {
  return (weight * (30 + reps)) / 30
}

/** Today's e1RM/volume from the session's logged sets of one exercise. Pure — no
 *  knowledge of Session, just the plain {weight, reps} pairs the caller already has. */
export function todayBest(sets: readonly TodaySetLike[]): TodayBest {
  let e1rm: number | null = null
  let e1rmSet: TodaySetLike | null = null
  let volume = 0
  for (const s of sets) {
    volume += s.weight * s.reps
    if (s.weight > 0 && s.reps >= 1 && s.reps <= REP_CAP) {
      const candidate = epley(s.weight, s.reps)
      if (e1rm === null || candidate > e1rm) {
        e1rm = candidate
        e1rmSet = s
      }
    }
  }
  return { e1rm, e1rmSet, volume }
}

export interface BarProgress {
  /** 0-100, how far today's number sits toward the record (capped). */
  share: number
  /** Today's number strictly exceeds the record. */
  beaten: boolean
}

/**
 * Fill share + beaten state for one record bar.
 *
 * "MA MEGDÖNTVE" is claimed ONLY against a real, comparable target (fix wave M1): a
 * `target` of 0 means there is nothing to beat — either the exercise has no record row at
 * all (first-ever logging), or the record exists but carries no comparable number on this
 * metric (the LEGJOBB SZETT bar against a BODYWEIGHT record: `bestSet.weightKg` is null,
 * so its e1RM is unknowable and today's weighted e1RM cannot be ranked against it). The
 * old `now > target` shape turned both of those into a triumphant record-broken banner on
 * the very first logged set of a brand-new exercise, which is a lie either way.
 */
export function barProgress(now: number, target: number): BarProgress {
  return {
    share: target > 0 ? Math.min(100, (now / target) * 100) : 0,
    beaten: target > 0 && now > target,
  }
}
