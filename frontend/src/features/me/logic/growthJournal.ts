import type { ActivityEntry, DailyQuest } from '@/data/types'

export type JournalEntry =
  | { kind: 'quest'; quest: DailyQuest }
  | { kind: 'activity'; activity: ActivityEntry }

export interface JournalDay {
  date: string
  label: string
  xpTotal: number
  entries: JournalEntry[]
}

const MONTHS_HU = ['Jan', 'Feb', 'Már', 'Ápr', 'Máj', 'Jún', 'Júl', 'Aug', 'Szep', 'Okt', 'Nov', 'Dec']

export function dayLabel(dateIso: string, todayIso: string): string {
  if (dateIso === todayIso) return 'Ma'
  const d = new Date(dateIso + 'T00:00:00')
  const t = new Date(todayIso + 'T00:00:00')
  if (t.getTime() - d.getTime() === 86_400_000) return 'Tegnap'
  return `${MONTHS_HU[d.getMonth()]} ${d.getDate()}`
}

/** Merge quests + activities into descending day groups with day XP totals.
 *  Offered (still-live) quests are excluded — they belong to Today, not the journal. */
export function buildGrowthJournal(
  quests: DailyQuest[],
  activities: ActivityEntry[],
  todayIso: string,
): JournalDay[] {
  const byDate = new Map<string, JournalEntry[]>()
  const push = (date: string, e: JournalEntry) => {
    const list = byDate.get(date) ?? []
    list.push(e)
    byDate.set(date, list)
  }
  for (const q of quests) {
    if (q.status === 'offered' || q.status === 'rerolled') continue
    push(q.questDate, { kind: 'quest', quest: q })
  }
  for (const a of activities) push(a.occurredOn, { kind: 'activity', activity: a })

  return [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([date, entries]) => ({
      date,
      label: dayLabel(date, todayIso),
      xpTotal: entries.reduce((sum, e) =>
        sum + (e.kind === 'quest'
          ? (e.quest.status === 'completed' ? e.quest.xp : 0)
          : e.activity.xpAwarded), 0),
      entries,
    }))
}
