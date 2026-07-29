import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import type { FuelSlot } from '@/data/types'
import { FuelMaiPage } from '@/features/fuel/pages/FuelMaiPage'
import { medicationSeed } from '@/data/fuel/medication'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'

// The mock demo day (fixed now 13:30) is a PARTIAL day (mezo-1oy5): breakfast + lunch logged, the
// midday/evening windows open (now/pending). To page-test the slot-level AI chip (mezo-53su)
// deterministically we still inject one known open meal/snack slot (slotKey set) into the composed
// timeline; default off, so every other test sees the unmodified real timeline. Idiom mirrors
// AiLogSheet.test's hoisted single-hook override.
// (The seed's two logged meals now carry a real weighted score off their own breakdown — mezo-rrtj
// fix-wave item 10 — so the score-backfill test seam this mock used to carry is gone.)
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
// Phase-1 seed (consumed 1300 — breakfast+lunch logged, scored meals with breakdowns) and provide a QueryClientProvider.
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => { vi.unstubAllEnvs(); hoisted.injectOpenSlot = false })

const renderView = () =>
  render(
    <QueryWrapper>
      <MemoryRouter><FuelMaiPage /></MemoryRouter>
    </QueryWrapper>,
  )

test('renders the one-line header, the hero, the day-status card and the zones', () => {
  const { container } = renderView()
  expect(screen.getByRole('heading', { name: 'A mai nap' })).toBeInTheDocument()
  expect(container.querySelector('.retamicro')).toBeInTheDocument()
  // Hero — the mock day (fixed now 13:30) has an open window.
  expect(container.querySelector('.nowcard')).toBeInTheDocument()
  // Day status — remaining kcal + the four named macro rows (water is the 4th).
  expect(container.querySelector('.daybudget')).toBeInTheDocument()
  expect(container.querySelectorAll('.mac')).toHaveLength(4)
  expect(screen.getByText('Fehérje')).toBeInTheDocument()
  expect(screen.getByText('Szénhidrát')).toBeInTheDocument()
  expect(screen.getByText('Zsír')).toBeInTheDocument()
  expect(screen.getByText('Víz')).toBeInTheDocument()
  // Zones replace the flat timeline.
  expect(container.querySelectorAll('.zcard').length).toBeGreaterThan(1)
  // Kitchen close / coffee cutoff kept their real data, now at the end of the day.
  expect(screen.getByText(/Konyha zár/)).toBeInTheDocument()
  expect(screen.getByText(/kávé cutoff/)).toBeInTheDocument()
})

// ── Reta phase strip derived from the medication cycle (fix wave item 1) ─────────────────────
test('the Reta phase strip derives its cells + current marker from the medication cycle', () => {
  const { container } = renderView()
  const cells = Array.from(container.querySelectorAll('.retamicro i'))
  const phaseCls: Record<string, string> = { peak: 'pk', stable: 'stb', trough: 'tr' }
  // mock cycle.week (medication.ts): D1-2 peak, D3-5 stable (D3 current), D6-7 trough — this must
  // read the medication cycle's OWN phaseKey/current, never a page-local re-hardcoded phase model.
  expect(cells).toHaveLength(medicationSeed.cycle.week.length)
  expect(cells.map(c => c.className)).toEqual(
    medicationSeed.cycle.week.map(cell => {
      const cls = phaseCls[cell.phaseKey] ?? ''
      return cell.current ? `${cls} cur` : cls
    }),
  )
})

test('renders no Reta phase strip when there is no medication cycle yet (real-mode ghost)', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(
    http.get(`${API_BASE}/api/medication`, () =>
      HttpResponse.json({
        medication: {
          id: '', name: '', activeIngredient: '', route: '', cadence: '',
          defaultDose: 0, doseUnit: '', active: false, cycle: { cycleLengthDays: 0, phases: [] },
        },
        cycle: { retaDay: 0, phaseKey: '', phaseLabel: '', lastDoseAt: null, week: [] },
        recentDoses: [],
      }),
    ),
  )
  const { container } = renderView()
  await screen.findByRole('heading', { name: 'A mai nap' })
  expect(container.querySelector('.retamicro')).toBeNull()
})

test('the two static-seed surfaces are gone — no fabricated prose, no fake weekly micros', () => {
  renderView()
  expect(screen.queryByText('Mikrotápanyagok · heti')).toBeNull()
  expect(screen.queryByText(/tegnapi átlag ebben az időben/)).toBeNull()
})

