// ============================================================
// Mezo · CustomWorkoutBuilderPage — the "Saját edzés" composer (mezo-ws2x).
// Full-screen sibling route (/train/custom/new | /train/custom/:id): name +
// recipe exercise list (ExerciseRecipeRow + multi-add ExercisePickerSheet).
// "Mentés" persists via the custom-workout CRUD hooks; "Indítás ma" saves,
// then jumps into the active session pinned to the template (?day=).
// Üveg port (mezo-7ugb5, living prototype edzes.html#sajat): MozaikPage + glass back pill, a
// coral halo hero with the dumbbell art, ONE glass card for the name (a form is not a poster),
// flat summary rows that expand in place (one open at a time; a fresh pick opens itself), the
// dashed „Gyakorlat hozzáadása", ghost Mentés + lit coral „Indítás ma", plus loading /
// not-found ghosts so an unknown id no longer opens an empty form that saves a duplicate.
// ============================================================
import { useState, type CSSProperties } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useBackNav } from '@/shared/hooks/useBackNav'
import { useCustomWorkouts, useCustomWorkoutActions } from '@/data/hooks'
import type { CustomWorkoutUpsertRequest } from '@/data/train/trainApi'
import type { CustomWorkout, ExerciseLibraryItem, GymExercise } from '@/data/types'
import { Icon3D } from '@/shared/ui/clay'
import { MozaikPage, PageHead, PageHero } from '@/shared/ui/mozaik'
import { SortableList } from '@/shared/ui/SortableList'
import { ExerciseRecipeRow } from '@/features/train/components/ExerciseRecipeRow'
import { ExercisePickerSheet } from '@/features/train/sheets/ExercisePickerSheet'
import { libraryToGymExercise } from '@/features/train/logic/exerciseDefaults'

const CORAL = { '--c': 'var(--dv-coral)' } as CSSProperties

function toUpsert(name: string, exercises: GymExercise[]): CustomWorkoutUpsertRequest {
  return {
    name: name.trim(),
    exercises: exercises.map((e) => ({
      name: e.name, muscle: e.muscle,
      warmupSets: e.warmupSets, workingSets: e.workingSets,
      repMin: e.repMin, repMax: e.repMax, targetRIR: e.targetRIR,
      anchorWeightKg: e.anchorWeightKg, type: e.type, catalogId: e.catalogId,
      countsTowardVolume: e.countsTowardVolume,
    })),
  }
}

export function CustomWorkoutBuilderPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const goBack = useBackNav('/train/gym')
  const { customWorkouts, customPending } = useCustomWorkouts()
  const { createCustomWorkout, updateCustomWorkout, savePending } = useCustomWorkoutActions()
  const existing: CustomWorkout | null = customWorkouts.find((w) => w.id === id) ?? null

  const [name, setName] = useState('')
  const [exercises, setExercises] = useState<GymExercise[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  // One recipe row open at a time; a fresh pick opens itself.
  const [openId, setOpenId] = useState<string | null>(null)
  // Derived-state reset: real mode loads the template async — prefill once it lands.
  const [loadedId, setLoadedId] = useState<string | null>(null)
  if (existing && loadedId !== existing.id) {
    setLoadedId(existing.id)
    setName(existing.name)
    setExercises(existing.exercises)
  }

  const valid = name.trim().length > 0 && exercises.length > 0
  const totalSets = exercises.reduce((a, e) => a + e.workingSets, 0)
  const hint = !name.trim()
    ? 'Adj nevet az edzésnek.'
    : exercises.length === 0 ? 'Adj hozzá legalább egy gyakorlatot.' : null

  // null preset = the shared hypertrophy fallback (mezo-dq60) — same source of
  // truth the meso pickers use, so a plyo pick lands on its fixed weightless
  // PLYO_SCHEME instead of the flat compound-shaped default this page used to
  // hardcode (mezo-szsi item 1). anchorWeightKg is page-specific: the recipe
  // row's stepper starts at "auto" (null), not undefined.
  const addFromCatalog = (item: ExerciseLibraryItem) => {
    const next = { ...libraryToGymExercise(item, null), anchorWeightKg: null }
    setExercises((xs) => [...xs, next])
    setOpenId(next.id)
  }
  const move = (from: number, to: number) => setExercises((xs) => {
    const ys = [...xs]
    const [m] = ys.splice(from, 1)
    ys.splice(to, 0, m)
    return ys
  })
  const save = (onDone?: (saved?: CustomWorkout) => void) => {
    const body = toUpsert(name, exercises)
    if (existing) updateCustomWorkout({ id: existing.id, body }, { onSuccess: onDone })
    else createCustomWorkout(body, { onSuccess: onDone })
  }
  const startNow = () => save((saved) => {
    // Mock writes no-op (no id back) — the plain session route keeps prototype parity.
    navigate(saved?.id ? `/train/session?day=${saved.id}` : '/train/session', { replace: true })
  })

  // An id that resolves to nothing is either still loading or gone — never an empty "new" form.
  if (id && !existing) {
    return (
      <MozaikPage tone="coral" className="uvx-cw">
        <PageHead glass onBack={goBack} label="Vissza" />
        <p className="uvx-cw-ghost uv-empty" style={CORAL}>
          {customPending ? 'Betöltés…' : 'Ez a saját edzés nem található — lehet, hogy törölted.'}
        </p>
      </MozaikPage>
    )
  }

  return (
    <MozaikPage tone="coral" className="uvx-cw">
      <PageHead glass onBack={goBack} label="Vissza" />
      <PageHero
        art="t-dumbbell"
        accent="var(--dv-coral)"
        eyebrow="Saját edzés"
        name={existing ? 'Saját edzés' : 'Új saját edzés'}
        sub="Összerakod, amit ma csinálni akarsz. Elmentheted későbbre, vagy egyből elindíthatod."
      />

      {/* The one glass surface: the name — the input inside stays flat */}
      <label className="uvx-cw-name glass" style={CORAL}>
        <span className="uv-eyebrow">Edzés neve</span>
        <input
          className="uvs-inp"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="pl. Pihenőnapi felső"
          maxLength={120}
        />
      </label>

      <div className="uvx-cw-h">
        <span className="uv-eyebrow">Gyakorlatok</span>
        <em>{exercises.length} gyakorlat · {totalSets} szett</em>
      </div>

      {exercises.length === 0 ? (
        <p className="uvx-cw-empty">
          Még nincs gyakorlat. Add hozzá az elsőt — kap egy jó alapbeállítást, amit utána finomíthatsz.
        </p>
      ) : (
        <div className="uvx-cw-list">
          <SortableList
            chevrons="focus"
            items={exercises.map((e) => ({ ...e, label: e.name }))}
            onReorder={(ids) => setExercises((xs) => ids.flatMap((i) => xs.find((x) => x.id === i) ?? []))}
            renderItem={(e, i) => (
              <ExerciseRecipeRow
                ex={e}
                open={openId === e.id}
                onToggle={() => setOpenId((o) => (o === e.id ? null : e.id))}
                onRemove={() => {
                  setExercises((xs) => xs.filter((x) => x.id !== e.id))
                  setOpenId(null)
                }}
                onChange={(patch) => setExercises((xs) => xs.map((x) => (x.id === e.id ? { ...x, ...patch } : x)))}
                onMoveUp={i > 0 ? () => move(i, i - 1) : undefined}
                onMoveDown={i < exercises.length - 1 ? () => move(i, i + 1) : undefined}
              />
            )}
          />
        </div>
      )}

      <button type="button" className="uvx-cw-add uv-empty" onClick={() => setPickerOpen(true)}>
        <Icon3D name="t-addex" size={24} />Gyakorlat hozzáadása
      </button>

      <div className="uvx-cw-cta">
        <button
          type="button"
          className="uvx-cw-save"
          disabled={!valid || savePending}
          onClick={() => save(() => goBack())}
        >
          <Icon3D name="t-tick" size={18} />Mentés
        </button>
        <button
          type="button"
          className="uvs-primary"
          style={CORAL}
          disabled={!valid || savePending}
          onClick={startNow}
        >
          <Icon3D name="t-play" size={18} />Indítás ma
        </button>
      </div>
      {hint && <p className="uvx-cw-hint">{hint}</p>}

      {pickerOpen && (
        <ExercisePickerSheet dayLabel="Saját edzés" onPick={addFromCatalog} onClose={() => setPickerOpen(false)} />
      )}
    </MozaikPage>
  )
}
