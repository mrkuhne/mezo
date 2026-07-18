import { useMutation, useQueryClient } from '@tanstack/react-query'
import { activityApi, type ActivityWriteResult } from '@/data/activity/activityApi'
import { mockActivities, mockActivityHistory } from '@/data/activity/activityMock'
import { isMockMode } from '@/data/_client/mode'
import { useDualQuery } from '@/data/useDualQuery'
import { awardGamificationEvent } from '@/data/gamification/gamificationStore'
import type { ActivityEntry, LifeSkillKey } from '@/data/types'

const key = (d: string) => ['activities', d]

export function useActivities(date: string): { data: ActivityEntry[]; isPending: boolean } {
  return useDualQuery<ActivityEntry[]>({
    queryKey: key(date),
    mockData: mockActivities,
    realFetch: () => activityApi.day(date),
    realEmpty: [],
  })
}

/** Activity-log history for a date range (Growth journal). */
export function useActivityHistory(from: string, to: string): { data: ActivityEntry[]; isPending: boolean } {
  return useDualQuery<ActivityEntry[]>({
    queryKey: ['activityHistory', from, to],
    mockData: mockActivityHistory,
    realFetch: () => activityApi.history(from, to),
    realEmpty: [],
  })
}

/** Mock-mode write result: deterministic AI verdict so the sheet flow is fully demoable. */
function mockWrite(text: string, date: string): ActivityWriteResult {
  const entry: ActivityEntry = {
    id: `act-m-${text.length}-${date}`,
    occurredOn: date,
    text,
    skillKey: 'learning',
    confidence: 0.9,
    xpAwarded: 15,
    durationMin: null,
    amountHuf: null,
    categorizedBy: 'AI',
  }
  return { entry, completedQuest: null, levelUps: [] }
}

export function useActivityActions(date: string) {
  const qc = useQueryClient()
  const mock = isMockMode()

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: key(date) })
    qc.invalidateQueries({ queryKey: ['dailyQuests', date] })
    qc.invalidateQueries({ queryKey: ['progressionProfile'] })
  }

  const logM = useMutation({
    mutationFn: async (text: string) => {
      if (mock) {
        const res = mockWrite(text, date)
        qc.setQueryData<ActivityEntry[]>(key(date), (d) => [res.entry, ...(d ?? [])])
        awardGamificationEvent(qc, { type: 'ACTIVITY', xpOverride: res.entry.xpAwarded ?? 0 })
        return res
      }
      return activityApi.create(text, date)
    },
    onSuccess: mock ? undefined : invalidate,
  })

  const catM = useMutation({
    mutationFn: async (input: { id: string; skillKey: LifeSkillKey }) => {
      if (mock) {
        let updated: ActivityEntry | undefined
        qc.setQueryData<ActivityEntry[]>(key(date), (d) =>
          (d ?? []).map((e) => {
            if (e.id !== input.id) return e
            updated = { ...e, skillKey: input.skillKey, xpAwarded: e.xpAwarded || 10, categorizedBy: 'USER' }
            return updated
          }),
        )
        return {
          entry: updated!,
          completedQuest: null,
          levelUps: [],
        } satisfies ActivityWriteResult
      }
      return activityApi.categorize(input.id, input.skillKey)
    },
    onSuccess: mock ? undefined : invalidate,
  })

  return {
    logActivity: (text: string) => logM.mutateAsync(text),
    categorize: (id: string, skillKey: LifeSkillKey) => catM.mutateAsync({ id, skillKey }),
    pending: logM.isPending || catM.isPending,
  }
}
