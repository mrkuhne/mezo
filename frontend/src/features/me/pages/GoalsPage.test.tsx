import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { GoalsPage } from '@/features/me/pages/GoalsPage'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'

// The `+ Új cél` entries route via useNavigate; mock it so we can assert the
// hard-gate decision (navigate to the wizard vs. open the gate interstitial)
// without a full route tree.
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

// GoalsPage's `+ Új cél` entry uses useNavigate, so it needs router context.
function Wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryWrapper>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryWrapper>
  )
}

// A complete biometric profile (the gate's pass condition).
const COMPLETE_PROFILE = {
  sex: 'M',
  heightCm: 180,
  birthDate: '1991-03-01',
  bodyFatPct: 15,
  activityLevel: 'MODERATE',
  tdeeBootstrap: null,
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
    render(<GoalsPage />, { wrapper: Wrapper })
    expect(screen.getByRole('heading', { level: 1, name: /Hosszú cél/ })).toBeInTheDocument()
    expect(screen.getByText('Fogyás · aktív')).toBeInTheDocument()
    expect(screen.getAllByText('78.6').length).toBeGreaterThan(0) // current weight
    expect(screen.getByText(/Egészséges erő/)).toBeInTheDocument() // identityFrame
    expect(screen.queryByText('7 nap')).not.toBeInTheDocument() // trend cells moved to /me/weight
  })

  // Napiv re-skin (Task 5, mezo-8141): own header is `.pghead-np lav` (over "Me ·
  // Cél" / h1 "Hosszú cél"), the "Új cél" chip is a `.pgact-np np-press` pill, and
  // the hero's weight progress reuses the shared `.track/.fill/.dot/.track-l`
  // vocabulary (Task 3) instead of a bespoke bar.
  test('own header: pghead-np lav over + h1 + pgact-np action chip', () => {
    const { container } = render(<GoalsPage />, { wrapper: Wrapper })
    expect(container.querySelector('.pghead-np.lav')).toBeInTheDocument()
    expect(screen.getByText('Me · Cél')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Hosszú cél' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Új cél/ })).toHaveClass('pgact-np', 'np-press')
  })

  test('hero reuses the shared .track/.fill/.dot/.track-l progress vocabulary', () => {
    const { container } = render(<GoalsPage />, { wrapper: Wrapper })
    expect(container.querySelector('.track .fill')).toBeInTheDocument()
    expect(container.querySelector('.track .dot')).toBeInTheDocument()
    expect(container.querySelector('.track-l')).toBeInTheDocument()
  })

  test('renders the timeline lane (not the old linked-meso cards)', () => {
    render(<GoalsPage />, { wrapper: Wrapper })
    // The GoalTimeline gym lane + a positioned plan bar replace the old cards.
    expect(screen.getByText('Gym · meso')).toBeInTheDocument()
    expect(screen.getByText(/Hypertrophy 04 · 6 hét/)).toBeInTheDocument()
    // The old "Cél alatt fut · N meso" card-section header is gone.
    expect(screen.queryByText(/Cél alatt fut · \d+ meso/)).not.toBeInTheDocument()
    // The G5 placeholder is gone — the real recept card renders instead.
    expect(screen.queryByText('G5 · hamarosan')).not.toBeInTheDocument()
  })

  test('renders the static G5 recept card (verdict + segments + guard pills)', () => {
    render(<GoalsPage />, { wrapper: Wrapper })
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
    render(<GoalsPage />, { wrapper: Wrapper })
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
    render(<GoalsPage />, { wrapper: Wrapper })
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
    render(<GoalsPage />, { wrapper: Wrapper })
    const cta = await screen.findByRole('button', { name: /Értékeld a célt/ })
    await userEvent.click(cta)
    await waitFor(() => expect(calls).toEqual(['evaluate']))
    // after the invalidation refetch serves the same goal (still no rx in this stub),
    // but the POST was made — that's the contract this test guards.
  })

  // Maintain-trajectory goal (review fix, Task 5): no targetWeightKg → toGoal falls
  // back targetWeight = startWeight → totalRange = 0. The hero must mirror
  // GoalMiniCard's guard: render WITHOUT the shared .track (a zero-range track is
  // meaningless) and leak no NaN/Infinity into the DOM.
  test('maintain goal (zero range) renders the hero without the .track and without NaN', async () => {
    const { targetWeightKg: _omit, ...rest } = GOAL
    const MAINTAIN_GOAL = { ...rest, trajectory: 'maintain' }
    server.use(
      http.get(`${API_BASE}/api/goals`, () => HttpResponse.json([MAINTAIN_GOAL])),
      http.get(`${API_BASE}/api/biometrics/weight`, () => HttpResponse.json([])),
      http.get(`${API_BASE}/api/goals/g1/timeline`, () => HttpResponse.json(TIMELINE)),
    )
    const { container } = render(<GoalsPage />, { wrapper: Wrapper })
    expect(await screen.findByText('Nyári cut')).toBeInTheDocument() // hero rendered
    expect(container.querySelector('.track')).toBeNull()
    expect(container.querySelector('.track-l')).toBeNull()
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
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
    render(<GoalsPage />, { wrapper: Wrapper })
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
    render(<GoalsPage />, { wrapper: Wrapper })
    await userEvent.click(await screen.findByText('Nyári cut')) // open the hero sheet
    await userEvent.click(await screen.findByRole('button', { name: 'Törlés' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Biztosan törlöd?' }))
    // After delete + refetch, GoalsPage falls back to the empty "set up a goal" state.
    expect(await screen.findByText(/Még nincs aktív célod/)).toBeInTheDocument()
  })
})

// Loading skeleton (mezo-f2z) — real mode shows the GoalsSkeleton (role="status")
// while the active-goal query is unresolved (useGoal pending); mock seeds → no
// skeleton. The other GoalsPage queries (weight/trend/profile) resolve so ONLY the
// goal query stalls and forces the skeleton.
describe('GoalsPage (real mode, pending)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  it('shows the skeleton while the active-goal query is unresolved', async () => {
    server.use(
      http.get(`${API_BASE}/api/goals`, () => new Promise(() => {})), // never resolves
      http.get(`${API_BASE}/api/biometrics/weight`, () => HttpResponse.json([])),
      http.get(`${API_BASE}/api/biometrics/weight/trend`, () => HttpResponse.json([])),
      http.get(`${API_BASE}/api/biometrics/profile`, () => new HttpResponse(null, { status: 404 })),
    )
    render(<GoalsPage />, { wrapper: Wrapper })
    expect(await screen.findByRole('status')).toBeInTheDocument()
  })
})

