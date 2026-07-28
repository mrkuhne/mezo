// ============================================================
// Mezo · TrainTodayPage (Mai) — a one-day view (mezo-9bbc).
// A DayStrip navigator over the Mon–Sun agenda picks which day's sessions
// render below it (default: today; `?day={0..6}` — the Heti drill-in —
// overrides once). The weekly list + load tiles + provenance note now
// live on TrainWeekPage (/train/week, "Heti").
// Thin TrainSection shell ⇒ this view owns its own .page-header.
// ============================================================
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useTrain, useRunning, useWeekWorkouts, useSleepGoal } from '@/data/hooks'
import { isMockMode } from '@/data/_client/mode'
import { MorningTrainingCard } from '@/features/train/components/MorningTrainingCard'
import {
  isSnoozed,
  morningWindow,
  offendingSlots,
  rescheduledSlots,
  snooze,
  snoozeHash,
} from '@/features/train/logic/morningWindow'
import { useLevelUp } from '@/features/progression/LevelUpProvider'
import { DAY_LABELS, DAY_ORDER } from '@/data/train/train'
import { runSessionsForDay, todayIdx } from '@/data/train/runningAgenda'
import { huMonthDayDow, localDateString } from '@/shared/lib/dates'
import { Icon } from '@/shared/ui/Icon'
import { CtaGhost } from '@/shared/ui/Cta'
import { GhostState } from '@/shared/ui/GhostState'
import { SportLogSheet } from '@/features/train/sheets/SportLogSheet'
import { RunLogSheet } from '@/features/train/sheets/RunLogSheet'
import { CustomWorkoutSheet } from '@/features/train/sheets/CustomWorkoutSheet'
import { DayStrip } from '@/features/train/components/DayStrip'
import { TodaySessionCard } from '@/features/train/components/TodaySessionCard'
import { DoneBar } from '@/features/train/components/DoneBar'
import { daySessions } from '@/features/train/logic/agenda'
import { dayStripItems } from '@/features/train/logic/dayStripItems'
import { buildWeekAgenda } from '@/features/train/logic/weekAgenda'
import { gymDayTarget } from '@/features/train/logic/gymDayTarget'
import TrainTodaySkeleton from '@/features/train/pages/TrainTodaySkeleton'
import { SPORT_TONE, sportOf, SPORT_EMOJI, SPORT_TAGS, SPORT_TITLES, type SportKind } from '@/features/train/logic/sportKinds'
import { SESSION_STATE_LABEL, sessionState } from '@/features/train/logic/sessionState'

type RunLogCtx = { blockId: string; weekNumber: number; sessionKey: string; label: string; isSprint: boolean; defaultRounds?: number }

