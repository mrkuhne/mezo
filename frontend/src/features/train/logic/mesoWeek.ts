// ============================================================
// Mezo · mesoWeek — mesocycle pages v2 (Task 4). Pure, no React. Derives the
// „Heti vizsgálat" week-mosaic (weekSummary + muscleTiles) and the „izom-
// részlet" muscle page's supporting reads (whereItWorks, previousBlock).
// Reuses runBands (mesoBands.ts) for the tier/ceiling/step math so the week
// page's tiles and the run page's live banner never compute the ceiling two
// different ways, and daySessionBreakdown/budgetGroup (setBudget.ts) for the
// per-day muscle-group joins so a day's set count is counted exactly once.
// ============================================================
import type { Mesocycle, MesoVolumeArc, MuscleTier } from '@/data/types'
import { runBands } from '@/features/train/logic/mesoBands'
import { BUDGET_GROUP_LABELS, budgetGroup, countsForVolume, daySessionBreakdown } from '@/features/train/logic/setBudget'

export interface WeekSummary {
  total: number
  prev: number | null
  delta: number | null
  up: number
  hold: number
}

function plannedInWeek(arc: MesoVolumeArc, week: number): number {
  return arc.muscles.reduce((sum, m) => sum + (m.weeks.find((w) => w.week === week)?.planned ?? 0), 0)
}

/** total = Σ planned of currentWeek; prev = Σ planned of currentWeek-1 (null at week 1). `up`/
 *  `hold` are counted from the TILES (not runBands) so the stat strip always agrees with what
 *  the mosaic actually shows — a grind-held muscle (statusTone 'gold', „= tartás · grind a
 *  múlt héten") reads as `up` under a bare RunBand.step (its band isn't at the ceiling and
 *  isn't a maintain tier), but its tile plainly reads as a hold. */
export function weekSummary(arc: MesoVolumeArc, tiles: MuscleWeekTile[]): WeekSummary {
  const total = plannedInWeek(arc, arc.currentWeek)
  const prev = arc.currentWeek > 1 ? plannedInWeek(arc, arc.currentWeek - 1) : null
  const delta = prev === null ? null : total - prev
  const up = tiles.filter((t) => t.statusTone === 'sage').length
  const hold = tiles.length - up
  return { total, prev, delta, up, hold }
}

export interface MuscleWeekTile {
  group: string
  label: string
  region: string
  tier: MuscleTier
  current: number
  ceiling: number
  mev: number
  mav: number
  mrv: number
  prev: number | null
  series: { week: number; planned: number; actual: number | null; isCurrent: boolean; deload: boolean }[]
  status: string
  statusTone: 'sage' | 'gold' | 'mut'
}

/** Muscles whose latest recompute change is a HOLD (grind — real backend vocabulary,
 *  VolumeProgressionService.reasonFor(HOLD) === 'tartás'; see mesoBands.ts's own note on
 *  the mock fixture's richer narrative reasons falling through to the ▲ +2 default). */
function grindHeldGroups(meso: Mesocycle): Set<string> {
  return new Set((meso.volumeRecompute?.changes ?? []).filter((c) => c.reason === 'tartás').map((c) => c.muscle))
}

/** Joins the arc's per-muscle planned series with runBands (tier/ceiling) for the week
 *  mosaic. Sorted by ceiling descending — the same order runBands/nextRolloverChips use,
 *  so the emphasized muscle (highest ceiling) always leads. */
export function muscleTiles(arc: MesoVolumeArc, meso: Mesocycle): MuscleWeekTile[] {
  const bands = new Map(runBands(meso).map((b) => [b.group, b]))
  const grindHeld = grindHeldGroups(meso)
  const week = arc.currentWeek

  return arc.muscles
    .map((m): MuscleWeekTile | null => {
      const band = bands.get(m.muscle)
      if (!band) return null
      const current = m.weeks.find((w) => w.week === week)?.planned ?? band.current
      const prev = week > 1 ? m.weeks.find((w) => w.week === week - 1)?.planned ?? null : null
      const series = m.weeks.map((w) => ({
        week: w.week, planned: w.planned, actual: w.actual, isCurrent: w.isCurrent, deload: w.phase === 'Deload',
      }))

      let status: string
      let statusTone: MuscleWeekTile['statusTone']
      if (band.tier === 'maintain') {
        status = 'MV-n tart · nem rámpázik'
        statusTone = 'mut'
      } else if (current >= band.ceiling) {
        status = 'plafonon'
        statusTone = 'gold'
      } else if (grindHeld.has(m.muscle)) {
        status = '= tartás · grind a múlt héten'
        statusTone = 'gold'
      } else {
        status = `▲ +2 e héten · ${band.ceiling - current} a plafonig`
        statusTone = 'sage'
      }

      return {
        group: m.muscle, label: BUDGET_GROUP_LABELS[m.muscle] ?? m.muscle, region: m.region, tier: band.tier,
        current, ceiling: band.ceiling, mev: band.mev, mav: band.mav, mrv: m.mrv, prev, series, status, statusTone,
      }
    })
    .filter((t): t is MuscleWeekTile => t !== null)
    .sort((a, b) => b.ceiling - a.ceiling)
}

export interface WeekWorkDay {
  day: string
  type: string
  sets: number
  exercises: { name: string; sets: number }[]
}

/** The days a muscle group actually trains this block — day letter, session type, the
 *  group's set count that day (daySessionBreakdown's own count, exemptSets excluded) and
 *  the exercises that fed it. Days where the group has no work are skipped. */
export function whereItWorks(meso: Mesocycle, group: string): WeekWorkDay[] {
  const days = meso.days ?? []
  const out: WeekWorkDay[] = []
  for (const d of days) {
    const hit = daySessionBreakdown(d).find((r) => r.group === group)
    if (!hit) continue
    const exercises = d.exercises
      .filter((e) => budgetGroup(e.muscle) === group && countsForVolume(e))
      .map((e) => ({ name: e.name, sets: e.workingSets }))
    out.push({ day: d.day, type: d.type, sets: hit.sets, exercises })
  }
  return out
}

export interface PreviousBlock {
  start: number
  peak: number
  ceiling: number
  title: string
}

/** The most recent archived run's landmarks for `group` — honest label: the arc itself was
 *  never fetched for a closed run here (that's MesoReportPage's own frozen arc), so this is
 *  read straight off the run's volumePerMuscle snapshot ('utolsó ismert'). null when no
 *  archived run ever carried this group. */
export function previousBlock(archived: Mesocycle[], group: string): PreviousBlock | null {
  const candidates = archived
    .filter((m) => m.volumePerMuscle?.[group])
    .sort((a, b) => (b.closedAt ?? b.endDate).localeCompare(a.closedAt ?? a.endDate))
  const meso = candidates[0]
  if (!meso) return null
  const vp = meso.volumePerMuscle![group]
  return { start: vp.mev, peak: vp.current, ceiling: vp.mrv, title: meso.shortTitle ?? meso.title }
}
