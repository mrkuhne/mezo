import { activeTabRoute, DOMAINS, rememberRoute, routeForDomain, resetNavMemory } from '@/app/navModel'
import { BOOP_DESTINATIONS } from '@/features/insights/logic/boopNavigation'

describe('approved Boop navigation', () => {
  const domain = DOMAINS.find(item => item.id === 'mezo')!
  it('docks the wall, the team, the personal view and memories (spec §2.5, mezo-a9bo7.10)', () => {
    expect(domain.tabs.map(tab => [tab.label, tab.route])).toEqual([
      ['Üzenőfal', '/mezo'], ['A csapat', '/mezo/csapat'], ['Rólad', '/mezo/rolad'], ['Emlékek', '/mezo/emlekek'],
    ])
  })
  it.each([
    // a post's deep pages stay under the wall — „a kijelölés nem ugrál”
    ['/mezo/patterns/sleep', '/mezo'], ['/mezo/predictions/id', '/mezo'],
    ['/mezo/experiments/id', '/mezo'],
    ['/mezo/coaching/kartya', '/mezo'], ['/mezo/chat', '/mezo'], ['/mezo/karakter/feed', '/mezo'],
    // the rooms and the machinery behind them stay under the team
    ['/mezo/csapat/szunya', '/mezo/csapat'], ['/mezo/karakter/konzilium', '/mezo/csapat'],
    ['/mezo/karakter/gepterem/futasok', '/mezo/csapat'], ['/mezo/karakter/gepterem/osszes', '/mezo/csapat'],
    ['/mezo/memoria', '/mezo/csapat'],
    // Kérdezd a csapatot (mezo-u3712): the Diagnózis page is entered from A csapat
    ['/mezo/diagnozis', '/mezo/csapat'], ['/mezo/diagnozis/id', '/mezo/csapat'],
    ['/mezo/knowledge/node/id', '/mezo/rolad'], ['/mezo/karakter/dimenzio/sleep', '/mezo/rolad'],
    ['/mezo/memoir/2026-09-14', '/mezo/emlekek'], ['/mezo/emlekek/2026-09-14', '/mezo/emlekek'],
  ])('owns %s without losing the active dock tab', (path, expected) => {
    expect(activeTabRoute(domain, path)).toBe(expected)
  })
  it('keeps original names and canonical destinations together', () => {
    // the old chip strip's five destinations live on in the „Összes funkció” grid (mezo-twizx)
    expect(BOOP_DESTINATIONS.slice(0, 5).map(({label, to}) => [label,to])).toEqual([
      ['Minták','/mezo/patterns'], ['Előrejelzések','/mezo/predictions'],
      ['Diagnózis','/mezo/diagnozis'], ['Kísérletek','/mezo/experiments'], ['Heti','/me/week'],
    ])
    expect(new Set(BOOP_DESTINATIONS.map(item => item.to)).size).toBe(BOOP_DESTINATIONS.length)
  })
})

it('remembers the owning dock tab after visiting a deep page', () => {
  resetNavMemory()
  rememberRoute('/mezo/karakter/gepterem/futasok')
  expect(routeForDomain('mezo')).toBe('/mezo/csapat')
  rememberRoute('/mezo/predictions/record')
  expect(routeForDomain('mezo')).toBe('/mezo')
})
