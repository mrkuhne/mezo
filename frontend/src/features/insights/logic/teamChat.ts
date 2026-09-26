/**
 * A csapat-chat tiszta logikája (Csapatfal Act III, mezo-a9bo7.24): a nap sorainak napszakos
 * csoportosítása, a fal élő sávjának szövege, az olvasatlan-szám és a szoba chipjei. Semmit nem
 * fogalmaz — minden szöveg a sorokból jön (ADR 0049).
 */
import type { TeamChatDay, TeamChatLine } from '@/data/character/teamChatApi'
import type { TeamCharacterId } from '@/features/insights/logic/team'

export type DayPart = 'REGGEL' | 'DÉLBEN' | 'DÉLUTÁN' | 'ESTE' | 'ÉJJEL'

export interface DayPartGroup {
  part: DayPart
  lines: TeamChatLine[]
}

/** 05–11 reggel · 11–14 délben · 14–18 délután · 18–22 este · különben éjjel (helyi idő). */
export function dayPartOf(iso: string): DayPart {
  const h = new Date(iso).getHours()
  if (h >= 5 && h < 11) return 'REGGEL'
  if (h >= 11 && h < 14) return 'DÉLBEN'
  if (h >= 14 && h < 18) return 'DÉLUTÁN'
  if (h >= 18 && h < 22) return 'ESTE'
  return 'ÉJJEL'
}

const byTime = (a: TeamChatLine, b: TeamChatLine) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt)

/** Időrendben, egymás utáni napszak-futamokra bontva — a hajnali és a késő esti „éjjel” külön blokk. */
export function groupByDayPart(lines: TeamChatLine[]): DayPartGroup[] {
  const groups: DayPartGroup[] = []
  for (const l of [...lines].sort(byTime)) {
    const part = dayPartOf(l.occurredAt)
    const last = groups[groups.length - 1]
    if (last && last.part === part) last.lines.push(l)
    else groups.push({ part, lines: [l] })
  }
  return groups
}

const isCharacterLine = (l: TeamChatLine): l is TeamChatLine & { character: TeamCharacterId } =>
  l.kind !== 'USER' && l.character != null

/** A fal élő sávja: a nap legutóbbi karakter-sora (ki mondta + mit), vagy null, ha még csend van. */
export function stripText(day: TeamChatDay): { speaker: TeamCharacterId; text: string } | null {
  const latest = day.lines.filter(isCharacterLine).sort(byTime).at(-1)
  return latest ? { speaker: latest.character, text: latest.body } : null
}

/** A `lastSeenIso` óta érkezett karakter-sorok száma (lastSeen nélkül: mind). */
export function unreadCount(day: TeamChatDay, lastSeenIso: string | null): number {
  const seen = lastSeenIso ? Date.parse(lastSeenIso) : Number.NEGATIVE_INFINITY
  return day.lines.filter(l => isCharacterLine(l) && Date.parse(l.occurredAt) > seen).length
}

/** A szoba chipjei: nyitott ügyek (bármely napról), a nap lezárásai, és a napi értesítés-keret. */
export function chips(day: TeamChatDay): { open: number; resolved: number; pushes: `${number} / ${number}` } {
  return {
    open: day.openThreads.length,
    resolved: day.lines.filter(l => l.kind === 'RESOLVE').length,
    pushes: `${day.pushesToday} / ${day.pushBudget}`,
  }
}

/** Helyi óra:perc egy sor/ügy időbélyegéből. */
export function clockOf(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** A localStorage-kulcs, ahová a szoba a megnyitás idejét írja (a fal élő sávja olvassa). */
export const TEAM_CHAT_LAST_SEEN_KEY = 'boop.teamChat.lastSeen'
