// ============================================================
// Mezo · Fuel Mai page tests (Design 2.0 F3.1, mezo-d20.4.1; Fuel Titanium S1a–S1d, mezo-33k6;
// Folyadék F5, mezo-n4wf5.5) — the /fuel index: day pager → the hero (the day's bowl, its verdict
// sentence, one primary button) → 1 macros (five vials) → 2 the day's meal BLOCKS → 3 „Ablakon kívül"
// (the generic log + the „yesterday" row) → 4 the day's mark in the learning.
//
// The page's contracts: the blocks honestly mirror the day's windows and log INTO a window (`?w=`),
// a logged meal opens its own page, the generic log sits BELOW the blocks, the water vial opens the
// water sheet, „Miből jön össze?" opens the equation sheet whose door reopens the shared
// EnergyBreakdownSheet, every navigation carries the viewed day, and the gentle-mode faces never grade.
// The per-piece anatomy is covered by FuelEnergyHero / FuelMacroRings / FuelMealBlocks tests.
// ============================================================
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { recoveryKey } from '@/data/train/recoveryHooks'
import { recoveryEmpty } from '@/data/train/recoveryMock'
import { onToast, type ToastMessage } from '@/shared/lib/toastBus'
import type { SkipReason } from '@/features/train/logic/plannedSkips'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, vi } from 'vitest'
import type { FuelSlot } from '@/data/types'
import { FuelMaiPage } from '@/features/fuel/pages/FuelMaiPage'
import { QueryWrapper } from '@/test/queryWrapper'
import { addDays, localDateString } from '@/shared/lib/dates'
import { fmtDate } from '@/shared/lib/format'
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
  /** Kihagyás S3: override the day's consumed kcal (e.g. to overshoot the keret). */
  consumedKcal: null as number | null,
  dayCalls: [] as string[],
  timelineCalls: [] as string[],
  undoCalls: 0,
}))
vi.mock('@/data/train/skipHooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/train/skipHooks')>()
  return {
    ...actual,
    usePlannedSkips: () => {
      const real = actual.usePlannedSkips()
      return { ...real, undo: (id: string, onDone?: () => void) => { hoisted.undoCalls += 1; real.undo(id, onDone) } }
    },
  }
})
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
      if (hoisted.consumedKcal != null) {
        return { ...real, fuel: { ...real.fuel, consumed: { ...real.fuel.consumed, kcal: hoisted.consumedKcal } } }
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
          time: '20:00', kind: 'snack', label: 'Esti uzsonna', slotKey: 'snack',
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
  hoisted.consumedKcal = null
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

test('a Mai anatómiája: lapozó → hős → makrók → blokkok → ablakon kívül, számozott szakaszokkal, a régi bőr nélkül', () => {
  const { container } = renderView()
  const page = container.querySelector('.fo-page.fa-page')!
  expect(page).toBeInTheDocument()
  expect(screen.queryByLabelText('Fuel alnavigáció')).toBeNull()
  const hero = container.querySelector('.fo-hero.fa-hero')!
  const blocks = container.querySelector('.fa-blocks')!
  expect(hero).toBeInTheDocument()
  expect(blocks).toBeInTheDocument()
  expect(container.querySelector('.fa-dn')!.compareDocumentPosition(hero) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(hero.compareDocumentPosition(blocks) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  // the numbered sections, in order
  expect(screen.getAllByRole('heading', { level: 2 }).map(h => h.textContent!.replace(/ · .*/, '')))
    .toEqual(['1Mai makrók', '2A mai blokkjaid', '3Ablakon kívül', '4A nap a tanulásban'])
  // the old skin left the markup: no glass, no Titanium / Üveg class, no ring, no tile strip
  expect(container.querySelector('.glass, .fh-hub, [class*="fmx-"], [class*="uv-"], .mz-mosaic, .fh-logtile, .fh-mezotile, .sky-islands, .kdone')).toBeNull()
  expect(hero.querySelector('circle')).toBeNull()
})

// ── the hero: the day's bowl (Folyadék F5; Fuel Titanium S1a manifest A1/A2/A15) ──────
test('a Mai a nap táljával nyit, alatta az öt makró-kémcsővel', () => {
  const { container } = renderView()
  expect(container.querySelector('.fa-hero .fx-bg .fx-bowl-svg')).not.toBeNull()
  expect(container.querySelector('.khero-n')).toBeNull()
  expect(container.querySelectorAll('.fa-mac .fo-vial')).toHaveLength(5)
})

test('a hős a MARADÉKOT mondja ki egy mondatban, és nem mond „eddig x / y"-t', () => {
  const { container } = renderView()
  const hero = container.querySelector('.fa-hero') as HTMLElement
  expect(hero.querySelector('.fo-hero-verdict')!.textContent)
    .toMatch(/^(Még [\d\s]+kcal fér bele, ([\d\s]+g fehérje hiányzik|a fehérje megvan)\.|Ma [\d\s]+ kcal-lal a keret felett vagy\.)$/)
  expect(hero.querySelector('.fx-bg-n.r small')!.textContent).toMatch(/^(még belefér|a keret felett)$/)
  expect(hero.textContent).not.toContain('eddig x')
  expect(hero.textContent).not.toMatch(/\d+\/\d+ ablak/)
  // ONE primary button on the liquid, and it logs
  expect(within(hero).getAllByRole('button').filter(b => b.classList.contains('fo-btn'))).toHaveLength(1)
})

test('a hős fő gombja a logolóba visz, ablak-kulcs nélkül', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: 'Étkezés logolása' }))
  expect(screen.getByTestId('loc').textContent).toBe('/fuel/log/uj')
})

