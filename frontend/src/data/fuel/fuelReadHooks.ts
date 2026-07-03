import { retaWeek, gymSchedule, weeklySupplements, recurringPatterns, weeklyStats, replanScenarios, stackRecommendations } from '@/data/fuel/fuelWeek'
import { volleyballSessions } from '@/data/today/today'
import { isMockMode } from '@/data/_client/mode'

// NOTE: useFuelTimeline moved to `@/data/fuel/timelineHooks` (Fuel P5) — it became a composed
// dual-mode hook (mock seed vs. buildDayPlan real composition); the static reader lived here.

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
