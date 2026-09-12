// ============================================================
// Mezo · Fuel hub tests (Design 2.0 F3.1, mezo-d20.4.1) — the /fuel index's Mozaik
// face: Titán energia-hero (ONE number) → the day's meal BLOCKS → the generic log action →
// 6-tile mosaic → Fuel-beállítások band.
//
// Fuel Titanium S1b (mezo-33k6, manifest A10/A11/A14): the Mai is the CANONICAL home of the
// day's meals, so the `FuelLogHeroTile` (.fh-logtile) — the hub's old single door to
// /fuel/log — is GONE from this page, and with it the expectations that described its face
// (its window dots, its „x/y ablak kész" line, its all-done celebration, its next-window
// copy). Those contracts are re-stated here on the blocks, which now carry the same truths
// with a real tap target per window; the per-block anatomy itself is covered by
// FuelMealBlocks.test.tsx. The tile's ONE unique job, the „tegnap pótolható" bait, survives
// as its own chip and keeps its test.
//
// The hub's contracts here: the hero stays ONE number, the blocks honestly mirror the day's
// windows and log INTO a window (`?w=`), a logged meal opens its own page, the generic log
// action sits BELOW the blocks, the víz ring opens the water sheet, the energy chip reopens
// the shared EnergyBreakdownSheet, and the Fuel-beállítások band opens the settings page.
// ============================================================
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, vi } from 'vitest'
import type { FuelSlot } from '@/data/types'
import { FuelMaiPage } from '@/features/fuel/pages/FuelMaiPage'
import { QueryWrapper } from '@/test/queryWrapper'
import { addDays, localDateString, huMonthDay, huFullDate } from '@/shared/lib/dates'
// Az ablak-kulcsot az app SAJÁT exportált szabálya adja (mezo-bq2t) — egy helyi másolat
// zölden hagyná a tesztet akkor is, ha a `?w=` szerződés elmozdul.
import { tileKey } from '@/features/fuel/logic/fuelSwimlane'

// The mock demo day (fixed now 13:30) is a PARTIAL day (mezo-1oy5): breakfast + lunch
// logged, the midday/evening windows open. To page-test the missed→Pótold CTA, the
// all-done seed and the empty day deterministically, known slots can be injected into
// the composed timeline (ADDED to the real seed, or a full REPLACEMENT); both off by
// default, so every other test sees the unmodified real timeline.
//
// A13 (mezo-33k6): a lapozás bizonyítéka az, hogy a DÁTUM eléri az adatréteget — nem a címke.
// Ezért a mock FELJEGYZI, milyen nappal hívták a `useFuelDay`/`useFuelTimeline`-t, és egy nap
// őszintén üresre is állítható (mock módban ugyanis a seed MINDEN napra ugyanazt adná vissza).
const hoisted = vi.hoisted(() => ({
  injectOpenSlot: false,
  injectMissedSlot: false,
  overrideSlots: null as FuelSlot[] | null,
  emptyDates: [] as string[],
  dayCalls: [] as string[],
  timelineCalls: [] as string[],
}))
const ZERO = { kcal: 0, p: 0, c: 0, f: 0, water: 0 }
vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return {
    ...actual,
    useFuelDay: (date?: string) => {
      hoisted.dayCalls.push(date ?? '(ma)')
      const real = actual.useFuelDay(date)
      if (date != null && hoisted.emptyDates.includes(date)) {
        return { ...real, fuel: { ...real.fuel, meals: [], consumed: ZERO } }
      }
      return real
    },
    useFuelTimeline: (date?: string) => {
      hoisted.timelineCalls.push(date ?? '(ma)')
      const real = actual.useFuelTimeline(date)
      if (hoisted.overrideSlots) return { ...real, plan: { ...real.plan, slots: hoisted.overrideSlots } }
      const extra: FuelSlot[] = []
      if (hoisted.injectOpenSlot) {
        extra.push({
          time: '20:00', kind: 'snack', label: 'Esti snack', slotKey: 'snack',
          state: 'pending', kcal: 300, p: 20, c: 30, f: 8,
        })
      }
      if (hoisted.injectMissedSlot) {
        extra.push({
          time: '11:00', kind: 'snack', label: 'Tízórai', slotKey: 'snack',
          state: 'missed', kcal: 200, p: 10, c: 20, f: 5,
        })
      }
      if (extra.length === 0) return real
      return { ...real, plan: { ...real.plan, slots: [...real.plan.slots, ...extra] } }
    },
  }
})

