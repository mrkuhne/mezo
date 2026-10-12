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

/** Egyetlen recept-sorból álló étkezés — ez már recept, nem kell új (mezo-n9wgg). */
const MEAL_ONE_RECIPE: FuelMeal = {
  ...MEAL, id: 'meal-recipe', breakdown: undefined,
  mealItems: [{ source: 'recipe', refId: 'rec-9', amount: 1, unit: 'adag', name: 'Zabkása',
    contribution: { kcal: 400, p: 20, c: 60, f: 8 } }],
} as FuelMeal
/** Részletezett sorok nélküli étkezés — nincs miből receptet csinálni. */
const MEAL_NO_LINES: FuelMeal = { ...MEAL, id: 'meal-empty', breakdown: undefined, mealItems: [] }

const DAY: FuelDay = {
  targets: { kcal: 2400, p: 180, c: 240, f: 72, water: 3000 },
  consumed: { kcal: 430, p: 30, c: 40, f: 12, water: 500 },
  fuelMode: null, recoveryCategory: null, recoveryDay: null, skippedKcal: 0,
  meals: [MEAL, MEAL_NO_BREAKDOWN, MEAL_ONE_RECIPE, MEAL_NO_LINES],
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
      { path: '/fuel/recipes/muhely', element: <div>WORKSHOP PROBE</div> },
      { path: '/fuel/recipes/:id', element: <div>RECIPE PROBE</div> },
    ],
    { initialEntries: [`/fuel/etkezes/${id}${search}`] },
  )
  return render(<RouterProvider router={router} />, { wrapper: QueryWrapper })
}

// Folyadék (mezo-n4wf5.5): a hős a nap tálja, amibe az étkezés beleömlött — mellette a kcal, a nap-részesedés és a
// logolás ideje; az ítélet az értékelés címsora (itt még nincs: „Rögzítve; az értékelés készül."), a gomb Mezo értékelése.
test('a hős a jóváhagyott elrendezésben áll', () => {
  const { container } = renderAt('meal-1')
  const hero = container.querySelector('.fo-hero')!
  expect(hero.querySelector('.fo-hero-lbl')).toHaveTextContent('Görög joghurtos bowl')
  expect(hero.querySelector('.fx-ng-n')).toHaveTextContent('430')
  expect(hero.querySelector('.fx-pour')).not.toBeNull()
  expect(hero.querySelector('.fe-facts')).toHaveTextContent('a napod 18%-a a 2 400 kcal-os keretből · 16:40-kor logoltad')
  expect(hero.querySelector('.fx-pk')).toHaveTextContent('előtte üres volt a tál')
  expect(hero.querySelector('.fo-hero-verdict')).toHaveTextContent('Rögzítve; az értékelés készül.')
  expect(within(hero as HTMLElement).getByRole('button', { name: 'Mezo értékelése 8,2' })).toBeInTheDocument()
  expect(within(hero as HTMLElement).getByRole('button', { name: /^Vércukor · (alacsony|közepes|magas)$/ })).toBeInTheDocument()
})

// A régi bőr nem maradt a lapon: se üveg, se gyűrű, se clay ikon.
test('a lap a Folyadék készletből áll, a régi bőr nélkül', () => {
  const { container } = renderAt('meal-1')
  expect(container.querySelector('.fo-page')).not.toBeNull()
  expect(container.querySelector('[class*="fmx-"], .glass, [class*="uv-"]')).toBeNull()
  expect(container.querySelector('svg circle.fmx-ring-progress')).toBeNull()
  expect(Array.from(container.querySelectorAll('.fo-sec')).map(h => h.textContent)).toEqual(
    ['1Makrók', '2Hozzávalók · 3', '3Minőség', '4Mikrotápanyagok', '5Javítás és recept'])
})

// Az owner döntése: a makrók az ÉTKEZÉS összetételét mutatják, nem a napi célt.
test('a makró fiolák az étkezés saját összetételét mutatják', () => {
  renderAt('meal-1')
  const group = screen.getByRole('group', { name: 'Az étkezés energiájának megoszlása' })
  expect(group.textContent).not.toMatch(/a nap céljához mérve/i)
  // a három makró aránya 100%-ra jön ki, mert az étkezés egészére vetítjük
  const pcts = Array.from(group.querySelectorAll('.fo-vial small i')).map(e => Number(e.textContent!.match(/(\d+)%/)![1]))
  expect(pcts).toHaveLength(3)
  expect(pcts.reduce((x, y) => x + y, 0)).toBeGreaterThanOrEqual(99)
  expect(pcts.reduce((x, y) => x + y, 0)).toBeLessThanOrEqual(101)
})

