import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { FuelMaiPage } from '@/features/fuel/pages/FuelMaiPage'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'

// FuelMaiPage reads the composed dual-mode useFuelDay (mezo-arb); pin mock mode for the static
// Phase-1 seed (consumed 1840, scored meals with breakdowns) and provide a QueryClientProvider.
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

const renderView = () =>
  render(
    <QueryWrapper>
      <MemoryRouter><FuelMaiPage /></MemoryRouter>
    </QueryWrapper>,
  )

test('renders header, macro hero, timeline and micronutrients', () => {
  renderView()
  expect(screen.getByRole('heading', { name: 'Pacing' })).toBeInTheDocument()
  expect(screen.getByText(/1840/)).toBeInTheDocument()
  expect(screen.getByText('Mikrotápanyagok · heti')).toBeInTheDocument()
})
test('shows the protocol-meta row when a protocol is active (mock, v3)', () => {
  renderView()
  expect(screen.getByText(/Stack · v3/)).toBeInTheDocument()
})
test('hides the protocol-meta row when there is no active protocol (real-mode ghost v0)', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  renderView()
  await screen.findByRole('heading', { name: 'Pacing' })
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
  await userEvent.click(screen.getAllByRole('button', { name: /AI/ })[0])
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
test('real mode: the context strip shows schedule-derived values (kitchen close, coffee cutoff)', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  renderView()
  await screen.findByRole('heading', { name: 'Pacing' })
  // Derived from the default wake/bed rhythm: kitchen close = bed(23:00) − 90m = 21:30,
  // caffeine cutoff pinned 14:00 (both are planner-composed, not the frozen mock plan).
  expect(screen.getByText('Kitchen')).toBeInTheDocument()
  expect(screen.getByText('Coffee')).toBeInTheDocument()
  expect(screen.getAllByText('21:30').length).toBeGreaterThanOrEqual(1) // Kitchen-close cell (+ the Vacsora window snaps here)
  expect(screen.getByText('14:00')).toBeInTheDocument()                 // Coffee-cutoff cell
})
test('real mode: the gym context cell reads the schedule-derived workout type, not the mock seed', async () => {
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
    // Scope to the context strip (its unique 'Coffee' cell anchors the card) so we assert on the
    // gym cell label — not the timeline's workout block, which also carries the type.
    const strip = (await screen.findByText('Coffee')).closest('.card') as HTMLElement
    await within(strip).findByText('Push')                            // schedule-derived type surfaced
    expect(within(strip).queryByText('Pull Day')).not.toBeInTheDocument() // frozen mock label gone
  } finally {
    vi.useRealTimers()
  }
})
