// ============================================================
// Mezo · PlannerDaySection — one collapsible day card in the planner's
// program review (step 3). Header shows day-key, type, off-chip / summary;
// expanded training days list PlannerExerciseRows + a dashed "add exercise"
// affordance; expanded off-days show the rest note + "Edzéssé alakít".
// Ported from prototype meso-planner.jsx PlannerDaySection.
// ============================================================
import type { PlannerDay } from '@/features/train/logic/planner'
import { Icon } from '@/shared/ui/Icon'
import { SortableList } from '@/shared/ui/SortableList'
import { PlannerExerciseRow } from '@/features/train/components/PlannerExerciseRow'

interface PlannerDaySectionProps {
  day: PlannerDay
  expanded: boolean
  onToggle: () => void
  onRemove: (exId: string) => void
  onReorder: (ids: string[]) => void
  onAdd: () => void
  /** Renames the day (custom splits start empty and user-named — mezo-9wv). */
  onRename?: (name: string) => void
}

export function PlannerDaySection({ day, expanded, onToggle, onRemove, onReorder, onAdd, onRename }: PlannerDaySectionProps) {
  // Type-based: an empty (not yet filled) training day is still a training day,
  // it must keep the add-exercise affordance instead of rendering as "off".
  const isTraining = day.type !== 'Rest' && day.type !== 'Volleyball'
  const setCount = day.exercises.reduce((a, e) => a + e.workingSets, 0)

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
              {day.exercises.length > 0
                ? `${day.exercises.length} gyakorlat · ${setCount} szet`
                : 'Üres nap · adj hozzá gyakorlatot'}
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
          {onRename && (
            <div className="card row" style={{ padding: '8px 10px', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span className="label-mono text-tertiary" style={{ fontSize: 9, flexShrink: 0 }}>Nap neve</span>
              <input
                aria-label="Nap neve"
                value={day.type}
                onChange={(e) => onRename(e.target.value)}
                style={{ flex: 1, fontSize: 13, padding: '2px 0' }}
              />
            </div>
          )}
          <SortableList
            items={day.exercises.map((e) => ({ ...e, label: e.name }))}
            onReorder={onReorder}
            renderItem={(e) => <PlannerExerciseRow ex={e} onRemove={() => onRemove(e.id)} />}
          />
          <button
            type="button"
            onClick={onAdd}
            className="card mt-md"
            style={{
              padding: 10,
              width: '100%',
              background: 'transparent',
              borderStyle: 'dashed',
              borderColor: 'var(--line)',
              color: 'var(--coral)',
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
