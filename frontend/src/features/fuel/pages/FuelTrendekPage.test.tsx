// A Trendek oldal tesztjei (Fuel Titanium S3, mezo-83g0 — C1 · C4 · C5 · C6).
//
// A mock heti rollup a MAI hétre van dátumozva (`mockWeekRollup`), ezért egyetlen dátum sincs
// beégetve: minden elvárás `mondayIso()`-ból származik. (Fix fixture itt éjfélkor elromlana.)
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { QueryWrapper } from '@/test/queryWrapper'
import { FuelTrendekPage } from '@/features/fuel/pages/FuelTrendekPage'
import { mondayIso, deriveWeekTitle } from '@/data/fuel/fuelWeekHooks'
import { addDays, huMonthDay } from '@/shared/lib/dates'
import { patterns as mockPatterns } from '@/data/insights/insights'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'

function LocationProbe() {
  return <div data-testid="location">{useLocation().pathname}</div>
}

/** Útvonal + keresőstring — a hét-váltó a `?w=`-ben él, tehát a SEARCH is látszania kell. */
function LocProbe() {
  const loc = useLocation()
  return <div data-testid="loc">{loc.pathname}{loc.search}</div>
}

function renderWithRoutes() {
  return render(
    <QueryWrapper>
      <MemoryRouter initialEntries={['/fuel/trendek']}>
        <Routes>
          <Route path="/fuel/trendek" element={<FuelTrendekPage />} />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryWrapper>,
  )
}

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => { vi.unstubAllEnvs(); server.resetHandlers() })

/** `path` — a nyitó URL (a hét-váltó `?w=`-je linkelhető); `real` — valós mód (msw). */
function renderView(opts: { path?: string; real?: boolean } = {}) {
  if (opts.real) vi.stubEnv('VITE_USE_MOCK', 'false')
  return render(
    <QueryWrapper>
      <MemoryRouter initialEntries={[opts.path ?? '/fuel/trendek']}>
        <Routes>
          <Route path="/fuel/trendek" element={<><FuelTrendekPage /><LocProbe /></>} />
          <Route path="*" element={<LocProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryWrapper>,
  )
}

/** Valós mód: a MÚLT hétre ÜRES (nullás) rollup — „új felhasználó", akinek nincs korábbi hete.
 *  A nyitott hétre naplózott napokat ad, hogy a lap maga ne legyen üres. */
function serveEmptyPreviousWeek() {
  const prevMonday = addDays(mondayIso(), -7)
  const zero = { kcal: 0, p: 0, c: 0, f: 0, water: 0 }
  const targets = { kcal: 2400, p: 160, c: 250, f: 75, water: 3000 }
  server.use(http.get(`${API_BASE}/api/fuel/week/:start`, ({ params }) => {
    const start = String(params.start)
    const empty = start === prevMonday
    return HttpResponse.json({
      start,
      days: Array.from({ length: 7 }, (_, i) => ({
        date: addDays(start, i),
        targets,
        consumed: empty || i > 1 ? zero : { kcal: 2300, p: 150, c: 240, f: 72, water: 2200 },
      })),
      mealScoreAvg: empty ? null : 0.71,
      weightAvgKg: empty ? null : 82.9,
    })
  }))
}

/** A mock hét 2. napja (kedd) — naplózott, keretbe belefér. */
const loggedDay = () => huMonthDay(addDays(mondayIso(), 1))
/** A mock hét szombatja — naplózott és a keret FELETT (2740 / 2200). */
const overDay = () => huMonthDay(addDays(mondayIso(), 5))
/** A MÚLT hét hétfője — a hét-váltó próbája (fix dátum nélkül, `mondayIso()`-ból). */
const prevWeekFirstDay = () => huMonthDay(addDays(mondayIso(), -7))

// --- C1 (mezo-83g0): hét-váltás — a jóváhagyott prototípus két hetet enged megnézni. ----------

test('a heti kép a múlt hétre is átváltható', async () => {
  renderView()
  const back = screen.getByRole('button', { name: /Múlt hét/ })
  expect(back).toHaveAttribute('aria-pressed', 'false')
  await userEvent.click(back)
  expect(screen.getByTestId('loc').textContent).toContain('w=elozo')
  expect(screen.getByRole('button', { name: /Múlt hét/ })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: /Ez a hét/ })).toHaveAttribute('aria-pressed', 'false')
})

