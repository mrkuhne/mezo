// ============================================================
// Mezo · WorkoutSessionView (mezo-n4wf5.4, Folyadék F4 area B) — the active workout as it is on screen:
//   the record toast · the title row (back, „n / m szett kész", the title, the kalauz ?) · a failed start ·
//   the small vessels (one per exercise) · THE exercise on top (`WorkoutCard`) · „A mai sor" (the other exercises as
//   rows) · „Közben és a végén" (a failed change, add an exercise, finish, what the marks mean) · the floating dock.
// Build target: docs/design_2.0/prototypes/vilagos/edzes.js `session()`.
// The page keeps the state and the handlers and hands them over as ONE object (`v`); which exercise is on top is the
// page's VIEW state (`heroId`, `onFocus`) — the session model is untouched, every exercise keeps its own cursor.
// `overlays` (the sheets) render right after the toast, `after` (the finish confirm) after the dock.
// `/train/session` is chrome-free (no app title bar): the title row is drawn here, with the frame's own classes.
// ============================================================
import type { Dispatch, ReactNode, SetStateAction } from 'react'
import type { Challenge, LoggedWorkoutExercise, WorkoutPlan } from '@/data/types'
import type { Medal } from '@/data/train/medalTypes'
import type { useTutorial } from '@/features/tutorial/TutorialProvider'
import { challengeTypeLabel } from '@/features/train/logic/challengeDisplay'
import type { useRestTimer } from '@/features/train/logic/useRestTimer'
import { type FinishState, progressVessels, rowTag } from '@/features/train/logic/sessionFocus'
import type { Session, SetSide } from '@/features/train/logic/workoutState'
import { MedalToast } from '@/features/train/components/MedalToast'
import { WorkoutCard, WorkoutRow } from '@/features/train/components/WorkoutCard'
import { WorkoutDock } from '@/features/train/components/WorkoutDock'
import type { ChallengeBadgeState } from '@/features/train/components/WorkoutMenuGlass'
import type { SessionGlass, SessionPick } from '@/features/train/components/WorkoutSessionSheets'
import { ProgressVessels, VerdictLegend, deepMuscle } from '@/features/train/components/folyadek'
import { Acts, Box, Btn, Bub, Card, Lk, Note, Page, Section } from '@/shared/ui/folyadek'

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
  /** Logged sets over the whole session / planned slots over the whole session (the title row's „n / m szett kész"). */
  doneSets: number
  totalSets: number
  kalauz: ReturnType<typeof useTutorial>
  setGlass: Dispatch<SetStateAction<SessionGlass>>
  /** The exercise on top: `heroExerciseId(session, focusedId)`. */
  heroId: string
  /** A row / a top vessel was tapped: that exercise comes on top. */
  onFocus: (id: string) => void
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
  finishState: FinishState
  handleFinishTap: () => void
  rest: ReturnType<typeof useRestTimer>
  restExerciseId: string | null
  /** Done / planned sets over the non-skipped exercises (the dock's numbers). */
  dockDone: number
  dockPlanned: number
}

const FINISH_ICON = { skip: 't-skip', full: 't-tick', partial: 't-star' } as const

/** The title row of the chrome-free session route: the app title bar's sub-page row (`.fo-trow`), drawn by the page.
 *  `sticky-top` pins it; the kalauz anchor and its mini ? live here (the shell's own ? does not exist on this route). */
export function SessionTop({ title, eyebrow, onBack, kalauz }: { title: string; eyebrow: ReactNode; onBack: () => void; kalauz?: ReturnType<typeof useTutorial> }) {
  return (
    <div className="ek-top sticky-top" data-kalauz-anchor="session-start">
      <div className="fo-trow">
        <button type="button" className="fo-ib fo-back" aria-label="Vissza" onClick={onBack}><span aria-hidden="true">‹</span></button>
        <div className="fo-title">
          <small><i aria-hidden="true" /><span>{eyebrow}</span></small>
          <div className="fo-h sm"><h1>{title}</h1>{kalauz && <KalauzButton kalauz={kalauz} />}</div>
        </div>
      </div>
    </div>
  )
}

/** The mini ? that re-opens this route's kalauz (D11) — nothing when the route has none. */
export function KalauzButton({ kalauz }: { kalauz: ReturnType<typeof useTutorial> }) {
  if (!kalauz.current) return null
  const id = kalauz.current.id
  return (
    <button type="button" className={kalauz.openId === id ? 'fo-help is-open' : 'fo-help'} aria-label="Kalauz ehhez az oldalhoz"
      aria-haspopup="dialog" onClick={() => kalauz.open(id)}>
      ?
    </button>
  )
}

