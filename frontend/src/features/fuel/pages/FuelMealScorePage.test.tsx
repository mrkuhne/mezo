// ============================================================
// Mezo · FuelMealScorePage tests (Fuel Titanium S1b, mezo-33k6 — A11).
// A dimenziók a VALÓDI mock-seed envelope-jából jönnek (`fuelDay.meals[0].breakdown`),
// nem kitalált dimenzió-id-kból: ez ugyanaz az envelope, amit a MealScoreSheet renderel,
// és pontosan ez a slice lényege — más bőr, ugyanazok a számok.
// ============================================================
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { FuelDay, FuelMeal, MealBreakdown, MealDimension } from '@/data/types'
import { fuelDay } from '@/data/fuel/fuel'
import { QueryWrapper } from '@/test/queryWrapper'
import { formatImpact } from '@/features/fuel/logic/formatImpact'

const SEED = fuelDay.meals[0]
const FIXTURE_BREAKDOWN: MealBreakdown = SEED.breakdown!

/** Ugyanaz az envelope, 0,82-es pontszámmal — a hero számát így tudjuk megnevezni. */
const SCORED: FuelMeal = { ...SEED, id: 'meal-1', score: 0.82 }

/** Degradált mikro-dimenzió: súly 0, azaz nincs elég adat — NEM nulla pont. */
const DEGRADED: FuelMeal = {
  ...SCORED,
  id: 'meal-degraded',
  breakdown: {
    ...FIXTURE_BREAKDOWN,
    dimensions: FIXTURE_BREAKDOWN.dimensions.map((d): MealDimension =>
      d.id === 'micro' ? { ...d, weight: 0, score: 0, coverage: 0.2 } : d),
  },
}

const NO_BREAKDOWN: FuelMeal = { ...SCORED, id: 'meal-no-breakdown', breakdown: undefined }

const DAY: FuelDay = {
  targets: fuelDay.targets,
  consumed: fuelDay.consumed,
  fuelMode: null, recoveryCategory: null, recoveryDay: null, skippedKcal: 0,
  meals: [SCORED, DEGRADED, NO_BREAKDOWN],
  pacing: { msg: '' },
  micronutrients: [],
  supplements: [],
}

vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return { ...actual, useFuelDay: () => ({ fuel: DAY, isPending: false }) }
})

import { FuelMealScorePage } from '@/features/fuel/pages/FuelMealScorePage'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

let router: ReturnType<typeof createMemoryRouter>
function renderAt(id: string) {
  router = createMemoryRouter(
    [
      { path: '/fuel/etkezes/:id/ertekeles', element: <FuelMealScorePage /> },
      { path: '/fuel/etkezes/:id', element: <div>DETAIL PROBE</div> },
      { path: '/fuel', element: <div>MAI PROBE</div> },
    ],
    { initialEntries: [`/fuel/etkezes/${id}/ertekeles`] },
  )
  return render(<RouterProvider router={router} />, { wrapper: QueryWrapper })
}

// A11 (mezo-33k6): ugyanaz az envelope, más bőr — a SZÁMOK nem mozdulhatnak.
test('a dimenziók a meal.breakdown-ból jönnek, súlyostul', () => {
  const { container } = renderAt('meal-1')
  // szempontonként egy fiola a hősben ÉS egy sor a „Miből áll össze?" kártyán
  expect(container.querySelectorAll('.fe-8 .fo-vial').length).toBe(FIXTURE_BREAKDOWN.dimensions.length)
  expect(container.querySelectorAll('.fe-dims .fx-it').length).toBe(FIXTURE_BREAKDOWN.dimensions.length)
  expect(container.querySelector('.fe-sc .fo-big')).toHaveTextContent('8,2')
  expect(screen.getByRole('img', { name: 'Mezo értékelése: 8,2 a tízes skálán' })).toBeInTheDocument()
  // „megbízhatóság" az egy szó a bizonyosságra
  expect(container.querySelector('.fe-sc')).toHaveTextContent(`megbízhatóság ${Math.round(FIXTURE_BREAKDOWN.confidence * 100)}%`)
  expect(container.textContent).not.toMatch(/Bizonyosság|AI értékelés|KOPPINTS/)
})

// Az owner kérése: a hero-szám mellől a „/10" elmarad.
test('a hero pontszám mellett nincs per-tíz jelölés', () => {
  const { container } = renderAt('meal-1')
  expect(container.querySelector('.fo-hero')!.textContent).not.toContain('/10')
})

// Minden szempont KOPPINTÁSRA a saját lapját nyitja — világos lapon, nem üvegdobozban.
test('egy szempont sorának koppintása lapon nyitja a magyarázatát', async () => {
  const { container } = renderAt('meal-1')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  await userEvent.click(within(container.querySelector('.fe-dims') as HTMLElement).getByRole('button', { name: /Feldolgozottság/ }))
  const box = screen.getByRole('dialog')
  expect(box.className).toContain('fo-sheet')
  expect(box.className).not.toContain('glass')
  expect(box).toHaveAccessibleName(FIXTURE_BREAKDOWN.dimensions.find(d => d.id === 'nova')!.label)
  expect(within(box).getByText(/súly/i)).toBeInTheDocument()
  await userEvent.click(within(box).getByRole('button', { name: 'Bezárom' }))
})