// The hub reads the composed dual-mode useFuelDay/useFuelTimeline; pin mock mode for the
// static Phase-1 seed and provide a QueryClientProvider.
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => {
  vi.unstubAllEnvs()
  hoisted.injectOpenSlot = false
  hoisted.injectMissedSlot = false
  hoisted.overrideSlots = null
  hoisted.emptyDates = []
  hoisted.dayCalls = []
  hoisted.timelineCalls = []
})

/** Reports the live URL so navigations are observable. */
function LocationProbe() {
  const loc = useLocation()
  return <div data-testid="loc">{loc.pathname}{loc.search}</div>
}

const renderView = (path = '/fuel') =>
  render(
    <QueryWrapper>
      <MemoryRouter initialEntries={[path]}>
        <FuelMaiPage />
        <LocationProbe />
      </MemoryRouter>
    </QueryWrapper>,
  )

// ── shell dissolution + page anatomy ─────────────────────────────────────────

test('the hub is the Mozaik face: hero → Logolás hero tile → mosaic → band, no sub-nav shell', () => {
  const { container } = renderView()
  expect(container.querySelector('.fh-hub')).toBeInTheDocument()
  expect(screen.queryByLabelText('Fuel alnavigáció')).toBeNull()
  const hero = container.querySelector('.fh-hero')
  // S1b: a nap blokkjai váltották a Logolás-csempét (mezo-33k6).
  const blocks = container.querySelector('.fmx-blocks')
  const mosaic = container.querySelector('.mz-mosaic')
  expect(hero).toBeInTheDocument()
  expect(blocks).toBeInTheDocument()
  expect(mosaic).toBeInTheDocument()
  expect(container.querySelector('.fh-logtile')).toBeNull()
  // The Mezo Fuel-üzenetek band is retired (mezo-04lo) — unused, tile removed with its page.
  expect(container.querySelector('.fh-mezotile')).toBeNull()
  expect(hero!.compareDocumentPosition(blocks!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(blocks!.compareDocumentPosition(mosaic!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  // The retired sky/island shell is gone.
  expect(container.querySelector('.sky-islands')).toBeNull()
  expect(container.querySelector('.kdone')).toBeNull()
})

// ── the Titanium energy hero (Fuel Titanium S1a, mezo-33k6 — manifest A1/A2/A15) ──────
// The pre-Titanium keret-hero (`.khero-*`: the consumed-kcal numeral, the segmented day-bar,
// the three energy chips) is GONE from this page. S5 (mezo-qt5q) retired its last host
// (`/fuel/log`), so `KeretHero.tsx` went with the page — the day's energy contract now lives
// ONLY here, on `FuelEnergyHero` (see the hero block below).

// A1/A2/A15 (mezo-33k6): a Mai teteje a Titán energiaműszer. A régi KeretHero elment.
test('a Mai a Titán energia-heroval nyit', () => {
  const { container } = renderView()
  expect(container.querySelector('.fmx-hero')).not.toBeNull()
  expect(container.querySelector('.khero-n')).toBeNull()
  expect(container.querySelectorAll('.fmx-cell')).toHaveLength(5)
})

test('a domináns szám a MARADÉK, és a hero nem mond „eddig x / y"-t', () => {
  const { container } = renderView()
  const hero = container.querySelector('.fh-hero') as HTMLElement
  const remaining = container.querySelector('.fmx-hero-remaining')!
  expect(remaining.getAttribute('aria-label')).toMatch(/kcal (fér még bele ma|a keret felett)$/)
  // The retired day-bar and chip row are not replaced by a second number row.
  expect(container.querySelector('.khero-dayseg')).toBeNull()
  expect(container.querySelector('.khero-chips')).toBeNull()
  expect(hero.textContent).not.toContain('eddig')
  expect(hero.textContent).not.toMatch(/\d+\/\d+ ablak/)
})

test('a műszer íve a nap elfogyasztott részét rajzolja ki', () => {
  const { container } = renderView()
  // The mock demo day's real consumed kcal (breakfast 580 + lunch 720 + a coherent late-miss
  // dinner 760, fix-round-1 F1 mezo-jcpt.3, = 2060) against the day's own keret.
  const gauge = container.querySelector('.fmx-gauge') as HTMLElement
  const progress = Number(gauge.style.getPropertyValue('--fuel-progress'))
  expect(progress).toBeGreaterThan(0)
  expect(progress).toBeLessThanOrEqual(100)
  expect(container.querySelector('.fmx-gauge use')!.getAttribute('href')).toBe('#i-fuel')
})

// A15: a hero koppintása a MEGLÉVŐ, Énnel közös energia-magyarázatot nyitja — nem másolatot.
test('a hero koppintása az energia-magyarázatot nyitja', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: /Miből jön össze/ }))
  expect(await screen.findByText(/Alapanyagcsere/i)).toBeInTheDocument()
  // The hero's own local glass box never opens on this page — one provenance surface only
  // (the shared sheet itself is a role=dialog, so assert on the box's own element).
  expect(document.querySelector('dialog.fmx-glass')).toBeNull()
  await userEvent.click(screen.getByRole('button', { name: 'Bezárás' }))
  await waitFor(() => expect(screen.queryByText(/Honnan jön a/)).toBeNull())
})

