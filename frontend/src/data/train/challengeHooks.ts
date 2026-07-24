import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { challengeApi } from '@/data/train/challengeApi'
import { workout as mockWorkout } from '@/data/train/train'
import type { Challenge } from '@/data/types'

const key = (t: string | null, d: string) => ['challenges', t, d]

export interface ChallengesView {
  challenges: Challenge[]
  mode: 'mock' | 'live'
  /** Real mode: the list query is in flight (the lazy LLM generation) — render the skeleton. */
  pending: boolean
}

/**
 * Live workout challenges for a planned session on a day (proactive). Mock: the Phase-1 seed
 * (workout.challenges). Live: the session/day's live challenges, or [] (loading/error/no session)
 * — the surface renders its honest empty state. Disabled until a templateSessionId exists (the FE
 * may pass null pre-instance).
 */
export function useChallenges(templateSessionId: string | null, date: string): ChallengesView {
  const mock = isMockMode()
  const q = useQuery<Challenge[]>({
    queryKey: key(templateSessionId, date),
    queryFn: mock
      ? async () => mockWorkout.challenges
      : () => challengeApi.list(templateSessionId as string, date),
    enabled: mock || !!templateSessionId,
    initialData: mock ? mockWorkout.challenges : undefined,
    staleTime: mock ? Infinity : undefined,
    retry: false,
  })
  if (mock) {
    return { challenges: mockWorkout.challenges, mode: 'mock', pending: false }
  }
  return { challenges: q.data ?? [], mode: 'live', pending: q.isPending }
}

/**
 * The L2 accept/dismiss surface. Persisted in real mode (invalidates the session/day list);
 * a no-op in mock (the seed carries no decision backend — the demo button is inert).
 */
export function useChallengeActions(templateSessionId: string | null, date: string) {
  const qc = useQueryClient()
  const mock = isMockMode()
  const invalidate = () => qc.invalidateQueries({ queryKey: key(templateSessionId, date) })

  const decision = useMutation({
    mutationFn: async ({ id, decision }: { id: string; decision: 'accept' | 'dismiss' }) => {
      if (mock) return
      await challengeApi.decide(id, decision)
    },
    onSuccess: mock ? undefined : invalidate,
  })

  return {
    decide: (id: string, d: 'accept' | 'dismiss') => decision.mutate({ id, decision: d }),
    pending: decision.isPending,
  }
}
