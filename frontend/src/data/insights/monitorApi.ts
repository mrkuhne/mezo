import { apiFetch } from '@/data/_client/api'
import type { components } from '@/data/_client/api.gen'
import type {
  MetricDomain,
  PatternCategory,
  PatternGateVerdict,
  PatternMetricCoverage,
  PatternMonitor,
  PatternMonitorPair,
} from '@/data/types'

export type PatternMonitorResponse = components['schemas']['PatternMonitorResponse']
type PairWire = components['schemas']['PatternMonitorPair']
type MetricWire = components['schemas']['PatternMetricCoverage']

const MONITOR = '/api/companion/pattern/monitor'

/** Wire → FE domain: a hiányzó opcionális mezők egységesen `null`-ra normalizálódnak. */
function toPair(w: PairWire): PatternMonitorPair {
  return {
    key: w.key,
    title: w.title,
    // a wire stringek a saját backendünk CHECK/pattern kényszereiből jönnek
    category: w.category as PatternCategory,
    categoryLabel: w.categoryLabel,
    lagDays: w.lagDays,
    metricAKey: w.metricAKey,
    metricALabel: w.metricALabel,
    metricBKey: w.metricBKey,
    metricBLabel: w.metricBLabel,
    mechanismHu: w.mechanismHu,
    metricADomain: w.metricADomain as MetricDomain,
    metricBDomain: w.metricBDomain as MetricDomain,
    verdict: w.verdict as PatternGateVerdict,
    alignedDays: w.alignedDays,
    missingDays: w.missingDays ?? null,
    bottleneckMetricKey: w.bottleneckMetricKey ?? null,
    r: w.r ?? null,
    n: w.n ?? null,
    p: w.p ?? null,
    status: (w.status ?? null) as PatternMonitorPair['status'],
  }
}

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
    pairs: w.pairs.map(toPair),
    metrics: w.metrics.map(toMetric),
  }
}

export const monitorApi = {
  get: async () => toMonitor(await apiFetch<PatternMonitorResponse>(MONITOR)),
}
