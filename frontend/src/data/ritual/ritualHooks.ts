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
      // mezo-ywz1: the derived evening_ritual completion (+10 XP + level_up) is persisted ONLY by
      // the GET /api/habit/day the server gates it on. RitualPage mounts useHabitDay so this
      // invalidation refetches; await it so the +10 lands in level_up_event BEFORE the harvest reads.
      await qc.invalidateQueries({ queryKey: ['habitDay', date] })
      // Now the +10 exists → re-read the harvest aggregate + account rollup (they must NOT run
      // concurrently with the habitDay refetch, or they race the award persistence).
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['gamificationDay', date] }),
        qc.invalidateQueries({ queryKey: ['gamification'] }),
        qc.invalidateQueries({ queryKey: ['progressionProfile'] }),
      ])
      qc.invalidateQueries({ queryKey: ['dailyQuests', date] }) // not harvest-critical — fire-and-forget
      qc.invalidateQueries({ queryKey: ['ritualDay', date] })
      return day
    },
  })
  return { close: () => mutation.mutateAsync(), pending: mutation.isPending }
}
