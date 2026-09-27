// ============================================================
// Mezo · knowledgeHubApi — a Tudástár hub drótja (S6, mezo-d6ivw.6): a megerősített
// észrevételek + a belőlük tanult tények állapota, és az alanyonként csoportosított hatások.
// `KnowledgeObservation` itt lakik (nem data/types.ts-ben), mert az `EvidenceItem`-et hordozza a
// `shared/ui/evidence`-ből — a types.ts szándékosan mentes a `shared/` importoktól.
// ============================================================
import { apiFetch } from '@/data/_client/api'
import type { components } from '@/data/_client/api.gen'
import { toPersonEffect } from '@/data/me/personEffectsApi'
import type { EffectSubject, FactMuteReason } from '@/data/types'
import { mapEvidence, type EvidenceItem } from '@/shared/ui/evidence/observationEvidence'

export type KnowledgeObservationResponse = components['schemas']['KnowledgeObservationResponse']
type EffectResponse = components['schemas']['EffectResponse']
type PersonEffectsResponse = components['schemas']['PersonEffectsResponse']
type ObservationEvidenceItem = components['schemas']['ObservationEvidenceItem']
type KnowledgeFactResponse = components['schemas']['KnowledgeFactResponse']
type UpdateFactRequest = components['schemas']['UpdateFactRequest']
type EffectMuteRequest = components['schemas']['EffectMuteRequest']

export interface KnowledgeObservation {
  patternId: string
  title: string
  confirmedAt: string
  recheckedAt: string | null
  status: 'confirmed' | 'refuted'
  factId: string | null
  factMutedReason: FactMuteReason | null
  factMutedAt: string | null
  replacesPatternId: string | null
  replacedByPatternId: string | null
  topicKey: string | null
  evidence: EvidenceItem[]
  /** Raw wire source keys of the record items (mapEvidence renames them for display). */
  evidenceSources: string[]
}

export function toKnowledgeObservation(w: KnowledgeObservationResponse): KnowledgeObservation {
  return {
    patternId: w.patternId,
    title: w.title,
    confirmedAt: w.confirmedAt,
    recheckedAt: w.recheckedAt ?? null,
    status: w.status,
    factId: w.factId ?? null,
    factMutedReason: w.factMutedReason ?? null,
    factMutedAt: w.factMutedAt ?? null,
    replacesPatternId: w.replacesPatternId ?? null,
    replacedByPatternId: w.replacedByPatternId ?? null,
    topicKey: w.topicKey ?? null,
    evidence: w.evidence.map(mapEvidence),
    evidenceSources: w.evidence.flatMap((e) => (e.type === 'record' && e.source ? [e.source] : [])),
  }
}

/** The wire is flat (one row per subject×metric); the hub is per SUBJECT (one card, one mute). */
export function groupEffectSubjects(rows: EffectResponse[]): EffectSubject[] {
  const byId = new Map<string, EffectSubject>()
  for (const r of rows) {
    if (!r.subjectLabel) continue
    const id = `${r.subjectKind}:${r.subjectKey}`
    const subject = byId.get(id) ?? { kind: r.subjectKind, key: r.subjectKey, label: r.subjectLabel, muted: false, effects: [] }
    subject.muted = subject.muted || r.muted
    subject.effects.push(toPersonEffect(r))
    byId.set(id, subject)
  }
  return [...byId.values()]
}

const FACT = '/api/companion/fact'
const OBSERVATION = '/api/companion/observation'
const EFFECTS = '/api/companion/effects'

export const knowledgeHubApi = {
  listObservations: async () =>
    (await apiFetch<KnowledgeObservationResponse[]>(`${OBSERVATION}/knowledge`)).map(toKnowledgeObservation),
  factEvidence: async (factId: string) =>
    (await apiFetch<ObservationEvidenceItem[]>(`${FACT}/${factId}/evidence`)).map(mapEvidence),
  forgetFact: (factId: string) => apiFetch<void>(`${FACT}/${factId}`, { method: 'DELETE' }),
  forgetObservation: (patternId: string) => apiFetch<void>(`${OBSERVATION}/${patternId}`, { method: 'DELETE' }),
  editFact: (factId: string, text: string) =>
    apiFetch<KnowledgeFactResponse>(`${FACT}/${factId}`, {
      method: 'PATCH',
      body: JSON.stringify({ factText: text } satisfies UpdateFactRequest),
    }),
  listEffects: async () => groupEffectSubjects((await apiFetch<PersonEffectsResponse>(EFFECTS)).effects),
  muteEffect: (kind: 'person' | 'event', key: string, mode: 'muted' | 'forgotten') =>
    apiFetch<void>(`${EFFECTS}/${kind}/${encodeURIComponent(key)}/mute`, {
      method: 'PUT',
      body: JSON.stringify({ mode } satisfies EffectMuteRequest),
    }),
  unmuteEffect: (kind: 'person' | 'event', key: string) =>
    apiFetch<void>(`${EFFECTS}/${kind}/${encodeURIComponent(key)}/mute`, { method: 'DELETE' }),
}