test('the daily target is stated ONCE, and as the remaining kcal', () => {
  const { container } = renderView()
  expect(container.querySelector('.gauge')).toBeNull()
  expect(screen.queryByText(/Mai cél/)).toBeNull()
  expect(screen.getByText(/kcal hátra/)).toBeInTheDocument()
})

test('the energy breakdown chips explain where the target comes from', async () => {
  renderView()
  expect(screen.getByText(/honnan a/i)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /Mozgás/ }))
  expect(screen.getByText(/Honnan jön/)).toBeInTheDocument()
})

// Carried over verbatim from the current file — the chip moved into the kitchen-close row but its
// aria-label and the sheet it opens are unchanged.
test('opens the FuelSettingsSheet from the szerkeszt chip', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: 'Fuel beállítások' }))
  expect(await screen.findByRole('dialog', { name: 'Fuel beállítások' })).toBeInTheDocument()
})

test('the hero primary CTA is slot-scoped and does not collide with the header log chip', async () => {
  renderView()
  // The header chip keeps the bare `Logolás` label; the hero uses `{label} logolása`.
  expect(screen.getByRole('button', { name: 'Logolás' })).toBeInTheDocument()
  expect(screen.getAllByRole('button', { name: /logolása$/ }).length).toBeGreaterThan(0)
})

test('opens the LogMealSheet from the ＋ Log entry', async () => {
  renderView()
  fireEvent.click(screen.getByRole('button', { name: 'Logolás' }))
  expect(await screen.findByText('Mit ettél?')).toBeInTheDocument()
})

test('logs water via the +250/+500 quick-add on the water macro row', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: 'Víz +250 ml' }))
  await userEvent.click(screen.getByRole('button', { name: 'Víz +500 ml' }))
  await waitFor(() => expect(screen.getByText(/\/ 4000 ml/)).toBeInTheDocument())
})

// ── Carried over from the retired flat-timeline page (adapted queries only) ─────────────────────

test('shows the protocol-meta row when a protocol is active (mock, v3)', () => {
  renderView()
  expect(screen.getByText(/Stack · v3/)).toBeInTheDocument()
})

test('hides the protocol-meta row when there is no active protocol (real-mode ghost v0)', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  renderView()
  await screen.findByRole('heading', { name: 'A mai nap' })
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

test('Replan button opens the replan sheet', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: 'Replan' }))
  expect(await screen.findByText(/Replan · Mezo/)).toBeInTheDocument()
})

test('opening a meal score sheet then closing it', async () => {
  renderView()
  await userEvent.click(screen.getAllByRole('button', { name: 'AI score' })[0])
  expect(await screen.findByText('Súlyozott bontás')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Bezárás' }))
  await waitFor(() => expect(screen.queryByText('Súlyozott bontás')).not.toBeInTheDocument())
})

test('clicking a slot AI chip opens the AI log sheet on that slot (mezo-53su)', async () => {
  hoisted.injectOpenSlot = true // inject a KNOWN open meal/snack slot (deterministic across weekdays)
  renderView()
  // Query the injected slot's OWN aria-label — the hero's ✨ button ALSO matches /AI-logolása/ and
  // renders first, so `getAllByRole(...)[0]` silently tests the hero instead of the slot-level chip
  // this test exists to protect (fix wave item 2).
  await userEvent.click(screen.getByRole('button', { name: 'Esti snack AI-logolása' }))
  expect(await screen.findByRole('dialog', { name: 'AI ételnapló' })).toBeInTheDocument()
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
    await screen.findByRole('heading', { name: 'A mai nap' })
    // Derived from the SLEEP goal's wake/bed anchor (mezo-dbsr) — the default MSW
    // /api/sleep/goal resolves to 06:45/23:15, so kitchen close = bed(23:15) − 90m =
    // 21:45 (findByText waits out the sleep-goal fetch); caffeine cutoff pinned 14:00.
    expect(screen.getByText(/kávé cutoff 14:00/)).toBeInTheDocument()
    expect(await screen.findByText(/Konyha zár · 21:45/)).toBeInTheDocument()
    expect(screen.getAllByText('21:45').length).toBeGreaterThanOrEqual(1) // the Vacsora window snaps to kitchenClose
  } finally {
    vi.useRealTimers()
  }
})

test('real mode: the zone workout row reads the schedule-derived type, not a stale label', async () => {
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
    // The gym block surfaces as a zone's activity row (ZoneSlotRow) — its title carries the
    // schedule-derived type, not the frozen mock's 'Pull Day'.
    await screen.findByText('Push')
    expect(screen.queryByText('Pull Day')).not.toBeInTheDocument()
  } finally {
    vi.useRealTimers()
  }
})
