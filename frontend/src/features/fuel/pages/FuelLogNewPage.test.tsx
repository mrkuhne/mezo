// Mezo · FuelLogNewPage — /fuel/log/uj, a logolás saját oldala (mezo-bq2t).
// A harness a FuelLogPage.test.tsx-ét követi: a planner a befagyasztott mock-seedből nem ad
// tetszőleges ablakokat, ezért a useFuelTimeline-t crafted planre cseréljük — az ablak-kulcsokat
// NEM hardcode-oljuk, hanem az app saját `${time}-${label}` szabályával képezzük a crafted
// slotokból (fuelSwimlane.tileKey). Minden MÁS hook valódi marad (mock mód) az importOriginal
// spreaddel; a VITE_USE_MOCK stub miatt a fájl valós módban is ugyanezt méri.
import type { ReactNode } from 'react'
import { render, renderHook, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, vi } from 'vitest'
import type { FuelPlanToday, FuelSlot } from '@/data/types'
import { QueryWrapper } from '@/test/queryWrapper'
import { addDays, localDateString } from '@/shared/lib/dates'

const hoisted = vi.hoisted(() => ({ plan: null as FuelPlanToday | null }))
vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return {
    ...actual,
    useFuelTimeline: () =>
      hoisted.plan
        ? {
            plan: hoisted.plan,
            budget: { kcal: 2400, p: 180, c: 240, f: 73, energy: hoisted.plan.energy },
            blocks: [],
            weightKg: 82,
            energyBreakdown: null,
            wake: '06:45',
            bed: '23:00',
            nowHHmm: '13:30',
            getScoredMeal: () => null,
          }
        : actual.useFuelTimeline(),
  }
})

import { FuelLogNewPage } from '@/features/fuel/pages/FuelLogNewPage'
import { useFuelDay, useRecipes } from '@/data/hooks'
// Az ablak-kulcsot az app SAJÁT exportált szabálya adja (mezo-bq2t) — egy helyi másolat zölden
// hagyná a tesztet akkor is, ha a produkciós kulcsképzés elmozdul a /fuel/log ?w= szerződésétől.
import { tileKey } from '@/features/fuel/logic/fuelSwimlane'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => {
  hoisted.plan = null
  vi.unstubAllEnvs()
})

const baseCtx = {
  workout: { type: '', start: '—', end: '—', duration: 0 },
  volleyball: { start: '—', end: '—', noneToday: true },
  bedtime: '23:00', kitchenClose: '21:30', caffeineCutoff: '14:00',
  energy: { base: 2400, activity: 0, balance: 0, target: 2400 },
}

// KÉT ablak, és a deep linkek a MÁSODIKRA mutatnak: egyeslemes tervnél a `tiles.find(key)` és a
// `tiles[0]` megkülönböztethetetlen lenne, azaz a „kulcsból oldja fel az ablakot" teszt nem tudná
// megmondani, hogy kulcs- vagy index-egyezést mér. A kulcsot az app saját `${time}-${label}`
// szabálya adja (fuelSwimlane.tileKey), nem egy találgatott string.
const REGGELI: FuelSlot = {
  time: '08:00', kind: 'meal', label: 'Reggeli', slotKey: 'breakfast', state: 'pending',
  kcal: 480, p: 30, c: 55, f: 12,
}
const UZSONNA: FuelSlot = {
  time: '16:30', kind: 'meal', label: 'Uzsonna', slotKey: 'snack', state: 'pending',
  kcal: 380, p: 26, c: 34, f: 15,
}
const TWO_WINDOWS = [REGGELI, UZSONNA]
const keyOf = tileKey

let router: ReturnType<typeof createMemoryRouter>
const wrapper = ({ children }: { children: ReactNode }) => <QueryWrapper>{children}</QueryWrapper>

function renderAt(entry: string) {
  router = createMemoryRouter(
    [
      { path: '/fuel/log/uj', element: <FuelLogNewPage /> },
      { path: '/fuel/log', element: <div>LOG PAGE PROBE</div> },
    ],
    { initialEntries: [entry] },
  )
  return render(<RouterProvider router={router} />, { wrapper })
}
const currentPath = () => router.state.location.pathname + router.state.location.search

/** Ugyanaz a render, de MEGOSZTOTT QueryClienttel, hogy a mentés után a `useFuelDay` szonda
 *  ugyanabból a cache-ből olvasson (a FuelLogPage.test.tsx múltbeli-mentés tesztjének mintája). */
function renderAtSharedClient(entry: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  router = createMemoryRouter(
    [
      { path: '/fuel/log/uj', element: <FuelLogNewPage /> },
      { path: '/fuel/log', element: <div>LOG PAGE PROBE</div> },
    ],
    { initialEntries: [entry] },
  )
  render(
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return {
    qc,
    qcWrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    ),
  }
}

