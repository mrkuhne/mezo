import { fuelDay, fuelPlan, supplementsStash, protocol, getScoredMeal } from '@/data/fuel/fuel'
import { retaWeek, gymSchedule, weeklySupplements, recurringPatterns, weeklyStats, replanScenarios, stackRecommendations } from '@/data/fuel/fuelWeek'
import { volleyballSessions } from '@/data/today/today'
import type { FuelSlot } from '@/data/types'

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
