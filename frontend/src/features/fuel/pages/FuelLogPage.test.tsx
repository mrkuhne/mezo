// Mezo · FuelLogPage — the /fuel/log stacked-window logging page (mezo-byo1).
// The crafted-plan harness carries over from the retired FuelMaiPage.logMeal.test.tsx:
// the planner never emits recipe-suggestion / budget-only slots off the frozen mock seed,
// so we override useFuelTimeline with a crafted plan; every OTHER hook stays real
// (mock mode) via the importOriginal spread.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, vi } from 'vitest'
import type { FuelPlanToday, FuelSlot } from '@/data/types'
import { tileKey } from '@/features/fuel/logic/fuelSwimlane'
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

import { FuelLogPage } from '@/features/fuel/pages/FuelLogPage'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => {
  hoisted.plan = null
  vi.unstubAllEnvs()
})

// A CTA-k célját a router SAJÁT locationjéből olvassuk (nem useNavigate-kémmel), ezért
// createMemoryRouter kell — a `/fuel/log/uj` szonda-route pedig azt is bizonyítja, hogy a
// navigáció tényleg megtörtént, nem csak az URL íródott át.
let router: ReturnType<typeof createMemoryRouter>
const renderView = (initialEntries: string[] = ['/fuel/log']) => {
  router = createMemoryRouter(
    [
      { path: '/fuel/log', element: <FuelLogPage /> },
      { path: '/fuel/log/uj', element: <div>LOG NEW PAGE PROBE</div> },
      { path: '/fuel/plan', element: <div>PLAN PAGE PROBE</div> },
      { path: '/fuel', element: <div>FUEL HUB PROBE</div> },
    ],
    { initialEntries },
  )
  return render(
    <QueryWrapper>
      <RouterProvider router={router} />
    </QueryWrapper>,
  )
}
const currentPath = () => router.state.location.pathname + router.state.location.search

// Az ablak-kulcs az app saját EXPORTÁLT szabálya (fuelSwimlane.tileKey) — sosem hardcode-olt
// string, sosem a befagyasztott mock-seed véletlen időpontja, és sosem egy helyi másolat.
const keyOf = tileKey
// A várt query a produkcióval AZONOS kódolóval épül (`URLSearchParams.toString()`), nem
// `encodeURIComponent`-tel: a kettő szóköznél elválik (`+` vs `%20`), és egy kétszavas címkére
// átkeresztelt fixture pirosra vinné a tesztet egy HELYES implementáció mellett is.
const query = (params: Record<string, string>) => new URLSearchParams(params).toString()
const UZSONNA: FuelSlot = {
  time: '16:30', kind: 'meal', label: 'Uzsonna', slotKey: 'snack', state: 'now',
  kcal: 380, p: 26, c: 34, f: 15,
}

const baseCtx = {
  workout: { type: '', start: '—', end: '—', duration: 0 },
  volleyball: { start: '—', end: '—', noneToday: true },
  bedtime: '23:00', kitchenClose: '21:30', caffeineCutoff: '14:00',
  energy: { base: 2400, activity: 0, balance: 0, target: 2400 },
}

// ── A blokk-CTA-k mint navigációs szándék (mezo-bq2t): a logolás saját oldalra megy, a
// kontextus — nap, ablak, AI-szándék — az URL-ben utazik. ────────────────────────────────

test('a Logold CTA az új logoló oldalra navigál az ablak kulcsával', async () => {
  hoisted.plan = { ...baseCtx, slots: [UZSONNA] }
  renderView()
  await userEvent.click(screen.getByRole('button', { name: `Logold · ${UZSONNA.label}` }))
  expect(currentPath()).toBe(`/fuel/log/uj?${query({ w: keyOf(UZSONNA) })}`)
  expect(screen.getByText('LOG NEW PAGE PROBE')).toBeInTheDocument()
})

