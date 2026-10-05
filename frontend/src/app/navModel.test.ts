import { expect, test } from 'vitest'
import { DOMAINS, activeTabRoute } from '@/app/navModel'

const me = DOMAINS.find((d) => d.id === 'me')!

test('Én tabs are Hol tartok · Test · Célok · Napló', () => {
  expect(me.tabs.map((t) => t.label)).toEqual(['Hol tartok', 'Test', 'Célok', 'Napló'])
  expect(me.tabs.map((t) => t.route)).toEqual(['/me', '/me/weight', '/me/goals', '/me/naplo'])
})

test.each([
  ['/me', '/me'], ['/me/week', '/me'], ['/me/week/elemzes', '/me'], ['/me/growth/kituntetesek', '/me'],
  ['/me/people/abc', '/me'], ['/me/ertesitesek', '/me'],
  ['/me/weight', '/me/weight'], ['/me/sleep', '/me/weight'], ['/me/sleep/night', '/me/weight'],
  ['/me/goals', '/me/goals'], ['/me/goals/weight/diet', '/me/goals'], ['/me/goals/new', '/me/goals'],
  ['/me/naplo', '/me/naplo'],
])('%s lights %s', (path, tab) => {
  expect(activeTabRoute(me, path)).toBe(tab)
})