test('the macro rings read via aria-labels; the víz ring opens WaterLogSheet and the log lands', async () => {
  const { container } = renderView()
  expect(container.querySelector('[aria-label^="Fehérje:"]')).toBeInTheDocument()
  expect(container.querySelector('[aria-label^="Szénhidrát:"]')).toBeInTheDocument()
  expect(container.querySelector('[aria-label^="Zsír:"]')).toBeInTheDocument()
  expect(container.querySelector('[aria-label^="Rost:"]')).toBeInTheDocument()

  const before = screen.getByRole('button', { name: /^Víz logolása/ }).getAttribute('aria-label')
  await userEvent.click(screen.getByRole('button', { name: /^Víz logolása/ }))
  expect(await screen.findByText('Mennyit ittál?')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: '250 ml' }))
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  await waitFor(() => expect(screen.queryByText('Mennyit ittál?')).toBeNull())
  expect(screen.getByRole('button', { name: /^Víz logolása/ }).getAttribute('aria-label')).not.toBe(before)
})

// ── the Logolás hero tile (mezo-byo1 — the swimlane's successor) ─────────────
// The per-window logging behaviors (slot seeding, Pótold, AI arm, out-of-window,
// score chips) live on the `/fuel/log/uj` logger (FuelLogNewPage.test.tsx) since S1c; the hub
// carries the blocks whose face follows the same WindowLaneVM.

const DONE_REGGELI: FuelSlot = {
  time: '09:15', kind: 'meal', label: 'Reggeli', slotKey: 'breakfast', state: 'done',
  mealId: 'm1', mealName: 'Túrós zabkása · áfonyával', kcal: 580, p: 42, c: 78, f: 12,
}
const OPEN_UZSONNA: FuelSlot = {
  time: '16:30', kind: 'snack', label: 'Uzsonna', slotKey: 'snack', state: 'pending',
  kcal: 380, p: 26, c: 34, f: 15,
}

// A10 (mezo-33k6): a Mai a nap étkezéseinek KANONIKUS helye — a blokkok itt élnek.
test('a Mai a blokkokat mutatja, és a blokk a naplózóba visz az ablakával', async () => {
  hoisted.overrideSlots = [DONE_REGGELI, OPEN_UZSONNA]
  const { container } = renderView()
  expect(container.querySelectorAll('.fmx-block').length).toBeGreaterThan(0)
  await userEvent.click(screen.getByRole('button', { name: /Uzsonna/ }))
  expect(screen.getByTestId('loc')).toHaveTextContent('/fuel/log/uj')
  expect(screen.getByTestId('loc').textContent).toContain('w=')
  // A kulcsot az app saját `${time}-${label}` szabálya adja, nem egy kitalált string.
  expect(screen.getByTestId('loc').textContent)
    .toContain(`w=${encodeURIComponent(tileKey(OPEN_UZSONNA))}`)
})

