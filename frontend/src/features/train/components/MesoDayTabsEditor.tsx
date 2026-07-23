// ============================================================
// Mezo · MesoDayTabsEditor — day-tabbed weekly exercise + recipe editor,
// shared by the planner wizard's Set & rep step and the builder's
// Gyakorlatok view. Fully controlled: receives the week's days plus
// add/remove/change/reorder callbacks; persistence stays in the parents
// (wizard = in-memory draft, builder = per-change full-list PUT).
// Off-days are detected by muscle ('' = rest, 'sport' = sport day), NOT by
// type — builder fixtures carry types like 'Volleyball · meccs'.
// ============================================================
import { useState } from 'react'
import type { GymExercise, MesoDay } from '@/data/types'
import { Icon } from '@/shared/ui/Icon'
import { SortableList } from '@/shared/ui/SortableList'
import { ExerciseRecipeRow } from '@/features/train/components/ExerciseRecipeRow'

export function isOffDay(d: Pick<MesoDay, 'muscle'>): boolean {
  return d.muscle === '' || d.muscle === 'sport'
}

interface MesoDayTabsEditorProps {
  days: MesoDay[]
  onAddClick: (dayKey: string) => void
  onRemove: (dayKey: string, exId: string) => void
  onChange: (dayKey: string, exId: string, patch: Partial<GymExercise>) => void
  onReorder: (dayKey: string, ids: string[]) => void
}

export function MesoDayTabsEditor({ days, onAddClick, onRemove, onChange, onReorder }: MesoDayTabsEditorProps) {
  const [activeDay, setActiveDay] = useState<string | null>(
    () => days.find((d) => d.current)?.day ?? days.find((d) => !isOffDay(d))?.day ?? days[0]?.day ?? null,
  )
  const day = days.find((d) => d.day === activeDay) ?? days[0]
  if (!day) return null
  const off = isOffDay(day)
  const setCount = day.exercises.reduce((a, e) => a + e.workingSets, 0)

  return (
    <div className="col gap-md">
      {/* Day tabs */}
      <div className="row gap-xs" style={{ overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 4 }}>
        {days.map((d) => {
          const active = d.day === day.day
          const dayOff = isOffDay(d)
          return (
            <button
              key={d.day}
              type="button"
              aria-pressed={active}
              aria-label={`${d.day} · ${d.type}`}
              onClick={() => setActiveDay(d.day)}
              className="rad-12"
              style={{
                flex: '1 0 auto',
                minWidth: 44,
                padding: '8px 10px',
                background: active ? 'color-mix(in srgb, var(--coral) 8%, transparent)' : 'var(--surface-1)',
                border: `1px solid ${active ? 'var(--line)' : 'var(--border-subtle)'}`,
                color: active ? 'var(--coral)' : dayOff ? 'var(--text-tertiary)' : 'var(--text-secondary)',
                opacity: dayOff && !active ? 0.6 : 1,
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              {d.day}
              {!dayOff && (
                <span style={{ marginLeft: 4, color: active ? 'var(--coral)' : 'var(--text-tertiary)' }}>
                  {d.exercises.length}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Active day header */}
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 14, color: 'var(--text-primary)' }}>{day.type}</span>
        {!off && (
          <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
            {day.exercises.length} gyakorlat · {setCount} szet
          </span>
        )}
      </div>

      {off ? (
        <div className="card row gap-sm" style={{ padding: 12, alignItems: 'center' }}>
          <Icon name="anchor" size={12} color="var(--text-tertiary)" />
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, flex: 1 }}>
            {day.note || 'Pihenőnap'}
          </span>
          {/* Edzéssé alakít — inert visual affordance, parity with the old day cards */}
          <button type="button" className="chip" style={{ fontSize: 9, padding: '4px 8px' }}>
            <Icon name="plus" size={10} /> Edzéssé alakít
          </button>
        </div>
      ) : (
        <>
          <SortableList
            items={day.exercises.map((e) => ({ ...e, label: e.name }))}
            onReorder={(ids) => onReorder(day.day, ids)}
            renderItem={(e) => (
              <ExerciseRecipeRow
                ex={e}
                onRemove={() => onRemove(day.day, e.id)}
                onChange={(patch) => onChange(day.day, e.id, patch)}
              />
            )}
          />
          <button
            type="button"
            onClick={() => onAddClick(day.day)}
            className="card"
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
        </>
      )}
    </div>
  )
}
