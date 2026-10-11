// ============================================================
// Mezo · WorkoutSessionView (mezo-n4wf5.4 foundation) — the active workout as it is on screen: the record toast, the
// header, the progress strip, the list of exercise cards with its strips and its two buttons, and the dock.
// The markup was moved here UNCHANGED from pages/ActiveWorkoutPage.tsx; the page keeps the state and the handlers and
// hands them over as ONE object (`v`), field names = the page's own local names. `overlays` (the sheets) render right
// after the toast, `after` (the finish confirm) after the dock — the order they always had.
// Slice F4 area B („session page") owns this file.
// ============================================================
import type { Dispatch, ReactNode, SetStateAction } from 'react'
import type { Challenge, LoggedWorkoutExercise, WorkoutPlan } from '@/data/types'
import type { Medal } from '@/data/train/medalTypes'
import type { useTutorial } from '@/features/tutorial/TutorialProvider'
import { muscleColor } from '@/features/train/logic/muscleColors'
import { challengeTypeLabel } from '@/features/train/logic/challengeDisplay'
import type { sessionProgressSegments } from '@/features/train/logic/workoutCardMeta'
import type { useRestTimer } from '@/features/train/logic/useRestTimer'
import { type Session, type SetSide, effectiveSetCount } from '@/features/train/logic/workoutState'
import { MedalToast } from '@/features/train/components/MedalToast'
import { WorkoutCard } from '@/features/train/components/WorkoutCard'
import { WorkoutDock } from '@/features/train/components/WorkoutDock'
import type { ChallengeBadgeState } from '@/features/train/components/WorkoutMenuGlass'
import type { SessionGlass, SessionPick } from '@/features/train/components/WorkoutSessionSheets'
import { Icon3D } from '@/shared/ui/clay'

/** What the page hands over. Every field is the page's own local of the same name. */
export interface WorkoutSessionViewState {
  W: WorkoutPlan
  session: Session
  challenges: Challenge[]
  exerciseById: (id: string | null | undefined) => LoggedWorkoutExercise | null
  noteOf: (e: LoggedWorkoutExercise) => string
  /** The RECORD medal being celebrated right now (+ how many more came with it). */
  toastMedal: { medal: Medal; extra: number } | null
  onExit: () => void
  /** Logged sets over the whole session / planned slots over the whole session (the header's „n/m szett"). */
  doneSets: number
  totalSets: number
  kalauz: ReturnType<typeof useTutorial>
  feedbackEx: LoggedWorkoutExercise | null
  setGlass: Dispatch<SetStateAction<SessionGlass>>
  /** „Most": the exercise the header's ⋯ opens the menu for. */
  current: LoggedWorkoutExercise
  progressSegments: ReturnType<typeof sessionProgressSegments>
  /** The start POST failed and no instance exists: nothing can be logged or finished. */
  logBlocked: boolean
  startRetrying: boolean
  runStart: (retry: boolean) => void
  isBusy: (exId: string) => boolean
  medalsOf: (exId: string) => Record<number, Medal[]>
  failedSetLocalIds: Set<string>
  acceptedMap: Record<string, boolean>
  startedChallengeIds: ReadonlySet<string>
  badgeState: (c: Challenge) => ChallengeBadgeState
  handleLogSet: (finishing: LoggedWorkoutExercise, input: { weight: number; reps: number; rir: number | null; side: SetSide | null }) => void
  setEditingSet: Dispatch<SetStateAction<{ exerciseId: string; idx: number } | null>>
  setNoteEditExId: Dispatch<SetStateAction<string | null>>
  changeFailed: boolean
  setChangeFailed: Dispatch<SetStateAction<boolean>>
  canChange: boolean
  setPick: Dispatch<SetStateAction<SessionPick>>
  finishState: 'skip' | 'partial' | 'full'
  handleFinishTap: () => void
  rest: ReturnType<typeof useRestTimer>
  restExerciseId: string | null
  /** Done / planned sets over the non-skipped exercises (the dock's numbers). */
  dockDone: number
  dockPlanned: number
}

