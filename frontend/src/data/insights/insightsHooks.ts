import { patterns, recentlyConfirmed, weekly, weeklySuggestion, memoir, anniversaryNote, predictions, experiments } from '@/data/insights/insights'

export function useInsights() {
  return { patterns, recentlyConfirmed, weekly, weeklySuggestion, memoir, anniversaryNote, predictions, experiments }
}
