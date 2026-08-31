import { apiFetch } from '@/data/_client/api'
import type { components } from '@/data/_client/api.gen'

// Contract types generated from api/openapi.yml — regenerate with `pnpm generate:api`.
export type CharacterOverviewResponse = components['schemas']['CharacterOverviewResponse']
export type CharacterDimensionSummary = components['schemas']['CharacterDimensionSummary']
export type CharacterDimensionResponse = components['schemas']['CharacterDimensionResponse']
export type CharacterClaimDto = components['schemas']['CharacterClaimDto']
export type CharacterClaimFeedbackRequest = components['schemas']['CharacterClaimFeedbackRequest']
export type CharacterExpertDto = components['schemas']['CharacterExpertDto']
export type CharacterExpertsResponse = components['schemas']['CharacterExpertsResponse']
export type CharacterFeedItem = components['schemas']['CharacterFeedItem']
export type CharacterConferenceSummary = components['schemas']['CharacterConferenceSummary']
export type CharacterConferenceResponse = components['schemas']['CharacterConferenceResponse']
export type ConferenceTurn = components['schemas']['ConferenceTurn']
export type CharacterRunSummary = components['schemas']['CharacterRunSummary']
export type CharacterRunObservationSignal = components['schemas']['CharacterRunObservationSignal']
export type CharacterRunObservation = components['schemas']['CharacterRunObservation']
export type CharacterRunResponse = components['schemas']['CharacterRunResponse']

/**
 * The one shared confidence -> human-word mapping, mirrored 1:1 from the backend's
 * `CharacterConfidenceWords` (backend/src/main/java/io/mrkuhne/mezo/feature/character/service/
 * CharacterConfidenceWords.java) — confidence is NEVER surfaced as a raw number in the UI, only
 * as one of these three Hungarian words (Minták precedent).
 */
export function confidenceWord(confidence: number): 'biztos' | 'valószínű' | 'figyeljük' {
  if (confidence >= 0.75) return 'biztos'
  if (confidence >= 0.5) return 'valószínű'
  return 'figyeljük'
}

const BASE = '/api/character'

export const characterApi = {
  overview: (): Promise<CharacterOverviewResponse> => apiFetch<CharacterOverviewResponse>(BASE),
  dimension: (key: string): Promise<CharacterDimensionResponse> =>
    apiFetch<CharacterDimensionResponse>(`${BASE}/dimension/${key}`),
  experts: (): Promise<CharacterExpertsResponse> => apiFetch<CharacterExpertsResponse>(`${BASE}/experts`),
  feed: (limit?: number): Promise<CharacterFeedItem[]> =>
    apiFetch<CharacterFeedItem[]>(`${BASE}/feed${limit != null ? `?limit=${limit}` : ''}`),
  // 200 -> the bootstrap conference; 204 -> apiFetch resolves `undefined` (its documented
  // no-content idiom); 409 -> apiFetch throws ApiError(status 409), which the hook catches and
  // maps to 'conflict'. See characterHooks.useCharacterBootstrap.
  bootstrap: (): Promise<CharacterConferenceResponse | undefined> =>
    apiFetch<CharacterConferenceResponse | undefined>(`${BASE}/bootstrap`, { method: 'POST' }),
  conferences: (): Promise<CharacterConferenceSummary[]> =>
    apiFetch<CharacterConferenceSummary[]>(`${BASE}/conference`),
  conference: (id: string): Promise<CharacterConferenceResponse> =>
    apiFetch<CharacterConferenceResponse>(`${BASE}/conference/${id}`),
  submitClaimFeedback: (claimId: string, body: CharacterClaimFeedbackRequest): Promise<CharacterClaimDto> =>
    apiFetch<CharacterClaimDto>(`${BASE}/claim/${claimId}/feedback`, {
      method: 'POST',
      body: JSON.stringify(body satisfies CharacterClaimFeedbackRequest),
    }),
  // Gépterem (mezo-1gim.14): the run-log timeline. `from`/`to` are both required ISO dates.
  runs: (fromIso: string, toIso: string): Promise<CharacterRunSummary[]> =>
    apiFetch<CharacterRunSummary[]>(`${BASE}/runs?from=${fromIso}&to=${toIso}`),
  run: (id: string): Promise<CharacterRunResponse> => apiFetch<CharacterRunResponse>(`${BASE}/run/${id}`),
}
