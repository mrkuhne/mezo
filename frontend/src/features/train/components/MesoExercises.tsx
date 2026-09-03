// ============================================================
// Mezo · MesoExercises — the run's exercise editor. Seeds LOCAL day-state from
// meso.days (deep-ish copy so edits never mutate the module const), renders the
// shared unified MesoEditor (gradient hero, the collapsible weekly set-budget
// card, and the accordion exercise rows). Add/remove/change/reorder all mutate
// the local state only (Phase-1 UI) and fire a background full-list PUT when the
// day carries a real row id. The exercise picker (ExercisePickerSheet) opens for
// the active day and appends to that day's list.
//
// Two shapes, ONE component (mesocycle pages v2 Task 3, mezo-d20.15):
//   - no `day`  → the whole week (day tabs, the pre-v2 builder behaviour)
//   - `day="Hét"` → ONE day, from its own page (`MesoDayPage`). The editor gets
//     `days={[thatDay]}` (MesoEditor drops the tab strip at a single day) and
//     `weekDays={all}` so the week-scope derivations (bands, lint, peak-week fit)
//     still judge the day against the whole week — the ProgramDayView idiom.
// The in-cycle Fókusz (tier) picker is GONE (mesocycle pages v2): a running block's
// tiers are set at planning time; changing them mid-run silently re-planned the
// remaining weeks. The tier UX lives in the wizard (StepFocus) + the template editor.
// ============================================================
import { useState } from 'react'
import { useTrain } from '@/data/hooks'
import type { ExerciseLibraryItem, MesoDay, Mesocycle } from '@/data/types'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { MesoEditor } from '@/features/train/components/MesoEditor'
import { addExerciseWithDefaults } from '@/features/train/logic/exerciseDefaults'
import type { SessionTimingProfile } from '@/features/train/logic/sessionLength'
import { seedDays } from '@/features/train/logic/mesoDays'
import { ExercisePickerSheet } from '@/features/train/sheets/ExercisePickerSheet'

interface MesoExercisesProps {
  meso: Mesocycle
  /** Restricts the editor to ONE day (its `MesoDay.day` key) — the day page's shape. */
  day?: string
  /** Calibrated pacing (Task 12, mezo-dzbm), fetched by the calling page
   *  (MesocycleBuilderPage) and threaded down to MesoEditor — this component stays
   *  presentational, matching MesoEditor's own `timingProfile`/`timingProfilePending` props. */
  timingProfile?: SessionTimingProfile | null
  timingProfilePending?: boolean
}

export function MesoExercises({ meso, day, timingProfile, timingProfilePending }: MesoExercisesProps) {
  const { saveDayExercises } = useTrain()
  const [days, setDays] = useState<MesoDay[]>(() => seedDays(meso.days ?? []))
  // Read-only now: tiers are a planning-time decision (see the header note), so the
  // meso's stored map just feeds the editor's bands/lint.
  const priorities = meso.musclePriorities ?? {}

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
      countsTowardVolume: e.countsTowardVolume,
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
    const next = days.map((d) => (d.day === dayKey ? addExerciseWithDefaults(d, item, meso.goalPreset) : d))
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

  // Single-day mode edits ONE day but keeps the WEEK as the yardstick (weekDays) —
  // otherwise the weekly bands / lint / peak-week fit would read one Monday as a week.
  const edited = day ? days.filter((d) => d.day === day) : days
  if (day && edited.length === 0) return null

  return (
    <div className="col">
      <div style={{ padding: '12px 24px' }}>
        <MesoEditor
          days={edited}
          weekDays={day ? days : undefined}
          onAddClick={setPickerDay}
          onRemove={removeExercise}
          onChange={updateExercise}
          onReorder={reorderExercises}
          priorities={priorities}
          volumePerMuscle={meso.volumePerMuscle ?? undefined}
          timingProfile={timingProfile}
          timingProfilePending={timingProfilePending}
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
