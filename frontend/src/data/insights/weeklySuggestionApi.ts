import { apiFetch } from '@/data/_client/api'
import type { paths } from '@/data/_client/api.gen'

type WeeklySuggestionWire =
  paths['/api/proactive/weekly-suggestion']['get']['responses']['200']['content']['application/json']

export const weeklySuggestionApi = {
  /** The generated plan-suggestion prose for the week containing the FE's local day. */
  get: (date: string) =>
    apiFetch<WeeklySuggestionWire>(`/api/proactive/weekly-suggestion?date=${date}`).then((w) => w.prose),
}