test('az ✨ AI CTA ai=1-gyel navigál', async () => {
  hoisted.plan = { ...baseCtx, slots: [UZSONNA] }
  renderView()
  await userEvent.click(screen.getByRole('button', { name: `AI naplózás · ${UZSONNA.label}` }))
  expect(currentPath()).toBe(`/fuel/log/uj?${query({ w: keyOf(UZSONNA), ai: '1' })}`)
})

test('múltbeli napon a d paramétert is átadja', async () => {
  hoisted.plan = { ...baseCtx, slots: [UZSONNA] }
  const user = userEvent.setup()
  renderView()
  await user.click(screen.getByRole('button', { name: 'Előző nap' }))
  await user.click(screen.getByRole('button', { name: `Pótold · ${UZSONNA.label}` }))
  const yesterday = addDays(localDateString(), -1)
  expect(currentPath()).toBe(
    `/fuel/log/uj?${query({ d: yesterday, w: keyOf(UZSONNA) })}`,
  )
})

test('a nap-léptető a URL-be is beírja a napot (a böngésző-vissza a helyes napra tér)', async () => {
  // A `?d=` nélkül a böngésző/PWA vissza-gesztus egy query nélküli `/fuel/log` history-bejegyzésre
  // esne vissza, és a user csendben MA-n kötne ki — pont azon a napon, amiről ellépett.
  hoisted.plan = { ...baseCtx, slots: [UZSONNA] }
  const user = userEvent.setup()
  renderView()
  expect(new URLSearchParams(router.state.location.search).has('d')).toBe(false)

  await user.click(screen.getByRole('button', { name: 'Előző nap' }))
  expect(currentPath()).toBe(`/fuel/log?${query({ d: addDays(localDateString(), -1) })}`)

  // Vissza mára: a `d` eltűnik — a mai URL tiszta marad, ahogy az `openLog`-nál is.
  await user.click(screen.getByRole('button', { name: 'Következő nap' }))
  expect(currentPath()).toBe('/fuel/log')
})

test('mai napon nincs d paraméter az URL-ben', async () => {
  hoisted.plan = { ...baseCtx, slots: [UZSONNA] }
  renderView()
  await userEvent.click(screen.getByRole('button', { name: `Logold · ${UZSONNA.label}` }))
  expect(router.state.location.pathname).toBe('/fuel/log/uj')
  expect(new URLSearchParams(router.state.location.search).has('d')).toBe(false)
})

test('az Ablakon kívül CTA ablak-kulcs nélkül navigál — sosem fabrikál ablakot', async () => {
  hoisted.plan = { ...baseCtx, slots: [UZSONNA] }
  renderView()
  await userEvent.click(screen.getByRole('button', { name: 'Logolás · ablakon kívül' }))
  expect(currentPath()).toBe('/fuel/log/uj')
})

test('az Ablakon kívül ✨ AI CTA ablak-kulcs nélkül, ai=1-gyel navigál', async () => {
  hoisted.plan = { ...baseCtx, slots: [UZSONNA] }
  renderView()
  await userEvent.click(screen.getByRole('button', { name: 'AI naplózás · ablakon kívül' }))
  expect(currentPath()).toBe('/fuel/log/uj?ai=1')
})

test('a missed window offers Pótold and says "még pótolható" — never punitive', () => {
  hoisted.plan = {
    ...baseCtx,
    slots: [
      { time: '10:30', kind: 'meal', label: 'Tízórai', slotKey: 'snack', state: 'missed', kcal: 380, p: 26, c: 34, f: 15 },
    ],
  }
  renderView()
  expect(screen.getByText('KIMARADT')).toBeInTheDocument()
  expect(screen.getByText('még pótolható')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Pótold · Tízórai' })).toBeInTheDocument()
})

test('an empty day leads with the tervezz door to /fuel/plan', async () => {
  hoisted.plan = { ...baseCtx, slots: [] }
  renderView()
  expect(screen.getByText('Nincs mai terv')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: '＋ tervezz' }))
  expect(await screen.findByText('PLAN PAGE PROBE')).toBeInTheDocument()
})

