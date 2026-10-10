// ============================================================
// Mezo · MesoEditor — the day editor of a running plan (mezo-7rdg, spec
// 2026-08-01-set-budget-unified-editor; Folyadék mezo-n4wf5.3, prototype
// vilagos/edzes.js `napszerk()`).
// The page body under the title bar: the hero (the day poured into one vessel, the add
// button on the liquid row) → 1 „Sorrend és előírás" (sortable accordion rows, autosaved)
// → 2 „Ma · izmonként" → 3 „Heti szettek · izmonként" → 4 „Ellenőrzés" (two collapsible
// checks). A section whose card has nothing to say is left out and the numbers close up.
// A rest day is the hero alone. With more than one day it also carries the day pills (a
// dot marks a day that breaks the session cap) and, for custom splits, the day-name field.
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
import { DAY_LABELS } from '@/data/train/train'
import { Card, Input, Note, Pill, Pills, Section } from '@/shared/ui/folyadek'
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
import { estimateSessionMinutes, type SessionTimingProfile } from '@/features/train/logic/sessionLength'
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
  /** Calibrated pacing (Task 12, mezo-dzbm; GET /api/train/timing-profile via useTimingProfile
   *  in the CALLING PAGE — this presentational component never fetches its own data, per
   *  frontend_conventions.md §"components are presentational"). Only feeds `dayMinutes` below —
   *  structureLint/peakWeekFit stay on the static estimate (see sessionLength.ts header). */
  timingProfile?: SessionTimingProfile | null
  /** True while the profile fetch is unresolved (real mode, first load/navigation within a
   *  mount). While true, `dayMinutes` is held at 0 rather than falling back to the static
   *  estimate — otherwise the hero would show the static number and then swap to the
   *  calibrated one the instant the fetch lands. */
  timingProfilePending?: boolean
}

export function MesoEditor({
  days, weekDays, onAddClick, onRemove, onChange, onReorder, onRenameDay, priorities, volumePerMuscle,
  timingProfile, timingProfilePending,
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
  // Held at 0 (the hero's existing "no minutes" treatment) while the profile fetch is
  // pending — never the static fallback, which would render then swap under the user.
  const dayMinutes = timingProfilePending ? 0 : estimateSessionMinutes(day.exercises, timingProfile ?? undefined)
  const weekSets = week.reduce((a, d) => a + d.exercises.reduce((s, e) => s + e.workingSets, 0), 0)
  const trainingDays = week.filter((d) => d.exercises.length > 0).length
  const showRename = Boolean(onRenameDay) && day.muscle === 'custom'

  const dayName = DAY_LABELS[day.day] ?? day.day
  const heroLabel = [dayName, showRename ? '' : day.type, 'a nap szerkesztése'].filter(Boolean).join(' · ')
  // The numbered sections: only the ones that have something to show, numbered in order.
  let n = 0

  return (
    <>
      {/* Day pills — only when there IS a choice. A single-day editor (the day's own route)
          names its day in the title bar and the hero; a lone pill would switch nothing (mezo-d20.15). */}
      {days.length > 1 && (
        <Pills className="ee-days">
          {days.map((d) => {
            const dayOff = isOffDay(d)
            const dayWarning = warningDays.has(d.day)
            return (
              <Pill key={d.day} on={d.day === day.day} className={dayOff ? 'ee-dayoff' : undefined}
                aria-label={`${d.day} · ${d.type}${dayWarning ? ' · terhelés-jelzés' : ''}`}
                onClick={() => setActiveDay(d.day)}>
                {d.day}
                {!dayOff && <small>{d.exercises.length}</small>}
                {dayWarning && <i className="ee-daydot" aria-hidden="true" />}
              </Pill>
            )
          })}
        </Pills>
      )}

      {showRename && (
        <Input className="ee-rename" aria-label={`${day.day} nap átnevezése`} value={day.type}
          onChange={(e) => onRenameDay?.(day.day, e.target.value)} />
      )}

      <MesoEditorHero
        label={heroLabel}
        exercises={day.exercises}
        daySets={daySets}
        dayExerciseCount={day.exercises.length}
        dayMinutes={dayMinutes}
        weekSets={weekSets}
        trainingDays={trainingDays}
        warningCount={warningCount}
        onAdd={() => onAddClick(day.day)}
        off={off}
        offNote={day.note}
      />

      {!off && (
        <>
          <Section n={++n} title="Sorrend és előírás" />
          <Card className="ee-list">
            {day.exercises.length === 0 ? (
              <Note className="ee-none">Ezen a napon még nincs gyakorlat.</Note>
            ) : (
              <SortableList
                chevrons="focus"
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
            )}
            <Note>Húzd a sorokat a sorrendhez, koppints egyre az átíráshoz. Minden változás azonnal mentődik.</Note>
          </Card>

          {dayRows.length > 0 && <Section n={++n} title="Ma · izmonként" />}
          <DayBreakdownCard rows={dayRows} warnings={dayWarnings} />

          {bands.length > 0 && <Section n={++n} title="Heti szettek · izmonként" />}
          <WeeklyBandsCard rows={bands} note="Az 1. héttől a felső értékig. A hangsúlyos izmok kapják a legtöbbet." />

          <Section n={++n} title="Ellenőrzés" />
          <Card className="ee-checks">
            <PeakFitCard fits={peakFit} />
            <StructureLintCard findings={lintFindings} />
          </Card>
        </>
      )}
    </>
  )
}
