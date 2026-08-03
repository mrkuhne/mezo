// ============================================================
// Mezo · workoutCardMeta — pure derivations for the redesigned Train workout
// card (mezo-8xmf, active-workout-context redesign). Warmup-percent labels,
// per-set rep-range status, exercise tonnage/top-set-delta/average-RIR
// summaries, and session progress-strip segments — all pure functions over
// `LoggedWorkoutExercise` + small logged-set shapes, no server call.
// ============================================================
import type { LoggedWorkoutExercise } from '@/data/types'

/**
 * `B{i+1} = {pct}% · {kg}` label for the prescribed warmup set at
 * `warmupIdx`, where `pct = round(warmupTarget / firstWorkingTarget × 100)`.
 * Null when `prescribedSets` is null, the row at `warmupIdx` is missing or
 * not `kind: 'warmup'`, the warmup's `targetWeightKg` is null, or no
 * `'working'` row has a non-null `targetWeightKg`.
 */
export function warmupPctLabel(ex: LoggedWorkoutExercise, warmupIdx: number): string | null {
  const prescribed = ex.prescribedSets
  const warmup = prescribed?.[warmupIdx]
  if (!warmup || warmup.kind !== 'warmup' || warmup.targetWeightKg == null) return null

  const firstWorking = prescribed?.find((s) => s.kind === 'working' && s.targetWeightKg != null)
  if (!firstWorking || firstWorking.targetWeightKg == null) return null

  const pct = Math.round((warmup.targetWeightKg / firstWorking.targetWeightKg) * 100)
  return `B${warmupIdx + 1} = ${pct}% · ${warmup.targetWeightKg.toLocaleString('hu-HU')}`
}

/** Rep-range status of one logged set: warmups are always `'ok'`; working sets are `'ok'` inside `[repMin, repMax]` (inclusive), else `'below'`/`'above'`. */
export function setStatus(
  ex: Pick<LoggedWorkoutExercise, 'repMin' | 'repMax'>,
  logged: { reps: number; kind: 'warmup' | 'working' },
): 'ok' | 'below' | 'above' {
  if (logged.kind === 'warmup') return 'ok'
  if (logged.reps < ex.repMin) return 'below'
  if (logged.reps > ex.repMax) return 'above'
  return 'ok'
}

/** Σ weight × reps over logged sets, skipping `skipped` rows and rows with no logged weight. */
export function exerciseTonnage(sets: { weightKg: number | null; reps: number; skipped?: boolean }[]): number {
  return sets.reduce((sum, s) => (s.skipped || s.weightKg == null ? sum : sum + s.weightKg * s.reps), 0)
}

/**
 * Rounded percent delta of the max logged working weight vs `lastWeekWeightKg`.
 * Null when `lastWeekWeightKg` is null/undefined, or there is no non-skipped
 * logged working set with a weight.
 */
export function topSetDeltaPct(
  sets: { weightKg: number | null; kind: 'warmup' | 'working'; skipped?: boolean }[],
  lastWeekWeightKg: number | null | undefined,
): number | null {
  if (lastWeekWeightKg == null) return null

  const workingWeights = sets
    .filter((s) => s.kind === 'working' && !s.skipped && s.weightKg != null)
    .map((s) => s.weightKg as number)
  if (workingWeights.length === 0) return null

  const topWeight = Math.max(...workingWeights)
  return Math.round(((topWeight - lastWeekWeightKg) / lastWeekWeightKg) * 100)
}

/** Mean RIR across logged working sets, to 1 decimal; null when none have a logged RIR. */
export function avgWorkingRir(sets: { rir: number | null; kind: string }[]): number | null {
  const rirs = sets.filter((s) => s.kind === 'working' && s.rir != null).map((s) => s.rir as number)
  if (rirs.length === 0) return null
  const avg = rirs.reduce((a, b) => a + b, 0) / rirs.length
  return Math.round(avg * 10) / 10
}

/**
 * Session progress-strip segments, one per exercise: `weight` is
 * `warmupSets + workingSets` (floored at 1 so an empty exercise still draws
 * a sliver), `state` is `'done'` when `doneMap(ex.id)`, else `'current'` at
 * `currentIdx`, else `'upcoming'`; `colorMuscle` mirrors `ex.muscle`.
 */
export function sessionProgressSegments(
  exercises: LoggedWorkoutExercise[],
  currentIdx: number,
  doneMap: (exId: string) => boolean,
): { colorMuscle: string; weight: number; state: 'done' | 'current' | 'upcoming' }[] {
  return exercises.map((ex, i) => ({
    colorMuscle: ex.muscle,
    weight: Math.max(1, ex.warmupSets + ex.workingSets),
    state: doneMap(ex.id) ? 'done' : i === currentIdx ? 'current' : 'upcoming',
  }))
}
