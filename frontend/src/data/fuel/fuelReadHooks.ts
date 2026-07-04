import { replanScenarios, stackRecommendations } from '@/data/fuel/fuelWeek'
import { isMockMode } from '@/data/_client/mode'

// NOTE: useFuelTimeline moved to `@/data/fuel/timelineHooks` (Fuel P5) and useFuelWeek to
// `@/data/fuel/fuelWeekHooks` (Fuel P4) — both became composed dual-mode hooks; the static
// readers lived here. The two below stay mock-only until Fuel P8 (mezo-0h6w).

export function useReplanScenarios() {
  return { scenarios: replanScenarios }
}

// Mode-aware: mock serves the Phase-1 recommendation seed; real defers them (no backend
// endpoint yet) — an honest-empty [] instead of leaking the seed into a live user's Stack.
export function useStackRecommendations() {
  return { recommendations: isMockMode() ? stackRecommendations : [] }
}
