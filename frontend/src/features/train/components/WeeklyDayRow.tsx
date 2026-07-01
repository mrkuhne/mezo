// ============================================================
// Mezo · WeeklyDayRow — one day in the combined gym + volleyball
// weekly timeline (Mai view). Ported from prototype train-views.jsx.
// ============================================================
import { Icon } from '@/components/ui/Icon'
import type { GymScheduleDay, VolleyballSession } from '@/data/types'
import type { RunPrescribedSession } from '@/lib/runningApi'
import { daySessions } from '@/features/train/agenda'

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
  const dayLabelColor = isToday
    ? 'var(--brand-glow)'
    : hasContent
      ? 'var(--text-secondary)'
      : 'var(--text-tertiary)'

  return (
    <div
      className="card"
      style={{
        padding: 0,
        borderColor: isToday ? 'var(--border-brand)' : 'var(--border-subtle)',
        borderStyle: hasContent ? 'solid' : 'dashed',
        background: isToday
          ? 'rgba(94, 234, 212, 0.04)'
          : hasContent
            ? 'var(--surface-1)'
            : 'transparent',
        clipPath: 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)',
      }}
    >
      <div className="row" style={{ alignItems: 'stretch', gap: 0 }}>
        {/* Day label */}
        <div
          style={{
            width: 56,
            padding: '12px 0',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            borderRight: hasContent ? '1px solid var(--border-subtle)' : 'none',
            background: isToday ? 'rgba(94, 234, 212, 0.06)' : 'transparent',
          }}
        >
          <span className="label-mono" style={{ fontSize: 10, color: dayLabelColor, letterSpacing: '0.1em' }}>
            {day}
          </span>
          {isToday && <span className="label-mono brand mt-xs" style={{ fontSize: 8 }}>MA</span>}
        </div>

        {/* Sessions */}
        <div className="col flex-1" style={{ minWidth: 0, padding: hasContent ? 0 : '12px 14px' }}>
          {!hasContent && (
            <span className="text-tertiary" style={{ fontSize: 11, fontStyle: 'italic' }}>
              rest day
            </span>
          )}

          {sessions.map((item, idx, arr) => {
            const notLast = idx < arr.length - 1
            const rowStyle = {
              padding: '10px 14px',
              alignItems: 'center',
              gap: 10,
              width: '100%',
              textAlign: 'left',
              borderBottom: notLast ? '1px solid var(--border-subtle)' : 'none',
              cursor: isToday ? 'pointer' : 'default',
            } as const

            if (item.kind === 'gym') {
              const gym = item.gym
              return (
                <button
                  key="gym"
                  type="button"
                  onClick={isToday ? onStartGym : undefined}
                  className="row"
                  style={rowStyle}
                >
                  <Icon name="train" size={13} color="var(--brand-glow)" />
                  <div className="col flex-1">
                    <div className="row gap-xs" style={{ alignItems: 'center' }}>
                      <span style={{ fontSize: 12.5, color: 'var(--text-primary)', fontWeight: 500 }}>{gym.type}</span>
                      {gym.time && (
                        <span className="label-mono text-tertiary" style={{ fontSize: 9 }}>· {gym.time}</span>
                      )}
                    </div>
                    <span className="label-mono text-tertiary mt-xs" style={{ fontSize: 9 }}>
                      {gym.duration ? `${gym.duration}p · gym` : 'gym'}
                    </span>
                  </div>
                  {gymLogged ? (
                    <span
                      className="chip"
                      style={{
                        fontSize: 8, padding: '2px 5px',
                        color: 'var(--success)',
                        borderColor: 'color-mix(in srgb, var(--success) 40%, transparent)',
                      }}
                    >
                      kész
                    </span>
                  ) : isToday ? (
                    <Icon name="chevron-right" size={11} color="var(--brand-glow)" />
                  ) : null}
                </button>
              )
            }

            if (item.kind === 'volleyball') {
              const volleyball = item.volleyball
              return (
                <button
                  key="volleyball"
                  type="button"
                  onClick={isToday ? onLogVolleyball : undefined}
                  className="row"
                  style={rowStyle}
                >
                  <Icon name="today" size={13} color="var(--cat-tendency)" />
                  <div className="col flex-1">
                    <div className="row gap-xs" style={{ alignItems: 'center' }}>
                      <span style={{ fontSize: 12.5, color: 'var(--text-primary)', fontWeight: 500 }}>Volleyball</span>
                      <span className="label-mono text-tertiary" style={{ fontSize: 9 }}>· {volleyball.time}</span>
                    </div>
                    <span className="label-mono text-tertiary mt-xs" style={{ fontSize: 9 }}>
                      {[`${volleyball.duration}p`, volleyball.role, volleyball.intensity].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                  {(vbLogged || isToday) && (
                    <span
                      className="chip"
                      style={{
                        fontSize: 8, padding: '2px 5px',
                        color: vbLogged ? 'var(--success)' : 'var(--cat-tendency)',
                        borderColor: `color-mix(in srgb, ${vbLogged ? 'var(--success)' : 'var(--cat-tendency)'} 40%, transparent)`,
                      }}
                    >
                      {vbLogged ? 'kész' : 'log'}
                    </span>
                  )}
                </button>
              )
            }

            const run = item.running
            return (
              <button
                key={run.key}
                type="button"
                onClick={isToday ? () => onLogRun?.(run) : undefined}
                className="row"
                style={rowStyle}
              >
                <Icon name="voice-wave" size={13} color="var(--info)" />
                <div className="col flex-1">
                  <div className="row gap-xs" style={{ alignItems: 'center' }}>
                    <span style={{ fontSize: 12.5, color: 'var(--text-primary)', fontWeight: 500 }}>{run.label}</span>
                    {run.timeOfDay && (
                      <span className="label-mono text-tertiary" style={{ fontSize: 9 }}>· {run.timeOfDay}</span>
                    )}
                  </div>
                  <span className="label-mono text-tertiary mt-xs" style={{ fontSize: 9 }}>
                    {`${run.kind === 'sprint' ? 'Sprint' : 'Piramis'} · futás`}
                  </span>
                </div>
                {(isRunLogged?.(run.key) || isToday) && (
                  <span
                    className="chip"
                    style={{
                      fontSize: 8, padding: '2px 5px',
                      color: isRunLogged?.(run.key) ? 'var(--success)' : 'var(--info)',
                      borderColor: `color-mix(in srgb, ${isRunLogged?.(run.key) ? 'var(--success)' : 'var(--info)'} 40%, transparent)`,
                    }}
                  >
                    {isRunLogged?.(run.key) ? 'kész' : 'log'}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
