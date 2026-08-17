import { apiFetch } from '@/data/_client/api'
import type { components } from '@/data/_client/api.gen'
import { toPattern } from '@/data/insights/patternsApi'
import type {
  AlignedDay,
  MetricDomain,
  PatternCategory,
  PatternEvent,
  PatternEventKind,
  PatternGateVerdict,
  PatternImpact,
  PatternMonitorPair,
  PatternPairDetail,
} from '@/data/types'

export type PatternPairDetailResponse = components['schemas']['PatternPairDetailResponse']
type PairWire = components['schemas']['PatternMonitorPair']
type EventWire = components['schemas']['PatternEventResponse']
type DayWire = components['schemas']['AlignedDayResponse']
type ImpactWire = components['schemas']['PatternImpactResponse']

const PATTERN_PAIR = '/api/companion/pattern/pair'

/** Wire → FE domain: mirrors monitorApi's toPair — hiányzó opcionális mezők egységesen `null`-ra normalizálódnak. */
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
    r: w.r ?? null,
    n: w.n ?? null,
    p: w.p ?? null,
    status: (w.status ?? null) as PatternMonitorPair['status'],
  }
}

function toEvent(w: EventWire): PatternEvent {
  return {
    kind: w.kind as PatternEventKind,
    occurredAt: w.occurredAt,
    r: w.r ?? undefined,
    n: w.n ?? undefined,
    p: w.p ?? undefined,
    reinforcementCount: w.reinforcementCount ?? undefined,
    factId: w.factId ?? undefined,
  }
}

function toDay(w: DayWire): AlignedDay {
  return { date: w.date, a: w.a, b: w.b }
}

function toImpact(w: ImpactWire): PatternImpact {
  return {
    fact: w.fact
      ? {
          id: w.fact.id,
          text: w.fact.text,
          reinforcementCount: w.fact.reinforcementCount,
          includeInPrompt: w.fact.includeInPrompt,
        }
      : null,
    predictions: w.predictions.map((r) => ({ id: r.id, title: r.title, status: r.status })),
    experiments: w.experiments.map((r) => ({ id: r.id, title: r.title, status: r.status })),
    challenges: w.challenges.map((r) => ({ id: r.id, title: r.title, status: r.status })),
  }
}

/** Wire → FE domain — a pár-meta, az élő kapu-állapot, a perzisztált minta (ha van), az
 *  append-only esemény-történet, az illesztett napok és a hatás-lista egy híváson belül. */
function toDetail(w: PatternPairDetailResponse): PatternPairDetail {
  return {
    pair: toPair(w.pair),
    pattern: w.pattern ? toPattern(w.pattern) : null,
    events: w.events.map(toEvent),
    days: w.days.map(toDay),
    impact: toImpact(w.impact),
  }
}

export const patternDetailApi = {
  get: async (pairKey: string) =>
    toDetail(await apiFetch<PatternPairDetailResponse>(`${PATTERN_PAIR}/${encodeURIComponent(pairKey)}`)),
}
