// ============================================================
// Mezo · Fuel hub tests (Design 2.0 F3.1, mezo-d20.4.1) — the /fuel index's Mozaik
// face: keret-hero (ONE number) → window swimlane → Mezo counter banner → 6-tile
// mosaic → Fuel-beállítások band.
//
// The behavioral contracts the page INHERITS are the spec and survive the re-face:
// logging from a window carries THAT window's slotKey (mezo-bnsf), a missed window
// says Pótold and is never punitive, an unscored done meal reads „✨ folyamatban",
// a scored one with a breakdown opens MealScoreSheet, the víz ring opens the water
// sheet, the energy chips reopen their own EnergyBreakdownSheet section and VANISH
// on static energy, an all-done day still offers a log path, and the Fuel-beállítások
// entry (retired SubNavDropdown extra action) still opens FuelSettingsSheet.
// ============================================================
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, vi } from 'vitest'
import type { FuelSlot } from '@/data/types'
import { FuelMaiPage } from '@/features/fuel/pages/FuelMaiPage'
import { QueryWrapper } from '@/test/queryWrapper'

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

test('the hub is the Mozaik face: header recipe → hero → swimlane → Mezo banner → mosaic → band, no sub-nav shell', () => {
  const { container } = renderView()
  expect(container.querySelector('.fh-hub')).toBeInTheDocument()
  expect(container.querySelector('.nap-head')).toBeInTheDocument()
  expect(screen.queryByLabelText('Fuel alnavigáció')).toBeNull()
  const hero = container.querySelector('.fh-hero')
  const lane = container.querySelector('.fh-lane')
  const banner = container.querySelector('.fh-mezotile')
  const mosaic = container.querySelector('.mz-mosaic')
  expect(hero).toBeInTheDocument()
  expect(lane).toBeInTheDocument()
  expect(banner).toBeInTheDocument()
  expect(mosaic).toBeInTheDocument()
  expect(hero!.compareDocumentPosition(lane!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(lane!.compareDocumentPosition(banner!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(banner!.compareDocumentPosition(mosaic!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  // The retired sky/island shell is gone.
  expect(container.querySelector('.sky-islands')).toBeNull()
  expect(container.querySelector('.kdone')).toBeNull()
})

// ── keret-hero (hub v3: ONE number) ──────────────────────────────────────────

test('the hero is ONE number — the kcal CONSUMED today; no eyebrow, no "eddig x / y" of-line', () => {
  const { container } = renderView()
  // The mock demo day's real consumed kcal (breakfast 580 + lunch 720 = 1300).
  expect(container.querySelector('.khero-n')?.getAttribute('aria-label')).toBe('1 300 kcal ma')
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
    expect(container.querySelectorAll('.khero-seg')).toHaveLength(2) // breakfast + lunch done
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

// ── window swimlane ──────────────────────────────────────────────────────────

test('every eating window gets its own lane tile, carrying a kcal mini-tile and three macro rings', () => {
  hoisted.overrideSlots = [
    { time: '08:00', kind: 'meal', label: 'Reggeli', slotKey: 'breakfast', state: 'done', kcal: 500, p: 30, c: 50, f: 15 },
    { time: '13:00', kind: 'meal', label: 'Ebéd', slotKey: 'lunch', state: 'now', kcal: 700, p: 40, c: 70, f: 20 },
    { time: '19:00', kind: 'meal', label: 'Vacsora', slotKey: 'dinner', state: 'pending', kcal: 600, p: 35, c: 60, f: 18 },
  ]
  const { container } = renderView()
  // 3 windows + the trailing out-of-window tile.
  expect(container.querySelectorAll('.fh-wtile')).toHaveLength(4)
  const now = container.querySelector('.fh-wtile.is-now') as HTMLElement
  expect(within(now).getByText('MOST')).toBeInTheDocument()
  expect(within(now).getByText('700')).toBeInTheDocument()
  expect(now.querySelectorAll('.fh-wring')).toHaveLength(3)
  expect(within(now).getByLabelText(/^Fehérje 40 g, a napi cél \d+ százaléka$/)).toBeInTheDocument()
  // The lane carries NO header (iterations §2).
  expect(screen.queryByText('Étkezési ablakok')).toBeNull()
})

test('a done window wears the KÉSZ stamp, the meal name and its AI-score chip', () => {
  const { container } = renderView()
  const done = container.querySelectorAll('.fh-wtile.is-done')
  expect(done.length).toBe(2)
  expect(within(done[0] as HTMLElement).getByText('KÉSZ ✓')).toBeInTheDocument()
  expect(screen.getByText('Túrós zabkása · áfonyával')).toBeInTheDocument()
  // Both mock done meals are scored — each tile carries its own ✨ chip.
  expect(screen.getAllByText(/^✨ \d+ p$/).length).toBe(2)
})

test('an unscored (fresh) log reads „✨ folyamatban" — never a fabricated score', () => {
  hoisted.overrideSlots = [
    { time: '08:00', kind: 'meal', label: 'Reggeli', slotKey: 'breakfast', state: 'done', kcal: 500, p: 30, c: 50, f: 15, mealId: 'nincs-ilyen-meal' },
  ]
  renderView()
  expect(screen.getByText('✨ folyamatban')).toBeInTheDocument()
})

test('a scored done meal WITH a breakdown opens MealScoreSheet from its score chip', async () => {
  renderView()
  const chips = screen.getAllByRole('button', { name: /AI score részletek$/ })
  expect(chips.length).toBeGreaterThan(0)
  await userEvent.click(chips[0])
  expect(await screen.findByText('AI score · részletek')).toBeInTheDocument()
})

test('a missed window says „még pótolható" and offers Pótold — never a punitive word', () => {
  hoisted.injectMissedSlot = true
  const { container } = renderView()
  const missed = container.querySelector('.fh-wtile.is-missed') as HTMLElement
  expect(missed).toBeInTheDocument()
  expect(within(missed).getByText('KIMARADT')).toBeInTheDocument()
  expect(within(missed).getByText('még pótolható')).toBeInTheDocument()
  expect(within(missed).getByRole('button', { name: 'Pótold · Tízórai' })).toBeInTheDocument()
  expect(container.textContent).not.toMatch(/bukt|elrontot|kudarc/i)
})

test('„a tervből" only shows with a real plan suggestion behind the window', () => {
  hoisted.overrideSlots = [
    { time: '13:00', kind: 'meal', label: 'Ebéd', slotKey: 'lunch', state: 'now', kcal: 700, p: 40, c: 70, f: 20, mealName: 'Csirkés bowl', suggestedRecipeId: 'r-1' },
    { time: '19:00', kind: 'meal', label: 'Vacsora', slotKey: 'dinner', state: 'pending', kcal: 600, p: 35, c: 60, f: 18 },
  ]
  renderView()
  expect(screen.getAllByText('a tervből')).toHaveLength(1)
})

test('the lane auto-scrolls to the MOST tile on mount', () => {
  hoisted.overrideSlots = [
    { time: '08:00', kind: 'meal', label: 'Reggeli', slotKey: 'breakfast', state: 'done', kcal: 500, p: 30, c: 50, f: 15 },
    { time: '13:00', kind: 'meal', label: 'Ebéd', slotKey: 'lunch', state: 'now', kcal: 700, p: 40, c: 70, f: 20 },
  ]
  const { container } = renderView()
  const lane = container.querySelector('.fh-lane') as HTMLElement
  const now = container.querySelector('[data-now="true"]') as HTMLElement
  expect(now).toBeInTheDocument()
  // jsdom reports 0 offsets, so the observable is that the lane was positioned at all
  // (never NaN / negative) — the real centering is a browser-layout concern.
  expect(lane.scrollLeft).toBe(0)
})

// ── logging from a window lands in THAT window's slot (mezo-bnsf) ────────────
// `buildDayPlan` files logged meals by `slotKey` ONLY, never by timestamp — so a meal
// logged from the Ebéd tile under the wall-clock's slot fills the *dinner* window
// instead, and Ebéd stays missed, still offering the same Pótold.

test('Pótold on a suggestion-carrying window logs into THAT window\'s slot, not the wall-clock one', async () => {
  hoisted.overrideSlots = [
    { time: '13:00', kind: 'meal', label: 'Ebéd', slotKey: 'lunch', state: 'missed',
      kcal: 660, p: 48, c: 62, f: 14, suggestedRecipeId: 'rec-1' },
  ]
  // 16:35 wall clock → LogFlowPage's `defaultMealSlot()` returns 'dinner'. The tapped window is lunch.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-07-02T16:35:00'))
  try {
    renderView()
    await userEvent.click(screen.getByRole('button', { name: 'Pótold · Ebéd' }))
    const ebed = await screen.findByRole('button', { name: 'Ebéd' })
    expect(ebed).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Vacsora' })).toHaveAttribute('aria-pressed', 'false')
  } finally {
    vi.useRealTimers()
  }
})

test('a window with no suggestion also seeds its own slot (the branch that already did)', async () => {
  hoisted.overrideSlots = [
    { time: '13:00', kind: 'meal', label: 'Ebéd', slotKey: 'lunch', state: 'missed',
      kcal: 660, p: 48, c: 62, f: 14 },
  ]
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-07-02T16:35:00'))
  try {
    renderView()
    await userEvent.click(screen.getByRole('button', { name: 'Pótold · Ebéd' }))
    expect(await screen.findByRole('button', { name: 'Ebéd' })).toHaveAttribute('aria-pressed', 'true')
  } finally {
    vi.useRealTimers()
  }
})

// mezo-d20.4.2: the AI path is no longer a separate sheet — it opens the SAME unified log
// flow with its ✨ AI panel armed, still carrying that window's slot (the mezo-53su contract).
test('a window\'s ✨ AI CTA opens the unified log flow on that window\'s slot, AI panel armed', async () => {
  hoisted.injectOpenSlot = true
  renderView()
  await userEvent.click(screen.getByRole('button', { name: 'AI naplózás · Esti snack' }))
  const flow = await screen.findByRole('dialog', { name: 'Mit ettél?' })
  expect(within(flow).getByRole('button', { name: 'Snack', pressed: true })).toBeInTheDocument()
  expect(within(flow).getByPlaceholderText(/csirkés wrap/)).toBeInTheDocument()
})

// ── the standing out-of-window tile (mezo-66te) ──────────────────────────────
// Every window CTA vanishes once the day is done, and the + FAB's Étkezés tile only
// navigates here — so the lane must always end with a log door.

test('an all-done day still offers meal logging: the out-of-window tile opens LogFlowPage', async () => {
  hoisted.overrideSlots = [
    { time: '08:00', kind: 'meal', label: 'Reggeli', slotKey: 'breakfast', state: 'done', kcal: 500, p: 30, c: 50, f: 15 },
    { time: '13:00', kind: 'meal', label: 'Ebéd', slotKey: 'lunch', state: 'done', kcal: 700, p: 40, c: 70, f: 20 },
  ]
  renderView()
  expect(screen.getByText('Ablakon kívül')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: '＋ Logolás' }))
  expect(await screen.findByText('Mit ettél?')).toBeInTheDocument()
})

test('an all-done day still offers AI logging: the out-of-window ✨ AI napló arms the flow\'s AI panel', async () => {
  hoisted.overrideSlots = [
    { time: '08:00', kind: 'meal', label: 'Reggeli', slotKey: 'breakfast', state: 'done', kcal: 500, p: 30, c: 50, f: 15 },
  ]
  renderView()
  await userEvent.click(screen.getByRole('button', { name: '✨ AI napló' }))
  const flow = await screen.findByRole('dialog', { name: 'Mit ettél?' })
  expect(within(flow).getByPlaceholderText(/csirkés wrap/)).toBeInTheDocument()
})

test('an empty day (no meal slots) leads the lane with the üres-nap tile → /fuel/plan', async () => {
  hoisted.overrideSlots = []
  const { container } = renderView()
  expect(screen.getByText('Üres nap')).toBeInTheDocument()
  expect(screen.getByText('Nincs mai terv')).toBeInTheDocument()
  // Only the üres-nap tile + the out-of-window tile — no fabricated windows.
  expect(container.querySelectorAll('.fh-wtile')).toHaveLength(2)
  await userEvent.click(screen.getByRole('button', { name: '＋ tervezz' }))
  expect(screen.getByTestId('loc').textContent).toBe('/fuel/plan')
})

// ── Mezo counter banner ──────────────────────────────────────────────────────

test('the Mezo banner is a counter-only door to /fuel/uzenetek — it never repeats the voice', async () => {
  const { container } = renderView()
  const banner = container.querySelector('.fh-mezotile') as HTMLElement
  // Mock mode's companion feed is empty → the banner stays a door, with no fabricated count.
  expect(banner).toHaveTextContent('Mezo · Fuel-üzenetek')
  expect(banner.textContent).not.toMatch(/\d+ új Fuel-üzenet/)
  fireEvent.click(banner)
  expect(screen.getByTestId('loc').textContent).toBe('/fuel/uzenetek')
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
