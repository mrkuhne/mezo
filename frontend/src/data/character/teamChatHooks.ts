// Dual-mode hooks for the csapat-chat (Task 12, mezo-a9bo7.24) — the chat-room page and the
// wall's live strip both build on these. Follows the useDualQuery idiom (`useTeamEditions`'s
// day-range precedent) for the read, and the `useAdviceActions` precedent (mock = no-op, real =
// mutate + invalidate) for the two original mutations.
//
// S7 (mezo-d6ivw.7, Task 8) adds the character's answer: `reply` now gets a genuine follow-up
// (mock: a synthetic Falat line after a short delay; real: an async server answer, polled for),
// plus the one-tap `answer` and `undoRemembered` actions.
import { useEffect, useRef, useSyncExternalStore } from 'react'
import { useMutation, useQueryClient, type QueryClient, type QueryKey } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { DEFAULT_QUERY_STALE_TIME_MS, useDualQuery } from '@/data/useDualQuery'
import { localDateString } from '@/shared/lib/dates'
import { teamChatApi } from '@/data/character/teamChatApi'
import type { TeamChatAnswerChoice, TeamChatDay } from '@/data/character/teamChatApi'
import { buildTeamChatDay, mockAnswer, mockReplyAfter, mockUndo, MOCK_TEAM_CHAT_DAY } from '@/data/character/teamChatMock'
import { ACTION_INVALIDATES } from '@/data/today/adviceHooks'
import type { AdviceActionKey } from '@/data/types'
import { TURN_FACT_POLL_DELAYS } from '@/data/me/peopleHooks'

const TEAM_CHAT_KEY = ['teamChat']

/**
 * The "awaiting an answer" marker — thread ids whose reply/answer is in flight (mock: the
 * ~1.2s typing delay; real: the async server answer, ~1.5s debounce + LLM). Lives at
 * `['teamChat','awaiting']` in the SAME cache as the day queries (so a component can read it
 * without threading a prop), but is deliberately NOT a `useQuery` — a `useQuery` observer here
 * would be swept up by `qc.invalidateQueries({queryKey: TEAM_CHAT_KEY})` (`['teamChat']`
 * prefix-matches `['teamChat','awaiting']`) and TanStack would try to refetch a query that has
 * no `queryFn`. Plain `getQueryData`/`setQueryData` + a cache subscription sidesteps that.
 */
const AWAITING_KEY: QueryKey = ['teamChat', 'awaiting']
const EMPTY_AWAITING: ReadonlySet<string> = new Set()

function sameKey(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i])
}

function getAwaiting(qc: QueryClient): ReadonlySet<string> {
  return qc.getQueryData<ReadonlySet<string>>(AWAITING_KEY) ?? EMPTY_AWAITING
}

function addAwaiting(qc: QueryClient, threadId: string): void {
  qc.setQueryData<ReadonlySet<string>>(AWAITING_KEY, (old) => {
    const base = old ?? EMPTY_AWAITING
    if (base.has(threadId)) return base
    return new Set(base).add(threadId)
  })
}

function removeAwaiting(qc: QueryClient, threadIds: Iterable<string>): void {
  qc.setQueryData<ReadonlySet<string>>(AWAITING_KEY, (old) => {
    if (old == null || old.size === 0) return old ?? EMPTY_AWAITING
    let changed = false
    const next = new Set(old)
    for (const id of threadIds) if (next.delete(id)) changed = true
    return changed ? next : old
  })
}

/** Reactive read of `AWAITING_KEY` via a direct cache subscription (see the comment above for
 *  why this is not `useQuery`). */
function useAwaiting(qc: QueryClient): ReadonlySet<string> {
  return useSyncExternalStore(
    (onStoreChange) => qc.getQueryCache().subscribe((event) => {
      if (sameKey(event.query.queryKey, AWAITING_KEY)) onStoreChange()
    }),
    () => getAwaiting(qc),
    () => EMPTY_AWAITING,
  )
}

/** A thread has "left" awaiting once the day has a REPLY line on it newer than the user's own
 *  last line there — i.e. Falat (mock) or the real backend has actually answered. */
function resolvedThreadIds(day: TeamChatDay, awaiting: ReadonlySet<string>): string[] {
  const resolved: string[] = []
  for (const threadId of awaiting) {
    const threadLines = day.lines.filter((l) => l.threadId === threadId)
    const lastUserAt = threadLines.filter((l) => l.kind === 'USER').at(-1)?.occurredAt
    const lastReplyAt = threadLines.filter((l) => l.kind === 'REPLY').at(-1)?.occurredAt
    if (lastUserAt != null && lastReplyAt != null && lastReplyAt > lastUserAt) resolved.push(threadId)
  }
  return resolved
}

/** One day's csapat-chat (all lines + every currently OPEN ügy, any day). Real mode refetches
 *  every 60s (the chat is genuinely live — a new push/reply can land any time the page is
 *  open); mock mode never refetches (the `useDualQuery` idiom's `staleTime: Infinity`).
 *  While any thread is `awaiting` an answer, real mode instead follows `TURN_FACT_POLL_DELAYS`
 *  (~2s/3s/5s) so a just-sent reply's answer shows up fast, then falls back to the plain 60s
 *  poll once the backoff runs out (whether or not the answer ever arrived). Real mode's
 *  unresolved-window fallback is the honest empty day (`realEmpty`), never the mock seed. */
