import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, vi } from 'vitest'
import type { FuelSlot } from '@/data/types'
import { FuelMaiPage } from '@/features/fuel/pages/FuelMaiPage'
import { QueryWrapper } from '@/test/queryWrapper'

// The mock demo day (fixed now 13:30) is a PARTIAL day (mezo-1oy5): breakfast + lunch logged, the
// midday/evening windows open (now/pending). To page-test the window-level AI chip, the
// missed→Pótold CTA, the all-done/keret-default seed, and the trailing-missed belt placement
// deterministically, we can inject known slots into the composed timeline (either ADDED to the
// real seed, or a full REPLACEMENT for scenarios that need a specific state shape end to end);
// both off by default, so every other test sees the unmodified real timeline. Idiom mirrors
// AiLogSheet.test's hoisted single-hook override.
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

// FuelMaiPage reads the composed dual-mode useFuelDay/useFuelTimeline; pin mock mode for the static
// Phase-1 seed and provide a QueryClientProvider.
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => {
  vi.unstubAllEnvs()
  hoisted.injectOpenSlot = false
  hoisted.injectMissedSlot = false
  hoisted.overrideSlots = null
})

/** Reports the live URL so the `?w=` writes are observable. */
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

/** Which island/belt is big right now — the selection's single observable. */
const bigTone = (container: HTMLElement) =>
  (container.querySelector('.isl.isl-big') as HTMLElement | null)?.dataset.tone ?? null

test('renders the sky-islands sky: window-islands + the always-visible Keret-öv, one big', () => {
  const { container } = renderView()
  expect(container.querySelector('.sky-islands')).toBeInTheDocument()
  // The mock demo day (fixed now 13:30): breakfast + lunch done, Uzsonna promoted to 'now'
  // (earliest unlogged window), Vacsora still future — four window-islands + the belt.
  expect(container.querySelectorAll('.sky-islands > .isl').length).toBe(5)
  expect(container.querySelectorAll('.isl[data-tone="fuel"]').length).toBe(4)
  expect(container.querySelector('.isl-belt[data-tone="keret"]')).toBeInTheDocument()
  // Exactly one island is big by default — the NOW window (no ?w=).
  expect(bigTone(container)).toBe('fuel')
  expect(container.querySelectorAll('.isl.isl-big')).toHaveLength(1)
  expect(container.querySelector('.now-clock')).toBeInTheDocument()
})

test('the retired header row and Reta phase strip are gone — no fabricated page chrome', () => {
  const { container } = renderView()
  expect(screen.queryByRole('heading', { name: 'A mai nap' })).toBeNull()
  expect(container.querySelector('.pghead-np')).toBeNull()
  expect(container.querySelector('.retamicro')).toBeNull()
})

test('the Keret-öv sits DOM-fixed right after the NOW-island', () => {
  const { container } = renderView()
  const shells = Array.from(container.querySelectorAll('.sky-islands > .isl'))
  const nowIdx = shells.findIndex((el) => el.classList.contains('now-clock'))
  const beltIdx = shells.findIndex((el) => el.classList.contains('isl-belt'))
  expect(nowIdx).toBeGreaterThanOrEqual(0)
  expect(beltIdx).toBe(nowIdx + 1)
})

test('all windows done (no now) → the Keret-öv is the default big island', () => {
  hoisted.overrideSlots = [
    { time: '08:00', kind: 'meal', label: 'Reggeli', slotKey: 'breakfast', state: 'done', kcal: 500, p: 30, c: 50, f: 15 },
    { time: '13:00', kind: 'meal', label: 'Ebéd', slotKey: 'lunch', state: 'done', kcal: 700, p: 40, c: 70, f: 20 },
  ]
  const { container } = renderView()
  expect(bigTone(container)).toBe('keret')
})

test('a trailing missed window (no now) puts the belt after the last DONE island, not the chronologically last', () => {
  hoisted.overrideSlots = [
    { time: '08:00', kind: 'meal', label: 'Reggeli', slotKey: 'breakfast', state: 'done', kcal: 500, p: 30, c: 50, f: 15 },
    { time: '13:00', kind: 'meal', label: 'Ebéd', slotKey: 'lunch', state: 'done', kcal: 700, p: 40, c: 70, f: 20 },
    { time: '20:00', kind: 'meal', label: 'Vacsora', slotKey: 'dinner', state: 'missed', kcal: 600, p: 35, c: 60, f: 18 },
  ]
  const { container } = renderView()
  const shells = Array.from(container.querySelectorAll('.sky-islands > .isl'))
  expect(shells).toHaveLength(4) // Reggeli, Ebéd, belt, Vacsora
  expect(shells[0].querySelector('.isl-cap')?.getAttribute('aria-label')).toMatch(/^Reggeli ·/)
  expect(shells[1].querySelector('.isl-cap')?.getAttribute('aria-label')).toMatch(/^Ebéd ·/)
  expect(shells[2].classList.contains('isl-belt')).toBe(true)
  expect(shells[3].querySelector('.isl-cap')?.getAttribute('aria-label')).toMatch(/^Vacsora ·/)
})

