// ============================================================
// Mezo · FuelMealDetailPage tests (Fuel Titanium S1b, mezo-33k6 — A10/A11).
// A harness a FuelLogNewPage.test.tsx createMemoryRouter + hoisted fixture mintája:
// a `useFuelDay` egy VALÓDI alakú FuelDay-t ad vissza (FuelMeal `mealItems` sorokkal és
// `nutrients` tényekkel), így az állítások a produkciós adatot írják le, nem egy kitalált
// formát.
// ============================================================
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { FuelDay, FuelMeal } from '@/data/types'
import { QueryWrapper } from '@/test/queryWrapper'

const MEAL: FuelMeal = {
  id: 'meal-1',
  slot: 'Uzsonna · 16:40',
  title: 'Görög joghurtos bowl',
  score: 0.82,
  kcal: 430, p: 30, c: 40, f: 12,
  fiberG: 6,
  nutrients: { fiberG: 6, sugarG: 18, saltG: null, saturatedFatG: null },
  mealItems: [
    { source: 'pantry', refId: 'p-1', amount: 150, unit: 'g', name: 'Görög joghurt',
      contribution: { kcal: 150, p: 16, c: 8, f: 6 }, nova: 1 },
    { source: 'pantry', refId: 'p-2', amount: 45, unit: 'g', name: 'Zabpehely',
      contribution: { kcal: 170, p: 6, c: 30, f: 3 }, nova: 1 },
    { source: 'estimate', refId: '', amount: 15, unit: 'g', name: 'Méz',
      contribution: { kcal: 110, p: 0, c: 2, f: 3 }, nova: 2 },
  ],
  items: [],
  tags: [],
  loggedAt: '2026-09-12T16:40:00',
  mealDate: '2026-09-12',
}

const DAY: FuelDay = {
  targets: { kcal: 2400, p: 180, c: 240, f: 72, water: 3000 },
  consumed: { kcal: 430, p: 30, c: 40, f: 12, water: 500 },
  meals: [MEAL],
  pacing: { msg: '' },
  micronutrients: [],
  supplements: [],
}

vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return { ...actual, useFuelDay: () => ({ fuel: DAY, isPending: false }) }
})

import { FuelMealDetailPage } from '@/features/fuel/pages/FuelMealDetailPage'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

let router: ReturnType<typeof createMemoryRouter>
function renderAt(id: string, search = '') {
  router = createMemoryRouter(
    [
      { path: '/fuel/etkezes/:id', element: <FuelMealDetailPage /> },
      { path: '/fuel/etkezes/:id/ertekeles', element: <div>SCORE PAGE PROBE</div> },
      { path: '/fuel', element: <div>MAI PROBE</div> },
      { path: '/fuel/log/uj', element: <div>LOGGER PROBE</div> },
    ],
    { initialEntries: [`/fuel/etkezes/${id}${search}`] },
  )
  return render(<RouterProvider router={router} />, { wrapper: QueryWrapper })
}

// Az owner által jóváhagyott hero-elrendezés: BAL oldal ikon + alatta kcal;
// JOBB oldal az idő-és-blokk sor a saját ikonjával, alatta a nap x%-a,
// és az AI értékelés jobbra FENT.
test('a hero a jóváhagyott elrendezésben áll', () => {
  const { container } = renderAt('meal-1')
  const hero = container.querySelector('.fmx-detail-hero')!
  expect(hero.querySelector('.fmx-detail-kcal')).toHaveTextContent('430')
  expect(hero.querySelector('.fmx-detail-when')).toHaveTextContent('Uzsonna')
  expect(hero.querySelector('.fmx-detail-share')).toHaveTextContent('%')
  expect(hero.querySelector('.fmx-detail-score')).not.toBeNull()
})