// Owner-kérés (mezo-n9peo): a gramm a nagy szám, a részesedés alatta, halkan.
test('a fiolában a gramm a nagy szám, a százalék alatta', () => {
  renderAt('meal-1')
  const group = screen.getByRole('group', { name: 'Az étkezés energiájának megoszlása' })
  const vials = Array.from(group.querySelectorAll('.fo-vial'))
  // pontosan az étkezés MAKRÓJA (30/40/12)
  expect(vials.map(v => v.querySelector(':scope > b')!.textContent)).toEqual(['30 g', '40 g', '12 g'])
  expect(vials.map(v => v.querySelector('small')!.textContent)).toEqual(['Fehérje31% energia', 'Szénhidrát41% energia', 'Zsír28% energia'])
  // a fiolák alatt a mondat megmondja, honnan jön az energia
  expect(group).toHaveTextContent('A szint az étkezés energiájának megoszlása: 120 kcal fehérjéből, 160 szénhidrátból, 108 zsírból.')
})

// mezo-tm3sb: a Minőség lapkák a BONTÁSBÓL olvasnak, nem az összecsukott tételsorokból. A fixtúra
// egyetlen sora receptes lenne élesben; a bontás viszont hozzávaló-szintű igazságot hordoz.
test('a Minőség lapkák a bontás hozzávaló-szintű tényeit mutatják, nem a sorokból számolt 0%-ot', () => {
  const { container } = renderAt('meal-1')
  const tiles = Array.from(container.querySelectorAll('.fo-stat'))
  const byLabel = (label: string) => tiles.find(t => t.textContent?.includes(label))!
  expect(byLabel('Alapanyag-arány').textContent).toContain('57')
  expect(byLabel('Energiasűrűség').textContent).toContain('183')
  expect(byLabel('Ultra-feldolgozott').textContent).toContain('0')
})

// Őszinte-null: bontás nélkül a három lapka gondolatjel — NEM esik vissza a sorokra, mert abból
// épp a hamis 0% jönne ki. Ez a visszaesés volt a hiba, nem a megoldás.
test('bontás nélkül a Minőség lapkák gondolatjelet mutatnak, nem kiszámolt nullát', () => {
  const { container } = renderAt('meal-no-breakdown')
  const tiles = Array.from(container.querySelectorAll('.fo-stat'))
  const byLabel = (label: string) => tiles.find(t => t.textContent?.includes(label))!
  for (const label of ['Alapanyag-arány', 'Energiasűrűség', 'Ultra-feldolgozott']) {
    expect(byLabel(label).textContent).toContain('—')
  }
})

// mezo-6mi43: a negyedik kártya a vércukor-válasz SÁVJA, és koppintásra a saját doboza nyílik.
test('a negyedik Minőség kártya a vércukor-válasz sávja, és megnyitja a dobozát', async () => {
  const { container } = renderAt('meal-1')
  const card = container.querySelector('button.fo-stat')!
  expect(card.textContent).toMatch(/Vércukor-válasz/)
  expect(card.textContent).toMatch(/alacsony|közepes|magas/)
  expect(card.textContent).toMatch(/részletek ›/)
  // A lapot a DOKUMENTUMBAN keressük, nem a komponens fájában: a `Sheet` a telefon-keretbe portáloz.
  expect(document.querySelector('[role="dialog"]')).toBeNull()
  await userEvent.click(card)
  expect(document.querySelector('[role="dialog"]')).not.toBeNull()
})

