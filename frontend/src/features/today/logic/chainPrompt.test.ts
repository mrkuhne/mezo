import { nextInChain } from '@/features/today/logic/chainPrompt'
import type { HabitCatalog, HabitDefInfo, HabitItem } from '@/data/types'

/** Only the fields the rule reads — the page's own catalog stubs are equally partial. */
const def = (habitKey: string, anchorHabitKey: string | null): Partial<HabitDefInfo> =>
  ({ habitKey, anchorHabitKey })

const catalogOf = (...defs: Partial<HabitDefInfo>[]): HabitCatalog => ({
  chains: [{
    id: 'c-m', chainKey: 'MORNING', title: 'Reggeli rutin', daypart: 'MORNING',
    position: 1, isActive: true, defs,
  }] as unknown as HabitCatalog['chains'],
})

const row = (key: string, over: Partial<HabitItem> = {}): HabitItem => ({
  key, chain: 'MORNING', position: 1, title: key, why: '', anchorCopy: null,
  mode: 'MANUAL', status: 'pending', xp: 5, strengthPct: null, ...over,
} as HabitItem)

test('a horgonyra kötött nyitott szokást adja vissza', () => {
  const catalog = catalogOf(def('a', null), def('b', 'a'))
  const habits = [row('a', { position: 1 }), row('b', { position: 2 })]
  expect(nextInChain(catalog, habits, 'a')?.key).toBe('b')
})

test('nincs kötés → null', () => {
  const catalog = catalogOf(def('a', null), def('b', null))
  expect(nextInChain(catalog, [row('a'), row('b')], 'a')).toBeNull()
})

test('a már kész láncolt szokás csendet ér', () => {
  const catalog = catalogOf(def('a', null), def('b', 'a'))
  const habits = [row('a'), row('b', { status: 'done' })]
  expect(nextInChain(catalog, habits, 'a')).toBeNull()
})

test('a kihagyott (missed) láncolt szokás sem prompt', () => {
  const catalog = catalogOf(def('a', null), def('b', 'a'))
  const habits = [row('a'), row('b', { status: 'missed' })]
  expect(nextInChain(catalog, habits, 'a')).toBeNull()
})

test('DERIVED láncolt szokás csendet ér — egy DERIVED sor sosem pipálja magát (ADR 0010)', () => {
  const catalog = catalogOf(def('a', null), def('morning_weigh_in', 'a'))
  const habits = [row('a'), row('morning_weigh_in', { mode: 'DERIVED' })]
  expect(nextInChain(catalog, habits, 'a')).toBeNull()
})

test('fan-out: a legkisebb position-ű nyitott jelölt nyer', () => {
  const catalog = catalogOf(def('a', null), def('b', 'a'), def('c', 'a'))
  const habits = [row('a', { position: 1 }), row('c', { position: 3 }), row('b', { position: 2 })]
  expect(nextInChain(catalog, habits, 'a')?.key).toBe('b')
})

test('fan-out: a kész jelölt kiesik, a mögötte lévő nyitott nyer', () => {
  const catalog = catalogOf(def('a', null), def('b', 'a'), def('c', 'a'))
  const habits = [
    row('a', { position: 1 }), row('b', { position: 2, status: 'done' }), row('c', { position: 3 }),
  ]
  expect(nextInChain(catalog, habits, 'a')?.key).toBe('c')
})

test('a katalógusban létező, de a mai napban hiányzó jelölt kiesik', () => {
  const catalog = catalogOf(def('a', null), def('b', 'a'))
  expect(nextInChain(catalog, [row('a')], 'a')).toBeNull()
})

test('ismeretlen kulcsra null', () => {
  const catalog = catalogOf(def('a', null), def('b', 'a'))
  expect(nextInChain(catalog, [row('a'), row('b')], 'nincs-ilyen')).toBeNull()
})

test('önhorgony nem promptolja saját magát', () => {
  // A validátor tiltja, de egy régi sor hordozhatja — a szabály nem dőlhet be tőle.
  const catalog = catalogOf(def('a', 'a'))
  expect(nextInChain(catalog, [row('a')], 'a')).toBeNull()
})

test('A→B→A ciklus egy ugrásnál megáll, nem végtelenít', () => {
  const catalog = catalogOf(def('a', 'b'), def('b', 'a'))
  const habits = [row('a', { position: 1 }), row('b', { position: 2 })]
  expect(nextInChain(catalog, habits, 'a')?.key).toBe('b')
  expect(nextInChain(catalog, habits, 'b')?.key).toBe('a')
})

test('több láncon átnyúló kötést is megtalál', () => {
  const catalog: HabitCatalog = {
    chains: [
      { id: 'c-m', chainKey: 'MORNING', title: 'Reggel', daypart: 'MORNING', position: 1, isActive: true,
        defs: [def('a', null)] },
      { id: 'c-e', chainKey: 'EVENING', title: 'Este', daypart: 'EVENING', position: 2, isActive: true,
        defs: [def('b', 'a')] },
    ] as unknown as HabitCatalog['chains'],
  }
  const habits = [row('a', { position: 1 }), row('b', { chain: 'EVENING', position: 1 })]
  expect(nextInChain(catalog, habits, 'a')?.key).toBe('b')
})
