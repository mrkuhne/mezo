import type { ChatRecalledMemory } from '@/data/types'
import type { MemoryItem, TurnLearned, TurnMemory, TurnProposed } from '@/data/insights/turnMemoryApi'

/** S8 (mezo-d6ivw.12) demo seed — all four chip variants (lesson 16: mock anchors are
 *  `mock-turn-<i>`). Session turn 0 learns Dóri + proposes one owner fact, turn 1 learns Anna +
 *  Bence, a forget request forgets turn 1. Mirrors docs/design_2.0/prototypes/elo/mezo.html S8F. */
const AT_22_05 = '2026-09-26T20:05:00Z'
const AT_22_07 = '2026-09-26T20:07:00Z'
const DORI: TurnLearned = { id: 'mock-pf-dori', personId: 'mock-person-dori', who: 'Dóri', kind: 'relationship_state',
  text: 'a strandröpi-párod, együtt nyertétek a szeptemberi tornát' }
const ANNA: TurnLearned = { id: 'mock-pf-anna', personId: 'mock-person-anna', who: 'Anna', kind: 'preference',
  text: 'régi csapattársad, rég beszéltetek' }
const BENCE: TurnLearned = { id: 'mock-pf-bence', personId: 'mock-person-bence', who: 'Bence', kind: 'shared_activity',
  text: 'jövőre hármasban játszana veled és Annával' }
const SELF: TurnProposed = { id: 'mock-lf-self', state: 'ask', promotedFactId: null,
  text: 'Egy nagy közös élmény után nehezen viselem az egyedül töltött estét.' }

const asItem = (f: TurnLearned, createdAt: string): MemoryItem => ({
  kind: 'person_fact', refId: f.id, personId: f.personId, who: f.who, text: f.text, createdAt, pending: false,
})

export const MOCK_TURN_MEMORY: TurnMemory[] = [
  { learned: [DORI], proposed: [SELF], forgotten: [] },
  { learned: [ANNA, BENCE], proposed: [], forgotten: [] },
]
export const MOCK_FORGOTTEN_TURN: TurnMemory = {
  learned: [], proposed: [], forgotten: [asItem(ANNA, AT_22_07), asItem(BENCE, AT_22_07)],
}
export const MOCK_FORGET_ALL_PREVIEW: MemoryItem[] = [
  asItem(DORI, AT_22_05),
  { kind: 'fact_candidate', refId: SELF.id, personId: null, who: null, text: SELF.text, createdAt: AT_22_05, pending: true },
]
export const MOCK_PERSON_RECALL: ChatRecalledMemory[] = [
  { kind: 'person', label: 'Dóri', gist: 'tavasz óta a strandröpi-párod\nhétköznap ritkán ér rá, inkább hétvégén játszotok', similarity: 1 },
  { kind: 'person', label: 'Bence', gist: 'az egyetem óta ismeritek\nő szervezi a szombati edzéseket', similarity: 1 },
]

/** Mock-only echo of the backend ForgetIntent — just enough to route the demo. */
export function looksLikeForget(text: string): boolean {
  const f = text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
  return !/ne felejtsd el/.test(f) && /ne jegyezd meg|felejtsd el|ne mentsd|ne tarold/.test(f)
}

export function mockTurnMemory(ordinal: number, text: string): TurnMemory {
  return looksLikeForget(text) ? MOCK_FORGOTTEN_TURN : MOCK_TURN_MEMORY[ordinal % MOCK_TURN_MEMORY.length]
}
