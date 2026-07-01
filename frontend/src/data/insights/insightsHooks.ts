import { facts, edges } from '@/data/insights/knowledge'
import { patterns, recentlyConfirmed, weekly, weeklySuggestion, memoir, anniversaryNote, predictions, experiments } from '@/data/insights/insights'
import { initialChat } from '@/data/insights/chat'

export function useKnowledge() {
  return { facts, edges, activeCount: facts.filter(f => f.active).length }
}

export function useInsights() {
  return { patterns, recentlyConfirmed, weekly, weeklySuggestion, memoir, anniversaryNote, predictions, experiments }
}

export function useChat() {
  return { initialChat }
}