describe('GoalsPage (mock mode, no skeleton)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  it('renders content with no skeleton (synchronous seed)', () => {
    render(<GoalsPage />, { wrapper: Wrapper })
    expect(screen.queryByRole('status')).toBeNull()
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
    render(<GoalsPage />, { wrapper: Wrapper })
    expect(await screen.findByText(/Még nincs aktív célod/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Új cél/ })).toBeInTheDocument()
    // the mock placeholder hero must NOT appear
    expect(screen.queryByText('Fogyás · Nyári forma')).not.toBeInTheDocument()
  })

  // Napiv re-skin (Task 5): the empty-state branch gets the same `.pghead-np lav`
  // header as the active-goal branch (binding rule — BOTH branches).
  test('empty state also gets the pghead-np lav own header', async () => {
    server.use(
      http.get(`${API_BASE}/api/goals`, () => HttpResponse.json([])),
      http.get(`${API_BASE}/api/biometrics/weight`, () => HttpResponse.json([])),
    )
    const { container } = render(<GoalsPage />, { wrapper: Wrapper })
    await screen.findByText(/Még nincs aktív célod/)
    expect(container.querySelector('.pghead-np.lav')).toBeInTheDocument()
    expect(screen.getByText('Me · Cél')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Hosszú cél' })).toBeInTheDocument()
  })
})

