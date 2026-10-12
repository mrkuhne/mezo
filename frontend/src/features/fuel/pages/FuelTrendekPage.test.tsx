// A Trendek oldal tesztjei (Fuel Titanium S3, mezo-83g0 — C1 · C4 · C5 · C6).
//
// A mock heti rollup a MAI hétre van dátumozva (`mockWeekRollup`), ezért minden elvárás `mondayIso()`-ból származik.
// Az ÓRA viszont rögzített (egy péntek dél): a Folyadék-lapon a hét még HÁTRALÉVŐ napja más arcot kap, mint a nem
// naplózott múltbeli nap (owner-döntés 2026-10-12), tehát a „melyik nap van ma" a teszt része — a mock hét csütörtökje
// így mindig múltbeli naplózatlan nap, a vasárnapja mindig hátralévő nap. Csak a `Date` hamis, az időzítők valódiak.
// Folyadék (mezo-n4wf5.5): a szerkezeti elvárások az új jelölést nézik (`.fr-wd` edények, `Stat` csempék, `fo-sheet` lap).
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { QueryWrapper } from '@/test/queryWrapper'
import { FuelTrendekPage } from '@/features/fuel/pages/FuelTrendekPage'
import { mondayIso } from '@/data/fuel/fuelWeekHooks'
import { addDays } from '@/shared/lib/dates'
import { dayTitle, weekRangeTitle } from '@/features/fuel/logic/fuelWeekView'
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

/** Péntek dél: a hét csütörtökje múlt, a szombat és a vasárnap még hátravan. */
const FRIDAY_NOON = new Date(2026, 9, 9, 12, 0, 0)

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: FRIDAY_NOON })
  vi.stubEnv('VITE_USE_MOCK', 'true')
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); server.resetHandlers(); server.events.removeAllListeners() })

/** A regexbe írható napnév (a magyar dátum pontot hordoz). */
const rx = (text: string, tail = '') => new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + tail, 'i')

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
const loggedDay = () => dayTitle(addDays(mondayIso(), 1))
/** A mock hét szombatja — naplózott és a keret FELETT (2740 / 2200). */
const overDay = () => dayTitle(addDays(mondayIso(), 5))
/** A MÚLT hét hétfője — a hét-váltó próbája (fix dátum nélkül, `mondayIso()`-ból). */
const prevWeekFirstDay = () => dayTitle(addDays(mondayIso(), -7))
/** A mock hét csütörtökje — NEM naplózott, és (péntekről nézve) múltbeli nap. */
const unloggedPastDay = () => dayTitle(addDays(mondayIso(), 3))
/** A mock hét vasárnapja — nem naplózott, és még HÁTRALÉVŐ nap. */
const futureDay = () => dayTitle(addDays(mondayIso(), 6))

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
  expect(await screen.findByRole('button', { name: rx(prevWeekFirstDay()) })).toBeInTheDocument()
  // A nyitott hét CÍME is a múlt hét — különben csak a napok cserélődtek volna ki.
  expect(screen.getByText(weekRangeTitle(addDays(mondayIso(), -7)))).toBeInTheDocument()
})

test('a múlt heti nézetből egy koppintással vissza lehet jönni', async () => {
  renderView({ path: '/fuel/trendek?w=elozo' })
  await userEvent.click(screen.getByRole('button', { name: /Ez a hét/ }))
  expect(screen.getByTestId('loc').textContent).not.toContain('w=elozo')
  expect(screen.getByText(weekRangeTitle(mondayIso()))).toBeInTheDocument()
})

// Új felhasználónál nincs korábbi hét — ez NORMÁL állapot, nem hiba.
test('korábbi hét nélkül a váltó őszintén elmondja, hogy nincs tovább', async () => {
  serveEmptyPreviousWeek()
  renderView({ real: true })
  expect(await screen.findByText(/Ez az első heted/i)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Múlt hét/ })).toBeDisabled()
})

