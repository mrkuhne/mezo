// Meal-slot templates (mezo-7102) — replays a per-day-type `SlotTemplate` (fixed / wake / bed /
// training-relative anchors, signed `offsetMin`) onto a real day's wake/bed rhythm and training
// blocks, producing the same `PlannedWindow[]` shape `placeWindows` (buildDayPlan.ts) produces —
// clamped into the eating span, gap-spaced, sorted. Pure: no ambient time; blocks arrive UNSORTED
// from `deriveBlocks` (sort/min/max internally, mirroring `placeWindows`'s training-envelope snap).
//
// ── Midnight-crossing axis convention (mezo-7102 fix wave, finding F1) ──────────────────────────
// All INTERNAL resolution/clamping (anchor → minute, kitchenClose, gap-push) happens on the
// UNWRAPPED continuous day axis from `daySpan`/`unwrapDayMinute` — the same axis `dayZones.ts` and
// `FuelMaiPage.tsx` bucket against — so a midnight-crossing bed (e.g. wake 07:00 / bed 00:30) never
// collapses the eating span into a negative kitchenClose. The value this module RETURNS on
// `PlannedWindow.time`, however, is wall-clock minutes-since-midnight mod 1440 (0..1439) — the same
// convention `placeWindows` uses and every downstream consumer (`buildDayPlan`'s own sort/`toHHmm`,
// `dayZones.ts`, `FuelMaiPage.tsx`) expects. Callers that need to compare a compiled time back
// against the unwrapped axis (see `validateSlotPlan.ts`) must re-`unwrapDayMinute` it first — the
// two modules share this ONE convention.

import {
  DEFAULT_BLOCK_MIN,
  DEFAULT_RUN_MIN,
  EATING_START_OFFSET_MIN,
  KITCHEN_CLOSE_OFFSET_MIN,
  MIN_SLOT_GAP_MIN,
  daySpan,
  unwrapDayMinute,
} from '@/data/fuel/fuelConfig'
import type { PlannedWindow, PlannerBlock } from '@/features/fuel/logic/buildDayPlan'
import type { SlotTemplate, SlotTemplateRow } from '@/data/types'

/**
 * Resolves every row's anchor to a minute on the UNWRAPPED day axis (`daySpan`), WITHOUT clamping
 * into the eating span and WITHOUT the gap-push — the raw authored intent. A training-relative
 * anchor (`training_start`/`training_end`) has nothing to resolve against on a day with no blocks
 * → `null` for that row (never a NaN/garbage time). Single source of anchor resolution: both
 * `compileTemplate` (below) and `validateSlotPlan`'s out-of-span/past-kitchen-close checks (via
 * `FuelSlotsPage`, mezo-7102 fix wave finding F2) read off this same function.
 */
export function resolveAnchorTimes(rows: SlotTemplateRow[], ctx: { wake: string; bed: string; blocks: PlannerBlock[] }): (number | null)[] {
  const { wakeMin, bedMin, crossesMidnight } = daySpan(ctx.wake, ctx.bed)
  const starts = ctx.blocks.map(b => unwrapDayMinute(b.time, wakeMin, crossesMidnight))
  const ends = ctx.blocks.map((b, i) => starts[i] + (b.durationMin ?? (b.kind === 'run' ? DEFAULT_RUN_MIN : DEFAULT_BLOCK_MIN)))

  return rows.map(row => {
    const a = row.anchor
    if (a.type === 'fixed') return unwrapDayMinute(a.time, wakeMin, crossesMidnight)
    if (a.type === 'wake') return wakeMin + a.offsetMin
    if (a.type === 'bed') return bedMin + a.offsetMin
    if (a.type === 'training_start') return starts.length ? Math.min(...starts) + a.offsetMin : null
    if (a.type === 'training_end') return ends.length ? Math.max(...ends) + a.offsetMin : null
    return null // exhaustive per SlotAnchor['type']; unreachable
  })
}

/**
 * Resolves every template row's anchor (via `resolveAnchorTimes`), clamps it into the eating span
 * [wake+45, bed−90] on the unwrapped axis, forward-pushes for `MIN_SLOT_GAP_MIN` spacing (capped at
 * kitchenClose), sorts by time, then converts back to wall-clock minutes (mod 1440) for the
 * returned `PlannedWindow.time` — see the module header for why. A training-relative anchor with
 * a null resolution (no blocks) is defensively dropped from the output.
 */
export function compileTemplate(template: SlotTemplate, ctx: { wake: string; bed: string; blocks: PlannerBlock[] }): PlannedWindow[] {
  const { wakeMin, bedMin } = daySpan(ctx.wake, ctx.bed)
  const eatingStart = wakeMin + EATING_START_OFFSET_MIN
  const kitchenClose = bedMin - KITCHEN_CLOSE_OFFSET_MIN
  const clamp = (t: number) => Math.min(kitchenClose, Math.max(eatingStart, t))
  const rawTimes = resolveAnchorTimes(template.slots, ctx)

  const windows: PlannedWindow[] = []
  template.slots.forEach((row, i) => {
    const t = rawTimes[i]
    if (t == null) return // training anchor on a blockless day — defensive drop
    windows.push({ slotKey: row.slotKind, kind: row.slotKind === 'snack' ? 'snack' : 'meal', label: row.label, time: clamp(t), weight: row.budgetPct, budgetPct: row.budgetPct, role: row.role })
  })
  windows.sort((a, z) => a.time - z.time)
  for (let i = 1; i < windows.length; i++) {
    if (windows[i].time < windows[i - 1].time + MIN_SLOT_GAP_MIN) {
      windows[i].time = Math.min(kitchenClose, windows[i - 1].time + MIN_SLOT_GAP_MIN)
    }
  }
  // Back onto wall-clock (mod 1440) for the output — internal resolution/clamping above stays on
  // the unwrapped axis, but `PlannedWindow.time` must read like `placeWindows`'s (0..1439).
  for (const w of windows) w.time = ((w.time % 1440) + 1440) % 1440
  return windows
}
