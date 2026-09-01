import { apiFetch } from '@/data/_client/api'
import type { components } from '@/data/_client/api.gen'
import type {
  Affect, Mention, MentionContext, MentionSource, PersonEntry, PersonSaveInput,
  PersonSourceKind, PersonStatus, Relationship,
} from '@/data/types'

export type PeopleResponse = components['schemas']['PeopleResponse']
export type PersonResponse = components['schemas']['PersonResponse']
export type MentionResponse = components['schemas']['MentionResponse']
export type LogMentionRequest = components['schemas']['LogMentionRequest']
export type CreatePersonRequest = components['schemas']['CreatePersonRequest']
export type UpdatePersonRequest = components['schemas']['UpdatePersonRequest']
export type PersonDecisionRequest = components['schemas']['PersonDecisionRequest']

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
    tone: (m.tone ?? undefined) as Affect | undefined,
    tiedTo: m.tiedToKind && m.tiedToLabel ? { kind: m.tiedToKind, label: m.tiedToLabel } : undefined,
    flagged: m.flagged || undefined,
    intensity: m.intensity ?? undefined,
    contextLabel: m.contextLabel as MentionContext | undefined,
    sourceRefKind: m.sourceRefKind ?? undefined,
  }
}

export function toPersonEntry(p: PersonResponse): PersonEntry {
  return {
    id: p.id,
    name: p.name,
    initial: p.initial,
    relationship: p.relationship as Relationship,
    relationshipHu: p.relationshipHu,
    aliases: p.aliases,
    status: p.status as PersonStatus,
    sourceKind: p.sourceKind as PersonSourceKind,
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
    graphEdges: p.graphEdges,
  }
}

export const peopleApi = {
  bootstrap: () => apiFetch<PeopleResponse>(PEOPLE),
  logMention: (personId: string, tone: Affect, text?: string, contextLabel?: MentionContext) =>
    apiFetch<MentionResponse>(`${PEOPLE}/${personId}/mentions`, {
      method: 'POST',
      body: JSON.stringify({ tone, text, contextLabel } satisfies LogMentionRequest),
    }),
  createPerson: (input: PersonSaveInput) =>
    apiFetch<PersonResponse>(PEOPLE, {
      method: 'POST',
      body: JSON.stringify({
        name: input.name, aliases: input.aliases, relationship: input.relationship,
        relationshipHu: input.relationshipHu, affectBaseline: input.affectBaseline,
        contactCadenceLabel: input.contactCadenceLabel, notes: input.notes,
      } satisfies CreatePersonRequest),
    }),
  updatePerson: (id: string, input: PersonSaveInput) =>
    apiFetch<PersonResponse>(`${PEOPLE}/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: input.name, aliases: input.aliases, relationship: input.relationship,
        relationshipHu: input.relationshipHu, affectBaseline: input.affectBaseline,
        contactCadenceLabel: input.contactCadenceLabel, notes: input.notes,
      } satisfies UpdatePersonRequest),
    }),
  deletePerson: (id: string) => apiFetch<void>(`${PEOPLE}/${id}`, { method: 'DELETE' }),
  decidePerson: (personId: string, decision: 'accept' | 'reject') =>
    apiFetch<PersonResponse>(`${PEOPLE}/${personId}/decision`, {
      method: 'POST',
      body: JSON.stringify({ decision } satisfies PersonDecisionRequest),
    }),
  deleteMention: (personId: string, mentionId: string) =>
    apiFetch<void>(`${PEOPLE}/${personId}/mentions/${mentionId}`, { method: 'DELETE' }),
}