// AZ OWNER DÖNTÉSE, KÉTSZER MEGERŐSÍTVE: sáv, nem szám. A vegyes étkezés glikémiás indexe
// 22-50%-ot téved, ezért a felület sosem ír ki GI-számot, és a szó sem szerepel. Ez az a döntés,
// amit egy későbbi menet a legkönnyebben „kijavítana" — ez a kör az, ami nem hagyja.
test('sem a kártyán, sem a dobozban nincs glikémiás index — se szám, se szó', async () => {
  const { container } = renderAt('meal-1')
  const card = container.querySelector('button.fo-stat')!
  expect(card.textContent).not.toMatch(/glik[eé]mi[aá]s\s*index|\bGI\b/i)
  // A nagy „numerál" helyén SZÓ áll, nem számjegy.
  expect(card.querySelector('.fo-stat-n')!.textContent).not.toMatch(/\d/)
  await userEvent.click(card)
  const box = document.querySelector('[role="dialog"]')!
  expect(box.textContent).not.toMatch(/glik[eé]mi[aá]s\s*index|\bGI\b/i)
  // …és szégyenmentes: a magas sáv sem hiba.
  expect(box.textContent).not.toMatch(/elrontott|hiba|rossz|bukta|kudarc|túlléptél/i)
})

test('a hozzávalók abból állnak, amiből az étkezés összeállt', () => {
  renderAt('meal-1')
  expect(screen.getByRole('heading', { name: /Hozzávalók/ })).toBeInTheDocument()
  expect(screen.getByText('Görög joghurt')).toBeInTheDocument()
  // eredet · NOVA rövid neve · kcal · mennyiség és a rész az étkezés kalóriájából
  const row = screen.getByText('Görög joghurt').closest('.fx-it')!
  expect(row).toHaveTextContent('kamra')
  expect(row).toHaveTextContent('Alapanyag')
  expect(row).toHaveTextContent('150kcal')
  expect(row).toHaveTextContent('150 g · 35%')
  // a sorok nem koppinthatók (a szerkesztés a logolóban él)
  expect(row.tagName).not.toBe('BUTTON')
})

// F1/mezo-vj61 őszinteség: csak a NÉGY tárolt tény látszik, kitalált vitamin nincs.
test('a mikrotápanyag rész csak a tárolt tényeket mutatja, a hiányzót gondolatjellel', () => {
  const { container } = renderAt('meal-1')
  const micro = container.querySelector('.fe-mic') as HTMLElement
  for (const label of ['Rost', 'Cukor', 'Só', 'Telített zsír']) {
    expect(within(micro).getByText(label)).toBeInTheDocument()
  }
  // négy sor, és egyik sem vitamin: a képesség hiányáról a kártya alján álló jegyzet beszél, nem egy sor
  const rows = Array.from(micro.querySelectorAll('.fo-row'))
  expect(rows).toHaveLength(4)
  for (const r of rows) expect(r.textContent).not.toMatch(/vitamin/i)
  expect(micro.querySelector('.fe-micnote')).toHaveTextContent('Ezt tároljuk ma. A vitaminok és ásványi anyagok még úton vannak.')
  expect(within(micro).getAllByText('—').length).toBeGreaterThan(0)
  expect(within(micro).getAllByText('nincs adat')).toHaveLength(2)
  // az ismert tény a kerethez mérve, a szintjével és az állapot-pilulával
  expect(within(micro).getByText('az étkezés-cél 86%-a')).toBeInTheDocument()
  expect(within(micro).getByText('az étkezés-keret 72%-a')).toBeInTheDocument()
})

// A prototípus a Hozzávalók fejlécébe a sorok számát írja (owner OK 2026-10-12); a Minőség fejléc felirat nélkül áll.
test('a Hozzávalók fejléce a sorok számát viseli, a Minőségé nem', () => {
  renderAt('meal-1')
  expect(screen.getByRole('heading', { name: /Hozzávalók/ })).toHaveTextContent('Hozzávalók · 3')
  expect(screen.getByRole('heading', { name: /Minőség/ })).toHaveTextContent(/^3Minőség$/)
})

test('ismeretlen étkezés-azonosítónál őszinte üres állapot, nem összeomlás', () => {
  renderAt('nincs-ilyen')
  expect(screen.getByText(/Ez az étkezés nincs meg/i)).toBeInTheDocument()
})

