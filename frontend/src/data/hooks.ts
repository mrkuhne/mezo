import { useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { isMockMode } from '@/lib/mode'
import { localDateString } from '@/shared/lib/dates'
import { sleepApi, checkinApi } from '@/lib/biometricsApi'
import { today, user, briefing, briefingVariants, workout, volleyballSessions, fuelToday } from '@/data/today'
import { initialCheckins } from '@/data/checkins'
import { sleepLog as initialSleepLog } from '@/data/sleep'
import { people, mentions as initialMentions } from '@/data/people'
import { facts, edges } from '@/data/knowledge'
import { patterns, recentlyConfirmed, weekly, weeklySuggestion, memoir, anniversaryNote, predictions, experiments } from '@/data/insights'
import { initialChat } from '@/data/chat'
import { fuelDay, fuelPlan, supplementsStash, protocol, getScoredMeal } from '@/data/fuel'
import { retaWeek, gymSchedule, weeklySupplements, recurringPatterns, weeklyStats, replanScenarios, stackRecommendations } from '@/data/fuelWeek'
import { useMedication } from '@/data/medicationHooks'
import type { Briefing, CheckinSlot, DayState, FuelSlot, TodayScenario, SleepEntry, SleepLogInput, Mention, MentionLogInput } from '@/data/types'

export function useTodayScenario(): TodayScenario {
  const [params] = useSearchParams()
  const day = params.get('day')
  const dayState: DayState = day === 'good' || day === 'rough' ? day : 'medium'
  // The retaDay base is the real medication cycle in real mode (the single FE source every
  // Reta surface reads), the mock default in mock mode. cycle.retaDay is 0 when there is no
  // medication / no dose (the ghost, or the cold-load window) → fall back to today.retaDay so
  // nothing ever shows a 0 day. The ?retaDay= URL override stays TOP priority in BOTH modes.
  const { cycle } = useMedication()
  const base = isMockMode() ? today.retaDay : cycle.retaDay || today.retaDay
  const retaRaw = parseInt(params.get('retaDay') ?? '', 10)
  const retaDay = Number.isFinite(retaRaw) ? Math.min(7, Math.max(1, retaRaw)) : base
  const niggle = params.get('niggle') !== 'off'
  const vulnerable = params.get('vulnerable') === 'on'
  return { dayState, retaDay, niggle, vulnerable, anchorMode: dayState === 'rough' }
}

export function resolveBriefing(dayState: DayState): Briefing {
  const variant = briefingVariants[dayState]
  return variant ? { ...briefing, ...variant } : briefing
}

export function useToday() {
  return { today, user, briefing, workout, volleyballSessions, fuelToday }
}

export function useCheckins() {
  const [checkins, setCheckins] = useState<CheckinSlot[]>(initialCheckins)
  const mock = isMockMode()
  const mutation = useMutation({
    mutationFn: checkinApi.save,
    onError: (err) => console.error('Check-in sync failed', err),
  })
  const saveCheckIn = useCallback((idx: number, data: Partial<CheckinSlot>) => {
    setCheckins(prev => {
      const next = prev.map((c, i) => (i === idx ? { ...c, ...data } : c))
      if (!mock) {
        const slot = next[idx]
        const v = slot.values
        const today = localDateString()
        mutation.mutate({
          date: today, slotTime: slot.time, state: slot.state ?? 'done',
          energy: v?.energy, stress: v?.stress, body: v?.body, mental: v?.mental,
          note: slot.note ?? undefined,
        })
      }
      return next
    })
  }, [mock, mutation])
  return { checkins, saveCheckIn }
}

export function useFuelPreview() {
  const slots = fuelToday.slots
  const nowIdx = slots.findIndex(s => s.state === 'now')
  const start = Math.max(0, nowIdx)
  const visible = slots.slice(start, start + 3)
  const nextStack = slots.find(s => s.state !== 'done' && (s.items ?? []).some(it => !it.done))
  return { visible, nextStack }
}

export function useProfile() {
  return { user }
}

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

export function usePeople() {
  const [mentions, setMentions] = useState<Mention[]>(initialMentions)
  const logMention = useCallback((input: MentionLogInput) => {
    const now = new Date()
    const person = people.find(p => p.id === input.personId)
    const newMention: Mention = {
      id: crypto.randomUUID(),
      ts: now.toISOString(),
      dayLabel: 'Ma',
      timeLabel: now.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' }),
      person_id: input.personId,
      personName: person?.name ?? '',
      source: 'chip',
      excerpt: input.text ?? '',
      tone: input.tone,
    }
    setMentions(prev => [newMention, ...prev])
  }, [])
  return { people, mentions, logMention }
}

export function useKnowledge() {
  return { facts, edges, activeCount: facts.filter(f => f.active).length }
}

export function useInsights() {
  return { patterns, recentlyConfirmed, weekly, weeklySuggestion, memoir, anniversaryNote, predictions, experiments }
}

export function useChat() {
  return { initialChat }
}

export function useFuelTimeline() {
  return { plan: fuelPlan.today, getScoredMeal: (s: FuelSlot) => getScoredMeal(s, fuelDay.meals) }
}

export function useStack() {
  return { stash: supplementsStash }
}

export function useProtocol() {
  return { protocol }
}

export function useFuelWeek() {
  return { retaWeek, gymSchedule, weeklySupplements, patterns: recurringPatterns, weeklyStats, volleyball: volleyballSessions }
}

export function useReplanScenarios() {
  return { scenarios: replanScenarios }
}

export function useStackRecommendations() {
  return { recommendations: stackRecommendations }
}

// The Train hook (queries + T1 write mutations) lives in trainHooks.ts —
// re-exported here so consumer import paths stay `@/data/hooks`.
export { useTrain } from '@/data/trainHooks'
export { useRunning } from '@/data/runningHooks'
export { useWeight } from '@/data/weightHooks'
export { usePantry, usePantryActions } from '@/data/pantryHooks'
export { useRecipes, useRecipeActions } from '@/data/recipeHooks'
export { useFuelDay, useMealActions, useRecipeLogs } from '@/data/fuelHooks'
export { useMedicationActions } from '@/data/medicationHooks'
export { useMedication }
export { useGoal, useGoalCreation, useGoalActions, useFeasibilityPreview } from '@/data/goalHooks'
export { useBiometricProfile, useBiometricActions } from '@/data/biometricHooks'
export { useProgressionProfile } from '@/data/progressionHooks'
