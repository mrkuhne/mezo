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
