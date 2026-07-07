import { isMockMode } from '@/data/_client/mode'

export interface InsightsTab {
  id: string
  to: string
  label: string
  end?: boolean
}

export const INSIGHTS_TABS: InsightsTab[] = [
  { id: 'patterns', to: '/insights', label: 'Patterns', end: true },
  { id: 'weekly', to: '/insights/weekly', label: 'Weekly' },
  { id: 'memoir', to: '/insights/memoir', label: 'Memoir' },
  { id: 'knowledge', to: '/insights/knowledge', label: 'Knowledge' },
  { id: 'chat', to: '/insights/chat', label: 'Chat' },
  { id: 'predictions', to: '/insights/predictions', label: 'Predictions' },
  { id: 'experiments', to: '/insights/experiments', label: 'Experiments' },
]

/** Phase-3+ demo surfaces that were hidden in real mode until the proactive epic shipped them:
 *  Memoir un-ghosted at W2 (mezo-h4wp.4), Predictions at P1 (mezo-h4wp.7), Experiments at P2
 *  (mezo-h4wp.8). The set is now EMPTY — all seven Insights tabs are real in both modes. */
const PHASE3_TAB_IDS = new Set<string>([])

export function visibleInsightsTabs(): InsightsTab[] {
  return isMockMode() ? INSIGHTS_TABS : INSIGHTS_TABS.filter((t) => !PHASE3_TAB_IDS.has(t.id))
}
