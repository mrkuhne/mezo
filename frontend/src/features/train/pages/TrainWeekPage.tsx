// ============================================================
// Mezo · TrainWeekPage („Heti") — Mozaik 2.0 re-face (mezo-d20.3.2).
// Source of truth: docs/design_2.0/prototypes/src/edzes-body.html #page-heti
// (p-gold tone, ×1.18): compact-subpage-hero (i-edzes clay icon + "{done}/{total}"
// big number, no subtitle) → stat strip → the week's day list → a static
// izom-zóna panel. GymPage folds in here (mezo-d20.3.2 scope note): its
// muscle-zone meta card (schedule chip, Mezociklus áttekintő chip, live zone
// rows, MuscleWeekSheet detail) moves onto Heti; GymPage.tsx itself becomes a
// thin `/train/week` redirect (its per-day GymDayCard list is dropped as a
// true duplicate — Heti's own day list already routes every gym day through
// the same `gymDayTarget` direct-start/review logic via WeeklyDayRow).
//
// Dropped (deliberate, noted in the branch report): the meta card's Fázis/
// Split/PhaseDots readout — the prototype's Heti never repeats the active
// phase (that's Mesociklus's job); the "Mezociklus áttekintő" chip still
// reaches it. Also dropped: a fabricated "RPE átlag" stat — the prototype
// shows one, but no cross-domain (gym RIR + sport RPE) weekly aggregate
// exists yet; honest-states over pixel-matching a number nothing computes.
//
// Every data hook, mutation and behavioral contract is verbatim from before
// this slice — only the face + page composition changed.
// ============================================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTrain, useRunning, useWeekWorkouts, useWeekMuscleLog, useMedals } from '@/data/hooks'
import { DAY_ORDER } from '@/data/train/train'
import { huMonthDayDow } from '@/shared/lib/dates'
import { GhostState } from '@/shared/ui/GhostState'
import { MozaikPage, PageHead, PageHero, PageBody, StatCell } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { LoadTiles } from '@/features/train/components/LoadTiles'
import { WeeklyDayRow } from '@/features/train/components/WeeklyDayRow'
import { ZoneMiniGrid } from '@/features/train/components/ZoneMiniGrid'
import { CustomWorkoutSheet } from '@/features/train/sheets/CustomWorkoutSheet'
import { GymScheduleSheet } from '@/features/train/sheets/GymScheduleSheet'
import { MuscleWeekSheet } from '@/features/train/sheets/MuscleWeekSheet'
import { buildWeekAgenda, weekDateIso } from '@/features/train/logic/weekAgenda'
import { weeklyLoad } from '@/features/train/logic/weeklyLoad'
import { gymDayTarget } from '@/features/train/logic/gymDayTarget'
import { selectGymRows, weekZoneRows } from '@/features/train/logic/weekZone'
import { sportOf, type SportKind } from '@/features/train/logic/sportKinds'
import type { GymScheduleSlot } from '@/data/types'
import TrainWeekSkeleton from '@/features/train/pages/TrainWeekSkeleton'

