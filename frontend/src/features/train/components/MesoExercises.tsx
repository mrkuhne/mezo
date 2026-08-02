// ============================================================
// Mezo · MesoExercises (builder · Gyakorlatok) — the weekly exercise editor.
// Seeds LOCAL day-state from meso.days (deep-ish copy so edits never mutate the
// module const), renders the shared unified MesoEditor (gradient hero, the
// collapsible weekly set-budget card, and the day-tabbed accordion exercise
// rows). Add/remove/change/reorder all mutate the local state only (Phase-1
// UI) and fire a background full-list PUT when the day carries a real row id.
// The exercise picker (ExercisePickerSheet) opens for the active day and
// appends to that day's list.
// Ported from prototype mesocycles.jsx MesoExercises.
// ============================================================
import { useState } from 'react'
import { useTrain } from '@/data/hooks'
import type { ExerciseLibraryItem, MesoDay, Mesocycle } from '@/data/types'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { MesoEditor } from '@/features/train/components/MesoEditor'
import { libraryToGymExercise } from '@/features/train/logic/exerciseDefaults'
import { ExercisePickerSheet } from '@/features/train/sheets/ExercisePickerSheet'

// Deep-ish clone of the meso days so local edits never mutate the data-layer
// module const (each day + its exercises array gets its own copy).
function seedDays(days: MesoDay[]): MesoDay[] {
  return days.map((d) => ({ ...d, exercises: d.exercises.map((e) => ({ ...e })) }))
}

export function MesoExercises({ meso }: { meso: Mesocycle }) {
  const { saveDayExercises } = useTrain()
  const [days, setDays] = useState<MesoDay[]>(() => seedDays(meso.days ?? []))

  // T1 persistence: each add/remove keeps the synchronous local update (instant UI,
  // Phase-1 behavior) and fires a background full-list PUT when the day carries a real
  // row id. Mock fixtures have no day id -> local-only, exactly as before.
  const persistDay = (day: MesoDay | undefined) => {
    if (!day?.id) return
    saveDayExercises(meso.id, day.id, day.exercises.map((e) => ({
      name: e.name, muscle: e.muscle,
      warmupSets: e.warmupSets, workingSets: e.workingSets,
      repMin: e.repMin, repMax: e.repMax, targetRIR: e.targetRIR,
      anchorWeightKg: e.anchorWeightKg, type: e.type, warning: e.warning, catalogId: e.catalogId,
    })))
  }
  // The day (by `day` key) whose picker is open, or null when closed.
  const [pickerDay, setPickerDay] = useState<string | null>(null)

  // Planned / archived mesos have no day plan yet.
  if (!meso.days || meso.days.length === 0) {
    return (
      <div style={{ padding: '12px 24px' }}>
        <Eyebrow>Heti gyakorlat-terv csak aktív mesocikluson érhető el.</Eyebrow>
      </div>
    )
  }

  const removeExercise = (dayKey: string, exId: string) => {
    const next = days.map((d) => {
      if (d.day !== dayKey) return d
      const exercises = d.exercises.filter((e) => e.id !== exId)
      return { ...d, exercises, exerciseCount: exercises.length }
    })
    setDays(next)
    persistDay(next.find((d) => d.day === dayKey))
  }

  // Applies a recipe patch (warmup/working/rep-range/RIR) to one exercise and
  // fires the same full-list PUT as add/remove. Mock fixtures (no day id) stay local.
  const updateExercise = (dayKey: string, exId: string, patch: Partial<MesoDay['exercises'][number]>) => {
    const next = days.map((d) => {
      if (d.day !== dayKey) return d
      const exercises = d.exercises.map((e) => (e.id === exId ? { ...e, ...patch } : e))
      return { ...d, exercises }
    })
    setDays(next)
    persistDay(next.find((d) => d.day === dayKey))
  }

  const addExercise = (dayKey: string, item: ExerciseLibraryItem) => {
    const next = days.map((d) => {
      if (d.day !== dayKey) return d
      const exercises = [...d.exercises, libraryToGymExercise(item)]
      return { ...d, exercises, exerciseCount: exercises.length }
    })
    setDays(next)
    persistDay(next.find((d) => d.day === dayKey))
  }

  const reorderExercises = (dayKey: string, ids: string[]) => {
    const next = days.map((d) => {
      if (d.day !== dayKey) return d
      const byId = new Map(d.exercises.map((e) => [e.id, e]))
      const exercises = ids.map((id) => byId.get(id)).filter(Boolean) as typeof d.exercises
      return { ...d, exercises }
    })
    setDays(next)
    persistDay(next.find((d) => d.day === dayKey))
  }

  return (
    <div className="col">
      <div style={{ padding: '12px 24px' }}>
        <MesoEditor
          days={days}
          onAddClick={setPickerDay}
          onRemove={removeExercise}
          onChange={updateExercise}
          onReorder={reorderExercises}
        />
      </div>

      {pickerDay && (
        <ExercisePickerSheet
          dayLabel={(() => {
            const d = days.find((x) => x.day === pickerDay)
            return d ? `${d.day} · ${d.type}` : undefined
          })()}
          onClose={() => setPickerDay(null)}
          onPick={(item) => addExercise(pickerDay, item)}
        />
      )}
    </div>
  )
}
