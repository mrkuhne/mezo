import { apiFetch } from '@/data/_client/api'
import type { paths } from '@/data/_client/api.gen'
import type { HabitChain, HabitItem, HabitMode, HabitStatus, HabitSummary } from '@/data/types'
import type { LevelUpResult } from '@/data/train/trainApi'

type HabitDayWire = paths['/api/habit/day/{date}']['get']['responses']['200']['content']['application/json']
type HabitWire = HabitDayWire['habits'][number]
type HabitWriteWire = paths['/api/habit/{key}/check']['post']['responses']['200']['content']['application/json']
type HabitSummaryWire = paths['/api/habit/summary']['get']['responses']['200']['content']['application/json']

export interface HabitDay {
  habits: HabitItem[]
  levelUps: LevelUpResult[]
}

export function toHabit(w: HabitWire): HabitItem {
  return {
    id: w.id,
    key: w.key,
    chain: w.chain as HabitChain,
    position: w.position,
    title: w.title,
    why: w.why,
    anchorCopy: w.anchorCopy,
    mode: w.mode as HabitMode,
    status: w.status as HabitStatus,
    doneAt: w.doneAt ?? null,
    xp: w.xp,
    strengthPct: w.strengthPct ?? null,
  }
}

export const habitApi = {
  day: (date: string): Promise<HabitDay> =>
    apiFetch<HabitDayWire>(`/api/habit/day/${date}`).then((d) => ({
      habits: d.habits.map(toHabit),
      levelUps: (d.levelUps ?? []) as LevelUpResult[],
    })),
  check: (key: string, date: string) =>
    apiFetch<HabitWriteWire>(`/api/habit/${key}/check`, {
      method: 'POST',
      body: JSON.stringify({ date }),
    }).then((r) => ({ habit: toHabit(r.habit), levelUps: (r.levelUps ?? []) as LevelUpResult[] })),
  uncheck: (key: string, date: string): Promise<HabitItem> =>
    apiFetch<HabitWire>(`/api/habit/${key}/check?date=${date}`, { method: 'DELETE' }).then(toHabit),
  summary: (): Promise<HabitSummary> =>
    apiFetch<HabitSummaryWire>(`/api/habit/summary`).then((s): HabitSummary => ({
      perfectMorningDays30: s.perfectMorningDays30,
      perfectEveningDays30: s.perfectEveningDays30,
      habits: s.habits.map((h) => ({
        key: h.key, strengthPct: h.strengthPct ?? null, done28: h.done28, missed28: h.missed28,
      })),
    })),
}
