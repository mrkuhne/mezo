import { useState } from 'react'
import { useQueryClient, type QueryKey } from '@tanstack/react-query'
import { useDualQuery } from '@/data/useDualQuery'
import { isMockMode } from '@/data/_client/mode'
import { ApiError } from '@/data/_client/api'
import { chatApi, toChatMessage, type ConversationResponse } from '@/data/insights/chatApi'
import { initialChat, cannedReply } from '@/data/insights/chat'
import type { ChatMessage } from '@/data/types'
import type { Tool } from '@/shared/ui/ToolChip'

export interface ChatBootstrap {
  conversationId: string | null
  messages: ChatMessage[]
  degraded: boolean
  mode: 'mock' | 'live'
}

export interface ChatConversations {
  conversations: ConversationResponse[]
  degraded: boolean
  mode: 'mock' | 'live'
}

/** One in-flight turn — the optimistic overlay ChatPage renders under the history. */
export interface ChatTurn { userText: string; draft: string; thinking: boolean; tools: Tool[] }

/**
 * Which conversation a chat surface is reading (mezo-at8x.3):
 * a conversation id · `'new'` (an unsent, not-yet-created one) · `null`/undefined (the newest).
 */
export type ChatSelection = string | null | undefined

/** `'new'` — the draft conversation that only becomes a row on the first send. */
export const NEW_CHAT = 'new'

const MOCK_CONVERSATION_ID = 'mock-conversation'
/** Exported for useChatHandoff.ts (mezo-p2tr) — the week/day handoff seeds this same cache. */
export const CONVERSATIONS_KEY = ['chat', 'conversations'] as const
/** One cache entry per selection, so switching conversations can't cross-contaminate history. */
export const chatKey = (selection: ChatSelection): QueryKey => ['chat', selection ?? 'newest']

const EMPTY_CHAT: ChatBootstrap = { conversationId: null, messages: [], degraded: false, mode: 'live' }
const MOCK_CHAT: ChatBootstrap = {
  conversationId: MOCK_CONVERSATION_ID, messages: initialChat, degraded: false, mode: 'mock',
}
const EMPTY_CONVERSATIONS: ChatConversations = { conversations: [], degraded: false, mode: 'live' }
/** Exported for useChatHandoff.ts (mezo-p2tr) — the fallback base list when seeding a new mock row. */
export const MOCK_CONVERSATIONS: ChatConversations = {
  mode: 'mock',
  degraded: false,
  conversations: [{
    id: MOCK_CONVERSATION_ID,
    title: 'Demo beszélgetés',
    startedAt: '2026-05-21T06:40:00Z',
    lastMessageAt: '2026-05-21T06:42:00Z',
  }],
}

/**
 * Mock-mode thread for a selection. Only the seeded demo conversation carries the Phase-1
 * transcript: a `NEW_CHAT` draft — and any conversation started during this session — opens
 * EMPTY, exactly as it would against the backend. (Returning the seed for every id made a
 * brand-new mock conversation inherit the demo's messages.)
 */
const mockThread = (selection: ChatSelection): ChatBootstrap => {
  if (selection === NEW_CHAT) return { ...EMPTY_CHAT, mode: 'mock' }
  if (selection && selection !== MOCK_CONVERSATION_ID) {
    return { ...EMPTY_CHAT, conversationId: selection, mode: 'mock' }
  }
  return MOCK_CHAT
}

const nowTs = () => new Date().toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })
const nowIso = () => new Date().toISOString()

/** The switch-off 404 is an honest "companion unavailable" (IDENT-3), never a retried error. */
const isSwitchedOff = (err: unknown) => err instanceof ApiError && err.status === 404

/** mezo-8z79: the stream ended with a technically-successful round that produced no text. */
const isEmptyAnswer = (err: unknown) =>
  err instanceof ApiError && err.messages.some((m) => m.code === 'COMPANION_EMPTY_ANSWER')

/**
 * The conversation list — the picker's source and the single place the degraded state is
 * detected (the list endpoint is the one call every chat surface makes).
 */
export function useConversations() {
  return useDualQuery<ChatConversations>({
    queryKey: CONVERSATIONS_KEY,
    mockData: MOCK_CONVERSATIONS,
    realFetch: async () => {
      try {
        // backend orders by last activity desc
        return { conversations: await chatApi.listConversations(), degraded: false, mode: 'live' }
      } catch (err) {
        if (isSwitchedOff(err)) return { ...EMPTY_CONVERSATIONS, degraded: true }
        throw err
      }
    },
    realEmpty: EMPTY_CONVERSATIONS,
  })
}

