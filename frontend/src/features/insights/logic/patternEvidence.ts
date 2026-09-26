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

const CLOCK_STEPS = [0.5, 1, 2, 3, 6]

function niceSteps(span: number): number[] {
  const magnitude = span > 0 ? 10 ** Math.floor(Math.log10(span)) : 1
  return [0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10].map((factor) => factor * magnitude)
}

/** Round axis: bounds snap outward to a readable step (whole/half hours for clock data, 1-2-2.5-5
 *  multiples otherwise) with at most `tickCount` ticks, so points and the trend line never fall
 *  outside the labelled range and the plot uses the width it has. */
export function evidenceAxis(values: number[], kind: PatternMetricValueKind, tickCount = 3): EvidenceAxis {
  if (values.length === 0) return { min: 0, max: 1, ticks: [0, 0.5, 1] }
  const observedMin = Math.min(...values)
  const observedMax = Math.max(...values)
  const span = observedMax - observedMin
  // A single repeated value gets a whole-unit band instead of a hair-thin 0.1 one.
  const steps = kind === 'clock_hour' ? CLOCK_STEPS : niceSteps(span).filter((step) => span > 0 || step >= 1)
  const intervals = Math.max(1, tickCount - 1)
  const fits = (step: number) =>
    Math.ceil(observedMax / step - 1e-9) - Math.floor(observedMin / step + 1e-9) <= intervals
  const step = steps.find(fits) ?? steps[steps.length - 1]
  const min = Math.floor(observedMin / step + 1e-9) * step
  let max = Math.ceil(observedMax / step - 1e-9) * step
  if (max === min) max = min + step
  const ticks: number[] = []
  for (let value = min; value <= max + 1e-9; value += step) ticks.push(Math.round(value * 1e6) / 1e6)
  return { min, max, ticks }
}

/** The part of the line y = slope·x + intercept that stays inside the plot box, or null. */
export function clipLine(
  fit: { slope: number; intercept: number },
  x: { min: number; max: number },
  y: { min: number; max: number },
): { x1: number; y1: number; x2: number; y2: number } | null {
  let lo = x.min
  let hi = x.max
  if (fit.slope !== 0) {
    const atMin = (y.min - fit.intercept) / fit.slope
    const atMax = (y.max - fit.intercept) / fit.slope
    lo = Math.max(lo, Math.min(atMin, atMax))
    hi = Math.min(hi, Math.max(atMin, atMax))
  } else if (fit.intercept < y.min || fit.intercept > y.max) {
    return null
  }
  if (hi <= lo) return null
  return { x1: lo, y1: fit.slope * lo + fit.intercept, x2: hi, y2: fit.slope * hi + fit.intercept }
}
