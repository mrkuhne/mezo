// ============================================================
// Mezo · WorkoutSessionSheets (mezo-n4wf5.4 foundation) — every sheet and glass of the active workout, in one file:
// the debrief, the exercise menu, video, quest detail and records glasses, the set editor, the note editor, the
// extra-set prompt, the exercise picker and the scope sheet. The markup was moved here UNCHANGED from
// pages/ActiveWorkoutPage.tsx; the page keeps the state and the handlers and hands them over as ONE object (`s`),
// field names = the page's own local names. Slice F4 area C („session sheets") owns this file.
// ============================================================
import type { Dispatch, SetStateAction } from 'react'
import type { Challenge, ExerciseLibraryItem, LoggedWorkoutExercise, WorkoutPlan } from '@/data/types'
import type { ExerciseRecordResponse } from '@/data/train/trainApi'
import { muscleColor } from '@/features/train/logic/muscleColors'
import { recordFor } from '@/features/train/logic/recordFor'
import { libraryToGymExercise } from '@/features/train/logic/exerciseDefaults'
import { type Session, addExtraSet, canRemoveSet, effectiveSetCount, prescribedAt, slotIndex } from '@/features/train/logic/workoutState'
import { prefill, setSlotLabel } from '@/features/train/components/WorkoutCard'
import { ChallengeDetailGlass, WorkoutMenuGlass, WorkoutVideoGlass, type ChallengeBadgeState } from '@/features/train/components/WorkoutMenuGlass'
import { WorkoutRecordsGlass } from '@/features/train/components/WorkoutRecordsGlass'
import { ExercisePickerSheet } from '@/features/train/sheets/ExercisePickerSheet'
import { ExerciseScopeSheet, type ChangeScope } from '@/features/train/sheets/ExerciseScopeSheet'
import { FeedbackModal, type ExerciseFeedbackValues } from '@/features/train/sheets/FeedbackModal'
import { SetEditSheet, type SetEditValues } from '@/features/train/sheets/SetEditSheet'
import { NoteEditSheet } from '@/features/train/sheets/ExerciseNoteSheet'
import { ExtraSetPrompt } from '@/features/train/sheets/ExtraSetPrompt'

export type SessionGlass = { kind: 'menu' | 'video' | 'records' | 'challenge'; id: string } | null
export type SessionPick = { mode: 'swap' | 'add'; exerciseId?: string } | null
export type SessionScope = { mode: 'swap' | 'add'; exerciseId?: string; item: ExerciseLibraryItem } | null

/** What the page hands over. Every field is the page's own local of the same name. */
export interface WorkoutSessionSheetsState {
  W: WorkoutPlan
  session: Session
  setSession: Dispatch<SetStateAction<Session>>
  challenges: Challenge[]
  exerciseRecords: ExerciseRecordResponse[]
  exerciseById: (id: string | null | undefined) => LoggedWorkoutExercise | null
  noteOf: (e: LoggedWorkoutExercise) => string
  /** The exercise whose debrief is open (it takes over: the glasses and the set editor stay shut meanwhile). */
  feedbackEx: LoggedWorkoutExercise | null
  advanceAfterFeedback: () => void
  saveFeedback: (vals: ExerciseFeedbackValues) => void
  /** Which glass is open, and for which exercise / quest. */
  glass: SessionGlass
  setGlass: Dispatch<SetStateAction<SessionGlass>>
  /** The exercise the menu / video / records glass speaks about. */
  menuEx: LoggedWorkoutExercise
  setNoteEditExId: Dispatch<SetStateAction<string | null>>
  setAddSetPrompt: Dispatch<SetStateAction<{ exerciseId: string } | null>>
  handleSetDelete: (ex: LoggedWorkoutExercise, idx: number) => void
  movePosition: (id: string, dir: -1 | 1) => void
  handleToggleSkip: (exId: string) => void
  /** Swap / add is possible (the workout started, logging is not blocked). */
  canChange: boolean
  setPick: Dispatch<SetStateAction<SessionPick>>
  badgeState: (c: Challenge) => ChallengeBadgeState
  toggleChallenge: (id: string) => void
  editingSet: { exerciseId: string; idx: number } | null
  editingEx: LoggedWorkoutExercise | null
  handleSetSave: (ex: LoggedWorkoutExercise, idx: number, v: SetEditValues) => void
  setEditingSet: Dispatch<SetStateAction<{ exerciseId: string; idx: number } | null>>
  noteEditEx: LoggedWorkoutExercise | null
  saveExerciseNote: (exerciseId: string, note: string) => void
  setLocalNotes: Dispatch<SetStateAction<Record<string, string>>>
  addSetPrompt: { exerciseId: string } | null
  writeExtraSetToTemplate: (exerciseId: string) => void
  pick: SessionPick
  scopeFor: SessionScope
  setScopeFor: Dispatch<SetStateAction<SessionScope>>
  scopeTarget: LoggedWorkoutExercise | null
  scopeLogged: number
  scopeNewSets: number
  mesoLine: string | null
  applyChange: (scope: ChangeScope) => void
}

