// Aggregate FE↔data boundary. Every consumer imports its hooks from '@/data/hooks';
// the implementations live in the per-domain hook modules — this file only re-exports,
// so consumer import paths and the dual-mode contract stay stable.
export { useTodayScenario, resolveBriefing, useToday, useFuelPreview } from '@/data/today/todayHooks'
export { useCheckins } from '@/data/today/checkinHooks'
export { useSleep } from '@/data/me/sleepHooks'
export { useProfile, usePeople } from '@/data/me/meHooks'
export { useKnowledge, useInsights, useChat } from '@/data/insights/insightsHooks'
export { useFuelTimeline, useStack, useProtocol, useFuelWeek, useReplanScenarios, useStackRecommendations } from '@/data/fuel/fuelReadHooks'
export { useTrain } from '@/data/train/trainHooks'
export { useRunning } from '@/data/train/runningHooks'
export { useWeight } from '@/data/me/weightHooks'
export { usePantry, usePantryActions } from '@/data/fuel/pantryHooks'
export { useRecipes, useRecipeActions } from '@/data/fuel/recipeHooks'
export { useFuelDay, useMealActions, useRecipeLogs } from '@/data/fuel/fuelHooks'
export { useMedication, useMedicationActions } from '@/data/fuel/medicationHooks'
export { useGoal, useGoalCreation, useGoalActions, useFeasibilityPreview } from '@/data/me/goalHooks'
export { useBiometricProfile, useBiometricActions } from '@/data/me/biometricHooks'
export { useProgressionProfile } from '@/data/progression/progressionHooks'
