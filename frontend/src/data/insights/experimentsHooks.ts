import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { experimentsApi } from '@/data/insights/experimentsApi'
import { experiments as mockExperiments } from '@/data/insights/insights'
import type { Experiment } from '@/data/types'

const EXPERIMENTS_KEY = ['experiments']

export interface ExperimentsView {
  experiments: Experiment[]
  mode: 'mock' | 'live'
}

/**
 * N=1 experiments (proactive P2). Mock: the Phase-1 seed (byte parity). Live: the user's live
 * experiments (proposed/active/completed), or [] (loading/error) — the page renders its honest
 * empty state. A list endpoint never 404s.
 */
export function useExperiments(): ExperimentsView {
  const mock = isMockMode()
  const q = useQuery<Experiment[]>({
    queryKey: EXPERIMENTS_KEY,
    queryFn: mock ? async () => mockExperiments : () => experimentsApi.list(),
    initialData: mock ? mockExperiments : undefined,
    staleTime: mock ? Infinity : undefined,
    retry: false,
  })
  if (mock) {
    return { experiments: mockExperiments, mode: 'mock' }
  }
  return { experiments: q.data ?? [], mode: 'live' }
}

/**
 * The L2 accept/dismiss + on-demand propose surface. Persisted in real mode (invalidates the list);
 * a no-op in mock (the seed has no proposed rows / no propose backend — the demo button is inert).
 */
export function useExperimentActions() {
  const queryClient = useQueryClient()
  const mock = isMockMode()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: EXPERIMENTS_KEY })

  const decision = useMutation({
    mutationFn: async ({ id, decision }: { id: string; decision: 'accept' | 'dismiss' }) => {
      if (mock) return
      await experimentsApi.decide(id, decision)
    },
    onSuccess: mock ? undefined : invalidate,
  })

  const proposal = useMutation({
    mutationFn: async () => {
      if (mock) return
      await experimentsApi.propose()
    },
    onSuccess: mock ? undefined : invalidate,
  })

  return {
    decide: (id: string, decision: 'accept' | 'dismiss') => decision.mutate({ id, decision }),
    propose: () => proposal.mutate(),
    pending: decision.isPending || proposal.isPending,
  }
}