// Az owner döntése: itt a gyűrűk az ÉTKEZÉS összetételét mutatják, nem a napi célt.
test('a makró gyűrűk az étkezés saját összetételét mutatják', () => {
  const { container } = renderAt('meal-1')
  const rings = container.querySelector('.fmx-detail-rings')!
  expect(rings.textContent).not.toMatch(/a nap céljához mérve/i)
  // a három makró aránya 100%-ra jön ki, mert az étkezés egészére vetítjük
  const pcts = Array.from(rings.querySelectorAll('.fmx-share-pct')).map(e => Number(e.textContent!.replace('%', '')))
  expect(pcts.reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(99)
  expect(pcts.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(101)
})

// Owner-kérés (mezo-n9peo): a gyűrű BELSEJÉBEN a gramm a nagy, színes szám, és ALATTA a
// százalék áll — korábban fordítva volt. A gramm az, amit az owner olvas; a részesedés a
// kontextus, nem a főszereplő.
test('a gyűrűben a gramm a nagy szám, a százalék alatta', () => {
  const { container } = renderAt('meal-1')
  const rings = Array.from(container.querySelectorAll('.fmx-detail-rings .fmx-ring'))
  const text = (el: Element, sel: string) => el.querySelector(sel)!.textContent!.replace(/\s+/g, ' ')
  // A nagy, makró-színű elem a gramm — és pontosan az étkezés MAKRÓJA (30/40/12), nem a
  // felszámolás egy félúti állapota: jsdom-ban a `useFuelCountUp` egyből a végértéken áll.
  expect(rings.map(r => text(r, '.fmx-share-g'))).toEqual(['30 g', '40 g', '12 g'])
  // …a halk, alatta futó pedig a százalék.
  for (const r of rings) expect(text(r, '.fmx-share-pct')).toMatch(/^\d+%$/)
  // A sorrend a DOM-ban is ez: a gramm előbb jön, tehát felül áll.
  const inner = Array.from(rings[0].querySelectorAll('.fmx-share-g, .fmx-share-pct'))
  expect(inner[0]).toHaveClass('fmx-share-g')
  // A felolvasott mondat is a grammal nyit, ahogy a látvány.
  expect(rings[0].querySelector('span[aria-label]')!.getAttribute('aria-label'))
    .toBe('Fehérje: 30 g, az étkezés energiájának 31%-a')
})

test('a hozzávalók abból állnak, amiből az étkezés összeállt', () => {
  renderAt('meal-1')
  expect(screen.getByRole('heading', { name: 'Hozzávalók' })).toBeInTheDocument()
  expect(screen.getByText('Görög joghurt')).toBeInTheDocument()
})

// F1/mezo-vj61 őszinteség: csak a NÉGY tárolt tény látszik, kitalált vitamin nincs.
test('a mikrotápanyag rész csak a tárolt tényeket mutatja, a hiányzót gondolatjellel', () => {
  renderAt('meal-1')
  const micro = screen.getByRole('heading', { name: 'Mikrotápanyagok' }).closest('section')!
  for (const label of ['Rost', 'Cukor', 'Só', 'Telített zsír']) {
    expect(within(micro).getByText(label)).toBeInTheDocument()
  }
  expect(within(micro).queryByText(/vitamin/i)).toBeNull()
  expect(within(micro).getAllByText('—').length).toBeGreaterThan(0)
})

// A cím és a Minőség fejléc NEM visel darabszámot/feliratot (owner).
test('a szekció-fejlécek nem visznek darabszámot', () => {
  renderAt('meal-1')
  expect(screen.getByRole('heading', { name: 'Hozzávalók' }).textContent).toBe('Hozzávalók')
  expect(screen.getByRole('heading', { name: 'Minőség' }).textContent).toBe('Minőség')
})

test('ismeretlen étkezés-azonosítónál őszinte üres állapot, nem összeomlás', () => {
  renderAt('nincs-ilyen')
  expect(screen.getByText(/Ez az étkezés nincs meg/i)).toBeInTheDocument()
})

// A11: az értékelés a saját oldalán nyílik, nem sheetben.
test('az AI chip az értékelő oldalra navigál', async () => {
  renderAt('meal-1')
  await userEvent.click(screen.getByRole('button', { name: /AI értékelés/ }))
  expect(router.state.location.pathname).toBe('/fuel/etkezes/meal-1/ertekeles')
})

// ── A8 (S1c, mezo-33k6): a javítás ajtaja. A törlés SZÁNDÉKOSAN nincs itt — az a logolóban,
// két lépésben él, mert egy részletező lapon egy koppintás nem törölhet egy napot. ───────────

test('a javítás ajtaja a logoló szerkesztő módjába visz', async () => {
  renderAt('meal-1')
  await userEvent.click(screen.getByRole('button', { name: /Javítom ezt az étkezést/ }))
  expect(router.state.location.pathname + router.state.location.search).toBe('/fuel/log/uj?edit=meal-1')
})

test('korábbi napi étkezésnél a nap is átmegy, hogy az idő-szerződés megmaradjon', async () => {
  renderAt('meal-1', '?d=2026-09-10')
  await userEvent.click(screen.getByRole('button', { name: /Javítom ezt az étkezést/ }))
  expect(router.state.location.search).toBe('?edit=meal-1&d=2026-09-10')
})

test('a részletezőn nincs törlés — az a logolóban, két lépésben él', () => {
  renderAt('meal-1')
  expect(screen.queryByRole('button', { name: /Törlöm/ })).not.toBeInTheDocument()
})
