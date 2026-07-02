import { fuelDay, fuelPlan, getScoredMeal } from '@/data/fuel/fuel'
import { retaWeek, gymSchedule, weeklySupplements, recurringPatterns, weeklyStats, replanScenarios, stackRecommendations } from '@/data/fuel/fuelWeek'
import { volleyballSessions } from '@/data/today/today'
import { isMockMode } from '@/data/_client/mode'
import type { FuelSlot } from '@/data/types'

export function useFuelTimeline() {
  return { plan: fuelPlan.today, getScoredMeal: (s: FuelSlot) => getScoredMeal(s, fuelDay.meals) }
}

export function useFuelWeek() {
  return { retaWeek, gymSchedule, weeklySupplements, patterns: recurringPatterns, weeklyStats, volleyball: volleyballSessions }
}

export function useReplanScenarios() {
  return { scenarios: replanScenarios }
}

// Mode-aware: mock serves the Phase-1 recommendation seed; real defers them (no backend
// endpoint yet) — an honest-empty [] instead of leaking the seed into a live user's Stack.
export function useStackRecommendations() {
  return { recommendations: isMockMode() ? stackRecommendations : [] }
}