test('a múlt heti nézet a múlt hét napjait mutatja', async () => {
  renderView({ path: '/fuel/trendek?w=elozo' })
  expect(await screen.findByRole('button', { name: new RegExp(prevWeekFirstDay(), 'i') })).toBeInTheDocument()
  // A nyitott hét CÍME is a múlt hét — különben csak a napok cserélődtek volna ki.
  expect(screen.getByText(deriveWeekTitle(addDays(mondayIso(), -7)))).toBeInTheDocument()
})

test('a múlt heti nézetből egy koppintással vissza lehet jönni', async () => {
  renderView({ path: '/fuel/trendek?w=elozo' })
  await userEvent.click(screen.getByRole('button', { name: /Ez a hét/ }))
  expect(screen.getByTestId('loc').textContent).not.toContain('w=elozo')
  expect(screen.getByText(deriveWeekTitle(mondayIso()))).toBeInTheDocument()
})

// Új felhasználónál nincs korábbi hét — ez NORMÁL állapot, nem hiba.
test('korábbi hét nélkül a váltó őszintén elmondja, hogy nincs tovább', async () => {
  serveEmptyPreviousWeek()
  renderView({ real: true })
  expect(await screen.findByText(/Ez az első heted/i)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Múlt hét/ })).toBeDisabled()
})

test('a Trendek oldal a saját címével jelenik meg', () => {
  renderView()
  expect(screen.getByRole('heading', { name: 'Trendek' })).toBeInTheDocument()
})

test('a heti kép a hét napjait mutatja a kerethez mérve', () => {
  const { container } = renderView()
  expect(container.querySelectorAll('.ftx-day')).toHaveLength(7)
  // A keret vonala minden naphoz kirajzolódik, nem csak a naplózottakhoz.
  expect(container.querySelectorAll('.ftx-target').length).toBe(7)
})

// Az owner kérése: a napokon AI pontszám álljon, ne nyers makró-számok („2.1, 2.3" = „nem túl
// beszédes").
test('a nap az AI pontszámát mutatja', () => {
  const { container } = renderView()
  expect(container.querySelector('.ftx-day-score')).toHaveTextContent(/^\d/)
  // Nyers makró-pár SEHOL nem áll a napokon.
  for (const day of container.querySelectorAll('.ftx-day')) {
    expect(day.textContent).not.toMatch(/\d+[.,]\d\s*·\s*\d+[.,]\d/)
  }
})

test('a nap koppintása üvegdobozban nyitja a napi részleteket', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: new RegExp(loggedDay(), 'i') }))
  const box = screen.getByRole('dialog')
  expect(box.className).toContain('glass')
})

// A napi részletek OLVASHATÓAK: a dimenzió-tények SOROKBAN állnak (owner: „nagyon össze van
// dobva és nehéz olvasni").
test('a napi üvegdoboz sorokban tálalja a dimenzió-tényeket', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: new RegExp(loggedDay(), 'i') }))
  expect(within(screen.getByRole('dialog')).getAllByRole('listitem').length).toBeGreaterThan(1)
})

// Szégyenmentesség: a keret feletti nap nem hibaállapot.
test('a kereten túli nap nem hibaként jelenik meg', () => {
  const { container } = renderView()
  // A mock hét szombatja TÉNYLEG a keret felett jár — különben ez a teszt vákuum.
  expect(container.querySelector('.ftx-day.is-over')).not.toBeNull()
  expect(container.querySelector('.ftx-day.is-error')).toBeNull()
  expect(container.textContent).not.toMatch(/elrontott|túlléptél|hiba|rossz|bukta|kudarc/i)
})

test('a kereten túli nap üvegdoboza sem vádol', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: new RegExp(overDay(), 'i') }))
  const box = screen.getByRole('dialog')
  expect(box.textContent).toMatch(/így alakult/i)
  expect(box.textContent).not.toMatch(/elrontott|túlléptél|hiba|rossz|bukta|kudarc/i)
})

