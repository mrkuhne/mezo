import { useMutation, useQueryClient } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { awardGamificationEvent } from '@/data/gamification/gamificationStore'
import { EMPTY_RITUAL_DAY, mockRitualDay } from '@/data/ritual/ritualMock'
import { ritualApi } from '@/data/ritual/ritualApi'
import type { RitualDay } from '@/data/types'
import { useDualQuery } from '@/data/useDualQuery'

export function useRitualDay(date: string): { data: RitualDay; isPending: boolean } {
  return useDualQuery<RitualDay>({
    queryKey: ['ritualDay', date],
    mockData: mockRitualDay(date),
    realFetch: () => ritualApi.day(date),
    realEmpty: EMPTY_RITUAL_DAY(date),
  })
}

export function useRitualActions(date: string): { close: () => Promise<RitualDay>; pending: boolean } {
  const qc = useQueryClient()
  const mock = isMockMode()
  const mutation = useMutation({
    mutationFn: async (): Promise<RitualDay> => {
      if (mock) {
        const prev = qc.getQueryData<RitualDay>(['ritualDay', date]) ?? mockRitualDay(date)
        if (prev.closed) return prev // idempotent: no second award
        const next = { ...prev, closed: true, closedAt: new Date().toISOString() }
        qc.setQueryData(['ritualDay', date], next)
        awardGamificationEvent(qc, { type: 'HABIT', xpOverride: 10 }) // the evening_ritual catalog XP
        return next
      }
      const day = await ritualApi.close(date)
      for (const key of [['ritualDay', date], ['habitDay', date], ['dailyQuests', date],
        ['gamificationDay', date], ['gamification'], ['progressionProfile']]) {
        qc.invalidateQueries({ queryKey: key })
      }
      return day
    },
  })
  return { close: () => mutation.mutateAsync(), pending: mutation.isPending }
}
