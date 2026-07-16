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
import { MUSCLE_LABELS } from '@/data/train/train'
import type { GymExercise, MesoDay } from '@/data/types'
import { Icon } from '@/shared/ui/Icon'
import { SortableList } from '@/shared/ui/SortableList'

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
              className="notch-4"
              style={{
                flex: '1 0 auto',
                minWidth: 44,
                padding: '8px 10px',
                background: active ? 'color-mix(in srgb, var(--brand-glow) 8%, transparent)' : 'var(--surface-1)',
                border: `1px solid ${active ? 'var(--border-brand)' : 'var(--border-subtle)'}`,
                color: active ? 'var(--brand-glow)' : dayOff ? 'var(--text-tertiary)' : 'var(--text-secondary)',
                opacity: dayOff && !active ? 0.6 : 1,
                fontFamily: 'var(--ff-mono)',
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              {d.day}
              {!dayOff && (
                <span style={{ marginLeft: 4, color: active ? 'var(--brand-glow)' : 'var(--text-tertiary)' }}>
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
        <div className="card notch-4 row gap-sm" style={{ padding: 12, alignItems: 'center' }}>
          <Icon name="anchor" size={12} color="var(--text-tertiary)" />
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, flex: 1 }}>
            {day.note || 'Pihenőnap'}
          </span>
          {/* Edzéssé alakít — inert visual affordance, parity with the old day cards */}
          <button type="button" className="chip notch-4" style={{ fontSize: 9, padding: '4px 8px' }}>
            <Icon name="plus" size={10} /> Edzéssé alakít
          </button>
        </div>
      ) : (
        <>
          <SortableList
            items={day.exercises.map((e) => ({ ...e, label: e.name }))}
            onReorder={(ids) => onReorder(day.day, ids)}
            renderItem={(e) => (
              <RecipeRow
                ex={e}
                onRemove={() => onRemove(day.day, e.id)}
                onChange={(patch) => onChange(day.day, e.id, patch)}
              />
            )}
          />
          <button
            type="button"
            onClick={() => onAddClick(day.day)}
            className="card notch-4"
            style={{
              padding: 12,
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
        </>
      )}
    </div>
  )
}

// One exercise line: header (name + muscle) + remove ✕, with the six recipe
// steppers ALWAYS visible below (no expand/collapse, no summary line). Stepper
// aria-labels are name-scoped (`${ex.name} · <field> növelése`) so they stay
// unique across the always-open rows.
function RecipeRow({ ex, onRemove, onChange }: {
  ex: GymExercise
  onRemove: () => void
  onChange: (patch: Partial<GymExercise>) => void
}) {
  return (
    <div className="card notch-4" style={{ padding: '10px 12px', background: 'var(--surface-2)' }}>
      <div className="row gap-sm" style={{ alignItems: 'flex-start' }}>
        <div className="col flex-1" style={{ minWidth: 0 }}>
          <span style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.3 }}>{ex.name}</span>
          <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 2 }}>
            {MUSCLE_LABELS[ex.muscle] ?? ex.muscle}
          </span>
          {ex.warning && (
            <div className="row gap-xs mt-xs" style={{ alignItems: 'center' }}>
              <Icon name="warning" size={10} color="var(--warning)" />
              <span style={{ fontSize: 10, color: 'var(--warning)', lineHeight: 1.4 }}>{ex.warning}</span>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`${ex.name} törlése`}
          className="chip notch-4"
          style={{ padding: '5px 7px', flexShrink: 0 }}
        >
          <Icon name="x" size={10} />
        </button>
      </div>

      <div className="row gap-xs flex-wrap" style={{ marginTop: 8 }}>
        <RecipeStepper label="Bem" aria={`${ex.name} · Bemelegítő`} value={ex.warmupSets} min={0} max={10}
          onChange={(v) => onChange({ warmupSets: v })} />
        <RecipeStepper label="Work" aria={`${ex.name} · Working`} value={ex.workingSets} min={1} max={10}
          onChange={(v) => onChange({ workingSets: v })} />
        <RecipeStepper label="Rep min" aria={`${ex.name} · Rep min`} value={ex.repMin} min={1} max={ex.repMax}
          onChange={(v) => onChange({ repMin: v })} />
        <RecipeStepper label="Rep max" aria={`${ex.name} · Rep max`} value={ex.repMax} min={ex.repMin} max={100}
          onChange={(v) => onChange({ repMax: v })} />
        <RecipeStepper label="RIR" aria={`${ex.name} · RIR`} value={ex.targetRIR} min={0} max={5}
          onChange={(v) => onChange({ targetRIR: v })} />
        <AnchorStepper aria={`${ex.name} · Kiinduló súly`} value={ex.anchorWeightKg}
          onChange={(v) => onChange({ anchorWeightKg: v })} />
      </div>
    </div>
  )
}