// Folyadék: a lap címe a keret címsorában él (a lap nem rajzol saját h1-et); a hős a „N / 7 naplózott nap" sorral nyit,
// és NINCS gombja — a vezérlője a hét-váltó.
test('a hős a naplózott napok számával nyit, saját cím és gomb nélkül', () => {
  const { container } = renderView()
  expect(screen.queryByRole('heading', { level: 1 })).toBeNull()
  const hero = container.querySelector('.fr-hero')!
  expect(hero).toHaveTextContent('5 / 7 naplózott nap · ebből áll a heti kép')
  expect(hero.querySelector('.fo-hero-acts')).toBeNull()
  expect(hero.getAttribute('data-closed')).toBe('true')
})

test('a heti kép a hét napjait mutatja a kerethez mérve', () => {
  const { container } = renderView()
  expect(container.querySelectorAll('.fr-wd')).toHaveLength(7)
  // A keret vonala minden naphoz kirajzolódik, nem csak a naplózottakhoz.
  expect(container.querySelectorAll('.fr-tb > u').length).toBe(7)
  // A Kalauz horgonya a hét edényein áll.
  expect(container.querySelector('[data-kalauz-anchor="trendek-heti"]')).toBe(container.querySelector('.fr-wk'))
})

// Az owner kérése: a napokon AI pontszám álljon, ne nyers makró-számok („2.1, 2.3" = „nem túl
// beszédes").
test('a nap az AI pontszámát mutatja', () => {
  const { container } = renderView()
  expect(container.querySelector('.fr-wd > em')).toHaveTextContent(/^\d,\d$/)
  // Nyers makró-pár SEHOL nem áll a napokon.
  for (const day of container.querySelectorAll('.fr-wd')) {
    expect(day.textContent).not.toMatch(/\d+[.,]\d\s*·\s*\d+[.,]\d/)
  }
})

test('a nap koppintása világos lapon nyitja a napi részleteket', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: rx(loggedDay()) }))
  const box = screen.getByRole('dialog')
  expect(box.className).toContain('fo-sheet')
  expect(box.className).not.toContain('glass')
  // A lap feje a nap teljes neve.
  expect(within(box).getByRole('heading', { name: loggedDay() })).toBeInTheDocument()
})

// A napi részletek OLVASHATÓAK: a dimenzió-tények SOROKBAN állnak (owner: „nagyon össze van
// dobva és nehéz olvasni").
test('a napi üvegdoboz sorokban tálalja a dimenzió-tényeket', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: rx(loggedDay()) }))
  expect(within(screen.getByRole('dialog')).getAllByRole('listitem').length).toBeGreaterThan(1)
})

// Szégyenmentesség: a keret feletti nap nem hibaállapot.
test('a kereten túli nap nem hibaként jelenik meg', () => {
  const { container } = renderView()
  // A mock hét szombatja TÉNYLEG a keret felett jár — különben ez a teszt vákuum.
  expect(container.querySelector('.fr-wd.over')).not.toBeNull()
  // A keret feletti rész külön sáv a vonal fölött — más szín, nem hibaállapot.
  expect(container.querySelector('.fr-wd.over .fr-tb > s')).not.toBeNull()
  expect(container.querySelector('.fr-wd.is-error, .fr-wd.bad')).toBeNull()
  expect(container.textContent).not.toMatch(/elrontott|túlléptél|hiba|rossz|bukta|kudarc/i)
})

test('a kereten túli nap üvegdoboza sem vádol', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: rx(overDay()) }))
  const box = screen.getByRole('dialog')
  expect(box.textContent).toMatch(/így alakult/i)
  expect(box.textContent).not.toMatch(/elrontott|túlléptél|hiba|rossz|bukta|kudarc/i)
})

// Őszinte-null: nem naplózott nap.
test('a nem naplózott nap „nincs adat", nem nulla szintű edény', () => {
  const { container } = renderView()
  const day = screen.getByRole('button', { name: rx(unloggedPastDay(), ': nincs adat') })
  expect(day).toHaveClass('gap')
  // NEM nulla magasságú szint: az edény üres, folyadék nélkül.
  expect(day.querySelector('.fr-tb > i')).toBeNull()
  expect(container.querySelectorAll('.fr-wd.gap')).toHaveLength(2)
})

