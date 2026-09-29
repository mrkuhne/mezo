import { apiFetch } from '@/data/_client/api'
import type { components } from '@/data/_client/api.gen'

// Contract types generated from api/openapi.yml — regenerate with `pnpm generate:api`.
export type PlannedSkipResponse = components['schemas']['PlannedSkipResponse']
export type PlannedSkipRequest = components['schemas']['PlannedSkipRequest']
export type PlannedSkipKindResponse = components['schemas']['PlannedSkipKind']
export type PlannedSkipReasonResponse = components['schemas']['PlannedSkipReason']

const PATH = '/api/train/skips'

/**
 * Planned skips (Kihagyás S1, mezo-q4xt2.1) — one-tap skip of a planned gym/sport/run occurrence,
 * with an optional reason. GET reads the skip window (`plannedSkips.ts`'s `skipWindow`); PUT
 * upserts one skip (same target = same row, per the backend's own upsert-by-identity); DELETE
 * undoes it.
 */
export const skipApi = {
  list: (from: string, to: string): Promise<PlannedSkipResponse[]> =>
    apiFetch<PlannedSkipResponse[]>(`${PATH}?from=${from}&to=${to}`),
  upsert: (req: PlannedSkipRequest): Promise<PlannedSkipResponse> =>
    apiFetch<PlannedSkipResponse>(PATH, { method: 'PUT', body: JSON.stringify(req) }),
  undo: (id: string): Promise<void> => apiFetch<void>(`${PATH}/${id}`, { method: 'DELETE' }),
}
