import { useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { isMockMode } from '@/lib/mode'
import { localDateString } from '@/lib/dates'
import { sleepApi, checkinApi } from '@/lib/biometricsApi'
import { today, user, briefing, briefingVariants, workout, volleyballSessions, fuelToday } from './today'
import { initialCheckins } from './checkins'
import { sleepLog as initialSleepLog } from './sleep'
import { people, mentions as initialMentions } from './people'
import { facts, edges } from './knowledge'
import { patterns, recentlyConfirmed, weekly, weeklySuggestion, memoir, anniversaryNote, predictions, experiments } from './insights'
import { initialChat } from './chat'
import { fuelDay, fuelPlan, supplementsStash, protocol, getScoredMeal } from './fuel'
import { retaWeek, gymSchedule, weeklySupplements, recurringPatterns, weeklyStats, replanScenarios, stackRecommendations } from './fuelWeek'
import type { Briefing, CheckinSlot, DayState, FuelSlot, TodayScenario, SleepEntry, SleepLogInput, Mention, MentionLogInput } from './types'

export function useTodayScenario(): TodayScenario {
  const [params] = useSearchParams()
  const day = params.get('day')
  const dayState: DayState = day === 'good' || day === 'rough' ? day : 'medium'
  const retaRaw = parseInt(params.get('retaDay') ?? '', 10)
  const retaDay = Number.isFinite(retaRaw) ? Math.min(7, Math.max(1, retaRaw)) : today.retaDay
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
export { useTrain } from './trainHooks'
export { useRunning } from './runningHooks'
export { useWeight } from './weightHooks'
export { usePantry, usePantryActions } from './pantryHooks'
export { useRecipes, useRecipeActions } from './recipeHooks'
export { useFuelDay, useMealActions, useRecipeLogs } from './fuelHooks'
export { useMedication, useMedicationActions } from './medicationHooks'
export { useGoal, useGoalCreation, useGoalActions, useFeasibilityPreview } from './goalHooks'
export { useBiometricProfile, useBiometricActions } from './biometricHooks'
