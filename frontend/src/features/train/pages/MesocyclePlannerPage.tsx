// ============================================================
// Mezo · MesocyclePlannerPage — a mezociklus-varázsló v2 (mezo-d20.14):
// HÁROM lépés (Mikor és miért → Fókusz → Program) a /train/mesocycles/new
// teljes képernyős útján, a meso-body.html #page-wizard szerint.
//
// A régi 5 lépéses AI-tervező (Cél / Hossz+fázisok / Split+napok / Fókusz /
// Program) nyugdíjba ment: a napszám a splitet, a tierek a szetteket vezérlik,
// a program pedig a generátortól jön (mock: FE-váz, éles: a backend + Gemini).
//
// Két dolog, amit érdemes tudni erről az oldalról:
//  • a Program-lépés CSEMPE-HUB, nem hosszú görgetés — egy nap szerkesztése a
//    saját oldalán történik (`state.activeDay`), ami OLDAL-ÁLLAPOT, nem route:
//    a még nem mentett vázlat így éli túl a be-/kilépést (session-prep minta);
//  • generálás/mentés közben sosem üres a test — orb, retry vagy a kész blokk.
// A varázsló az állandó edzőtermi időpontokhoz NEM nyúl: a szlot ideje kötelező HH:mm, a
// varázsló pedig nem kérdez időpontot — kitalálni nem fog. A Heti nézet elviseli a hiányzó
// szlotot (deriveGymSchedule `time: null`-t ad), az időpont-szerkesztésnek saját felülete van.
// ============================================================
import { useReducer, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMesoPlanGenerate, useMesoTemplates } from '@/data/hooks'
import type { ExerciseLibraryItem, MesoDay } from '@/data/types'
import { addExerciseWithDefaults } from '@/features/train/logic/exerciseDefaults'
import { ExercisePickerSheet } from '@/features/train/sheets/ExercisePickerSheet'
import { ProgramDayView } from '@/features/train/wizard/ProgramDayView'
import { StepFocus } from '@/features/train/wizard/StepFocus'
import { StepProgram } from '@/features/train/wizard/StepProgram'
import { StepWhen, canLeaveStepWhen } from '@/features/train/wizard/StepWhen'
import {
  generateInput, initialWizardState, toUpsert, wizardReducer, type WizardState,
} from '@/features/train/wizard/wizardState'
import { localDateString } from '@/shared/lib/dates'
import { useBackNav } from '@/shared/hooks/useBackNav'
import { CtaGhost, CtaPrimary } from '@/shared/ui/Cta'
import { MozaikPage, PageBody, PageHead } from '@/shared/ui/mozaik'

const STEP_LABELS = ['Mikor és miért', 'Fókusz', 'Program'] as const

export function MesocyclePlannerPage() {
  const goBack = useBackNav('/train/mesocycles')
  const navigate = useNavigate()
  const [todayIso] = useState(() => localDateString())
  const [state, dispatch] = useReducer(wizardReducer, todayIso, initialWizardState)
  const { generate, generating } = useMesoPlanGenerate()
  const { createTemplate, startTemplate } = useMesoTemplates()
  const [failed, setFailed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [pickerDay, setPickerDay] = useState<string | null>(null)

  const runGenerate = async (from: WizardState) => {
    setFailed(false)
    setConfirming(false)
    const input = generateInput(from)
    try {
      dispatch({ type: 'generated', proposal: await generate(input), input })
    } catch {
      setFailed(true)
    }
  }

  const goToStep = (step: 0 | 1 | 2) => {
    dispatch({ type: 'step', step })
    // The proposal is generated once per visit to the Program step; a round-trip
    // back and forward keeps the plan (and every manual edit) as it was.
    if (step === 2 && !state.proposal) void runGenerate(state)
  }

  const editProgram = (program: MesoDay[]) => dispatch({ type: 'editProgram', program })

  const addExercise = (dayKey: string, item: ExerciseLibraryItem) =>
    editProgram(state.program.map((d) => (d.day === dayKey ? addExerciseWithDefaults(d, item, 'hypertrophy') : d)))

  const save = async (alsoStart: boolean) => {
    setSaving(true)
    try {
      const tpl = await createTemplate(toUpsert(state))
      if (!alsoStart) {
        navigate('/train/mesocycles')
        return
      }
      try {
        await startTemplate(tpl.id, { startDate: todayIso, status: 'active' })
        navigate('/train/gym')
      } catch {
        // The template IS saved; only the run stamping died — the library is where it
        // lives. Gym would pretend a block is running.
        navigate('/train/mesocycles')
      }
    } catch {
      setSaving(false)
    }
  }

  const activeDay = state.activeDay ? state.program.find((d) => d.day === state.activeDay) : undefined
  if (activeDay) {
    return (
      <>
        <ProgramDayView
          day={activeDay}
          program={state.program}
          priorities={state.priorities}
          volumePerMuscle={state.proposal?.template.volumePerMuscle ?? null}
          onBack={() => dispatch({ type: 'openDay', day: null })}
          onChange={(next) => editProgram(state.program.map((d) => (d.day === next.day ? next : d)))}
          onAdd={() => setPickerDay(activeDay.day)}
        />
        {pickerDay && (
          <ExercisePickerSheet
            dayLabel={`${activeDay.day} · ${activeDay.type}`}
            onClose={() => setPickerDay(null)}
            onPick={(item) => addExercise(pickerDay, item)}
          />
        )}
      </>
    )
  }

  const gateOpen = state.step !== 0 || canLeaveStepWhen(state)

  return (
    <MozaikPage tone="gold">
      <PageHead onBack={goBack} label="‹ Mezociklus">
        <span className="mz-stepct">0{state.step + 1} / 03 · {STEP_LABELS[state.step]}</span>
      </PageHead>
      <div className="mz-wprog">
        {STEP_LABELS.map((label, i) => (
          <button
            key={label}
            type="button"
            className={i <= state.step ? 'on' : undefined}
            aria-label={`${i + 1}. lépés · ${label}`}
            // Forward jumps stay closed — a later step has nothing to show yet.
            disabled={i > state.step}
            onClick={() => goToStep(i as 0 | 1 | 2)}
          />
        ))}
      </div>
      <PageBody>
        {state.step === 0 && <StepWhen state={state} dispatch={dispatch} />}
        {state.step === 1 && <StepFocus state={state} dispatch={dispatch} />}
        {state.step === 2 && (
          <StepProgram
            state={state}
            dispatch={dispatch}
            generating={generating}
            failed={failed}
            today={todayIso}
            onRegenerate={() => void runGenerate(state)}
            onSave={(alsoStart) => void save(alsoStart)}
            saving={saving}
            confirming={confirming}
            onConfirmChange={setConfirming}
            onDismissError={() => setFailed(false)}
          />
        )}

        {state.step < 2 && (
          <>
            {!gateOpen && (
              <p className="mz-stepnote">Válassz 2–6 edzésnapot a folytatáshoz.</p>
            )}
            <div className="mz-wfoot">
              <CtaPrimary disabled={!gateOpen} onClick={() => goToStep((state.step + 1) as 1 | 2)}>
                Tovább →
              </CtaPrimary>
              {state.step > 0 && <CtaGhost onClick={() => goToStep(0)}>← Vissza</CtaGhost>}
            </div>
          </>
        )}
      </PageBody>
    </MozaikPage>
  )
}
