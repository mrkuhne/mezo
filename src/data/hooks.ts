import { useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { today, user, briefing, briefingVariants, workout, volleyballSessions, fuelToday } from './today'
import { initialCheckins } from './checkins'
import { identityGoal, areas, quickSettings, notifSettings, appVersion } from './me'
import { goal, weightLog as initialWeightLog, weightTrends, linkedMesocycles } from './goals'
import { sleepLog, sleepTrends } from './sleep'
import { peopleSummary, people, mentions, relationPatterns } from './people'
import { facts, edges } from './knowledge'
import { patterns, recentlyConfirmed, weekly, weeklySuggestion, memoir, anniversaryNote, predictions, experiments } from './insights'
import { initialChat } from './chat'
import { fuelDay, fuelPlan, supplementsStash, protocol, getScoredMeal } from './fuel'
import { ingredients, recipes, pantrySources, pantryCategoryMeta, pantryImports, pantrySuggestions } from './pantry'
import { retaWeek, gymSchedule, weeklySupplements, recurringPatterns, weeklyStats, replanScenarios, stackRecommendations } from './fuelWeek'
import { mesocycles, activeMeso, workout as trainWorkout, gymSchedule as trainGymSchedule, sport, exerciseLibrary } from './train'
import type { Briefing, CheckinSlot, DayState, FuelSlot, TodayScenario, WeightEntry, WeightLogInput } from './types'

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
  const saveCheckIn = useCallback((idx: number, data: Partial<CheckinSlot>) => {
    setCheckins(prev => prev.map((c, i) => (i === idx ? { ...c, ...data } : c)))
  }, [])
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
  return { user, identityGoal, areas, quickSettings, notifSettings, version: appVersion }
}

export function useGoals() {
  const [weightLog, setWeightLog] = useState<WeightEntry[]>(initialWeightLog)
  const logWeight = useCallback((input: WeightLogInput) => {
    setWeightLog(prev => [...prev, { date: input.date, value: input.weightKg, note: input.note }])
  }, [])
  return { goal, weightLog, weightTrends, linkedMesocycles, logWeight }
}

export function useSleep() {
  return { sleepLog, sleepTrends, lastNight: sleepLog[sleepLog.length - 1] }
}

export function usePeople() {
  return { summary: peopleSummary, people, mentions, patterns: relationPatterns }
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

export function useFuelDay() {
  return { fuel: fuelDay }
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

export function usePantry() {
  return { ingredients, stash: supplementsStash, sources: pantrySources, categoryMeta: pantryCategoryMeta, imports: pantryImports, suggestions: pantrySuggestions }
}

export function useRecipes() {
  return { recipes, ingredients, sources: pantrySources, categoryMeta: pantryCategoryMeta }
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

export function useTrain() {
  return { mesocycles, activeMeso, workout: trainWorkout, gymSchedule: trainGymSchedule, sport, exerciseLibrary }
}