test('a tál a nap elfogyasztott részéig telik', () => {
  const { container } = renderView()
  // The mock demo day's real consumed kcal (breakfast 580 + lunch 720 + a coherent late-miss
  // dinner 760 = 2060) against the day's own budget.
  const bowl = container.querySelector('.fa-hero .fx-bg-bowl') as HTMLElement
  expect(bowl.getAttribute('aria-label')).toMatch(/^2 060 \/ [\d\s]+ kcal$/)
  expect(bowl.querySelector('.fx-bowl-liq')).not.toBeNull()
  expect(container.querySelector('.fa-hero .fx-bg-n b')).toHaveTextContent('2 060')
})

// mezo-jb84: a chip a JÓVÁHAGYOTT üvegdobozt nyitja — élesben a régi, közös lap jött fel
// helyette. A15 viszont nem veszik el: a doboz csendes ajtaja továbbra is a MEGLÉVŐ, Énnel
// közös energia-magyarázathoz visz, tehát a részletes eredet egy koppintásra marad.
test('a „Miből jön össze?" az egyenlet-lapot nyitja', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: /^Miből jön össze\?/ }))
  const box = await screen.findByRole('dialog')
  expect(box.className).toContain('fo-sheet')
  expect(box.className).toContain('fa-eq')
  for (const label of ['Alap', 'Mozgás', 'Étel', 'Marad']) {
    expect(within(box).getByText(label)).toBeInTheDocument()
  }
  // the shared, detailed sheet is NOT this one — it is behind the sheet's door
  expect(screen.queryByText(/Alapanyagcsere/i)).toBeNull()
})

test('az egyenlet-lap ajtaja a részletes, Énnel közös magyarázatot nyitja', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: /^Miből jön össze\?/ }))
  await userEvent.click(await screen.findByRole('button', { name: /Részletesen, honnan jön a keret/ }))
  // one sheet at a time, and it is no longer the equation
  const sheets = await screen.findAllByRole('dialog')
  expect(sheets).toHaveLength(1)
  expect(sheets[0].className).not.toContain('fa-eq')
})

