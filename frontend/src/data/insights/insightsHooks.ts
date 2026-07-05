import { patterns, recentlyConfirmed, memoir, anniversaryNote, predictions, experiments } from '@/data/insights/insights'

// Weekly went dual-mode (weeklyHooks.ts, D' mezo-t16y.1); the rest stays clearly-labelled
// Phase-1 mock copy until the proactive epic (memoir/predictions/experiments prose).
export function useInsights() {
  return { patterns, recentlyConfirmed, memoir, anniversaryNote, predictions, experiments }
}
