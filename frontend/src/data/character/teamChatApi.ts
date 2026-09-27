import { apiFetch } from '@/data/_client/api'
import type { components } from '@/data/_client/api.gen'

// Contract types generated from api/openapi.yml — regenerate with `pnpm generate:api`.
export type TeamChatDay = components['schemas']['TeamChatDay']
export type TeamChatLine = components['schemas']['TeamChatLine']
export type TeamChatThread = components['schemas']['TeamChatThread']
export type TeamChatAction = components['schemas']['TeamChatAction']
export type TeamChatReplyRequest = components['schemas']['TeamChatReplyRequest']
export type TeamChatAnswerRequest = components['schemas']['TeamChatAnswerRequest']
export type TeamChatAnswerChoice = TeamChatAnswerRequest['choice']

const BASE = '/api/character/team-chat'

export const teamChatApi = {
  day: (date?: string): Promise<TeamChatDay> =>
    apiFetch<TeamChatDay>(`${BASE}${date != null ? `?date=${encodeURIComponent(date)}` : ''}`),
  reply: (threadId: string, text: string): Promise<TeamChatLine> =>
    apiFetch<TeamChatLine>(`${BASE}/threads/${encodeURIComponent(threadId)}/reply`, {
      method: 'POST',
      body: JSON.stringify({ text } satisfies TeamChatReplyRequest),
    }),
  apply: (threadId: string, actionKey: string): Promise<TeamChatThread> =>
    apiFetch<TeamChatThread>(`${BASE}/threads/${encodeURIComponent(threadId)}/apply/${encodeURIComponent(actionKey)}`, {
      method: 'POST',
    }),
  /** One-tap answer to a known-exception offer (EXCUSE) or the capped review (REVIEW) — 404/409 on a stale ügy. */
  answer: (threadId: string, choice: TeamChatAnswerChoice): Promise<TeamChatThread> =>
    apiFetch<TeamChatThread>(`${BASE}/threads/${encodeURIComponent(threadId)}/answer`, {
      method: 'POST',
      body: JSON.stringify({ choice } satisfies TeamChatAnswerRequest),
    }),
  /** Withdraws a remembered exception chip — the ügy reopens if that's what closed it. */
  undoRemembered: (threadId: string): Promise<TeamChatThread> =>
    apiFetch<TeamChatThread>(`${BASE}/threads/${encodeURIComponent(threadId)}/remembered`, {
      method: 'DELETE',
    }),
}
