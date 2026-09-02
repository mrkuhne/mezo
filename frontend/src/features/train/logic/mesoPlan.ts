// ============================================================
// Mezo · mesoPlan — the FE mirror of the backend MesoPlanSkeleton (mesocycle wizard
// redesign). Pure. Gives the wizard its live numbers before the generator answers
// (split line, week-1/peak totals, per-day frames for the day mosaic) and the mock-mode
// proposal its frames. Same tables as backend/…/MesoPlanSkeleton.java — change both.
// ============================================================
import { DAY_ORDER } from '@/data/train/train'
import type { MusclePriorities, MuscleTier } from '@/data/types'
import { GROUP_LANDMARKS } from '@/features/train/logic/setBudget'
import { TIER_GROUPS, tierOf } from '@/features/train/logic/musclePriorities'

export type DayType = 'Full' | 'Upper' | 'Lower' | 'Push' | 'Pull' | 'Legs' | 'Rest'
export interface MuscleFrame { group: string; sets: number }
export interface DayFrame { day: string; type: DayType; muscles: MuscleFrame[] }
export interface Landmark { mev: number; mav: number; mrv: number }

export const SESSION_CAP = 8

export const SPLIT_LABELS: Record<number, string> = {
  2: 'Full body', 3: 'Full body', 4: 'Upper / Lower', 5: 'Upper / Lower / Push / Pull / Legs', 6: 'Push / Pull / Legs ×2',
}
export const SPLIT_TYPES: Record<number, DayType[]> = {
  2: ['Full', 'Full'],
  3: ['Full', 'Full', 'Full'],
  4: ['Upper', 'Lower', 'Upper', 'Lower'],
  5: ['Upper', 'Lower', 'Push', 'Pull', 'Legs'],
  6: ['Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs'],
}
const TYPE_GROUPS: Record<Exclude<DayType, 'Rest'>, string[]> = {
  Full: ['quad', 'chest', 'back', 'ham', 'shoulder', 'glute', 'biceps', 'triceps', 'calf'],
  Upper: ['chest', 'back', 'shoulder', 'biceps', 'triceps'],
  Lower: ['quad', 'ham', 'glute', 'calf'],
  Push: ['chest', 'shoulder', 'triceps'],
  Pull: ['back', 'biceps'],
  Legs: ['quad', 'ham', 'glute', 'calf'],
}
const RECOMMENDED: Record<number, string[]> = {
  2: ['Hét', 'Csü'], 3: ['Hét', 'Sze', 'Pén'], 4: ['Hét', 'Sze', 'Pén', 'Szo'],
  5: ['Hét', 'Kedd', 'Sze', 'Pén', 'Szo'], 6: ['Hét', 'Kedd', 'Sze', 'Pén', 'Szo', 'Vas'],
}

const clampN = (n: number) => Math.min(6, Math.max(2, n))
const dayIdx = (d: string) => DAY_ORDER.indexOf(d as (typeof DAY_ORDER)[number])

export function recommendedDays(n: number): string[] { return [...RECOMMENDED[clampN(n)]] }

export function splitLine(days: string[]): string {
  const n = clampN(days.length)
  return `${days.length} nap → ${SPLIT_LABELS[n]} · minden izom 2×/hét`
}

export function weekOneSets(tier: MuscleTier, lm: Landmark): number {
  return tier === 'emphasize' ? Math.min(lm.mev + 2, lm.mrv) : lm.mev
}
export function ceilingSets(tier: MuscleTier, lm: Landmark): number {
  return tier === 'emphasize' ? lm.mrv : tier === 'grow' ? lm.mav : lm.mev
}

function landmarkOf(group: string, landmarks?: Record<string, Landmark>): Landmark | null {
  return landmarks?.[group] ?? GROUP_LANDMARKS[group] ?? null
}

export function dayFrames(days: string[], priorities: MusclePriorities | null, landmarks?: Record<string, Landmark>): DayFrame[] {
  const training = [...days].sort((a, b) => dayIdx(a) - dayIdx(b))
  const types = SPLIT_TYPES[clampN(training.length)]
  const freq = new Map<string, number>()
  types.forEach((t) => TYPE_GROUPS[t as Exclude<DayType, 'Rest'>].forEach((g) => { if (landmarkOf(g, landmarks)) freq.set(g, (freq.get(g) ?? 0) + 1) }))
  const handed = new Map<string, number>()
  return DAY_ORDER.map((day) => {
    const i = training.indexOf(day)
    if (i < 0) return { day, type: 'Rest' as const, muscles: [] }
    const type = types[i]
    const muscles: MuscleFrame[] = []
    for (const g of TYPE_GROUPS[type as Exclude<DayType, 'Rest'>]) {
      const lm = landmarkOf(g, landmarks)
      if (!lm) continue
      const total = weekOneSets(tierOf(priorities, g), lm)
      const f = freq.get(g) ?? 1
      const done = handed.get(g) ?? 0
      const sets = Math.floor(total / f) + (done < total % f ? 1 : 0)
      handed.set(g, done + 1)
      if (sets > 0) muscles.push({ group: g, sets })
    }
    return { day, type, muscles }
  })
}

export function weekTotals(priorities: MusclePriorities | null, landmarks?: Record<string, Landmark>): { weekOne: number; peak: number } {
  let weekOne = 0
  let peak = 0
  for (const g of TIER_GROUPS) {
    const lm = landmarkOf(g, landmarks)
    if (!lm) continue
    const tier = tierOf(priorities, g)
    weekOne += weekOneSets(tier, lm)
    peak += ceilingSets(tier, lm)
  }
  return { weekOne, peak }
}

export function frequencyOf(frames: DayFrame[], group: string): number {
  return frames.filter((f) => f.muscles.some((m) => m.group === group)).length
}
