import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { sleepApi } from '@/data/me/biometricsApi'
import { sleepLog as initialSleepLog } from '@/data/me/sleep'
import type { SleepEntry, SleepLogInput } from '@/data/types'

export function useSleep() {
  const qc = useQueryClient()
  const mock = isMockMode()
  const { data: sleepLog = [] } = useQuery({
    queryKey: ['sleepLog'],
    queryFn: mock ? async () => initialSleepLog : sleepApi.list,
    // Mock mode seeds synchronously so the first render matches the Phase-1
    // useState behavior exactly (parity + component tests). Real mode loads.
    initialData: mock ? initialSleepLog : undefined,
  })
  const mutation = useMutation({
    mutationFn: mock
      ? async (input: SleepLogInput): Promise<SleepEntry> => ({
          date: input.date, bedtime: input.bedtime, wakeup: input.wakeup,
          duration: input.durationH, quality: input.quality, awakenings: input.awakenings,
          mealToSleep: 0, notes: input.note ?? null,
        })
      : sleepApi.log,
    onSuccess: (entry) => {
      if (mock) qc.setQueryData<SleepEntry[]>(['sleepLog'], prev => [...(prev ?? []), entry])
      else qc.invalidateQueries({ queryKey: ['sleepLog'] })
    },
  })
  const logSleep = useCallback((input: SleepLogInput) => mutation.mutate(input), [mutation])
  return { sleepLog, lastNight: sleepLog[sleepLog.length - 1], logSleep }
}
