import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
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
 * Mock-mode mirror of a server-side DERIVED completion (real mode re-derives the row on the
 * next habitDay read; the mock has no evaluator, so the owning surface's mutation flips the
 * chain row here — mezo-o5hx). Seeds the day from the mock seed when no surface mounted it
 * yet. Returns whether the row actually flipped, so callers can gate a one-time XP award.
 */
export function completeMockDerivedHabit(qc: QueryClient, date: string, habitKey: string): boolean {
  const day = qc.getQueryData<HabitDay>(key(date)) ?? MOCK_DAY
  const target = day.habits.find((h) => h.key === habitKey)
  if (!target || target.status !== 'pending') {
    return false
  }
  qc.setQueryData<HabitDay>(key(date), {
    ...day,
    habits: day.habits.map((h) =>
      h.key === habitKey ? { ...h, status: 'done', doneAt: new Date().toISOString() } : h),
  })
  return true
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
  // NOTE: check() resolves the write's levelUps — the caller feeds them to showLevelUp.
  // Callers today: TodayPage's `act()` dispatcher (every habit row on all three daypart
  // faces) and WindDownBanner (the `wind_down` Pipa). RoutineCard, the original caller,
  // was retired by the daypart-faces re-composition (mezo-j7u4).

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
