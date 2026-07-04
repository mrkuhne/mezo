import { apiFetch } from '@/data/_client/api'
import type { components } from '@/data/_client/api.gen'
import type { Affect, Mention, MentionSource, PersonEntry, Relationship } from '@/data/types'

export type PeopleResponse = components['schemas']['PeopleResponse']
export type PersonResponse = components['schemas']['PersonResponse']
export type MentionResponse = components['schemas']['MentionResponse']
export type LogMentionRequest = components['schemas']['LogMentionRequest']

const PEOPLE = '/api/people'

const HU_DOW = ['vasárnap', 'hétfő', 'kedd', 'szerda', 'csütörtök', 'péntek', 'szombat']
const timeLabel = (d: Date) => d.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })

/** Ma / Tegnap / weekday (this week) / hu month-day — display labels are FE-derived in real mode. */
export function mentionDayLabel(ts: string, now: Date = new Date()): string {
  const d = new Date(ts)
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000)
  if (diffDays <= 0) return 'Ma'
  if (diffDays === 1) return 'Tegnap'
  if (diffDays < 7) return HU_DOW[d.getDay()]
  return d.toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' })
}

/** Wire → FE domain: raw data + derived display labels (mock keeps its hand-authored labels). */
export function toMention(m: MentionResponse): Mention {
  return {
    id: m.id,
    ts: m.ts,
    dayLabel: mentionDayLabel(m.ts),
    timeLabel: timeLabel(new Date(m.ts)),
    person_id: m.personId,
    personName: m.personName,
    source: m.source as MentionSource,
    duration_s: m.durationS ?? undefined,
    excerpt: m.excerpt,
    tone: m.tone as Affect,
    tiedTo: m.tiedToKind && m.tiedToLabel ? { kind: m.tiedToKind, label: m.tiedToLabel } : undefined,
    flagged: m.flagged || undefined,
  }
}

export function toPersonEntry(p: PersonResponse): PersonEntry {
  return {
    id: p.id,
    name: p.name,
    initial: p.initial,
    relationship: p.relationship as Relationship,
    relationshipHu: p.relationshipHu,
    affect_baseline: p.affectBaseline as Affect,
    mentionCount: p.mentionCount,
    mentionsThisWeek: p.mentionsThisWeek,
    last_mentioned_at: p.lastMentionedAt ?? '',
    lastMentionLabel: p.lastMentionedAt
      ? `${mentionDayLabel(p.lastMentionedAt)} · ${timeLabel(new Date(p.lastMentionedAt))}`
      : 'Még nincs említés',
    contactCadenceLabel: p.contactCadenceLabel ?? '',
    notes: p.notes ?? '',
    affectTrend: p.affectTrend,
    knownFacts: p.knownFacts,
    ties: p.ties,
  }
}

export const peopleApi = {
  bootstrap: () => apiFetch<PeopleResponse>(PEOPLE),
  logMention: (personId: string, tone: Affect, text?: string) =>
    apiFetch<MentionResponse>(`${PEOPLE}/${personId}/mentions`, {
      method: 'POST',
      body: JSON.stringify({ tone, text } satisfies LogMentionRequest),
    }),
}
