// ============================================================
// Mezo · exerciseDefaults — library pick → planned GymExercise defaults,
// shared by the unified MesoEditor parents (builder MesoExercises + planner
// wizard). New exercises default to VOLUME style (targetRIR 2, mezo-7rdg) —
// the Failure/Volume toggle flips RIR to 0/2 afterwards.
// ============================================================
import type { ExerciseLibraryItem, GymExercise } from '@/data/types'

export function libraryToGymExercise(item: ExerciseLibraryItem): GymExercise {
  return {
    id: `${item.id}-${crypto.randomUUID()}`,
    name: item.name,
    muscle: item.muscle,
    warmupSets: 2, workingSets: 3, repMin: 6, repMax: 8, targetRIR: 2,
    type: item.type,
    ...(item.catalogId ? { catalogId: item.catalogId } : {}),
  }
}