// Őszinte-null: nem naplózott nap.
test('a nem naplózott nap „nincs adat", nem nulla oszlop', () => {
  const { container } = renderView()
  const day = container.querySelector('.ftx-day.is-empty')!
  expect(day).not.toBeNull()
  expect(day).toHaveTextContent(/nincs adat/i)
  // NEM nulla magasságú oszlop: kitöltés helyett hézag-jel áll ott.
  expect(day.querySelector('.ftx-fill')).toBeNull()
  expect(day.querySelector('.ftx-gap')).not.toBeNull()
})

test('a nem naplózott nap üvegdoboza kimondja, hogy kimarad az átlagból', async () => {
  const { container } = renderView()
  const empty = container.querySelector('.ftx-day.is-empty') as HTMLButtonElement
  await userEvent.click(empty)
  expect(screen.getByRole('dialog').textContent).toMatch(/nem naplóztál/i)
  expect(screen.getByRole('dialog').textContent).toMatch(/átlagból is kimarad/i)
})

// C1 + C2: a kontraszt-sorok és a Task 1 felszabadította két átlag.
test('a hétköznap/hétvége kontraszt és a két heti átlag ott áll', () => {
  const { container } = renderView()
  expect(container.querySelectorAll('.ftx-splitrow').length).toBe(2)
  expect(screen.getByText('Hétköznap')).toBeInTheDocument()
  expect(screen.getByText('Hétvége')).toBeInTheDocument()
  expect(screen.getByText('Étkezés-minőség')).toBeInTheDocument()
  expect(screen.getByText('Heti súlyátlag')).toBeInTheDocument()
  // A mock hét átlaga 0.78 → 7,8 a 0–10 skálán; a súly 81,3 kg.
  expect(container.querySelector('.ftx-tile.is-score')).toHaveTextContent('7,8')
  expect(container.querySelector('.ftx-tile.is-weight')).toHaveTextContent('81,3')
})

// --- C2 (mezo-83g0): hét-a-héthez változás a mutató-csempéken. --------------------------------

test('a mutató-csempe a múlt héthez mért változást is mutatja', () => {
  const { container } = renderView()
  const tile = container.querySelector<HTMLElement>('.ftx-tile.is-score')!
  expect(within(tile).getByText(/[▲▼]/)).toBeInTheDocument()
  // A mock múlt hét MINDHÁROM értékben más, tehát mindhárom csempén áll változás.
  expect(container.querySelectorAll('.ftx-delta')).toHaveLength(3)
  // Az irány a valódi különbségé: a pontátlag 7,1 → 7,8 (fel), a súly 81,9 → 81,3 (le).
  expect(tile.textContent).toContain('▲')
  expect(container.querySelector('.ftx-tile.is-weight')!.textContent).toContain('▼')
})

// Szégyenmentesség: a delta nem minősít.
test('a delta nem visel jó/rossz színt vagy szöveget', () => {
  const { container } = renderView()
  expect(container.querySelector('.ftx-delta.is-good, .ftx-delta.is-bad')).toBeNull()
  expect(container.textContent).not.toMatch(/javult|romlott|gyengébb|jobb hét|rosszabb/i)
  expect(container.textContent).not.toMatch(/elrontott|túlléptél|hiba|rossz|bukta|kudarc/i)
})

test('korábbi hét nélkül egyetlen csempén sincs delta', async () => {
  serveEmptyPreviousWeek()
  const { container } = renderView({ real: true })
  await screen.findByText(/Ez az első heted/i)
  expect(container.querySelector('.ftx-delta')).toBeNull()
})

// A prototípus szabálya: a változás a NYITOTT héten áll — a múlt heti nézetben nincs mihez mérni.
test('a múlt heti nézetben nincs delta', async () => {
  const { container } = renderView({ path: '/fuel/trendek?w=elozo' })
  await screen.findByRole('button', { name: new RegExp(prevWeekFirstDay(), 'i') })
  expect(container.querySelector('.ftx-delta')).toBeNull()
})

