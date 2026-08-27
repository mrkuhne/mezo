import { patterns, recentlyConfirmed, memoir, anniversaryNote, predictions, experiments } from '@/data/insights/insights'

// Weekly retired from here (mezo-p2tr, moved to /me/week's useMeWeek); the rest stays
// clearly-labelled Phase-1 mock copy until the proactive epic (memoir/predictions/experiments prose).
export function useInsights() {
  return { patterns, recentlyConfirmed, memoir, anniversaryNote, predictions, experiments }
}
