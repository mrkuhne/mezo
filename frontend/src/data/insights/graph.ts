import type { LifeEventCandidate, KnowledgeGraphNode, GraphNodeKind } from '@/data/types'

/**
 * Mock-mód seed (W2.3): egyetlen, hihető életesemény-jelölt — a demó ugyanazt mutatja, amit egy
 * éles éjszaka hozna, sose többet. A dátum fix, hogy a vizuális goldenek stabilak maradjanak.
 */
export const lifeEventCandidateSeed: LifeEventCandidate[] = [
  {
    id: 'le-1',
    kind: 'LIFE_EVENT',
    title: 'Új munkahely első hete',
    summary: 'A naplód szerint hétfőn kezdtél az új helyen, és a hét végére kimerültél.',
    occurredOn: '2026-08-21',
    proposedEdgeCount: 1,
  },
  {
    id: 'se-1',
    kind: 'SEASON',
    title: 'Nyári alapozás',
    summary: 'A nyár a volumenről szólt: több gym nap, kevesebb futás, stabil alvás.',
    occurredOn: '2026-07-01',
    proposedEdgeCount: 0,
  },
]

/**
 * W5.3 (mezo-b3pp.20): jelölt-fajtánkénti copy. Egy szezon NEM a napod szövegeiből jött, hanem
 * két negyedév összevetéséből — közös kártya, de a provenienciát fajtánként kell kimondani
 * (IDENT-6: a megerősítés sosem néma, és sosem hazudik arról, honnan jött a javaslat).
 */
export const CANDIDATE_COPY: Record<LifeEventCandidate['kind'], { eyebrow: string; provenance: string }> = {
  LIFE_EVENT: {
    eyebrow: 'Életesemény-jelöltek',
    provenance: 'Ezt a napod szövegeiből szűrtem ki — csak akkor kerül a gráfba, ha elfogadod.',
  },
  SEASON: {
    eyebrow: 'Szezon-jelöltek',
    provenance: 'Ezt a negyedév és az előző negyedév összefoglalóiból olvastam ki — csak akkor '
      + 'kerül a gráfba, ha elfogadod.',
  },
}

/** W4.3 (mezo-b3pp.17): the singleton profile node's `source_kind` (backend
 *  `ProfileAssembler.SOURCE_PROFILE`) — the Tudástár splits it out of the kind groups by this. */
export const PROFILE_SOURCE_KIND = 'profile'

/**
 * Mock-mód seed (W2.6): négy csomópont különböző kind-ekből, néhány kapcsolattal — ugyanazt a
 * Hungarian sorformátumot használva, amit a backend `GraphEdgeLineRenderer` (és a régi
 * `[Összefüggések]` prompt blokk) renderel, hogy a demó és az éles felület sose térjen el.
 */
export const graphNodeSeed: KnowledgeGraphNode[] = [
  {
    id: 'gn-1',
    kind: 'PATTERN',
    title: 'Késői evés rontja az alvást',
    summary: null,
    topEdges: [
      'Késői evés → kiváltja → Rossz alvás · erős',
      'Rossz alvás → támogatja → Gyenge edzés · közepes',
    ],
    sourceKind: null,
  },
  {
    id: 'gn-2',
    kind: 'PREFERENCE',
    title: 'Niggle-aware exercise substitution preferred',
    summary: null,
    topEdges: [],
    sourceKind: null,
  },
  {
    id: 'gn-3',
    kind: 'GOAL',
    title: 'Identity goal: peak performance every life domain',
    summary: null,
    topEdges: [
      'Identity goal: peak performance every life domain → kapcsolódik → PR celebration moments · gyenge',
    ],
    sourceKind: null,
  },
  {
    id: 'gn-4',
    kind: 'LIFE_EVENT',
    title: 'Új munkahely első hete',
    summary: 'Hétfőn kezdtél az új helyen, és a hét végére kimerültél.',
    topEdges: ['Új munkahely első hete → kiváltja → Megnövekedett stressz · közepes'],
    sourceKind: null,
  },
  {
    id: 'gn-profile',
    kind: 'INSIGHT',
    title: 'Rólad tanultam',
    summary:
      'A rövid, konkrét reggeli üzenet válik be nálad; a hosszabb elemzést délben olvasod el, '
      + 'a bőséges tipplistát pedig rendre elutasítod.',
    sourceKind: PROFILE_SOURCE_KIND,
    topEdges: [],
  },
]

/** Ordered kind → Hungarian label groups for the "Kapcsolatok" section (mirrors the backend enum
 *  `GraphNodeResponse.KindEnum`). */
export const GRAPH_KIND_GROUPS: Array<[GraphNodeKind, string]> = [
  ['PATTERN', 'Minták'],
  ['PREFERENCE', 'Preferenciák'],
  ['GOAL', 'Célok'],
  ['LIFE_EVENT', 'Életesemények'],
  ['SEASON', 'Szezonok'],
  ['INSIGHT', 'Belátások'],
]
