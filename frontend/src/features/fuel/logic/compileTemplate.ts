// Meal-slot templates (mezo-7102) — replays a per-day-type `SlotTemplate` (fixed / wake / bed /
// training-relative anchors, signed `offsetMin`) onto a real day's wake/bed rhythm and training
// blocks, producing the same `PlannedWindow[]` shape `placeWindows` (buildDayPlan.ts) produces —
// clamped into the eating span, gap-spaced, sorted. Pure: no ambient time; blocks arrive UNSORTED
// from `deriveBlocks` (sort/min/max internally, mirroring `placeWindows`'s training-envelope snap).

import {
  DEFAULT_BLOCK_MIN,
  DEFAULT_RUN_MIN,
  EATING_START_OFFSET_MIN,
  KITCHEN_CLOSE_OFFSET_MIN,
  MIN_SLOT_GAP_MIN,
  toMin,
} from '@/data/fuel/fuelConfig'
import type { PlannedWindow, PlannerBlock } from '@/features/fuel/logic/buildDayPlan'
import type { SlotTemplate } from '@/data/types'

/**
 * Resolves every template row's anchor to a clock-minute, clamps it into the eating span
 * [wake+45, bed−90], forward-pushes for `MIN_SLOT_GAP_MIN` spacing (capped at kitchenClose), and
 * sorts by time. A training-relative anchor (`training_start`/`training_end`) has nothing to
 * resolve against on a day with no blocks — that row is defensively dropped from the output,
 * never left with a NaN/garbage time.
 */
export function compileTemplate(template: SlotTemplate, ctx: { wake: string; bed: string; blocks: PlannerBlock[] }): PlannedWindow[] {
  const eatingStart = toMin(ctx.wake) + EATING_START_OFFSET_MIN
  const kitchenClose = toMin(ctx.bed) - KITCHEN_CLOSE_OFFSET_MIN
  const clamp = (t: number) => Math.min(kitchenClose, Math.max(eatingStart, t))
  const starts = ctx.blocks.map(b => toMin(b.time))
  const ends = ctx.blocks.map(b => toMin(b.time) + (b.durationMin ?? (b.kind === 'run' ? DEFAULT_RUN_MIN : DEFAULT_BLOCK_MIN)))

  const windows: PlannedWindow[] = []
  for (const row of template.slots) {
    let t: number | null = null
    const a = row.anchor
    if (a.type === 'fixed') t = toMin(a.time)
    else if (a.type === 'wake') t = toMin(ctx.wake) + a.offsetMin
    else if (a.type === 'bed') t = toMin(ctx.bed) + a.offsetMin
    else if (a.type === 'training_start') t = starts.length ? Math.min(...starts) + a.offsetMin : null
    else if (a.type === 'training_end') t = ends.length ? Math.max(...ends) + a.offsetMin : null
    if (t == null) continue // training anchor on a blockless day — defensive drop
    windows.push({ slotKey: row.slotKind, kind: row.slotKind === 'snack' ? 'snack' : 'meal', label: row.label, time: clamp(t), weight: row.budgetPct, budgetPct: row.budgetPct, role: row.role })
  }
  windows.sort((a, z) => a.time - z.time)
  for (let i = 1; i < windows.length; i++) {
    if (windows[i].time < windows[i - 1].time + MIN_SLOT_GAP_MIN) {
      windows[i].time = Math.min(kitchenClose, windows[i - 1].time + MIN_SLOT_GAP_MIN)
    }
  }
  return windows
}
