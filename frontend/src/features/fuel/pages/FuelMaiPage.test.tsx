import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, vi } from 'vitest'
import type { FuelSlot } from '@/data/types'
import { FuelMaiPage } from '@/features/fuel/pages/FuelMaiPage'
import { QueryWrapper } from '@/test/queryWrapper'

// The mock demo day (fixed now 13:30) is a PARTIAL day (mezo-1oy5): breakfast + lunch logged, the
// midday/evening windows open (now/pending). To page-test the window-level AI chip, the
// missed→Pótold CTA, the all-done/no-selection seed, and the trailing-missed default deterministically,
// we can inject known slots into the composed timeline (either ADDED to the real seed, or a full
// REPLACEMENT for scenarios that need a specific state shape end to end); both off by default, so
// every other test sees the unmodified real timeline. Idiom mirrors AiLogSheet.test's hoisted
// single-hook override.
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

/** Which island is big right now — the selection's single observable. */
const bigTone = (container: HTMLElement) =>
  (container.querySelector('.isl.isl-big') as HTMLElement | null)?.dataset.tone ?? null

// ── KeretHero (top of page) ─────────────────────────────────────────────────────────────────────

test('KeretHero renders at the top of the page, above .sky-islands, fed by the composed day\'s real numbers', () => {
  const { container } = renderView()
  const hero = container.querySelector('.khero')
  const sky = container.querySelector('.sky-islands')
  expect(hero).toBeInTheDocument()
  expect(sky).toBeInTheDocument()
  // DOM order: the hero comes BEFORE the sky (below the section AppHero chrome, above the sky).
  expect(hero!.compareDocumentPosition(sky!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  // The mock demo day's real consumed kcal (breakfast 580 + lunch 720 = 1300) — never a fabricated
  // placeholder — reaches the hero's "eddig X / Y" line.
  expect(container.querySelector('.khero-of')?.textContent).toContain('eddig 1 300')
})

test('the retired header row and Reta phase strip are gone — no fabricated page chrome', () => {
  const { container } = renderView()
  expect(screen.queryByRole('heading', { name: 'A mai nap' })).toBeNull()
  expect(container.querySelector('.pghead-np')).toBeNull()
  expect(container.querySelector('.retamicro')).toBeNull()
})

// ── Sky composition — done capsule + window islands, no more belt ──────────────────────────────

test('renders the sky: the merged done capsule + the still-open window-islands, one big', () => {
  const { container } = renderView()
  expect(container.querySelector('.sky-islands')).toBeInTheDocument()
  // The mock demo day (fixed now 13:30): breakfast + lunch done (merged into ONE done capsule,
  // no longer their own islands), Uzsonna promoted to 'now' (earliest unlogged window), Vacsora
  // still future — 2 window-islands + the done capsule, no `.isl-belt` anywhere (mezo-c9t5: the
  // belt retired in favor of the top-of-page KeretHero).
  expect(container.querySelector('.kdone')).toBeInTheDocument()
  expect(container.querySelector('.isl-belt')).toBeNull()
  expect(container.querySelectorAll('.sky-islands > .isl[data-tone="fuel"]').length).toBe(2)
  // Exactly one island is big by default — the NOW window (no ?w=).
  expect(bigTone(container)).toBe('fuel')
  expect(container.querySelectorAll('.isl.isl-big')).toHaveLength(1)
  expect(container.querySelector('.now-clock')).toBeInTheDocument()
})

test('an empty day (no meal slots) shows the üres nap island with a ＋ tervezz CTA that navigates to /fuel/plan', async () => {
  hoisted.overrideSlots = []
  const { container } = renderView()
  expect(container.querySelector('.isl-hero-v')?.textContent).toBe('Üres nap')
  expect(screen.getByText('Nincs mai terv — tervezz egyet.')).toBeInTheDocument()
  const cta = screen.getByRole('button', { name: '＋ tervezz' })
  expect(cta).toBeInTheDocument()
  await userEvent.click(cta)
  expect(screen.getByTestId('loc').textContent).toBe('/fuel/plan')
})

test('all windows done (no now, nothing left to select) → no island is big; the done capsule carries every meal', () => {
  hoisted.overrideSlots = [
    { time: '08:00', kind: 'meal', label: 'Reggeli', slotKey: 'breakfast', state: 'done', kcal: 500, p: 30, c: 50, f: 15 },
    { time: '13:00', kind: 'meal', label: 'Ebéd', slotKey: 'lunch', state: 'done', kcal: 700, p: 40, c: 70, f: 20 },
  ]
  const { container } = renderView()
  expect(bigTone(container)).toBeNull()
  expect(container.querySelectorAll('.sky-islands > .isl[data-tone="fuel"]')).toHaveLength(0)
  expect(screen.getByText('2 kész ablak · 1 200 kcal')).toBeInTheDocument()
})

test('a trailing missed window (no now) becomes the default big island — the chronologically first remaining one', () => {
  hoisted.overrideSlots = [
    { time: '08:00', kind: 'meal', label: 'Reggeli', slotKey: 'breakfast', state: 'done', kcal: 500, p: 30, c: 50, f: 15 },
    { time: '13:00', kind: 'meal', label: 'Ebéd', slotKey: 'lunch', state: 'done', kcal: 700, p: 40, c: 70, f: 20 },
    { time: '20:00', kind: 'meal', label: 'Vacsora', slotKey: 'dinner', state: 'missed', kcal: 600, p: 35, c: 60, f: 18 },
  ]
  const { container } = renderView()
  expect(bigTone(container)).toBe('fuel')
  expect(container.querySelector('.isl-big')?.querySelector('.isl-cap')?.getAttribute('aria-label')).toMatch(/^Vacsora ·/)
})

// ── `?w=` URL derivation (the Today `?dp=` pattern) ──────────────────────────────────────────

test('no ?w= → the NOW window is big (river.defaultKey)', () => {
  const { container } = renderView('/fuel')
  expect(bigTone(container)).toBe('fuel')
  expect(container.querySelector('.now-clock')?.classList.contains('isl-big')).toBe(true)
})

test.each(['', 'holnap-uzsonna', 'ismeretlen', 'keret'])(
  'a blank, unknown, or the retired ?w=%s falls back to the default (NOW window) — no belt to select anymore',
  (v) => {
    const { container } = renderView(`/fuel?w=${v}`)
    expect(bigTone(container)).toBe('fuel')
  },
)

test('tapping a capsule grows that island', async () => {
  const { container } = renderView()
  await userEvent.click(screen.getByRole('button', { name: /^Vacsora ·/ }))
  expect(bigTone(container)).toBe('fuel')
  expect(container.querySelector('.isl-big')?.querySelector('.isl-cap')?.getAttribute('aria-label'))
    .toMatch(/^Vacsora ·/)
})

test('selecting a non-default window writes ?w= with that window key; re-selecting the NOW window drops it', () => {
  renderView('/fuel')
  fireEvent.click(screen.getByRole('button', { name: /^Vacsora ·/ }))
  expect(screen.getByTestId('loc').textContent).toBe('/fuel?w=21%3A45-Vacsora')
  fireEvent.click(screen.getByRole('button', { name: /^Uzsonna · most ·/ }))
  expect(screen.getByTestId('loc').textContent).toBe('/fuel')
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
// The real mock demo day carries a fat-bound protocol item matched against the Ebéd (lunch)
// zone — but Ebéd is DONE today, so it merged into the done capsule (mezo-c9t5) and is no longer
// a selectable window island. Its zone-scoped verdict has no L1 to land on anymore; the still-open
// windows never leak it either (zone-scoping survives the merge, it just has nowhere done-side to
// render — flagged in the task report for a product call).

test('an already-done zone\'s stack verdict has no L1 surface anymore; no still-open window leaks it either', async () => {
  renderView()
  expect(screen.queryByRole('button', { name: /^Ebéd ·/ })).toBeNull()

  // Uzsonna (now) is already big by default — its L1 opens directly, no capsule-select needed.
  await userEvent.click(screen.getByRole('button', { name: /^még \d+ ›$/ }))
  expect(screen.queryByText('Ehhez az ablakhoz kötve')).toBeNull()

  // Vacsora, selected explicitly.
  await userEvent.click(screen.getByRole('button', { name: /^Vacsora ·/ }))
  await userEvent.click(screen.getByRole('button', { name: /^még \d+ ›$/ }))
  expect(screen.queryByText('Ehhez az ablakhoz kötve')).toBeNull()
})

// ── Done capsule + AI-score visszakötés (mezo-cs8b) ──────────────────────────────────────────

test('the merged done capsule shows count/kcal/AI-average and expands into per-meal rows', async () => {
  renderView()
  expect(screen.getByText('2 kész ablak · 1 300 kcal · AI-átlag 92 p')).toBeInTheDocument()
  expect(screen.queryByText('Túrós zabkása · áfonyával')).toBeNull()
  await userEvent.click(screen.getByRole('button', { name: /kész ablak/ }))
  expect(screen.getByText('Túrós zabkása · áfonyával')).toBeInTheDocument()
  expect(screen.getByText('Csirke + édesburgonya + spenót')).toBeInTheDocument()
  // Both mock meals are scored (m1 high, m2 mid) — each row carries its own ✨ chip.
  expect(screen.getAllByText(/^✨ \d+$/).length).toBe(2)
  // The frozen mock demo day's gym block sits at 07:30 — breakfast (09:15) lands 105min after it
  // (0-120min window) → EDZÉS UTÁNI; lunch (13:00) is 330min out → STANDARD.
  expect(screen.getByText('EDZÉS UTÁNI')).toBeInTheDocument()
  expect(screen.getByText('STANDARD')).toBeInTheDocument()
})

test('tapping a scored done row opens MealScoreSheet with that meal', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: /kész ablak/ }))
  await userEvent.click(screen.getByRole('button', { name: /Túrós zabkása/ }))
  expect(await screen.findByText('AI score · részletek')).toBeInTheDocument()
})

