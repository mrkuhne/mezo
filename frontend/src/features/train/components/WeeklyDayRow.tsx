// ============================================================
// Mezo · WeeklyDayRow — one day in the combined gym + sport
// weekly timeline (Mai view). Napiv `.dayrow` day card (spec §4.3).
// ============================================================
import { cn } from '@/shared/lib/cn'
import type { GymScheduleDay, VolleyballSession } from '@/data/types'
import type { RunPrescribedSession } from '@/data/train/runningApi'
import { daySessions } from '@/features/train/logic/agenda'
import { sportOf, SPORT_TAGS, SPORT_TITLES } from '@/features/train/logic/sportKinds'

export interface WeeklyAgendaDay {
  day: string
  /** ISO date of this row's day in the current week — used by the parent to derive done-state. */
  date?: string
  gym: GymScheduleDay | null
  /** This day's recurring sport slots (volleyball/cross/trx) — a day can hold several. */
  sport: VolleyballSession[]
  running: RunPrescribedSession[]
  isToday: boolean
  /** Completed custom (saját) workout instances on this date — extra done rows (mezo-ws2x). */
  custom?: { id: string; title: string }[]
}

interface WeeklyDayRowProps {
  agenda: WeeklyAgendaDay
  /** This day's gym workout has a logged set ⇒ show the done chip (today or a past day). */
  gymLogged?: boolean
  /** This slot's sport has a logged session on this date ⇒ show the done chip. */
  isSportLogged?: (s: VolleyballSession) => boolean
  /** This day's prescribed run (by key) has a logged session ⇒ show the done chip. */
  isRunLogged?: (key: string) => boolean
  /** Today's gym instance is open (started, unfinished) — shows the folyamatban chip. */
  gymInProgress?: boolean
  onStartGym: () => void
  /** A completed (non-today or today) gym day was tapped — open its review. */
  onReviewGym?: () => void
  /** A non-today, not-done gym day was tapped — open its GymDaySheet (cross-day start, mezo-j3x0). */
  onOpenGymDay?: () => void
  onLogSport?: (s: VolleyballSession) => void
  onLogRun?: (s: RunPrescribedSession) => void
  /** A completed custom (saját) workout row was tapped — open its review. */
  onReviewCustom?: (id: string) => void
}

export function WeeklyDayRow({ agenda, gymLogged, isSportLogged, isRunLogged, gymInProgress, onStartGym, onReviewGym, onOpenGymDay, onLogSport, onLogRun, onReviewCustom }: WeeklyDayRowProps) {
  const { day, isToday } = agenda
  // Time-ordered flat session list — gym/volleyball/running interleave by
  // time-of-day so a morning run renders above an evening gym (untimed last).
  const sessions = daySessions(agenda)
  const customItems = agenda.custom ?? []
  const hasContent = sessions.length > 0 || customItems.length > 0

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

        {sessions.map((item, i) => {
          if (item.kind === 'gym') {
            const gym = item.gym
            // `type` doubles as the row title below (no separate workout-name field on
            // GymScheduleDay) — repeating it here disambiguates same-time/duration gym
            // days from each other AND from the TrainTodayPage hero's own `time · Xp` line.
            const meta = [gym.time, gym.duration ? `${gym.duration}p` : null, gym.type].filter(Boolean).join(' · ')
            // A completed (kész) gym day — today OR a past day — opens its review;
            // today's not-yet-logged row starts the session; any other day opens
            // its GymDaySheet via onOpenGymDay (cross-day start, mezo-j3x0).
            return (
              <button key="gym" type="button" className="s" onClick={gymLogged ? onReviewGym : isToday ? onStartGym : onOpenGymDay}>
                <span className="stag stag-gym">GYM</span>
                {isToday ? <b>{gym.type}</b> : gym.type}
                <span className="meta">{meta}</span>
                {gymLogged && <span className="done-chip">kész</span>}
                {!gymLogged && gymInProgress && isToday && <span className="log-chip stag-gym">folyamatban</span>}
              </button>
            )
          }

          if (item.kind === 'sport') {
            const s = item.sport
            const k = sportOf(s)
            const logged = Boolean(isSportLogged?.(s))
            const meta = [s.time, `${s.duration}p`, s.role, s.intensity].filter(Boolean).join(' · ')
            return (
              <button key={`sport-${k}-${s.time}-${i}`} type="button" className="s" onClick={isToday ? () => onLogSport?.(s) : undefined}>
                <span className="stag stag-sport">{SPORT_TAGS[k]}</span>
                {isToday ? <b>{SPORT_TITLES[k]}</b> : SPORT_TITLES[k]}
                <span className="meta">{meta}</span>
                {(logged || isToday) && (
                  <span className={logged ? 'done-chip' : cn('log-chip', 'stag-sport')}>
                    {logged ? 'kész' : 'log'}
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

        {customItems.map((c) => (
          <button
            key={c.id}
            type="button"
            className="s"
            onClick={onReviewCustom ? () => onReviewCustom(c.id) : undefined}
          >
            <span className="stag stag-gym">SAJÁT</span>
            {c.title}
            <span className="done-chip">kész</span>
          </button>
        ))}
      </div>

      {hasContent && <span className="chev" aria-hidden="true">›</span>}
    </div>
  )
}