export function TrainTodayPage() {
  const { workout, gymSchedule, sport, activeMeso, logSportSession, gymDoneDates, workoutPending, todaySession, completedTodayWorkout, gymSlots, saveGymSchedule } = useTrain()
  const { activeRunningBlock, runSessions, logRunSession, runningPending } = useRunning()
  // Completed workout summaries for this Mon–Sun week — maps each done day's ISO
  // date to its instance id so a weekly gym row can open the review (real mode).
  const { workouts: weekWorkouts } = useWeekWorkouts()
  const navigate = useNavigate()
  const { showLevelUp } = useLevelUp()
  const [sportLogSport, setSportLogSport] = useState<SportKind | null>(null)
  const [runLogCtx, setRunLogCtx] = useState<RunLogCtx | null>(null)
  const [customOpen, setCustomOpen] = useState(false)
  const { goal: sleepGoal } = useSleepGoal()
  const qc = useQueryClient()
  // Morning-training reschedule (mezo-67rb): wake-anchored window over the raw gym slots.
  const mtrWindow = morningWindow(sleepGoal.wakeTime)
  const mtrOffending = offendingSlots(gymSlots, mtrWindow)
  const mtrHash = snoozeHash(sleepGoal.wakeTime, mtrOffending)
  const [mtrSnoozed, setMtrSnoozed] = useState(false)
  useEffect(() => setMtrSnoozed(false), [mtrHash])
  const showMtr = mtrOffending.length > 0 && !mtrSnoozed && !isSnoozed(mtrHash)
  const applyMtr = () => {
    const moved = rescheduledSlots(gymSlots, mtrWindow)
    saveGymSchedule(moved)
    if (isMockMode()) qc.setQueryData(['train', 'gymSchedule'], moved) // mock parity: the mock mutation no-ops
  }
  const snoozeMtr = () => {
    snooze(mtrHash)
    setMtrSnoozed(true)
  }
  const [params] = useSearchParams()
  // Mai always opens on today; `?day={0..6}` (the Heti drill-in) overrides it once.
  // `params.get('day')` is `null` when absent — NOT coerced through `Number()` first
  // (`Number(null) === 0`, which would silently pin every plain `/train` visit to
  // Monday instead of today).
  // `''` coerces the same way (`Number('') === 0`) when the param key is present but
  // empty (e.g. a stray `?day=`), so both absence and blankness must skip `Number()`.
  const rawDay = params.get('day')
  const dayIdx = rawDay === null || rawDay === '' ? NaN : Number(rawDay)
  const paramDay = Number.isInteger(dayIdx) && dayIdx >= 0 && dayIdx <= 6 ? DAY_ORDER[dayIdx] : null
  const [selectedDay, setSelectedDay] = useState<string | null>(paramDay)

  // Loading skeleton (real mode): while the meso/today queries (workoutPending) or
  // the running block query are unresolved, render the layout-matched skeleton
  // before the empty-state — placed after all hooks so the hook order is stable.
  if (workoutPending || runningPending) return <TrainTodaySkeleton />

  // T0/T2: without an active meso the whole view ghosts. With one, the agenda
  // derives from the meso (gymSchedule) and /today drives the hero card;
  // volleyball columns stay empty until T3 (sport.schedule is null until then).
  if (!activeMeso) {
    return (
      <>
        <div className="pghead-np">
          <div>
            <div className="over">Edzés</div>
            <h1>Mai nap</h1>
          </div>
        </div>
        <div style={{ padding: '0 24px 12px' }}>
          <GhostState
            lines={4}
            message="Itt fog élni a mai edzésed — előbb tervezz egy mesociklust."
            ctaLabel="+ Tervezz mesociklust"
            onCta={() => navigate('/train/mesocycles/new')}
          />
        </div>
        <div style={{ padding: '0 24px 16px' }}>
          <div className="secthead-np">
            <h3>Heti terv</h3>
          </div>
          <GhostState lines={2} message="A heti rended itt jelenik majd meg." />
        </div>
        <div style={{ padding: '0 24px 16px' }}>
          <button type="button" onClick={() => setCustomOpen(true)} className="card" style={{
            padding: 12, width: '100%', background: 'transparent', borderStyle: 'dashed',
            borderColor: 'var(--line)', color: 'var(--tag-gym)', fontSize: 10,
            letterSpacing: '0.14em', textTransform: 'uppercase',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <Icon name="plus" size={12} /> Saját edzés
          </button>
        </div>
        {customOpen && <CustomWorkoutSheet onClose={() => setCustomOpen(false)} />}
      </>
    )
  }

  // Combine gym schedule + volleyball sessions into a unified weekly map. Each row carries
  // its calendar ISO date (this week's Monday + index) so done-state can be matched per day.
  const agenda = buildWeekAgenda({
    gymTimes: gymSchedule?.weeklyTimes ?? [],
    sportSlots: sport.schedule?.volleyball.sessions ?? [],
    runningBlock: activeRunningBlock,
    weekWorkouts,
  })

  // The agenda's `isToday` is flag-based (gym/volleyball only); running blocks
  // are mesocycle-independent, so a day may have ONLY a prescribed run today.
  const todayRow = agenda.find((a) => a.isToday)
  // The DayStrip's selection (`selectedDay === null` ⇒ today); falls back to
  // today if a stale/invalid selection no longer matches an agenda day.
  const shownDay = selectedDay ? (agenda.find((a) => a.day === selectedDay) ?? todayRow) : todayRow
  // `selectedDay === null` always means "today" by definition (the default view),
  // regardless of whether any agenda row happens to carry the flag-based `isToday`
  // (real mode only sets it on a day that has a gym/sport slot — a true rest day
  // flags NO row `isToday` at all, so `todayRow`/`shownDay` can be legitimately
  // undefined here; falling through to `shownDay?.isToday` would then wrongly
  // read as false). An explicit selection still checks the flag (so re-tapping
  // today's own chip reads as today too).
  const isTodayShown = selectedDay === null || Boolean(shownDay?.isToday)

  // Pull today's runs separately (date-based) and merge them with the flag-based
  // today row into a synthetic day, so a run-only-today still shows its hero — but
  // only while today itself is shown; a non-today selection uses the agenda's own
  // (day-of-week-matched) running list instead.
  const todayRuns = runSessionsForDay(activeRunningBlock, todayIdx())
  // The shown day's hero cards, rendered in time-of-day order (a morning run hero
  // above an evening gym hero); same ordering as Heti's weekly rows via daySessions.
  const orderedToday = daySessions({
    day: shownDay?.day ?? '',
    gym: shownDay?.gym ?? null,
    sport: shownDay?.sport ?? [],
    running: isTodayShown ? todayRuns : (shownDay?.running ?? []),
    isToday: isTodayShown,
  })

  // Active meso phase for the current week (Week 3 ⇒ MAV).
  const currentPhase = activeMeso.phaseCurve[activeMeso.currentWeek - 1]
  const openSession = () => navigate('/train/session')

  // "Logged" signals drive the hero/weekly done-state. Volleyball has no
  // schedule↔log link, so we match the logged SportSession by date (the mapped
  // session carries the HU display date). Running carries the prescribed tuple
  // back, so we match on block + week + sessionKey (already day-scoped by
  // construction — a prescribed session's key is unique to its own weekday).
  const todayIso = localDateString()
  // The shown day's ISO date — sport done-state and state-labels must match THIS
  // day, not always today, now that these cards render for any selected day
  // (mezo-9bbc review fix). Falls back to todayIso when the shown day carries no
  // date (defensive only; every real agenda day has one).
  const shownIso = shownDay?.date ?? todayIso
  // A slot's done-state matches a logged session by DATE **and** SPORT — a mixed day
  // (TRX noon + volleyball evening) must flip each slot independently.
  const loggedSportOn = (iso: string, k: SportKind) =>
    sport.sessions.find((s) => s.sport === k && s.date === huMonthDayDow(iso)) ?? null
  const sportDoneOn = (iso: string | undefined, k: SportKind) =>
    Boolean(iso) && sport.sessions.some((s) => s.sport === k && s.date === huMonthDayDow(iso!))
  const runLoggedFor = (key: string) =>
    runSessions.find(
      (r) => r.blockId === activeRunningBlock?.id && r.weekNumber === activeRunningBlock?.currentWeek && r.sessionKey === key,
    ) ?? null

  return (
    <>
      {/* Header — selection-aware: the over-line + h1 read the shown day, and a
          non-today selection gets a "← Ma" way back to today. */}
      <div className="pghead-np">
        <div>
          <div className="over">
            {shownDay ? `Edzés · ${DAY_LABELS[shownDay.day] ?? shownDay.day} · W${activeMeso.currentWeek}` : `Edzés · W${activeMeso.currentWeek}`}
          </div>
          <h1>{isTodayShown ? 'Mai nap' : (DAY_LABELS[shownDay?.day ?? ''] ?? 'Mai nap')}</h1>
        </div>
        {!isTodayShown && (
          <button type="button" className="pgact-np" onClick={() => setSelectedDay(null)}>
            <Icon name="chevron-left" size={12} /> Ma
          </button>
        )}
      </div>

      {/* DayStrip — the Mon–Sun navigator; tapping a chip swaps the shown day below
          without any refetch (the agenda is already fully loaded). */}
      <DayStrip
        items={dayStripItems(agenda, (d, item) => {
          if (item.kind === 'gym') return Boolean(d.date) && gymDoneDates.includes(d.date!)
          if (item.kind === 'sport') return sportDoneOn(d.date, sportOf(item.sport))
          return Boolean(runLoggedFor(item.running.key))
        })}
        // A real-mode rest day (no gym/sport slot matches today at all) leaves
        // `shownDay` undefined even while today is shown (§ isTodayShown above) —
        // fall back to the real weekday label so the strip still highlights a chip
        // instead of selecting none (review fix, mezo-9bbc).
        selected={shownDay?.day ?? (isTodayShown ? DAY_ORDER[todayIdx()] : '')}
        onSelect={(day) => setSelectedDay(day)}
      />

      {/* Mezociklus overview entry card (active meso only) */}
      <div style={{ padding: '0 24px 12px' }}>
        <button
          type="button"
          className="card np-press"
          onClick={() => navigate(`/train/mesocycles/${activeMeso.id}/overview`)}
          aria-label={`Mezociklus áttekintő · ${activeMeso.shortTitle}`}
          style={{ padding: '12px 14px', width: '100%', textAlign: 'left', display: 'block' }}
        >
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>
              🗓 {activeMeso.shortTitle} · {currentPhase} · W{activeMeso.currentWeek}/{activeMeso.weeks}
            </span>
            <span style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>→</span>
          </div>
        </button>
      </div>

      {/* The shown day's hero cards, ordered by time-of-day (gym / volleyball / running).
          A morning run hero appears above an evening gym hero. Each hero keeps
          its bespoke markup; the today gym hero additionally requires the /today workout. */}
      {orderedToday.map((item, i) => {
        if (item.kind === 'gym') {
          const gym = item.gym
          if (isTodayShown) {
            if (!workout) return null
            const gymEyebrow = `MA ${gym.time ?? ''} · ${currentPhase}`
            // Three-state gating (spec 2026-07-15): a completed instance wins (Kész ·
            // Megnézem review), else an open instance (● Folyamatban · Folytassuk),
            // else the fresh start CTA. `completedTodayWorkout`/`todaySession` are real-
            // mode only (both null in mock → Indítsuk, byte-identical to Phase 1).
            const gymInProgress = Boolean(todaySession?.openWorkout && !completedTodayWorkout)
            return (
              <section key="hero-gym" className="trainhero np-anim">
                <div className="trainhero-over">
                  {gymEyebrow}
                  {gymInProgress && (
                    <span
                      className="chip"
                      style={{
                        marginLeft: 8, fontSize: 9, color: 'var(--warning)',
                        borderColor: 'color-mix(in srgb, var(--warning) 40%, transparent)',
                      }}
                    >
                      ● Folyamatban
                    </span>
                  )}
                </div>
                <div className="h2row">
                  <h2>{workout.title}</h2>
                  <span className="typetag typetag-gym">🏋️ GYM</span>
                </div>
                <div className="chips">
                  <span className="chip-np">{workout.exercises.length} gyakorlat</span>
                  <span className="chip-np">{workout.exercises.reduce((acc, e) => acc + e.sets, 0)} szett</span>
                  {workout.durationEst > 0 && <span className="chip-np">~{workout.durationEst} perc</span>}
                  {gym.type && <span className="chip-np">{gym.type}</span>}
                </div>
                {completedTodayWorkout ? (
                  // Done-state: the workout is over (no restart until next week) — the shared
                  // DoneBar opens the read-only review of the completed instance (mezo-9bbc).
                  <DoneBar
                    summary={`Kész · ${completedTodayWorkout.sets.filter((s) => !s.skipped).length} szett`}
                    detail="Megnézem az összegzést"
                    onClick={() => navigate(`/train/review/${completedTodayWorkout.id}`)}
                    ariaLabel="Befejezett edzés áttekintése"
                  />
                ) : todaySession?.openWorkout ? (
                  // In-progress: an open instance exists — resume it (count the logged sets).
                  <div className="np-ctarow">
                    <button type="button" className="np-cta np-press" onClick={openSession}>
                      Folytassuk → · {todaySession.openWorkout.sets.filter((s) => !s.skipped).length} szett kész
                    </button>
                  </div>
                ) : (
                  <div className="np-ctarow">
                    <button type="button" className="np-cta np-press" onClick={openSession}>Indítsuk →</button>
                  </div>
                )}
              </section>
            )
          }

          // Non-today gym day: the /today endpoint only describes today, so title +
          // exercise count come from the meso template (mezo-9bbc).
          const md = activeMeso.days?.find((d) => d.day === shownDay!.day)
          const target = md ? gymDayTarget(md, weekWorkouts) : null
          const done = Boolean(shownDay?.date && gymDoneDates.includes(shownDay.date))
          return (
            <TodaySessionCard
              key="hero-gym"
              tone="gym"
              emoji="🏋️"
              tag="GYM"
              time={gym.time}
              title={gym.type ?? md?.type ?? 'Gym'}
              facts={[md ? `${md.exerciseCount} gyakorlat` : null, gym.duration ? `${gym.duration} perc` : null]}
              logged={done}
              loggedSummary={done ? 'Kész' : undefined}
              stateLabel={SESSION_STATE_LABEL[sessionState({ dayIso: shownDay!.date!, todayIso, timeOfDay: gym.time })]}
              ctaLabel={target ? 'Kezdjük el' : undefined}
              onLog={target ? () => navigate(target) : undefined}
            />
          )
        }

        if (item.kind === 'sport') {
          const vb = item.sport
          const k = sportOf(vb)
          const logged = loggedSportOn(shownIso, k)
          return (
            <TodaySessionCard
              key={`hero-sport-${k}-${vb.time}-${i}`}
              tone={SPORT_TONE[k]}
              emoji={SPORT_EMOJI[k]}
              tag={SPORT_TAGS[k]}
              time={vb.time}
              title={SPORT_TITLES[k]}
              facts={[`${vb.duration} perc`, vb.role, vb.court]}
              logged={Boolean(logged)}
              loggedSummary={
                logged
                  ? k === 'volleyball'
                    ? `RPE ${logged.rpe} · ${logged.duration}p · váll ${logged.shoulderStrain ?? '–'}`
                    : `RPE ${logged.rpe} · ${logged.duration}p`
                  : undefined
              }
              loggedDetail={logged?.time ? `${logged.time}-kor logolva` : null}
              stateLabel={SESSION_STATE_LABEL[sessionState({ dayIso: shownIso, todayIso, timeOfDay: vb.time })]}
              // Logging always writes "now" server-side (SportLogSheet has no date
              // field) — read-only on any non-today day until Task 9 adds a `date`
              // prop + a `Pótold` past-day CTA (mezo-9bbc review fix).
              ctaLabel={isTodayShown ? 'Logold a session-t' : undefined}
              onLog={isTodayShown ? () => setSportLogSport(k) : undefined}
            />
          )
        }

        const s = item.running
        const rl = runLoggedFor(s.key)
        const openRunLog = () => setRunLogCtx({
          blockId: activeRunningBlock!.id,
          weekNumber: activeRunningBlock!.currentWeek,
          sessionKey: s.key,
          label: s.label,
          isSprint: s.kind === 'sprint',
          defaultRounds: s.rounds ?? undefined,
        })
        return (
          <TodaySessionCard
            key={s.key}
            tone="run"
            emoji="🏃"
            tag="FUTÁS"
            time={s.timeOfDay}
            title={s.label}
            facts={[`RPE ${s.rpeTarget.min}–${s.rpeTarget.max}`, s.rounds ? `${s.rounds} kör` : null]}
            logged={Boolean(rl)}
            loggedSummary={rl ? `RPE ${rl.rpeActual ?? '–'}${rl.completedRounds != null ? ` · ${rl.completedRounds} kör` : ''}` : undefined}
            loggedDetail={null}
            stateLabel={SESSION_STATE_LABEL[sessionState({ dayIso: shownIso, todayIso, timeOfDay: s.timeOfDay })]}
            // Same read-only-on-non-today rule as sport (RunLogSheet also has no date
            // field); `rl` itself is already day-scoped by session key, so `logged`
            // needs no change — mezo-9bbc review fix.
            ctaLabel={isTodayShown ? 'Naplózd a futást' : undefined}
            onLog={isTodayShown ? openRunLog : undefined}
          />
        )
      })}

      {/* Open custom (saját) instance on a rest day (real mode, today only): the gym hero
          above only renders when today has a gym schedule slot, so an open instance
          started on a non-gym day (e.g. a meso-less custom workout) otherwise has no
          resume affordance anywhere on Mai (final-review fix, mezo-ws2x — Finding 4).
          getToday's open-wins day resolution means `workout` already IS the open
          instance's day plan here. */}
      {isTodayShown && !shownDay?.gym && todaySession?.openWorkout && workout && (
        <div style={{ padding: '0 24px 12px' }}>
          <div className="card" style={{ padding: 18 }}>
            <span className="eyebrow" style={{ color: 'var(--warning)' }}>● Folyamatban</span>
            <p style={{ fontSize: 15, fontWeight: 600, marginTop: 8, color: 'var(--text-primary)' }}>{workout.title}</p>
            <div className="np-ctarow mt-md">
              <button type="button" className="np-cta np-press" onClick={openSession}>
                Folytassuk → · {todaySession.openWorkout.sets.filter((s) => !s.skipped).length} szett kész
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rest day: nothing scheduled on the shown day. Today's copy offers a Saját edzés
          CTA (the heti rended pointer moved to Heti); a non-today rest day is read-only.
          Gated off a today open instance above — an in-progress resume card and the
          rest-day card must never render together (mezo-ws2x — Finding 4). */}
      {!shownDay?.gym && !shownDay?.sport.length && orderedToday.length === 0 && !(isTodayShown && todaySession?.openWorkout) && (
        <div style={{ padding: '0 24px 12px' }}>
          <div className="card" style={{ padding: 18 }}>
            <span className="eyebrow">{isTodayShown ? 'Ma pihenőnap' : 'Nincs tervezett edzés'}</span>
            <p style={{ fontSize: 13, marginTop: 8, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {isTodayShown
                ? 'Nincs tervezett edzés mára — a heti rended a Heti fülön találod.'
                : 'Ezen a napon nincs tervezett edzés.'}
            </p>
            {isTodayShown && (
              <CtaGhost
                className="rad-12 mt-md"
                onClick={() => setCustomOpen(true)}
                style={{ borderColor: 'color-mix(in srgb, var(--tag-gym) 40%, transparent)', color: 'var(--tag-gym)' }}
              >
                <Icon name="plus" size={12} /> Saját edzés
              </CtaGhost>
            )}
          </div>
        </div>
      )}

      {isTodayShown && showMtr && (
        <MorningTrainingCard
          offending={mtrOffending}
          windowStart={mtrWindow.start}
          windowEnd={mtrWindow.end}
          onApply={applyMtr}
          onSnooze={snoozeMtr}
        />
      )}

      {customOpen && <CustomWorkoutSheet onClose={() => setCustomOpen(false)} />}
      {sportLogSport && (
        <SportLogSheet
          initialSport={sportLogSport}
          onClose={() => setSportLogSport(null)}
          onSave={(body, done) => logSportSession(body, { onSuccess: (r) => showLevelUp(r?.levelUp), onSettled: done })}
        />
      )}
      {runLogCtx && (
        <RunLogSheet
          ctx={runLogCtx}
          onClose={() => setRunLogCtx(null)}
          onSave={(body, done) => logRunSession(body, { onSuccess: (r) => showLevelUp(r?.levelUp), onSettled: done })}
        />
      )}
    </>
  )
}
