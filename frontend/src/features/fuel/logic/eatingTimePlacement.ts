import type { FuelSlot, MealSlot } from '@/data/types'
import { defaultMealSlot } from '@/features/fuel/logic/defaultMealSlot'

export interface EatingTimePlacement {
  slot: MealSlot
  window?: { from: string; to: string }
  label: string | null
}

const minute = (time: string) => {
  const [hour, min] = time.split(':').map(Number)
  return hour * 60 + min
}

export function resolveEatingTimePlacement(atHHmm: string, windows: readonly FuelSlot[]): EatingTimePlacement {
  const at = minute(atHHmm)
  const match = windows.find((candidate) => {
    if ((candidate.kind !== 'meal' && candidate.kind !== 'snack') ||
      !candidate.slotKey || !candidate.windowFrom || !candidate.windowTo) return false
    const from = minute(candidate.windowFrom), to = minute(candidate.windowTo)
    return from <= to ? at >= from && at <= to : at >= from || at <= to
  })
  if (match) return {
    slot: match.slotKey!,
    window: { from: match.windowFrom!, to: match.windowTo! },
    label: match.label,
  }
  const [hour, min] = atHHmm.split(':').map(Number)
  return { slot: defaultMealSlot(new Date(2000, 0, 1, hour, min)), label: null }
}
