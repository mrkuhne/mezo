// ============================================================
// Mezo · TrainTodayView (Mai)
// Today's gym block + today's volleyball block (conditional) +
// combined weekly gym/sport timeline + provenance note.
// Thin TrainScreen shell ⇒ this view owns its own .page-header.
// Ported from prototype train-views.jsx (TrainTodayView + buildWeeklyAgenda).
// ============================================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTrain, useRunning } from '@/data/hooks'
import { DAY_LABELS, DAY_ORDER } from '@/data/train'
import { runSessionsForDay, todayIdx } from '@/data/runningAgenda'
import { huMonthDayDow, localDateString } from '@/lib/dates'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { PageTitle } from '@/components/ui/PageTitle'
import { Display } from '@/components/ui/Display'
import { Icon } from '@/components/ui/Icon'
import { CtaPrimary, CtaGhost } from '@/components/ui/Cta'
import { GhostState } from '@/components/ui/GhostState'
import { SportLogSheet } from '../components/SportLogSheet'
import { RunLogSheet } from '../components/RunLogSheet'
import { WeeklyDayRow, type WeeklyAgendaDay } from '../components/WeeklyDayRow'
import { daySessions } from '../agenda'
import TrainTodaySkeleton from './TrainTodaySkeleton'

type RunLogCtx = { blockId: string; weekNumber: number; sessionKey: string; label: string; isSprint: boolean; defaultRounds?: number }