test('a logolt étkezés pont-chipje az értékelő oldalra visz', async () => {
  hoisted.overrideSlots = [DONE_REGGELI, OPEN_UZSONNA]
  renderView()
  await userEvent.click(screen.getAllByRole('button', { name: /AI értékelés/ })[0])
  expect(screen.getByTestId('loc')).toHaveTextContent('/fuel/etkezes/')
})

// Az általános naplózó a lap ALJÁN marad (owner).
test('az általános naplózás a blokkok alatt áll', () => {
  const { container } = renderView()
  const blocks = container.querySelector('.fmx-blocks')!
  const generic = container.querySelector('.fmx-loggeneric')!
  expect(blocks.compareDocumentPosition(generic) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

test('az általános naplózás a logoló oldalt nyitja, ablak-kulcs nélkül', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: 'Logolás ablakon kívül' }))
  expect(screen.getByTestId('loc').textContent).toBe('/fuel/log/uj')
})

// A blokkok a nap ablakait tükrözik — a visszavont Logolás-csempe pontsor-szerepe
// (done/now/missed jelzés) itt, blokkonként él tovább.
test('a blokkok a nap ablakait tükrözik, állapotostul', () => {
  hoisted.overrideSlots = [
    DONE_REGGELI,
    { time: '13:00', kind: 'meal', label: 'Ebéd', slotKey: 'lunch', state: 'now', kcal: 700, p: 40, c: 70, f: 20 },
    { time: '19:00', kind: 'meal', label: 'Vacsora', slotKey: 'dinner', state: 'pending', kcal: 600, p: 35, c: 60, f: 18 },
  ]
  const { container } = renderView()
  expect(Array.from(container.querySelectorAll('.fmx-block-name')).map(e => e.textContent))
    .toEqual(['Reggeli', 'Ebéd', 'Vacsora'])
  expect(container.querySelectorAll('.fmx-block.is-done')).toHaveLength(1)
  expect(container.querySelectorAll('.fmx-block.is-now')).toHaveLength(1)
  expect(container.querySelectorAll('.fmx-block.is-future')).toHaveLength(1)
})

test('a kihagyott ablak a blokkján is szégyenmentes — „még pótolható", nem hiba', () => {
  hoisted.injectMissedSlot = true
  const { container } = renderView()
  const missed = container.querySelector('.fmx-block.is-missed')!
  expect(missed.textContent).toContain('még pótolható')
  expect(container.textContent).not.toMatch(/bukt|elrontot|kudarc/i)
})

test('an empty day names the gap on the blocks instead of fabricating windows', () => {
  hoisted.overrideSlots = []
  const { container } = renderView()
  expect(container.querySelectorAll('.fmx-block')).toHaveLength(0)
  expect(within(container.querySelector('.fmx-blocks') as HTMLElement)
    .getByText(/nincs tervezett étkezési ablak/i)).toBeInTheDocument()
})

test('hub-csali: tegnapi pótolható ablakok chipje dátummal + darabszámmal, ?d=-re navigál', async () => {
  // The mocked useFuelTimeline returns the SAME crafted plan for every date, so
  // yesterday's past-normalized lane also carries 1 done + 1 now + 1 pending
  // → 2 missed once the now/future tiles flip to 'missed'.
  hoisted.overrideSlots = [
    { time: '08:00', kind: 'meal', label: 'Reggeli', slotKey: 'breakfast', state: 'done', kcal: 500, p: 30, c: 50, f: 15 },
    { time: '13:00', kind: 'meal', label: 'Ebéd', slotKey: 'lunch', state: 'now', kcal: 700, p: 40, c: 70, f: 20 },
    { time: '19:00', kind: 'meal', label: 'Vacsora', slotKey: 'dinner', state: 'pending', kcal: 600, p: 35, c: 60, f: 18 },
  ]
  const yesterday = addDays(localDateString(), -1)
  const dateLabel = `${huMonthDay(yesterday).toLowerCase()}.`
  const { container } = renderView()
  const chip = screen.getByRole('button', { name: /pótolható/ })
  expect(chip.textContent).toContain(dateLabel)
  expect(chip.textContent).toContain('2 ablak pótolható')
  // A chip a blokkok MELLETT áll, sosem beágyazva (nested button nincs).
  expect(container.querySelector('.fmx-blocks')!.contains(chip)).toBe(false)
  await userEvent.click(chip)
  // S5 (mezo-qt5q): a pótlás ajtaja a Mai lapozója — a `/fuel/log` lap megszűnt.
  expect(screen.getByTestId('loc').textContent).toBe(`/fuel?d=${yesterday}`)
})

