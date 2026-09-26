// Dual-mode hooks for the csapat-chat (Task 12, mezo-a9bo7.24) — the chat-room page and the
// wall's live strip both build on these. Follows the useDualQuery idiom (`useTeamEditions`'s
// day-range precedent) for the read, and the `useAdviceActions` precedent (mock = no-op, real =
// mutate + invalidate) for the two mutations.
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { DEFAULT_QUERY_STALE_TIME_MS, useDualQuery } from '@/data/useDualQuery'
import { localDateString } from '@/shared/lib/dates'
import { teamChatApi } from '@/data/character/teamChatApi'
import type { TeamChatDay } from '@/data/character/teamChatApi'
import { buildTeamChatDay, MOCK_TEAM_CHAT_DAY } from '@/data/character/teamChatMock'
import { ACTION_INVALIDATES } from '@/data/today/adviceHooks'
import type { AdviceActionKey } from '@/data/types'

const TEAM_CHAT_KEY = ['teamChat']

/** One day's csapat-chat (all lines + every currently OPEN ügy, any day). Real mode refetches
 *  every 60s (the chat is genuinely live — a new push/reply can land any time the page is
 *  open); mock mode never refetches (the `useDualQuery` idiom's `staleTime: Infinity`). Real
 *  mode's unresolved-window fallback is the honest empty day (`realEmpty`), never the mock seed. */
export function useTeamChat(date?: string): { day: TeamChatDay; loading: boolean } {
  const { data, isPending } = useDualQuery<TeamChatDay>({
    queryKey: [...TEAM_CHAT_KEY, date ?? null],
    mockData: date != null ? buildTeamChatDay(date) : MOCK_TEAM_CHAT_DAY,
    realFetch: () => teamChatApi.day(date),
    realEmpty: { date: date ?? localDateString(), lines: [], openThreads: [], pushesToday: 0, pushBudget: 2 },
    realStaleTime: DEFAULT_QUERY_STALE_TIME_MS,
    refetchInterval: 60_000,
  })
  return { day: data, loading: isPending }
}

/** Replying inside an ügy, and applying one of its offered actions. Mock mode no-ops (the
 *  `useAdviceActions` precedent — nothing here fabricates a persisted line/thread state); real
 *  mode invalidates every cached `teamChat` day plus, for `apply`, whatever else that action key
 *  touches elsewhere in the app (`ACTION_INVALIDATES`, shared with the advice-card actions — no
 *  copy, mezo-a9bo7.24). */
export function useTeamChatActions(): {
  /** Resolves once the line is saved; rejects on failure (the caller keeps the text + says so). */
  reply: (threadId: string, text: string) => Promise<void>
  /** Resolves once the action is applied; rejects on failure (the caller shows no false success). */
  apply: (threadId: string, actionKey: string) => Promise<void>
  pending: boolean
} {
  const qc = useQueryClient()
  const mock = isMockMode()

  const replyMutation = useMutation({
    mutationFn: async ({ threadId, text }: { threadId: string; text: string }) => {
      if (mock) return
      await teamChatApi.reply(threadId, text)
    },
    onSuccess: mock ? undefined : () => qc.invalidateQueries({ queryKey: TEAM_CHAT_KEY }),
  })

  const applyMutation = useMutation({
    mutationFn: async ({ threadId, actionKey }: { threadId: string; actionKey: string }) => {
      if (mock) return
      await teamChatApi.apply(threadId, actionKey)
    },
    onSuccess: mock
      ? undefined
      : (_data, { actionKey }) => {
          qc.invalidateQueries({ queryKey: TEAM_CHAT_KEY })
          for (const queryKey of ACTION_INVALIDATES[actionKey as AdviceActionKey] ?? []) {
            qc.invalidateQueries({ queryKey: [...queryKey] })
          }
        },
  })

  return {
    reply: async (threadId: string, text: string) => {
      await replyMutation.mutateAsync({ threadId, text })
    },
    apply: async (threadId: string, actionKey: string) => {
      await applyMutation.mutateAsync({ threadId, actionKey })
    },
    pending: replyMutation.isPending || applyMutation.isPending,
  }
}
