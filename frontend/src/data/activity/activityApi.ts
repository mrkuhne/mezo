import { apiFetch } from '@/data/_client/api'
import type { paths } from '@/data/_client/api.gen'
import type { ActivityEntry, DailyQuest, LifeSkillKey } from '@/data/types'
import type { LevelUpResult } from '@/data/train/trainApi'
import { toQuest } from '@/data/quest/questApi'

type ActivityWriteWire =
  paths['/api/activity']['post']['responses']['200']['content']['application/json']
type ActivityWire =
  paths['/api/activity/day/{date}']['get']['responses']['200']['content']['application/json'][number]
type ActivityCreateBody =
  paths['/api/activity']['post']['requestBody']['content']['application/json']
type ActivityCategoryBody =
  paths['/api/activity/{id}/category']['post']['requestBody']['content']['application/json']

export interface ActivityWriteResult {
  entry: ActivityEntry
  completedQuest: DailyQuest | null
  levelUps: LevelUpResult[]
}

export function toActivity(w: ActivityWire): ActivityEntry {
  return {
    id: w.id,
    occurredOn: w.occurredOn,
    text: w.text,
    skillKey: (w.skillKey ?? null) as ActivityEntry['skillKey'],
    confidence: w.confidence ?? null,
    xpAwarded: w.xpAwarded,
    durationMin: w.durationMin ?? null,
    amountHuf: w.amountHuf ?? null,
    categorizedBy: (w.categorizedBy ?? null) as ActivityEntry['categorizedBy'],
    createdAt: w.createdAt,
  }
}

function toWriteResult(w: ActivityWriteWire): ActivityWriteResult {
  return {
    entry: toActivity(w.entry),
    completedQuest: w.completedQuest ? toQuest(w.completedQuest) : null,
    levelUps: (w.levelUps ?? []) as LevelUpResult[],
  }
}

export const activityApi = {
  day: (date: string): Promise<ActivityEntry[]> =>
    apiFetch<ActivityWire[]>(`/api/activity/day/${date}`).then((list) => list.map(toActivity)),
  history: (from: string, to: string): Promise<ActivityEntry[]> =>
    apiFetch<ActivityWire[]>(`/api/activity/history?from=${from}&to=${to}`).then((list) => list.map(toActivity)),
  create: (text: string, occurredOn?: string): Promise<ActivityWriteResult> =>
    apiFetch<ActivityWriteWire>('/api/activity', {
      method: 'POST',
      body: JSON.stringify({ text, occurredOn } satisfies ActivityCreateBody),
    }).then(toWriteResult),
  categorize: (id: string, skillKey: LifeSkillKey): Promise<ActivityWriteResult> =>
    apiFetch<ActivityWriteWire>(`/api/activity/${id}/category`, {
      method: 'POST',
      body: JSON.stringify({ skillKey } satisfies ActivityCategoryBody),
    }).then(toWriteResult),
}
