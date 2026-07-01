// ============================================================
// Mezo · GymDayCard — one day row in the GymView weekly split.
// Training days are tappable (open the GymDaySheet); rest days
// (exerciseCount === 0) render dashed + italic with their note and
// are not interactive. Today's card ("current") is brand-accented.
// Ported from prototype train-views.jsx GymDayCard.
// ============================================================
import { Icon } from '@/shared/ui/Icon'
import type { MesoDay } from '@/data/types'

interface GymDayCardProps {
  day: MesoDay
  onOpen: () => void
}

export function GymDayCard({ day, onOpen }: GymDayCardProps) {
  const isRest = day.exerciseCount === 0
  const isToday = Boolean(day.current)
  const setsCount = day.exercises.reduce((acc, e) => acc + e.sets, 0)
  const compoundCount = day.exercises.filter((e) => e.type === 'compound').length

  return (
    <button
      type="button"
      onClick={isRest ? undefined : onOpen}
      aria-label={`${day.type} · ${day.day}`}
      className="card"
      style={{
        padding: 0,
        textAlign: 'left',
        width: '100%',
        borderColor: isToday ? 'var(--border-brand)' : 'var(--border-subtle)',
        background: isToday
          ? 'color-mix(in srgb, var(--brand-glow) 4%, transparent)'
          : isRest
            ? 'transparent'
            : 'var(--surface-1)',
        borderStyle: isRest ? 'dashed' : 'solid',
        clipPath: 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)',
        cursor: isRest ? 'default' : 'pointer',
      }}
    >
      <div className="row" style={{ padding: '12px 14px', alignItems: 'center', gap: 12 }}>
        <div className="col" style={{ width: 40 }}>
          <span
            className="label-mono"
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: isToday ? 'var(--brand-glow)' : isRest ? 'var(--text-tertiary)' : 'var(--text-secondary)',
            }}
          >
            {day.day}
          </span>
          {isToday && <span className="label-mono brand mt-xs" style={{ fontSize: 8 }}>MA</span>}
        </div>

        <div className="col flex-1" style={{ minWidth: 0 }}>
          <div className="row gap-xs" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <span
              style={{
                fontFamily: 'var(--ff-display)',
                fontSize: 15,
                fontWeight: 600,
                color: isRest ? 'var(--text-tertiary)' : 'var(--text-primary)',
              }}
            >
              {day.type}
            </span>
            {day.muscleAccent && <span className="chip brand" style={{ fontSize: 8, padding: '1px 5px' }}>focus</span>}
          </div>
          {!isRest && (
            <div className="row gap-md mt-xs" style={{ fontFamily: 'var(--ff-mono)', fontSize: 10 }}>
              <span style={{ color: 'var(--text-tertiary)' }}>{day.exerciseCount} gyakorlat</span>
              <span style={{ color: 'var(--text-tertiary)' }}>· {setsCount} szet</span>
              {compoundCount > 0 && <span style={{ color: 'var(--text-tertiary)' }}>· {compoundCount} compound</span>}
            </div>
          )}
          {isRest && day.note && (
            <span className="text-tertiary mt-xs" style={{ fontSize: 10, fontStyle: 'italic' }}>{day.note}</span>
          )}
        </div>

        {!isRest && (
          <Icon name="chevron-right" size={12} color={isToday ? 'var(--brand-glow)' : 'var(--text-tertiary)'} />
        )}
      </div>
    </button>
  )
}
