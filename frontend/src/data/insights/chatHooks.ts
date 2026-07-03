import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useDualQuery } from '@/data/useDualQuery'
import { isMockMode } from '@/data/_client/mode'
import { ApiError } from '@/data/_client/api'
import { chatApi, toChatMessage } from '@/data/insights/chatApi'
import { initialChat, cannedReply } from '@/data/insights/chat'
import type { ChatMessage } from '@/data/types'

export interface ChatBootstrap {
  conversationId: string | null
  messages: ChatMessage[]
  degraded: boolean
  mode: 'mock' | 'live'
}

/** One in-flight turn — the optimistic overlay ChatPage renders under the history. */
export interface ChatTurn { userText: string; draft: string; thinking: boolean }

const CHAT_KEY = ['chat'] as const
const EMPTY_CHAT: ChatBootstrap = { conversationId: null, messages: [], degraded: false, mode: 'live' }
const MOCK_CHAT: ChatBootstrap = {
  conversationId: 'mock-conversation', messages: initialChat, degraded: false, mode: 'mock',
}

const nowTs = () => new Date().toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })

/**
 * Chat bootstrap read: the newest conversation + its full history. Real mode maps the
 * switch-off 404 to `degraded: true` (honest "companion unavailable", IDENT-3) instead
 * of a retried error — the progression 404→ghost pattern.
 */
export function useChat() {
  return useDualQuery<ChatBootstrap>({
    queryKey: CHAT_KEY,
    mockData: MOCK_CHAT,
    realFetch: async () => {
      try {
        const conversations = await chatApi.listConversations()
        const newest = conversations[0] // backend orders by last activity desc
        if (!newest) return EMPTY_CHAT
        const messages = await chatApi.listMessages(newest.id)
        return { conversationId: newest.id, messages: messages.map(toChatMessage), degraded: false, mode: 'live' }
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return { ...EMPTY_CHAT, degraded: true }
        throw err
      }
    },
    realEmpty: EMPTY_CHAT,
  })
}

/**
 * Send/stream state machine. Mock mode keeps the Phase-1 demo flow (1.2s thinking →
 * canned reply) but through the shared query cache; real mode ensures a conversation,
 * streams the SSE turn (deltas into `turn.draft`), then appends the persisted pair.
 */
export function useChatActions() {
  const queryClient = useQueryClient()
  const [turn, setTurn] = useState<ChatTurn | null>(null)
  const [error, setError] = useState<string | null>(null)

  const append = (conversationId: string, appended: ChatMessage[]) =>
    queryClient.setQueryData<ChatBootstrap>(CHAT_KEY, (old) => ({
      conversationId,
      messages: [...(old?.messages ?? []), ...appended],
      degraded: false,
      mode: old?.mode ?? (isMockMode() ? 'mock' : 'live'),
    }))

  const sendMock = (text: string) => {
    setTurn({ userText: text, draft: '', thinking: true })
    setTimeout(() => {
      append('mock-conversation', [
        { role: 'user', ts: 'now', text },
        {
          role: 'assistant', ts: 'now', text: cannedReply(text),
          tools: [
            { type: 'read', name: 'get_recent_checkins(d=3)' },
            { type: 'compute', name: `recallSharedMemory(theme='${text.slice(0, 20)}')` },
          ],
          refs: [{ kind: 'CheckIn', id: 'ci-2026-05-21' }],
        },
      ])
      setTurn(null)
    }, 1200)
  }

  const sendReal = (text: string) => {
    setTurn({ userText: text, draft: '', thinking: true })
    void (async () => {
      try {
        const cached = queryClient.getQueryData<ChatBootstrap>(CHAT_KEY)
        const conversationId = cached?.conversationId ?? (await chatApi.createConversation()).id
        const done = await chatApi.streamMessage(conversationId, text, (delta) =>
          setTurn((t) => (t ? { ...t, draft: t.draft + delta, thinking: false } : t)))
        append(conversationId, [{ role: 'user', ts: nowTs(), text }, toChatMessage(done)])
      } catch {
        setError('Nem sikerült válaszolni — próbáld újra.')
        // the user message may have persisted server-side; refetch keeps history honest
        void queryClient.invalidateQueries({ queryKey: CHAT_KEY })
      } finally {
        setTurn(null)
      }
    })()
  }

  const send = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || turn) return
    setError(null)
    if (isMockMode()) sendMock(trimmed)
    else sendReal(trimmed)
  }

  return { send, turn, error }
}
