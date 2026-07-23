// ============================================================
// Mezo · TrainTodayPage (Mai)
// Today's gym block + today's volleyball block (conditional) +
// combined weekly gym/sport timeline + provenance note.
// Thin TrainSection shell ⇒ this view owns its own .page-header.
// Ported from prototype train-views.jsx (TrainTodayPage + buildWeeklyAgenda).
// ============================================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTrain, useRunning, useWeekWorkouts } from '@/data/hooks'
import { useLevelUp } from '@/features/progression/LevelUpProvider'
import { DAY_LABELS, DAY_ORDER } from '@/data/train/train'
import { runSessionsForDay, todayIdx } from '@/data/train/runningAgenda'
import { huMonthDayDow, localDateString } from '@/shared/lib/dates'
import { Display } from '@/shared/ui/Display'
import { Icon } from '@/shared/ui/Icon'
import { CtaGhost } from '@/shared/ui/Cta'
import { GhostState } from '@/shared/ui/GhostState'
import { SportLogSheet } from '@/features/train/sheets/SportLogSheet'
import { RunLogSheet } from '@/features/train/sheets/RunLogSheet'
import { GymDaySheet } from '@/features/train/sheets/GymDaySheet'
import type { MesoDay } from '@/data/types'
import { WeeklyDayRow, type WeeklyAgendaDay } from '@/features/train/components/WeeklyDayRow'
import { daySessions } from '@/features/train/logic/agenda'
import { weeklyLoad } from '@/features/train/logic/weeklyLoad'
import { LoadTiles } from '@/features/train/components/LoadTiles'
import TrainTodaySkeleton from '@/features/train/pages/TrainTodaySkeleton'
import { sportOf, SPORT_EMOJI, SPORT_TAGS, SPORT_TITLES, type SportKind } from '@/features/train/logic/sportKinds'

type RunLogCtx = { blockId: string; weekNumber: number; sessionKey: string; label: string; isSprint: boolean; defaultRounds?: number }

