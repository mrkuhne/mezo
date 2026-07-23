// ============================================================
// Mezo · CustomWorkoutBuilderPage — the "Saját edzés" composer (mezo-ws2x).
// Full-screen sibling route (/train/custom/new | /train/custom/:id): name +
// recipe exercise list (shared ExerciseRecipeRow + multi-add ExercisePickerSheet).
// "Mentés" persists via the custom-workout CRUD hooks; "Indítás ma →" saves,
// then jumps into the active session pinned to the template (?day=).
// ============================================================
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useCustomWorkouts, useCustomWorkoutActions } from '@/data/hooks'
import type { CustomWorkoutUpsertRequest } from '@/data/train/trainApi'
import type { CustomWorkout, ExerciseLibraryItem, GymExercise } from '@/data/types'
import { Icon } from '@/shared/ui/Icon'
import { SortableList } from '@/shared/ui/SortableList'
import { ExerciseRecipeRow } from '@/features/train/components/ExerciseRecipeRow'
import { ExercisePickerSheet } from '@/features/train/sheets/ExercisePickerSheet'

const DEFAULT_RECIPE = { warmupSets: 1, workingSets: 3, repMin: 8, repMax: 12, targetRIR: 1 } as const

function toUpsert(name: string, exercises: GymExercise[]): CustomWorkoutUpsertRequest {
  return {
    name: name.trim(),
    exercises: exercises.map((e) => ({
      name: e.name, muscle: e.muscle,
      warmupSets: e.warmupSets, workingSets: e.workingSets,
      repMin: e.repMin, repMax: e.repMax, targetRIR: e.targetRIR,
      anchorWeightKg: e.anchorWeightKg, type: e.type, catalogId: e.catalogId,
    })),
  }
}

export function CustomWorkoutBuilderPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { customWorkouts } = useCustomWorkouts()
  const { createCustomWorkout, updateCustomWorkout, savePending } = useCustomWorkoutActions()
  const existing: CustomWorkout | null = customWorkouts.find((w) => w.id === id) ?? null

  const [name, setName] = useState('')
  const [exercises, setExercises] = useState<GymExercise[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  // Derived-state reset: real mode loads the template async — prefill once it lands.
  const [loadedId, setLoadedId] = useState<string | null>(null)
  if (existing && loadedId !== existing.id) {
    setLoadedId(existing.id)
    setName(existing.name)
    setExercises(existing.exercises)
  }

  const valid = name.trim().length > 0 && exercises.length > 0
  const totalSets = exercises.reduce((a, e) => a + e.workingSets, 0)

  const addFromCatalog = (item: ExerciseLibraryItem) => {
    setExercises((xs) => [...xs, {
      id: crypto.randomUUID(), name: item.name, muscle: item.muscle, type: item.type,
      ...DEFAULT_RECIPE, anchorWeightKg: null, catalogId: item.catalogId,
    }])
  }
  const save = (onDone?: (saved?: CustomWorkout) => void) => {
    const body = toUpsert(name, exercises)
    if (existing) updateCustomWorkout({ id: existing.id, body }, { onSuccess: onDone })
    else createCustomWorkout(body, { onSuccess: onDone })
  }
  const startNow = () => save((saved) => {
    // Mock writes no-op (no id back) — the plain session route keeps prototype parity.
    navigate(saved?.id ? `/train/session?day=${saved.id}` : '/train/session', { replace: true })
  })

  return (
    <>
      <div className="pghead-np">
        <div>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="over"
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
          >
            ← Edzés · Saját edzés
          </button>
          <h1>{existing ? 'Saját edzés' : 'Új saját edzés'}</h1>
        </div>
      </div>

      <div style={{ padding: '0 24px 12px' }}>
        <label className="col gap-xs" style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
          Edzés neve
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="pl. Pihenőnapi felső"
            maxLength={120}
            className="card"
            style={{ padding: '10px 12px', fontSize: 14, color: 'var(--text-primary)', background: 'var(--surface-1)' }}
          />
        </label>
      </div>

      <div style={{ padding: '0 24px 12px' }}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
          <span className="eyebrow">Gyakorlatok</span>
          <span className="label-mono text-tertiary" style={{ fontSize: 9 }}>
            {exercises.length} gyakorlat · {totalSets} szett
          </span>
        </div>
        <div className="col gap-sm">
          <SortableList
            items={exercises.map((e) => ({ ...e, label: e.name }))}
            onReorder={(ids) => setExercises((xs) => ids.flatMap((i) => xs.find((x) => x.id === i) ?? []))}
            renderItem={(e) => (
              <ExerciseRecipeRow
                ex={e}
                onRemove={() => setExercises((xs) => xs.filter((x) => x.id !== e.id))}
                onChange={(patch) => setExercises((xs) => xs.map((x) => (x.id === e.id ? { ...x, ...patch } : x)))}
              />
            )}
          />
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="card"
            style={{
              padding: 12, width: '100%', background: 'transparent', borderStyle: 'dashed',
              borderColor: 'var(--line)', color: 'var(--tag-gym)', fontSize: 10,
              letterSpacing: '0.14em', textTransform: 'uppercase',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <Icon name="plus" size={12} /> Gyakorlat hozzáadása
          </button>
        </div>
      </div>

      <div className="row gap-sm" style={{ padding: '0 24px 32px' }}>
        <button
          type="button"
          disabled={!valid || savePending}
          onClick={() => save(() => navigate(-1))}
          className="card np-press"
          style={{ flex: 1, padding: '12px 16px', textAlign: 'center', fontSize: 12, color: 'var(--text-primary)' }}
        >
          Mentés
        </button>
        <button
          type="button"
          disabled={!valid || savePending}
          onClick={startNow}
          className="np-cta np-press"
          style={{ flex: 2 }}
        >
          Indítás ma →
        </button>
      </div>

      {pickerOpen && (
        <ExercisePickerSheet dayLabel="Saját edzés" onPick={addFromCatalog} onClose={() => setPickerOpen(false)} />
      )}
    </>
  )
}
