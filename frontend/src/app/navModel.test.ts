import { expect, test } from 'vitest'
import { DOMAINS, activeTabRoute, canGoBack, frameDate, frameFor } from '@/app/navModel'

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

// Én IA (mezo-lhqw7): routine building lives under /nap/rutin/*, so Nap's Rutin tab stays lit.
const nap = DOMAINS.find((d) => d.id === 'nap')!
test.each([
  '/nap/rutin', '/nap/rutin/epites', '/nap/rutin/uj', '/nap/rutin/szokasok',
  '/nap/rutin/lanc/MORNING', '/nap/rutin/szokas/intent', '/nap/rutin/szokas/intent/szerkesztes',
])('%s lights Nap\'s Rutin tab', (path) => {
  expect(activeTabRoute(nap, path)).toBe('/nap/rutin')
})

// ── The Folyadék frame (mezo-n4wf5.1): what the title bar says for a path ──────────────────
const d = new Date(2026, 9, 7) // a Wednesday

test('the hub context line is the long Hungarian date', () => {
  expect(frameDate(d)).toBe('Szerda, október 7.')
})

test('/nap is a hub titled „Ma" under the date', () => {
  const f = frameFor('/nap', d)
  expect(f).toMatchObject({ isHub: true, title: 'Ma', eyebrow: 'Szerda, október 7.', fallback: '/nap' })
  expect(f.domain.id).toBe('nap')
  expect(f.tab?.route).toBe('/nap')
})

test.each([
  ['/train/mai', 'Edzés'], ['/fuel', 'Fuel'], ['/mezo', 'Üzenőfal'], ['/me', 'Én'],
  // every other tab is titled by its label
  ['/fuel/stack', 'Kiegészítők'], ['/nap/napom', 'A napom'], ['/me/weight', 'Test'], ['/train/week', 'Terhelés'],
])('%s is a hub titled %s', (path, title) => {
  expect(frameFor(path, d)).toMatchObject({ isHub: true, title })
})

test('a deep page is a sub-page: leltár title, „Terület · Fül" context, the owning tab as fallback', () => {
  expect(frameFor('/fuel/recipes', d)).toMatchObject({
    isHub: false, title: 'Receptek', eyebrow: 'Fuel · Konyha', fallback: '/fuel/konyha',
  })
  // a parameterised page is titled by the list page that opens it
  expect(frameFor('/fuel/kamra/p1', d)).toMatchObject({ isHub: false, title: 'Kamra', eyebrow: 'Fuel · Konyha' })
  // a tab route with a deeper segment is NOT a hub…
  expect(frameFor('/nap/rutin/epites', d).isHub).toBe(false)
  // …except a `hubChild` tab's ONE parameter segment: a day picked on A napom is the same hub
  // page showing another day, so it keeps the top tabs (F2, mezo-n4wf5.2)
  expect(frameFor('/nap/napom/2026-10-07', d)).toMatchObject({ isHub: true, title: 'A napom', tab: { route: '/nap/napom' } })
  expect(frameFor('/nap/napom/2026-10-07/x', d).isHub).toBe(false)
  // no leltár line under the path → the owning tab's label
  expect(frameFor('/train/review/abc', d)).toMatchObject({ isHub: false, title: 'Mai', eyebrow: 'Edzés · Mai', fallback: '/train/mai' })
})

test('a domain path no tab owns falls back to the domain home', () => {
  expect(frameFor('/train', d)).toMatchObject({ isHub: false, tab: null, title: 'Edzés', eyebrow: 'Edzés', fallback: '/train/mai' })
})

test('outside the five domains the frame is a Nap-coloured sub-page', () => {
  const settings = frameFor('/settings/fuel', d)
  expect(settings).toMatchObject({ isHub: false, tab: null, title: 'Fuel beállítások', eyebrow: 'Beállítások', fallback: '/nap' })
  expect(settings.domain.id).toBe('nap')
  expect(frameFor('/settings', d)).toMatchObject({ isHub: false, title: 'Beállítások', eyebrow: 'Beállítások' })
  expect(frameFor('/minden', d)).toMatchObject({ isHub: false, title: 'Minden oldal', eyebrow: 'Az app térképe', fallback: '/nap' })
})

// ── „Vissza oda, ahonnan jöttél": is there an in-app entry to return to? ───────────────────
// The PRODUCTION branch is the browser router's `history.state.idx`; the location key only
// decides where a router keeps no index (the memory router of the tests).
describe('canGoBack', () => {
  test('idx 0 — the app was opened on this entry (cold deep link): nothing to return to', () => {
    expect(canGoBack({ idx: 0, key: 'abc', usr: null }, 'abc')).toBe(false)
    // …even though the location key is not the initial one (a redirect REPLACED the entry)
    expect(canGoBack({ idx: 0 }, 'k3x9')).toBe(false)
  })
  test('idx > 0 — there is in-app history to return to', () => {
    expect(canGoBack({ idx: 2, key: 'abc', usr: null }, 'abc')).toBe(true)
    expect(canGoBack({ idx: 1 }, 'default')).toBe(true)
  })
  test.each([[null], [undefined], [{}], [{ idx: undefined }], [{ idx: '2' }]])(
    'no numeric idx (%j) — the location key decides: the initial entry has nowhere to return to', (state) => {
      expect(canGoBack(state, 'default')).toBe(false)
      expect(canGoBack(state, 'k3x9')).toBe(true)
    })
})
