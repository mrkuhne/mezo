import { isMockMode } from '@/data/_client/mode'

export interface InsightsTab {
  id: string
  to: string
  label: string
  end?: boolean
}

export const INSIGHTS_TABS: InsightsTab[] = [
  { id: 'patterns', to: '/mezo', label: 'Minták', end: true },
  { id: 'memoir', to: '/mezo/memoir', label: 'Memoár' },
  { id: 'knowledge', to: '/mezo/knowledge', label: 'Tudástár' },
  { id: 'chat', to: '/mezo/chat', label: 'Chat' },
  { id: 'predictions', to: '/mezo/predictions', label: 'Előrejelzések' },
  { id: 'experiments', to: '/mezo/experiments', label: 'Kísérletek' },
  { id: 'memory', to: '/mezo/memoria', label: 'Memória' },
]

/** Phase-3+ demo surfaces that were hidden in real mode until the proactive epic shipped them:
 *  Memoir un-ghosted at W2 (mezo-h4wp.4), Predictions at P1 (mezo-h4wp.7), Experiments at P2
 *  (mezo-h4wp.8). The set is now EMPTY — mind a nyolc Insights tab valós mindkét módban.
 *  (Motor — a 8. tab — retirálva mezo-tk88.4: a diagnosztika a Minták dashboardba + az S5
 *  minta-részlet oldalba költözött; `/mezo/motor` egy `Navigate` redirect a router.tsx-ben.) */
const PHASE3_TAB_IDS = new Set<string>([])

export function visibleInsightsTabs(): InsightsTab[] {
  return isMockMode() ? INSIGHTS_TABS : INSIGHTS_TABS.filter((t) => !PHASE3_TAB_IDS.has(t.id))
}