test('a nem naplózott múltbeli nap lapja kimondja, hogy kimarad az átlagból, és pótolható', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: rx(unloggedPastDay()) }))
  const box = screen.getByRole('dialog')
  expect(box.textContent).toMatch(/nem naplóztál/i)
  expect(box.textContent).toMatch(/átlagból is kimarad/i)
  await userEvent.click(within(box).getByRole('button', { name: /Pótolom a napot/ }))
  expect(screen.getByTestId('loc').textContent).toBe(`/fuel?d=${addDays(mondayIso(), 3)}`)
})

// --- Owner-döntés 2026-10-12 (viselkedés-változás 2): a hét még HÁTRALÉVŐ napja nem „nem naplózott" nap. ----

test('a hátralévő nap edénye azt mondja: még előtted áll', () => {
  renderView()
  expect(screen.getByRole('button', { name: `${futureDay()}: még előtted áll` })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: rx(futureDay(), ': nincs adat') })).toBeNull()
})

test('a hátralévő nap lapja: „Ez a nap még előtted áll.", pótlás és „nem naplóztál" nélkül', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: rx(futureDay()) }))
  const box = screen.getByRole('dialog')
  expect(within(box).getByText('Ez a nap még előtted áll.')).toBeInTheDocument()
  expect(within(box).getByText('még előtted áll')).toBeInTheDocument()
  expect(within(box).queryByRole('button', { name: /Pótolom a napot/ })).toBeNull()
  expect(box.textContent).not.toMatch(/nem naplóztál|nincs adat|átlagból/i)
  expect(within(box).queryByText('A nap étkezései')).toBeNull()
})

// A hátralévő nap étkezés-olvasást sem indít (a doboz naplózatlan ágai a listát el sem renderelik).
test('a hátralévő nap megnyitása nem kér napi olvasást', async () => {
  const dayCalls: string[] = []
  server.events.on('request:start', ({ request }) => {
    const { pathname } = new URL(request.url)
    if (pathname.includes('/api/fuel/day/')) dayCalls.push(pathname)
  })
  serveEmptyPreviousWeek()
  renderView({ real: true })
  // a valós hét szerdától üres: a vasárnap hátralévő nap
  await userEvent.click(await screen.findByRole('button', { name: `${futureDay()}: még előtted áll` }))
  expect(within(screen.getByRole('dialog')).getByText('Ez a nap még előtted áll.')).toBeInTheDocument()
  expect(dayCalls).toEqual([])
})

// --- C5 (mezo-83g0): a napi doboz megmutatja, MIBŐL állt a nap — a meglévő napi olvasásból. ----

test('a napi üvegdoboz felsorolja a nap étkezéseit', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: rx(loggedDay()) }))
  const box = screen.getByRole('dialog')
  expect(await within(box).findByText('Túrós zabkása · áfonyával')).toBeInTheDocument()
  expect(within(box).getByText('A nap étkezései')).toBeInTheDocument()
})

test('az étkezés a doboz listájából a részletes oldalára visz', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: rx(loggedDay()) }))
  await userEvent.click(await screen.findByRole('button', { name: /Túrós zabkása/ }))
  expect(screen.getByTestId('loc').textContent).toContain('/fuel/etkezes/')
  // A nap is átmegy, különben a részletező lap a MAI napot olvasná, nem a megnyitottat.
  expect(screen.getByTestId('loc').textContent).toContain(`d=${addDays(mondayIso(), 1)}`)
})

// Őszinte-null: naplózatlan nap nem „hiányzó lista", hanem naplózatlan nap.
test('naplózatlan napnál nincs étkezés-lista, hanem a már meglévő őszinte mondat áll', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: rx(unloggedPastDay()) }))
  const box = screen.getByRole('dialog')
  expect(within(box).getByText(/nem naplóztál/i)).toBeInTheDocument()
  expect(within(box).queryByRole('list')).toBeNull()
  expect(within(box).queryByText('A nap étkezései')).toBeNull()
})

