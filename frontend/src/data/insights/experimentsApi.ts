import { apiFetch } from '@/data/_client/api'
import type { paths } from '@/data/_client/api.gen'
import type { Experiment, ExperimentStatus } from '@/data/types'

type ExperimentWire =
  paths['/api/proactive/experiment']['get']['responses']['200']['content']['application/json'][number]
type DecisionRequest =
  paths['/api/proactive/experiment/{id}/decision']['post']['requestBody']['content']['application/json']

/** Day counter derived client-side: proposed → 0; active → elapsed (clamped to total); completed → total. */
function dayOf(wire: ExperimentWire): number {
  if (wire.status === 'completed') return wire.totalDays
  if (wire.status !== 'active' || !wire.startDate) return 0
  const start = new Date(wire.startDate + 'T00:00:00')
  const elapsed = Math.floor((Date.now() - start.getTime()) / 86_400_000) + 1
  return Math.max(0, Math.min(wire.totalDays, elapsed))
}

/** Wire → FE Experiment: the day counter derives client-side; outcomeGood null → undefined. */
export function toExperiment(wire: ExperimentWire): Experiment {
  return {
    id: wire.id,
    title: wire.title,
    status: wire.status as ExperimentStatus,
    day: dayOf(wire),
    total: wire.totalDays,
    hypothesis: wire.hypothesis,
    outcome: wire.outcome ?? undefined,
    outcomeGood: wire.outcomeGood ?? undefined,
  }
}

export const experimentsApi = {
  list: () =>
    apiFetch<ExperimentWire[]>('/api/proactive/experiment').then((rows) => rows.map(toExperiment)),
  decide: (id: string, decision: 'accept' | 'dismiss') =>
    apiFetch<ExperimentWire>(`/api/proactive/experiment/${id}/decision`, {
      method: 'POST',
      body: JSON.stringify({ decision } satisfies DecisionRequest),
    }).then(toExperiment),
  propose: () =>
    apiFetch<ExperimentWire[]>('/api/proactive/experiment/propose', { method: 'POST' })
      .then((rows) => rows.map(toExperiment)),
}