// C6: az edzésnap a heti képben is látszik (a mock hét első napja edzésnap).
test('az edzésnap jelölést kap a heti képben', () => {
  const { container } = renderView()
  expect(container.querySelectorAll('.ftx-day .ftx-train').length).toBeGreaterThan(0)
})

// C3: a hosszabb táv a heti kép ALATT áll, és a két sorozat egy tengelyen fut.
test('a hosszabb táv a heti kép alatt, egy időtengelyen rajzol', () => {
  const { container } = renderView()
  expect(screen.getByRole('heading', { name: 'Hosszabb táv' })).toBeInTheDocument()
  expect(container.querySelector('.ftx-horizon-kcal')).not.toBeNull()
  expect(container.querySelector('.ftx-horizon-weight')).not.toBeNull()
  // A sorrend kötött: a heti kép a protagonista.
  const hero = container.querySelector('.ftx-hero')!
  const horizon = container.querySelector('.ftx-horizon')!
  expect(hero.compareDocumentPosition(horizon) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

// --- C4: a mintázatok kanonikus helye a Mezo — itt csak hivatkozunk rájuk. -------------------

test('a mintázat sora a kanonikus Mezo-elemre visz', async () => {
  renderWithRoutes()
  // A mock mintázatai közül a táplálkozási vonatkozású jön be (a „Késő szénhidrát" sor).
  await userEvent.click(screen.getByRole('button', { name: /Késő szénhidrát/ }))
  expect(screen.getByTestId('location').textContent).toMatch(/^\/mezo\/patterns\//)
})

// Anti-duplikáció: a felismerés SZÖVEGÉT nem írjuk újra itt.
test('a mintázat sora nem másolja le a felismerés szövegét', () => {
  const { container } = renderView()
  const rows = [...container.querySelectorAll('.ftx-pattern')]
  expect(rows.length).toBeGreaterThan(0)
  for (const row of rows) expect(row.textContent!.length).toBeLessThan(120)
  // A mock minta mechanizmusa/bizonyítéka SEHOL nem szerepel a lapon.
  for (const p of mockPatterns) {
    expect(container.textContent).not.toContain(p.mechanism)
    for (const e of p.evidence) expect(container.textContent).not.toContain(e)
  }
})

test('a nem táplálkozási mintázat nem szivárog át a Fuel oldalra', () => {
  const { container } = renderView()
  expect(container.textContent).not.toMatch(/Magas sportterhelés/)
  expect(container.textContent).not.toMatch(/Anna/)
})

// Valós mód, üres felismerés-lista: a réteg nem jelenik meg — és a teszt MEGVÁRJA, hogy a lap
// tényleg feloldódjon, különben vákuum volna (a betöltési ablakban triviálisan nincs réteg).
test('felismerés nélkül a réteg csendben elmarad, nem üres keret', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(http.get(`${API_BASE}/api/companion/pattern`, () => HttpResponse.json([])))
  const { container } = renderView()
  await waitFor(() => expect(container.querySelectorAll('.ftx-day')).toHaveLength(7))
  expect(container.querySelector('.ftx-patterns')).toBeNull()
  expect(container.textContent).not.toMatch(/Mintázatok/)
})

// Valós mód, táplálkozási felismeréssel: a réteg MEGJELENIK, tehát a fenti teszt nem vákuum.
test('valós módban a táplálkozási felismerés sora megjelenik', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(http.get(`${API_BASE}/api/companion/pattern`, () => HttpResponse.json([{
    id: 'p1', pairKey: 'daily-kcal~next-morning-weight-delta', category: 'response',
    categoryLabel: 'Válasz', title: 'Napi kalória ↔ másnap reggeli súlyváltozás',
    mechanism: 'SZIGORÚAN A MEZÓBAN', evidence: ['CSAK A MEZÓBAN'], status: 'monitoring',
  }])))
  const { container } = renderView()
  await waitFor(() => expect(container.querySelectorAll('.ftx-pattern')).toHaveLength(1))
  expect(screen.getByRole('button', { name: /Napi kalória/ })).toBeInTheDocument()
  expect(container.textContent).not.toContain('SZIGORÚAN A MEZÓBAN')
  expect(container.textContent).not.toContain('CSAK A MEZÓBAN')
})
