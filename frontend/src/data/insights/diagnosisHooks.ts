import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { ApiError } from '@/data/_client/api'
import { isMockMode } from '@/data/_client/mode'
import { diagnosisApi } from '@/data/insights/diagnosisApi'
import { mockDiagnoses } from '@/data/insights/diagnosisMock'
import type { Diagnosis } from '@/data/types'

const DIAGNOSES_KEY = ['diagnoses']

export interface DiagnosesView {
  diagnoses: Diagnosis[]
  mode: 'mock' | 'live'
  isPending: boolean
}

/**
 * The on-demand diagnosis list (mezo-hqfi.4). Mock: the one-report seed. Live: the user's rows,
 * newest first, or [] — the honest empty state; a list endpoint never 404s.
 */
export function useDiagnoses(): DiagnosesView {
  const mock = isMockMode()
  const q = useQuery<Diagnosis[]>({
    queryKey: DIAGNOSES_KEY,
    queryFn: mock ? async () => mockDiagnoses : () => diagnosisApi.list(),
    initialData: mock ? mockDiagnoses : undefined,
    staleTime: mock ? Infinity : undefined,
    retry: false,
  })
  if (mock) {
    return { diagnoses: mockDiagnoses, mode: 'mock', isPending: false }
  }
  return { diagnoses: q.data ?? [], mode: 'live', isPending: q.isPending }
}

export interface DiagnosisView {
  diagnosis: Diagnosis | null
  mode: 'mock' | 'live'
  isPending: boolean
  notFound: boolean
}

/** One diagnosis by id. Mock resolves from the seed; live 404 → notFound (honest, retryless). */
export function useDiagnosis(id: string): DiagnosisView {
  const mock = isMockMode()
  const q = useQuery<Diagnosis>({
    queryKey: [...DIAGNOSES_KEY, id],
    queryFn: () => diagnosisApi.get(id),
    retry: false,
    enabled: !mock,
  })
  if (mock) {
    const seed = mockDiagnoses.find((d) => d.id === id) ?? null
    return { diagnosis: seed, mode: 'mock', isPending: false, notFound: seed == null }
  }
  const notFound = q.error instanceof ApiError && q.error.status === 404
  return { diagnosis: q.data ?? null, mode: 'live', isPending: q.isPending, notFound }
}

export type DiagnosisErrorKind = 'insufficient' | 'quota' | 'failed' | null

/**
 * Generate + probe→experiment (mezo-hqfi.4). BOTH cost real state (an LLM call / an active
 * experiment row), so both are live-only no-ops in mock — the demo buttons stay inert, the
 * `propose` precedent. The 409/429 answers are product states, not failures: they map to
 * `error` kinds the pages render as honest Hungarian copy.
 */
export function useDiagnosisActions() {
  const queryClient = useQueryClient()
  const mock = isMockMode()
  const [error, setError] = useState<DiagnosisErrorKind>(null)
  const invalidate = () => queryClient.invalidateQueries({ queryKey: DIAGNOSES_KEY })

  const toKind = (e: unknown): DiagnosisErrorKind => {
    if (e instanceof ApiError) {
      if (e.status === 429) return 'quota'
      if (e.status === 409) return 'insufficient'
    }
    return 'failed'
  }

  const generateMutation = useMutation({
    mutationFn: async (phenomenon: string) => {
      if (mock) return null
      return diagnosisApi.generate(phenomenon)
    },
    onMutate: () => setError(null),
    onSuccess: mock ? undefined : invalidate,
    onError: (e) => setError(toKind(e)),
  })

  const experimentMutation = useMutation({
    mutationFn: async ({ id, rank }: { id: string; rank: number }) => {
      if (mock) return null
      return diagnosisApi.startExperiment(id, rank)
    },
    onMutate: () => setError(null),
    onSuccess: mock
      ? undefined
      : () => {
          invalidate()
          // The new active experiment must show up on the Kísérletek page too.
          queryClient.invalidateQueries({ queryKey: ['experiments'] })
        },
    onError: (e) => setError(toKind(e)),
  })

  return {
    generate: (phenomenon: string) => generateMutation.mutate(phenomenon),
    /** Resolves with the fresh diagnosis (or null in mock) — the list page navigates to it. */
    generateAsync: (phenomenon: string) => generateMutation.mutateAsync(phenomenon),
    startExperiment: (id: string, rank: number) => experimentMutation.mutate({ id, rank }),
    pending: generateMutation.isPending || experimentMutation.isPending,
    generating: generateMutation.isPending,
    startedRank: experimentMutation.isSuccess ? experimentMutation.variables?.rank ?? null : null,
    error,
  }
}
