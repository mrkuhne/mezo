// Mai page zone model (mezo-rrtj) — pure: the composed FuelPlanToday's flat slot list becomes
// four napszak buckets, each with its own kcal / burn / stack-pip balance. No ambient time: the
// wake/bed anchor is injected exactly like buildDayPlan's nowHHmm.

import { ZONE_FRACTIONS, ZONE_KEYS, ZONE_LABELS, daySpan, unwrapDayMinute, type ZoneKeyName } from '@/data/fuel/fuelConfig'
import type { PlannerBlock } from '@/features/fuel/logic/buildDayPlan'
import { blockEnergyKind, DEFAULT_GYM_MIN, DEFAULT_RUN_MIN, netKcal } from '@/data/train/activityEnergy'
import type { FuelSlot } from '@/data/types'

export type ZoneKey = ZoneKeyName
export type ZoneState = 'done' | 'open' | 'ahead'
export type SlotRole = 'supplement' | 'activity' | 'meal' | 'other'

export interface DayZone {
  key: ZoneKey
  label: string
  slots: FuelSlot[]
  /** Σ kcal of the zone's eating windows (logged AND planned); 0 when it has none. */
  kcal: number
  hasMeals: boolean
  state: ZoneState
  /** Σ net burn (activityEnergy mirror, mezo-32m82) of the zone's training blocks; 0 when rest energy is unknown. */
  burnKcal: number
  /** One entry per supplement item in the zone; true = already taken. */
  stackPips: boolean[]
}

/**
 * Item-presence wins over `kind`: buildDayPlan maps the 'pre-fuel' protocol window onto
 * FuelKind 'snack' (PROTOCOL_KIND), so a kind-first rule would count a capsule window as an
 * eating window and inflate the zone's kcal.
 */
export function slotRole(slot: FuelSlot): SlotRole {
  if ((slot.items?.length ?? 0) > 0) return 'supplement'
  if (slot.kind === 'workout' || slot.kind === 'sport') return 'activity'
  if (slot.kind === 'meal' || slot.kind === 'snack') return 'meal'
  return 'other'
}

export function isMealSlot(slot: FuelSlot): boolean {
  return slotRole(slot) === 'meal'
}

export function buildDayZones(input: {
  slots: FuelSlot[]
  wake: string
  bed: string
  blocks: PlannerBlock[]
  /** Rest energy (kcal/h, `restKcalPerHour`) for the net burn; null → burn 0 (never a guess). */
  restPerHour: number | null
}): DayZone[] {
  const { slots, wake, bed, blocks, restPerHour } = input
  const { wakeMin, span, crossesMidnight } = daySpan(wake, bed)

  const zoneOf = (slot: FuelSlot): ZoneKey => {
    const t = unwrapDayMinute(slot.time, wakeMin, crossesMidnight)
    const frac = Math.min(1, Math.max(0, (t - wakeMin) / span))
    let key: ZoneKey = ZONE_KEYS[0]
    for (const k of ZONE_KEYS) if (frac >= ZONE_FRACTIONS[k]) key = k
    return key
  }

  return ZONE_KEYS.map<DayZone>(key => {
    const zoneSlots = slots.filter(s => zoneOf(s) === key)
    const meals = zoneSlots.filter(isMealSlot)
    const kcal = meals.reduce((sum, s) => sum + (s.kcal ?? 0), 0)
    const state: ZoneState = zoneSlots.some(s => s.state === 'now')
      ? 'open'
      : meals.length > 0 && meals.every(s => s.state === 'done')
        ? 'done'
        : 'ahead'
    const burnKcal = zoneSlots
      .filter(s => slotRole(s) === 'activity')
      .reduce((sum, s) => {
        const block = blocks.find(b => b.time === s.time)
        if (!block) return sum
        const min = block.durationMin ?? (block.kind === 'run' ? DEFAULT_RUN_MIN : DEFAULT_GYM_MIN)
        return sum + (netKcal(blockEnergyKind(block), null, min, restPerHour) ?? 0)
      }, 0)
    const stackPips = zoneSlots
      .filter(s => slotRole(s) === 'supplement')
      .flatMap(s => (s.items ?? []).map(i => i.done))
    return { key, label: ZONE_LABELS[key], slots: zoneSlots, kcal, hasMeals: meals.length > 0, state, burnKcal, stackPips }
  }).filter(z => z.slots.length > 0)
}
