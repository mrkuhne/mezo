import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import type { FuelSlot } from '@/data/types'
import { FuelMaiPage } from '@/features/fuel/pages/FuelMaiPage'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'

// The mock demo day (fixed now 13:30) is fully logged — every meal/snack slot is `done`, so no
// per-slot log/AI chip renders. To page-test the slot-level AI chip (mezo-53su) we inject one
// open meal/snack slot (slotKey set) into the composed timeline; default off, so every other test
// sees the unmodified real timeline. Idiom mirrors AiLogSheet.test's hoisted single-hook override.
const hoisted = vi.hoisted(() => ({ injectOpenSlot: false }))
vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return {
    ...actual,
    useFuelTimeline: (date?: string) => {
      const real = actual.useFuelTimeline(date)
      if (!hoisted.injectOpenSlot) return real
      const openSlot: FuelSlot = {
        time: '20:00', kind: 'snack', label: 'Esti snack', slotKey: 'snack',
        state: 'pending', kcal: 300, p: 20, c: 30, f: 8,
      }
      return { ...real, plan: { ...real.plan, slots: [...real.plan.slots, openSlot] } }
    },
  }
})

// FuelMaiPage reads the composed dual-mode useFuelDay (mezo-arb); pin mock mode for the static
// Phase-1 seed (consumed 1840, scored meals with breakdowns) and provide a QueryClientProvider.
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => { vi.unstubAllEnvs(); hoisted.injectOpenSlot = false })

const renderView = () =>
  render(
    <QueryWrapper>
      <MemoryRouter><FuelMaiPage /></MemoryRouter>
    </QueryWrapper>,
  )

