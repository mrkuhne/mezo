// ============================================================
// Mezo · TrainWeekPage („Heti”) — the detailed Mon–Sun agenda that used to
// live at the bottom of Mai (mezo-9bbc). Weekly load tiles + one WeeklyDayRow
// per day + the Saját edzés footer + the gym/sport provenance note.
// DS-migrated (mezo-setx.6.3): DS page head, the shared eyebrow+count section
// head, `.dashedcta` for the footer, and the provenance note on the primary
// wash at caption size. `LoadTiles`/`WeeklyDayRow` are used only here, so they
// ride along on this bead (handover §3). Gym rows
// keep their direct-start/review targets; any other session drills into Mai
// with that day selected (`/train?day={index}`).
// ============================================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTrain, useRunning, useWeekWorkouts } from '@/data/hooks'
import { DAY_ORDER } from '@/data/train/train'
import { huMonthDayDow } from '@/shared/lib/dates'
import { Icon } from '@/shared/ui/Icon'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { PageTitle } from '@/shared/ui/PageTitle'
import { GhostState } from '@/shared/ui/GhostState'
import { LoadTiles } from '@/features/train/components/LoadTiles'
import { WeeklyDayRow } from '@/features/train/components/WeeklyDayRow'
import { CustomWorkoutSheet } from '@/features/train/sheets/CustomWorkoutSheet'
import { buildWeekAgenda } from '@/features/train/logic/weekAgenda'
import { weeklyLoad } from '@/features/train/logic/weeklyLoad'
import { gymDayTarget } from '@/features/train/logic/gymDayTarget'
import { sportOf, type SportKind } from '@/features/train/logic/sportKinds'
import TrainWeekSkeleton from '@/features/train/pages/TrainWeekSkeleton'

// Heti never logs a session itself: every sport/run tap drills into Mai (`toMai`),
// which owns the log sheets and the retroactive `date` threading (mezo-9bbc).
export function TrainWeekPage() {
  const { gymSchedule, sport, activeMeso, gymDoneDates, workoutPending, todaySession } = useTrain()
  const { activeRunningBlock, runSessions, runningPending } = useRunning()
  const { workouts: weekWorkouts } = useWeekWorkouts()
  const navigate = useNavigate()
  const [customOpen, setCustomOpen] = useState(false)

  if (workoutPending || runningPending) return <TrainWeekSkeleton />

  const agenda = buildWeekAgenda({
    gymTimes: gymSchedule?.weeklyTimes ?? [],
    sportSlots: sport.schedule?.volleyball.sessions ?? [],
    runningBlock: activeRunningBlock,
    weekWorkouts,
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

  return (
    <>
      <div className="page-header">
        <div>
          <Eyebrow brand>{activeMeso ? `Edzés · W${activeMeso.currentWeek}` : 'Edzés'}</Eyebrow>
          <PageTitle style={{ marginTop: 4 }}>Heti terv</PageTitle>
        </div>
      </div>

      {!activeMeso ? (
        <div style={{ padding: '0 24px 16px' }}>
          <GhostState lines={3} message="A heti rended itt jelenik majd meg — előbb tervezz egy mesociklust."
            ctaLabel="+ Tervezz mesociklust" onCta={() => navigate('/train/mesocycles/new')} />
        </div>
      ) : (
        <>
          <LoadTiles tiles={weeklyLoad(agenda)} />
          <div style={{ padding: '0 24px 16px' }}>
            {/* The same section-head idiom the other migrated Train pages use
                (eyebrow + label-mono count) rather than a second heading style. */}
            <div className="row" style={{ justifyContent: 'space-between', margin: '10px 0' }}>
              <span className="eyebrow">A hét</span>
              <span className="label-mono text-tertiary">{sessionCount} session</span>
            </div>
            <div className="col gap-sm">
              {agenda.map((a) => (
                <WeeklyDayRow
                  key={a.day}
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
              ))}
            </div>
            <button type="button" onClick={() => setCustomOpen(true)} className="card dashedcta mt-md">
              <Icon name="plus" size={14} /> Saját edzés
            </button>
          </div>
        </>
      )}

      <div style={{ padding: '0 24px 32px' }}>
        <div className="card" style={{ padding: 'var(--sp-4)', background: 'var(--primary-bg)' }}>
          <div className="row gap-sm" style={{ alignItems: 'flex-start' }}>
            <Icon name="sparkle" size={16} color="var(--primary-base)" />
            <p style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--text-secondary)', flex: 1 }}>
              A gym a mesociklus szerint, a sport (röpi/cross/TRX) recurring · független. A két ütemterv együtt-mozgatja a
              pacing-et, alvás-onsetet és a vacsora-időt.
            </p>
          </div>
        </div>
      </div>

      {customOpen && <CustomWorkoutSheet onClose={() => setCustomOpen(false)} />}
    </>
  )
}
