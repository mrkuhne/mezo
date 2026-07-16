// ============================================================
// Mezo · DayExerciseSection — one collapsible day card in the builder
// Gyakorlatok view. Header (day abbrev · type · MA/off chip · count·szet
// meta · expand chevron). Training days expand to a list of ExerciseEditRow
// plus a dashed "+ Gyakorlat hozzáadása" CTA; off-days expand to the rest
// note + an (inert) "Edzéssé alakít" chip.
// Ported from prototype mesocycles.jsx DayExerciseSection.
// ============================================================
import type { GymExercise, MesoDay } from '@/data/types'
import { Icon } from '@/shared/ui/Icon'
import { SortableList } from '@/shared/ui/SortableList'
import { ExerciseEditRow } from '@/features/train/components/ExerciseEditRow'

interface DayExerciseSectionProps {
  day: MesoDay
  expanded: boolean
  onToggle: () => void
  onAdd: () => void
  onRemoveExercise: (exId: string) => void
  onChangeExercise: (exId: string, patch: Partial<GymExercise>) => void
  onReorderExercises: (ids: string[]) => void
}

export function DayExerciseSection({ day, expanded, onToggle, onAdd, onRemoveExercise, onChangeExercise, onReorderExercises }: DayExerciseSectionProps) {
  const exercises = day.exercises ?? []
  const isTraining = exercises.length > 0
  const totalSets = exercises.reduce((a, e) => a + e.workingSets, 0)

  return (
    <div
      className="card"
      style={{
        padding: 0,
        overflow: 'hidden',
        borderColor: day.current ? 'var(--line)' : 'var(--border-subtle)',
        background: day.current ? 'color-mix(in srgb, var(--coral) 4%, transparent)' : 'var(--surface-1)',
        position: 'relative',
        clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)',
      }}
    >
      {day.current && (
        <div
          aria-hidden="true"
          style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, background: 'var(--coral)', zIndex: 1 }}
        />
      )}

      {/* Day header — clickable toggle */}
      <button
        onClick={onToggle}
        aria-expanded={expanded}
        style={{
          width: '100%',
          padding: '12px 14px',
          textAlign: 'left',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: 'transparent',
          paddingLeft: day.current ? 16 : 14,
        }}
      >
        <div className="col" style={{ width: 36, alignItems: 'flex-start' }}>
          <span
            className="label-mono"
            style={{ fontSize: 10, color: day.current ? 'var(--coral)' : 'var(--text-tertiary)' }}
          >
            {day.day}
          </span>
        </div>
        <div className="col flex-1" style={{ minWidth: 0 }}>
          <div className="row gap-sm" style={{ alignItems: 'center' }}>
            <span style={{ fontSize: 14, color: 'var(--text-primary)' }}>{day.type}</span>
            {day.current && (
              <span className="chip brand" style={{ fontSize: 9, padding: '2px 6px' }}>
                MA
              </span>
            )}
            {!isTraining && (
              <span className="chip" style={{ fontSize: 9, padding: '2px 6px', color: 'var(--text-tertiary)' }}>
                off
              </span>
            )}
          </div>
          {isTraining && (
            <span className="text-tertiary" style={{ fontSize: 10, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
              {exercises.length} gyakorlat · {totalSets} szet
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

      {/* Expanded — training day */}
      {expanded && isTraining && (
        <div style={{ padding: '0 14px 14px', paddingLeft: day.current ? 16 : 14 }}>
          <div style={{ height: 1, background: 'var(--border-subtle)', marginBottom: 12 }} />
          <SortableList
            items={exercises.map((e) => ({ ...e, label: e.name }))}
            onReorder={onReorderExercises}
            renderItem={(e) => (
              <ExerciseEditRow
                ex={e}
                onRemove={() => onRemoveExercise(e.id)}
                onChange={(patch) => onChangeExercise(e.id, patch)}
              />
            )}
          />

          {/* Add-exercise CTA */}
          <button
            onClick={onAdd}
            className="card mt-md"
            style={{
              padding: 12,
              width: '100%',
              background: 'transparent',
              borderStyle: 'dashed',
              borderColor: 'var(--line)',
              color: 'var(--coral)',
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

      {/* Expanded — off day */}
      {expanded && !isTraining && (
        <div style={{ padding: '0 14px 14px' }}>
          <div style={{ height: 1, background: 'var(--border-subtle)', marginBottom: 12 }} />
          <div className="row gap-sm" style={{ alignItems: 'center' }}>
            <Icon name="anchor" size={12} color="var(--text-tertiary)" />
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, flex: 1 }}>
              {day.note || 'Pihenőnap'}
            </span>
            {/* Edzéssé alakít — inert in Phase 1 (visual affordance only) */}
            <button className="chip" style={{ fontSize: 9, padding: '4px 8px' }}>
              <Icon name="plus" size={10} /> Edzéssé alakít
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