test('renders header, gauge, fuelchips, macro bars, timeline and micronutrients', () => {
  const { container } = renderView()
  expect(screen.getByRole('heading', { name: 'Mai pacing' })).toBeInTheDocument()
  // Napiv kcal gauge — consumed value renders inside .gauge (mezo-8141).
  expect(container.querySelector('.gauge')).toBeInTheDocument()
  expect(screen.getByText(/1840/)).toBeInTheDocument()
  // fuelchips — coffee cutoff / kitchen close, moved off the retired context strip.
  expect(screen.getByText(/kávé cutoff/)).toBeInTheDocument()
  expect(screen.getByText(/konyha zár/)).toBeInTheDocument()
  // macro soft bars — Fehérje/Szénhidrát/Zsír, three `.mac` rows.
  expect(container.querySelectorAll('.mac')).toHaveLength(3)
  expect(screen.getByText('Fehérje')).toBeInTheDocument()
  expect(screen.getByText('Szénhidrát')).toBeInTheDocument()
  expect(screen.getByText('Zsír')).toBeInTheDocument()
  expect(screen.getByText('Mikrotápanyagok · heti')).toBeInTheDocument()
})
test('opens the FuelSettingsSheet from the szerkeszt chip', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: 'Fuel beállítások' }))
  expect(await screen.findByRole('dialog', { name: 'Fuel beállítások' })).toBeInTheDocument()
})
test('shows the protocol-meta row when a protocol is active (mock, v3)', () => {
  renderView()
  expect(screen.getByText(/Stack · v3/)).toBeInTheDocument()
})
test('hides the protocol-meta row when there is no active protocol (real-mode ghost v0)', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  renderView()
  await screen.findByRole('heading', { name: 'Mai pacing' })
  expect(screen.queryByText(/Stack · v/)).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Replan' })).not.toBeInTheDocument()
})
test('hides the Replan CTA in real mode even with an active protocol — no fabricated scenarios (mezo-t16y.4)', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(
    http.get(`${API_BASE}/api/fuel/protocol`, () =>
      HttpResponse.json({
        active: { id: 'p1', version: 1, builtAt: '2026-07-05T06:00:00Z', status: 'active', confidence: 0.9, selectedPantryItemIds: [] },
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
test('opening a meal score sheet then closing it', async () => {
  renderView()
  await userEvent.click(screen.getAllByRole('button', { name: 'AI score' })[0])
  expect(await screen.findByText('Súlyozott bontás')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Bezárás' }))
  await waitFor(() => expect(screen.queryByText('Súlyozott bontás')).not.toBeInTheDocument())
})
test('Replan button opens the replan sheet', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: 'Replan' }))
  expect(await screen.findByText(/Replan · Mezo/)).toBeInTheDocument()
})
test('opens the LogMealSheet from the ＋ Log entry', async () => {
  renderView()
  fireEvent.click(screen.getByRole('button', { name: /log/i }))
  expect(await screen.findByText('Mit ettél?')).toBeInTheDocument()
})
test('clicking a slot AI chip opens the AI log sheet on that slot (mezo-53su)', async () => {
  hoisted.injectOpenSlot = true // give the fully-logged mock day one open meal/snack slot
  renderView()
  // An open meal/snack slot with a slotKey carries a per-slot "AI" chip beside Logolás.
  const aiChips = screen.getAllByRole('button', { name: /AI-logolása/ })
  expect(aiChips.length).toBeGreaterThan(0)
  await userEvent.click(aiChips[0])
  expect(await screen.findByRole('dialog', { name: 'AI ételnapló' })).toBeInTheDocument()
})
test('logs water via the +250/+500 slot buttons', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: 'Víz +250 ml' }))
  await userEvent.click(screen.getByRole('button', { name: 'Víz +500 ml' }))
  // Mock mode increments consumed.water in place — the slot's own text reflects the new total.
  await waitFor(() => expect(screen.getByText(/Víz · \d+ \/ \d+ ml/)).toBeInTheDocument())
})
test('real mode: fuelchips show schedule-derived values (kitchen close, coffee cutoff)', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  // Pin a Sunday (Vas) — a rest day in the default fixtures (gym is Csü, volleyball
  // Hét–Pén) — so no training block snaps the Vacsora main off kitchenClose, making
  // the window-anchor assertion deterministic. Fake ONLY Date so findBy keeps polling.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-07-05T10:00:00'))
  try {
    renderView()
    await screen.findByRole('heading', { name: 'Mai pacing' })
    // Derived from the SLEEP goal's wake/bed anchor (mezo-dbsr) — the default MSW
    // /api/sleep/goal resolves to 06:45/23:15, so kitchen close = bed(23:15) − 90m =
    // 21:45 (findByText waits out the sleep-goal fetch); caffeine cutoff pinned 14:00.
    expect(screen.getByText(/kávé cutoff 14:00/)).toBeInTheDocument()
    expect(await screen.findByText(/konyha zár 21:45/)).toBeInTheDocument()
    expect(screen.getAllByText('21:45').length).toBeGreaterThanOrEqual(1) // the Vacsora window snaps to kitchenClose
  } finally {
    vi.useRealTimers()
  }
})
test('real mode: the timeline workout block reads the schedule-derived type, not a stale label', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  // Pin a Thursday (Csü) so the meso fixture's only gym day is "today"; fake ONLY Date so
  // findBy's real timers keep polling.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-07-02T16:30:00'))
  try {
    // Override the active meso so today's (Csü) gym day carries a DISTINCT type ('Push') — this
    // discriminates the schedule-derived plan.workout.type from the frozen mock seed ('Pull Day').
    server.use(
      http.get(`${API_BASE}/api/train/mesocycles`, () =>
        HttpResponse.json([
          {
            id: 'b6f3a0e2-0000-4000-8000-000000000001',
            title: 'Hypertrophy 04 · Tavasz', shortTitle: 'Hypertrophy 04', status: 'active',
            goal: 'Felsőtest hypertrophy', startDate: '2026-05-01', endDate: '2026-06-12',
            weeks: 6, currentWeek: 3, split: 'Pull / Push / Legs · 5×/hét', style: 'RP · 6 hét',
            phaseCurve: ['MEV', 'MEV', 'MAV', 'MAV', 'MRV', 'Deload'], volumePerMuscle: {},
            days: [
              {
                id: 'a1f3a0e2-0000-4000-8000-000000000010',
                day: 'Csü', type: 'Push', muscle: 'chest+tri', exerciseCount: 1, current: true,
                exercises: [
                  { id: 'c1f3a0e2-0000-4000-8000-000000000002', name: 'Bench Press', muscle: 'chest', sets: 4, targetReps: '8-10', targetRIR: 1, type: 'compound' },
                ],
              },
            ],
          },
        ]),
      ),
    )
    renderView()
    // The gym block now surfaces as the timeline's workout slot (gym/vb context strip retired,
    // mezo-8141) — its title carries the schedule-derived type, not the frozen mock's 'Pull Day'.
    await screen.findByText('Push')
    expect(screen.queryByText('Pull Day')).not.toBeInTheDocument()
  } finally {
    vi.useRealTimers()
  }
})
