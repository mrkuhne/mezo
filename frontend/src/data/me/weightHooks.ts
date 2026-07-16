import { useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { weightApi, type WeightTrendResponse } from '@/data/me/biometricsApi'
import { isMockMode } from '@/data/_client/mode'
import { useDualQuery } from '@/data/useDualQuery'
import { weightLog as initialWeightLog, weightTrends as mockWeightTrends } from '@/data/me/goals'
import type { WeightEntry, WeightLogInput, WeightTrends } from '@/data/types'

// Real-mode unresolved fallback — a ZERO trend, NEVER the mock seed (the "no static
// fallback in real mode" invariant). Fields stay real numbers (consumers call .toFixed()).
const ZERO_TRENDS: WeightTrends = { last7d: { avg: 0, weeklyRate: 0 }, last4w: { weeklyRate: 0 } }

// G5 (mezo-g1u): fold the backend EWMA trend into the WeightTrends shape the views
// read so the Súly cells + the goal hero "Tempó" become REAL in real mode. The
// backend computes the weekly rates (kg/hét) and the latest EWMA trend weight;
// those are the only figures the views render now (the qualitative legs were
// dropped with the placeholder UI — mezo-lfw).
function foldTrend(trend: WeightTrendResponse): WeightTrends {
  return {
    last7d: { avg: trend.latestTrendKg, weeklyRate: trend.weeklyRateKgPerWeek },
    last4w: { weeklyRate: trend.last4wRateKgPerWeek },
  }
}

// The weight half of the former combined goals hook — same ['weightLog'] cache key, same
// dual-mode query+mutation. Real mode also fetches the EWMA trend (mezo-g1u);
// mock mode keeps the static weightTrends so the FE renders offline.
export function useWeight() {
  const qc = useQueryClient()
  const mock = isMockMode()
  const { data: weightLog = [] } = useQuery({
    queryKey: ['weightLog'],
    queryFn: mock ? async () => initialWeightLog : weightApi.list,
    // Mock mode seeds synchronously so the first render matches the Phase-1
    // useState behavior exactly (the visual baselines + component tests). Real mode loads.
    initialData: mock ? initialWeightLog : undefined,
  })
  // weightTrends: mock mode -> the static literal (synchronous initialData so the
  // first render has it); real mode -> fetch the backend EWMA trend and fold its
  // weekly rates into the WeightTrends shape, falling back to the mock literal
  // until the trend query resolves — but in real mode the unresolved fallback is a ZERO
  // trend, never the mock seed (the "no static fallback in real mode" invariant). Consumers
  // only stringify these numbers (hero .toFixed / GoalsPage String), so zeros render as
  // a benign "0.00 kg/hét" for the brief load window, never a fake pace.
  const { data: weightTrends } = useDualQuery({
    queryKey: ['weightTrend'],
    mockData: mockWeightTrends,
    realFetch: async () => foldTrend(await weightApi.trend()),
    realEmpty: ZERO_TRENDS,
  })
  const mutation = useMutation({
    mutationFn: mock
      ? async (input: WeightLogInput): Promise<WeightEntry> =>
          ({ date: input.date, value: input.weightKg, note: input.note })
      : weightApi.log,
    onSuccess: (entry) => {
      if (mock) qc.setQueryData<WeightEntry[]>(['weightLog'], prev => [...(prev ?? []), entry])
      else {
        // A new weigh-in shifts the EWMA trend — refetch both the log and the trend.
        qc.invalidateQueries({ queryKey: ['weightLog'] })
        qc.invalidateQueries({ queryKey: ['weightTrend'] })
      }
    },
  })
  const logWeight = useCallback((input: WeightLogInput) => mutation.mutate(input), [mutation])
  return { weightLog, weightTrends, logWeight }
}
