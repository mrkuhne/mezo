import { apiFetch } from '@/data/_client/api'
import type { paths } from '@/data/_client/api.gen'
import type { LevelUpResult } from '@/data/train/trainApi'
import type { DailyQuest, QuestCompletionMode, QuestSlot, QuestStatus } from '@/data/types'

type QuestDayWire =
  paths['/api/quest/day/{date}']['get']['responses']['200']['content']['application/json']
type QuestWire = QuestDayWire['quests'][number]

export interface QuestDay {
  quests: DailyQuest[]
  levelUps: LevelUpResult[]
  rerollsLeft: number
}

export function toQuest(w: QuestWire): DailyQuest {
  return {
    id: w.id,
    questDate: w.questDate,
    slot: w.slot as QuestSlot,
    skillKey: w.skillKey,
    title: w.title,
    why: w.why,
    targetLabel: w.targetLabel,
    metric: w.metric ?? '',
    xp: w.xp,
    status: w.status as QuestStatus,
    completionMode: (w.completionMode ?? 'DERIVED') as QuestCompletionMode,
    completedAt: w.completedAt ?? null,
  }
}

export const questApi = {
  day: (date: string): Promise<QuestDay> =>
    apiFetch<QuestDayWire>(`/api/quest/day/${date}`).then((d) => ({
      quests: d.quests.map(toQuest),
      levelUps: (d.levelUps ?? []) as LevelUpResult[],
      rerollsLeft: d.rerollsLeft,
    })),
  reroll: (id: string): Promise<DailyQuest> =>
    apiFetch<QuestWire>(`/api/quest/${id}/reroll`, { method: 'POST' }).then(toQuest),
  history: (from: string, to: string): Promise<DailyQuest[]> =>
    apiFetch<QuestWire[]>(`/api/quest/history?from=${from}&to=${to}`).then((list) => list.map(toQuest)),
}
