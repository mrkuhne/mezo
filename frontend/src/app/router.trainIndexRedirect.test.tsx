// ============================================================
// Train Titanium T4 (mezo-88iwa.5): `/train` has no face of its own under the
// four-tab IA (owner 2026-09-12) — the six-tile EdzésHub retires and the bare
// tab-root forwards to Mai, keeping the legacy Heti `?day={0..6}` deep-link
// (a saved notification/bookmark) intact. `/train/week` — a real sibling page,
// not a retired route — must NOT be swept up by an over-eager prefix redirect.
// ============================================================
import { render } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { QueryWrapper } from '@/test/queryWrapper'
import { ThemeProvider } from '@/app/ThemeProvider'
import { routes } from '@/app/router'
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

test('/train átirányít ide: /train/mai', () => {
  const router = renderAt('/train')
  expect(router.state.location.pathname).toBe('/train/mai')
})

// A legacy Heti drill-in (`?day=0..6`, egy régi push-értesítés vagy könyvjelző) a napi
// paraméterrel EGYÜTT ér célba — Mai innen olvassa ki a kiválasztott napot.
test('/train?day=3 átirányít ide: /train/mai?day=3', () => {
  const router = renderAt('/train?day=3')
  expect(router.state.location.pathname).toBe('/train/mai')
  expect(router.state.location.search).toBe('?day=3')
})

// Üres `?day=` paraméter (pl. egy rosszul összeállított link) nem hagyhat árva `?day=`-t a
// célon — a TrainIndex csak akkor told a paramétert, ha ténylegesen van értéke.
test('/train?day= (üres) átirányít ide: /train/mai, ? nélkül', () => {
  const router = renderAt('/train?day=')
  expect(router.state.location.pathname).toBe('/train/mai')
  expect(router.state.location.search).toBe('')
})

// A /train/week a NÉGY-fülű IA saját, élő lapja (Terhelés), nem a retirált hub egy
// aloldala — egy prefix-alapú redirect-szabály ezt tévesen elnyelné.
test('/train/week ÉLŐ útvonal marad, nem esik a /train redirect alá', () => {
  const router = renderAt('/train/week')
  expect(router.state.location.pathname).toBe('/train/week')
})