// A compact labelled −/value/+ tile wired to onChange. `label` is the short
// display caption; `aria` is the name-scoped base (`${ex.name} · <field>`) so the
// −/+ buttons get unique labels across the always-open rows.
// Clamps to [min, max] so the parent never receives an out-of-range recipe value.
function RecipeStepper({ label, aria, value, min, max, onChange }: {
  label: string; aria: string; value: number; min: number; max: number; onChange: (v: number) => void
}) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n))
  return (
    <div style={{ flex: '1 1 30%', minWidth: 68, background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', padding: '4px 8px' }}>
      <span className="label-mono" style={{ fontSize: 7, color: 'var(--text-tertiary)' }}>{label}</span>
      <div className="row" style={{ justifyContent: 'space-between', marginTop: 3 }}>
        <span style={{ fontFamily: 'var(--ff-display)', fontSize: 13, fontWeight: 600 }}>{value}</span>
        <div className="row gap-xs">
          <button type="button" aria-label={`${aria} csökkentése`} onClick={() => onChange(clamp(value - 1))}
            style={{ width: 18, height: 18, background: 'var(--surface-2)', border: '1px solid var(--border-strong)', color: 'var(--brand-glow)' }}>−</button>
          <button type="button" aria-label={`${aria} növelése`} onClick={() => onChange(clamp(value + 1))}
            style={{ width: 18, height: 18, background: 'var(--surface-2)', border: '1px solid var(--border-strong)', color: 'var(--brand-glow)' }}>+</button>
        </div>
      </div>
    </div>
  )
}

// The optional STARTING weight (anchor) — nullable, 2.5 kg steps, "auto" when unset.
// The recommendation engine uses it as the first-workout base (SetRecommendationService),
// so it seeds the pre-filled weight before any history exists. Decrementing below one
// step returns to "auto" (let the engine decide); "+" from auto starts at a sensible 20 kg.
function AnchorStepper({ aria, value, onChange }: {
  aria: string; value: number | null | undefined; onChange: (v: number | null) => void
}) {
  const STEP = 2.5
  const START = 20
  const round = (n: number) => Math.round(n * 100) / 100
  const isAuto = value == null
  const dec = () => {
    if (isAuto) return
    const next = round(value - STEP)
    onChange(next < STEP ? null : next)
  }
  const inc = () => onChange(isAuto ? START : Math.min(999, round(value + STEP)))
  return (
    <div style={{ flex: '1 1 30%', minWidth: 68, background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', padding: '4px 8px' }}>
      <span className="label-mono" style={{ fontSize: 7, color: 'var(--text-tertiary)' }}>Kiinduló kg</span>
      <div className="row" style={{ justifyContent: 'space-between', marginTop: 3 }}>
        <span style={{ fontFamily: 'var(--ff-display)', fontSize: 13, fontWeight: 600, color: isAuto ? 'var(--text-tertiary)' : 'var(--text-primary)' }}>
          {isAuto ? 'auto' : value}
        </span>
        <div className="row gap-xs">
          <button type="button" aria-label={`${aria} csökkentése`} onClick={dec}
            style={{ width: 18, height: 18, background: 'var(--surface-2)', border: '1px solid var(--border-strong)', color: 'var(--brand-glow)' }}>−</button>
          <button type="button" aria-label={`${aria} növelése`} onClick={inc}
            style={{ width: 18, height: 18, background: 'var(--surface-2)', border: '1px solid var(--border-strong)', color: 'var(--brand-glow)' }}>+</button>
        </div>
      </div>
    </div>
  )
}