// ── `?w=` URL derivation (the Today `?dp=` pattern) ──────────────────────────────────────────

test('no ?w= → the NOW window is big (river.defaultKey)', () => {
  const { container } = renderView('/fuel')
  expect(bigTone(container)).toBe('fuel')
  expect(container.querySelector('.now-clock')?.classList.contains('isl-big')).toBe(true)
})

test('?w=keret → the Keret-öv is big', () => {
  const { container } = renderView('/fuel?w=keret')
  expect(bigTone(container)).toBe('keret')
})

test.each(['', 'holnap-uzsonna', 'ismeretlen'])('a blank or unknown ?w=%s falls back to the default (NOW window)', (v) => {
  const { container } = renderView(`/fuel?w=${v}`)
  expect(bigTone(container)).toBe('fuel')
})

test('tapping a capsule grows that island', async () => {
  const { container } = renderView()
  await userEvent.click(screen.getByRole('button', { name: /^Reggeli ·/ }))
  expect(bigTone(container)).toBe('fuel')
  expect(container.querySelector('.isl-big')?.querySelector('.isl-cap')?.getAttribute('aria-label'))
    .toMatch(/^Reggeli ·/)
})

test('clicking the belt while a window is selected writes ?w=keret; clicking the NOW window drops it', async () => {
  renderView('/fuel')
  fireEvent.click(screen.getByRole('button', { name: /^Napi keret megnyitása/ }))
  expect(screen.getByTestId('loc').textContent).toBe('/fuel?w=keret')
  // Re-select the NOW window (the default) — the param is dropped, not overwritten with its key.
  fireEvent.click(screen.getByRole('button', { name: /^Uzsonna · most ·/ }))
  expect(screen.getByTestId('loc').textContent).toBe('/fuel')
})

test('selecting a non-default window writes ?w= with that window key', () => {
  renderView('/fuel')
  fireEvent.click(screen.getByRole('button', { name: /^Vacsora ·/ }))
  expect(screen.getByTestId('loc').textContent).toBe('/fuel?w=21%3A45-Vacsora')
})

// ── Logging / AI ──────────────────────────────────────────────────────────────────────────────

test('the selected window\'s CTA opens LogMealSheet on that window\'s slot', async () => {
  renderView()
  // The NOW window (Uzsonna) is big by default — its action row is live without an extra click.
  await userEvent.click(screen.getByRole('button', { name: 'Logold' }))
  expect(await screen.findByText('Mit ettél?')).toBeInTheDocument()
})

test('clicking a window\'s ✨ AI chip opens the AI log sheet on that window\'s slot (mezo-53su)', async () => {
  hoisted.injectOpenSlot = true // inject a KNOWN open meal/snack slot (deterministic across weekdays)
  renderView()
  // Select the injected slot's OWN island first (act-anywhere: select, then act) — its capsule
  // essence carries the slot label, so the aria-label is unambiguous.
  await userEvent.click(screen.getByRole('button', { name: /^Esti snack · 20:00 ·/ }))
  await userEvent.click(screen.getByRole('button', { name: '✨ AI' }))
  expect(await screen.findByRole('dialog', { name: 'AI ételnapló' })).toBeInTheDocument()
})

test('the ad-hoc "Log bármikor" row on the expanded Keret-öv opens an empty LogMealSheet', async () => {
  renderView('/fuel?w=keret')
  await userEvent.click(screen.getByRole('button', { name: /Log bármikor/ }))
  expect(await screen.findByText('Mit ettél?')).toBeInTheDocument()
})

test('a missed window\'s CTA reads Pótold and still opens LogMealSheet on that slot', async () => {
  hoisted.injectMissedSlot = true
  renderView()
  // Select the injected missed island (its capsule essence carries "kimaradt — pótold").
  await userEvent.click(screen.getByRole('button', { name: /^Tízórai · 11:00 · kimaradt/ }))
  const cta = await screen.findByRole('button', { name: 'Pótold' })
  await userEvent.click(cta)
  expect(await screen.findByText('Mit ettél?')).toBeInTheDocument()
})

// ── Stack doses (matchMealsToStack wiring, review fix #1) ───────────────────────────────────
// The real mock demo day already carries a fat-bound protocol item matched against the logged
// Ebéd (lunch) meal — matchMealsToStack's own zone-matching/verdict-derivation logic has its
// dedicated unit coverage (matchMealsToStack.test.ts); this test owns the question
// FuelMaiPage.tsx is responsible for: does a real verdict land in the RIGHT window's L1 (and
// nowhere else) end to end, through useStackDay + useFuelDay + useRecipes → buildWindowRiver.

