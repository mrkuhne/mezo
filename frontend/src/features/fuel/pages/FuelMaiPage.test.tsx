// ============================================================
// Mezo · Fuel hub tests (Design 2.0 F3.1, mezo-d20.4.1) — the /fuel index's Mozaik
// face: keret-hero (ONE number) → Logolás hero tile (mezo-byo1) → Mezo counter banner → 6-tile
// mosaic → Fuel-beállítások band.
//
// Since mezo-byo1 the per-window logging surface lives on /fuel/log (FuelLogPage) —
// the hub's contracts here are: the keret-hero stays ONE number, the Logolás hero
// tile honestly mirrors the day's window states and opens /fuel/log, the víz ring
// opens the water sheet, the energy chips reopen their own EnergyBreakdownSheet
// section, and the Fuel-beállítások band still opens FuelSettingsSheet.
// ============================================================
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, vi } from 'vitest'
import type { FuelSlot } from '@/data/types'
import { FuelMaiPage } from '@/features/fuel/pages/FuelMaiPage'
import { QueryWrapper } from '@/test/queryWrapper'
import { addDays, localDateString, huMonthDay } from '@/shared/lib/dates'

// The mock demo day (fixed now 13:30) is a PARTIAL day (mezo-1oy5): breakfast + lunch
// logged, the midday/evening windows open. To page-test the missed→Pótold CTA, the
// all-done seed and the empty day deterministically, known slots can be injected into
// the composed timeline (ADDED to the real seed, or a full REPLACEMENT); both off by
// default, so every other test sees the unmodified real timeline.
const hoisted = vi.hoisted(() => ({
  injectOpenSlot: false,
  injectMissedSlot: false,
  overrideSlots: null as FuelSlot[] | null,
}))
vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return {
    ...actual,
    useFuelTimeline: (date?: string) => {
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
  const lane = container.querySelector('.fh-logtile')
  const mosaic = container.querySelector('.mz-mosaic')
  expect(hero).toBeInTheDocument()
  expect(lane).toBeInTheDocument()
  expect(mosaic).toBeInTheDocument()
  // The Mezo Fuel-üzenetek band is retired (mezo-04lo) — unused, tile removed with its page.
  expect(container.querySelector('.fh-mezotile')).toBeNull()
  expect(hero!.compareDocumentPosition(lane!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(lane!.compareDocumentPosition(mosaic!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  // The retired sky/island shell is gone.
  expect(container.querySelector('.sky-islands')).toBeNull()
  expect(container.querySelector('.kdone')).toBeNull()
})

// ── keret-hero (hub v3: ONE number) ──────────────────────────────────────────

test('the hero is ONE number — the kcal CONSUMED today; no eyebrow, no "eddig x / y" of-line', () => {
  const { container } = renderView()
  // The mock demo day's real consumed kcal (breakfast 580 + lunch 720 + a coherent late-miss
  // dinner 760, fix-round-1 F1 mezo-jcpt.3, = 2060).
  expect(container.querySelector('.khero-n')?.getAttribute('aria-label')).toBe('2 060 kcal ma')
  expect(container.querySelector('.khero-of')).toBeNull()
  const hero = container.querySelector('.fh-hero') as HTMLElement
  expect(hero.textContent).not.toContain('eddig')
  expect(hero.textContent).not.toMatch(/\d+\/\d+ ablak/)
})

test('the day-bar draws one segment per done window and carries the gold now-marker', () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-07-02T13:30:00'))
  try {
    const { container } = renderView()
    // breakfast + lunch + the fix-round-1 F1 (mezo-jcpt.3) late-miss dinner — a logged meal fills
    // its window purely off its presence (buildDayPlan.ts step 3), never off the clock, so the
    // 23:35 dinner is `done` even though this test's frozen `now` is 13:30.
    expect(container.querySelectorAll('.khero-seg')).toHaveLength(3)
    expect(container.querySelector('.khero-mark')).toBeInTheDocument()
  } finally {
    vi.useRealTimers()
  }
})

test('the three energy chips each reopen EnergyBreakdownSheet at their own section', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: /^Alap/ }))
  expect(await screen.findByText(/Honnan jön a/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Bezárás' }))
  await waitFor(() => expect(screen.queryByText(/Honnan jön a/)).toBeNull())

  await userEvent.click(screen.getByRole('button', { name: /^Mozgás/ }))
  expect(await screen.findByText(/Honnan jön a/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Bezárás' }))
  await waitFor(() => expect(screen.queryByText(/Honnan jön a/)).toBeNull())

  await userEvent.click(screen.getByRole('button', { name: /^Cél/ }))
  expect(await screen.findByText(/Honnan jön a/)).toBeInTheDocument()
})

test('the macro rings read via aria-labels; the víz ring opens WaterLogSheet and the log lands', async () => {
  const { container } = renderView()
  expect(container.querySelector('[aria-label^="Fehérje "]')).toBeInTheDocument()
  expect(container.querySelector('[aria-label^="Szénhidrát "]')).toBeInTheDocument()
  expect(container.querySelector('[aria-label^="Zsír "]')).toBeInTheDocument()
  expect(screen.getByText('Víz')).toBeInTheDocument()

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
// score chips) moved to /fuel/log and are covered by FuelLogPage.test.tsx; the hub
// carries ONE live door whose face follows the same WindowLaneVM.

test('a MOST window leads the hero tile: label · time, the plan meal, and the pulsing eyebrow', () => {
  hoisted.overrideSlots = [
    { time: '08:00', kind: 'meal', label: 'Reggeli', slotKey: 'breakfast', state: 'done', kcal: 500, p: 30, c: 50, f: 15 },
    { time: '13:00', kind: 'meal', label: 'Ebéd', slotKey: 'lunch', state: 'now', kcal: 700, p: 40, c: 70, f: 20, mealName: 'Csirkés bowl', suggestedRecipeId: 'r-1' },
    { time: '19:00', kind: 'meal', label: 'Vacsora', slotKey: 'dinner', state: 'pending', kcal: 600, p: 35, c: 60, f: 18 },
  ]
  const { container } = renderView()
  const tile = container.querySelector('.fh-logtile') as HTMLElement
  expect(within(tile).getByText('Logolás · MOST')).toBeInTheDocument()
  expect(within(tile).getByText('Ebéd · 13:00')).toBeInTheDocument()
  expect(within(tile).getByText('a tervből: Csirkés bowl')).toBeInTheDocument()
  // One dot per window, state-classed.
  expect(tile.querySelectorAll('.fh-lt-dots i')).toHaveLength(3)
  expect(tile.querySelectorAll('.fh-lt-dots i.is-f')).toHaveLength(1)
  expect(tile.querySelectorAll('.fh-lt-dots i.is-nw')).toHaveLength(1)
  expect(within(tile).getByText('1/3 ablak kész')).toBeInTheDocument()
})

test('the hero tile opens /fuel/log', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: 'Logolás' }))
  expect(screen.getByTestId('loc').textContent).toBe('/fuel/log')
})

test('a missed window surfaces as an honest pótolható count — never a punitive word', () => {
  hoisted.injectMissedSlot = true
  const { container } = renderView()
  const tile = container.querySelector('.fh-logtile') as HTMLElement
  expect(tile.textContent).toContain('1 pótolható')
  expect(tile.querySelectorAll('.fh-lt-dots i.is-ms')).toHaveLength(1)
  expect(container.textContent).not.toMatch(/bukt|elrontot|kudarc/i)
})

test('an all-done day flips the tile to the quiet sage celebration', () => {
  hoisted.overrideSlots = [
    { time: '08:00', kind: 'meal', label: 'Reggeli', slotKey: 'breakfast', state: 'done', kcal: 500, p: 30, c: 50, f: 15 },
    { time: '13:00', kind: 'meal', label: 'Ebéd', slotKey: 'lunch', state: 'done', kcal: 700, p: 40, c: 70, f: 20 },
  ]
  const { container } = renderView()
  const tile = container.querySelector('.fh-logtile') as HTMLElement
  expect(tile.classList.contains('is-alldone')).toBe(true)
  expect(within(tile).getByText('Minden ablak kész ✓')).toBeInTheDocument()
  expect(within(tile).getByText('2/2 ablak kész')).toBeInTheDocument()
})

test('with no MOST window the tile points at the next upcoming one', () => {
  hoisted.overrideSlots = [
    { time: '08:00', kind: 'meal', label: 'Reggeli', slotKey: 'breakfast', state: 'done', kcal: 500, p: 30, c: 50, f: 15 },
    { time: '19:00', kind: 'meal', label: 'Vacsora', slotKey: 'dinner', state: 'pending', kcal: 600, p: 35, c: 60, f: 18 },
  ]
  const { container } = renderView()
  const tile = container.querySelector('.fh-logtile') as HTMLElement
  expect(within(tile).getByText('köv. Vacsora · 19:00')).toBeInTheDocument()
})

test('an empty day names the gap on the tile instead of fabricating windows', () => {
  hoisted.overrideSlots = []
  const { container } = renderView()
  const tile = container.querySelector('.fh-logtile') as HTMLElement
  expect(within(tile).getByText('nincs mai terv — tervezz és logolj')).toBeInTheDocument()
  expect(tile.querySelector('.fh-lt-dots')).toBeNull()
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
  // The chip is a sibling of `.fh-logtile`, never nested inside it (no nested buttons).
  expect(container.querySelector('.fh-logtile')?.contains(chip)).toBe(false)
  await userEvent.click(chip)
  expect(screen.getByTestId('loc').textContent).toBe(`/fuel/log?d=${yesterday}`)
})

test('hub-csali: ha tegnap minden ablak done, nincs chip', () => {
  hoisted.overrideSlots = [
    { time: '08:00', kind: 'meal', label: 'Reggeli', slotKey: 'breakfast', state: 'done', kcal: 500, p: 30, c: 50, f: 15 },
    { time: '13:00', kind: 'meal', label: 'Ebéd', slotKey: 'lunch', state: 'done', kcal: 700, p: 40, c: 70, f: 20 },
  ]
  renderView()
  expect(screen.queryByRole('button', { name: /pótolható/ })).toBeNull()
})

// ── the 6-tile mosaic ────────────────────────────────────────────────────────

test('the mosaic carries exactly the six Fuel tiles, each navigating to its own page', async () => {
  renderView()
  for (const [label, path] of [
    ['Terv', '/fuel/plan'],
    ['Stack', '/fuel/stack'],
    ['Receptek', '/fuel/recipes'],
    ['Kamra', '/fuel/kamra'],
    ['Gyógyszer', '/fuel/gyogyszer'],
    ['Napló', '/fuel/naplo'],
  ] as const) {
    const tile = screen.getByRole('button', { name: label })
    fireEvent.click(tile)
    expect(screen.getByTestId('loc').textContent).toBe(path)
  }
})

test('tile lines come from the pages\' own data — a Terv line, a Kamra count, no fabricated numbers', () => {
  renderView()
  expect(screen.getByRole('button', { name: 'Terv' })).toHaveTextContent(/^Terv.*Protein \d\/7 nap$/)
  expect(screen.getByRole('button', { name: 'Kamra' })).toHaveTextContent(/\d+ tétel/)
})

test('a Napló line only appears once something is scored today — never a fake AI average', () => {
  hoisted.overrideSlots = [
    { time: '19:00', kind: 'meal', label: 'Vacsora', slotKey: 'dinner', state: 'now', kcal: 600, p: 35, c: 60, f: 18 },
  ]
  renderView()
  // The mock day's own logged meals ARE scored, so the line is present and honest.
  expect(screen.getByRole('button', { name: 'Napló' })).toHaveTextContent(/AI-átlag \d+/)
})

// ── the Fuel-beállítások band (the retired dropdown's extra action) ──────────

test('the Fuel-beállítások band opens FuelSettingsSheet — the dropdown\'s ⚙️ action, re-homed', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: 'Fuel-beállítások' }))
  const dialog = await screen.findByRole('dialog', { name: 'Fuel beállítások' })
  // Something real from the sheet, not just the title — the meals-per-day segmented control.
  expect(within(dialog).getByText(/étkezés\/nap/i)).toBeInTheDocument()
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