export function WorkoutSessionSheets({ s }: { s: WorkoutSessionSheetsState }) {
  const {
    feedbackEx, W, advanceAfterFeedback, saveFeedback, glass, setGlass, challenges, session, setSession, menuEx, noteOf,
    setNoteEditExId, setAddSetPrompt, handleSetDelete, movePosition, handleToggleSkip, canChange, setPick, badgeState, exerciseById,
    toggleChallenge, exerciseRecords, editingSet, editingEx, handleSetSave, setEditingSet, noteEditEx, saveExerciseNote, setLocalNotes,
    addSetPrompt, writeExtraSetToTemplate, pick, scopeFor, setScopeFor, scopeTarget, scopeLogged, scopeNewSets, mesoLine, applyChange,
  } = s
  return (
    <>
      {feedbackEx && (
        <FeedbackModal
          ex={feedbackEx}
          isLastExercise={W.exercises.findIndex((e) => e.id === feedbackEx.id) + 1 >= W.exercises.length}
          onResolve={advanceAfterFeedback}
          onSave={saveFeedback}
        />
      )}
      {(() => {
        const menuOpen = glass?.kind === 'menu' && !feedbackEx
        const videoOpen = glass?.kind === 'video' && !feedbackEx
        const recordsOpen = glass?.kind === 'records' && !feedbackEx
        const detail = glass?.kind === 'challenge' && !feedbackEx ? challenges.find((c) => c.id === glass.id) ?? null : null
        const position = session.order.indexOf(menuEx.id)
        const slotCount = effectiveSetCount(session, menuEx.id)
        const lastSlotPending = (session.logged[menuEx.id]?.length ?? 0) < slotCount
        const tint = muscleColor(menuEx.muscle).rail
        return (
          <>
            <WorkoutMenuGlass
              open={!!menuOpen}
              exercise={menuEx}
              tint={tint}
              position={position}
              orderLength={session.order.length}
              slotCount={slotCount}
              skipped={session.skipped.includes(menuEx.id)}
              hasNote={!!noteOf(menuEx)}
              canRemoveTrailingSet={canRemoveSet(session, menuEx.id) && lastSlotPending}
              onClose={() => setGlass(null)}
              onVideo={() => setGlass({ kind: 'video', id: menuEx.id })}
              onEditNote={() => setNoteEditExId(menuEx.id)}
              onAddSet={() => {
                setSession((s) => addExtraSet(s, menuEx.id))
                // „Minden hétre" needs a plan slot (mezo-mobji): a today-only row just grows today.
                if (menuEx.planSlot !== false) setAddSetPrompt({ exerciseId: menuEx.id })
              }}
              onRemoveSet={() => handleSetDelete(menuEx, slotCount - 1)}
              onMoveEarlier={() => movePosition(menuEx.id, -1)}
              onMoveLater={() => movePosition(menuEx.id, 1)}
              onToggleSkip={() => handleToggleSkip(menuEx.id)}
              loggedCount={session.logged[menuEx.id]?.length ?? 0}
              onSwap={canChange ? () => setPick({ mode: 'swap', exerciseId: menuEx.id }) : undefined}
            />
            <WorkoutVideoGlass
              open={!!videoOpen}
              exercise={videoOpen ? menuEx : null}
              tint={tint}
              onClose={() => setGlass(null)}
            />
            <ChallengeDetailGlass
              open={!!detail}
              challenge={detail}
              state={detail ? badgeState(detail) : 'accepted'}
              tint={detail ? muscleColor(exerciseById(detail.exerciseId)?.muscle ?? menuEx.muscle).rail : tint}
              onToggle={() => detail && toggleChallenge(detail.id)}
              onClose={() => setGlass(null)}
            />
            <WorkoutRecordsGlass
              open={!!recordsOpen}
              exercise={menuEx}
              record={recordFor(exerciseRecords, menuEx)}
              todaySets={session.logged[menuEx.id] ?? []}
              tint={tint}
              onClose={() => setGlass(null)}
            />
          </>
        )
      })()}
      {editingSet && editingEx && !feedbackEx && (() => {
        const ex = editingEx
        const idx = editingSet.idx
        const t = prescribedAt(session, ex.id, slotIndex(session, ex.id, idx))
        const actual = session.logged[ex.id]?.[idx]
        return (
          <SetEditSheet
            exerciseName={ex.name}
            setLabel={setSlotLabel(idx)}
            mode={actual ? 'logged' : 'pending'}
            kind="working"
            exerciseType={ex.type}
            initial={{
              weight: actual?.weight ?? t?.targetWeightKg ?? prefill(ex).weight,
              reps: actual?.reps ?? t?.targetReps ?? prefill(ex).reps,
              rir: actual?.rir ?? t?.targetRIR ?? ex.targetRIR,
              side: actual?.side ?? null,
              note: actual?.note ?? '',
            }}
            canDelete={canRemoveSet(session, ex.id)}
            muscle={ex.muscle}
            onSave={(v) => handleSetSave(ex, idx, v)}
            onDelete={() => handleSetDelete(ex, idx)}
            onClose={() => setEditingSet(null)}
          />
        )
      })()}
      {noteEditEx && (
        <NoteEditSheet
          initialNote={noteOf(noteEditEx)}
          onClose={() => setNoteEditExId(null)}
          onSave={(text) => {
            saveExerciseNote(noteEditEx.id, text)
            setLocalNotes((prev) => ({ ...prev, [noteEditEx.id]: text }))
          }}
        />
      )}
      {addSetPrompt && (
        <ExtraSetPrompt onEveryWeek={() => writeExtraSetToTemplate(addSetPrompt.exerciseId)} onClose={() => setAddSetPrompt(null)} />
      )}

      {pick && (
        <ExercisePickerSheet
          mode="single"
          eyebrow={pick.mode === 'swap' ? `Csere · ${exerciseById(pick.exerciseId)?.name ?? ''}` : 'Gyakorlat hozzáadása'}
          title={pick.mode === 'swap' ? 'Mire cseréled?' : 'Mit adunk hozzá?'}
          similarTo={pick.mode === 'swap' ? exerciseById(pick.exerciseId)?.muscle : undefined}
          excludeNames={W.exercises.map((e) => e.name)}
          onPick={(item) => setScopeFor({ mode: pick.mode, exerciseId: pick.exerciseId, item })}
          onClose={() => setPick(null)}
        />
      )}
      {scopeFor && !pick && (() => {
        const rec = recordFor(exerciseRecords, { name: scopeFor.item.name, catalogId: scopeFor.item.catalogId })
        const top = rec?.recentTopSets?.[rec.recentTopSets.length - 1]
        const recipe = libraryToGymExercise(scopeFor.item)
        const noPlan = scopeTarget?.planSlot === false
        return (
          <ExerciseScopeSheet
            mode={scopeFor.mode}
            item={scopeFor.item}
            replacedName={scopeTarget?.name}
            loggedOnReplaced={scopeLogged}
            newSets={scopeNewSets}
            repLabel={`${recipe.repMin}–${recipe.repMax}`}
            planSlot={!noPlan}
            noPlanNote={noPlan
              ? scopeTarget?.changeScope
                ? 'Ez a gyakorlat ma került be, nincs a mezociklus tervében, ezért csak mára cserélhető.'
                : 'A nap végi levezetőt az app minden nap visszateszi, ezért csak mára cserélhető.'
              : null}
            mesoLine={mesoLine}
            lastTop={top ? `${top.weightKg != null ? String(top.weightKg).replace('.', ',') : 'saját súly'} × ${top.reps}` : null}
            onChoose={applyChange}
            onClose={() => setScopeFor(null)}
          />
        )
      })()}
    </>
  )
}
