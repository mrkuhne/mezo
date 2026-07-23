import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { sleepApi, sleepGoalApi, sleepShotApi } from '@/data/me/biometricsApi'
import { sleepLog as initialSleepLog } from '@/data/me/sleep'
import { mockSleepGoal, SLEEP_GOAL_GHOST, composeSleepGoal } from '@/data/me/sleepGoal'
import { MOCK_SLEEP_SHOT_DRAFT } from '@/data/me/sleepShot'
import { awardGamificationEvent } from '@/data/gamification/gamificationStore'
import { useDualQuery } from '@/data/useDualQuery'
import type { SleepEntry, SleepLogInput, SleepGoal, SleepGoalInput, SleepShotDraft } from '@/data/types'

export function useSleep() {
  const qc = useQueryClient()
  const mock = isMockMode()
  const { data: sleepLog = [] } = useQuery({
    queryKey: ['sleepLog'],
    queryFn: mock ? async () => initialSleepLog : sleepApi.list,
    // Mock mode seeds synchronously so the first render matches the Phase-1
    // useState behavior exactly (the visual baselines + component tests). Real mode loads.
    initialData: mock ? initialSleepLog : undefined,
  })
  const mutation = useMutation({
    mutationFn: mock
      ? async (input: SleepLogInput): Promise<SleepEntry> => ({
          date: input.date, bedtime: input.bedtime, wakeup: input.wakeup,
          duration: input.durationH, quality: input.quality, awakenings: input.awakenings,
          mealToSleep: 0, notes: input.note ?? null,
          inBedMin: input.inBedMin ?? null,
          awakeMin: input.awakeMin ?? null, lightMin: input.lightMin ?? null,
          remMin: input.remMin ?? null, deepMin: input.deepMin ?? null,
          sourceQualityPct: input.sourceQualityPct ?? null,
          source: input.source ?? 'manual',
        })
      : sleepApi.log,
    onSuccess: (entry) => {
      if (mock) {
        qc.setQueryData<SleepEntry[]>(['sleepLog'], prev => [...(prev ?? []), entry])
        awardGamificationEvent(qc, { type: 'SLEEP' })
      } else qc.invalidateQueries({ queryKey: ['sleepLog'] })
    },
  })
  const logSleep = useCallback((input: SleepLogInput) => mutation.mutate(input), [mutation])
  return { sleepLog, lastNight: sleepLog[sleepLog.length - 1], logSleep }
}

export function useSleepGoal() {
  const { data, isPending } = useDualQuery<SleepGoal>({
    queryKey: ['sleepGoal'],
    mockData: mockSleepGoal,
    realFetch: sleepGoalApi.get,
    realEmpty: SLEEP_GOAL_GHOST, // backend never 404s; the ghost is the honest pre-resolve value
  })
  return { goal: data, isPending }
}

export function useSleepGoalActions() {
  const qc = useQueryClient()
  const mock = isMockMode()
  const mutation = useMutation({
    mutationFn: async (input: SleepGoalInput) => {
      if (mock) {
        qc.setQueryData<SleepGoal>(['sleepGoal'], composeSleepGoal(input))
        return
      }
      await sleepGoalApi.set(input)
    },
    onSuccess: mock ? undefined : () => {
      qc.invalidateQueries({ queryKey: ['sleepGoal'] })
      qc.invalidateQueries({ queryKey: ['habitDay'] })  // wake/bed habits re-center
      qc.invalidateQueries({ queryKey: ['fuelDay'] })   // meal slots cascade off the anchor
    },
  })
  return {
    setGoal: (input: SleepGoalInput) => mutation.mutateAsync(input).then(() => undefined),
    pending: mutation.isPending,
  }
}

/** Sleep Cycle screenshot → draft (mezo-66ab). Stateless extraction — no query key, nothing to invalidate. */
export function useSleepShot() {
  const mock = isMockMode()
  const mutation = useMutation({
    mutationFn: async (photo: File): Promise<SleepShotDraft> => {
      if (mock) return MOCK_SLEEP_SHOT_DRAFT
      return sleepShotApi.extract(photo)
    },
  })
  return { extract: (photo: File) => mutation.mutateAsync(photo), pending: mutation.isPending }
}
