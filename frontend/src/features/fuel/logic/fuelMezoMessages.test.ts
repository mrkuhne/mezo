import { fuelMezoMessages, isFuelMessage } from '@/features/fuel/logic/fuelMezoMessages'
import type { MezoMessageItem } from '@/features/today/logic/mezoMessages'

const msg = (over: Partial<MezoMessageItem> = {}): MezoMessageItem => ({
  id: 'morning', eyebrow: 'Reggeli briefing', time: '07:40',
  paragraphs: ['Szép start.'], refs: [], meta: null,
  ...over,
})

test('a message anchored to a fuel ref belongs on the Fuel tab', () => {
  expect(isFuelMessage(msg({ refs: [{ kind: 'Meal', label: 'Skyr-bowl' }] }))).toBe(true)
  expect(isFuelMessage(msg({ refs: [{ kind: 'recept', label: 'Csirkés bowl' }] }))).toBe(true)
  expect(isFuelMessage(msg({ refs: [{ kind: 'Stack', label: 'D3' }] }))).toBe(true)
})

test('ref-kind matching is case- and whitespace-insensitive', () => {
  expect(isFuelMessage(msg({ refs: [{ kind: '  KAMRA ', label: 'Skyr' }] }))).toBe(true)
})

test('a message with no fuel ref does NOT leak onto the Fuel tab', () => {
  expect(isFuelMessage(msg({ refs: [{ kind: 'Workout', label: 'Pull A' }] }))).toBe(false)
  expect(isFuelMessage(msg())).toBe(false)
})

test('the thread keeps its own order and drops everything else — no padding, no reordering', () => {
  const a = msg({ id: 'a', refs: [{ kind: 'Meal', label: 'Reggeli' }] })
  const b = msg({ id: 'b', refs: [{ kind: 'PR', label: 'Chest Row' }] })
  const c = msg({ id: 'c', refs: [{ kind: 'Víz', label: '2,5 l' }] })
  expect(fuelMezoMessages([a, b, c]).map(m => m.id)).toEqual(['a', 'c'])
})

test('an empty thread stays empty — nothing is fabricated', () => {
  expect(fuelMezoMessages([])).toEqual([])
})