test('no done windows today → no done capsule renders at all', () => {
  hoisted.overrideSlots = [
    { time: '20:00', kind: 'meal', label: 'Vacsora', slotKey: 'dinner', state: 'now', kcal: 600, p: 35, c: 60, f: 18 },
  ]
  const { container } = renderView()
  expect(container.querySelector('.kdone')).toBeNull()
})

// ── Water ─────────────────────────────────────────────────────────────────────────────────────

test('the víz ring opens WaterLogSheet; logging a chip amount updates the consumed water', async () => {
  renderView()
  // The víz ring's own aria-label carries the current/target liters ("Víz logolása · 1,2 a 2,5
  // literből") — the visible, accessible signal that a log actually landed, not just that the
  // sheet closed. Capture it before, log +250ml, and assert it CHANGED after (not merely truthy).
  const before = screen.getByRole('button', { name: /^Víz logolása/ }).getAttribute('aria-label')
  await userEvent.click(screen.getByRole('button', { name: /^Víz logolása/ }))
  expect(await screen.findByText('Mennyit ittál?')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: '250 ml' }))
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  await waitFor(() => expect(screen.queryByText('Mennyit ittál?')).toBeNull())
  const after = screen.getByRole('button', { name: /^Víz logolása/ }).getAttribute('aria-label')
  expect(after).not.toBe(before)
})

// ── Chips → EnergyBreakdownSheet (restored wiring) ───────────────────────────────────────────

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

test('the macro rings / water ring read via aria-labels and visible labels, not fabricated text', () => {
  const { container } = renderView()
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
