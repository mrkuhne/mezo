// ============================================================
// Mezo · WeeklyDayRow — one day in the combined gym + volleyball
// weekly timeline (Mai view). Napiv `.dayrow` day card (spec §4.3).
// ============================================================
import { cn } from '@/shared/lib/cn'
import type { GymScheduleDay, VolleyballSession } from '@/data/types'
import type { RunPrescribedSession } from '@/data/train/runningApi'
import { daySessions } from '@/features/train/logic/agenda'

export interface WeeklyAgendaDay {
  day: string
  /** ISO date of this row's day in the current week — used by the parent to derive done-state. */
  date?: string
  gym: GymScheduleDay | null
  volleyball: VolleyballSession | null
  running: RunPrescribedSession[]
  isToday: boolean
}

interface WeeklyDayRowProps {
  agenda: WeeklyAgendaDay
  /** This day's gym workout has a logged set ⇒ show the done chip (today or a past day). */
  gymLogged?: boolean
  /** This day's volleyball slot has a logged session ⇒ show the done chip (today or a past day). */
  vbLogged?: boolean
  /** This day's prescribed run (by key) has a logged session ⇒ show the done chip. */
  isRunLogged?: (key: string) => boolean
  onStartGym: () => void
  onLogVolleyball: () => void
  onLogRun?: (s: RunPrescribedSession) => void
}

export function WeeklyDayRow({ agenda, gymLogged, vbLogged, isRunLogged, onStartGym, onLogVolleyball, onLogRun }: WeeklyDayRowProps) {
  const { day, isToday } = agenda
  // Time-ordered flat session list — gym/volleyball/running interleave by
  // time-of-day so a morning run renders above an evening gym (untimed last).
  const sessions = daySessions(agenda)
  const hasContent = sessions.length > 0

  return (
    <div className={cn('dayrow', isToday && 'today', !hasContent && 'rest')}>
      <div className="d">
        {day}
        {isToday && <small>MA</small>}
      </div>

      <div className="sess">
        {!hasContent && (
          <div className="s">
            <span className="meta">Pihenőnap</span>
          </div>
        )}

        {sessions.map((item) => {
          if (item.kind === 'gym') {
            const gym = item.gym
            // `type` doubles as the row title below (no separate workout-name field on
            // GymScheduleDay) — repeating it here disambiguates same-time/duration gym
            // days from each other AND from the TrainTodayPage hero's own `time · Xp` line.
            const meta = [gym.time, gym.duration ? `${gym.duration}p` : null, gym.type].filter(Boolean).join(' · ')
            return (
              <button key="gym" type="button" className="s" onClick={isToday ? onStartGym : undefined}>
                <span className="stag stag-gym">GYM</span>
                {isToday ? <b>{gym.type}</b> : gym.type}
                <span className="meta">{meta}</span>
                {gymLogged && <span className="done-chip">kész</span>}
              </button>
            )
          }

          if (item.kind === 'volleyball') {
            const volleyball = item.volleyball
            const meta = [volleyball.time, `${volleyball.duration}p`, volleyball.role, volleyball.intensity]
              .filter(Boolean)
              .join(' · ')
            return (
              <button key="volleyball" type="button" className="s" onClick={isToday ? onLogVolleyball : undefined}>
                <span className="stag stag-sport">RÖPI</span>
                {isToday ? <b>Volleyball</b> : 'Volleyball'}
                <span className="meta">{meta}</span>
                {(vbLogged || isToday) && (
                  <span className={vbLogged ? 'done-chip' : cn('log-chip', 'stag-sport')}>
                    {vbLogged ? 'kész' : 'log'}
                  </span>
                )}
              </button>
            )
          }

          const run = item.running
          const meta = [
            run.timeOfDay,
            `RPE ${run.rpeTarget.min}–${run.rpeTarget.max}`,
            run.rounds ? `${run.rounds} kör` : null,
          ]
            .filter(Boolean)
            .join(' · ')
          const runDone = Boolean(isRunLogged?.(run.key))
          return (
            <button key={run.key} type="button" className="s" onClick={isToday ? () => onLogRun?.(run) : undefined}>
              <span className="stag stag-run">FUTÁS</span>
              {isToday ? <b>{run.label}</b> : run.label}
              <span className="meta">{meta}</span>
              {(runDone || isToday) && (
                <span className={runDone ? 'done-chip' : cn('log-chip', 'stag-run')}>
                  {runDone ? 'kész' : 'log'}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <span className="chev" aria-hidden="true">›</span>
    </div>
  )
}
