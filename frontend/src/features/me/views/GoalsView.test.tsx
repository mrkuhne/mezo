import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { GoalsView } from './GoalsView'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'

// GoalsView's `+ Új cél` entry uses useNavigate, so it needs router context.
function Wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryWrapper>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryWrapper>
  )
}

// A real-mode active goal + a timeline with a gym link, a run link and a gap —
// enough to drive every GoalTimeline lane.
const GOAL = {
  id: 'g1',
  title: 'Nyári cut',
  trajectory: 'cut',
  guards: ['strength', 'muscle'],
  status: 'active',
  startDate: '2026-06-01',
  targetDate: '2026-07-27',
  startWeightKg: 84.2,
  targetWeightKg: 80,
  rateTargetPctPerWeek: 0.7,
  identityFrame: 'Erős és könnyű.',
}
const TIMELINE = {
  goalId: 'g1',
  weeks: 8,
  links: [
    { id: 'link-1', planType: 'mesocycle', planId: 'meso-1', startWeek: 1, endWeek: 6, plan: { title: 'Hypertrophy 04', status: 'active', startDate: '2026-06-01', endDate: '2026-07-13', weeks: 6 } },
    { id: 'link-2', planType: 'running_block', planId: 'run-1', startWeek: 1, endWeek: 4, plan: { title: 'Base Build', status: 'active', startDate: '2026-06-01', endDate: '2026-06-29', weeks: 4 } },
  ],
  gaps: [{ fromWeek: 7, toWeek: 8 }],
}

// A real-mode goal that already carries an engine prescription (G5) — drives the
// recept card in real mode.
const PRESCRIPTION = {
  generatedAt: '2026-06-10T06:00:00Z',
  basis: 'formula',
  segments: [
    { fromWeek: 1, toWeek: 6, label: 'Deficit blokk', kcal: 2200, proteinG: 168, sleepTargetH: 7.5, restDays: [3, 7], projectedRateKgPerWk: -0.5, rationale: 'Deficit a gym blokk alatt.' },
    { fromWeek: 7, toWeek: 8, label: 'Befutó', kcal: 2400, proteinG: 160, sleepTargetH: 8, restDays: [4, 7], projectedRateKgPerWk: -0.3, rationale: 'Lassítunk a végén.' },
  ],
  guardStatus: {
    strength: { active: true, e1rmTrendPct: 0.8, breached: false, notes: [] },
    muscle: { active: true, minWeeklySetsPerMuscle: 8, belowMaintenanceMuscles: [], rateWithinCap: true, proteinMonitored: false, notes: [] },
  },
  feasibility: { verdict: 'feasible', notes: [] },
}
const GOAL_WITH_RX = { ...GOAL, prescription: PRESCRIPTION }

function useGoalHandlers() {
  server.use(
    http.get(`${API_BASE}/api/goals`, () => HttpResponse.json([GOAL])),
    http.get(`${API_BASE}/api/biometrics/weight`, () => HttpResponse.json([])),
    http.get(`${API_BASE}/api/goals/g1/timeline`, () => HttpResponse.json(TIMELINE)),
  )
}

// The hero tests assert Phase-1 mock goal data, so pin mock mode explicitly.
describe('mock mode (demo goal)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('renders the goal hero, weights and identity frame', () => {
    render(<GoalsView />, { wrapper: Wrapper })
    expect(screen.getByRole('heading', { level: 1, name: /Hosszú cél/ })).toBeInTheDocument()
    expect(screen.getByText('Fogyás · aktív')).toBeInTheDocument()
    expect(screen.getAllByText('78.6').length).toBeGreaterThan(0) // current weight
    expect(screen.getByText(/Egészséges erő/)).toBeInTheDocument() // identityFrame
    expect(screen.queryByText('7 nap')).not.toBeInTheDocument() // trend cells moved to /me/weight
  })

  test('renders the factors section with tool chips', () => {
    render(<GoalsView />, { wrapper: Wrapper })
    expect(screen.getByText('Reta D3-D5 alacsony étvágy')).toBeInTheDocument()
    expect(screen.getByText(/get_weight_log/)).toBeInTheDocument()
  })

  test('renders the timeline lane (not the old linked-meso cards)', () => {
    render(<GoalsView />, { wrapper: Wrapper })
    // The GoalTimeline gym lane + a positioned plan bar replace the old cards.
    expect(screen.getByText('Gym · meso')).toBeInTheDocument()
    expect(screen.getByText(/Hypertrophy 04 · 6 hét/)).toBeInTheDocument()
    // The old "Cél alatt fut · N meso" card-section header is gone.
    expect(screen.queryByText(/Cél alatt fut · \d+ meso/)).not.toBeInTheDocument()
    // The G5 placeholder is gone — the real recept card renders instead.
    expect(screen.queryByText('G5 · hamarosan')).not.toBeInTheDocument()
  })

  test('renders the static G5 recept card (verdict + segments + guard pills)', () => {
    render(<GoalsView />, { wrapper: Wrapper })
    // Feasibility verdict from the mock prescription (feasible-with-warnings).
    expect(screen.getByText('Reális, figyelmeztetésekkel')).toBeInTheDocument()
    // Both mock segments render with their labels + kcal.
    expect(screen.getByText('Mély deficit · Reta cycle')).toBeInTheDocument()
    expect(screen.getByText('Lassú befutó · taper')).toBeInTheDocument()
    expect(screen.getByText(/2150/)).toBeInTheDocument()
    expect(screen.getByText(/163/)).toBeInTheDocument()
    // Guard pills: strength e1RM trend + muscle sets + protein "Fuel-re vár".
    // ("e1RM" appears in both the pill and the strength note in the mock rx.)
    expect(screen.getAllByText(/e1RM/).length).toBeGreaterThan(0)
    expect(screen.getByText(/Fuel-re vár/)).toBeInTheDocument()
    expect(screen.getByText(/8 szett/)).toBeInTheDocument()
  })
})