test('the back chip returns to the Fuel hub', async () => {
  hoisted.plan = { ...baseCtx, slots: [] }
  renderView()
  await userEvent.click(screen.getByRole('button', { name: 'Vissza' }))
  expect(await screen.findByText('FUEL HUB PROBE')).toBeInTheDocument()
})

test('a scored done meal WITH a breakdown opens MealScoreSheet from its block score chip', async () => {
  // Real mock timeline (no crafted plan): the demo day carries two scored done meals.
  renderView()
  const chips = await screen.findAllByRole('button', { name: /AI score részletek$/ })
  expect(chips.length).toBeGreaterThan(0)
  await userEvent.click(chips[0])
  expect(await screen.findByText('AI score · részletek')).toBeInTheDocument()
})

test('a done window shows KÉSZ ✓ with no Logold CTA', () => {
  // The done join needs a real meal id; the crafted slot points at a nonexistent meal, so the
  // name falls back to the slot's own mealName and the score chip reads "✨ folyamatban".
  hoisted.plan = {
    ...baseCtx,
    slots: [
      { time: '07:30', kind: 'meal', label: 'Reggeli', slotKey: 'breakfast', state: 'done', mealName: 'Skyr-bowl zabbal', kcal: 420, p: 32, c: 48, f: 9 },
    ],
  }
  renderView()
  expect(screen.getByText('KÉSZ ✓')).toBeInTheDocument()
  expect(screen.getByText('Skyr-bowl zabbal')).toBeInTheDocument()
  expect(screen.getByText('✨ folyamatban')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Logold · Reggeli' })).not.toBeInTheDocument()
})

// ── Day stepper + Pótlás mood + ?d= deep link (mezo-1j3z) ──────────────────

test('nap-léptető: ‹ visszalép, az oldal Pótlás-hangulatra vált, minden nem-done blokk Pótold', async () => {
  hoisted.plan = {
    ...baseCtx,
    slots: [
      { time: '07:30', kind: 'meal', label: 'Reggeli', slotKey: 'breakfast', state: 'done', mealName: 'Skyr-bowl zabbal', kcal: 420, p: 32, c: 48, f: 9 },
      { time: '13:00', kind: 'meal', label: 'Ebéd', slotKey: 'lunch', state: 'now', kcal: 640, p: 42, c: 68, f: 14 },
      { time: '19:00', kind: 'meal', label: 'Vacsora', slotKey: 'dinner', state: 'pending', kcal: 580, p: 38, c: 60, f: 16 },
    ],
  }
  const user = userEvent.setup()
  renderView()
  await user.click(screen.getByRole('button', { name: 'Előző nap' }))
  expect(screen.getByText('Pótlás')).toBeInTheDocument()
  expect(screen.getByText(/erre a napra könyvelődik/)).toBeInTheDocument()
  // The now + pending window both flip to missed → Pótold; no MOST stamp in the past.
  expect(screen.getAllByRole('button', { name: /^Pótold/ })).toHaveLength(2)
  expect(screen.queryByText('MOST')).not.toBeInTheDocument()
})

test('a ‹ 7 napnál, a › a mai napnál disabled', async () => {
  hoisted.plan = { ...baseCtx, slots: [] }
  const user = userEvent.setup()
  renderView()
  const prevBtn = () => screen.getByRole('button', { name: 'Előző nap' })
  const nextBtn = () => screen.getByRole('button', { name: 'Következő nap' })
  for (let i = 0; i < 7; i++) await user.click(prevBtn())
  expect(prevBtn()).toBeDisabled()
  for (let i = 0; i < 7; i++) await user.click(nextBtn())
  expect(nextBtn()).toBeDisabled()
})

test('?d= deep link: érvényes tegnapi dátum azon a napon nyit (Pótlás)', () => {
  hoisted.plan = { ...baseCtx, slots: [] }
  renderView([`/fuel/log?d=${addDays(localDateString(), -1)}`])
  expect(screen.getByText('Pótlás')).toBeInTheDocument()
})

test('?d= deep link: érvénytelen (távoli múlt) dátum a mai napra clampel', () => {
  hoisted.plan = { ...baseCtx, slots: [] }
  renderView(['/fuel/log?d=2020-01-01'])
  expect(screen.queryByText('Pótlás')).not.toBeInTheDocument()
  expect(screen.getByText('Logolás')).toBeInTheDocument()
})

test('?d= deep link: jövőbeli dátum a mai napra clampel', () => {
  hoisted.plan = { ...baseCtx, slots: [] }
  renderView([`/fuel/log?d=${addDays(localDateString(), 3)}`])
  expect(screen.queryByText('Pótlás')).not.toBeInTheDocument()
  expect(screen.getByText('Logolás')).toBeInTheDocument()
})

test('?d= deep link: nem-parse-olható string a mai napra clampel', () => {
  hoisted.plan = { ...baseCtx, slots: [] }
  renderView(['/fuel/log?d=nem-datum'])
  expect(screen.queryByText('Pótlás')).not.toBeInTheDocument()
  expect(screen.getByText('Logolás')).toBeInTheDocument()
})

test('lezárt múltbeli nap: minden done → zsálya kártya, a szabad blokk marad', async () => {
  hoisted.plan = {
    ...baseCtx,
    slots: [
      { time: '07:30', kind: 'meal', label: 'Reggeli', slotKey: 'breakfast', state: 'done', mealName: 'Skyr-bowl zabbal', kcal: 420, p: 32, c: 48, f: 9 },
    ],
  }
  const user = userEvent.setup()
  renderView()
  await user.click(screen.getByRole('button', { name: 'Előző nap' }))
  expect(screen.getByText('Minden ablak kész ✓')).toBeInTheDocument()
  expect(screen.getByText('Ablakon kívül')).toBeInTheDocument()
})

test('üres múltbeli nap: nincs ＋ tervezz CTA, a meta „nem volt ablak"-ot mond', async () => {
  hoisted.plan = { ...baseCtx, slots: [] }
  const user = userEvent.setup()
  renderView()
  await user.click(screen.getByRole('button', { name: 'Előző nap' }))
  expect(screen.queryByRole('button', { name: '＋ tervezz' })).not.toBeInTheDocument()
  // The honest "nem volt ablak" note now shows twice on an empty past day (finding 5, mezo-1j3z
  // fix wave): the hero subline AND the üres-nap block's meta line.
  expect(screen.getAllByText('ezen a napon nem volt étkezési ablak').length).toBeGreaterThanOrEqual(2)
})

// ── Logolás 2.1 (mezo-zeeq): score pill + kcal row, Rost ring, context chip ──────────────

test('a scored done meal shows the big score pill (number + tone word) and a Rost ring', async () => {
  renderView() // real mock day: the scored done meals carry fiberG
  const pill = (await screen.findAllByRole('button', { name: /AI score részletek$/ }))[0]
  expect(pill.className).toMatch(/fh-aisc/)
  expect(pill.textContent).toMatch(/\d{1,3}(jó|közepes|gyenge)/)
  expect(screen.getAllByRole('img', { name: /^Rost \d+ g, a napi cél/ }).length).toBeGreaterThan(0)
})

test('the context chip reads the scored Szerep row — mock m2 is Pre-workout, m1 Standard', async () => {
  renderView()
  expect(await screen.findByText('Pre-workout')).toBeInTheDocument()
  expect(screen.getAllByText('Standard').length).toBeGreaterThan(0)
})

test('an unscored done window shows no context chip and the folyamatban pill', () => {
  hoisted.plan = {
    ...baseCtx,
    slots: [
      { time: '07:30', kind: 'meal', label: 'Reggeli', slotKey: 'breakfast', state: 'done', mealName: 'Skyr-bowl zabbal', kcal: 420, p: 32, c: 48, f: 9 },
    ],
  }
  renderView()
  expect(screen.getByText('✨ folyamatban')).toBeInTheDocument()
  expect(screen.queryByText('Standard')).not.toBeInTheDocument()
  expect(screen.queryByText('Pre-workout')).not.toBeInTheDocument()
})
