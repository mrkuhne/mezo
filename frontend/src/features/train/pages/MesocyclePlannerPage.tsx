// ============================================================
// Mezo · MesocyclePlannerPage — a mezociklus-varázsló v3 (mezo-yty6):
// EGY kérdező képernyő (InterviewStep) → generálás → a KÖZÖS MesoWeekEditor
// draft módban. A régi 3 lépés + progress-sáv és a külön ProgramDayView
// nyugdíjba ment: a sablon-szerkesztés ugyanezt a szerkesztőt nyitja, így
// ugyanarra a feladatra nincs többé kétféle UI.
//
// A draft VÉGIG memóriában él (wizardState) és a nap-megnyitás OLDAL-ÁLLAPOT,
// nem route — a még nem mentett vázlat így éli túl a be-/kilépést.
//
// Három hard-won viselkedés, ami a 3-lépéses varázslóból ÁTJÖTT (mezo-d20.14
// review, I4 + a dirty-confirm), mert mindegyik egy valódi hibára született:
//  • generálás közben/után sosem üres a test — az ELSŐ sikertelen generálás
//    újrapróbáló csíkot kap az interjún (a szerkesztőt el sem érte a user);
//  • egy sikertelen ÚJRA-generálás nem dobhatja el az álló (esetleg kézzel
//    szerkesztett) programot: a program marad, a hiba inline csík a láblécben;
//  • kézi szerkesztés után az újragenerálás ELŐBB megerősítést kér.
// A varázsló az állandó edzőtermi időpontokhoz NEM nyúl: a szlot ideje kötelező
// HH:mm, a varázsló pedig nem kérdez időpontot — kitalálni nem fog.
// ============================================================
import { useEffect, useReducer, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMesoPlanGenerate, useMesoTemplates, useTimingProfile } from '@/data/hooks'
import { reportDraftOutcome } from '@/data/aidraft/outcomeClient'
import type { ExerciseLibraryItem, GymExercise, MesoDay } from '@/data/types'
import { MesoWeekEditor } from '@/features/train/components/MesoWeekEditor'
import { addExerciseWithDefaults } from '@/features/train/logic/exerciseDefaults'
import { splitLine } from '@/features/train/logic/mesoPlan'
import { isOffDay } from '@/features/train/logic/offDay'
import { ExercisePickerSheet } from '@/features/train/sheets/ExercisePickerSheet'
import { InterviewStep } from '@/features/train/wizard/InterviewStep'
import {
  generateInput, initialWizardState, toUpsert, wizardReducer, type WizardState,
} from '@/features/train/wizard/wizardState'
import { localDateString } from '@/shared/lib/dates'
import { useBackNav } from '@/shared/hooks/useBackNav'
import { CtaGhost, CtaPrimary } from '@/shared/ui/Cta'
import { MozaikPage, PageBody, PageHead } from '@/shared/ui/mozaik'

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
  // pages/ own data fetching; the editor stays presentational (frontend_conventions).
  const { data: timingProfile, isPending: timingProfilePending } = useTimingProfile()

  // --- draft outcome signals (mezo-76f6), feature slug 'train_meso_plan' ---
  // Holds the CURRENT generated proposal's draftId while it is still unresolved (neither saved
  // nor already reported as discarded); null once resolved or before the first generation.
  // `state.dirty` (wizardState.ts) IS the "edited" signal for free — it already tracks "a manual
  // edit landed since the last generation", reset on every fresh 'generated'.
  const pendingDraftIdRef = useRef<string | null>(null)
  const resolvePending = (outcome: 'accepted' | 'edited' | 'discarded') => {
    const id = pendingDraftIdRef.current
    if (!id) return
    pendingDraftIdRef.current = null
    reportDraftOutcome(id, 'train_meso_plan', outcome)
  }
  // Leaving the planner (back-nav or any other unmount) with an unresolved proposal still
  // sitting in state is a discard. Mount-once so the cleanup fires exactly on unmount.
  useEffect(() => {
    return () => resolvePending('discarded')
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-once: the cleanup must fire exactly on unmount
  }, [])

  const runGenerate = async (from: WizardState) => {
    setFailed(false)
    setConfirming(false)
    try {
      const proposal = await generate(generateInput(from))
      // Regenerating (or the rare case of a second first-run) abandons whatever proposal was
      // still unresolved — its own discard fires HERE, because by unmount time `state.proposal`
      // will already be the NEW one and the old draftId would be lost.
      resolvePending('discarded')
      pendingDraftIdRef.current = proposal.draftId
      dispatch({ type: 'generated', proposal })
      dispatch({ type: 'step', step: 'editor' })
    } catch {
      // A failed FIRST generation leaves `step` on the interview (there is nothing else to
      // show); a failed RE-generation keeps the standing program and only raises the strip.
      setFailed(true)
    }
  }

  /** Kézi szerkesztés után az újragenerálás előbb megerősítést kér. */
  const regenerate = () => {
    if (state.dirty) setConfirming(true)
    else void runGenerate(state)
  }

  const editProgram = (program: MesoDay[]) => dispatch({ type: 'editProgram', program })

  const patchDay = (dayKey: string, fn: (d: MesoDay) => MesoDay) =>
    editProgram(state.program.map((d) => (d.day === dayKey ? fn(d) : d)))

  const withExercises = (d: MesoDay, exercises: GymExercise[]): MesoDay =>
    ({ ...d, exercises, exerciseCount: exercises.length })

  const save = async (alsoStart: boolean) => {
    setSaving(true)
    try {
      const tpl = await createTemplate(toUpsert(state))
      // Accepted moment (mezo-76f6 ruling): a successful createTemplate FROM a generated
      // proposal — start (below) is irrelevant to this signal, so it fires unconditionally here.
      resolvePending(state.dirty ? 'edited' : 'accepted')
      if (!alsoStart) {
        navigate('/train/mesocycles')
        return
      }
      try {
        await startTemplate(tpl.id, { startDate: todayIso, status: 'active' })
        navigate('/train/gym')
      } catch {
        // The template IS saved; only the run stamping died — the library is where it lives.
        navigate('/train/mesocycles')
      }
    } catch {
      setSaving(false)
    }
  }

  if (state.step === 'editor') {
    // The day strip shows TRAINING days; the rest days stay in `state.program` so the save
    // still writes the whole 7-day week.
    const trainingDays = state.program.filter((d) => !isOffDay(d) && d.type !== 'Rest')
    const open = pickerDay ? state.program.find((d) => d.day === pickerDay) : undefined
    return (
      <>
        <MesoWeekEditor
          mode="draft"
          name={state.name}
          meta={`${state.weeks} hét · ${splitLine(state.daysOfWeek)}`}
          note={state.proposal?.rationale}
          days={trainingDays}
          priorities={state.priorities}
          volumePerMuscle={state.proposal?.template.volumePerMuscle ?? null}
          timingProfile={timingProfile}
          timingProfilePending={timingProfilePending}
          activeDay={state.activeDay}
          onOpenDay={(day) => {
            dispatch({ type: 'openDay', day })
            // A closing day page must not leave the exercise picker able to reopen against a
            // stale day (mezo-yty6 fix round 1).
            if (day === null) setPickerDay(null)
          }}
          onBack={goBack}
          onRename={(name) => dispatch({ type: 'setName', name })}
          onRenameDay={(day, name) => dispatch({ type: 'renameDay', day, name })}
          onChangeExercise={(dayKey, exId, patch) => patchDay(dayKey, (d) =>
            withExercises(d, d.exercises.map((e) => (e.id === exId ? { ...e, ...patch } : e))))}
          onMoveExercise={(dayKey, exId, dir) => patchDay(dayKey, (d) => {
            const i = d.exercises.findIndex((e) => e.id === exId)
            const j = i + dir
            if (i < 0 || j < 0 || j >= d.exercises.length) return d
            const next = [...d.exercises]
            ;[next[i], next[j]] = [next[j], next[i]]
            return withExercises(d, next)
          })}
          onRemoveExercise={(dayKey, exId) => patchDay(dayKey, (d) =>
            withExercises(d, d.exercises.filter((e) => e.id !== exId)))}
          onAddClick={setPickerDay}
          footer={
            <div className="mz-draftfoot">
              {failed && (
                <div className="mz-confirm" role="alert">
                  Nem sikerült az újragenerálás — a korábbi program megmaradt.
                  <div className="mz-confirm-acts">
                    <button type="button" className="mz-minighost" onClick={() => void runGenerate(state)}>Újra</button>
                    <button type="button" className="mz-minighost" onClick={() => setFailed(false)}>Mégse</button>
                  </div>
                </div>
              )}
              {confirming && (
                <div className="mz-confirm">
                  Kézzel szerkesztett napjaid vannak — az újragenerálás felülírja őket.
                  <div className="mz-confirm-acts">
                    <button
                      type="button"
                      className="mz-minighost"
                      onClick={() => { setConfirming(false); void runGenerate(state) }}
                    >
                      Újragenerálás
                    </button>
                    <button type="button" className="mz-minighost" onClick={() => setConfirming(false)}>Mégse</button>
                  </div>
                </div>
              )}
              <div className="mz-draftfoot-row">
                <CtaPrimary onClick={() => void save(true)} disabled={saving}>✓ Mentés + indítás</CtaPrimary>
                <CtaGhost onClick={() => void save(false)} disabled={saving}>Mentés sablonként</CtaGhost>
                <button type="button" className="mz-minighost" disabled={generating} onClick={regenerate}>
                  ↺ Újragenerálás
                </button>
              </div>
            </div>
          }
        />
        {open && (
          <ExercisePickerSheet
            dayLabel={`${open.day} · ${open.type}`}
            onClose={() => setPickerDay(null)}
            onPick={(item: ExerciseLibraryItem) => patchDay(open.day, (d) =>
              addExerciseWithDefaults(d, item, 'hypertrophy'))}
          />
        )}
      </>
    )
  }

  return (
    <MozaikPage tone="gold">
      <PageHead onBack={goBack} label="‹ Mezociklus">
        <span className="mz-stepct">Új blokk · interjú</span>
      </PageHead>
      <PageBody>
        {failed && (
          <div className="mz-confirm" role="alert">
            Nem sikerült a generálás — próbáld újra.
            <div className="mz-confirm-acts">
              <button type="button" className="mz-minighost" onClick={() => void runGenerate(state)}>
                ↺ Újrapróbálom
              </button>
            </div>
          </div>
        )}
        <InterviewStep
          state={state}
          dispatch={dispatch}
          generating={generating}
          onGenerate={() => void runGenerate(state)}
        />
      </PageBody>
    </MozaikPage>
  )
}