// Heti never logs a session itself: every sport/run tap drills into Mai (`toMai`),
// which owns the log sheets and the retroactive `date` threading (mezo-9bbc).
export function TrainWeekPage() {
  const {
    gymSchedule, sport, activeMeso, gymDoneDates, workoutPending, todaySession, gymSlots, saveGymSchedule,
    sportSlotSkips,
  } = useTrain()
  const { activeRunningBlock, runSessions, runningPending } = useRunning()
  const { workouts: weekWorkouts } = useWeekWorkouts()
  const weekLog = useWeekMuscleLog()
  const { data: medals } = useMedals()
  const navigate = useNavigate()
  const [customOpen, setCustomOpen] = useState(false)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [muscleOpen, setMuscleOpen] = useState(false)
  // Optimistic local copy of a schedule save; null = render the hook's (query-backed) slots
  // (folded in from GymPage, mezo-d20.3.2 — same override idiom, unchanged behavior).
  const [gymOverride, setGymOverride] = useState<GymScheduleSlot[] | null>(null)

  if (workoutPending || runningPending) return <TrainWeekSkeleton />

  if (!activeMeso) {
    return (
      <MozaikPage tone="gold">
        <PageHead onBack={() => navigate('/train')} label="‹ Edzés" />
        <PageHero icon="i-edzes" name="Heti edzések" />
        <PageBody>
          <GhostState lines={3} message="A heti rended itt jelenik majd meg — előbb tervezz egy mesociklust."
            ctaLabel="+ Tervezz mesociklust" onCta={() => navigate('/train/mesocycles/new')} />
        </PageBody>
      </MozaikPage>
    )
  }

  const agenda = buildWeekAgenda({
    gymTimes: gymSchedule?.weeklyTimes ?? [],
    sportSlots: sport.schedule?.volleyball.sessions ?? [],
    runningBlock: activeRunningBlock,
    weekWorkouts,
    skips: sportSlotSkips,
  })
  const sessionCount = agenda.filter((a) => a.gym || a.sport.length || a.running.length).length
  const sportDoneOn = (iso: string | undefined, k: SportKind) =>
    Boolean(iso) && sport.sessions.some((s) => s.sport === k && s.date === huMonthDayDow(iso!))
  const workoutIdByDate = Object.fromEntries(
    weekWorkouts.filter((w) => w.status === 'completed' && w.origin === 'meso').map((w) => [w.date, w.id]),
  )
  const runLoggedFor = (key: string) =>
    runSessions.some(
      (r) => r.blockId === activeRunningBlock?.id && r.weekNumber === activeRunningBlock?.currentWeek && r.sessionKey === key,
    )
  const toMai = (day: string) => navigate(`/train?day=${DAY_ORDER.indexOf(day as (typeof DAY_ORDER)[number])}`)

  // Whole-day completion (hero big number): every item the day actually holds
  // (gym and/or sport and/or run) is done. A rest day never counts either way.
  const doneCount = agenda.filter((a) => {
    const hasContent = Boolean(a.gym) || a.sport.length > 0 || a.running.length > 0
    if (!hasContent) return false
    const gymOk = !a.gym || (Boolean(a.date) && gymDoneDates.includes(a.date!))
    const sportOk = a.sport.every((s) => sportDoneOn(a.date, sportOf(s)))
    const runOk = a.running.every((r) => runLoggedFor(r.key))
    return gymOk && sportOk && runOk
  }).length

  // Folded in from GymPage's meta card (mezo-d20.3.2): planned-set total + live
  // zone rows for the week's gym days.
  const days = activeMeso.days ?? []
  const gymDays = days.filter((d) => d.exerciseCount > 0)
  const totalSets = gymDays.reduce((acc, d) => acc + d.exercises.reduce((b, e) => b + e.workingSets, 0), 0)
  const doneGymDays = weekLog.completedSummaries.filter((s) => s.origin === 'meso').length
  const zoneRows = selectGymRows(weekZoneRows({ plannedDays: days, completed: weekLog.details }))

  // Medals earned within this Mon–Sun week (weekDateIso is ISO, so lexical
  // comparison sorts correctly) — a real, always-defined count (0 is honest).
  const weekStart = weekDateIso(0)
  const weekEnd = weekDateIso(6)
  const weekMedalCount = medals.filter((m) => m.date >= weekStart && m.date <= weekEnd).length

  return (
    <MozaikPage tone="gold">
      <PageHead onBack={() => navigate('/train')} label="‹ Edzés">
        <button type="button" className="mz-pgact" onClick={() => setScheduleOpen(true)}>Időpontok</button>
        <button
          type="button"
          className="mz-pgact"
          onClick={() => navigate(`/train/mesocycles/${activeMeso.id}/overview`)}
          aria-label={`Mezociklus áttekintő · W${activeMeso.currentWeek}/${activeMeso.weeks}`}
        >
          W{activeMeso.currentWeek}/{activeMeso.weeks} ›
        </button>
      </PageHead>
      <EntranceGroup>
        <PageHero icon="i-edzes" big={`${doneCount}/${sessionCount}`} name="Heti edzések" />
        <PageBody>
          {/* The prototype's #page-heti stagger: strip 40ms, the day list 100ms,
              the zone panel 160ms — .rise inside the armed .mz-play wrapper
              (adding one without the other is the silent-static bug). */}
          <div className="mz-statstrip rise" style={{ '--d': '40ms' } as React.CSSProperties}>
            <StatCell value={totalSets} label="szett terv" />
            <StatCell value={`${doneGymDays}/${gymDays.length}`} label="gym nap kész" />
            <StatCell value={weekMedalCount} label="medál e héten" />
          </div>

          <div className="col gap-sm mt-md" data-kalauz-anchor="heti-napok">
            {agenda.map((a, i) => (
              <div key={a.day} className="rise" style={{ '--d': `${100 + i * 40}ms` } as React.CSSProperties}>
              <WeeklyDayRow
                agenda={a}
                gymLogged={Boolean(a.date) && gymDoneDates.includes(a.date!)}
                gymInProgress={Boolean(a.isToday && todaySession?.openWorkout)}
                isSportLogged={(s) => sportDoneOn(a.date, sportOf(s))}
                isRunLogged={(key) => runLoggedFor(key)}
                onStartGym={() => navigate('/train/session')}
                onReviewGym={workoutIdByDate[a.date!] ? () => navigate(`/train/review/${workoutIdByDate[a.date!]}`) : undefined}
                onOpenGymDay={(() => {
                  const md = activeMeso.days?.find((d) => d.day === a.day && d.exerciseCount > 0)
                  if (!md) return undefined
                  const target = gymDayTarget(md, weekWorkouts)
                  return target ? () => navigate(target) : undefined
                })()}
                onLogSport={() => toMai(a.day)}
                onLogRun={() => toMai(a.day)}
                onReviewCustom={(wid) => navigate(`/train/review/${wid}`)}
              />
              </div>
            ))}
          </div>

          <div className="rise" style={{ '--d': '380ms' } as React.CSSProperties}>
            <LoadTiles tiles={weeklyLoad(agenda)} />
          </div>

          <button
            type="button"
            onClick={() => setCustomOpen(true)}
            className="card dashedcta mt-md rise"
            style={{ '--d': '410ms' } as React.CSSProperties}
          >
            + Saját edzés
          </button>

          {zoneRows.length > 0 && (
            <>
              <span
                className="mz-eyebrow rise"
                style={{ display: 'block', padding: '14px 2px 8px', '--d': '440ms' } as React.CSSProperties}
              >
                Izom-zónák · e hét
              </span>
              <button
                type="button"
                className="mz-panel rise"
                style={{ width: '100%', textAlign: 'left', border: '0.5px solid rgba(43, 33, 24, 0.07)', cursor: 'pointer', '--d': '470ms' } as React.CSSProperties}
                onClick={() => setMuscleOpen(true)}
                aria-label="Heti izomterhelés — részletek"
              >
                <ZoneMiniGrid rows={zoneRows} />
              </button>
            </>
          )}

          <div
            className="card rise"
            style={{ marginTop: 12, padding: 'var(--sp-4)', background: 'var(--primary-bg)', '--d': '500ms' } as React.CSSProperties}
          >
            <p style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
              A gym a mesociklus szerint, a sport (röpi/cross/TRX) recurring · független. A két ütemterv együtt-mozgatja a
              pacing-et, alvás-onsetet és a vacsora-időt.
            </p>
          </div>
        </PageBody>
      </EntranceGroup>

      {customOpen && <CustomWorkoutSheet onClose={() => setCustomOpen(false)} />}
      {scheduleOpen && (
        <GymScheduleSheet
          slots={gymOverride ?? gymSlots}
          onSave={(next) => {
            setGymOverride(next)
            saveGymSchedule(next)
          }}
          onClose={() => setScheduleOpen(false)}
        />
      )}
      {muscleOpen && (
        <MuscleWeekSheet
          meso={activeMeso}
          sportSlots={sport.schedule?.volleyball.sessions ?? []}
          onClose={() => setMuscleOpen(false)}
        />
      )}
    </MozaikPage>
  )
}
