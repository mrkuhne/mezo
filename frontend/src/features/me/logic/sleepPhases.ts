import type { SleepEntry } from '@/data/types'

/** The alphabet of a quantised hypnogram (mezo-fk9a): D=mély, L=könnyű, R=REM, A=éber. */
export type Stage = 'D' | 'L' | 'R' | 'A'

export interface PhaseBreakdown {
  deep: number
  light: number
  rem: number
  awake: number
  /** deep + light + rem — the denominator for every phase percentage. */
  asleep: number
  /** asleep + awake — the denominator for the rail's segment widths. */
  inBed: number
}

/** Adult reference ranges as a share of total sleep. Informational, never a grade (spec section 9). */
export const DEEP_REF = { lo: 13, hi: 23 } as const
export const REM_REF = { lo: 20, hi: 25 } as const

/** An average of two nights is a lie with a number attached. */
export const MIN_AVERAGE_NIGHTS = 3
/** Below this the front-load percentage is quantisation noise wearing a number's clothes. */
export const MIN_DEEP_BUCKETS = 4
/** Six nights all on one side of the line cannot support the claim. */
export const MIN_NIGHTS_PER_SIDE = 3
export const SHORT_NIGHT_H = 7

const STAGES: readonly Stage[] = ['D', 'L', 'R', 'A']

function make(deep: number, light: number, rem: number, awake: number): PhaseBreakdown {
  const asleep = deep + light + rem
  return { deep, light, rem, awake, asleep, inBed: asleep + awake }
}

/**
 * The night's phase composition, or null when the row cannot support one.
 * `asleep` is always the computed sum — never `entry.duration`, which is rounded hours
 * and would disagree with the minute totals.
 */
export function phaseBreakdown(entry: SleepEntry): PhaseBreakdown | null {
  const { deepMin, lightMin, remMin } = entry
  if (deepMin == null || lightMin == null || remMin == null) return null
  const b = make(deepMin, lightMin, remMin, entry.awakeMin ?? 0)
  return b.asleep > 0 ? b : null
}

/** Always denominated on total sleep — awake time is fragmentation, not a sleep stage. */
export function phasePct(b: PhaseBreakdown, key: 'deep' | 'light' | 'rem'): number {
  return (b[key] / b.asleep) * 100
}

export function averageBreakdown(
  entries: SleepEntry[],
  windowDays: number,
): { avg: PhaseBreakdown; nights: number } | null {
  const parts = entries
    .slice(-windowDays)
    .map(phaseBreakdown)
    .filter((b): b is PhaseBreakdown => b !== null)
  if (parts.length < MIN_AVERAGE_NIGHTS) return null
  const mean = (pick: (b: PhaseBreakdown) => number) =>
    Math.round(parts.reduce((sum, b) => sum + pick(b), 0) / parts.length)
  // Rebuilt through make() so the rounded parts always sum to the whole — otherwise the
  // rail's segments would not fill it.
  const avg = make(mean(b => b.deep), mean(b => b.light), mean(b => b.rem), mean(b => b.awake))
  return { avg, nights: parts.length }
}

/** All-or-nothing: a sequence with an unknown letter is a wrong picture, not a partial one. */
export function parseHypnogram(entry: SleepEntry): Stage[] | null {
  const stages = entry.hypnogram?.stages
  if (!stages) return null
  const chars = [...stages] as Stage[]
  return chars.length > 0 && chars.every(c => STAGES.includes(c)) ? chars : null
}

function countStages(stages: Stage[], bucketMin: number): PhaseBreakdown {
  const minutes = (s: Stage) => stages.filter(c => c === s).length * bucketMin
  return make(minutes('D'), minutes('L'), minutes('R'), minutes('A'))
}

/** Buckets are uniform, so an index split is a time split. Odd count: the middle joins the first. */
export function halfNightSplit(
  stages: Stage[],
  bucketMin: number,
): { first: PhaseBreakdown; second: PhaseBreakdown } {
  const mid = Math.ceil(stages.length / 2)
  return {
    first: countStages(stages.slice(0, mid), bucketMin),
    second: countStages(stages.slice(mid), bucketMin),
  }
}

/**
 * Share of deep buckets landing in the first half. A ratio between two halves of the same
 * noisy series, so the quantisation error largely cancels — which is why this is the one
 * statistic the hypnogram is allowed to produce (spec section 2).
 */
export function deepFrontLoadPct(stages: Stage[]): number | null {
  const total = stages.filter(c => c === 'D').length
  if (total < MIN_DEEP_BUCKETS) return null
  const mid = Math.ceil(stages.length / 2)
  const inFirst = stages.slice(0, mid).filter(c => c === 'D').length
  return Math.round((inFirst / total) * 100)
}

export function remByDuration(entries: SleepEntry[]): {
  shortAvg: number
  longAvg: number
  deltaMin: number
  shortNights: number
  longNights: number
} | null {
  const parts = entries
    .map(phaseBreakdown)
    .filter((b): b is PhaseBreakdown => b !== null)
  // Classified by the computed asleep sum, never by the rounded duration field.
  const short = parts.filter(b => b.asleep / 60 < SHORT_NIGHT_H)
  const long = parts.filter(b => b.asleep / 60 >= SHORT_NIGHT_H)
  if (short.length < MIN_NIGHTS_PER_SIDE || long.length < MIN_NIGHTS_PER_SIDE) return null
  const avgRem = (xs: PhaseBreakdown[]) => Math.round(xs.reduce((s, b) => s + b.rem, 0) / xs.length)
  const shortAvg = avgRem(short)
  const longAvg = avgRem(long)
  return {
    shortAvg, longAvg, deltaMin: longAvg - shortAvg,
    shortNights: short.length, longNights: long.length,
  }
}