/** Egy kamra-tétel felvétele a composerbe, majd mentés a (múltbeli) Pótlás-CTA-val. */
async function addPantryLineAndSave(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Kamra · hozzáadás' }))
  const addBtn = (await screen.findAllByRole('button', { name: /hozzáadása$/i }))[0]
  await user.click(addBtn)
  await user.click(screen.getByRole('button', { name: 'Bezárás' }))
  await user.click(screen.getByRole('button', { name: /pótlás/i }))
}

test('az ablak-kulcsból fejlécet és rögzített slotot old fel', async () => {
  hoisted.plan = { ...baseCtx, slots: TWO_WINDOWS }
  renderAt(`/fuel/log/uj?w=${encodeURIComponent(keyOf(UZSONNA))}`)
  expect(await screen.findByText('Uzsonna')).toBeInTheDocument()
  expect(screen.getByText('16:30 · ablak')).toBeInTheDocument()
  expect(screen.getByText('Logolás')).toBeInTheDocument()
  // fixedSlot → nincs MIKOR szegmens
  expect(screen.queryByRole('button', { name: 'Reggeli' })).not.toBeInTheDocument()
})

// ── A terv-recept prefill (a `slot.suggestedRecipeId && !ai` ág). E nélkül a két teszt nélkül a
// `prefill` prop törölhető vagy a `!ai` őr megfordítható lenne úgy, hogy az egész fuel-suite zöld
// marad, miközben minden terv-javaslatos ablak ÜRESEN nyílna. ────────────────────────────────

test('terv-receptes ablak a recept sorával, előtöltve nyílik', async () => {
  const recipe = renderHook(() => useRecipes(), { wrapper }).result.current.recipes[0]
  const withRecipe: FuelSlot = { ...UZSONNA, mealName: recipe.name, suggestedRecipeId: recipe.id }
  hoisted.plan = { ...baseCtx, slots: [REGGELI, withRecipe] }
  renderAt(`/fuel/log/uj?w=${encodeURIComponent(keyOf(withRecipe))}`)
  expect(await screen.findByText('recept')).toBeInTheDocument()
  expect(screen.getAllByText(recipe.name).length).toBeGreaterThanOrEqual(1)
  // Az előtöltött sortól a mentés élő.
  expect(screen.getByRole('button', { name: /logolás · \+10 XP/i })).toBeEnabled()
})

test('ai=1 SZÁNDÉKOSAN kihagyja a terv-recept előtöltést', async () => {
  const recipe = renderHook(() => useRecipes(), { wrapper }).result.current.recipes[0]
  const withRecipe: FuelSlot = { ...UZSONNA, mealName: recipe.name, suggestedRecipeId: recipe.id }
  hoisted.plan = { ...baseCtx, slots: [REGGELI, withRecipe] }
  renderAt(`/fuel/log/uj?w=${encodeURIComponent(keyOf(withRecipe))}&ai=1`)
  // Az AI-panel elindul — tehát az oldal betöltött —, de a terv receptje NEM került be:
  // a user a ✨ utat választotta, nem a terv-ételt.
  expect(await screen.findByLabelText('Mit ettél?')).toBeInTheDocument()
  expect(screen.queryByText('recept')).not.toBeInTheDocument()
  expect(screen.queryByText(recipe.name)).not.toBeInTheDocument()
})

