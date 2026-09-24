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
export type ConferenceThread = components['schemas']['ConferenceThread']
export type ConferenceItem = components['schemas']['ConferenceItem']
export type ConferencePeerReaction = components['schemas']['ConferencePeerReaction']
export type ConferenceOutcomeCounts = components['schemas']['ConferenceOutcomeCounts']
export type CharacterRunSummary = components['schemas']['CharacterRunSummary']
export type CharacterRunObservationSignal = components['schemas']['CharacterRunObservationSignal']
export type CharacterRunObservation = components['schemas']['CharacterRunObservation']
export type CharacterRunResponse = components['schemas']['CharacterRunResponse']
export type TeamEdition = components['schemas']['TeamEdition']
export type TeamEditionPost = components['schemas']['TeamEditionPost']
export type CharacterCouncilStatusResponse = components['schemas']['CharacterCouncilStatusResponse']
export type CharacterClaimRevisionDto = components['schemas']['CharacterClaimRevisionDto']

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

export type CharacterReplyResponse = components['schemas']['CharacterReplyResponse']
export type CharacterReplyCreateRequest = components['schemas']['CharacterReplyCreateRequest']
export type CharacterReplySource = Pick<CharacterReplyCreateRequest, 'sourceType' | 'sourceId' | 'sourceIndex'>

const BASE = '/api/character'

export const characterApi = {
  councilStatus: (): Promise<CharacterCouncilStatusResponse> => apiFetch(`${BASE}/council`),
  claimRevisions: (claimId: string): Promise<CharacterClaimRevisionDto[]> => apiFetch(`${BASE}/claims/${encodeURIComponent(claimId)}/revisions`),
  undoRevision: (id: string): Promise<CharacterClaimRevisionDto> => apiFetch(`${BASE}/revisions/${encodeURIComponent(id)}/undo`, { method: 'POST' }),
  replies: (source: CharacterReplySource): Promise<CharacterReplyResponse[]> => apiFetch(`${BASE}/replies?${new URLSearchParams({ sourceType: source.sourceType, sourceId: source.sourceId, sourceIndex: String(source.sourceIndex) })}`),
  reply: (body: CharacterReplyCreateRequest): Promise<CharacterReplyResponse> => apiFetch(`${BASE}/replies`, { method: 'POST', body: JSON.stringify(body satisfies CharacterReplyCreateRequest) }),
  retryReply: (id: string): Promise<CharacterReplyResponse> => apiFetch(`${BASE}/replies/${id}/retry`, { method: 'POST' }),
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
  // Esti kiadás timeline (csapatfal H1, mezo-a9bo7.12) — mirrors `runs`, both `from`/`to` required.
  editions: (fromIso: string, toIso: string): Promise<TeamEdition[]> =>
    apiFetch<TeamEdition[]>(`${BASE}/edition?from=${fromIso}&to=${toIso}`),
}
