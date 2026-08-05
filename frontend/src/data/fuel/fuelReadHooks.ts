import { replanScenarios } from '@/data/fuel/fuelWeek'
import { isMockMode } from '@/data/_client/mode'

// NOTE: useFuelTimeline moved to `@/data/fuel/timelineHooks` (Fuel P5) and useFuelWeek to
// `@/data/fuel/fuelWeekHooks` (Fuel P4) — both became composed dual-mode hooks; the static
// reader below lived here. Its sibling mock-only recommendation-seed reader was retired in Task 8
// (mezo-vx9v) — the occurrence-based Stack page has no recommendation-card concept anymore.

// Mode-aware (X audit, mezo-t16y.4): mock serves the Phase-1 replan fixtures; real defers
// them (the replan engine is Fuel P8) — honest-empty [] so a live user never sees fabricated
// scenarios (FuelMaiPage hides the Replan CTA when the list is empty).
export function useReplanScenarios() {
  return { scenarios: isMockMode() ? replanScenarios : [] }
}