export function WorkoutSessionView({ v, overlays, after }: { v: WorkoutSessionViewState; overlays?: ReactNode; after?: ReactNode }) {
  const {
    toastMedal, W, onExit, doneSets, totalSets, kalauz, feedbackEx, setGlass, current, progressSegments, session, logBlocked,
    startRetrying, runStart, isBusy, noteOf, medalsOf, failedSetLocalIds, challenges, acceptedMap, startedChallengeIds, badgeState,
    handleLogSet, setEditingSet, setNoteEditExId, changeFailed, setChangeFailed, canChange, setPick, finishState, handleFinishTap,
    rest, exerciseById, restExerciseId, dockDone, dockPlanned,
  } = v
  return (
    <>
      {toastMedal && <MedalToast medal={toastMedal.medal} extraCount={toastMedal.extra} />}
      {overlays}
      <div className="wos">
        {/* Header — the one piece of chrome the card list keeps: back pill, the
            session title + its live set-progress line, and the ⋯ that opens the
            session/exercise actions for the exercise that is up now. Sticky by
            `.wk-top` itself (position: sticky; top: 0). */}
        {/* Üvegesítés U4 (mezo-me75u.4): a sticky FLAT header — round flat buttons, the title and
            "n/m szett" with the done count lit coral. Skin: `uveg edzes session` block. */}
        <div className="wk-top wos-top np-anim" data-kalauz-anchor="session-start" style={{ '--i': 0 } as React.CSSProperties}>
          <button type="button" className="back wos-rb np-press" aria-label="Vissza" onClick={onExit}>‹</button>
          <div className="tt wkx-tt">
            <div className="t1">{W.title}</div>
            <div className="t2"><b>{doneSets}</b>/{totalSets} szett</div>
          </div>
          {/* Mini ? (D11): ez az oldal chrome-mentes, a fejléc globális ?-e itt nem létezik.
              A kalauz horgonya és újranyitása a prep breadcrumbról ide költözött (mezo-e1ii9)
              — a kártyalista fejléce AZ indítás most. */}
          {kalauz.current && (
            <button type="button" className="wos-rb wos-q np-press" aria-label="Kalauz ehhez az oldalhoz"
              aria-haspopup="dialog" onClick={() => kalauz.open(kalauz.current!.id)}>
              <span aria-hidden="true">?</span>
            </button>
          )}
          <button
            type="button"
            aria-label="Gyakorlat műveletek"
            disabled={!!feedbackEx}
            onClick={() => setGlass({ kind: 'menu', id: current.id })}
            className="back wos-rb np-press"
          >
            ⋯
          </button>
        </div>

        {/* Session progress bar: one segment per exercise, flex-weighted by its
            planned set count, family-coloured; opacity signals done/current/upcoming. */}
        {/* U4: each segment is a muscle-tinted track whose lit fill grows with the exercise's
            logged share (prototype `.pbar`); `data-state` keeps the done/current/upcoming read. */}
        <div className="wkx-progressbar wos-pbar" aria-hidden="true">
          {progressSegments.map((seg, i) => {
            const ex = W.exercises[i]
            const planned = ex ? effectiveSetCount(session, ex.id) : 0
            const fill = seg.state === 'done' ? 100 : planned > 0 ? Math.min(100, ((session.logged[ex.id]?.length ?? 0) / planned) * 100) : 0
            return (
              <span
                key={i}
                data-state={seg.state}
                style={{ flex: seg.weight, '--c': muscleColor(seg.colorMuscle).rail } as React.CSSProperties}
              >
                <b style={{ width: `${fill}%` }} />
              </span>
            )
          })}
        </div>

        {/* THE list — one card per exercise, in session order. */}
        {/* Padding (including the bottom room the portalled dock floats over) lives in
            `.wo-list`'s own CSS rule now — see prototype.css, fix wave C1. */}
        <div className="wo-list">
          {/* A failed start is LOUD (mezo-e1ii9 fix round 1): the sets have nowhere to go,
              so the list says so and offers the retry instead of quietly eating them. */}
          {logBlocked && (
            <div className="wo-overload" role="alert">
              <span className="wo-overload-title">Nem sikerült elindítani az edzést</span>
              <span className="wo-overload-why">
                A szerver nem vette fel a mai edzést, ezért most nem tudunk szettet menteni, és
                lezárni sem tudjuk. Próbáld újra.
              </span>
              <button
                type="button"
                className="wo-overload-retry"
                disabled={startRetrying}
                onClick={() => runStart(true)}
              >
                {startRetrying ? 'Újrapróbálás…' : 'Újra'}
              </button>
            </div>
          )}
          {session.order.map((id) => {
            const e = W.exercises.find((x) => x.id === id)
            if (!e) return null
            return (
              <WorkoutCard
                key={id}
                exercise={e}
                session={session}
                busy={isBusy(id)}
                note={noteOf(e)}
                medalsBySetIdx={medalsOf(id)}
                failedLocalIds={failedSetLocalIds}
                logBlocked={logBlocked}
                challenges={challenges
                  .filter((c) => c.exerciseId === id && (acceptedMap[c.id] || startedChallengeIds.has(c.id)))
                  .map((c) => ({ id: c.id, label: challengeTypeLabel(c.typeLabel), target: c.target.replace(/(\d)\.(\d)/g, '$1,$2'), state: badgeState(c) }))}
                onOpenChallenge={(cid) => setGlass({ kind: 'challenge', id: cid })}
                onLogSet={(input) => handleLogSet(e, input)}
                onTapDoneRow={(idx) => setEditingSet({ exerciseId: id, idx })}
                onOpenRecords={() => setGlass({ kind: 'records', id })}
                onOpenMenu={() => setGlass({ kind: 'menu', id })}
                onEditNote={() => setNoteEditExId(id)}
              />
            )
          })}

          {/* The one way out of the list, in three honest states (T6 Task 6, prototype
              finishCta): `skip` when nothing is logged, `partial` (gold) while sets remain
              unticked, `full` (green) once every non-skipped exercise is done. Replaces
              Task 4's temporary plain button. */}
          {/* U4: a FLAT button — t-skip while nothing is logged, t-star while partial, t-tick
              once everything is done (the three states keep their `is-*` hooks). */}
          {changeFailed && (
            <div className="wo-change-err" role="alert">
              <span>Nem sikerült menteni a változtatást — próbáld újra.</span>
              <button type="button" aria-label="Értesítés bezárása" onClick={() => setChangeFailed(false)}>×</button>
            </div>
          )}
          <button type="button" className="wo-add" disabled={!canChange} onClick={() => setPick({ mode: 'add' })}>
            <Icon3D name="t-addex" size={26} />
            Gyakorlat hozzáadása
          </button>

          <button type="button" className={`wo-finish is-${finishState}`} onClick={handleFinishTap} disabled={logBlocked}>
            <span className="wo-finish-art">
              <Icon3D name={finishState === 'skip' ? 't-skip' : finishState === 'full' ? 't-tick' : 't-star'} size={26} />
            </span>
            <strong>{finishState === 'skip' ? 'Edzés kihagyása' : 'Edzés befejezése'}</strong>
          </button>
        </div>
      </div>

      {/* The fixed session dock (T6 Task 6, prototype dock): replaces the old RestTimerBar
          render in this phase — same `useRestTimer()` instance, same start sites/durations,
          only the rendering moved. Constant height, always present in the active phase, so
          the list above it never jumps between its idle and resting looks. */}
      <WorkoutDock
        resting={rest.status !== 'idle'}
        remaining={rest.remaining}
        total={rest.total}
        exerciseName={exerciseById(restExerciseId)?.name ?? null}
        doneSets={dockDone}
        plannedSets={dockPlanned}
        onExtend={() => rest.extend(30)}
        onSkipRest={rest.skip}
        onFinish={handleFinishTap}
        finishDisabled={doneSets === 0 || logBlocked}
      />
      {after}
    </>
  )
}
