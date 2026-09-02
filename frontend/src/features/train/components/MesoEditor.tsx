// ============================================================
// Mezo · MesoEditor — unified day-tabbed meso day editor (mezo-7rdg, spec
// 2026-08-01-set-budget-unified-editor). Drop-in replacement for
// MesoDayTabsEditor that composes MesoEditorHero + WeeklyBandsCard +
// ExerciseAccordionRow: same day-tab strip / active-day seeding / off-day
// card / add-button (ported from MesoDayTabsEditor.tsx), plus a red
// session-cap warning dot per tab, single-expand accordion rows with
// auto-expand-on-add, and optional inline day-rename for custom splits
// (capability parity with PlannerDaySection's onRename).
//
// Hero warningCount is WEEK-level: ALL session-cap breaches across the week
// (the weekly-band % overage alarm retired with SetBudgetCard, mezo-d20.14)
// — the hero is the week-truth surface; per-day locality is what the red
// tab dots are for. "Week" means the optional `weekDays` prop when given
// (`ProgramDayView` edits ONE day but must judge it against the whole 7-day
// program), else `days` — the two coincide wherever the editor owns the week.
// ============================================================
import { useEffect, useMemo, useRef, useState } from 'react'
import type { GymExercise, MesoDay, MusclePriorities } from '@/data/types'
import { Icon } from '@/shared/ui/Icon'
import { SortableList } from '@/shared/ui/SortableList'
import { DayBreakdownCard } from '@/features/train/components/DayBreakdownCard'
import { ExerciseAccordionRow } from '@/features/train/components/ExerciseAccordionRow'
import { MesoEditorHero } from '@/features/train/components/MesoEditorHero'
import { PeakFitCard } from '@/features/train/components/PeakFitCard'
import { StructureLintCard } from '@/features/train/components/StructureLintCard'
import { WeeklyBandsCard } from '@/features/train/components/WeeklyBandsCard'
import { budgetGroup, countsForVolume, daySessionBreakdown, leastLoadedDayFor, sessionCapWarnings } from '@/features/train/logic/setBudget'
import { isOffDay } from '@/features/train/logic/offDay'
import { peakWeekFit } from '@/features/train/logic/peakWeekFit'
import { estimateSessionMinutes } from '@/features/train/logic/sessionLength'
import { structureLint } from '@/features/train/logic/structureLint'
import { suggestedWarmupSets } from '@/features/train/logic/warmupSuggest'
import { weeklyBands } from '@/features/train/logic/weeklyBands'

interface MesoEditorProps {
  /** The days this editor EDITS — the tab strip, the breakdown and the exercise list. */
  days: MesoDay[]
  /**
   * The days the WEEK-level derivations read (hero week totals, `WeeklyBandsCard`,
   * `structureLint`, `peakWeekFit`, `sessionCapWarnings`). Defaults to `days`, which is right
   * whenever the editor owns the whole week. The wizard's one-day page (`ProgramDayView`)
   * passes the full 7-day program here: otherwise every week-scope rule — weekly frequency,
   * variety, the week's set band ceilings — would judge one Monday as if it were the week
   * (mezo-d20.14 review, I2).
   */
  weekDays?: MesoDay[]
  onAddClick: (dayKey: string) => void
  onRemove: (dayKey: string, exId: string) => void
  onChange: (dayKey: string, exId: string, patch: Partial<GymExercise>) => void
  onReorder: (dayKey: string, ids: string[]) => void
  /** Renames the active day (custom splits, capability parity with PlannerDaySection). */
  onRenameDay?: (dayKey: string, name: string) => void
  /** Per-coarse-muscle tier map (mezo-3m5m, spec GD4) — threaded into weeklyBands,
   *  structureLint and peakWeekFit. Absent/null -> every group defaults to Grow. */
  priorities?: MusclePriorities | null
  /** Explicit per-mesocycle landmark override (AD5) — wins over the static GROUP_LANDMARKS
   *  default in weeklyBands and peakWeekFit. */
  volumePerMuscle?: Record<string, { mev: number; mav: number; mrv: number }> | null
}

