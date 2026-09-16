// ============================================================
// Mezo · Ceremony score math — pure, React-free.
//
// Ported from the prototype (docs/design_2.0/prototypes/companion-titanium/
// session-state.js:203-254 — starsFor/sessionScore; session.js:278-289 —
// VERDICTS/muscleStarRows) onto the production Session model. No side
// effects: every function is a pure read of Session + the exercise list.
// ============================================================
import type { LoggedWorkoutExercise } from '@/data/types'
import { MUSCLE_LABELS } from '@/data/train/train'
import { effectiveSetCount, prescribedAt, type Session } from './workoutState'

export interface CerScore {
  target: { sets: number; reps: number; volume: number }
  done: { sets: number; reps: number; volume: number }
  /** Mean of the three shares (sets/reps/volume), each capped at 1. */
  ratio: number
  /** starsFor(ratio), in halves. */
  stars: number
}

/** Stars in halves from a 0..1 ratio: round(ratio*10)/2, clamped 0..5. */
export function starsFor(ratio: number): number {
  return Math.max(0, Math.min(5, Math.round(Math.max(0, ratio) * 10) / 2))
}

/**
 * Prototype session-state.js:236-254 ported to the production Session: targets
 * come from prescribedAt per slot (kg x reps; a slot with no prescription
 * contributes its logged values to done but nothing to target), done from
 * s.logged. Skipped exercises still count in target — skipping is missed
 * work (prototype rule) — so this deliberately does not consult s.skipped.
 */
export function cerScore(s: Session, exercises: LoggedWorkoutExercise[]): CerScore {
  const target = { sets: 0, reps: 0, volume: 0 }
  const done = { sets: 0, reps: 0, volume: 0 }
  for (const ex of exercises) {
    const id = ex.id
    const count = effectiveSetCount(s, id)
    for (let idx = 0; idx < count; idx++) {
      const prescription = prescribedAt(s, id, idx)
      if (!prescription) continue
      target.sets += 1
      target.reps += prescription.targetReps
      target.volume += (prescription.targetWeightKg ?? 0) * prescription.targetReps
    }
    const logged = s.logged[id] ?? []
    done.sets += logged.length
    for (const set of logged) {
      done.reps += set.reps
      done.volume += set.weight * set.reps
    }
  }
  const part = (a: number, b: number) => (b ? Math.min(1, a / b) : 0)
  const ratio =
    (part(done.sets, target.sets) + part(done.reps, target.reps) + part(done.volume, target.volume)) / 3
  return { target, done, ratio, stars: starsFor(ratio) }
}

/** VERDICTS ladder verbatim: first entry whose min <= stars. */
const VERDICTS: Array<[number, string]> = [
  [5, 'Hibátlan nap.'],
  [4, 'Erős nap.'],
  [3, 'Rendben volt.'],
  [1.5, 'Elindult.'],
  [0, 'Ma nem jött össze.'],
]

export function verdictFor(stars: number): string {
  const found = VERDICTS.find(([min]) => stars >= min)
  return (found ?? VERDICTS[VERDICTS.length - 1])[1]
}

export interface MuscleStarRow {
  /** Taxonomy token (BodyMap/MuscleChip key). */
  muscle: string
  /** Hungarian display name. */
  label: string
  done: number
  plan: number
  ratio: number
  stars: number
}

/**
 * Today's per-muscle rows from the session: plan = effectiveSetCount summed
 * per exercise.muscle (skipped exercises included in plan), done = logged
 * counts; sorted desc by done then plan; empty plan rows dropped.
 */
export function muscleStarRows(s: Session, exercises: LoggedWorkoutExercise[]): MuscleStarRow[] {
  const rows = new Map<string, { done: number; plan: number }>()
  for (const ex of exercises) {
    const entry = rows.get(ex.muscle) ?? { done: 0, plan: 0 }
    entry.plan += effectiveSetCount(s, ex.id)
    entry.done += s.logged[ex.id]?.length ?? 0
    rows.set(ex.muscle, entry)
  }
  const result: MuscleStarRow[] = []
  for (const [muscle, { done, plan }] of rows) {
    if (plan === 0) continue
    const ratio = plan ? Math.min(1, done / plan) : 0
    result.push({ muscle, label: MUSCLE_LABELS[muscle] ?? muscle, done, plan, ratio, stars: starsFor(ratio) })
  }
  result.sort((a, b) => b.done - a.done || b.plan - a.plan)
  return result
}