test('the macro vials name their macros; the water vial opens WaterLogSheet and the log lands', async () => {
  const { container } = renderView()
  const names = Array.from(container.querySelectorAll('.fa-mac .fo-vial > small')).map(e => e.textContent!)
  expect(names.map(n => n.replace(/\/.*$/, ''))).toEqual(['Fehérje', 'SzénhidrátSzénh.', 'Zsír', 'Víz', 'Rost'])
  expect(screen.getByText('A Víz koppintható: onnan logolsz.')).toBeInTheDocument()

  const water = () => screen.getByRole('button', { name: /^Víz logolása/ })
  const before = water().getAttribute('aria-label')
  await userEvent.click(water())
  const sheet = await screen.findByRole('dialog')
  await userEvent.click(within(sheet).getByRole('button', { name: '250 ml' }))
  await userEvent.click(within(sheet).getByRole('button', { name: /Mentés/ }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(water().getAttribute('aria-label')).not.toBe(before)
})

// „Visszavonom az utolsót" (approved 2026-10-12): the water sheet gets THIS page's undo, so the link takes
// back what was just logged from here.
test('a vízlap a lap saját visszavonását kapja: a mentés után visszavonható az utolsó', async () => {
  renderView()
  const water = () => screen.getByRole('button', { name: /^Víz logolása/ })
  const before = water().getAttribute('aria-label')
  await userEvent.click(water())
  let sheet = await screen.findByRole('dialog')
  expect(within(sheet).queryByRole('button', { name: 'Visszavonom az utolsót' })).toBeNull()
  await userEvent.click(within(sheet).getByRole('button', { name: '250 ml' }))
  await userEvent.click(within(sheet).getByRole('button', { name: /Mentés/ }))
  await waitFor(() => expect(water().getAttribute('aria-label')).not.toBe(before))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  await userEvent.click(water())
  sheet = await screen.findByRole('dialog')
  await userEvent.click(await within(sheet).findByRole('button', { name: 'Visszavonom az utolsót' }))
  await waitFor(() => expect(water().getAttribute('aria-label')).toBe(before))
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
  expect(container.querySelectorAll('.fa-blk').length).toBeGreaterThan(0)
  await userEvent.click(screen.getByRole('button', { name: /Uzsonna.*logolás ide/ }))
  expect(screen.getByTestId('loc')).toHaveTextContent('/fuel/log/uj')
  expect(screen.getByTestId('loc').textContent).toContain('w=')
  // A kulcsot az app saját `${time}-${label}` szabálya adja, nem egy kitalált string.
  expect(screen.getByTestId('loc').textContent)
    .toContain(`w=${encodeURIComponent(tileKey(OPEN_UZSONNA))}`)
})

test('a logolt étkezés pont-chipje az értékelő oldalra visz', async () => {
  hoisted.overrideSlots = [DONE_REGGELI, OPEN_UZSONNA]
  renderView()
  await userEvent.click(screen.getAllByRole('button', { name: /Mezo értékelése/ })[0])
  expect(screen.getByTestId('loc')).toHaveTextContent('/fuel/etkezes/')
})

// Az általános naplózó a lap ALJÁN marad (owner).
test('az általános naplózás a blokkok alatt áll', () => {
  const { container } = renderView()
  const blocks = container.querySelector('.fa-blocks')!
  const generic = container.querySelector('.fa-loggeneric')!
  expect(blocks.compareDocumentPosition(generic) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(generic).toHaveTextContent('Logolj bármitablakon kívül is')
  expect(generic.querySelector('use')!.getAttribute('href')).toBe('#t-bowl')
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
  expect(Array.from(container.querySelectorAll('.fa-blk .fa-bhd strong')).map(e => e.textContent))
    .toEqual(['Reggeli', 'Ebéd', 'Vacsora'])
  expect(container.querySelectorAll('.fa-blk.is-done')).toHaveLength(1)
  expect(container.querySelectorAll('.fa-blk.is-now')).toHaveLength(1)
  expect(container.querySelectorAll('.fa-blk.is-future')).toHaveLength(1)
})

test('a kihagyott ablak a blokkján is szégyenmentes — „még pótolható", nem hiba', () => {
  hoisted.injectMissedSlot = true
  const { container } = renderView()
  const missed = container.querySelector('.fa-blk.is-missed')!
  expect(missed.textContent).toContain('még pótolható')
  expect(container.textContent).not.toMatch(/bukt|elrontot|kudarc/i)
})

test('an empty day names the gap on the blocks instead of fabricating windows', () => {
  hoisted.overrideSlots = []
  const { container } = renderView()
  expect(container.querySelectorAll('.fa-blk')).toHaveLength(0)
  expect(within(container.querySelector('.fa-blocks') as HTMLElement)
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
  // the long day of the approved prototype: „október 11. · 2 ablak pótolható"
  const dateLabel = fmtDate(yesterday, 'long')
  const { container } = renderView()
  const chip = screen.getByRole('button', { name: /pótolható/ })
  expect(chip.textContent).toContain(dateLabel)
  expect(chip.textContent).toContain('2 ablak pótolható')
  expect(chip.textContent).toContain('tegnap')
  expect(chip.querySelector('use')!.getAttribute('href')).toBe('#t-history')
  // the row stands in the „Ablakon kívül" card under the generic log, never inside the blocks
  expect(container.querySelector('.fa-blocks')!.contains(chip)).toBe(false)
  expect(container.querySelector('.fa-outside')!.contains(chip)).toBe(true)
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
  // the pager's two lines: „3 nappal ezelőtt" over the full date
  expect(await screen.findByText(fmtDate(D3, 'longWeekday'))).toBeInTheDocument()
  expect(screen.getByText('3 nappal ezelőtt')).toBeInTheDocument()
  // a past day speaks in its own words
  expect(screen.getByRole('heading', { name: /Ezen a napon · \d+ étkezés/ })).toBeInTheDocument()
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
  expect(screen.getByText('Ma')).toBeInTheDocument()
  expect(screen.getByText(fmtDate(TODAY, 'longWeekday'))).toBeInTheDocument()
  expect(hoisted.dayCalls).toContain(TODAY)
  expect(hoisted.dayCalls).not.toContain(addDays(TODAY, -9))
})

test('múltbeli napon a blokk a pótlásba visz, a nap megtartásával', async () => {
  hoisted.overrideSlots = [DONE_REGGELI, OPEN_UZSONNA]
  renderView(`/fuel?d=${D3}`)
  await userEvent.click(screen.getAllByRole('button', { name: /Uzsonna.*logolás ide/ })[0])
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
test('adat nélküli múltbeli nap őszintén üres: az üres tál egy mondattal, és a pótlás gombja', async () => {
  hoisted.emptyDates = [D3]
  hoisted.overrideSlots = [
    { time: '08:00', kind: 'meal', label: 'Reggeli', slotKey: 'breakfast', state: 'pending', kcal: 500, p: 30, c: 50, f: 15 },
    OPEN_UZSONNA,
  ]
  const { container } = renderView(`/fuel?d=${D3}`)
  const hero = container.querySelector('.fa-hero.fa-nodata') as HTMLElement
  expect(within(hero).getByText('Erre a napra nincs adat.')).toBeInTheDocument()
  expect(within(hero).getByText('Amit most logolsz, erre a napra könyvelődik.')).toBeInTheDocument()
  // the empty bowl alone — no numbers, no macros section
  expect(hero.querySelector('.fx-bg.plain')).not.toBeNull()
  expect(hero.querySelector('.fx-bg-n')).toBeNull()
  expect(container.querySelector('.fa-mac')).toBeNull()
  expect(screen.getAllByRole('heading', { level: 2 }).map(h => h.textContent![0])).toEqual(['1', '2'])
  // shame-free: emptiness is no error
  expect(container.textContent).not.toMatch(/kihagytad|bukt|hiba/i)
  // the one button backfills the day's first window, on the viewed day
  await userEvent.click(within(hero).getByRole('button', { name: 'Reggeli pótlása' }))
  const loc = screen.getByTestId('loc').textContent!
  expect(loc).toContain('/fuel/log/uj')
  expect(loc).toContain(`d=${D3}`)
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

// mezo-jb84 (owner): a víz-KÁRTYA lekerült a lapról. A képesség nem: a hero víz-gyűrűje maga
// a gomb, és a gyorsgombos lapot nyitja — ezek a körök ezt kötik ki, nem a kártyát.
test('a víz-kártya nincs a lapon, a víz kémcsöve viszont nyitja a vízlogolást', async () => {
  const { container } = renderView()
  expect(container.querySelector('.fmx-water')).toBeNull()
  await userEvent.click(screen.getByRole('button', { name: /^Víz logolása/ }))
  expect(await screen.findByRole('dialog')).toBeInTheDocument()
})

test('a kémcsőből logolt víz a napot írja, és a kémcső követi', async () => {
  renderView()
  const label = () => screen.getByRole('button', { name: /^Víz logolása/ }).getAttribute('aria-label')
  const before = label()
  await userEvent.click(screen.getByRole('button', { name: /^Víz logolása/ }))
  await userEvent.click(await screen.findByRole('button', { name: '250 ml' }))
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  await waitFor(() => expect(label()).not.toBe(before))
})

// ── a csempe-sáv LEKERÜLT (owner, mezo-jb84) ─────────────────────────────────
// A Trendek / Kiegészítők / Konyha a fül-sávból egy koppintás, a Receptek és a Kamra a Konyha
// ajtói mögül, a Gyógyszer a Kiegészítők felől. A csempék ezeket ismételték meg harmadszor.
// Ez a kör az ELTŰNÉST köti ki, hogy egy későbbi kör ne építse vissza őket véletlenül.
test('a Mai nem hoz csempe-sávot', () => {
  const { container } = renderView()
  expect(container.querySelector('.mz-mosaic')).toBeNull()
  for (const label of ['Trendek', 'Stack', 'Receptek', 'Kamra', 'Gyógyszer']) {
    expect(screen.queryByRole('button', { name: label })).toBeNull()
  }
})

// ── a beállítás-bejárat (A16) ────────────────────────────────────────────────
// Owner-döntés (spec 7) szerint CSENDES — de a lap alján gyakorlatilag megtalálhatatlan volt
// (2107 px-es lapon az 1929-esnél). mezo-jb84: a dátumsor jobb szélére költözött, ikonként.
// Csendes maradt, csak már látszik is.

test('Fuel uses the global header settings entry without a local cog', () => {
  const { container } = renderView()
  expect(screen.queryByRole('button', { name: 'Fuel-beállítások' })).toBeNull()
  expect(container.querySelector('.fa-dn')).toBeInTheDocument()
  expect(container.querySelectorAll('.fa-dn button')).toHaveLength(3)
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
  // the amber strip, above the day pager and the hero
  expect(banner!.className).toContain('fx-kms warn')
  expect(banner!.querySelector('use')!.getAttribute('href')).toBe('#t-ring')
  const hero = container.querySelector('.fa-hero')
  expect(banner!.compareDocumentPosition(hero!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  await userEvent.click(banner!)
  expect(screen.getByTestId('loc').textContent).toBe('/me/goals/weight')
})

// mezo-jb84: a pont-chipnek SAJÁT célja van. Élesben mindkettő a részletekre vitt, így az AI
// pontszámra koppintva nem az értékelés nyílt meg — pedig épp azért mozog, hogy oda hívjon.
test('a blokk pont-chipje Mezo értékelésére visz, nem a részletekre', async () => {
  renderView()
  const chip = screen.getAllByRole('button', { name: /Mezo értékelése/ })[0]
  await userEvent.click(chip)
  expect(screen.getByTestId('loc').textContent).toMatch(/^\/fuel\/etkezes\/[^/]+\/ertekeles$/)
})

test('az étkezés sora továbbra is a részletekre visz', async () => {
  renderView()
  await userEvent.click(screen.getAllByRole('button', { name: /Túrós zabkása/ })[0])
  expect(screen.getByTestId('loc').textContent).toMatch(/^\/fuel\/etkezes\/[^/]+$/)
})

// ── Kihagyás S3 (mezo-q4xt2.3): skip a meal, give a reason, undo ───────────────────────────────
test('Kihagyom → reason sheet → Nem vagyok éhes → Kész: the block is the skipped card and the header counts it; Visszavonom restores', async () => {
  const user = userEvent.setup()
  const { container } = renderView()
  expect(screen.getByRole('heading', { name: /A mai blokkjaid · \d+ étkezés$/ })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /Uzsonna kihagyása/ }))
  // The skip is saved at once and the reason sheet opens for it.
  const sheetTitle = await screen.findByRole('heading', { name: 'Miért marad ki?' })
  expect(sheetTitle).toBeInTheDocument()
  expect(screen.getByText(/^Kihagyva · Uzsonna · /)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Nem vagyok éhes' }))
  await user.click(screen.getByRole('button', { name: 'Kész' }))
  await waitFor(() => expect(screen.queryByRole('heading', { name: 'Miért marad ki?' })).toBeNull())
  const block = container.querySelector('.fa-blk.is-skipped')!
  expect(block).toHaveTextContent('Kihagyva · Nem vagyok éhes')
  expect(block).toHaveTextContent('kiesett a napból. A többi étkezésed nem lett nagyobb.')
  expect(screen.getByRole('heading', { name: /A mai blokkjaid · \d+ étkezés · 1 kihagyva$/ })).toBeInTheDocument()
  // the hero shows the skipped share: the dashed band in the bowl and the line under it
  expect(container.querySelector('.fa-hero .fx-bowl-skip')).not.toBeNull()
  expect(container.querySelector('.fa-skl')).toHaveTextContent(/^Uzsonna kihagyva · [\d\s]+ kcal kiesett a napból$/)
  expect(container.textContent).not.toMatch(/elrontott|túlléptél|hiba|rossz|bukta|kudarc/i)

  await user.click(within(block as HTMLElement).getByRole('button', { name: 'Visszavonom' }))
  await waitFor(() => expect(container.querySelector('.fa-blk.is-skipped')).toBeNull())
  expect(screen.getByRole('button', { name: /Uzsonna.*logolás ide/ })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: /kihagyva$/ })).toBeNull()
  expect(container.querySelector('.fa-skl')).toBeNull()
})

test('„Mégis ettem" undoes the skip and goes to log into the window', async () => {
  const user = userEvent.setup()
  const { container } = renderView()
  await user.click(screen.getByRole('button', { name: /Uzsonna kihagyása/ }))
  await user.click(await screen.findByRole('button', { name: 'Most nem mondom' }))
  await waitFor(() => expect(screen.queryByRole('heading', { name: 'Miért marad ki?' })).toBeNull())
  const block = container.querySelector('.fa-blk.is-skipped')!
  expect(block).toHaveTextContent('Kihagyva · ok nélkül')
  await user.click(within(block as HTMLElement).getByRole('button', { name: 'Mégis ettem' }))
  await waitFor(() => expect(screen.getByTestId('loc')).toHaveTextContent('/fuel/log/uj'))
  expect(screen.getByTestId('loc').textContent).toContain('w=')
})

test('„Mégis ettem": a double tap withdraws the skip only once', async () => {
  const user = userEvent.setup()
  hoisted.undoCalls = 0
  const { container } = renderView()
  await user.click(screen.getByRole('button', { name: /Uzsonna kihagyása/ }))
  await user.click(await screen.findByRole('button', { name: 'Most nem mondom' }))
  await waitFor(() => expect(screen.queryByRole('heading', { name: 'Miért marad ki?' })).toBeNull())
  const btn = within(container.querySelector('.fa-blk.is-skipped') as HTMLElement).getByRole('button', { name: 'Mégis ettem' })
  fireEvent.click(btn)
  fireEvent.click(btn)
  await waitFor(() => expect(screen.getByTestId('loc')).toHaveTextContent('/fuel/log/uj'))
  expect(hoisted.undoCalls).toBe(1)
})

test.each([['INJURY'], ['TRAVEL']] as const)('past %s day with nothing logged stays honestly empty', (category) => {
  hoisted.emptyDates = [D3]
  const { container } = renderRecovery(category, `/fuel?d=${D3}`, -5)
  expect(screen.getByText(/Erre a napra nincs adat/i)).toBeInTheDocument()
  expect(container.querySelector('.fa-hero .fx-bg.plain')).not.toBeNull()
  expect(container.querySelector('.fa-mac')).toBeNull()
  expect(container.querySelector('.fx-kms')).not.toBeNull()
})

// ── Kihagyás S3 (mezo-q4xt2.3): a négy kímélő arc ───────────────────────────────────────────────
const SHAME_RX = /elrontott|túlléptél|hiba|rossz|bukta|kudarc/i

/** Mock mód: a kímélő időszak a recovery-cache-ben él, a Fuel-nap ebből származtatja a módot. */
function renderRecovery(category: SkipReason, path = '/fuel', startOffset = -1) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const today = localDateString()
  client.setQueryData(recoveryKey(), {
    ...recoveryEmpty,
    period: { id: 'p1', category, estimate: 'WEEK', startDate: addDays(today, startOffset), dayIndex: 2,
      estimateExpired: false, checkedInToday: false, releasedDates: [], releasedUnlightened: [] },
  })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}><FuelMaiPage /><LocationProbe /></MemoryRouter>
    </QueryClientProvider>,
  )
}

test.each([['ILLNESS', 'Beteg vagy'], ['STOMACH', 'Gyomorrontás']] as const)(
  'GUIDANCE (%s): the guidance face replaces the bowl, the equation link and the macros; no Kihagyom, no pótolható',
  async (category, who) => {
    const { container } = renderRecovery(category)
    expect(await screen.findByText('Ma nincs kalóriacél.')).toBeInTheDocument()
    expect(screen.getByText(`Kímélő mód · ${who} · 2. nap`)).toBeInTheDocument()
    expect(container.querySelector('.fo-hero.fa-gh.warn')).not.toBeNull()
    expect(container.querySelector('.fa-hero')).toBeNull()
    expect(container.querySelector('.fa-mac')).toBeNull()
    expect(container.querySelector('.fa-eql')).toBeNull()
    expect(container.textContent).not.toMatch(/még belefér|a keret|Miből jön össze|Kihagyom|pótolható/i)
    expect(container.textContent).not.toMatch(/\d+\s*\/\s*\d+\s*kcal/)
    expect(container.querySelector('.fx-cup .fo-fill')).toBeNull()
    expect(container.textContent).not.toMatch(SHAME_RX)
    // section 1 is „Most ez segít", the blocks follow as 2: meals can still be logged, plain
    expect(screen.getAllByRole('heading', { level: 2 }).map(h => h.textContent!.replace(/ · .*/, '')).slice(0, 2))
      .toEqual(['1Most ez segít', '2A mai blokkjaid'])
    expect(container.querySelector('.fa-blocks')).not.toBeNull()
    expect(container.querySelector('.fa-blk.is-logged .fx-cup')).toHaveTextContent(/kcal$/)
  },
)

test('GUIDANCE: the water glass opens the water sheet; the strip is not shown', async () => {
  const { container } = renderRecovery('ILLNESS')
  await userEvent.click(await screen.findByRole('button', { name: 'Víz logolása' }))
  expect(await screen.findByRole('dialog')).toBeInTheDocument()
  expect(container.querySelector('.fx-kms:not(.fa-diet)')).toBeNull()
})

test('MAINTENANCE: the strip, the hero on the served budget, the injury note and the protein vial as the focus', async () => {
  const { container } = renderRecovery('INJURY')
  const strip = await screen.findByRole('button', { name: /Kímélő mód, Sérülés, 2\. nap/ })
  expect(strip).toHaveTextContent('Kímélő mód · Sérülés · 2. nap')
  expect(container.querySelector('.fa-hero')).not.toBeNull()
  expect(container.querySelector('.fa-hero .fx-bg-n.r small')).toHaveTextContent('még belefér')
  // the mock goal is no cut, so nothing was dropped: the neutral note, no deficit claim
  expect(screen.getByText('Sérülés alatt a fehérje a legfontosabb')).toBeInTheDocument()
  expect(container.textContent).not.toMatch(/hiányt kikapcsoltam/)
  expect(container.querySelector('.fa-kmn .fx-tip small')!.textContent).toMatch(/ Ez nem orvosi tanács\.$/)
  // the note is a card of its own between the hero and the macros
  expect(container.querySelector('.fa-hero')!.compareDocumentPosition(container.querySelector('.fa-kmn')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(container.querySelector('.fa-kmn')!.compareDocumentPosition(container.querySelector('.fa-mac')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(container.querySelector('.fa-mac.lead')).not.toBeNull()
  const marks = container.querySelectorAll('.fa-mac .fo-tube em')
  expect(marks).toHaveLength(1)
  expect(marks[0]).toHaveTextContent('fő cél')
  expect(container.textContent).not.toMatch(SHAME_RX)
  // the strip explains where the mode is closed (a toast, no navigation)
  const seen: ToastMessage[] = []
  const off = onToast(t => seen.push(t))
  await userEvent.click(strip)
  off()
  expect(seen.map(t => ('text' in t ? t.text : ''))).toEqual(['A kímélő módot a Nap oldalon zárod le: Hogy vagy? → Jobban'])
  expect(screen.getByTestId('loc')).toHaveTextContent(/^\/fuel$/)
})

test('MAINTENANCE without a cut goal: the equation box does not claim a paused goal', async () => {
  renderRecovery('INJURY')
  await userEvent.click(await screen.findByRole('button', { name: /^Miből jön össze\?/ }))
  expect(await screen.findByRole('dialog')).toBeInTheDocument()
  expect(screen.queryByText('szünetel, amíg a sérülés tart')).not.toBeInTheDocument()
})

test('ESTIMATE: the „Úton vagy" strip, the muted hero, „kb. ennyi fér még"; over the budget it says „a keret körül", never „felett"', async () => {
  const { container, unmount } = renderRecovery('TRAVEL')
  const strip = await screen.findByRole('button', { name: /Kímélő mód, Úton vagy, 2\. nap/ })
  expect(strip).toHaveTextContent('Kímélő mód · Úton vagy · 2. nap')
  expect(container.querySelector('.fa-hero')).toHaveClass('est')
  expect(container.querySelector('.fa-hero .fx-bg-n.r small')).toHaveTextContent('kb. ennyi fér még')
  expect(container.querySelector('.fa-hero .fo-hero-verdict')!.textContent).toMatch(/^Kb\. [\d\s]+ kcal fér még bele ma\.$/)
  expect(screen.getByText('Úton vagy, becsülj nyugodtan')).toBeInTheDocument()
  expect(container.querySelector('.fa-mac.lead')).toBeNull()
  unmount()
  hoisted.consumedKcal = 9000
  const over = renderRecovery('TRAVEL')
  await screen.findByRole('button', { name: /Kímélő mód, Úton vagy/ })
  expect(over.container.querySelector('.fa-hero .fx-bg-n.r small')).toHaveTextContent('a keret körül')
  expect(over.container.querySelector('.fa-hero .fo-hero-verdict')).toHaveTextContent('Ma nagyjából a keret körül jársz.')
  expect(over.container.textContent).not.toMatch(/a keret felett/i)
  expect(over.container.textContent).not.toMatch(SHAME_RX)
})

test('no recovery period: the normal hero, no strip, no note', async () => {
  const { container } = renderView()
  expect(container.querySelector('.fa-hero')).not.toBeNull()
  expect(container.querySelector('.fx-kms:not(.fa-diet)')).toBeNull()
  expect(container.querySelector('.fa-kmn')).toBeNull()
  expect(screen.queryByText('Ma nincs kalóriacél.')).toBeNull()
})

test('in every recovery mode an unlogged closed window shows no „még pótolható" chip', async () => {
  for (const category of ['INJURY', 'TRAVEL', 'ILLNESS'] as const) {
    const { container, unmount } = renderRecovery(category)
    await screen.findByRole('button', { name: /Víz logolása/ })
    expect(container.querySelector('.fa-blocks')!.textContent).not.toMatch(/pótolható/)
    unmount()
  }
})

test('the „tegnap pótolható" chip is hidden when YESTERDAY has a fuel mode (a kímélő nap is nothing to make up)', async () => {
  hoisted.overrideSlots = [
    { time: '08:00', kind: 'meal', label: 'Reggeli', slotKey: 'breakfast', state: 'done', kcal: 500, p: 30, c: 50, f: 15 },
    { time: '13:00', kind: 'meal', label: 'Ebéd', slotKey: 'lunch', state: 'now', kcal: 700, p: 40, c: 70, f: 20 },
  ]
  // control: no period → the chip is there
  const control = renderView()
  expect(control.container.querySelector('.fa-bait')).not.toBeNull()
  control.unmount()
  // INJURY since the day before yesterday → yesterday is a MAINTENANCE day
  const { container } = renderRecovery('INJURY')
  await screen.findByRole('button', { name: /Kímélő mód, Sérülés/ })
  expect(container.querySelector('.fa-bait')).toBeNull()
})
