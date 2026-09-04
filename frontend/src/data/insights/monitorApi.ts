import { apiFetch } from '@/data/_client/api'
import type { components } from '@/data/_client/api.gen'
import { toPatternMonitorPair } from '@/data/insights/patternPairMapper'
import type {
  MetricDomain,
  PatternMetricCoverage,
  PatternMonitor,
} from '@/data/types'

export type PatternMonitorResponse = components['schemas']['PatternMonitorResponse']
type MetricWire = components['schemas']['PatternMetricCoverage']

const MONITOR = '/api/companion/pattern/monitor'

function toMetric(w: MetricWire): PatternMetricCoverage {
  return {
    key: w.key,
    label: w.label,
    sourceHu: w.sourceHu,
    domain: w.domain as MetricDomain,
    coveredDays: w.coveredDays,
    windowDays: w.windowDays,
    lastDayWithData: w.lastDayWithData ?? null,
    pairCount: w.pairCount,
  }
}

export function toMonitor(w: PatternMonitorResponse): PatternMonitor {
  return {
    windowFrom: w.windowFrom,
    windowTo: w.windowTo,
    lookbackDays: w.lookbackDays,
    minN: w.minN,
    cron: w.cron,
    lastRunAt: w.lastRunAt ?? null,
    pairs: w.pairs.map(toPatternMonitorPair),
    metrics: w.metrics.map(toMetric),
  }
}

export const monitorApi = {
  get: async () => toMonitor(await apiFetch<PatternMonitorResponse>(MONITOR)),
}
