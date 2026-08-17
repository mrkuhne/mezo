// ============================================================
// Mezo · meso day helpers — the two mappings every day-plan editor needs:
// seeding editable local state off a days array, and turning that state back
// into the contract's day-input list. Shared by MesoExercises (the run's
// weekly editor), MesoTemplateEditorPage (the template editor) and the
// planner's terminal save (mezo-meyc.1).
// ============================================================
import type { MesoDay } from '@/data/types'
import type { MesoDayInput } from '@/data/train/trainApi'

/**
 * Deep-ish clone of a days array so local edits never mutate the data-layer
 * module const (each day + its exercises array gets its own copy).
 */
export function seedDays(days: MesoDay[]): MesoDay[] {
  return days.map((d) => ({ ...d, exercises: d.exercises.map((e) => ({ ...e })) }))
}

/**
 * Domain days -> the contract's upsert day list. ALL days travel (rest days
 * included) so the saved plan mirrors the seed/template shape; exercise ids are
 * deliberately dropped — the server regenerates them on every full write.
 */
export function toDayInputs(days: MesoDay[]): MesoDayInput[] {
  return days.map((d) => ({
    day: d.day,
    type: d.type,
    muscle: d.muscle,
    muscleAccent: d.muscleAccent || undefined,
    note: d.note,
    exercises: d.exercises.map((e) => ({
      name: e.name, muscle: e.muscle,
      warmupSets: e.warmupSets, workingSets: e.workingSets,
      repMin: e.repMin, repMax: e.repMax, targetRIR: e.targetRIR,
      anchorWeightKg: e.anchorWeightKg, type: e.type, warning: e.warning, catalogId: e.catalogId,
    })),
  }))
}
