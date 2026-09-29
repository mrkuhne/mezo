// ============================================================
// Mezo · mock-mode mid-workout swap/add (mezo-mobji). Real mode gets the refreshed plan from
// the server (POST /workouts/{id}/exercises returns `today`); mock mode has a static fixture,
// so the hook keeps the edits in a client-owned cache and replays them over the fixture with
// the same placement rules as the backend's SessionExerciseAssembler: a swap takes the slot
// (or goes right after a swapped-out exercise that keeps its logged sets), an add goes last.
// ============================================================
import type { LoggedWorkoutExercise, WorkoutPlan } from '@/data/types'
import type { WorkoutExerciseChangeRequest } from '@/data/train/trainApi'

export interface MockWorkoutEdit {
  id: string
  req: WorkoutExerciseChangeRequest
  /** Working sets already logged on the replaced exercise — decides keep vs drop. */
  loggedOnReplaced: number
}

/** The exercise a mock edit creates — no history, no prescription (the fixture has none). */
export function mockExerciseFor(edit: MockWorkoutEdit, replacesName: string | null): LoggedWorkoutExercise {
  const { req } = edit
  return {
    id: edit.id,
    name: req.name,
    muscle: req.muscle,
    // No prescription in mock → a warm-up slot would render as a visible row; keep it off.
    warmupSets: 0,
    workingSets: req.workingSets,
    repMin: req.repMin,
    repMax: req.repMax,
    targetRIR: req.targetRIR,
    anchorWeightKg: null,
    type: req.type,
    sets: req.workingSets,
    prescribedSets: null,
    rationale: null,
    progression: null,
    lastWeek: null,
    note: null,
    changeScope: req.scope,
    replacesName,
    replacedByName: null,
    planSlot: false,
  }
}

export function applyMockEdits(plan: WorkoutPlan, edits: MockWorkoutEdit[]): WorkoutPlan {
  if (edits.length === 0) return plan
  let list = [...plan.exercises]
  for (const edit of edits) {
    const at = edit.req.replacesExerciseId ? list.findIndex((e) => e.id === edit.req.replacesExerciseId) : -1
    if (at < 0) {
      list = [...list, mockExerciseFor(edit, null)]
      continue
    }
    const old = list[at]
    const created = mockExerciseFor(edit, old.name)
    if (edit.loggedOnReplaced > 0) {
      const kept: LoggedWorkoutExercise = {
        ...old,
        workingSets: edit.loggedOnReplaced,
        sets: old.warmupSets + edit.loggedOnReplaced,
        replacedByName: created.name,
        planSlot: false,
      }
      list = [...list.slice(0, at), kept, created, ...list.slice(at + 1)]
    } else {
      list = [...list.slice(0, at), created, ...list.slice(at + 1)]
    }
  }
  return { ...plan, exercises: list }
}
