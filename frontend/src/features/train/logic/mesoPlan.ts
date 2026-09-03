// ============================================================
// Mezo · mesoPlan — the FE mirror of the backend MesoPlanSkeleton (mesocycle wizard
// redesign). Pure. Gives the wizard its live numbers before the generator answers
// (split line, week-1/peak totals, per-day frames for the day mosaic) and the mock-mode
// proposal its frames. Same tables as backend/…/MesoPlanSkeleton.java — change both.
// (`splitLine` is the one exception: FE coach copy, no backend counterpart.)
// ============================================================
import { DAY_ORDER } from '@/data/train/train'
import type { MesoPhase, MusclePriorities, MuscleTier } from '@/data/types'
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

/**
 * FE-only coach copy (no backend twin — MesoPlanSkeleton emits no such line). The count is
 * the CLAMPED one everywhere in the sentence, so an out-of-range pick can't advertise a split
 * it isn't getting. The frequency is the truth of the split table, not a slogan: a full-body
 * week hits every muscle on every training day (2 nap → 2×, 3 nap → 3×), while every 4+ day
 * split (Upper/Lower, U/L+PPL, PPL×2) lands each group exactly twice.
 */
export function splitLine(days: string[]): string {
  const n = clampN(days.length)
  return `${n} nap → ${SPLIT_LABELS[n]} · minden izom ${n <= 3 ? n : 2}×/hét`
}

/**
 * The block's weekly phase curve, derived from its LENGTH alone — mirror of the backend's
 * MesoPlanSkeleton.phaseCurve (change both): ramp = weeks - 1, the first 1-2 ramp weeks are
 * MEV (2 once the ramp is 4+ weeks long), the last ramp week is MRV, everything between is
 * MAV, and the block always closes on a Deload week.
 */
export function phaseCurve(weeks: number): MesoPhase[] {
  const ramp = Math.max(1, weeks - 1)
  const mevWeeks = ramp >= 4 ? 2 : 1
  const out: MesoPhase[] = []
  for (let i = 0; i < ramp; i++) out.push(i === ramp - 1 && ramp > 1 ? 'MRV' : i < mevWeeks ? 'MEV' : 'MAV')
  out.push('Deload')
  return out
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

/**
 * A template/run predates the wizard v2 band model when it was EXPLICITLY stamped with a
 * goal preset other than the current one, OR its phase curve carries no closing Deload week
 * (an older/custom curve shape the band math was not written against). Either flag alone is
 * enough — the band language (current → ceiling · tier) only applies cleanly to plans
 * generated the current way, so a legacy plan gets a visible note instead of silently
 * mislabeled bands.
 *
 * An ABSENT goalPreset (null/undefined) is NOT itself legacy — plenty of pre-wizard-v2 mock
 * fixtures simply never had the field populated, and a Deload-terminated curve is already
 * strong evidence the plan was generated the current way. Only a preset that is PRESENT and
 * WRONG disqualifies a plan on that axis.
 */
export function isLegacyPlan(plan: { goalPreset?: string | null; phaseCurve: MesoPhase[] }): boolean {
  return (plan.goalPreset != null && plan.goalPreset !== 'hypertrophy') || !plan.phaseCurve.includes('Deload')
}