// A nap étkezései CSAK akkor töltődnek be, amikor tényleg megnyitják a dobozt — és C5: egy
// korábbi nap megnyitása étkezés-coach verdiktet SOHA nem kér (a coach-történet cache-only).
test('a napi olvasás csak a doboz megnyitásakor fut le, coach-kérés nélkül', async () => {
  const dayCalls: string[] = []
  const coachCalls: string[] = []
  server.events.on('request:start', ({ request }) => {
    const { pathname } = new URL(request.url)
    if (pathname.includes('/api/fuel/day/')) dayCalls.push(pathname)
    if (pathname.includes('coach')) coachCalls.push(pathname)
  })
  renderView({ real: true })
  const monday = await screen.findByRole('button', { name: rx(dayTitle(mondayIso()), ': 2') })
  expect(dayCalls).toHaveLength(0)
  await userEvent.click(monday)
  await waitFor(() => expect(dayCalls).toHaveLength(1))
  expect(dayCalls[0]).toContain(mondayIso())
  expect(coachCalls).toEqual([])
})

// C1 + C2: a két közlekedőedény és a három csempe.
test('a hétköznap/hétvége összevetés és a három csempe ott áll', () => {
  const { container } = renderView()
  const split = container.querySelector('.fr-linked')!
  expect(split.querySelectorAll('g[clip-path]')).toHaveLength(2)
  expect(split).toHaveTextContent(/Hétköznap · \d+%/)
  expect(split).toHaveTextContent(/Hétvége · \d+%/)
  expect(split).toHaveTextContent('a keret')
  expect(screen.getByText('Napi átlag')).toBeInTheDocument()
  expect(screen.getByText('Minőség')).toBeInTheDocument()
  expect(screen.getByText('Heti súlyátlag', { selector: '.fo-stat-k' })).toBeInTheDocument()
  // A mock hét átlaga 0.78 → 7,8 a 0–10 skálán; a súly 81,3 kg.
  expect(container.querySelector('.fr-t3 .is-score')).toHaveTextContent('7,8/ 10')
  expect(container.querySelector('.fr-t3 .is-weight')).toHaveTextContent('81,3kg')
  // Sima csempék: egyiknek sincs szintje.
  expect(container.querySelector('.fr-t3 .fo-stat.lv')).toBeNull()
})

// --- C2 (mezo-83g0): hét-a-héthez változás a csempéken. --------------------------------

test('a csempe a múlt héthez mért változást is mutatja: irány és mennyiség', () => {
  const { container } = renderView()
  // A mock múlt hét MINDHÁROM értékben más, tehát mindhárom csempén áll változás.
  expect(container.querySelectorAll('.fr-t3 .fo-stat-s')).toHaveLength(3)
  // Az irány a valódi különbségé: a pontátlag 7,1 → 7,8 (több), a súly 81,9 → 81,3 (kevesebb).
  expect(container.querySelector('.fr-t3 .is-score .fo-stat-s')).toHaveTextContent('0,7 ponttal több')
  expect(container.querySelector('.fr-t3 .is-weight .fo-stat-s')).toHaveTextContent('0,6 kg-mal kevesebb')
  expect(container.querySelector('.fr-t3 .is-avg .fo-stat-s')).toHaveTextContent(/^\d[\d ]* kcal-lal (több|kevesebb)$/)
  expect(screen.getByText(/irány és mennyiség, nem ítélet/)).toBeInTheDocument()
})

// Szégyenmentesség: a delta nem minősít.
test('a delta nem visel jó/rossz színt vagy szöveget', () => {
  const { container } = renderView()
  expect(container.querySelector('.fr-t3 .ok, .fr-t3 .warn, .fr-t3 .bad, .fr-t3 .is-good, .fr-t3 .is-bad')).toBeNull()
  expect(container.textContent).not.toMatch(/javult|romlott|gyengébb|jobb hét|rosszabb/i)
  expect(container.textContent).not.toMatch(/elrontott|túlléptél|hiba|rossz|bukta|kudarc/i)
})

test('korábbi hét nélkül egyetlen csempén sincs delta', async () => {
  serveEmptyPreviousWeek()
  const { container } = renderView({ real: true })
  await screen.findByText(/Ez az első heted/i)
  expect(container.querySelector('.fr-t3 .fo-stat-s')).toBeNull()
})

// A prototípus szabálya: a változás a NYITOTT héten áll — a múlt heti nézetben nincs mihez mérni.
test('a múlt heti nézetben nincs delta', async () => {
  const { container } = renderView({ path: '/fuel/trendek?w=elozo' })
  await screen.findByRole('button', { name: rx(prevWeekFirstDay()) })
  expect(container.querySelector('.fr-t3 .fo-stat-s')).toBeNull()
})

