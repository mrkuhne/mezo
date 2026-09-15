// ============================================================
// Fuel Titanium S5 (mezo-qt5q): a leváltott Fuel-útvonalak SOSEM tűnnek el nyomtalanul.
// Mentett linkek, push-értesítések (`notificationScheduleWriter.ts` FUEL_SLOT → /fuel/stack)
// és a Kalauz is ezekre mutatott, ezért mindegyik redirectet kap — a napi paraméterrel együtt,
// mert egy visszalapozott napra mentett könyvjelző különben a mai napon landolna.
//
// A céltáblát a LESZÁLLÍTOTT felület adja, nem a terv első vázlata: a `/fuel/stack/meals`
// (D4 étkezési kötések) is megszűnik, mert S2 a Protokoll-lap al-szekciójává olvasztotta.
// ============================================================
import { render } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { QueryWrapper } from '@/test/queryWrapper'
import { ThemeProvider } from '@/app/ThemeProvider'
import { FUEL_RETIRED_REDIRECTS, routes } from '@/app/router'
import { seedAllKalauzSeen } from '@/test/kalauz'

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  localStorage.clear()
  seedAllKalauzSeen()
})
afterEach(() => vi.unstubAllEnvs())

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  // AppLayout mounts CircadianTheme on the FIRST render pass — before the redirect child
  // resolves — so ThemeProvider must wrap the router (adminRedirects.test.tsx precedent).
  render(
    <QueryWrapper><ThemeProvider><RouterProvider router={router} /></ThemeProvider></QueryWrapper>,
  )
  return router
}

test.each([
  ['/fuel/log', '/fuel'],
  ['/fuel/plan', '/fuel/trendek'],
  ['/fuel/naplo', '/fuel/trendek'],
  ['/fuel/stack/today', '/fuel/stack'],
  ['/fuel/stack/meals', '/fuel/stack/protocol'],
  ['/fuel/stack/manage', '/fuel/stack/protocol'],
  ['/fuel/stack/manage/protocol', '/fuel/stack/protocol'],
  ['/fuel/stack/manage/timing', '/fuel/stack/protocol'],
  ['/fuel/stack/manage/meals', '/fuel/stack/protocol'],
])('%s átirányít ide: %s', (from, to) => {
  const router = renderAt(from)
  expect(router.state.location.pathname).toBe(to)
})

// A napi paraméter nem veszhet el az átirányításban: a Mai lapozható (`?d=`), tehát a
// `/fuel/log?d=` könyvjelző UGYANARRA a napra ér be.
test('a lapozott nap túléli az átirányítást', () => {
  const router = renderAt('/fuel/log?d=2026-09-08')
  expect(router.state.location.pathname).toBe('/fuel')
  expect(router.state.location.search).toContain('d=2026-09-08')
})

// A táblázat és a router EGY forrás: ha egy sor lemaradna a routes-ból, a path 404-re futna
// (a catch-all `*` → /nap), amit ez a kör elkapna. A fordított irány is kötelező: a tábla
// egyetlen célja sem lehet maga is leváltott útvonal (láncolt redirect).
test('minden leváltott útvonal a táblából redirectel, és a célja élő', () => {
  for (const [from, to] of Object.entries(FUEL_RETIRED_REDIRECTS)) {
    const router = renderAt(from)
    expect(router.state.location.pathname, `${from} → ${to}`).toBe(to)
    expect(FUEL_RETIRED_REDIRECTS[to], `${to} maga is leváltott`).toBeUndefined()
  }
})

// A MEGMARADÓ testvérek nem eshetnek a redirect alá: a `/fuel/stack/manage/add` (Új elem) és a
// `/fuel/log/uj` (naplózó) mélyebb útvonalak, amiket egy rosszul írt prefix-szabály elnyelne.
test.each(['/fuel/stack/manage/add', '/fuel/log/uj'])('%s ÉLŐ útvonal marad', (path) => {
  const router = renderAt(path)
  expect(router.state.location.pathname).toBe(path)
})