export function TrainTodayPage() {
  const { workout, gymSchedule, sport, activeMeso, logSportSession, gymDoneDates, workoutPending, todaySession, completedTodayWorkout } = useTrain()
  const { activeRunningBlock, runSessions, logRunSession, runningPending } = useRunning()
  // Completed workout summaries for this Mon–Sun week — maps each done day's ISO
  // date to its instance id so a weekly gym row can open the review (real mode).
  const { workouts: weekWorkouts } = useWeekWorkouts()
  const navigate = useNavigate()
  const { showLevelUp } = useLevelUp()
  const [sportLogSport, setSportLogSport] = useState<SportKind | null>(null)
  const [runLogCtx, setRunLogCtx] = useState<RunLogCtx | null>(null)
  const [openGymDay, setOpenGymDay] = useState<MesoDay | null>(null)

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
      </>
    )
  }

  // Combine gym schedule + volleyball sessions into a unified weekly map. Each row carries
  // its calendar ISO date (this week's Monday + index) so done-state can be matched per day.
  const gymTimes = gymSchedule?.weeklyTimes ?? []
  const vbSessions = sport.schedule?.volleyball.sessions ?? []
  const weekDateIso = (i: number) => {
    const base = new Date()
    return localDateString(new Date(base.getFullYear(), base.getMonth(), base.getDate() - todayIdx() + i))
  }
  const agenda: WeeklyAgendaDay[] = DAY_ORDER.map((d, i) => {
    const g = gymTimes.find((x) => x.day === d)
    const v = vbSessions.filter((x) => x.day === d)
    return {
      day: d,
      date: weekDateIso(i),
      gym: g && g.active ? g : null,
      sport: v,
      running: runSessionsForDay(activeRunningBlock, DAY_ORDER.indexOf(d)),
      isToday: Boolean(g?.today || v.some((x) => x.today)),
    }
  })

  // The agenda's `isToday` is flag-based (gym/volleyball only); running blocks
  // are mesocycle-independent, so a day may have ONLY a prescribed run today.
  // Pull today's runs separately (date-based) and merge them with the flag-based
  // today row into a synthetic day, so a run-only-today still shows its hero.
  const today = agenda.find((a) => a.isToday)
  const todayRuns = runSessionsForDay(activeRunningBlock, todayIdx())
  // Today's hero cards rendered in time-of-day order (a morning run hero above
  // an evening gym hero); same ordering as the weekly rows via daySessions.
  const orderedToday = daySessions({
    day: today?.day ?? '',
    gym: today?.gym ?? null,
    sport: today?.sport ?? [],
    running: todayRuns,
    isToday: true,
  })
  const sessionCount = agenda.filter((a) => a.gym || a.sport.length || a.running.length).length

  // Active meso phase for the current week (Week 3 ⇒ MAV).
  const currentPhase = activeMeso.phaseCurve[activeMeso.currentWeek - 1]
  const openSession = () => navigate('/train/session')

  // "Logged today" signals drive the hero/weekly done-state. Volleyball has no
  // schedule↔log link, so we match the logged SportSession by today's date (the
  // mapped session carries the HU display date). Running carries the prescribed
  // tuple back, so we match on block + week + sessionKey.
  const todayHu = huMonthDayDow(localDateString())
  // A slot's done-state matches a logged session by DATE **and** SPORT — a mixed day
  // (TRX noon + volleyball evening) must flip each slot independently.
  const loggedSportToday = (k: SportKind) =>
    sport.sessions.find((s) => s.sport === k && s.date === todayHu) ?? null
  const sportDoneOn = (iso: string | undefined, k: SportKind) =>
    Boolean(iso) && sport.sessions.some((s) => s.sport === k && s.date === huMonthDayDow(iso!))
  // Weekly-row review taps: a completed instance per day → its id, so a kész gym
  // row opens /train/review/{id} (real mode; mock has no persisted instances).
  const workoutIdByDate = Object.fromEntries(
    weekWorkouts.filter((w) => w.status === 'completed').map((w) => [w.date, w.id]),
  )
  const runLoggedFor = (key: string) =>
    runSessions.find(
      (r) => r.blockId === activeRunningBlock?.id && r.weekNumber === activeRunningBlock?.currentWeek && r.sessionKey === key,
    ) ?? null

  // Napiv page-head over-line: `Edzés · {day} · W{n}`; without a today row
  // (agenda has no isToday flag set — a run-only day still has `today` undefined
  // via the flag-based find above), drop the day segment instead of interpolating
  // an empty string (avoids a dangling " · " artifact).
  const overLine = today
    ? `Edzés · ${DAY_LABELS[today.day]} · W${activeMeso.currentWeek}`
    : `Edzés · W${activeMeso.currentWeek}`

  return (
    <>
      {/* Header */}
      <div className="pghead-np">
        <div>
          <div className="over">{overLine}</div>
          <h1>Mai nap</h1>
        </div>
      </div>

      {/* Today's hero cards, ordered by time-of-day (gym / volleyball / running).
          A morning run hero appears above an evening gym hero. Each hero keeps
          its bespoke markup; the gym hero additionally requires the /today workout. */}
      {orderedToday.map((item, i) => {
        if (item.kind === 'gym') {
          const gym = item.gym
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
                // Done-state: the workout is over (no restart until next week) — the CTA
                // opens the read-only review of the completed instance.
                <button
                  type="button"
                  onClick={() => navigate(`/train/review/${completedTodayWorkout.id}`)}
                  className="row rad-12 mt-md"
                  style={{
                    width: '100%', justifyContent: 'center', gap: 6, padding: '10px 12px',
                    background: 'rgba(52, 211, 153, 0.08)',
                    border: '1px solid color-mix(in srgb, var(--success) 35%, transparent)',
                    color: 'var(--success)', fontSize: 11,
                  }}
                >
                  <Icon name="check" size={12} />
                  <span>Kész · {completedTodayWorkout.sets.filter((s) => !s.skipped).length} szett — Megnézem →</span>
                </button>
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

        if (item.kind === 'sport') {
          const vb = item.sport
          const k = sportOf(vb)
          const logged = loggedSportToday(k)
          return (
            <div key={`hero-sport-${k}-${vb.time}-${i}`} style={{ padding: '0 24px 12px' }}>
              <div className="np-eventrow">
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div className="col">
                    <div className="np-eventrow-head">
                      <span className="typetag typetag-sport">{SPORT_EMOJI[k]} {SPORT_TAGS[k]}</span>
                      <Display size="sm">{SPORT_TITLES[k]} · {vb.time}</Display>
                    </div>
                    <span className="label-mono text-tertiary mt-sm" style={{ fontSize: 10 }}>
                      {[vb.court, `${vb.duration}p`, vb.role].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                  <span
                    className="chip"
                    style={{
                      fontSize: 9, display: 'inline-flex', alignItems: 'center', gap: 4,
                      color: logged ? 'var(--success)' : 'var(--tag-sport)',
                      borderColor: `color-mix(in srgb, ${logged ? 'var(--success)' : 'var(--tag-sport)'} 40%, transparent)`,
                    }}
                  >
                    {logged ? <><Icon name="check" size={10} /> Kész</> : 'MA'}
                  </span>
                </div>
                {logged ? (
                  <button
                    type="button"
                    onClick={() => setSportLogSport(k)}
                    className="row rad-12 mt-md"
                    style={{
                      width: '100%', justifyContent: 'center', gap: 6, padding: '10px 12px',
                      background: 'rgba(52, 211, 153, 0.08)',
                      border: '1px solid color-mix(in srgb, var(--success) 35%, transparent)',
                      color: 'var(--success)', fontSize: 11,
                    }}
                  >
                    <Icon name="check" size={12} />
                    <span>
                      {k === 'volleyball'
                        ? `Logolva · RPE ${logged.rpe} · ${logged.duration}p · váll ${logged.shoulderStrain ?? '–'}`
                        : `Logolva · RPE ${logged.rpe} · ${logged.duration}p`}
                    </span>
                  </button>
                ) : (
                  <CtaGhost
                    className="rad-12 mt-md"
                    onClick={() => setSportLogSport(k)}
                    style={{ borderColor: 'color-mix(in srgb, var(--tag-sport) 40%, transparent)', color: 'var(--tag-sport)' }}
                  >
                    <Icon name="plus" size={12} /> Logold a session-t
                  </CtaGhost>
                )}
              </div>
            </div>
          )
        }

        const s = item.running
        const rl = runLoggedFor(s.key)
        return (
          <div key={s.key} style={{ padding: '0 24px 12px' }}>
            <div className="np-eventrow">
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div className="col">
                  <div className="np-eventrow-head">
                    <span className="typetag typetag-run">🏃 FUTÁS</span>
                    <Display size="sm">{s.label}</Display>
                  </div>
                  <span className="label-mono text-tertiary mt-sm" style={{ fontSize: 10 }}>
                    {`RPE ${s.rpeTarget.min}–${s.rpeTarget.max}${s.rounds ? ` · ${s.rounds} kör` : ''}`}
                  </span>
                </div>
                <span
                  className="chip"
                  style={{
                    fontSize: 9, display: 'inline-flex', alignItems: 'center', gap: 4,
                    color: rl ? 'var(--success)' : 'var(--tag-run)',
                    borderColor: `color-mix(in srgb, ${rl ? 'var(--success)' : 'var(--tag-run)'} 40%, transparent)`,
                  }}
                >
                  {rl ? <><Icon name="check" size={10} /> Kész</> : 'MA'}
                </span>
              </div>
              {rl ? (
                <button
                  type="button"
                  onClick={() => setRunLogCtx({
                    blockId: activeRunningBlock!.id,
                    weekNumber: activeRunningBlock!.currentWeek,
                    sessionKey: s.key,
                    label: s.label,
                    isSprint: s.kind === 'sprint',
                    defaultRounds: s.rounds ?? undefined,
                  })}
                  className="row rad-12 mt-md"
                  style={{
                    width: '100%', justifyContent: 'center', gap: 6, padding: '10px 12px',
                    background: 'rgba(52, 211, 153, 0.08)',
                    border: '1px solid color-mix(in srgb, var(--success) 35%, transparent)',
                    color: 'var(--success)', fontSize: 11,
                  }}
                >
                  <Icon name="check" size={12} />
                  <span>Logolva · RPE {rl.rpeActual ?? '–'}{rl.completedRounds != null ? ` · ${rl.completedRounds} kör` : ''}</span>
                </button>
              ) : (
                <CtaGhost
                  className="rad-12 mt-md"
                  onClick={() => setRunLogCtx({
                    blockId: activeRunningBlock!.id,
                    weekNumber: activeRunningBlock!.currentWeek,
                    sessionKey: s.key,
                    label: s.label,
                    isSprint: s.kind === 'sprint',
                    defaultRounds: s.rounds ?? undefined,
                  })}
                  style={{ borderColor: 'color-mix(in srgb, var(--tag-run) 40%, transparent)', color: 'var(--tag-run)' }}
                >
                  <Icon name="plus" size={12} /> Naplózd a futást
                </CtaGhost>
              )}
            </div>
          </div>
        )
      })}

      {/* Rest day (real mode): nothing today — no gym slot, no volleyball, no run */}
      {!today?.gym && !today?.sport.length && todayRuns.length === 0 && (
        <div style={{ padding: '0 24px 12px' }}>
          <div className="card" style={{ padding: 18 }}>
            <span className="eyebrow">Ma pihenőnap</span>
            <p style={{ fontSize: 13, marginTop: 8, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Nincs tervezett edzés mára — a heti rended lent találod.
            </p>
          </div>
        </div>
      )}

      {/* Weekly load summary tiles (renders null on an empty week) */}
      <LoadTiles tiles={weeklyLoad(agenda)} />

      {/* Weekly combined timeline */}
      <div style={{ padding: '0 24px 16px' }}>
        <div className="secthead-np">
          <h3>Heti terv</h3>
          <span>{sessionCount} session</span>
        </div>
        <div className="col gap-sm">
          {agenda.map((a) => (
            <WeeklyDayRow
              key={a.day}
              agenda={a}
              gymLogged={Boolean(a.date) && gymDoneDates.includes(a.date!)}
              gymInProgress={Boolean(a.isToday && todaySession?.openWorkout)}
              isSportLogged={(s) => sportDoneOn(a.date, sportOf(s))}
              isRunLogged={(key) => Boolean(runLoggedFor(key))}
              onStartGym={openSession}
              onReviewGym={workoutIdByDate[a.date!] ? () => navigate(`/train/review/${workoutIdByDate[a.date!]}`) : undefined}
              onOpenGymDay={(() => {
                const md = activeMeso.days?.find((d) => d.day === a.day && d.exerciseCount > 0)
                return md ? () => setOpenGymDay(md) : undefined
              })()}
              onLogSport={(s) => setSportLogSport(sportOf(s))}
              onLogRun={(s) => setRunLogCtx({
                blockId: activeRunningBlock!.id,
                weekNumber: activeRunningBlock!.currentWeek,
                sessionKey: s.key,
                label: s.label,
                isSprint: s.kind === 'sprint',
                defaultRounds: s.rounds ?? undefined,
              })}
            />
          ))}
        </div>
      </div>

      {/* Note */}
      <div style={{ padding: '0 24px 32px' }}>
        <div className="card" style={{ padding: 12, background: 'color-mix(in srgb, var(--coral) 3%, transparent)' }}>
          <div className="row gap-sm" style={{ alignItems: 'flex-start' }}>
            <Icon name="sparkle" size={12} color="var(--coral)" />
            <p style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text-secondary)', flex: 1 }}>
              A gym a mesociklus szerint, a sport (röpi/cross/TRX) recurring · független. A két ütemterv együtt-mozgatja a
              pacing-et, alvás-onsetet és a vacsora-időt.
            </p>
          </div>
        </div>
      </div>

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
      {openGymDay && (
        <GymDaySheet
          day={openGymDay}
          completedThisWeek={(() => {
            const done = weekWorkouts.find((w) => w.templateSessionId && w.templateSessionId === openGymDay.id)
            return done ? { id: done.id, date: done.date } : null
          })()}
          openTemplateSessionId={todaySession?.openWorkout?.templateSessionId ?? null}
          openWorkoutTitle={
            activeMeso.days?.find((d) => d.id && d.id === todaySession?.openWorkout?.templateSessionId)?.type ?? null
          }
          onClose={() => setOpenGymDay(null)}
        />
      )}
    </>
  )
}