test('hub-csali: ha tegnap minden ablak done, nincs chip', () => {
  hoisted.overrideSlots = [
    { time: '08:00', kind: 'meal', label: 'Reggeli', slotKey: 'breakfast', state: 'done', kcal: 500, p: 30, c: 50, f: 15 },
    { time: '13:00', kind: 'meal', label: 'Ebéd', slotKey: 'lunch', state: 'done', kcal: 700, p: 40, c: 70, f: 20 },
  ]
  renderView()
  expect(screen.queryByRole('button', { name: /pótolható/ })).toBeNull()
})

// ── napozás: a Mai lapozható (Fuel Titanium S1d, mezo-33k6 — manifest A13) ───
// A pótlás NEM külön oldal többé: a Mai maga lapozható, a naplózóval KÖZÖS 7 napos
// ablakon belül (backfillWindow.ts). A `?d=` az URL-ben él, hogy a nap deep-linkelhető
// legyen és a böngésző-vissza természetes maradjon.

const TODAY = localDateString()
// Szándékosan NEM tegnap: a tegnapi napot a „pótolható" csali amúgy is beolvassa, így egy
// tegnapra írt állítás akkor is zöld lenne, ha a lapozás egyáltalán nem érné el az adatréteget.
const D3 = addDays(TODAY, -3)

test('a visszalapozott nap a saját adatával jelenik meg', async () => {
  renderView(`/fuel?d=${D3}`)
  // A Mai a kétsoros dátumsort viseli (jóváhagyott prototípus): a címke a TELJES dátum.
  expect(await screen.findByText(huFullDate(D3))).toBeInTheDocument()
  expect(hoisted.dayCalls).toContain(D3)
  expect(hoisted.timelineCalls).toContain(D3)
})

test('hét napnál régebbre nem lehet lapozni', () => {
  renderView(`/fuel?d=${addDays(TODAY, -7)}`)
  expect(screen.getByRole('button', { name: 'Előző nap' })).toBeDisabled()
})

test('a jövőbe nem lehet lapozni', () => {
  renderView('/fuel')
  expect(screen.getByRole('button', { name: 'Következő nap' })).toBeDisabled()
})

// A naplózó `?d=` clampje és a lapozó alsó kapuja UGYANAZ a szabály: az ablakon kívüli
// deep link MA-ra esik vissza, nem egy olyan napra, amit a naplózó visszautasítana.
test('az ablakon kívüli ?d= MA-ra esik vissza', () => {
  renderView(`/fuel?d=${addDays(TODAY, -9)}`)
  // A mai nap jelzése a címke FÖLÖTTI sorban áll, a címke a teljes dátum.
  expect(screen.getByText('MA')).toBeInTheDocument()
  expect(screen.getByText(huFullDate(TODAY))).toBeInTheDocument()
  expect(hoisted.dayCalls).toContain(TODAY)
  expect(hoisted.dayCalls).not.toContain(addDays(TODAY, -9))
})

test('múltbeli napon a blokk a pótlásba visz, a nap megtartásával', async () => {
  hoisted.overrideSlots = [DONE_REGGELI, OPEN_UZSONNA]
  renderView(`/fuel?d=${D3}`)
  await userEvent.click(screen.getAllByRole('button', { name: /Uzsonna/ })[0])
  const loc = screen.getByTestId('loc').textContent!
  expect(loc).toContain('/fuel/log/uj')
  expect(loc).toContain(`d=${D3}`)
  // Az ablak-kulcs továbbra is az app saját szabályából jön.
  expect(loc).toContain(`w=${encodeURIComponent(tileKey(OPEN_UZSONNA))}`)
})

