// projectStackDay — Fuel/Stack pure day projection (mezo-vx9v). Replaces buildProtocol's slot
// derivation: takes the living protocol's occurrences (Task 5) + today's real anchors/blocks and
// projects each occurrence into a zone at a concrete time, applying rest-day regrouping (an
// occurrence pinned to pre_workout/post_workout with no training today either skips or displaces
// to its fallback zone, keeping its original zone as `persistedZone` so the UI can badge it) and
// per-occurrence taken state (via `resolveTakenKeys`, which also carries the legacy null-slotKey
// intake forward onto the item's first zone-ordered occurrence not already taken). No React, no
// ambient time — every anchor (wake/bed/blocks) is injected by the caller.

import { PRE_WORKOUT_STACK_LEAD_MIN } from '@/features/fuel/logic/buildProtocol'
import { placeWindows, type PlannerBlock } from '@/features/fuel/logic/buildDayPlan'
import { STACK_ZONE_LABEL, STACK_ZONE_ORDER } from '@/data/fuel/stackZones'
import { toHHmm, toMin } from '@/data/fuel/fuelConfig'
import type { Intake } from '@/data/fuel/fuelApi'
import type { ProtocolOccurrence, StackPlacementSource, StackZoneKey, SupplementStashItem } from '@/data/types'

export interface StackDayEntry {
  occurrenceId: string
  pantryItemId: string
  persistedZone: StackZoneKey
  name: string
  dose: string | null
  pinned: boolean
  placementSource: StackPlacementSource
  reason: string | null
  dailyTotalHint: string | null
  /** rest-day 'skip' — render greyed, tick disabled. */
  skippedToday: boolean
  /** rest-day fallback move — badge 'ma nincs edzés'. */
  displacedToday: boolean
  taken: boolean
}
export interface StackDaySlot {
  zone: StackZoneKey
  time: string
  label: string
  anchorNote: string | null
  entries: StackDayEntry[]
}
export interface StackDayInput {
  occurrences: ProtocolOccurrence[]
  stash: SupplementStashItem[]
  intakes: Intake[]
  wake: string
  bed: string
  mealsPerDay: number
  blocks: PlannerBlock[]
}

/** Seeds a `'<pantryItemId>|<zone>'` key per intake that already carries an explicit `slotKey`,
 *  then walks the legacy (null-`slotKey`) intakes: each one claims that item's FIRST
 *  zone-ordered occurrence whose key isn't already taken (so N legacy intakes for the same item
 *  fan out across its N occurrences instead of piling onto the first one). An item with no
 *  matching occurrence, or whose every occurrence is already claimed, contributes nothing. */
export function resolveTakenKeys(intakes: Intake[], occurrences: ProtocolOccurrence[]): Set<string> {
  const keys = new Set<string>()
  for (const i of intakes) {
    if (i.slotKey) keys.add(`${i.pantryItemId}|${i.slotKey}`)
  }
  for (const i of intakes) {
    if (i.slotKey) continue
    const candidates = occurrences
      .filter(o => o.pantryItemId === i.pantryItemId)
      .sort((a, b) => STACK_ZONE_ORDER.indexOf(a.slotKey) - STACK_ZONE_ORDER.indexOf(b.slotKey))
    const match = candidates.find(o => !keys.has(`${o.pantryItemId}|${o.slotKey}`))
    if (match) keys.add(`${match.pantryItemId}|${match.slotKey}`)
  }
  return keys
}

/** Projects today's living-protocol occurrences into zoned, timed slots. */
export function projectStackDay(input: StackDayInput): StackDaySlot[] {
  const { occurrences, stash, intakes, wake, bed, mealsPerDay, blocks } = input
  const hasTraining = blocks.length > 0
  const sorted = [...blocks].sort((a, b) => toMin(a.time) - toMin(b.time))
  const first = sorted[0]
  const windows = placeWindows(wake, bed, mealsPerDay, blocks)
  const windowTime = (slot: 'breakfast' | 'lunch' | 'dinner') => {
    const w = windows.find(x => x.slotKey === slot && x.kind === 'meal')
    return w ? toHHmm(Math.round(w.time)) : null
  }
  const zoneTime: Record<StackZoneKey, string | null> = {
    wake,
    breakfast: windowTime('breakfast') ?? toHHmm(toMin(wake) + 45),
    pre_workout: first ? toHHmm(toMin(first.time) - PRE_WORKOUT_STACK_LEAD_MIN) : null,
    post_workout: first ? toHHmm(toMin(first.time) + (first.durationMin ?? 60) + 30) : null,
    lunch: windowTime('lunch') ?? '12:30',
    dinner: windowTime('dinner') ?? toHHmm(toMin(bed) - 240),
    evening: toHHmm(toMin(bed) - 120),
    bedtime: toHHmm(toMin(bed) - 30),
  }
  const anchorNote: Record<StackZoneKey, string | null> = {
    wake: null,
    breakfast: 'étkezéshez kötve',
    pre_workout: `edzés −${PRE_WORKOUT_STACK_LEAD_MIN}p`,
    post_workout: 'edzés +30p',
    lunch: 'étkezéshez kötve',
    dinner: 'étkezéshez kötve',
    evening: 'lefekvés −2h',
    bedtime: 'lefekvés −30p',
  }
  const takenKeys = resolveTakenKeys(intakes, occurrences)
  const byZone = new Map<StackZoneKey, StackDayEntry[]>()
  for (const o of occurrences) {
    const item = stash.find(s => s.id === o.pantryItemId)
    let zone: StackZoneKey = o.slotKey
    let skipped = false
    let displaced = false
    const trainingZone = o.slotKey === 'pre_workout' || o.slotKey === 'post_workout'
    if (!hasTraining && trainingZone) {
      const fb = o.restDayFallback ?? (o.slotKey === 'pre_workout' ? 'breakfast' : 'lunch')
      if (fb === 'skip') {
        zone = o.slotKey === 'pre_workout' ? 'breakfast' : 'lunch'
        skipped = true
      } else {
        zone = fb
        displaced = true
      }
    }
    const entry: StackDayEntry = {
      occurrenceId: o.id,
      pantryItemId: o.pantryItemId,
      persistedZone: o.slotKey,
      name: item?.name ?? '(törölt Kamra-item)',
      dose: o.dose ?? item?.dose ?? null,
      pinned: o.pinned,
      placementSource: o.placementSource,
      reason: o.placementReason,
      dailyTotalHint: o.dailyTotalHint,
      skippedToday: skipped,
      displacedToday: displaced,
      taken: !skipped && takenKeys.has(`${o.pantryItemId}|${o.slotKey}`),
    }
    const list = byZone.get(zone) ?? []
    list.push(entry)
    byZone.set(zone, list)
  }
  return STACK_ZONE_ORDER.filter(z => byZone.has(z) && zoneTime[z] != null).map(z => ({
    zone: z,
    time: zoneTime[z] as string,
    label: STACK_ZONE_LABEL[z],
    anchorNote: anchorNote[z],
    entries: byZone.get(z) as StackDayEntry[],
  }))
}