/**
 * Chat bootstrap read — the selected conversation plus its full history.
 *
 * `selection` is a conversation id, `NEW_CHAT` (an empty draft thread that is only created
 * server-side on the first send), or omitted for "whatever the newest conversation is".
 */
export function useChat(selection?: ChatSelection) {
  return useDualQuery<ChatBootstrap>({
    queryKey: chatKey(selection),
    mockData: mockThread(selection),
    realFetch: async () => {
      try {
        // A brand-new thread has nothing to load — and nothing to report: the degraded state
        // comes from `useConversations()`, the one call every chat surface already makes.
        if (selection === NEW_CHAT) return EMPTY_CHAT
        const id = selection ?? (await chatApi.listConversations())[0]?.id
        if (!id) return EMPTY_CHAT
        const messages = await chatApi.listMessages(id)
        return { conversationId: id, messages: messages.map(toChatMessage), degraded: false, mode: 'live' }
      } catch (err) {
        if (isSwitchedOff(err)) return { ...EMPTY_CHAT, degraded: true }
        throw err
      }
    },
    realEmpty: EMPTY_CHAT,
  })
}

/**
 * F7.5 (mezo-d20.8.5): rename + delete on one conversation. Mock mode mutates the shared
 * CONVERSATIONS_KEY cache in place; real mode calls the API then invalidates. Delete also
 * invalidates BOTH the newest-thread and the id-keyed thread cache — deleting the newest
 * conversation must move every reader off the dead id.
 */
export function useConversationActions() {
  const queryClient = useQueryClient()

  const refresh = (id?: string) => {
    void queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY })
    void queryClient.invalidateQueries({ queryKey: chatKey(null) })
    if (id) void queryClient.invalidateQueries({ queryKey: chatKey(id) })
  }

  const rename = async (id: string, title: string) => {
    const trimmed = title.trim().slice(0, 120)
    if (!trimmed) return
    if (isMockMode()) {
      queryClient.setQueryData<ChatConversations>(CONVERSATIONS_KEY, (old) => ({
        ...(old ?? MOCK_CONVERSATIONS),
        conversations: (old ?? MOCK_CONVERSATIONS).conversations.map((c) =>
          c.id === id ? { ...c, title: trimmed } : c),
      }))
      return
    }
    await chatApi.renameConversation(id, trimmed)
    void queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY })
  }

  const remove = async (id: string) => {
    if (isMockMode()) {
      queryClient.setQueryData<ChatConversations>(CONVERSATIONS_KEY, (old) => ({
        ...(old ?? MOCK_CONVERSATIONS),
        conversations: (old ?? MOCK_CONVERSATIONS).conversations.filter((c) => c.id !== id),
      }))
      queryClient.removeQueries({ queryKey: chatKey(id) })
      void queryClient.invalidateQueries({ queryKey: chatKey(null) })
      return
    }
    await chatApi.deleteConversation(id)
    refresh(id)
  }

  return { rename, remove }
}

/** The mock-mode transcript — the demo surface never touches the network (mezo-at8x.4). */
const MOCK_TRANSCRIPT = 'Ma reggel fáradtan keltem, mit gondolsz, menjek edzeni?'

/**
 * Speech-to-text for the chat composer (mezo-at8x.4). Stateless: a recorded clip goes up,
 * a transcript comes back, nothing is persisted on either side.
 */
export function useTranscribe() {
  return {
    transcribe: async (audio: Blob): Promise<string> => {
      if (isMockMode()) {
        await new Promise((resolve) => setTimeout(resolve, 600))
        return MOCK_TRANSCRIPT
      }
      return chatApi.transcribe(audio)
    },
  }
}

/**
 * Send/stream state machine for ONE selected conversation. Mock mode keeps the Phase-1 demo
 * flow (1.2s thinking → canned reply) but through the shared query cache; real mode ensures a
 * conversation, streams the SSE turn (deltas into `turn.draft`), then appends the persisted pair.
 *
 * `onConversationCreated` fires when a `NEW_CHAT` draft became a real row — the caller moves its
 * selection onto that id so the next turn continues the same thread.
 */
