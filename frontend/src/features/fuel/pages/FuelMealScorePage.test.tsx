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
  const tiles = container.querySelectorAll('.fmx-dim')
  expect(tiles.length).toBe(FIXTURE_BREAKDOWN.dimensions.length)
  expect(container.querySelector('.fmx-score-hero')).toHaveTextContent('8,2')
})

// Az owner kérése: a hero-szám mellől a „/10" elmarad.
test('a hero pontszám mellett nincs per-tíz jelölés', () => {
  const { container } = renderAt('meal-1')
  expect(container.querySelector('.fmx-score-hero')!.textContent).not.toContain('/10')
})

// Minden dimenzió KOPPINTÁSRA üvegdobozt nyit — nem lenyílót.
test('egy dimenzió koppintása üvegdobozban nyitja a magyarázatát', async () => {
  renderAt('meal-1')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /Feldolgozottság/ }))
  const box = screen.getByRole('dialog')
  expect(box.className).toContain('glass')
  expect(within(box).getByText(/súly/i)).toBeInTheDocument()
})

// Degradált dimenzió őszintén jelenik meg — nem nulla pont.
// (A mock-seed saját címkéje „Rost & mikro", ezért a mintát a VALÓS címkére szabtuk.)
test('adat nélküli dimenzió „tanulom", nem nulla', () => {
  renderAt('meal-degraded')
  const tile = screen.getByRole('button', { name: /mikro/i })
  expect(tile).toHaveTextContent('tanulom')
  expect(tile).not.toHaveTextContent('0')
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
  await userEvent.click(screen.getByRole('button', { name: /Feldolgozottság/ }))
  const box = screen.getByRole('dialog')
  expect(within(box).getByText(`súly ${Math.round(nova.weight * 100)}%`)).toBeInTheDocument()
})
