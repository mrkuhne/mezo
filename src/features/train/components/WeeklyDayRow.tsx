// ============================================================
// Mezo · WeeklyDayRow — one day in the combined gym + volleyball
// weekly timeline (Mai view). Ported from prototype train-views.jsx.
// ============================================================
import { Icon } from '@/components/ui/Icon'
import type { GymScheduleDay, VolleyballSession } from '@/data/types'

export interface WeeklyAgendaDay {
  day: string
  gym: GymScheduleDay | null
  volleyball: VolleyballSession | null
  isToday: boolean
}

interface WeeklyDayRowProps {
  agenda: WeeklyAgendaDay
  onStartGym: () => void
  onLogVolleyball: () => void
}

export function WeeklyDayRow({ agenda, onStartGym, onLogVolleyball }: WeeklyDayRowProps) {
  const { day, gym, volleyball, isToday } = agenda
  const hasContent = Boolean(gym || volleyball)
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

          {gym && (
            <button
              type="button"
              onClick={isToday ? onStartGym : undefined}
              className="row"
              style={{
                padding: '10px 14px',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                textAlign: 'left',
                borderBottom: volleyball ? '1px solid var(--border-subtle)' : 'none',
                cursor: isToday ? 'pointer' : 'default',
              }}
            >
              <Icon name="train" size={13} color="var(--brand-glow)" />
              <div className="col flex-1">
                <div className="row gap-xs" style={{ alignItems: 'center' }}>
                  <span style={{ fontSize: 12.5, color: 'var(--text-primary)', fontWeight: 500 }}>{gym.type}</span>
                  <span className="label-mono text-tertiary" style={{ fontSize: 9 }}>· {gym.time}</span>
                </div>
                <span className="label-mono text-tertiary mt-xs" style={{ fontSize: 9 }}>{gym.duration}p · gym</span>
              </div>
              {isToday && <Icon name="chevron-right" size={11} color="var(--brand-glow)" />}
            </button>
          )}

          {volleyball && (
            <button
              type="button"
              onClick={isToday ? onLogVolleyball : undefined}
              className="row"
              style={{
                padding: '10px 14px',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                textAlign: 'left',
                cursor: isToday ? 'pointer' : 'default',
              }}
            >
              <Icon name="today" size={13} color="var(--cat-tendency)" />
              <div className="col flex-1">
                <div className="row gap-xs" style={{ alignItems: 'center' }}>
                  <span style={{ fontSize: 12.5, color: 'var(--text-primary)', fontWeight: 500 }}>Volleyball</span>
                  <span className="label-mono text-tertiary" style={{ fontSize: 9 }}>· {volleyball.time}</span>
                </div>
                <span className="label-mono text-tertiary mt-xs" style={{ fontSize: 9 }}>
                  {volleyball.duration}p · {volleyball.role} · {volleyball.intensity}
                </span>
              </div>
              {isToday && (
                <span
                  className="chip"
                  style={{ fontSize: 8, padding: '2px 5px', color: 'var(--cat-tendency)', borderColor: 'color-mix(in srgb, var(--cat-tendency) 40%, transparent)' }}
                >
                  log
                </span>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
