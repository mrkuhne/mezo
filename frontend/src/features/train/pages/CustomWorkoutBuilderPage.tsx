// ============================================================
// Mezo · CustomWorkoutBuilderPage — the „Saját edzés" composer (mezo-ws2x; Folyadék
// mezo-n4wf5.3, prototype vilagos/edzes.js `sajat()`; states `.uj` · `.betolt` · `.nincs`).
// Full-screen sibling route (/train/custom/new | /train/custom/:id).
// The hero holds the name field and the workout poured into one vessel (a layer per exercise,
// as wide as its working sets); „Indítás ma" and „Mentés" sit on its liquid row, with the
// sentence naming what is still missing. Section 1 is the exercise list: summary rows that
// open in place (one at a time; a fresh pick opens itself), drag to reorder, and the add link
// that opens the multi-add ExercisePickerSheet. „Mentés" persists via the custom-workout CRUD
// hooks; „Indítás ma" saves, then jumps into the active session pinned to the template (?day=).
// An id that resolves to nothing shows the loading / not-found vessel, never an empty form.
// ============================================================
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useBackNav } from '@/shared/hooks/useBackNav'
import { useCustomWorkouts, useCustomWorkoutActions } from '@/data/hooks'
import type { CustomWorkoutUpsertRequest } from '@/data/train/trainApi'
import type { CustomWorkout, ExerciseLibraryItem, GymExercise } from '@/data/types'
import { SortableList } from '@/shared/ui/SortableList'
import { Acts, Btn, Card, EmptyTank, FrameBack, Hero, Input, Lab, Legend, Lk, Note, Page, Pour, Section, useFrameTitle } from '@/shared/ui/folyadek'
import { deepMuscle } from '@/features/train/components/folyadek'
import { ExerciseRecipeRow } from '@/features/train/components/ExerciseRecipeRow'
import { ExercisePickerSheet } from '@/features/train/sheets/ExercisePickerSheet'
import { libraryToGymExercise } from '@/features/train/logic/exerciseDefaults'

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

  useFrameTitle({ title: existing || id ? 'Saját edzés' : 'Új saját edzés', eyebrow: 'Edzés' })
  const back = <FrameBack history fallback="/train/gym" className="ee-back">‹</FrameBack>

  // An id that resolves to nothing is either still loading or gone — never an empty "new" form.
  if (id && !existing) {
    return (
      <Page className="ee-page">
        {back}
        <Card>
          <EmptyTank icon={customPending ? 't-clock' : 't-other'}>
            {customPending ? 'Betöltés…' : 'Ez a saját edzés nem található — lehet, hogy törölted.'}
          </EmptyTank>
        </Card>
      </Page>
    )
  }

  return (
    <Page className="ee-page">
      {back}
      <Hero className="ee-hero" label="Saját edzés" verdict="Összerakod, amit ma csinálni akarsz."
        sub="Elmentheted későbbre, vagy egyből elindíthatod."
        actions={(
          <>
            <Btn disabled={!valid || savePending} onClick={startNow}>Indítás ma</Btn>
            <Btn ghost disabled={!valid || savePending} onClick={() => save(() => goBack())}>Mentés</Btn>
            {hint && <p className="ee-hint">{hint}</p>}
          </>
        )}>
        <Lab htmlFor="cw-name">Edzés neve</Lab>
        <Input id="cw-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="pl. Pihenőnapi felső" maxLength={120} />
        <Pour parts={exercises.map((e) => ({ n: e.workingSets, color: deepMuscle(e.muscle) }))}
          aria-label={exercises.length ? `${totalSets} szett, ${exercises.length} gyakorlat` : undefined}
          empty="üres — ide töltődnek a gyakorlatok" />
        {exercises.length > 0 && (
          <Legend items={exercises.map((e) => ({ color: deepMuscle(e.muscle), label: <>{e.name.split(' ')[0]} <b>{e.workingSets}</b></> }))} />
        )}
      </Hero>

      <Section n={1} title={`Gyakorlatok · ${exercises.length} gyakorlat · ${totalSets} szett`} />
      <Card className="ee-list">
        {exercises.length === 0 ? (
          <EmptyTank icon="t-dumbbell">
            Még nincs gyakorlat. Add hozzá az elsőt — kap egy jó alapbeállítást, amit utána finomíthatsz.
          </EmptyTank>
        ) : (
          <>
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
            <Note>Húzd a sorokat a sorrendhez, koppints egyre a beállításaihoz.</Note>
          </>
        )}
        <Acts>
          <Lk onClick={() => setPickerOpen(true)}>＋ Gyakorlat hozzáadása</Lk>
        </Acts>
      </Card>

      {pickerOpen && (
        <ExercisePickerSheet dayLabel="Saját edzés" onPick={addFromCatalog} onClose={() => setPickerOpen(false)} />
      )}
    </Page>
  )
}