test('múltbeli napon az általános naplózás is megtartja a napot', async () => {
  renderView(`/fuel?d=${D3}`)
  await userEvent.click(screen.getByRole('button', { name: 'Logolás ablakon kívül' }))
  expect(screen.getByTestId('loc').textContent).toBe(`/fuel/log/uj?d=${D3}`)
})

// Őszinte üres állapot: egy régi nap adat nélkül NEM nullákat mutat — a keret-műszer eltűnik,
// mert egy lezárt napon a „még belefér <teljes keret>" olvasat valótlan lenne.
test('adat nélküli múltbeli nap őszintén üres', () => {
  hoisted.emptyDates = [D3]
  const { container } = renderView(`/fuel?d=${D3}`)
  expect(screen.getByText(/Erre a napra nincs adat/i)).toBeInTheDocument()
  expect(container.querySelector('.fmx-hero')).toBeNull()
  // Szégyenmentes: az üresség nem hiba.
  expect(container.textContent).not.toMatch(/kihagytad|bukt|hiba/i)
})

// A lapozás az URL-ben él (ez teszi a későbbi, domének közti közös dátum-tengelyt olcsóvá).
test('a lapozás a ?d=-t írja, a mai nap pedig paraméter nélkül marad', async () => {
  renderView('/fuel')
  await userEvent.click(screen.getByRole('button', { name: 'Előző nap' }))
  expect(screen.getByTestId('loc').textContent).toBe(`/fuel?d=${addDays(TODAY, -1)}`)
  await userEvent.click(screen.getByRole('button', { name: 'Következő nap' }))
  expect(screen.getByTestId('loc').textContent).toBe('/fuel')
})

// ── a víz-modul (Fuel Titanium S1d, mezo-33k6 — manifest A12) ────────────────
// A víz a Mai-on MARAD (owner), első osztályú modulként a blokkok ALATT — a hero
// víz-gyűrűje továbbra is a sheet ajtaja, a modul pedig a gyorsgombokat adja.

