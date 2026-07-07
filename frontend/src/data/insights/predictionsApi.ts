import { apiFetch } from '@/data/_client/api'
import type { paths } from '@/data/_client/api.gen'
import type { Prediction, PredictionStatus } from '@/data/types'

type PredictionWire =
  paths['/api/proactive/prediction']['get']['responses']['200']['content']['application/json'][number]

const HU_SHORT = new Intl.DateTimeFormat('hu-HU', { month: 'short', day: 'numeric' })

/** „júl. 7. – júl. 13." — the validity window as a compact HU label (the `date` display field). */
function formatWindow(validFrom: string, validTo: string): string {
  const from = HU_SHORT.format(new Date(validFrom + 'T00:00:00'))
  const to = HU_SHORT.format(new Date(validTo + 'T00:00:00'))
  return `${from} – ${to}`
}

/** Wire → FE Prediction: confidence stays nullable („tanulom"), the window becomes the date label. */
export function toPrediction(wire: PredictionWire): Prediction {
  return {
    id: wire.id,
    title: wire.title,
    confidence: wire.confidence ?? null,
    status: wire.status as PredictionStatus,
    date: formatWindow(wire.validFrom, wire.validTo),
    basis: wire.basis,
    actual: wire.actual ?? undefined,
  }
}

export const predictionsApi = {
  list: () =>
    apiFetch<PredictionWire[]>('/api/proactive/prediction').then((rows) => rows.map(toPrediction)),
}
