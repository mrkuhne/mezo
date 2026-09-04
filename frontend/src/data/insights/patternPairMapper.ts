import type { components } from '@/data/_client/api.gen'
import type {
  MetricDomain,
  PatternCategory,
  PatternGateVerdict,
  PatternMetricValueKind,
  PatternMonitorPair,
} from '@/data/types'

type PairWire = components['schemas']['PatternMonitorPair']

/** Wire → FE domain: every optional boundary value has one stable nullable representation. */
export function toPatternMonitorPair(w: PairWire): PatternMonitorPair {
  return {
    key: w.key,
    title: w.title,
    category: w.category as PatternCategory,
    categoryLabel: w.categoryLabel,
    lagDays: w.lagDays,
    metricAKey: w.metricAKey,
    metricALabel: w.metricALabel,
    metricAValueKind: w.metricAValueKind as PatternMetricValueKind,
    metricBKey: w.metricBKey,
    metricBLabel: w.metricBLabel,
    metricBValueKind: w.metricBValueKind as PatternMetricValueKind,
    mechanismHu: w.mechanismHu,
    questionHu: w.questionHu,
    expectedDirection: w.expectedDirection as PatternMonitorPair['expectedDirection'],
    whenPositiveHu: w.whenPositiveHu,
    whenNegativeHu: w.whenNegativeHu,
    metricADomain: w.metricADomain as MetricDomain,
    metricBDomain: w.metricBDomain as MetricDomain,
    verdict: w.verdict as PatternGateVerdict,
    alignedDays: w.alignedDays,
    missingDays: w.missingDays ?? null,
    bottleneckMetricKey: w.bottleneckMetricKey ?? null,
    groupZeroDays: w.groupZeroDays ?? null,
    groupOneDays: w.groupOneDays ?? null,
    requiredPerGroup: w.requiredPerGroup ?? null,
    r: w.r ?? null,
    n: w.n ?? null,
    p: w.p ?? null,
    status: (w.status ?? null) as PatternMonitorPair['status'],
  }
}
