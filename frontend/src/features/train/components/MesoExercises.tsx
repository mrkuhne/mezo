// ============================================================
// Mezo · MesoExercises (builder · Gyakorlatok) — the weekly exercise editor.
// Seeds LOCAL day-state from meso.days (deep-ish copy so edits never mutate the
// module const), renders an intro card with live totals, one collapsible
// DayExerciseSection per day, and a footer set-volume summary. Add/remove/pick
// all mutate the local state only (no persistence in Phase 1). The exercise
// picker (ExercisePickerSheet) opens per-day and appends to that day's list.
// Reorder is wired via the shared SortableList primitive (grip drag + ▲▼);
// each reorder mutates local state and fires the same full-list PUT as add/remove.
// Ported from prototype mesocycles.jsx MesoExercises.
// ============================================================
import { useState } from 'react'
import { useTrain } from '@/data/hooks'
import type { ExerciseLibraryItem, MesoDay, Mesocycle } from '@/data/types'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { Icon } from '@/shared/ui/Icon'
import { SafeMarkdown } from '@/shared/lib/safeMarkdown'
import { DayExerciseSection } from '@/features/train/components/DayExerciseSection'
import { ExercisePickerSheet } from '@/features/train/sheets/ExercisePickerSheet'

// Deep-ish clone of the meso days so local edits never mutate the data-layer
// module const (each day + its exercises array gets its own copy).
function seedDays(days: MesoDay[]): MesoDay[] {
  return days.map((d) => ({ ...d, exercises: d.exercises.map((e) => ({ ...e })) }))
}

// Sensible recipe defaults when promoting a library pick into a planned exercise.
function libraryToGymExercise(item: ExerciseLibraryItem): MesoDay['exercises'][number] {
  return {
    id: `${item.id}-${Date.now()}`,
    name: item.name,
    muscle: item.muscle,
    warmupSets: 2, workingSets: 3, repMin: 6, repMax: 8, targetRIR: 0,
    type: item.type,
    ...(item.catalogId ? { catalogId: item.catalogId } : {}),
  }
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
  const [expandedDay, setExpandedDay] = useState<string | null>(() => {
    const seeded = meso.days ?? []
    const current = seeded.find((d) => d.current)
    return current?.day ?? seeded.find((d) => d.exerciseCount > 0)?.day ?? seeded[0]?.day ?? null
  })

  // Planned / archived mesos have no day plan yet.
  if (!meso.days || meso.days.length === 0) {
    return (
      <div style={{ padding: '12px 24px' }}>
        <Eyebrow>Heti gyakorlat-terv csak aktív mesocikluson érhető el.</Eyebrow>
      </div>
    )
  }

  const totalExercises = days.reduce((a, d) => a + d.exercises.length, 0)
  const trainingDays = days.filter((d) => d.exercises.length > 0).length
  const totalSets = days.reduce((a, d) => a + d.exercises.reduce((b, e) => b + e.workingSets, 0), 0)

  const introBody =
    `**${totalExercises} gyakorlat · ${trainingDays} edzésnap.** ` +
    'Tappold a napot kibontáshoz · plusz/cserélj/törölj gyakorlatot · drag-rendezés.'

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
        {/* Intro card */}
        <div
          className="card"
          style={{ padding: 12, background: 'color-mix(in srgb, var(--coral) 3%, transparent)', marginBottom: 14 }}
        >
          <div className="row gap-sm" style={{ alignItems: 'flex-start' }}>
            <Icon name="sparkle" size={12} color="var(--coral)" />
            <div className="col flex-1">
              <Eyebrow brand>Heti gyakorlat-terv</Eyebrow>
              <p style={{ fontSize: 12, marginTop: 6, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
                <SafeMarkdown text={introBody} />
              </p>
            </div>
          </div>
        </div>

        {/* Per-day sections */}
        <div className="col gap-sm">
          {days.map((d) => (
            <DayExerciseSection
              key={d.day}
              day={d}
              expanded={expandedDay === d.day}
              onToggle={() => setExpandedDay((cur) => (cur === d.day ? null : d.day))}
              onAdd={() => setPickerDay(d.day)}
              onRemoveExercise={(exId) => removeExercise(d.day, exId)}
              onChangeExercise={(exId, patch) => updateExercise(d.day, exId, patch)}
              onReorderExercises={(ids) => reorderExercises(d.day, ids)}
            />
          ))}
        </div>
      </div>

      {/* Weekly volume summary */}
      <div style={{ padding: '16px 24px' }}>
        <div className="card" style={{ padding: 14 }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <Eyebrow>Heti szet-volumen</Eyebrow>
            <span className="label-mono" style={{ fontSize: 10, color: 'var(--coral)' }}>
              {totalSets} szet
            </span>
          </div>
          <p className="text-tertiary mt-sm" style={{ fontSize: 11, lineHeight: 1.45 }}>
            A Volumen view-ban izomcsoportonkénti MEV/MAV/MRV bontásban látod.
          </p>
        </div>
      </div>

      {pickerDay && (
        <ExercisePickerSheet
          onClose={() => setPickerDay(null)}
          onPick={(item) => addExercise(pickerDay, item)}
        />
      )}
    </div>
  )
}