describe('real mode (active goal + timeline)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('renders the GoalTimeline lane with bars and gap', async () => {
    useGoalHandlers()
    render(<GoalsView />, { wrapper: Wrapper })
    // Hero reads the raw contract (trajectory label + guard pills + window).
    expect(await screen.findByText('Fogyás · aktív')).toBeInTheDocument()
    expect(screen.getByText('Erő-gard')).toBeInTheDocument()
    // The timeline lanes render the linked plans + the uncovered-week gap chip.
    expect(await screen.findByText(/Hypertrophy 04 · 6 hét/)).toBeInTheDocument()
    expect(screen.getByText(/Base Build · 4 hét/)).toBeInTheDocument()
    expect(screen.getByText(/W7–8 fedezetlen/)).toBeInTheDocument()
    expect(screen.getByTestId('ruler-week-8')).toBeInTheDocument()
  })

  test('renders the recept card from a goal that already carries a prescription', async () => {
    server.use(
      http.get(`${API_BASE}/api/goals`, () => HttpResponse.json([GOAL_WITH_RX])),
      http.get(`${API_BASE}/api/biometrics/weight`, () => HttpResponse.json([])),
      http.get(`${API_BASE}/api/goals/g1/timeline`, () => HttpResponse.json(TIMELINE)),
    )
    render(<GoalsView />, { wrapper: Wrapper })
    expect(await screen.findByText('Reális')).toBeInTheDocument() // feasible verdict
    expect(screen.getByText('Deficit blokk')).toBeInTheDocument()
    expect(screen.getByText('Befutó')).toBeInTheDocument()
    expect(screen.getByText(/2200/)).toBeInTheDocument()
    expect(screen.getByText(/168/)).toBeInTheDocument()
    // no evaluate CTA when a prescription is already present
    expect(screen.queryByRole('button', { name: /Értékeld a célt/ })).not.toBeInTheDocument()
  })

  test('null prescription → the "Értékeld a célt" CTA evaluates the goal (POST /evaluate)', async () => {
    const calls: string[] = []
    server.use(
      http.get(`${API_BASE}/api/goals`, () => HttpResponse.json([GOAL])), // GOAL has no prescription
      http.get(`${API_BASE}/api/biometrics/weight`, () => HttpResponse.json([])),
      http.get(`${API_BASE}/api/goals/g1/timeline`, () => HttpResponse.json(TIMELINE)),
      http.post(`${API_BASE}/api/goals/g1/evaluate`, () => {
        calls.push('evaluate')
        return HttpResponse.json(GOAL_WITH_RX)
      }),
    )
    render(<GoalsView />, { wrapper: Wrapper })
    const cta = await screen.findByRole('button', { name: /Értékeld a célt/ })
    await userEvent.click(cta)
    await waitFor(() => expect(calls).toEqual(['evaluate']))
    // after the invalidation refetch serves the same goal (still no rx in this stub),
    // but the POST was made — that's the contract this test guards.
  })

  test('the manage sheet Archiválás archives the goal, then closes', async () => {
    useGoalHandlers()
    const calls: string[] = []
    server.use(
      http.post(`${API_BASE}/api/goals/g1/archive`, () => {
        calls.push('archive')
        return HttpResponse.json({ ...GOAL, status: 'archived' })
      }),
    )
    render(<GoalsView />, { wrapper: Wrapper })
    await userEvent.click(await screen.findByText('Nyári cut')) // open the hero sheet
    await userEvent.click(await screen.findByRole('button', { name: 'Archiválás' }))
    await waitFor(() => expect(calls).toEqual(['archive']))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Archiválás' })).not.toBeInTheDocument())
  })

  test('the manage sheet Törlés removes the goal (through confirm) → empty state appears', async () => {
    // First /api/goals call returns the goal; after a successful delete the
    // invalidation refetches and we serve an empty list → empty-state CTA shows.
    let removed = false
    server.use(
      http.get(`${API_BASE}/api/goals`, () => HttpResponse.json(removed ? [] : [GOAL])),
      http.get(`${API_BASE}/api/biometrics/weight`, () => HttpResponse.json([])),
      http.get(`${API_BASE}/api/goals/g1/timeline`, () => HttpResponse.json(TIMELINE)),
      http.delete(`${API_BASE}/api/goals/g1`, () => { removed = true; return new HttpResponse(null, { status: 204 }) }),
    )
    render(<GoalsView />, { wrapper: Wrapper })
    await userEvent.click(await screen.findByText('Nyári cut')) // open the hero sheet
    await userEvent.click(await screen.findByRole('button', { name: 'Törlés' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Biztosan törlöd?' }))
    // After delete + refetch, GoalsView falls back to the empty "set up a goal" state.
    expect(await screen.findByText(/Még nincs aktív célod/)).toBeInTheDocument()
  })
})

// Real mode with no active goal: the empty "set up a goal" state + CTA, never
// the mock placeholder hero.
describe('real mode (no goal)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('shows the empty-state setup CTA, not the mock placeholder', async () => {
    server.use(
      http.get(`${API_BASE}/api/goals`, () => HttpResponse.json([])),
      http.get(`${API_BASE}/api/biometrics/weight`, () => HttpResponse.json([])),
    )
    render(<GoalsView />, { wrapper: Wrapper })
    expect(await screen.findByText(/Még nincs aktív célod/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Új cél/ })).toBeInTheDocument()
    // the mock placeholder hero must NOT appear
    expect(screen.queryByText('Fogyás · Nyári forma')).not.toBeInTheDocument()
  })
})
