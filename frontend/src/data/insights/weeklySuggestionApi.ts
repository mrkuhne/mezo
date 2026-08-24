import { apiFetch } from '@/data/_client/api'
import type { paths } from '@/data/_client/api.gen'

type WeeklySuggestionWire =
  paths['/api/proactive/weekly-suggestion']['get']['responses']['200']['content']['application/json']

/** The card's slice of the wire: the prose it renders plus the row id it votes on. */
export interface WeeklySuggestion {
  /** The weekly_suggestion row id — the W4.1 feedback artifactId (mezo-b3pp.15). */
  id: string
  prose: string
}

export const weeklySuggestionApi = {
  /** The generated plan suggestion for the week containing the FE's local day. */
  get: (date: string): Promise<WeeklySuggestion> =>
    apiFetch<WeeklySuggestionWire>(`/api/proactive/weekly-suggestion?date=${date}`)
      .then((w) => ({ id: w.id, prose: w.prose })),
}
