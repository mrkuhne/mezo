import { apiFetch } from '@/data/_client/api'
import type { paths } from '@/data/_client/api.gen'
import type { CoachingRule, CoachingTraceDay, CoachingTransition } from '@/data/types'

type TraceWire =
  paths['/api/companion/flags/trace']['get']['responses']['200']['content']['application/json']

/** Wire → FE. The generated schema spells "not present" as `null` (OpenAPI's nullable), the FE
 *  interface as `undefined` (optional) — everything else is a straight structural pass-through:
 *  every user-facing string (label, domain, reasonText, facts) is already rendered by the server,
 *  which is the point of the endpoint. */
export function toCoachingTraceDay(wire: TraceWire): CoachingTraceDay {
  return {
    date: wire.date,
    earliestDate: wire.earliestDate ?? undefined,
    winner: wire.winner
      ? { flagKey: wire.winner.flagKey, rank: wire.winner.rank, cardId: wire.winner.cardId }
      : undefined,
    rules: wire.rules.map(
      (r): CoachingRule => ({
        flagKey: r.flagKey,
        label: r.label,
        domain: r.domain,
        rank: r.rank,
        outcome: r.outcome,
        reasonCode: r.reasonCode ?? undefined,
        reasonText: r.reasonText,
        facts: r.facts,
        disposition: r.disposition ?? undefined,
        cardOutcome: r.cardOutcome ?? undefined,
        changedAt: r.changedAt ?? undefined,
      }),
    ),
    transitions: wire.transitions.map(
      (t): CoachingTransition => ({
        at: t.at,
        flagKey: t.flagKey,
        label: t.label,
        from: t.from ?? undefined,
        to: t.to,
        reasonText: t.reasonText,
      }),
    ),
  }
}

export const coachingTraceApi = {
  get: (date: string) =>
    apiFetch<TraceWire>(`/api/companion/flags/trace?date=${date}`).then(toCoachingTraceDay),
}
