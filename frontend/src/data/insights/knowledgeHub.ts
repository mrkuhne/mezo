// ============================================================
// Mezo · knowledgeHub — mock seeds for the Tudástár hub (S6, mezo-d6ivw.6): the megerősített
// észrevételek (`KnowledgeObservation`), az alanyonként csoportosított hatások
// (`EffectSubject`) és a tény-bizonyíték cache (`MOCK_FACT_EVIDENCE`). Kis méretű, de a UI
// minden állapotát lefedi (sosem ellenőrzött, cáfolt, drift-pár, elhallgattatott alany) —
// tartalmilag a docs/design_2.0/prototypes/uveg-tudastar-hub.html-t tükrözi kisebb léptékben.
// `MOCK_FACT_EVIDENCE_SOURCES` a mock evidence-elemek MELLETT a nyers wire forrás-kulcsokat is
// megőrzi, hogy a test/msw/handlers.ts `GET .../evidence` végpontja hiteles drótot tudjon
// visszaépíteni belőlük (lásd `evidenceToWire` ott).
// ============================================================
import { MOCK_PERSON_EFFECTS } from '@/data/me/people'
import type { EffectSubject } from '@/data/types'
import type { EvidenceItem } from '@/shared/ui/evidence/observationEvidence'
import type { KnowledgeObservation } from '@/data/insights/knowledgeHubApi'

// --- o1: Alvás — plain confirmed, rendszeresen újraellenőrizve, ebből tanultuk f8-at ---
const O1_EVIDENCE: EvidenceItem[] = [
  { kind: 'record', source: 'Alvás', icon: 't-sleep', title: 'Alvás', date: '2026-09-18', values: [] },
  { kind: 'tag', text: 'r=0,4' },
]
const O1_EVIDENCE_SOURCES = ['sleep_log']

// --- f2 bizonyítéka: saját chat-idézet ---
const F2_EVIDENCE: EvidenceItem[] = [
  {
    kind: 'record', source: 'Saját chatüzenet', icon: 't-chat', title: 'Saját chatüzenet',
    date: '2026-08-11', quote: 'Du. 2 után nem kávézom, mert este nem tudok elaludni.', values: [],
  },
]
const F2_EVIDENCE_SOURCES = ['ai_message']

export const MOCK_OBSERVATIONS: KnowledgeObservation[] = [
  {
    patternId: 'o1', title: 'A késői vacsora és a felszínes alvás együtt mozog.',
    confirmedAt: '2026-08-30T08:00:00Z', recheckedAt: '2026-09-20T03:40:00Z', status: 'confirmed',
    factId: 'f8', factMutedReason: null, factMutedAt: null,
    replacesPatternId: null, replacedByPatternId: null, topicKey: 'alvas-vacsora',
    evidence: O1_EVIDENCE, evidenceSources: O1_EVIDENCE_SOURCES,
  },
  {
    // sosem ellenőrizve újra — a negyedéves recheck még nem futott le rajta.
    patternId: 'o2', title: 'A rövid alvás utáni napon kisebb az edzésvolumened.',
    confirmedAt: '2026-09-03T07:00:00Z', recheckedAt: null, status: 'confirmed',
    factId: null, factMutedReason: null, factMutedAt: null,
    replacesPatternId: null, replacedByPatternId: null, topicKey: 'edzes-volumen',
    evidence: [{ kind: 'record', source: 'Edzés', icon: 't-dumbbell', title: 'Edzés', date: '2026-08-29', values: [] }],
    evidenceSources: ['workout_session'],
  },
  {
    // cáfolt — a negyedéves recheck nem igazolta vissza.
    patternId: 'o4', title: 'Edzés után mindig kevesebb a stresszed.',
    confirmedAt: '2026-08-22T06:00:00Z', recheckedAt: '2026-09-16T03:40:00Z', status: 'refuted',
    factId: null, factMutedReason: null, factMutedAt: null,
    replacesPatternId: null, replacedByPatternId: null, topicKey: 'edzes-stressz',
    evidence: [{ kind: 'tag', text: '2/6 éjszaka igazolta' }], evidenceSources: [],
  },
  {
    // drift-pár, régi fele: felülírta a szept. 21-i újraellenőrzés.
    patternId: 'o3old', title: 'Randi után estére lemerülsz.',
    confirmedAt: '2026-08-12T06:00:00Z', recheckedAt: '2026-09-21T03:40:00Z', status: 'confirmed',
    factId: null, factMutedReason: null, factMutedAt: null,
    replacesPatternId: null, replacedByPatternId: 'o3', topicKey: 'kapcsolatok-randi',
    evidence: [{ kind: 'tag', text: '3× megerősítve' }], evidenceSources: [],
  },
  {
    // drift-pár, új fele.
    patternId: 'o3', title: 'Mostanában a randis napok estéje is feltölt.',
    confirmedAt: '2026-09-21T07:00:00Z', recheckedAt: '2026-09-21T03:40:00Z', status: 'confirmed',
    factId: null, factMutedReason: null, factMutedAt: null,
    replacesPatternId: 'o3old', replacedByPatternId: null, topicKey: 'kapcsolatok-randi',
    evidence: [{ kind: 'tag', text: '1× megerősítve' }], evidenceSources: [],
  },
]

/** S6 (mezo-d6ivw.6) — a Tudástár Hatások szakasza: 3 személy (Ádám elhallgattatva) + 2 esemény.
 *  A személy-alanyok a `MOCK_PERSON_EFFECTS` azonosítóit használják, hogy a Rólad-oldal és a hub
 *  ugyanarról a Petráról/Bencéről beszéljen. */
export const MOCK_EFFECT_SUBJECTS: EffectSubject[] = [
  { kind: 'person', key: 'pp-petra', label: 'Petra', muted: false, effects: MOCK_PERSON_EFFECTS['pp-petra'] },
  { kind: 'person', key: 'pp-bence', label: 'Bence', muted: false, effects: MOCK_PERSON_EFFECTS['pp-bence'] },
  {
    kind: 'person', key: 'pp-adam', label: 'Ádám', muted: true,
    effects: [{ metric: 'mental', direction: 'higher', strength: 'kozepes', confidence: 'kozepes', meanDiff: 0.35, subjectDays: 8 }],
  },
  {
    kind: 'event', key: 'edzes', label: 'Edzésnapok', muted: false,
    effects: [{ metric: 'stress', direction: 'lower', strength: 'eros', confidence: 'eros', meanDiff: 0.9, subjectDays: 20 }],
  },
  {
    kind: 'event', key: 'mizu-pentek', label: 'Mizu-péntek', muted: false,
    effects: [{ metric: 'energy', direction: 'higher', strength: 'kozepes', confidence: 'gyenge', meanDiff: 0.5, subjectDays: 6 }],
  },
]

/** Tény-azonosító → bizonyíték-sorok ("Honnan tudom?"). f8 az o1 észrevétel sorait örökli —
 *  egy dolog, két nézet, ugyanaz a bizonyíték. */
export const MOCK_FACT_EVIDENCE: Record<string, EvidenceItem[]> = {
  f2: F2_EVIDENCE,
  f8: O1_EVIDENCE,
}

/** A fenti evidence-elemek NYERS wire forrás-kulcsai (index szerint párosítva a `kind: 'record'`
 *  elemekkel) — kizárólag a test/msw/handlers.ts wire-visszaépítéséhez kell, a UI nem olvassa. */
export const MOCK_FACT_EVIDENCE_SOURCES: Record<string, string[]> = {
  f2: F2_EVIDENCE_SOURCES,
  f8: O1_EVIDENCE_SOURCES,
}
