import { useQuery } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { predictionsApi } from '@/data/insights/predictionsApi'
import { predictions as mockPredictions } from '@/data/insights/insights'
import type { Prediction } from '@/data/types'

export interface PredictionsView {
  predictions: Prediction[]
  mode: 'mock' | 'live'
}

/**
 * Pattern-grounded predictions (proactive P1). Mock: the Phase-1 seed (byte parity). Live: all
 * live predictions from the engine, or [] (loading/error) — the page renders its honest empty
 * state. An empty array is the honest live default (a list endpoint never 404s).
 */
export function usePredictions(): PredictionsView {
  const mock = isMockMode()
  const q = useQuery<Prediction[]>({
    queryKey: ['predictions'],
    queryFn: mock ? async () => mockPredictions : () => predictionsApi.list(),
    initialData: mock ? mockPredictions : undefined,
    staleTime: mock ? Infinity : undefined,
    retry: false,
  })
  if (mock) {
    return { predictions: mockPredictions, mode: 'mock' }
  }
  return { predictions: q.data ?? [], mode: 'live' }
}
