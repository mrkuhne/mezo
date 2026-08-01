// ============================================================
// Mezo · MesoEditor — unified day-tabbed meso day editor (mezo-7rdg, spec
// 2026-08-01-set-budget-unified-editor). Drop-in replacement for
// MesoDayTabsEditor that composes MesoEditorHero + SetBudgetCard +
// ExerciseAccordionRow: same day-tab strip / active-day seeding / off-day
// card / add-button (ported from MesoDayTabsEditor.tsx), plus a red
// session-cap warning dot per tab, single-expand accordion rows with
// auto-expand-on-add, and optional inline day-rename for custom splits
// (capability parity with PlannerDaySection's onRename).
//
// Hero warningCount scoping: overBudgets is a WEEKLY metric (muscleBudgets
// sums across all days) so it stays global — a muscle over its weekly cap
// matters regardless of which day tab is open. Session-cap breaches
// (sessionCapWarnings) are inherently per-day, and the hero's other numbers
// (dayType/daySets/dayExerciseCount) already describe "the day you're
// looking at" — so the hero's badge counts only the ACTIVE day's cap
// breaches, while SetBudgetCard (the week-wide budget panel) still lists
// every day's breaches via the unfiltered capWarnings array.
// ============================================================
import { useEffect, useRef, useState } from 'react'
import type { GymExercise, MesoDay } from '@/data/types'
import { Icon } from '@/shared/ui/Icon'
import { SortableList } from '@/shared/ui/SortableList'
import { ExerciseAccordionRow } from '@/features/train/components/ExerciseAccordionRow'
import { MesoEditorHero } from '@/features/train/components/MesoEditorHero'
import { SetBudgetCard } from '@/features/train/components/SetBudgetCard'
import { muscleBudgets, sessionCapWarnings } from '@/features/train/logic/setBudget'
import { isOffDay } from '@/features/train/logic/offDay'

interface MesoEditorProps {
  days: MesoDay[]
  onAddClick: (dayKey: string) => void
  onRemove: (dayKey: string, exId: string) => void
  onChange: (dayKey: string, exId: string, patch: Partial<GymExercise>) => void
  onReorder: (dayKey: string, ids: string[]) => void
  /** Renames the active day (custom splits, capability parity with PlannerDaySection). */
  onRenameDay?: (dayKey: string, name: string) => void
}

export function MesoEditor({ days, onAddClick, onRemove, onChange, onReorder, onRenameDay }: MesoEditorProps) {
  const [activeDay, setActiveDay] = useState<string | null>(
    () => days.find((d) => d.current)?.day ?? days.find((d) => !isOffDay(d))?.day ?? days[0]?.day ?? null,
  )
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const knownIds = useRef<Set<string>>(new Set())

  const day = days.find((d) => d.day === activeDay) ?? days[0]

  const budgets = muscleBudgets(days)
  const capWarnings = sessionCapWarnings(days)
  const warningDays = new Set(capWarnings.map((w) => w.day))
  const overBudgets = budgets.filter((b) => b.level === 'over')
  const activeDayCapWarnings = day ? capWarnings.filter((w) => w.day === day.day) : []
  const warningCount = overBudgets.length + activeDayCapWarnings.length

  // Auto-expand: track known exercise ids across renders; when the active day
  // gains an id we haven't seen before (a freshly added exercise), expand it.
  useEffect(() => {
    if (!day) return
    const seen = knownIds.current
    let newId: string | null = null
    for (const e of day.exercises) {
      if (!seen.has(e.id)) newId = e.id
      seen.add(e.id)
    }
    if (newId) setExpandedId(newId)
  }, [day])

  if (!day) return null

  const off = isOffDay(day)
  const daySets = day.exercises.reduce((a, e) => a + e.workingSets, 0)
  const weekSets = days.reduce((a, d) => a + d.exercises.reduce((s, e) => s + e.workingSets, 0), 0)
  const trainingDays = days.filter((d) => d.exercises.length > 0).length
  const showRename = Boolean(onRenameDay) && day.muscle === 'custom'

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
                position: 'relative',
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
              {warningDays.has(d.day) && (
                <span
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: 'var(--error)',
                  }}
                />
              )}
            </button>
          )
        })}
      </div>

      {showRename && (
        <input
          aria-label={`${day.day} nap átnevezése`}
          value={day.type}
          onChange={(e) => onRenameDay?.(day.day, e.target.value)}
          className="card"
          style={{ padding: '8px 10px', fontSize: 14, width: '100%' }}
        />
      )}

      <MesoEditorHero
        dayType={showRename ? 'Egyéni nap' : day.type}
        daySets={daySets}
        dayExerciseCount={day.exercises.length}
        weekSets={weekSets}
        trainingDays={trainingDays}
        warningCount={warningCount}
      />

      <SetBudgetCard budgets={budgets} capWarnings={capWarnings} defaultOpen={warningCount > 0} />

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
            // Intentionally NOT spreading `label: e.name` (unlike MesoDayTabsEditor's
            // ExerciseRecipeRow usage): SortableList's reorder buttons ("<label>
            // áthelyezése/feljebb/lejjebb") would otherwise share the "Gyak a"-style
            // prefix with ExerciseAccordionRow's own name-based toggle aria-label,
            // making the two ambiguous for name-substring queries. Omitting it lets
            // SortableList fall back to the exercise id, which stays unique.
            items={day.exercises}
            onReorder={(ids) => onReorder(day.day, ids)}
            renderItem={(e) => (
              <ExerciseAccordionRow
                ex={e}
                expanded={expandedId === e.id}
                onToggle={() => setExpandedId((cur) => (cur === e.id ? null : e.id))}
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
