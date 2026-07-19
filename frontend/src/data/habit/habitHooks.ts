import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { awardGamificationEvent } from '@/data/gamification/gamificationStore'
import { habitApi, type HabitDay } from '@/data/habit/habitApi'
import { mockHabitDay, mockHabitSummary } from '@/data/habit/habitMock'
import type { HabitItem, HabitSummary } from '@/data/types'
import type { LevelUpResult } from '@/data/train/trainApi'
import { useDualQuery } from '@/data/useDualQuery'

const key = (d: string) => ['habitDay', d]

const MOCK_DAY: HabitDay = { habits: mockHabitDay, levelUps: [] }
const EMPTY_DAY: HabitDay = { habits: [], levelUps: [] }

export interface HabitDayView extends HabitDay {
  mode: 'mock' | 'live'
}

/**
 * The day's habit chains. Real mode: GET lazily creates + evaluates today's rows and derived
 * completion server-side, so it deliberately re-reads on every mount/focus (staleTime 0) — the
 * READ is the domain's lazy-evaluation heartbeat. While unresolved returns the empty day, never
 * the seed (no-static-fallback rule). levelUps carries payloads produced by THAT read only.
 */
export function useHabitDay(date: string): HabitDayView {
  const mock = isMockMode()
  const q = useQuery<HabitDay>({
    queryKey: key(date),
    queryFn: mock ? async () => MOCK_DAY : () => habitApi.day(date),
    initialData: mock ? MOCK_DAY : undefined,
    staleTime: mock ? Infinity : 0, // real mode re-reads every mount (READ-triggered server eval)
    retry: false,
  })
  const data = q.data ?? (mock ? MOCK_DAY : EMPTY_DAY)
  return { ...data, mode: mock ? 'mock' : 'live' }
}

export function useHabitActions(date: string) {
  const qc = useQueryClient()
  const mock = isMockMode()

  const patchMock = (habitKey: string, status: HabitItem['status']) => {
    qc.setQueryData<HabitDay>(key(date), (d) =>
      d && {
        ...d,
        habits: d.habits.map((h) =>
          h.key === habitKey
            ? { ...h, status, doneAt: status === 'done' ? new Date().toISOString() : null }
            : h),
      })
  }

  const checkM = useMutation({
    mutationFn: async (habitKey: string) => {
      if (mock) {
        patchMock(habitKey, 'done')
        const xp = mockHabitDay.find((h) => h.key === habitKey)?.xp ?? 0
        awardGamificationEvent(qc, { type: 'HABIT', xpOverride: xp })
        return undefined
      }
      return habitApi.check(habitKey, date).then((r) => r.levelUps)
    },
    onSuccess: mock
      ? undefined
      : () => {
          qc.invalidateQueries({ queryKey: key(date) })
          qc.invalidateQueries({ queryKey: ['habitSummary'] })
          qc.invalidateQueries({ queryKey: ['progressionProfile'] })
        },
  })
  // NOTE: check() resolves the write's levelUps — the caller (RoutineCard) feeds them to showLevelUp.

  const uncheckM = useMutation({
    mutationFn: async (habitKey: string) => {
      if (mock) {
        patchMock(habitKey, 'pending')
        return undefined
      }
      return habitApi.uncheck(habitKey, date).then(() => undefined)
    },
    onSuccess: mock
      ? undefined
      : () => {
          qc.invalidateQueries({ queryKey: key(date) })
          qc.invalidateQueries({ queryKey: ['habitSummary'] })
          qc.invalidateQueries({ queryKey: ['progressionProfile'] })
        },
  })

  return {
    check: (habitKey: string) => checkM.mutateAsync(habitKey),
    uncheck: (habitKey: string) => uncheckM.mutateAsync(habitKey),
    pending: checkM.isPending || uncheckM.isPending,
    consumeLevelUps: () =>
      qc.setQueryData<HabitDay>(key(date), (d) => d && { ...d, levelUps: [] as LevelUpResult[] }),
  }
}

export function useHabitSummary() {
  return useDualQuery<HabitSummary>({
    queryKey: ['habitSummary'],
    mockData: mockHabitSummary,
    realFetch: habitApi.summary,
    realEmpty: { perfectMorningDays30: 0, perfectEveningDays30: 0, habits: [] },
  })
}
