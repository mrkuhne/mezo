// Weekly review (mezo-p2tr, Task 10) — the "Beszélgess a napról/hétről" handoff: WeekDayCard and
// WeekReviewCard call `open({kind, date})` to create a conversation anchored to that week/day and
// jump straight into it. Real mode's create round-trip also runs the server's opening LLM turn
// (hence `pending`, worth a spinner on the triggering button); mock mode fabricates the same
// shape locally, following the sendMock seeding idiom (chatHooks.ts:181-220).
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { chatApi } from '@/data/insights/chatApi'
import {
  CONVERSATIONS_KEY, MOCK_CONVERSATIONS, chatKey,
  type ChatBootstrap, type ChatConversations,
} from '@/data/insights/chatHooks'
import { useToast } from '@/shared/ui/ToastProvider'

export interface ChatHandoffContext {
  kind: 'week' | 'day'
  date: string
}

const nowIso = () => new Date().toISOString()

/** The canned Mezo opening a mock-mode handoff seeds — the real backend writes its own. */
function openingText(context: ChatHandoffContext): string {
  return context.kind === 'week'
    ? 'Átnéztem a heted — mi foglalkoztat belőle a legjobban?'
    : `Átnéztem ezt a napot (${context.date}) — mesélj, mi járt a fejedben?`
}

function conversationTitle(context: ChatHandoffContext): string {
  return context.kind === 'week' ? 'Heti beszélgetés' : 'Napi beszélgetés'
}

export function useChatHandoff(): { open: (context: ChatHandoffContext) => void; pending: boolean } {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [pending, setPending] = useState(false)

  const openMock = (context: ChatHandoffContext) => {
    const id = crypto.randomUUID()
    const startedAt = nowIso()
    queryClient.setQueryData<ChatConversations>(CONVERSATIONS_KEY, (old) => ({
      mode: 'mock',
      degraded: false,
      conversations: [
        { id, title: conversationTitle(context), startedAt, lastMessageAt: startedAt },
        ...(old?.conversations ?? MOCK_CONVERSATIONS.conversations),
      ],
    }))
    queryClient.setQueryData<ChatBootstrap>(chatKey(id), {
      conversationId: id,
      messages: [{ id: crypto.randomUUID(), role: 'assistant', ts: 'now', text: openingText(context) }],
      degraded: false,
      mode: 'mock',
    })
    navigate(`/insights/chat?c=${id}`)
  }

  const openReal = async (context: ChatHandoffContext) => {
    setPending(true)
    try {
      const conversation = await chatApi.createConversation(context)
      navigate(`/insights/chat?c=${conversation.id}`)
    } catch {
      toast.show({ kind: 'error', text: 'Nem sikerült elindítani a beszélgetést' })
    } finally {
      setPending(false)
    }
  }

  const open = (context: ChatHandoffContext) => {
    // Structural double-click guard — a real POST in flight (or, in principle, an overlapping
    // mock call) is ignored rather than relying on every call site to disable its own button.
    if (pending) return
    if (isMockMode()) openMock(context)
    else void openReal(context)
  }

  return { open, pending }
}
