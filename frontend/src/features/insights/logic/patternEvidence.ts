import type { AlignedDay, PatternMetricValueKind } from '@/data/types'

export interface GroupSummary {
  count: number
  values: number[]
  min: number | null
  max: number | null
  median: number | null
}

export interface EvidenceAxis {
  min: number
  max: number
  ticks: number[]
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2
}

function summarize(values: number[], requiredPerGroup: number): GroupSummary {
  return {
    count: values.length,
    values,
    min: values.length === 0 ? null : Math.min(...values),
    max: values.length === 0 ? null : Math.max(...values),
    median: values.length < requiredPerGroup ? null : median(values),
  }
}

/** Two-group evidence derived only from the aligned-day payload. */
export function groupedEvidence(days: AlignedDay[], requiredPerGroup: number) {
  const zero = days.filter((day) => day.a < 0.5).map((day) => day.b)
  const one = days.filter((day) => day.a >= 0.5).map((day) => day.b)
  const latest = days.length === 0
    ? null
    : days.reduce((current, day) => day.date > current.date ? day : current, days[0])
  return { zero: summarize(zero, requiredPerGroup), one: summarize(one, requiredPerGroup), latest }
}

/** Readable min/mid/max ticks; clock data expands to whole-hour bounds and useful six-hour guides. */
export function evidenceAxis(values: number[], kind: PatternMetricValueKind, tickCount = 3): EvidenceAxis {
  if (values.length === 0) return { min: 0, max: 1, ticks: [0, 0.5, 1] }
  const observedMin = Math.min(...values)
  const observedMax = Math.max(...values)
  if (kind === 'clock_hour') {
    const min = Math.floor(observedMin)
    const max = Math.ceil(observedMax)
    const ticks = [max]
    for (let value = max - 6; value > min && ticks.length < tickCount; value -= 6) ticks.push(value)
    if (!ticks.includes(min)) ticks.push(min)
    return { min, max: max === min ? min + 1 : max, ticks }
  }
  const min = observedMin
  const max = observedMax === observedMin ? observedMin + 1 : observedMax
  return {
    min,
    max,
    ticks: Array.from({ length: tickCount }, (_, index) => min + ((max - min) * index) / (tickCount - 1)),
  }
}