// C6: az edzésnap a heti képben is látszik (a mock hét első napja edzésnap).
test('az edzésnap jelölést kap a heti képben', () => {
  const { container } = renderView()
  expect(container.querySelectorAll('.fr-wd > small.tr').length).toBeGreaterThan(0)
})

// C3: a hosszabb táv a heti kép ALATT áll: fent a súly, lent az evés, ugyanazokon a heteken.
test('a hosszabb táv a heti kép alatt rajzol: súly és kalória egymás alatt', () => {
  const { container } = renderView()
  expect(screen.getByRole('heading', { name: /Hosszabb táv · 7 hét/ })).toBeInTheDocument()
  const weight = container.querySelector('.fr-ser.is-weight')!
  const kcal = container.querySelector('.fr-ser.is-kcal')!
  expect(weight).not.toBeNull()
  expect(kcal).not.toBeNull()
  expect(weight.compareDocumentPosition(kcal) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  // A sorrend kötött: a heti kép a protagonista.
  const hero = container.querySelector('.fr-hero')!
  const horizon = container.querySelector('.fr-horizon')!
  expect(hero.compareDocumentPosition(horizon) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

// Új, jóváhagyott: a súlycél vízvonala a MEGLÉVŐ cél-hookból (a mock célja 79,0 kg).
test('a súlygrafikonon ott a súlycél vízvonala', () => {
  const { container } = renderView()
  expect(container.querySelector('.fr-ser.is-weight .fr-ser-goal')).not.toBeNull()
  expect(container.querySelector('.fr-horizon')).toHaveTextContent(/cél · \d+,\d kg/)
})

// Súlycél nélkül nincs vonal (`trendek.nincs-cel`).
test('súlycél nélkül nincs vízvonal', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(http.get(`${API_BASE}/api/goals`, () => HttpResponse.json([])))
  const { container } = renderView()
  await waitFor(() => expect(container.querySelector('.fr-hero')).not.toHaveTextContent('Töltöm a hetedet'))
  expect(container.querySelector('.fr-ser-goal')).toBeNull()
  expect(container.textContent).not.toMatch(/cél ·/)
})

// --- C4: a mintázatok kanonikus helye a Mezo — itt csak hivatkozunk rájuk. -------------------

test('a mintázat sora a kanonikus Mezo-elemre visz', async () => {
  renderWithRoutes()
  // A mock mintázatai közül a táplálkozási vonatkozású jön be (a „Késő szénhidrát" sor).
  await userEvent.click(screen.getByRole('link', { name: /Késő szénhidrát/ }))
  expect(screen.getByTestId('location').textContent).toMatch(/^\/mezo\/patterns\//)
})

// Anti-duplikáció: a felismerés SZÖVEGÉT nem írjuk újra itt.
test('a mintázat sora nem másolja le a felismerés szövegét', () => {
  const { container } = renderView()
  const rows = [...container.querySelectorAll('.fr-pattern')]
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
  await waitFor(() => expect(container.querySelector('.fr-hero')).not.toHaveTextContent('Töltöm a hetedet'))
  expect(container.querySelector('.fr-patterns')).toBeNull()
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
  await waitFor(() => expect(container.querySelectorAll('.fr-pattern')).toHaveLength(1))
  expect(screen.getByRole('link', { name: /Napi kalória/ })).toHaveTextContent('Figyeljük')
  expect(screen.getByRole('heading', { name: /Mintázatok · 1/ })).toBeInTheDocument()
  expect(container.textContent).not.toContain('SZIGORÚAN A MEZÓBAN')
  expect(container.textContent).not.toContain('CSAK A MEZÓBAN')
})

// --- Kihagyás S3 (mezo-q4xt2.3): a kímélő nap a heti képben ---------------------------------

/** Valós mód: a nyitott hét szombatja (a keret FELETT járt) kímélő nap — GUIDANCE. */
function serveWeekWithRecoveryDay(mode: 'GUIDANCE' | 'MAINTENANCE' = 'GUIDANCE') {
  const targets = { kcal: 2400, p: 160, c: 250, f: 75, water: 3000 }
  server.use(http.get(`${API_BASE}/api/fuel/week/:start`, ({ params }) => {
    const start = String(params.start)
    return HttpResponse.json({
      start,
      days: Array.from({ length: 7 }, (_, i) => ({
        date: addDays(start, i),
        targets,
        consumed: { kcal: i === 5 ? 3100 : 2300, p: 150, c: 240, f: 72, water: 2200 },
        ...(i === 5 ? { fuelMode: mode } : {}),
      })),
      mealScoreAvg: 0.71,
      weightAvgKg: 82.9,
    })
  }))
}

test('a kímélő nap jele a pont helyén áll, lila szinttel — se százalék, se keret-vonal, se „felett"', async () => {
  serveWeekWithRecoveryDay()
  const { container } = renderView({ real: true })
  const bar = await screen.findByRole('button', { name: `${overDay()}: kímélő nap` })
  expect(bar).toHaveClass('rec')
  expect(bar).not.toHaveClass('over')
  expect(bar.querySelector('em use')!.getAttribute('href')).toBe('#t-kimelo')
  expect(bar.querySelector('.fr-tb > u')).toBeNull()
  expect(bar.querySelector('.fr-tb > s')).toBeNull()
  expect(bar.querySelector('.fr-tb > i')).not.toBeNull()
  expect(bar.textContent).not.toMatch(/%|\d+ kcal/)
  // a többi nap a megszokott: keret-vonallal
  expect(container.querySelectorAll('.fr-tb > u')).toHaveLength(6)
  // a jelmagyarázat megnevezi
  expect(container.querySelector('.fr-lg')).toHaveTextContent('kímélő nap')
})

test('a kímélő nap részletei: „Kímélő nap", az „Így számolom" szöveg, semmi mérés a kerethez', async () => {
  serveWeekWithRecoveryDay('MAINTENANCE')
  renderView({ real: true })
  await userEvent.click(await screen.findByRole('button', { name: `${overDay()}: kímélő nap` }))
  const box = await screen.findByRole('dialog')
  expect(within(box).getByText('Kímélő nap')).toBeInTheDocument()
  expect(within(box).getByText('Így számolom')).toBeInTheDocument()
  expect(box.textContent).toContain('Amit ezen a napon ettél (3 100 kcal), nem mérem a kerethez, és a heti értékelésbe sem számít bele. A beírt étkezéseid megmaradnak.')
  expect(box.textContent).not.toMatch(/fölé ment|belefértél|étkezés-pont|elrontott|túlléptél|hiba|rossz|bukta|kudarc/i)
  expect(box.querySelector('use')!.getAttribute('href')).toBe('#t-kimelo')
})

// A kímélő nap kimarad az átlagokból: a hat rendes nap 2300 kcal-os átlaga áll a csempén, nem a 3100-zal húzott.
test('a kímélő nap nincs benne a napi átlagban', async () => {
  serveWeekWithRecoveryDay()
  const { container } = renderView({ real: true })
  await screen.findByRole('button', { name: `${overDay()}: kímélő nap` })
  expect(container.querySelector('.fr-t3 .is-avg')).toHaveTextContent('2 300kcal')
})

// A betöltés arca: „Töltöm a hetedet…", hét üres edénnyel — a hét dátumai ismertek, a tartalmuk még nem.
test('betöltés közben a hős nem állít semmit a hétről', async () => {
  let release: () => void = () => {}
  const gate = new Promise<void>((resolve) => { release = resolve })
  server.use(http.get(`${API_BASE}/api/fuel/week/:start`, async ({ params }) => {
    await gate
    const start = String(params.start)
    return HttpResponse.json({ start, days: [], mealScoreAvg: null, weightAvgKg: null })
  }))
  const { container } = renderView({ real: true })
  expect(container.querySelector('.fr-hero')).toHaveTextContent('Naplózott napok')
  expect(container.querySelector('.fr-hero')).toHaveTextContent('Töltöm a hetedet…')
  expect(container.querySelectorAll('.fr-wd.gap')).toHaveLength(7)
  release()
  await waitFor(() => expect(container.querySelector('.fr-hero')).not.toHaveTextContent('Töltöm a hetedet…'))
})
