// ============================================================
// Mezo · exerciseDefaults — library pick → planned GymExercise defaults,
// shared by the unified MesoEditor parents (builder MesoExercises + planner
// wizard + template editor). New exercises are filled from the goal-preset
// SCHEMES table (mezo-dq60): compound/isolation get preset-specific
// reps/RIR/sets, plyo always gets the fixed weightless PLYO_SCHEME and is
// exempt from the hypertrophy volume budget (mezo-gbo7) — via type alone
// (countsForVolume's `type !== 'plyo'` fallback), no explicit
// countsTowardVolume field, matching the generator's own plyo seed shape
// (mezo-szsi item 6).
// ============================================================
import type { ExerciseLibraryItem, GymExercise, MesoDay } from '@/data/types'
import { SCHEMES, PLYO_SCHEME } from '@/features/train/logic/planner'
import { suggestedWarmupSets } from '@/features/train/logic/warmupSuggest'

const parseReps = (reps: string): [number, number] => {
  const [lo, hi] = reps.split('-').map(Number)
  return [lo, hi ?? lo]
}

export function libraryToGymExercise(item: ExerciseLibraryItem, preset?: string | null): GymExercise {
  const base = {
    id: `${item.id}-${crypto.randomUUID()}`,
    name: item.name,
    muscle: item.muscle,
    type: item.type,
    ...(item.catalogId ? { catalogId: item.catalogId } : {}),
  }
  if (item.type === 'plyo') {
    return {
      ...base,
      warmupSets: 0,
      workingSets: PLYO_SCHEME.sets,
      repMin: PLYO_SCHEME.reps,
      repMax: PLYO_SCHEME.reps,
      targetRIR: 0,
      // No explicit countsTowardVolume (mezo-szsi item 6): both the ExerciseAccordionRow and
      // ExerciseRecipeRow "Számít a volumenbe" checkboxes read countsForVolume(ex), which
      // already falls back to `type !== 'plyo'` when the field is absent — so an explicit
      // `false` here was redundant and, worse, made the picker's plyo carry a field the
      // generator's plyo seed (planner.ts's inline PLYO_SCHEME object) never sets. Dropping it
      // gives both origins the identical shape (and the identical unchecked checkbox state).
    }
  }
  const scheme = (SCHEMES[preset ?? 'hypertrophy'] ?? SCHEMES.hypertrophy)[item.type]
  const [repMin, repMax] = parseReps(scheme.reps)
  return {
    ...base,
    warmupSets: item.type === 'compound' ? 2 : 1,
    workingSets: scheme.sets,
    repMin,
    repMax,
    targetRIR: scheme.rir,
  }
}

export function addExerciseWithDefaults(day: MesoDay, item: ExerciseLibraryItem, preset?: string | null): MesoDay {
  const ex = libraryToGymExercise(item, preset)
  const inserted = { ...day, exercises: [...day.exercises, ex], exerciseCount: day.exercises.length + 1 }
  const warmupSets = ex.type === 'plyo' ? 0 : suggestedWarmupSets(inserted, ex.id)
  return { ...inserted, exercises: inserted.exercises.map((e) => (e.id === ex.id ? { ...e, warmupSets } : e)) }
}