export function useTeamChat(date?: string): { day: TeamChatDay; loading: boolean } {
  const qc = useQueryClient()
  const awaiting = useAwaiting(qc)
  const awaitingRef = useRef(awaiting)
  awaitingRef.current = awaiting
  const attempts = useRef(0)

  const { data, isPending } = useDualQuery<TeamChatDay>({
    queryKey: [...TEAM_CHAT_KEY, date ?? null],
    mockData: date != null ? buildTeamChatDay(date) : MOCK_TEAM_CHAT_DAY,
    realFetch: () => teamChatApi.day(date),
    realEmpty: { date: date ?? localDateString(), lines: [], openThreads: [], pushesToday: 0, pushBudget: 2 },
    realStaleTime: DEFAULT_QUERY_STALE_TIME_MS,
    refetchInterval: () => {
      if (awaitingRef.current.size === 0) {
        attempts.current = 0
        return 60_000
      }
      if (attempts.current >= TURN_FACT_POLL_DELAYS.length) return 60_000
      const delay = TURN_FACT_POLL_DELAYS[attempts.current]
      attempts.current += 1
      return delay
    },
  })

  // A thread leaves `awaiting` once THIS day's data shows its answer landed.
  useEffect(() => {
    if (awaiting.size === 0) return
    const resolved = resolvedThreadIds(data, awaiting)
    if (resolved.length > 0) removeAwaiting(qc, resolved)
  }, [data, awaiting, qc])

  return { day: data, loading: isPending }
}

/** Replying inside an ügy, applying one of its offered actions, answering a known-exception
 *  offer, and undoing a remembered exception chip.
 *
 *  Mock mode: `reply`/`answer`/`undoRemembered` update every cached `['teamChat', *]` day via
 *  `qc.setQueriesData` with the pure builders from `teamChatMock.ts` (`apply` stays the
 *  historical no-op — no contract change there this slice). `reply` also marks the thread
 *  `awaiting` and, after a short typing delay, applies the synthetic reply — real `setTimeout`
 *  so a test can drive it with `vi.useFakeTimers()` (the `fuelHooks`/`draftMealFromAi` precedent).
 *  Real mode: invalidates as today; `reply` additionally marks the thread `awaiting` so
 *  `useTeamChat` switches to the fast poll while the async server answer is in flight. */
export function useTeamChatActions(): {
  /** Resolves once the line is saved; rejects on failure (the caller keeps the text + says so). */
  reply: (threadId: string, text: string) => Promise<void>
  /** Resolves once the action is applied; rejects on failure (the caller shows no false success). */
  apply: (threadId: string, actionKey: string) => Promise<void>
  /** Resolves once the answer is recorded; rejects on failure (404/409 in real mode). */
  answer: (threadId: string, choice: TeamChatAnswerChoice) => Promise<void>
  /** Resolves once the remembered chip is withdrawn; rejects on failure. */
  undoRemembered: (threadId: string) => Promise<void>
  /** Thread ids whose answer is in flight (mock typing delay / real async server answer). */
  awaiting: ReadonlySet<string>
  pending: boolean
} {
  const qc = useQueryClient()
  const mock = isMockMode()
  const awaiting = useAwaiting(qc)

  const applyMockDayUpdate = (updater: (d: TeamChatDay) => TeamChatDay) => {
    qc.setQueriesData<unknown>({ queryKey: TEAM_CHAT_KEY }, (d: unknown) =>
      (d == null || d instanceof Set) ? d : updater(d as TeamChatDay))
  }

  const replyMutation = useMutation({
    mutationFn: async ({ threadId, text }: { threadId: string; text: string }) => {
      if (mock) {
        addAwaiting(qc, threadId)
        // Mock's "Falat ír…" typing beat — a plain setTimeout so tests can drive it with
        // `vi.useFakeTimers()` + `vi.advanceTimersByTimeAsync(1200)`, same idiom as
        // `fuelHooks.draftMealFromAi`'s 600ms demo delay.
        await new Promise<void>((resolve) => setTimeout(resolve, 1200))
        applyMockDayUpdate((d) => mockReplyAfter(d, threadId, text))
        removeAwaiting(qc, [threadId])
        return
      }
      await teamChatApi.reply(threadId, text)
    },
    onSuccess: mock
      ? undefined
      : (_data, { threadId }) => {
          addAwaiting(qc, threadId)
          qc.invalidateQueries({ queryKey: TEAM_CHAT_KEY })
        },
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

  const answerMutation = useMutation({
    mutationFn: async ({ threadId, choice }: { threadId: string; choice: TeamChatAnswerChoice }) => {
      if (mock) { applyMockDayUpdate((d) => mockAnswer(d, threadId, choice)); return }
      await teamChatApi.answer(threadId, choice)
    },
    onSuccess: mock ? undefined : () => qc.invalidateQueries({ queryKey: TEAM_CHAT_KEY }),
  })

  const undoMutation = useMutation({
    mutationFn: async ({ threadId }: { threadId: string }) => {
      if (mock) { applyMockDayUpdate((d) => mockUndo(d, threadId)); return }
      await teamChatApi.undoRemembered(threadId)
    },
    onSuccess: mock ? undefined : () => qc.invalidateQueries({ queryKey: TEAM_CHAT_KEY }),
  })

  return {
    reply: async (threadId: string, text: string) => {
      await replyMutation.mutateAsync({ threadId, text })
    },
    apply: async (threadId: string, actionKey: string) => {
      await applyMutation.mutateAsync({ threadId, actionKey })
    },
    answer: async (threadId: string, choice: TeamChatAnswerChoice) => {
      await answerMutation.mutateAsync({ threadId, choice })
    },
    undoRemembered: async (threadId: string) => {
      await undoMutation.mutateAsync({ threadId })
    },
    awaiting,
    pending: replyMutation.isPending || applyMutation.isPending || answerMutation.isPending || undoMutation.isPending,
  }
}
