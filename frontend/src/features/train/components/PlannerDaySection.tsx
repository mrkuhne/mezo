// ============================================================
// Mezo · PlannerDaySection — one collapsible day card in the planner's
// program review (step 3). Header shows day-key, type, off-chip / summary;
// expanded training days list PlannerExerciseRows + a dashed "add exercise"
// affordance; expanded off-days show the rest note + "Edzéssé alakít".
// Ported from prototype meso-planner.jsx PlannerDaySection.
// ============================================================
import type { PlannerDay } from '../planner'
import { Icon } from '@/components/ui/Icon'
import { PlannerExerciseRow } from './PlannerExerciseRow'

interface PlannerDaySectionProps {
  day: PlannerDay
  expanded: boolean
  onToggle: () => void
  onRemove: (exId: string) => void
  onAdd: () => void
}

export function PlannerDaySection({ day, expanded, onToggle, onRemove, onAdd }: PlannerDaySectionProps) {
  const isTraining = (day.exerciseCount || 0) > 0
  const setCount = day.exercises.reduce((a, e) => a + e.sets, 0)

  return (
    <div
      className="card"
      style={{
        padding: 0,
        overflow: 'hidden',
        borderColor: 'var(--border-subtle)',
        background: 'var(--surface-1)',
        clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)',
      }}
    >
      <button
        type="button"
        aria-expanded={expanded}
        onClick={onToggle}
        style={{
          width: '100%',
          padding: '12px 14px',
          textAlign: 'left',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: 'transparent',
        }}
      >
        <span className="label-mono" style={{ fontSize: 10, color: 'var(--text-tertiary)', width: 36 }}>
          {day.day}
        </span>
        <div className="col flex-1">
          <div className="row gap-sm" style={{ alignItems: 'center' }}>
            <span style={{ fontSize: 14, color: 'var(--text-primary)' }}>{day.type}</span>
            {!isTraining && (
              <span className="chip" style={{ fontSize: 9, padding: '2px 6px', color: 'var(--text-tertiary)' }}>
                off
              </span>
            )}
          </div>
          {isTraining && (
            <span className="text-tertiary" style={{ fontSize: 10, marginTop: 2, fontFamily: 'var(--ff-mono)' }}>
              {day.exerciseCount} gyakorlat · {setCount} szet
            </span>
          )}
          {!isTraining && day.note && (
            <span className="text-tertiary" style={{ fontSize: 10, marginTop: 2 }}>
              {day.note}
            </span>
          )}
        </div>
        <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color="var(--text-tertiary)" />
      </button>

      {expanded && isTraining && (
        <div style={{ padding: '0 14px 14px' }}>
          <div style={{ height: 1, background: 'var(--border-subtle)', marginBottom: 10 }} />
          <div className="col gap-sm">
            {day.exercises.map((e) => (
              <PlannerExerciseRow key={e.id} ex={e} onRemove={() => onRemove(e.id)} />
            ))}
          </div>
          <button
            type="button"
            onClick={onAdd}
            className="card notch-4 mt-md"
            style={{
              padding: 10,
              width: '100%',
              background: 'transparent',
              borderStyle: 'dashed',
              borderColor: 'var(--border-brand)',
              color: 'var(--brand-glow)',
              fontFamily: 'var(--ff-mono)',
              fontSize: 10,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <Icon name="plus" size={12} /> Gyakorlat hozzáadása
          </button>
        </div>
      )}

      {expanded && !isTraining && (
        <div style={{ padding: '0 14px 14px' }}>
          <div style={{ height: 1, background: 'var(--border-subtle)', marginBottom: 10 }} />
          <div className="row gap-sm" style={{ alignItems: 'center' }}>
            <Icon name="anchor" size={12} color="var(--text-tertiary)" />
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, flex: 1 }}>
              {day.note || 'Pihenőnap'}
            </span>
            <button type="button" className="chip" style={{ fontSize: 9, padding: '4px 8px' }}>
              <Icon name="plus" size={10} /> Edzéssé alakít
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
