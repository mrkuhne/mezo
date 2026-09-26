import { apiFetch } from '@/data/_client/api'
import type { components } from '@/data/_client/api.gen'
import type { PersonEffect } from '@/data/types'

export type PersonEffectsResponse = components['schemas']['PersonEffectsResponse']
export type EffectResponse = components['schemas']['EffectResponse']

const EFFECTS = '/api/companion/effects'

/** Wire → FE domain (S4, mezo-d6ivw.4): strengthBand→strength, confidenceTier→confidence. */
export function toPersonEffect(e: EffectResponse): PersonEffect {
  return {
    metric: e.metric,
    direction: e.direction,
    strength: e.strengthBand,
    confidence: e.confidenceTier,
    meanDiff: e.meanDiff,
    subjectDays: e.subjectDays,
  }
}

export const personEffectsApi = {
  getForPerson: (personId: string) =>
    apiFetch<PersonEffectsResponse>(`${EFFECTS}?personId=${encodeURIComponent(personId)}`),
}