// Degradált dimenzió őszintén jelenik meg — nem nulla pont.
// (A mock-seed saját címkéje „Rost & mikro", ezért a mintát a VALÓS címkére szabtuk.)
test('adat nélküli dimenzió „tanulom", nem nulla', () => {
  renderAt('meal-degraded')
  const { container } = { container: document.body }
  const tile = within(container.querySelector('.fe-8') as HTMLElement).getByRole('button', { name: /mikro/i })
  expect(tile).toHaveTextContent('még tanulom')
  expect(tile).toHaveTextContent('—')
  expect(tile).not.toHaveTextContent('0')
  const row = within(container.querySelector('.fe-dims') as HTMLElement).getByRole('button', { name: /mikro/i })
  expect(row).toHaveTextContent('Ehhez nem volt elég adat, ezért ez a szempont kimaradt.')
  expect(row).toHaveTextContent('még tanulom · kevés adat')
})

// Breakdown nélküli étkezésnek nincs értékelő oldala — ugyanaz a szabály, mint a sheetnél.
test('breakdown nélküli étkezésnél őszinte üres állapot', () => {
  renderAt('meal-no-breakdown')
  expect(screen.getByText(/Ehhez az étkezéshez még nincs értékelés/i)).toBeInTheDocument()
})

// A számok nem mozdulhatnak: a súly-chip a ledger/kártya aritmetikájának ugyanazt az
// exportált helperét olvassa, amit a sheet (logic/scoreArithmetic.ts).
test('a dimenzió-chip súlya az envelope súlyát mondja, nem újraszámoltat', async () => {
  renderAt('meal-1')
  const nova = FIXTURE_BREAKDOWN.dimensions.find(d => d.id === 'nova')!
  await userEvent.click(within(document.querySelector('.fe-dims') as HTMLElement).getByRole('button', { name: /Feldolgozottság/ }))
  const box = screen.getByRole('dialog')
  expect(within(box).getByText(`súly ${Math.round(nova.weight * 100)}%`)).toBeInTheDocument()
})

// ── Folyadék (mezo-n4wf5.5) ──────────────────────────────────────────────────────────────

test('a hős felirata az étkezés helye és ideje, a gombja vissza az étkezés részleteihez', async () => {
  const { container } = renderAt('meal-1')
  expect(container.querySelector('.fo-hero-lbl')!.textContent).toMatch(/^(Reggeli|Ebéd|Uzsonna|Vacsora|Étkezés)( · \d\d:\d\d)?$/)
  await userEvent.click(screen.getByRole('button', { name: 'Az étkezés részletei' }))
  expect(router.state.location.pathname).toBe('/fuel/etkezes/meal-1')
})

test('a leggyengébb és a legerősebb szempont meg van nevezve, a többi a súlyát viseli', () => {
  const { container } = renderAt('meal-1')
  const notes = Array.from(container.querySelectorAll('.fe-8 .fo-vial small i')).map(e => e.textContent)
  expect(notes.filter(n => n === 'leggyengébb')).toHaveLength(1)
  expect(notes.filter(n => n === 'legerősebb')).toHaveLength(1)
  expect(notes.filter(n => /^súly \d+%$/.test(n ?? '')).length).toBe(FIXTURE_BREAKDOWN.dimensions.length - 2)
  expect(container.querySelectorAll('.fe-dims .fe-shn')).toHaveLength(FIXTURE_BREAKDOWN.dimensions.length)
  expect(Array.from(container.querySelectorAll('.fe-dims .fe-shn')).filter(e => /· leggyengébb$/.test(e.textContent ?? ''))).toHaveLength(1)
})

test('„Ha feljebb vinnéd": a hatás a tízes skálán áll, ugyanabból a számból, mint a régi pont', () => {
  const { container } = renderAt('meal-1')
  const rows = Array.from(container.querySelectorAll('.fe-impc .fo-row'))
  // mock módban Mezo olvasata a saját javaslatait hozza; valós módban az envelope-éit — mindkettő ugyanazon a
  // függvényen megy át (a pontos számot a FuelScoreSurface.test rögzíti)
  expect(rows.length).toBeGreaterThan(0)
  const known = FIXTURE_BREAKDOWN.improve.map(i => formatImpact(i.impact))
  for (const r of rows) {
    const shown = r.querySelector('.fe-imp')!.textContent!
    expect(known.includes(shown) || !/pont|score/.test(shown)).toBe(true)
  }
  expect(container.textContent).not.toMatch(/\d pont\b/)
})

test('a lap alján a jegyzet Mezót nevezi meg, nem a „coach"-ot', () => {
  const { container } = renderAt('meal-1')
  expect(container.querySelector('.fe-fbc')).toHaveTextContent('a szöveges részt Mezo írja hozzá, és sosem írja át a számokat')
  expect(container.textContent).not.toMatch(/coach/i)
})

test('a régi bőr nem maradt a lapon', () => {
  const { container } = renderAt('meal-1')
  expect(container.querySelector('[class*="fmx-"], .glass, [class*="uv-"]')).toBeNull()
})

test('nincs meg: az étkezés lapjának őszinte üres arca', () => {
  renderAt('nincs-ilyen')
  expect(screen.getByText(/Ez az étkezés nincs meg/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Vissza a Mai oldalra' })).toBeInTheDocument()
})