test('ismeretlen ablak-kulcsnál ablakon kívüli módra esik vissza', async () => {
  hoisted.plan = { ...baseCtx, slots: TWO_WINDOWS }
  renderAt('/fuel/log/uj?w=99:99-Nincs')
  expect(await screen.findByText('Ablakon kívül')).toBeInTheDocument()
  expect(screen.getByText('szabad tétel · te választod a mikort')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Reggeli' })).toBeInTheDocument()
})

test('hiányzó w-nél is ablakon kívüli mód, sosem fabrikál ablakot', async () => {
  hoisted.plan = { ...baseCtx, slots: TWO_WINDOWS }
  renderAt('/fuel/log/uj')
  expect(await screen.findByText('Ablakon kívül')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Reggeli' })).toBeInTheDocument()
})

test('múltbeli napon Pótlás-hangulatot és a nap-figyelmeztetést mutatja', async () => {
  hoisted.plan = { ...baseCtx, slots: TWO_WINDOWS }
  const y = addDays(localDateString(), -1)
  renderAt(`/fuel/log/uj?d=${y}`)
  expect(await screen.findByText('Pótlás')).toBeInTheDocument()
  expect(screen.getByText(/napra könyvelődik/)).toBeInTheDocument()
})

test('jövőbeli d-t mára clampel', async () => {
  hoisted.plan = { ...baseCtx, slots: TWO_WINDOWS }
  renderAt(`/fuel/log/uj?d=${addDays(localDateString(), 3)}`)
  expect(await screen.findByText('Logolás')).toBeInTheDocument()
  expect(screen.queryByText('Pótlás')).not.toBeInTheDocument()
})

test('értelmezhetetlen d-t mára clampel', async () => {
  hoisted.plan = { ...baseCtx, slots: TWO_WINDOWS }
  renderAt('/fuel/log/uj?d=nem-datum')
  expect(await screen.findByText('Logolás')).toBeInTheDocument()
  expect(screen.queryByText('Pótlás')).not.toBeInTheDocument()
})

test('MAX_BACK-en túli múltbeli d-t mára clampel', async () => {
  hoisted.plan = { ...baseCtx, slots: TWO_WINDOWS }
  renderAt('/fuel/log/uj?d=2020-01-01')
  expect(await screen.findByText('Logolás')).toBeInTheDocument()
  expect(screen.queryByText('Pótlás')).not.toBeInTheDocument()
})

test('ai=1 nyitott AI panellel indul', async () => {
  hoisted.plan = { ...baseCtx, slots: TWO_WINDOWS }
  renderAt('/fuel/log/uj?ai=1')
  expect(await screen.findByLabelText('Mit ettél?')).toBeInTheDocument()
})

test('Mégse a listára visz vissza ugyanarra a napra', async () => {
  hoisted.plan = { ...baseCtx, slots: TWO_WINDOWS }
  const y = addDays(localDateString(), -1)
  renderAt(`/fuel/log/uj?d=${y}`)
  await userEvent.click(await screen.findByRole('button', { name: 'Mégse' }))
  expect(currentPath()).toBe(`/fuel/log?d=${y}`)
  expect(screen.getByText('LOG PAGE PROBE')).toBeInTheDocument()
})

test('Mégse mai napon a lista alap-URL-jére visz', async () => {
  hoisted.plan = { ...baseCtx, slots: TWO_WINDOWS }
  renderAt('/fuel/log/uj')
  await userEvent.click(await screen.findByRole('button', { name: 'Mégse' }))
  expect(currentPath()).toBe('/fuel/log')
})

test('a ‹ Vissza fejléc-gomb is a listára visz', async () => {
  hoisted.plan = { ...baseCtx, slots: TWO_WINDOWS }
  renderAt('/fuel/log/uj')
  await userEvent.click(await screen.findByRole('button', { name: 'Vissza' }))
  expect(currentPath()).toBe('/fuel/log')
})

// ── A múltbeli könyvelés IGAZSÁGA (a FuelLogPage.test.tsx „múltbeli mentés a választott nap
// loggedAt-jével" tesztjének mércéje). A Pótlás-eyebrow és a nap-figyelmeztetés csak a `past`
// flaget méri: e nélkül a két teszt nélkül a `logDate`/`logTime` prop törölhető lenne úgy, hogy
// a tétel csendben MÁRA könyvelődik — pontosan az a hazugság, amit a sáv a usernek ígér. ──

test('múltbeli nap: a mentés a VÁLASZTOTT napra könyvelődik (logDate)', async () => {
  hoisted.plan = { ...baseCtx, slots: TWO_WINDOWS }
  const y = addDays(localDateString(), -1)
  const user = userEvent.setup()
  const { qcWrapper } = renderAtSharedClient(`/fuel/log/uj?d=${y}`)
  await addPantryLineAndSave(user)

  const probe = renderHook(() => useFuelDay(y), { wrapper: qcWrapper })
  await waitFor(() => {
    expect(probe.result.current.fuel.meals.some(m => m.loggedAt?.startsWith(`${y}T`))).toBe(true)
  })
})

test('d + w együtt: a pótlás az ABLAK saját órájára könyvelődik (logTime)', async () => {
  // Ez az az URL-alak, amit a Task 4 blokk-CTA-i generálnak — ezért itt a `w` az ablak-kulcs,
  // a várt óra pedig a crafted slot saját ideje, nem hardcode-olt találgatás.
  hoisted.plan = { ...baseCtx, slots: TWO_WINDOWS }
  const y = addDays(localDateString(), -1)
  const user = userEvent.setup()
  const { qcWrapper } = renderAtSharedClient(
    `/fuel/log/uj?d=${y}&w=${encodeURIComponent(keyOf(UZSONNA))}`,
  )
  expect(await screen.findByText('Uzsonna')).toBeInTheDocument()
  await addPantryLineAndSave(user)

  const probe = renderHook(() => useFuelDay(y), { wrapper: qcWrapper })
  await waitFor(() => {
    const meals = probe.result.current.fuel.meals
    expect(meals.some(m => m.loggedAt?.startsWith(`${y}T${UZSONNA.time}`))).toBe(true)
  })
})
