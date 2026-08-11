import { apiFetch, apiSse, ApiError } from '@/data/_client/api'
import type { components } from '@/data/_client/api.gen'
import type { ChatMessage, ChatRole } from '@/data/types'
import type { Tool } from '@/shared/ui/ToolChip'

export type ConversationResponse = components['schemas']['ConversationResponse']
export type MessageResponse = components['schemas']['MessageResponse']
export type SendMessageRequest = components['schemas']['SendMessageRequest']
export type StreamDelta = components['schemas']['StreamDelta']
export type StreamToolCall = components['schemas']['StreamToolCall']
export type StreamError = components['schemas']['StreamError']
export type TranscriptionResponse = components['schemas']['TranscriptionResponse']

const CONVERSATION = '/api/companion/conversation'

/** Wire → FE mock-era shape (deliberately aligned in V0.2 — the cast below is the bridge). */
export function toChatMessage(m: MessageResponse): ChatMessage {
  return {
    role: m.role as ChatRole,
    ts: new Date(m.createdAt).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' }),
    text: m.content,
    // wire `type` is a plain string; values come from our own backend ('read' | 'compute')
    tools: m.tools.length ? (m.tools as Tool[]) : undefined,
    refs: m.refs.length ? m.refs : undefined,
    degraded: m.degraded || undefined,
  }
}

export const chatApi = {
  /**
   * Voice note → text (mezo-at8x.4). Multipart: the browser sets the boundary (apiFetch omits
   * its JSON Content-Type for FormData). The extension only labels the part — the backend
   * matches on the blob's own mime type.
   */
  transcribe: (audio: Blob): Promise<string> => {
    const form = new FormData()
    form.append('audio', audio, audio.type.includes('wav') ? 'note.wav' : 'note.bin')
    return apiFetch<TranscriptionResponse>('/api/companion/transcribe', { method: 'POST', body: form })
      .then((r) => r.text)
  },

  listConversations: () => apiFetch<ConversationResponse[]>(CONVERSATION),
  createConversation: () => apiFetch<ConversationResponse>(CONVERSATION, { method: 'POST' }),
  listMessages: (conversationId: string) =>
    apiFetch<MessageResponse[]>(`${CONVERSATION}/${conversationId}/messages`),

  /**
   * One streamed turn: emits `onDelta` per chunk and `onTool` as each tool actually
   * executes (progress only — the authoritative chips are the terminal `done` row's
   * `tools`, which also cover advisor-retry calls made after the stream ended); resolves
   * with the persisted assistant message from that `done` event. A terminal `error`
   * event (or a stream that ends without `done`) rejects with ApiError so callers share
   * one failure path.
   */
  streamMessage: async (
    conversationId: string,
    content: string,
    onDelta: (text: string) => void,
    onTool?: (tool: Tool) => void,
  ): Promise<MessageResponse> => {
    const body = JSON.stringify({ content } satisfies SendMessageRequest)
    for await (const ev of apiSse(`${CONVERSATION}/${conversationId}/message/stream`, { method: 'POST', body })) {
      if (ev.event === 'delta') {
        onDelta((JSON.parse(ev.data) as StreamDelta).text)
      } else if (ev.event === 'tool') {
        // wire `type` is a plain string; values come from our own backend — same cast as toChatMessage
        onTool?.(JSON.parse(ev.data) as StreamToolCall as Tool)
      } else if (ev.event === 'done') {
        return JSON.parse(ev.data) as MessageResponse
      } else if (ev.event === 'error') {
        const code = (JSON.parse(ev.data) as StreamError).code
        throw new ApiError([{ code, message: 'Companion stream failed' }], 200)
      }
    }
    throw new ApiError([{ code: 'COMPANION_STREAM_INCOMPLETE', message: 'Stream ended without done' }], 200)
  },
}
