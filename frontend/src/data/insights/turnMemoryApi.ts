import { apiFetch } from '@/data/_client/api'
import type { components } from '@/data/_client/api.gen'

export type TurnMemoryResponse = components['schemas']['TurnMemoryResponse']
export type MemoryItemResponse = components['schemas']['MemoryItemResponse']
export type ForgetLearnedRequest = components['schemas']['ForgetLearnedRequest']
export type ForgetLearnedResponse = components['schemas']['ForgetLearnedResponse']

/** S8 (mezo-d6ivw.12): one memory item a chat turn produced (forget list / widen preview). */
export interface MemoryItem {
  kind: MemoryItemResponse['kind']
  refId: string
  personId: string | null
  who: string | null
  text: string
  createdAt: string
  pending: boolean
}
export interface TurnLearned { id: string; personId: string; who: string; kind: string; text: string }
/** `kept` = accepted/refined, its knowledge fact still live (undo forgets that fact). */
export interface TurnProposed { id: string; text: string; state: 'ask' | 'kept'; promotedFactId: string | null }
/** `forgetRequest` = this message IS a forget request (backend ForgetIntent) — its `forgotten` list
 *  may be empty (owner ruling 2026-09-28: nothing learned from the preceding message). */
export interface TurnMemory { learned: TurnLearned[]; proposed: TurnProposed[]; forgotten: MemoryItem[]; forgetRequest: boolean }
/** The user message a turn's chips hang on — `id` is the persisted row id, or `mock-turn-<i>`. */
export interface TurnAnchor { id: string; ordinal: number; text: string }

export const EMPTY_TURN_MEMORY: TurnMemory = { learned: [], proposed: [], forgotten: [], forgetRequest: false }

export const toMemoryItem = (m: MemoryItemResponse): MemoryItem => ({
  kind: m.kind, refId: m.refId, personId: m.personId ?? null, who: m.who ?? null,
  text: m.text, createdAt: m.createdAt, pending: m.pending,
})

export function toTurnMemory(r: TurnMemoryResponse): TurnMemory {
  return {
    learned: r.learned.map((f) => ({ id: f.id, personId: f.personId, who: f.personName, kind: f.kind, text: f.text })),
    proposed: r.proposed.map((c) => ({
      id: c.id,
      text: c.refinedText ?? c.candidateText,
      state: c.userDecision ? 'kept' : 'ask',
      promotedFactId: c.promotedFactId ?? null,
    })),
    forgotten: r.forgotten.map(toMemoryItem),
    forgetRequest: r.forgetRequest === true,
  }
}

const CONVERSATION = '/api/companion/conversation'

export const turnMemoryApi = {
  get: async (conversationId: string, messageId: string) =>
    toTurnMemory(await apiFetch<TurnMemoryResponse>(
      `${CONVERSATION}/${conversationId}/turn-memory?messageId=${encodeURIComponent(messageId)}`)),
  previewForgetAll: async (conversationId: string) =>
    (await apiFetch<MemoryItemResponse[]>(`${CONVERSATION}/${conversationId}/forget-learned`)).map(toMemoryItem),
  forgetAll: async (conversationId: string, triggerMessageId: string) =>
    (await apiFetch<ForgetLearnedResponse>(`${CONVERSATION}/${conversationId}/forget-learned`, {
      method: 'POST',
      body: JSON.stringify({ triggerMessageId } satisfies ForgetLearnedRequest),
    })).forgotten.map(toMemoryItem),
}
