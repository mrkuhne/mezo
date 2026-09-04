import { apiFetch } from '@/data/_client/api'
import type { paths } from '@/data/_client/api.gen'
import type { AdviceActionKey } from '@/data/types'

type ApplyRequest =
  paths['/api/proactive/advice/{id}/apply']['post']['requestBody']['content']['application/json']
type ApplyResponse =
  paths['/api/proactive/advice/{id}/apply']['post']['responses']['200']['content']['application/json']

export const adviceApi = {
  /** Applies one advice card's offered action (S5, mezo-d58h.5). Idempotent server-side —
   *  re-applying the SAME action is a no-op returning the card's original `applied` stamp. */
  apply: (id: string, actionKey: AdviceActionKey) =>
    apiFetch<ApplyResponse>(`/api/proactive/advice/${id}/apply`, {
      method: 'POST',
      body: JSON.stringify({ actionKey } satisfies ApplyRequest),
    }),
}