test('a víz-modul a blokkok alatt, a mozaik előtt áll', () => {
  const { container } = renderView()
  const blocks = container.querySelector('.fmx-blocks')!
  const water = container.querySelector('.fmx-water')!
  const mosaic = container.querySelector('.mz-mosaic')!
  expect(water).toBeInTheDocument()
  expect(blocks.compareDocumentPosition(water) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(water.compareDocumentPosition(mosaic) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

test('a víz-modul gyorsgombja a napot írja, és a hero gyűrűje követi', async () => {
  renderView()
  const before = screen.getByRole('button', { name: /^Víz logolása/ }).getAttribute('aria-label')
  await userEvent.click(screen.getByRole('button', { name: '+2,5 dl' }))
  await waitFor(() => expect(screen.getByRole('button', { name: /^Víz logolása/ })
    .getAttribute('aria-label')).not.toBe(before))
})

// ── the 6-tile mosaic ────────────────────────────────────────────────────────

// S5 (mezo-qt5q): MINDEN csempe ÉLŐ lapra nyílik — egyik sem fut bele egy redirectbe. A `Terv`
// (`/fuel/plan`) és a `Napló` (`/fuel/naplo`) csempe egy Trendek-csempévé olvadt, mert mind a két
// lap a Trendekbe költözött (C1/C5); két csempe ugyanarra a lapra félrevezető lenne.
test('the mosaic carries exactly the five Fuel tiles, each navigating to its own LIVE page', async () => {
  renderView()
  const expected = [
    ['Trendek', '/fuel/trendek'],
    ['Stack', '/fuel/stack'],
    ['Receptek', '/fuel/recipes'],
    ['Kamra', '/fuel/kamra'],
    ['Gyógyszer', '/fuel/gyogyszer'],
  ] as const
  for (const [label, path] of expected) {
    const tile = screen.getByRole('button', { name: label })
    fireEvent.click(tile)
    expect(screen.getByTestId('loc').textContent).toBe(path)
  }
  // A retirált két ajtó NEM él tovább csempeként.
  expect(screen.queryByRole('button', { name: 'Terv' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Napló' })).toBeNull()
})

test('tile lines come from the pages\' own data — a Kamra count, no fabricated numbers', () => {
  renderView()
  expect(screen.getByRole('button', { name: 'Kamra' })).toHaveTextContent(/\d+ tétel/)
})

// A napi AI-átlag a visszavont Napló-csempe EGYETLEN saját jele volt — S5 (mezo-qt5q) a
// Trendek-csempére vitte át, és az őszinte-null szabály VÁLTOZATLAN: pontozatlan napon nem
// kitalált nulla áll ott, hanem a heti protein-sor veszi át a helyét.
test('a Trendek-csempe AI-átlagot ír, amint van pontozott étkezés — kitalált nulla sosem', () => {
  hoisted.overrideSlots = [
    { time: '19:00', kind: 'meal', label: 'Vacsora', slotKey: 'dinner', state: 'now', kcal: 600, p: 35, c: 60, f: 18 },
  ]
  renderView()
  // The mock day's own logged meals ARE scored, so the line is present and honest.
  const tile = screen.getByRole('button', { name: 'Trendek' })
  expect(tile).toHaveTextContent(/AI-átlag \d+/)
  expect(tile).not.toHaveTextContent(/AI-átlag 0\b/)
})

test('pontozatlan napon a Trendek-csempe a heti protein-sort írja, nem AI-átlag nullát', () => {
  // Egy őszintén ÜRES nap (a mock minden napra ugyanazt a seedet adná) — nincs pontozott
  // étkezés, tehát nincs AI-átlag sem.
  const empty = addDays(localDateString(), -2)
  hoisted.emptyDates = [empty]
  renderView(`/fuel?d=${empty}`)
  const tile = screen.getByRole('button', { name: 'Trendek' })
  expect(tile).toHaveTextContent(/Protein \d\/7 nap/)
  expect(tile).not.toHaveTextContent(/AI-átlag/)
})

// ── the quiet settings corner (Fuel Titanium S1d, mezo-33k6 — manifest A16) ───
// Owner-döntés (spec 7): a beállítás CSENDES sarok — nem csempe, nem hangsúlyos, mosott
// sáv. A korábbi `.fh-band` ezt a döntést sértette; a viselkedése (a saját oldalára visz)
// változatlan, a HANGJA lett csendes.

test('the Fuel settings entry navigates to its own page', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: 'Fuel-beállítások' }))
  expect(screen.getByTestId('loc')).toHaveTextContent('/fuel/settings')
})

test('a beállítások csendes sarokként, a lap alján érhetők el', async () => {
  const { container } = renderView()
  const corner = container.querySelector('.fmx-corner') as HTMLElement
  expect(corner).toBeInTheDocument()
  // Se csempe, se mosott sáv — a két hangsúlyos forma, amit az owner kizárt.
  expect(corner.className).not.toContain('mz-tile')
  expect(container.querySelector('.fh-band')).toBeNull()
  // A lap ALJA: a mozaik után, és utána már nincs más modul.
  const mosaic = container.querySelector('.mz-mosaic')!
  expect(mosaic.compareDocumentPosition(corner) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(corner.nextElementSibling).toBeNull()
  await userEvent.click(within(corner).getByRole('button', { name: /beállítások/i }))
  expect(screen.getByTestId('loc')).toHaveTextContent('/fuel/settings')
})

test('the hero carries no settings entry of its own — Fuel-beállítások lives only on the band', () => {
  renderView()
  expect(screen.queryByRole('button', { name: /szerkeszt/i })).toBeNull()
})

// ── diet-phase suggestion banner (slice 4, mezo-ktg8) ────────────────────────
// Mock mode's goalSuggestions fixture always carries one open proposal, so the hub
// should surface the slim deep-link banner above the keret-hero and point at the
// Cél page (the WEIGHT goal lives at /me/goals/weight, not the bare /me/goals hub).

test('the diet-suggestion banner shows in mock mode (one open fixture suggestion) and links to the Cél page', async () => {
  const { container } = renderView()
  const banner = screen.getByText('Diéta-javaslat vár a Cél oldalon').closest('a')
  expect(banner).toBeInTheDocument()
  expect(banner).toHaveAttribute('href', '/me/goals/weight')
  // Renders above the keret-hero.
  const hero = container.querySelector('.fh-hero')
  expect(banner!.compareDocumentPosition(hero!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  await userEvent.click(banner!)
  expect(screen.getByTestId('loc').textContent).toBe('/me/goals/weight')
})
