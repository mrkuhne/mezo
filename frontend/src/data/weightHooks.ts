import { useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { weightApi, type WeightTrendResponse } from '@/lib/biometricsApi'
import { isMockMode } from '@/lib/mode'
import { weightLog as initialWeightLog, weightTrends as mockWeightTrends } from './goals'
import type { WeightEntry, WeightLogInput, WeightTrends } from './types'

// G5 (mezo-g1u): fold the backend EWMA trend into the WeightTrends shape the views
// read so the Súly cells + the goal hero "Tempó" become REAL in real mode. The
// backend computes the weekly rates (kg/hét) and the latest EWMA trend; the
// qualitative legs the engine does not yet produce (factors/insights/projection,
// the 4-week avg/delta) keep the static mock values so the views still render
// (these become real once Fuel intake + the Insights pipeline land). The hero +
// rate cells read weeklyRate/avg, which are the fields we overwrite here.
function foldTrend(trend: WeightTrendResponse): WeightTrends {
  return {
    ...mockWeightTrends,
    last7d: {
      ...mockWeightTrends.last7d,
      avg: trend.latestTrendKg,
      weeklyRate: trend.weeklyRateKgPerWeek,
    },
    last4w: {
      ...mockWeightTrends.last4w,
      weeklyRate: trend.last4wRateKgPerWeek,
    },
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
    // useState behavior exactly (parity + component tests). Real mode loads.
    initialData: mock ? initialWeightLog : undefined,
  })
  // weightTrends: mock mode -> the static literal (synchronous initialData so the
  // first render has it); real mode -> fetch the backend EWMA trend and fold its
  // weekly rates into the WeightTrends shape, falling back to the mock literal
  // until the trend query resolves.
  const { data: weightTrends = mockWeightTrends } = useQuery({
    queryKey: ['weightTrend'],
    queryFn: mock
      ? async () => mockWeightTrends
      : async () => foldTrend(await weightApi.trend()),
    initialData: mock ? mockWeightTrends : undefined,
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