export function useChatActions(selection?: ChatSelection, onConversationCreated?: (id: string) => void) {
  const queryClient = useQueryClient()
  const [turn, setTurn] = useState<ChatTurn | null>(null)
  const [error, setError] = useState<string | null>(null)
  // F7.5 (mezo-d20.8.5): the failed turn's text survives the error — retry re-sends it
  // unchanged (replace, don't append), editFailed hands it back to the composer.
  const [failedText, setFailedText] = useState<string | null>(null)

  const append = (conversationId: string, appended: ChatMessage[]) => {
    const mode = isMockMode() ? 'mock' : 'live'
    const write = (key: QueryKey) =>
      queryClient.setQueryData<ChatBootstrap>(key, (old) => ({
        conversationId,
        messages: [...(old?.messages ?? []), ...appended],
        degraded: false,
        mode: old?.mode ?? mode,
      }))
    write(chatKey(selection))
    // A turn that just created its conversation also seeds that id's own cache entry, so the
    // caller's move from `NEW_CHAT` to the real id lands on a populated thread, not an empty one.
    if (selection !== conversationId) write(chatKey(conversationId))
  }

  /** A new conversation changes the picker list (and its auto-title comes from this turn). */
  const refreshConversations = () =>
    void queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY })

  const seedMockConversation = (id: string, title: string) => {
    queryClient.setQueryData<ChatConversations>(CONVERSATIONS_KEY, (old) => ({
      mode: 'mock',
      degraded: false,
      conversations: [
        // title-from-first-message, same as the backend's auto-title
        { id, title: title.slice(0, 80), startedAt: nowIso(), lastMessageAt: nowIso() },
        ...(old?.conversations ?? MOCK_CONVERSATIONS.conversations),
      ],
    }))
  }

  const sendMock = (text: string) => {
    setTurn({ userText: text, draft: '', thinking: true, tools: [] })
    const isNew = selection === NEW_CHAT
    const conversationId = isNew ? crypto.randomUUID() : MOCK_CONVERSATION_ID
    if (isNew) {
      seedMockConversation(conversationId, text)
      onConversationCreated?.(conversationId)
    }
    setTimeout(() => {
      append(conversationId, [
        { role: 'user', ts: 'now', text },
        {
          // A mock answer is "persisted" the moment it lands in the cache — give it an id so it
          // is votable exactly like a live one (mezo-b3pp.15).
          id: crypto.randomUUID(),
          role: 'assistant', ts: 'now', text: cannedReply(text),
          tools: [
            { type: 'read', name: 'get_recovery(days=3, scope=checkin)' },
            { type: 'compute', name: `find_similar_past_days(theme='${text.slice(0, 20)}')` },
          ],
          refs: [{ kind: 'CheckIn', id: 'ci-2026-05-21' }],
          recalled: [
            { occurredOn: '2026-05-19', kind: 'chat_turn', label: 'korábbi beszélgetés', gist: 'Daniel: fáradt vagyok ma', similarity: 0.66 },
          ],
        },
      ])
      setTurn(null)
    }, 1200)
  }

  const sendReal = (text: string) => {
    setTurn({ userText: text, draft: '', thinking: true, tools: [] })
    void (async () => {
      let conversationId: string | null = null
      try {
        const cached = queryClient.getQueryData<ChatBootstrap>(chatKey(selection))
        const known = selection === NEW_CHAT ? null : (cached?.conversationId ?? (selection ?? null))
        conversationId = known ?? (await chatApi.createConversation()).id
        if (!known) onConversationCreated?.(conversationId)
        const done = await chatApi.streamMessage(
          conversationId,
          text,
          (delta) => setTurn((t) => (t ? { ...t, draft: t.draft + delta, thinking: false } : t)),
          (tool) => setTurn((t) => (t ? { ...t, tools: [...t.tools, tool], thinking: false } : t)),
        )
        append(conversationId, [{ role: 'user', ts: nowTs(), text }, toChatMessage(done)])
        refreshConversations()
      } catch (err) {
        // mezo-8z79: the backend now REFUSES to persist a blank answer, so this is a real outcome
        // the user must be able to tell apart from a transport failure — nothing was saved either
        // way, but "the model said nothing" is worth retrying immediately.
        setError(isEmptyAnswer(err)
          ? 'A társ nem adott választ erre a körre — próbáld újra.'
          : 'Nem sikerült válaszolni — próbáld újra.')
        setFailedText(text)
        // the user message may have persisted server-side; refetch keeps history honest
        void queryClient.invalidateQueries({ queryKey: chatKey(selection) })
        if (conversationId) void queryClient.invalidateQueries({ queryKey: chatKey(conversationId) })
        refreshConversations()
      } finally {
        setTurn(null)
      }
    })()
  }

  const send = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || turn) return
    setError(null)
    setFailedText(null)
    if (isMockMode()) sendMock(trimmed)
    else sendReal(trimmed)
  }

  /** Re-send the failed turn's exact text — the error bubble's Újra. */
  const retry = () => {
    if (!failedText || turn) return
    send(failedText)
  }

  /** Hand the failed text back for the composer (the error bubble's Szerkesztés) and clear. */
  const editFailed = (): string | null => {
    const text = failedText
    setFailedText(null)
    setError(null)
    return text
  }

  return { send, turn, error, failedText, retry, editFailed }
}
