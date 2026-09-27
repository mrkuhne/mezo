import { apiFetch } from '@/data/_client/api'
import type { components } from '@/data/_client/api.gen'

export type ReadinessTodayResponse = components['schemas']['ReadinessTodayResponse']
export type ReadinessChoiceRequest = components['schemas']['ReadinessChoiceRequest']
export type ReadinessChoice = ReadinessChoiceRequest['choice']

const PATH = '/api/train/readiness/today'

/**
 * Check-in 2.0 training readiness (mezo-ck2) — the Edzés today card. GET is a pure read of this
 * morning's check-in against today's gym plan; POST stores the day's choice (LIGHTEN / KEEP);
 * DELETE undoes it. Every call answers with the fresh readiness.
 */
export const readinessApi = {
  today: (): Promise<ReadinessTodayResponse> => apiFetch<ReadinessTodayResponse>(PATH),
  choose: (choice: ReadinessChoice): Promise<ReadinessTodayResponse> =>
    apiFetch<ReadinessTodayResponse>(PATH, {
      method: 'POST',
      body: JSON.stringify({ choice } satisfies ReadinessChoiceRequest),
    }),
  undo: (): Promise<ReadinessTodayResponse> => apiFetch<ReadinessTodayResponse>(PATH, { method: 'DELETE' }),
}