export function TrainTodayView() {
  const { workout, gymSchedule, sport, activeMeso, logSportSession, gymDoneDates, workoutPending } = useTrain()
  const { activeRunningBlock, runSessions, logRunSession, runningPending } = useRunning()
  const navigate = useNavigate()
  const [vbLogOpen, setVbLogOpen] = useState(false)
  const [runLogCtx, setRunLogCtx] = useState<RunLogCtx | null>(null)

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
        <div className="page-header">
          <div className="col gap-xs">
            <Eyebrow brand>Train · Mai</Eyebrow>
            <PageTitle>Edzés</PageTitle>
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
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
            <span className="eyebrow">Heti terv · gym + futás + sport</span>
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
    const v = vbSessions.find((x) => x.day === d)
    return {
      day: d,
      date: weekDateIso(i),
      gym: g && g.active ? g : null,
      volleyball: v ?? null,
      running: runSessionsForDay(activeRunningBlock, DAY_ORDER.indexOf(d)),
      isToday: Boolean(g?.today || v?.today),
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
    volleyball: today?.volleyball ?? null,
    running: todayRuns,
    isToday: true,
  })
  const sessionCount = agenda.filter((a) => a.gym || a.volleyball || a.running.length).length

  // Active meso phase for the current week (Week 3 ⇒ MAV).
  const currentPhase = activeMeso.phaseCurve[activeMeso.currentWeek - 1]
  const openSession = () => navigate('/train/session')

  // "Logged today" signals drive the hero/weekly done-state. Volleyball has no
  // schedule↔log link, so we match the logged SportSession by today's date (the
  // mapped session carries the HU display date). Running carries the prescribed
  // tuple back, so we match on block + week + sessionKey.
  const todayHu = huMonthDayDow(localDateString())
  const loggedVb = sport.sessions.find((s) => s.sport === 'volleyball' && s.date === todayHu) ?? null
  // Gym done-state: today's date is in the server-computed set of this week's logged-set dates.
  const loggedGym = gymDoneDates.includes(localDateString())
  const runLoggedFor = (key: string) =>
    runSessions.find(
      (r) => r.blockId === activeRunningBlock?.id && r.weekNumber === activeRunningBlock?.currentWeek && r.sessionKey === key,
    ) ?? null
  // A weekly row's done-state matches by its calendar date: volleyball by the mapped HU date,
  // gym by the ISO date in gymDoneDates. (Running matches by block+week+sessionKey, date-agnostic.)
  const vbDoneOn = (iso?: string) =>
    Boolean(iso) && sport.sessions.some((s) => s.sport === 'volleyball' && s.date === huMonthDayDow(iso!))

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div className="col gap-xs">
          <Eyebrow brand>Train · Mai</Eyebrow>
          <PageTitle>Edzés</PageTitle>
        </div>
        <span className="label-mono text-tertiary" style={{ fontSize: 9 }}>
          {today ? DAY_LABELS[today.day] : ''} · W{activeMeso.currentWeek}
        </span>
      </div>

      {/* Today's hero cards, ordered by time-of-day (gym / volleyball / running).
          A morning run hero appears above an evening gym hero. Each hero keeps
          its bespoke markup; the gym hero additionally requires the /today workout. */}
      {orderedToday.map((item) => {
        if (item.kind === 'gym') {
          const gym = item.gym
          if (!workout) return null
          return (
            <div key="hero-gym" style={{ padding: '0 24px 12px' }}>
              <div className="card notch-12" style={{ padding: 18 }}>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div className="col">
                    <span className="eyebrow brand">Week {activeMeso.currentWeek} · {currentPhase}</span>
                    <div style={{ marginTop: 8 }}>
                      <Display size="lg">{workout.title}</Display>
                    </div>
                    {(gym.time || gym.duration) && (
                      <span className="label-mono text-tertiary mt-sm" style={{ fontSize: 10 }}>
                        {[gym.time, gym.duration ? `${gym.duration}p` : null]
                          .filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </div>
                  <span
                    className="chip notch-4"
                    style={{
                      fontSize: 9, display: 'inline-flex', alignItems: 'center', gap: 4,
                      color: loggedGym ? 'var(--success)' : 'var(--brand-glow)',
                      borderColor: loggedGym ? 'color-mix(in srgb, var(--success) 40%, transparent)' : 'var(--border-brand)',
                    }}
                  >
                    {loggedGym ? <><Icon name="check" size={10} /> Kész</> : 'MA'}
                  </span>
                </div>
                <div className="row gap-sm mt-md">
                  <span className="chip notch-4">{workout.exercises.length} gyakorlat</span>
                  <span className="chip notch-4">{workout.exercises.reduce((acc, e) => acc + e.sets, 0)} szet</span>
                  {workout.durationEst > 0 && <span className="chip notch-4">~{workout.durationEst}p</span>}
                </div>
                {loggedGym ? (
                  // Done-state: a muted summary in place of the start CTA (re-entry/edit is the
                  // active-workout-v2 follow-up; gym sessions have no in-place edit sheet yet).
                  <div
                    className="row notch-4 mt-md"
                    style={{
                      justifyContent: 'center', gap: 6, padding: '10px 12px',
                      background: 'rgba(52, 211, 153, 0.08)',
                      border: '1px solid color-mix(in srgb, var(--success) 35%, transparent)',
                      color: 'var(--success)', fontSize: 11, fontFamily: 'var(--ff-mono)',
                    }}
                  >
                    <Icon name="check" size={12} />
                    <span>Mai edzés logolva</span>
                  </div>
                ) : (
                  <CtaPrimary className="mt-md" onClick={openSession}>
                    <span>Indítsuk</span>
                    <span style={{ opacity: 0.5, fontWeight: 400 }}>·</span>
                    <span>{workout.title}</span>
                  </CtaPrimary>
                )}
              </div>
            </div>
          )
        }

        if (item.kind === 'volleyball') {
          const vb = item.volleyball
          return (
            <div key="hero-vb" style={{ padding: '0 24px 12px' }}>
              <div
                className="card notch-12"
                style={{
                  padding: 16,
                  background: 'linear-gradient(180deg, color-mix(in srgb, var(--cat-tendency) 6%, transparent) 0%, var(--surface-1) 100%)',
                  borderColor: 'color-mix(in srgb, var(--cat-tendency) 30%, transparent)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: 'var(--cat-tendency)' }} />
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', paddingLeft: 6 }}>
                  <div className="col">
                    <span className="eyebrow" style={{ color: 'var(--cat-tendency)' }}>Sport · ma</span>
                    <div style={{ marginTop: 6 }}>
                      <Display size="md">Volleyball · {vb.time}</Display>
                    </div>
                    <span className="label-mono text-tertiary mt-sm" style={{ fontSize: 10 }}>
                      {[vb.court, `${vb.duration}p`, vb.role].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                  <span
                    className="chip notch-4"
                    style={{
                      fontSize: 9, display: 'inline-flex', alignItems: 'center', gap: 4,
                      color: loggedVb ? 'var(--success)' : 'var(--cat-tendency)',
                      borderColor: `color-mix(in srgb, ${loggedVb ? 'var(--success)' : 'var(--cat-tendency)'} 40%, transparent)`,
                    }}
                  >
                    {loggedVb ? <><Icon name="check" size={10} /> Kész</> : 'MA'}
                  </span>
                </div>
                {loggedVb ? (
                  // Done-state: a muted, tappable summary of the logged effort
                  // (re-opens the sheet — an in-place edit needs a backend PUT, mezo-0p3 follow-up).
                  <button
                    type="button"
                    onClick={() => setVbLogOpen(true)}
                    className="row notch-4 mt-md"
                    style={{
                      width: '100%', justifyContent: 'center', gap: 6, padding: '10px 12px',
                      background: 'rgba(52, 211, 153, 0.08)',
                      border: '1px solid color-mix(in srgb, var(--success) 35%, transparent)',
                      color: 'var(--success)', fontSize: 11, fontFamily: 'var(--ff-mono)',
                    }}
                  >
                    <Icon name="check" size={12} />
                    <span>Logolva · RPE {loggedVb.rpe} · {loggedVb.duration}p · váll {loggedVb.shoulderStrain ?? '–'}</span>
                  </button>
                ) : (
                  <CtaGhost
                    className="notch-4 mt-md"
                    onClick={() => setVbLogOpen(true)}
                    style={{ borderColor: 'color-mix(in srgb, var(--cat-tendency) 40%, transparent)', color: 'var(--cat-tendency)' }}
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
            <div
              className="card notch-12"
              style={{
                padding: 16,
                background: 'linear-gradient(180deg, color-mix(in srgb, var(--info) 6%, transparent) 0%, var(--surface-1) 100%)',
                borderColor: 'color-mix(in srgb, var(--info) 30%, transparent)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: 'var(--info)' }} />
              <span
                style={{
                  position: 'absolute',
                  right: -50,
                  top: -50,
                  width: 160,
                  height: 160,
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, color-mix(in srgb, var(--info) 12%, transparent), transparent 70%)',
                }}
              />
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', paddingLeft: 6, position: 'relative' }}>
                <div className="col">
                  <span className="eyebrow" style={{ color: 'var(--info)' }}>Futás · ma</span>
                  <div style={{ marginTop: 6 }}>
                    <Display size="md">{s.label}</Display>
                  </div>
                  <span className="label-mono text-tertiary mt-sm" style={{ fontSize: 10 }}>
                    {`RPE ${s.rpeTarget.min}–${s.rpeTarget.max}${s.rounds ? ` · ${s.rounds} kör` : ''}`}
                  </span>
                </div>
                <span
                  className="chip notch-4"
                  style={{
                    fontSize: 9, display: 'inline-flex', alignItems: 'center', gap: 4,
                    color: rl ? 'var(--success)' : 'var(--info)',
                    borderColor: `color-mix(in srgb, ${rl ? 'var(--success)' : 'var(--info)'} 40%, transparent)`,
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
                  className="row notch-4 mt-md"
                  style={{
                    width: '100%', justifyContent: 'center', gap: 6, padding: '10px 12px', position: 'relative',
                    background: 'rgba(52, 211, 153, 0.08)',
                    border: '1px solid color-mix(in srgb, var(--success) 35%, transparent)',
                    color: 'var(--success)', fontSize: 11, fontFamily: 'var(--ff-mono)',
                  }}
                >
                  <Icon name="check" size={12} />
                  <span>Logolva · RPE {rl.rpeActual ?? '–'}{rl.completedRounds != null ? ` · ${rl.completedRounds} kör` : ''}</span>
                </button>
              ) : (
                <CtaGhost
                  className="notch-4 mt-md"
                  onClick={() => setRunLogCtx({
                    blockId: activeRunningBlock!.id,
                    weekNumber: activeRunningBlock!.currentWeek,
                    sessionKey: s.key,
                    label: s.label,
                    isSprint: s.kind === 'sprint',
                    defaultRounds: s.rounds ?? undefined,
                  })}
                  style={{ borderColor: 'color-mix(in srgb, var(--info) 40%, transparent)', color: 'var(--info)' }}
                >
                  <Icon name="plus" size={12} /> Naplózd a futást
                </CtaGhost>
              )}
            </div>
          </div>
        )
      })}

      {/* Rest day (real mode): nothing today — no gym slot, no volleyball, no run */}
      {!today?.gym && !today?.volleyball && todayRuns.length === 0 && (
        <div style={{ padding: '0 24px 12px' }}>
          <div className="card notch-12" style={{ padding: 18 }}>
            <span className="eyebrow">Ma pihenőnap</span>
            <p style={{ fontSize: 13, marginTop: 8, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Nincs tervezett edzés mára — a heti rended lent találod.
            </p>
          </div>
        </div>
      )}

      {/* Weekly combined timeline */}
      <div style={{ padding: '0 24px 16px' }}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
          <span className="eyebrow">Heti terv · gym + futás + sport</span>
          <span className="label-mono text-tertiary" style={{ fontSize: 9 }}>{sessionCount} session</span>
        </div>
        <div className="col gap-sm">
          {agenda.map((a) => (
            <WeeklyDayRow
              key={a.day}
              agenda={a}
              gymLogged={Boolean(a.date) && gymDoneDates.includes(a.date!)}
              vbLogged={vbDoneOn(a.date)}
              isRunLogged={(key) => Boolean(runLoggedFor(key))}
              onStartGym={openSession}
              onLogVolleyball={() => setVbLogOpen(true)}
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
        <div className="card notch-4" style={{ padding: 12, background: 'rgba(94, 234, 212, 0.03)' }}>
          <div className="row gap-sm" style={{ alignItems: 'flex-start' }}>
            <Icon name="sparkle" size={12} color="var(--brand-glow)" />
            <p style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text-secondary)', flex: 1 }}>
              A gym a mesociklus szerint, a volleyball recurring · független. A két ütemterv együtt-mozgatja a
              pacing-et, alvás-onsetet és a vacsora-időt.
            </p>
          </div>
        </div>
      </div>

      {vbLogOpen && <SportLogSheet onClose={() => setVbLogOpen(false)} onSave={logSportSession} />}
      {runLogCtx && <RunLogSheet ctx={runLogCtx} onClose={() => setRunLogCtx(null)} onSave={(body) => logRunSession(body)} />}
    </>
  )
}