// A11: az értékelés a saját oldalán nyílik, nem sheetben.
test('Mezo értékelésének gombja az értékelő oldalra navigál', async () => {
  renderAt('meal-1')
  await userEvent.click(screen.getByRole('button', { name: /Mezo értékelése/ }))
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

// ── Logolt étkezésből recept (mezo-n9wgg): a recept ajtaja a javítás ajtaja mellett. ─────────

test('a recept ajtaja a Műhelybe visz, az étkezés soraival előtöltve', async () => {
  renderAt('meal-1')
  await userEvent.click(screen.getByRole('button', { name: /Mentsük receptként/ }))
  expect(router.state.location.pathname + router.state.location.search).toBe('/fuel/recipes/muhely?fromMeal=meal-1')
})

test('korábbi napi étkezésnél a recept ajtaja is viszi a napot', async () => {
  renderAt('meal-1', '?d=2026-09-10')
  await userEvent.click(screen.getByRole('button', { name: /Mentsük receptként/ }))
  expect(router.state.location.search).toBe('?fromMeal=meal-1&d=2026-09-10')
})

test('egyetlen receptből álló étkezésnél a meglévő receptet nyitja', async () => {
  renderAt('meal-recipe')
  expect(screen.queryByRole('button', { name: /Mentsük receptként/ })).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /Megnyitom a receptet/ }))
  expect(router.state.location.pathname).toBe('/fuel/recipes/rec-9')
})

test('részletezett sorok nélkül nincs recept-ajtó', () => {
  renderAt('meal-empty')
  expect(screen.queryByRole('button', { name: /Mentsük receptként/ })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Megnyitom a receptet/ })).not.toBeInTheDocument()
})

// ── Folyadék (mezo-n4wf5.5) ──────────────────────────────────────────────────────────────

test('értékelés nélkül a hős kimondja, hogy folyamatban van, és nincs gomb az értékelő oldalra', () => {
  const unscored: FuelMeal = { ...MEAL, id: 'meal-unscored', score: null, breakdown: undefined }
  DAY.meals.push(unscored)
  try {
    const { container } = renderAt('meal-unscored')
    expect(container.querySelector('.fe-pendl')).toHaveTextContent('Az értékelés folyamatban')
    expect(screen.queryByRole('button', { name: /Mezo értékelése/ })).not.toBeInTheDocument()
  } finally { DAY.meals.pop() }
})

test('az értékelés tárolt címsora a hős ítélete, az olvasata alatta áll', () => {
  const scored: FuelMeal = { ...MEAL, id: 'meal-told', breakdown: { ...MEAL.breakdown!, tagline: 'Fehérjében erős, tiszta tányér', summary: 'A fehérje viszi.' } }
  DAY.meals.push(scored)
  try {
    const { container } = renderAt('meal-told')
    expect(container.querySelector('.fo-hero-verdict')).toHaveTextContent('Fehérjében erős, tiszta tányér.')
    expect(container.querySelector('.fo-hero-sub')).toHaveTextContent('A fehérje viszi.')
  } finally { DAY.meals.pop() }
})

test('a tál megmutatja, mennyi volt benne az étkezés előtt', () => {
  const later: FuelMeal = { ...MEAL, id: 'meal-later', loggedAt: '2026-09-12T19:10:00', breakdown: undefined }
  DAY.meals.push(later)
  try {
    const { container } = renderAt('meal-later')
    // a négy korábbi (16:40-es) fixtúra-étkezés 4 × 430 kcal
    expect(container.querySelector('.fx-pk')).toHaveTextContent('előtte 1 720 kcal')
  } finally { DAY.meals.pop() }
})

test('az egyetlen recept-sor ajtaja a recept nevét írja a sor alá', () => {
  renderAt('meal-recipe')
  expect(screen.getByRole('button', { name: /Megnyitom a receptet/ })).toHaveTextContent('Zabkása')
})

test('nincs meg: a Mai oldalra visszavivő gomb', async () => {
  renderAt('nincs-ilyen')
  await userEvent.click(screen.getByRole('button', { name: 'Vissza a Mai oldalra' }))
  expect(router.state.location.pathname).toBe('/fuel')
})

test('szénhidrát nélkül a vércukor-lapka ott van, gondolatjellel, és nem koppintható', () => {
  const noCarb = { ...MEAL, id: 'meal-nocarb', c: null, breakdown: undefined } as unknown as FuelMeal
  DAY.meals.push(noCarb)
  try {
    const { container } = renderAt('meal-nocarb')
    const tile = Array.from(container.querySelectorAll('.fo-stat')).find(t => t.textContent?.includes('Vércukor-válasz'))!
    expect(tile.tagName).toBe('DIV')
    expect(tile).toHaveTextContent('—')
    expect(tile).toHaveTextContent('nincs adat')
  } finally { DAY.meals.pop() }
})