// Task 7: the "Új cél" hard gate — goal creation requires a complete biometric
// profile. Both entry points (empty-state CTA + header chip) route through the
// gate: complete → straight to the wizard; incomplete → the gate interstitial
// that opens the BiometricSheet, then continues to the wizard once complete.
describe('Új cél hard gate (incomplete biometric profile)', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    mockNavigate.mockClear()
  })
  afterEach(() => vi.unstubAllEnvs())

  function noProfile() {
    // 404 = no biometric profile yet → isComplete = false.
    server.use(
      http.get(`${API_BASE}/api/biometrics/profile`, () => new HttpResponse(null, { status: 404 })),
    )
  }

  test('empty-state CTA with no profile shows the gate, NOT the wizard', async () => {
    noProfile()
    server.use(
      http.get(`${API_BASE}/api/goals`, () => HttpResponse.json([])),
      http.get(`${API_BASE}/api/biometrics/weight`, () => HttpResponse.json([])),
    )
    render(<GoalsPage />, { wrapper: Wrapper })
    await userEvent.click(await screen.findByRole('button', { name: /Új cél/ }))
    expect(await screen.findByText(/Előbb: a/)).toBeInTheDocument()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  test('header chip with no profile shows the gate with missing-field chips', async () => {
    noProfile()
    useGoalHandlers()
    render(<GoalsPage />, { wrapper: Wrapper })
    // Let the active-goal hero (and its header chip) render first.
    await screen.findByText('Nyári cut')
    await userEvent.click(screen.getByRole('button', { name: /Új cél/ }))
    expect(await screen.findByText(/Előbb: a/)).toBeInTheDocument()
    // all three required fields are missing → three warning chips.
    expect(screen.getByText('⚠ hiányzik: nem')).toBeInTheDocument()
    expect(screen.getByText('magasság', { selector: 'span.chip' })).toBeInTheDocument()
    expect(screen.getByText('szül.dátum', { selector: 'span.chip' })).toBeInTheDocument()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  test('the gate CTA opens the BiometricSheet; saving a complete profile continues to the wizard', async () => {
    // Stateful profile: 404 until the PUT lands, then a complete profile.
    let filled = false
    server.use(
      http.get(`${API_BASE}/api/goals`, () => HttpResponse.json([])),
      http.get(`${API_BASE}/api/biometrics/weight`, () => HttpResponse.json([])),
      http.get(`${API_BASE}/api/biometrics/profile`, () =>
        filled ? HttpResponse.json(COMPLETE_PROFILE) : new HttpResponse(null, { status: 404 }),
      ),
      http.put(`${API_BASE}/api/biometrics/profile`, async ({ request }) => {
        filled = true
        const body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ ...body, tdeeBootstrap: null })
      }),
    )
    render(<GoalsPage />, { wrapper: Wrapper })
    await userEvent.click(await screen.findByRole('button', { name: /Új cél/ }))
    // gate interstitial → CTA opens the editor sheet.
    await userEvent.click(await screen.findByRole('button', { name: /Biometria beállítása/ }))
    expect(await screen.findByText('A motor ebből számol')).toBeInTheDocument()
    // save the (default-complete) profile → now complete → continue to the wizard.
    await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/me/goals/new'))
  })
})

describe('Új cél hard gate (complete biometric profile)', () => {
  afterEach(() => vi.unstubAllEnvs())

  test('real mode: tapping Új cél navigates straight to the wizard, no gate', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    mockNavigate.mockClear()
    server.use(
      http.get(`${API_BASE}/api/goals`, () => HttpResponse.json([])),
      http.get(`${API_BASE}/api/biometrics/weight`, () => HttpResponse.json([])),
      http.get(`${API_BASE}/api/biometrics/profile`, () => HttpResponse.json(COMPLETE_PROFILE)),
    )
    render(<GoalsPage />, { wrapper: Wrapper })
    await userEvent.click(await screen.findByRole('button', { name: /Új cél/ }))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/me/goals/new'))
    expect(screen.queryByText(/Előbb: a/)).not.toBeInTheDocument()
  })

  test('mock mode: tapping Új cél navigates straight to the wizard (static complete profile)', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    mockNavigate.mockClear()
    render(<GoalsPage />, { wrapper: Wrapper })
    // header chip (mock mode renders the active-goal hero with the chip).
    await userEvent.click(screen.getByRole('button', { name: /Új cél/ }))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/me/goals/new'))
    expect(screen.queryByText(/Előbb: a/)).not.toBeInTheDocument()
  })
})