export function MesoEditor({
  days, weekDays, onAddClick, onRemove, onChange, onReorder, onRenameDay, priorities, volumePerMuscle,
}: MesoEditorProps) {
  const week = weekDays ?? days
  const [activeDay, setActiveDay] = useState<string | null>(
    () => days.find((d) => d.current)?.day ?? days.find((d) => !isOffDay(d))?.day ?? days[0]?.day ?? null,
  )
  const [expandedId, setExpandedId] = useState<string | null>(null)
  // Auto-expand baseline: seeded ONCE at mount with every exercise id across
  // ALL days (not just the active one, so tab switches never fake-trigger) —
  // nothing is expanded on mount; only ids appearing AFTER this baseline count
  // as freshly added and auto-expand.
  const knownIds = useRef<Set<string> | null>(null)
  if (knownIds.current === null) {
    knownIds.current = new Set(days.flatMap((d) => d.exercises.map((e) => e.id)))
  }

  const day = days.find((d) => d.day === activeDay) ?? days[0]

  // Week-scope derivations read `week`, never `days` — see the `weekDays` prop doc.
  const bands = useMemo(
    () => weeklyBands(week, priorities ?? null, volumePerMuscle ?? undefined),
    [week, priorities, volumePerMuscle],
  )
  const capWarnings = sessionCapWarnings(week)
  const lintFindings = structureLint(week, priorities)
  const peakFit = peakWeekFit(week, priorities, volumePerMuscle)
  const warningDays = new Set(capWarnings.map((w) => w.day))
  const warningCount = capWarnings.length

  // Active-day-level breakdown (Task 1's daySessionBreakdown) — locality
  // companion to the week-level WeeklyBandsCard below it; both stay visible.
  const dayRows = daySessionBreakdown(day)
  const dayOverRows = dayRows.filter((r) => r.over)
  const dayWarnings = dayOverRows.map((r) => ({
    label: r.label,
    sets: r.sets,
    suggestDay: leastLoadedDayFor(days, r.group, day.day),
  }))
  const overGroups = new Set(dayOverRows.map((r) => r.group))

  // Auto-expand: when the active day gains an id absent from the mount-time
  // baseline (a freshly added exercise), expand it — AND, once, apply its
  // adaptive warmup suggestion when it differs from the stored default.
  // The picker now seeds scheme- and type-aware warmups itself (compound 2 /
  // isolation 1 / plyo 0 via addExerciseWithDefaults, refined by
  // warmupSuggest on insert), so this patch is a safety net for out-of-band
  // divergence — usually a no-op.
  useEffect(() => {
    if (!day) return
    const seen = knownIds.current
    if (!seen) return
    let newId: string | null = null
    for (const e of day.exercises) {
      if (!seen.has(e.id)) newId = e.id
      seen.add(e.id)
    }
    if (newId) {
      setExpandedId(newId)
      const newEx = day.exercises.find((e) => e.id === newId)
      const suggestion = suggestedWarmupSets(day, newId)
      if (newEx && suggestion !== newEx.warmupSets) {
        onChange(day.day, newId, { warmupSets: suggestion })
      }
    }
  }, [day])

  if (!day) return null

  const off = isOffDay(day)
  const daySets = day.exercises.reduce((a, e) => a + e.workingSets, 0)
  const dayMinutes = estimateSessionMinutes(day.exercises)
  const weekSets = week.reduce((a, d) => a + d.exercises.reduce((s, e) => s + e.workingSets, 0), 0)
  const trainingDays = week.filter((d) => d.exercises.length > 0).length
  const showRename = Boolean(onRenameDay) && day.muscle === 'custom'

  return (
    <div className="col gap-md">
      {/* Day tabs */}
      <div className="row gap-xs" style={{ overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 4 }}>
        {days.map((d) => {
          const active = d.day === day.day
          const dayOff = isOffDay(d)
          const dayWarning = warningDays.has(d.day)
          return (
            <button
              key={d.day}
              type="button"
              aria-pressed={active}
              aria-label={`${d.day} · ${d.type}${dayWarning ? ' · terhelés-jelzés' : ''}`}
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
              {dayWarning && (
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
        // When the rename input is shown, it already carries the custom day's
        // name — blank the hero eyebrow so the name isn't rendered twice.
        dayType={showRename ? '' : day.type}
        daySets={daySets}
        dayExerciseCount={day.exercises.length}
        dayMinutes={dayMinutes}
        weekSets={weekSets}
        trainingDays={trainingDays}
        warningCount={warningCount}
      />

      <DayBreakdownCard rows={dayRows} warnings={dayWarnings} />

      <WeeklyBandsCard rows={bands} note="1. hét → plafon. Az Emphasize izmok kapják a legtöbbet." />

      <PeakFitCard fits={peakFit} />

      <StructureLintCard findings={lintFindings} />

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
              <ExerciseAccordionRow
                ex={e}
                expanded={expandedId === e.id}
                onToggle={() => setExpandedId((cur) => (cur === e.id ? null : e.id))}
                onRemove={() => onRemove(day.day, e.id)}
                onChange={(patch) => onChange(day.day, e.id, patch)}
                highlight={countsForVolume(e) && overGroups.has(budgetGroup(e.muscle) ?? '')}
                suggestedWarmup={suggestedWarmupSets(day, e.id)}
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
