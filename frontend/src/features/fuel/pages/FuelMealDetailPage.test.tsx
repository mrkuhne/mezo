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
  // A bontás HOZZÁVALÓ-szintű, ahogy a háttérrendszer mostantól számolja (mezo-tm3sb): a NOVA
  // stack valódi megoszlás, a tétel-lista a hozzávalókat nevezi meg, és az energiasűrűség-dimenzió
  // hordozza a saját „Sűrűség" sorát. A Minőség lapkák EBBŐL olvasnak, nem a tételsorokból — abból
  // egy receptes étkezésre csak 0% vagy 100% jönne ki.
  breakdown: {
    confidence: 0.8, summary: null, tagline: null, improve: [], tools: [],
    dimensions: [
      {
        id: 'nova', label: 'Feldolgozottság · NOVA', weight: 0.18, score: 0.9,
        color: 'var(--cat-tendency)', detail: '', coverage: 1,
        nova: {
          dominant: 1,
          stack: [
            { nova: 1, pct: 57, label: 'Görög joghurt · Zabpehely' },
            { nova: 2, pct: 6, label: 'Méz' },
            { nova: 3, pct: 37, label: 'Túró' },
            { nova: 4, pct: 0, label: '—' },
          ],
          items: [
            { name: 'Görög joghurt 150g', nova: 1 },
            { name: 'Zabpehely 45g', nova: 1 },
            { name: 'Méz 15g', nova: 2 },
          ],
        },
      },
      {
        id: 'energy_density', label: 'Energia-sűrűség', weight: 0.1, score: 0.7,
        color: 'var(--coral)', detail: '', coverage: 1,
        context: [{ label: 'Sűrűség', value: '183 kcal/100g' }],
      },
    ],
  },
} as unknown as FuelMeal

/** Ugyanaz az étkezés bontás NÉLKÜL — a friss log és a pontozás előtti sor alakja. */
const MEAL_NO_BREAKDOWN: FuelMeal = { ...MEAL, id: 'meal-no-breakdown', breakdown: undefined }

const DAY: FuelDay = {
  targets: { kcal: 2400, p: 180, c: 240, f: 72, water: 3000 },
  consumed: { kcal: 430, p: 30, c: 40, f: 12, water: 500 },
  meals: [MEAL, MEAL_NO_BREAKDOWN],
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

// mezo-tm3sb: a Minőség lapkák a BONTÁSBÓL olvasnak, nem az összecsukott tételsorokból. A fixtúra
// egyetlen sora receptes lenne élesben; a bontás viszont hozzávaló-szintű igazságot hordoz.
test('a Minőség lapkák a bontás hozzávaló-szintű tényeit mutatják, nem a sorokból számolt 0%-ot', () => {
  const { container } = renderAt('meal-1')
  const tiles = Array.from(container.querySelectorAll('.fmx-nutri-tile'))
  const byLabel = (label: string) => tiles.find(t => t.textContent?.includes(label))!
  expect(byLabel('Alapanyag-arány').textContent).toContain('57')
  expect(byLabel('Energiasűrűség').textContent).toContain('183')
  expect(byLabel('Ultra-feldolgozott').textContent).toContain('0')
})

// Őszinte-null: bontás nélkül a három lapka gondolatjel — NEM esik vissza a sorokra, mert abból
// épp a hamis 0% jönne ki. Ez a visszaesés volt a hiba, nem a megoldás.
test('bontás nélkül a Minőség lapkák gondolatjelet mutatnak, nem kiszámolt nullát', () => {
  const { container } = renderAt('meal-no-breakdown')
  const tiles = Array.from(container.querySelectorAll('.fmx-nutri-tile'))
  const byLabel = (label: string) => tiles.find(t => t.textContent?.includes(label))!
  for (const label of ['Alapanyag-arány', 'Energiasűrűség', 'Ultra-feldolgozott']) {
    expect(byLabel(label).textContent).toContain('—')
  }
})

// mezo-6mi43: a negyedik kártya a vércukor-válasz SÁVJA, és koppintásra a saját doboza nyílik.
test('a negyedik Minőség kártya a vércukor-válasz sávja, és megnyitja a dobozát', async () => {
  const { container } = renderAt('meal-1')
  const card = container.querySelector('.fmx-nutri-tile.is-door')!
  expect(card.textContent).toMatch(/Vércukor-válasz/)
  expect(card.textContent).toMatch(/alacsony|közepes|magas/)
  // A dobozt a DOKUMENTUMBAN keressük, nem a komponens fájában: a `GlassBox` szándékosan a
  // telefon-keretbe portáloz, hogy a doboz a készülék-viewporthoz méreteződjön és ne az ablakhoz.
  expect(document.querySelector('[role="dialog"]')).toBeNull()
  await userEvent.click(card)
  expect(document.querySelector('[role="dialog"]')).not.toBeNull()
})

// AZ OWNER DÖNTÉSE, KÉTSZER MEGERŐSÍTVE: sáv, nem szám. A vegyes étkezés glikémiás indexe
// 22-50%-ot téved, ezért a felület sosem ír ki GI-számot, és a szó sem szerepel. Ez az a döntés,
// amit egy későbbi menet a legkönnyebben „kijavítana" — ez a kör az, ami nem hagyja.
test('sem a kártyán, sem a dobozban nincs glikémiás index — se szám, se szó', async () => {
  const { container } = renderAt('meal-1')
  const card = container.querySelector('.fmx-nutri-tile.is-door')!
  expect(card.textContent).not.toMatch(/glik[eé]mi[aá]s\s*index|\bGI\b/i)
  // A nagy „numerál" helyén SZÓ áll, nem számjegy.
  expect(card.querySelector('strong')!.textContent).not.toMatch(/\d/)
  await userEvent.click(card)
  const box = document.querySelector('[role="dialog"]')!
  expect(box.textContent).not.toMatch(/glik[eé]mi[aá]s\s*index|\bGI\b/i)
  // …és szégyenmentes: a magas sáv sem hiba.
  expect(box.textContent).not.toMatch(/elrontott|hiba|rossz|bukta|kudarc|túlléptél/i)
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
