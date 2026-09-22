import { activeTabRoute, DOMAINS, rememberRoute, routeForDomain, resetNavMemory } from '@/app/navModel'
import { BOOP_DESTINATIONS } from '@/features/insights/logic/boopNavigation'

describe('approved Boop navigation', () => {
  const domain = DOMAINS.find(item => item.id === 'mezo')!
  it('keeps the feed, direct menu, personal view and memories on the dock', () => {
    expect(domain.tabs.map(tab => tab.label)).toEqual(['Üzenőfal', 'Menü', 'Rólad', 'Emlékek'])
  })
  it.each([
    ['/mezo/patterns/sleep', '/mezo/menu'], ['/mezo/predictions/id', '/mezo/menu'],
    ['/mezo/diagnozis/id', '/mezo/menu'], ['/mezo/experiments/id', '/mezo/menu'],
    ['/mezo/knowledge/node/id', '/mezo/rolad'], ['/mezo/karakter/dimenzio/sleep', '/mezo/rolad'],
    ['/mezo/memoir/2026-09-14', '/mezo/emlekek'], ['/mezo/karakter/feed', '/mezo'],
  ])('owns %s without losing the active dock tab', (path, expected) => {
    expect(activeTabRoute(domain, path)).toBe(expected)
  })
  it('keeps original names and canonical destinations together', () => {
    expect(BOOP_DESTINATIONS.filter(item => item.primary).map(({label, to}) => [label,to])).toEqual([
      ['Minták','/mezo/patterns'], ['Előrejelzések','/mezo/predictions'],
      ['Diagnózis','/mezo/diagnozis'], ['Kísérletek','/mezo/experiments'], ['Heti','/me/week'],
    ])
    expect(new Set(BOOP_DESTINATIONS.map(item => item.to)).size).toBe(BOOP_DESTINATIONS.length)
  })
})

it('remembers the owning menu tab after visiting a deep feature page', () => {
  resetNavMemory()
  rememberRoute('/mezo/predictions/record')
  expect(routeForDomain('mezo')).toBe('/mezo/menu')
})
