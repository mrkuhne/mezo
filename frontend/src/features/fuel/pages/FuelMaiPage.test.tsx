import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import type { FuelSlot } from '@/data/types'
import { FuelMaiPage } from '@/features/fuel/pages/FuelMaiPage'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'

// The mock demo day (fixed now 13:30) is a PARTIAL day (mezo-1oy5): breakfast + lunch logged, the
// midday/evening windows open (now/pending). To page-test the window-level AI chip and the
// missed→Pótold CTA deterministically we inject a KNOWN extra slot (slotKey set) into the composed
// timeline; both off by default, so every other test sees the unmodified real timeline. Idiom
// mirrors AiLogSheet.test's hoisted single-hook override.
const hoisted = vi.hoisted(() => ({ injectOpenSlot: false, injectMissedSlot: false }))
vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return {
    ...actual,
    useFuelTimeline: (date?: string) => {
      const real = actual.useFuelTimeline(date)
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
afterEach(() => { vi.unstubAllEnvs(); hoisted.injectOpenSlot = false; hoisted.injectMissedSlot = false })

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
  // Kitchen close / coffee cutoff kept their real data, at the end of the day.
  expect(screen.getByText(/Konyha zár/)).toBeInTheDocument()
  expect(screen.getByText(/kávé cutoff/)).toBeInTheDocument()
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

// ── Water ─────────────────────────────────────────────────────────────────────────────────────

test('logs water via the +250 ml quick-add on the expanded Keret-öv', async () => {
  renderView('/fuel?w=keret')
  const before = screen.getByText(/\/ 4,0 l/).textContent
  await userEvent.click(screen.getByRole('button', { name: '+250 ml' }))
  await waitFor(() => expect(screen.getByText(/\/ 4,0 l/).textContent).not.toBe(before))
})

// ── Carried over from the retired flat page (adapted queries only) ─────────────────────────────

test('shows the protocol-meta row when a protocol is active (mock, v3)', () => {
  renderView()
  expect(screen.getByText(/Stack · v3/)).toBeInTheDocument()
})

test('hides the protocol-meta row when there is no active protocol (real-mode ghost v0)', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  renderView()
  await waitFor(() => expect(screen.queryByText(/Stack · v/)).not.toBeInTheDocument())
  expect(screen.queryByRole('button', { name: 'Replan' })).not.toBeInTheDocument()
})

test('hides the Replan CTA in real mode even with an active protocol — no fabricated scenarios (mezo-t16y.4)', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(
    http.get(`${API_BASE}/api/fuel/protocol`, () =>
      HttpResponse.json({
        active: { id: 'p1', version: 1, builtAt: '2026-07-05T06:00:00Z', status: 'active', confidence: 0.9, items: [] },
        history: [{ version: 1, builtAt: '2026-07-05T06:00:00Z' }],
      }),
    ),
  )
  renderView()
  // The meta row renders for the real v1 protocol, but the Replan CTA stays hidden:
  // useReplanScenarios is honest-empty in real mode (the replan engine is P8).
  expect(await screen.findByText(/Stack · v1/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Replan' })).not.toBeInTheDocument()
})

test('Replan button opens the replan sheet', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: 'Replan' }))
  expect(await screen.findByText(/Replan · Mezo/)).toBeInTheDocument()
})

test('opens the FuelSettingsSheet from the szerkeszt chip', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: 'Fuel beállítások' }))
  expect(await screen.findByRole('dialog', { name: 'Fuel beállítások' })).toBeInTheDocument()
})

test('real mode: the kitchen-close row shows schedule-derived values (kitchen close, coffee cutoff)', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  // Pin a Sunday (Vas) — a rest day in the default fixtures (gym is Csü, volleyball
  // Hét–Pén) — so no training block snaps the Vacsora main off kitchenClose, making
  // the window-anchor assertion deterministic. Fake ONLY Date so findBy keeps polling.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-07-05T10:00:00'))
  try {
    renderView()
    // Derived from the SLEEP goal's wake/bed anchor (mezo-dbsr) — the default MSW
    // /api/sleep/goal resolves to 06:45/23:15, so kitchen close = bed(23:15) − 90m =
    // 21:45 (findByText waits out the sleep-goal fetch); caffeine cutoff pinned 14:00.
    expect(screen.getByText(/kávé cutoff 14:00/)).toBeInTheDocument()
    expect(await screen.findByText(/Konyha zár · 21:45/)).toBeInTheDocument()
  } finally {
    vi.useRealTimers()
  }
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
