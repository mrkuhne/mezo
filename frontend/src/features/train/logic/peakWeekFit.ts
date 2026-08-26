// ============================================================
// Mezo · peakWeekFit — peak-week session-time fit signal (mezo-3m5m,
// spec GD6). Projects each budget group's counted exercises onto its
// CURRENT tier's landmark target (MEV/MAV/MRV via tierTargetOf) — i.e.
// what the meso week would look like once every group actually reaches
// its tier's weekly set target — then re-estimates each day's session
// length (estimateSessionMinutes) against that projection and flags the
// days that fall outside SESSION_LENGTH_BAND.
//
// The per-group distribution is a FRONTEND MIRROR of the backend's
// WorkoutService.effectiveWorkingSets (backend/src/main/java/io/mrkuhne/
// mezo/feature/train/service/WorkoutService.java:380-441): every counted
// exercise gets a floor of 1 set; if the target is at or below the
// exercise count that floor IS the answer (degenerate case); otherwise
// the remainder is handed out proportional to each exercise's template
// workingSets, floored, then whatever floor-rounding left on the table
// goes one set at a time to the biggest fractional remainder (ties ->
// bigger template workingSets, then stable list order); a
// non-positive template sum falls back to an even split (base + first
// `remainder` items get +1).
//
// Differences from the backend version: the input is the builder's
// MesoDay[] (not persisted ExerciseEntity rows + a logged currentSets
// row), the group key is budgetGroup(exercise.muscle), the counted
// predicate is countsForVolume, and the "target" is the CURRENT tier's
// landmark (tierTargetOf(tierOf(priorities, group), lm)) rather than a
// MuscleGroupVolumeLogEntity row. Exercises in groups without a landmark
// (traps/core — same "no lower bound" treatment as elsewhere), and
// non-counted exercises everywhere (plyo/exempt), keep their template
// workingSets in the projection — same as the backend's "no log row" /
// "exempt" fallbacks. Off days and empty-exercise days are never
// flagged (mirrors structureLint's R8 scoping) — a rest day always
// estimates to 0 minutes, which is not a real "too short" signal.
//
// IDENTITY WARNING: the projected-sets map is keyed by the exercise
// OBJECT (a `Map<GymExercise, number>`), not by `id` — ids can repeat
// across days (row-copy patterns), so an id-keyed map would collide.
//
// Pure derivation; nothing persisted.
// ============================================================
import type { GymExercise, MesoDay, MusclePriorities } from '@/data/types'
import { isOffDay } from '@/features/train/logic/offDay'
import { tierOf, tierTargetOf } from '@/features/train/logic/musclePriorities'
import { estimateSessionMinutes } from '@/features/train/logic/sessionLength'
import { GROUP_LANDMARKS, budgetGroup, countsForVolume } from '@/features/train/logic/setBudget'
import { SESSION_LENGTH_BAND } from '@/features/train/logic/structureLint'

export interface PeakDayFit {
  day: string
  minutes: number
  direction: 'over' | 'under'
}

/**
 * Distributes `target` effective sets across `list` (one budget group's counted exercises for
 * the week) into `out`, keyed by exercise identity — mirror of WorkoutService.effectiveWorkingSets.
 */
function projectGroup(list: GymExercise[], target: number, out: Map<GymExercise, number>): void {
  const exerciseCount = list.length
  if (exerciseCount === 0) return
  if (target <= exerciseCount) {
    // Can't sum below exerciseCount with a >=1 floor per exercise (degenerate).
    for (const ex of list) out.set(ex, 1)
    return
  }

  const templateSum = list.reduce((sum, ex) => sum + ex.workingSets, 0)
  const remaining = target - exerciseCount // reserve 1 set/exercise up front
  const extra = new Map<GymExercise, number>()

  if (templateSum <= 0) {
    // No template signal to weigh by — split the remainder as evenly as possible.
    const base = Math.floor(remaining / exerciseCount)
    const evenRemainder = remaining % exerciseCount
    list.forEach((ex, idx) => extra.set(ex, base + (idx < evenRemainder ? 1 : 0)))
  } else {
    const fraction = new Map<GymExercise, number>()
    let distributedExtra = 0
    for (const ex of list) {
      const exact = (remaining * ex.workingSets) / templateSum
      const floor = Math.floor(exact)
      extra.set(ex, floor)
      fraction.set(ex, exact - floor)
      distributedExtra += floor
    }
    // Largest-remainder: hand out what floor-rounding left on the table, one set at a time, to
    // the biggest fractional share (ties -> bigger template workingSets, then stable list order —
    // Array.prototype.sort is a stable sort, matching the backend's Stream.sorted()).
    const leftover = remaining - distributedExtra
    const byFractionDesc = [...list].sort(
      (a, b) => fraction.get(b)! - fraction.get(a)! || b.workingSets - a.workingSets,
    )
    for (let i = 0; i < leftover; i++) {
      const ex = byFractionDesc[i]
      extra.set(ex, (extra.get(ex) ?? 0) + 1)
    }
  }

  for (const ex of list) out.set(ex, 1 + (extra.get(ex) ?? 0))
}

/**
 * Projects the meso week onto its PEAK tier targets (mezo-3m5m, GD6) and flags training days
 * whose re-estimated session length falls outside SESSION_LENGTH_BAND. Returns ONLY the
 * out-of-band days — a plan that fits its peak week everywhere yields [].
 */
export function peakWeekFit(
  days: MesoDay[],
  priorities?: MusclePriorities | null,
  volumePerMuscle?: Record<string, { mev: number; mav: number; mrv: number }> | null,
): PeakDayFit[] {
  const projected = new Map<GymExercise, number>() // identity-keyed: ids can repeat across days
  const byGroup = new Map<string, GymExercise[]>()
  for (const d of days) {
    for (const ex of d.exercises) {
      const group = budgetGroup(ex.muscle)
      if (!group || !countsForVolume(ex)) continue
      let list = byGroup.get(group)
      if (!list) { list = []; byGroup.set(group, list) }
      list.push(ex)
    }
  }

  for (const [group, list] of byGroup) {
    const lm = volumePerMuscle?.[group] ?? GROUP_LANDMARKS[group]
    if (!lm) continue // no landmark at all (traps/core) — exercises keep their template sets
    const target = tierTargetOf(tierOf(priorities, group), lm)
    projectGroup(list, target, projected)
  }

  const fits: PeakDayFit[] = []
  for (const d of days) {
    if (isOffDay(d) || d.exercises.length === 0) continue
    const minutes = estimateSessionMinutes(
      d.exercises.map((ex) => (projected.has(ex) ? { ...ex, workingSets: projected.get(ex)! } : ex)),
    )
    if (minutes < SESSION_LENGTH_BAND.min) fits.push({ day: d.day, minutes, direction: 'under' })
    else if (minutes > SESSION_LENGTH_BAND.max) fits.push({ day: d.day, minutes, direction: 'over' })
  }
  return fits
}
