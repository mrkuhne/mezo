import { useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { weightApi } from '@/lib/biometricsApi'
import { isMockMode } from '@/lib/mode'
import { weightLog as initialWeightLog, weightTrends } from './goals'
import type { WeightEntry, WeightLogInput } from './types'

// The weight half of the former useGoals — same ['weightLog'] cache key, same
// dual-mode query+mutation. weightTrends stays the static mock until the G5
// engine computes real trends.
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
  const mutation = useMutation({
    mutationFn: mock
      ? async (input: WeightLogInput): Promise<WeightEntry> =>
          ({ date: input.date, value: input.weightKg, note: input.note })
      : weightApi.log,
    onSuccess: (entry) => {
      if (mock) qc.setQueryData<WeightEntry[]>(['weightLog'], prev => [...(prev ?? []), entry])
      else qc.invalidateQueries({ queryKey: ['weightLog'] })
    },
  })
  const logWeight = useCallback((input: WeightLogInput) => mutation.mutate(input), [mutation])
  return { weightLog, weightTrends, logWeight }
}
