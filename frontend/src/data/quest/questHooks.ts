import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { questApi, type QuestDay } from '@/data/quest/questApi'
import { mockQuestDay, mockQuestHistory, mockRerollSpare } from '@/data/quest/questMock'
import { useDualQuery } from '@/data/useDualQuery'
import type { LevelUpResult } from '@/data/train/trainApi'
import type { DailyQuest } from '@/data/types'

const key = (d: string) => ['dailyQuests', d]

const MOCK_DAY: QuestDay = { quests: mockQuestDay, levelUps: [], rerollsLeft: 1 }
const EMPTY_DAY: QuestDay = { quests: [], levelUps: [], rerollsLeft: 0 }

export interface DailyQuestsView {
  quests: DailyQuest[]
  levelUps: LevelUpResult[]
  rerollsLeft: number
  mode: 'mock' | 'live'
}

/**
 * The day's quests. Real mode: GET lazily generates (today) and evaluates derived completion —
 * levelUps carries payloads produced by THAT read only (safe to feed showLevelUp; re-reads
 * return []). While unresolved returns the empty day, never the seed (no-static-fallback rule).
 */
export function useDailyQuests(date: string): DailyQuestsView {
  const mock = isMockMode()
  const q = useQuery<QuestDay>({
    queryKey: key(date),
    queryFn: mock ? async () => MOCK_DAY : () => questApi.day(date),
    initialData: mock ? MOCK_DAY : undefined,
    staleTime: mock ? Infinity : undefined,
    retry: false,
  })
  const data = q.data ?? (mock ? MOCK_DAY : EMPTY_DAY)
  return { ...data, mode: mock ? 'mock' : 'live' }
}

/** Quest history for a date range (Growth journal). Terminal statuses only — the builder
 *  drops any still-live offered/rerolled rows defensively. */
export function useQuestHistory(from: string, to: string) {
  return useDualQuery<DailyQuest[]>({
    queryKey: ['questHistory', from, to],
    mockData: mockQuestHistory,
    realFetch: () => questApi.history(from, to),
    realEmpty: [],
  })
}

/** Reroll (1/day). Mock: swaps the quest client-side from the spare pool (inert economy). */
export function useQuestActions(date: string) {
  const qc = useQueryClient()
  const mock = isMockMode()

  const rerollM = useMutation({
    mutationFn: mock
      ? async (id: string) => {
          qc.setQueryData<QuestDay>(key(date), (d) => {
            const base = d ?? MOCK_DAY
            return {
              ...base,
              rerollsLeft: Math.max(0, base.rerollsLeft - 1),
              quests: base.quests.map(q => (q.id === id ? { ...mockRerollSpare, slot: q.slot } : q)),
            }
          })
        }
      : (id: string) => questApi.reroll(id).then(() => undefined),
    onSuccess: mock ? undefined : () => qc.invalidateQueries({ queryKey: key(date) }),
  })

  return {
    reroll: (id: string) => rerollM.mutate(id),
    pending: rerollM.isPending,
    /**
     * Consume-once for the level-up payloads: clears levelUps from the cached day after the
     * overlay fired. Without this a Today → Train → Today remount within gcTime replays the
     * cached payload (the only showLevelUp caller driven by a cached-query effect, not a
     * mutation onSuccess).
     */
    consumeLevelUps: () =>
      qc.setQueryData<QuestDay>(key(date), (d) => d && { ...d, levelUps: [] }),
  }
}