export function WorkoutSessionView({ v, overlays, after }: { v: WorkoutSessionViewState; overlays?: ReactNode; after?: ReactNode }) {
  const {
    toastMedal, W, onExit, doneSets, totalSets, kalauz, setGlass, heroId, onFocus, session, logBlocked,
    startRetrying, runStart, isBusy, noteOf, medalsOf, failedSetLocalIds, challenges, acceptedMap, startedChallengeIds, badgeState,
    handleLogSet, setEditingSet, setNoteEditExId, changeFailed, setChangeFailed, canChange, setPick, finishState, handleFinishTap,
    rest, exerciseById, restExerciseId, dockDone, dockPlanned,
  } = v
  const hero = exerciseById(heroId)
  const others = session.order.filter((id) => id !== heroId).map((id) => exerciseById(id)).filter((e): e is LoggedWorkoutExercise => !!e)
  const vessels = progressVessels(session).flatMap((x) => {
    const e = exerciseById(x.id)
    return e ? [{ ...x, off: x.off || !!e.replacedByName, label: `${e.name} · ${x.done} / ${x.planned} szett`, color: deepMuscle(e.muscle) }] : []
  })
  return (
    // `wo-list`: interim marker only — tests/layout/layout.spec.ts waits for it after Indulás (bible F2.7); the old
    // `.wo-list` rules are switched off by `.ek-page.wo-list` in folyadek-edzes-kozben.css. Delete the pair together.
    <Page className="ek-page wo-list" nonav>
      {/* First child: sticky, takes no room, floats over the title row for its few seconds. */}
      {toastMedal && <MedalToast medal={toastMedal.medal} extraCount={toastMedal.extra} />}
      {overlays}
      <SessionTop title={W.title} eyebrow={`${doneSets} / ${totalSets} szett kész`} onBack={onExit} kalauz={kalauz} />

      {/* A failed start is LOUD (mezo-e1ii9 fix round 1): the sets have nowhere to go, so the page says so and offers
          the retry instead of quietly eating them. */}
      {logBlocked && (
        <Card role="alert">
          <Box icon="t-info" color="var(--fo-bad)" title="Nem sikerült elindítani az edzést">
            <p>A szerver nem vette fel a mai edzést, ezért most nem tudunk szettet menteni, és lezárni sem tudjuk. Próbáld újra.</p>
          </Box>
          <Acts><Btn sm disabled={startRetrying} onClick={() => runStart(true)}>{startRetrying ? 'Újrapróbálás…' : 'Újra'}</Btn></Acts>
        </Card>
      )}

      <ProgressVessels items={vessels} activeId={heroId} onPick={onFocus} />

      {hero && (
        <WorkoutCard
          key={hero.id}
          exercise={hero}
          session={session}
          busy={isBusy(hero.id)}
          note={noteOf(hero)}
          medalsBySetIdx={medalsOf(hero.id)}
          failedLocalIds={failedSetLocalIds}
          logBlocked={logBlocked}
          challenges={challenges
            .filter((c) => c.exerciseId === hero.id && (acceptedMap[c.id] || startedChallengeIds.has(c.id)))
            .map((c) => ({ id: c.id, label: challengeTypeLabel(c.typeLabel), target: c.target.replace(/(\d)\.(\d)/g, '$1,$2'), state: badgeState(c) }))}
          onOpenChallenge={(cid) => setGlass({ kind: 'challenge', id: cid })}
          onLogSet={(input) => handleLogSet(hero, input)}
          onTapDoneRow={(idx) => setEditingSet({ exerciseId: hero.id, idx })}
          onOpenRecords={() => setGlass({ kind: 'records', id: hero.id })}
          onOpenMenu={() => setGlass({ kind: 'menu', id: hero.id })}
          onOpenVideo={hero.videoUrl ? () => setGlass({ kind: 'video', id: hero.id }) : undefined}
          onEditNote={() => setNoteEditExId(hero.id)}
        />
      )}

      {others.length > 0 && (
        <>
          <Section n={1} title="A mai sor" />
          <Card>
            {others.map((e) => (
              <WorkoutRow key={e.id} exercise={e} session={session} tag={rowTag(session, e.id, { swappedOut: !!e.replacedByName })} onFocus={() => onFocus(e.id)} />
            ))}
            <Note>
              Koppints egy gyakorlatra, és az kerül felülre a szettjeivel — bármelyiket naplózhatod, nem csak a soron
              következőt. Egy kapszula egy szett: a teli megvan.
            </Note>
          </Card>
        </>
      )}

      <Section n={others.length > 0 ? 2 : 1} title="Közben és a végén" />
      <Card>
        {changeFailed && (
          <div className="ek-chgerr" role="alert">
            <Box icon="t-info" color="var(--fo-bad)" title="Nem sikerült menteni a változtatást — próbáld újra." />
            <Acts><Lk onClick={() => setChangeFailed(false)}>Rendben</Lk></Acts>
          </div>
        )}
        {/* The kit's `Pair` cannot switch a tile off: the same two tiles on its recipe (`.fo-pair`), with `disabled`. */}
        <div className="fo-pair ek-pair">
          <button type="button" disabled={!canChange} onClick={() => setPick({ mode: 'add' })}>
            <Bub icon="t-addex" size={44} />Gyakorlat hozzáadása
          </button>
          <button type="button" data-finish={finishState} disabled={logBlocked} onClick={handleFinishTap}>
            <Bub icon={FINISH_ICON[finishState]} size={44} />{finishState === 'skip' ? 'Edzés kihagyása' : 'Edzés befejezése'}
          </button>
        </div>
        <VerdictLegend />
        <Note>
          A pipa menti a szettet, a sor végén az ítélet áll — a kész sor koppintva szerkeszthető. Két szett között a
          pihenő magától indul; a gyakorlat utolsó szettje után nem, ott három rövid kérdés jön.
        </Note>
      </Card>

      {/* The floating dock: the same `useRestTimer()` instance as ever, portalled into the phone frame. Always there
          in the active phase, so the page reserves its room once (`.ek-page` bottom padding). */}
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
    </Page>
  )
}