test('the lunch (Ebéd) window\'s L1 carries its real stack-match dose, and no other window does', async () => {
  renderView()

  // The lunch window's L1 carries the dose, with a Pipa ✓ action.
  await userEvent.click(screen.getByRole('button', { name: /^Ebéd ·/ }))
  await userEvent.click(screen.getByRole('button', { name: /^még \d+ ›$/ }))
  expect(screen.getByText('Ehhez az ablakhoz kötve', { selector: '.isl-grouph span' })).toBeInTheDocument()
  expect(screen.getByText('18g zsír')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Pipa ✓' })).toBeInTheDocument()

  // No other window's L1 carries a dose group — the verdict is zone-scoped, not day-wide.
  for (const label of [/^Reggeli ·/, /^Uzsonna ·/, /^Vacsora ·/]) {
    await userEvent.click(screen.getByRole('button', { name: label }))
    await userEvent.click(screen.getByRole('button', { name: /^még \d+ ›$/ }))
    expect(screen.queryByText('Ehhez az ablakhoz kötve')).toBeNull()
  }
})

// ── Water ─────────────────────────────────────────────────────────────────────────────────────

test('logs water via the +250 ml quick-add on the expanded Keret-öv', async () => {
  renderView('/fuel?w=keret')
  const before = screen.getByText(/\/ 4,0 l/).textContent
  await userEvent.click(screen.getByRole('button', { name: '+250 ml' }))
  await waitFor(() => expect(screen.getByText(/\/ 4,0 l/).textContent).not.toBe(before))
})

test('real mode: the Keret-öv\'s footer note carries schedule-derived kitchen close / coffee cutoff', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  // Pin a Sunday (Vas) — a rest day in the default fixtures (gym is Csü, volleyball
  // Hét–Pén) — so no training block snaps the Vacsora main off kitchenClose, making
  // the window-anchor assertion deterministic. Fake ONLY Date so findBy keeps polling.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-07-05T10:00:00'))
  try {
    renderView('/fuel?w=keret')
    // Derived from the SLEEP goal's wake/bed anchor (mezo-dbsr) — the default MSW
    // /api/sleep/goal resolves to 06:45/23:15, so kitchen close = bed(23:15) − 90m =
    // 21:45 (findByText waits out the sleep-goal fetch); caffeine cutoff pinned 14:00. The
    // row moved into the Keret-öv's kibontott view as a quiet note (review fix #2a) — no
    // below-sky row is left to host it.
    expect(await screen.findByText(/Konyha zár · 21:45 · kávé cutoff 14:00/)).toBeInTheDocument()
  } finally {
    vi.useRealTimers()
  }
})

test('the szerkeszt › button on the expanded Keret-öv opens FuelSettingsSheet (review round 3)', async () => {
  renderView('/fuel?w=keret')
  await userEvent.click(screen.getByRole('button', { name: 'szerkeszt ›' }))
  const dialog = await screen.findByRole('dialog', { name: 'Fuel beállítások' })
  // Something real from the sheet, not just the title — the meals-per-day segmented control.
  expect(within(dialog).getByText(/étkezés\/nap/i)).toBeInTheDocument()
})

test('real mode: today\'s gym block surfaces as workoutTime in the NOW window\'s subtitle', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  // Pin a Thursday (Csü) — the default fixtures' only gym day, with a gym-schedule time of
  // 18:30 (src/test/msw/handlers.ts) — so `blocks` composes a real 'gym' PlannerBlock and
  // `workoutTime` is non-null without hand-rolling a mesocycle fixture. Fake ONLY Date so
  // findBy's real timers keep polling.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-07-02T07:00:00'))
  try {
    const { container } = renderView()
    await waitFor(() => expect(container.querySelector('.isl-hero-sub')?.textContent).toMatch(/edzés 18:30/))
  } finally {
    vi.useRealTimers()
  }
})

test('the water row / macro bars read via aria-labels, not fabricated text', () => {
  const { container } = renderView('/fuel?w=keret')
  expect(container.querySelector('[aria-label^="Fehérje "]')).toBeInTheDocument()
  expect(container.querySelector('[aria-label^="Szénhidrát "]')).toBeInTheDocument()
  expect(container.querySelector('[aria-label^="Zsír "]')).toBeInTheDocument()
  expect(screen.getByText('Víz')).toBeInTheDocument()
})

test('the big window carries aria-current on its bigview', () => {
  const { container } = renderView()
  const big = container.querySelector('.isl-big .isl-bigview')
  expect(big).toHaveAttribute('aria-current', 'true')
  expect(within(big as HTMLElement).getByText('Logold')).toBeInTheDocument()
})
