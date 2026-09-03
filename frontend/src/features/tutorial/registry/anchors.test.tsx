// A „Mutasd meg a képernyőn" gomb CSAK akkor renderel, ha az anchor épp a DOM-ban van
// (KalauzSheet.tsx:64) — némán degradál. Ez a teszt fogja el, ha egy hős-variánsról
// lemarad az attribútum: arc-variánsonként külön renderel.
import { render } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { routes } from '@/app/router'
import { ThemeProvider } from '@/app/ThemeProvider'
import { QueryWrapper } from '@/test/queryWrapper'
import { seedAllKalauzSeen } from '@/test/kalauz'

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  localStorage.clear()
  seedAllKalauzSeen()
})
afterEach(() => vi.unstubAllEnvs())

const renderAt = (path: string) => {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  return render(
    <QueryWrapper><ThemeProvider><RouterProvider router={router} /></ThemeProvider></QueryWrapper>,
  )
}

const hasAnchor = (name: string) => document.querySelector(`[data-kalauz-anchor="${name}"]`)

// A `?dp=` CSAK a /nap-on jelent napszak-választást (useDayFace.ts:20-27), a `?day=rough`
// pedig az anchor-mód (NapHubPage.tsx:216). Mind a négy felület saját JSX-node.
test.each(['/nap?dp=reggel', '/nap?dp=nap', '/nap?dp=este', '/nap?day=rough'])(
  '%s — a nap-hero anchor jelen van', (path) => {
    renderAt(path)
    expect(hasAnchor('nap-hero')).not.toBeNull()
  },
)

// A /train hőse hat SZÁMÍTOTT variáns (EdzesHubPage.tsx:109,129,163,185,215,235), egyszer
// renderelve (:302). Mock-módban a mai nap edzés-variánst ad; a többi variánst a
// registry-lint nem látja, ezért az attribútum mind a hatra kikerül — a code review
// feladata, hogy egyik se maradjon le.
test('/train — a train-hero anchor jelen van', () => {
  renderAt('/train')
  expect(hasAnchor('train-hero')).not.toBeNull()
})

// A /mezo döntéskártyája (:174) és a /me cél-kártyája (:108) adat-feltételes, ezért NEM
// anchor: a „Mutasd meg" gomb némán eltűnne. A chat-nyitó és az identitás-hős
// feltétel nélkül renderel.
test('/mezo — a mezo-chat anchor jelen van', () => {
  renderAt('/mezo')
  expect(hasAnchor('mezo-chat')).not.toBeNull()
})

test('/me — a me-idhero anchor jelen van', () => {
  renderAt('/me')
  expect(hasAnchor('me-idhero')).not.toBeNull()
})

// ── S3a (mezo-gb1s.5): a Nap + Edzés T2 aloldalak horgonyai ──────────────────
// Adat-függő felületek (react-query mock-fetch) — a horgony az első paint után,
// a betöltött ágban jelenik meg, ezért itt waitFor jár. A spotlight-gomb ugyanígy
// későn olvassa a DOM-ot (a kártya renderelésekor), tehát a szerződés őszinte.
// A /nap/kuldetesek és a /train/review szándékosan horgony nélkül él: a beszélő
// felületük adat-feltételes (kisorsolt küldetés / lezárt edzés), a „Mutasd meg"
// némán degradál.
import { waitFor } from '@testing-library/react'

test.each([
  ['/nap/uzenetek', 'uzenetek-tabs'],
  ['/nap/rutin', 'rutin-lista'],
  ['/nap/checkin', 'checkin-sor'],
  ['/nap/eletjel', 'eletjel-gyuru'],
  ['/train/mai', 'mai-napsav'],
  ['/train/week', 'heti-napok'],
  ['/train/sport', 'sport-tabs'],
  ['/train/futas', 'futas-tabs'],
  ['/train/exercises', 'exercises-kereso'],
  ['/train/medals', 'medals-hero'],
  ['/train/mesocycles', 'mesociklus-mosaic'],
  ['/train/session', 'session-start'],
])('%s — a(z) %s anchor jelen van', async (path, name) => {
  renderAt(path)
  await waitFor(() => expect(hasAnchor(name)).not.toBeNull())
})

// D11 (epic-spec §2): az aktív edzés oldala chrome-mentes (AppLayout hideChrome),
// tehát a fejléc „?" gombja itt nem létezik — a prep-fázis saját mini ?-e nyitja
// újra a kalauzt. Auto-open először, mini ? utána: mindkét út él.
test('/train/session — a prep-fázisban van mini ? gomb', async () => {
  renderAt('/train/session')
  await waitFor(() =>
    expect(document.querySelector('[aria-label="Kalauz ehhez az oldalhoz"]')).not.toBeNull(),
  )
})

// ── S3b (mezo-gb1s.6): a Fuel T2 aloldalak horgonyai ─────────────────────────
// A `/fuel/plan` és a `/fuel/gyogyszer` szándékosan horgony nélkül él: a Terv beszélő
// felületei (heti jegyzet, gyógyszer-csík, supplement-térkép) adat-feltételesek, a
// Gyógyszer oldalnak pedig KÉT teljesen külön arca van (üres vs. követett ciklus) —
// egyikre sem lehet őszintén rámutatni. A `log-forrasok` a MealComposeren ül, tehát a
// `/fuel/log/uj` teljes oldalán és a LogFlow-overlayben ugyanaz az elem.
test.each([
  ['/fuel/log', 'log-napvalto'],
  ['/fuel/log/uj', 'log-forrasok'],
  ['/fuel/stack', 'stack-hero'],
  ['/fuel/recipes', 'receptek-tabs'],
  ['/fuel/kamra', 'kamra-hero'],
  ['/fuel/naplo', 'naplo-hero'],
])('%s — a(z) %s anchor jelen van', async (path, name) => {
  renderAt(path)
  await waitFor(() => expect(hasAnchor(name)).not.toBeNull())
})
