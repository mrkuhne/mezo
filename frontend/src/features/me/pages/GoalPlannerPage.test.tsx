import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, test, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { GoalPlannerPage } from '@/features/me/pages/GoalPlannerPage'

// The route-level biometric gate (G6, mezo-06n — review fix) renders the wizard
// only once useBiometricProfile() resolves a COMPLETE profile (the default MSW
// handler + the mock-mode static profile are both complete). So tests that drive
// the wizard must first wait for its step-0 heading to mount.
const waitForWizard = () => waitFor(() => expect(screen.getByText('Mit építünk?')).toBeInTheDocument())

test('GoalPlannerPage step 0 picks a trajectory and a guard', async () => {
  render(
    <QueryWrapper>
      <MemoryRouter>
        <GoalPlannerPage />
      </MemoryRouter>
    </QueryWrapper>,
  )
  await waitForWizard()
  // Tovább is disabled until a trajectory is picked
  expect(screen.getByRole('button', { name: /tovább/i })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: /fogyás/i }))
  fireEvent.click(screen.getByRole('button', { name: /erő megtartása/i }))
  // Tovább becomes enabled once a trajectory is picked
  expect(screen.getByRole('button', { name: /tovább/i })).toBeEnabled()
})

test('GoalPlannerPage is a 2-step wizard (no third step) ending on the cél step', async () => {
  render(
    <QueryWrapper>
      <MemoryRouter>
        <GoalPlannerPage />
      </MemoryRouter>
    </QueryWrapper>,
  )
  await waitForWizard()
  // The step indicator reads "01 / 02" — STEP_COUNT is 2, not 3.
  expect(screen.getByText('01 / 02')).toBeInTheDocument()
  // Exactly 2 step-progress segments are rendered.
  expect(screen.getAllByRole('button', { name: /\d+\. lépés/ })).toHaveLength(2)
  // Advance to the (final) cél step.
  fireEvent.click(screen.getByRole('button', { name: /fogyás/i }))
  fireEvent.click(screen.getByRole('button', { name: /tovább/i }))
  expect(screen.getByText('02 / 02')).toBeInTheDocument()
  // The final step is the save step — no "Tovább", the create CTAs instead.
  expect(screen.queryByRole('button', { name: /tovább/i })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: /létrehozása \+ aktiválás/i })).toBeInTheDocument()
})

test('GoalPlannerPage has no manual rate input and no biometric fields', async () => {
  render(
    <QueryWrapper>
      <MemoryRouter>
        <GoalPlannerPage />
      </MemoryRouter>
    </QueryWrapper>,
  )
  await waitForWizard()
  // Advance to the cél step where the rate input used to live.
  fireEvent.click(screen.getByRole('button', { name: /fogyás/i }))
  fireEvent.click(screen.getByRole('button', { name: /tovább/i }))
  // The cél step keeps title + dates + weights, but NO manual weekly-rate input.
  expect(screen.getByLabelText('Cél neve')).toBeInTheDocument()
  expect(screen.getByLabelText('Cél dátum')).toBeInTheDocument()
  expect(screen.queryByLabelText('Heti tempó')).not.toBeInTheDocument()
  // No biometric fields anywhere (moved to the Profile in G6).
  expect(screen.queryByLabelText('Testmagasság')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Születési dátum')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Testzsír')).not.toBeInTheDocument()
  expect(screen.queryByText('Aktivitási szint')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /^férfi$/i })).not.toBeInTheDocument()
})

test('GoalPlannerPage mock-mode cél step renders the static feasibility preview', async () => {
  // Force mock mode so this passes in both `pnpm test` (real default) and the
  // VITE_USE_MOCK=true run — the static preview comes from data/goals.ts, no MSW.
  vi.stubEnv('VITE_USE_MOCK', 'true')
  render(
    <QueryWrapper>
      <MemoryRouter>
        <GoalPlannerPage />
      </MemoryRouter>
    </QueryWrapper>,
  )
  await waitForWizard()
  fireEvent.click(screen.getByRole('button', { name: /fogyás/i }))
  fireEvent.click(screen.getByRole('button', { name: /tovább/i }))
  // The static mock preview (data/goals.ts) is feasible at 0,6 %BW/hét.
  await waitFor(() => expect(screen.getByText(/Reális/i)).toBeInTheDocument())
  expect(screen.getByText(/0,6/)).toBeInTheDocument()
  expect(screen.getByText(/%BW\s*\/\s*hét/i)).toBeInTheDocument()
  vi.unstubAllEnvs()
})

test('GoalPlannerPage real-mode cél step renders the derived rate + verdict from the preview', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(
    http.post(`${API_BASE}/api/goals/feasibility-preview`, () =>
      HttpResponse.json({
        derivedRatePctPerWeek: 0.6,
        withinSafeBand: true,
        verdict: 'feasible',
      }),
    ),
  )
  render(
    <QueryWrapper>
      <MemoryRouter>
        <GoalPlannerPage />
      </MemoryRouter>
    </QueryWrapper>,
  )
  await waitForWizard()
  fireEvent.click(screen.getByRole('button', { name: /fogyás/i }))
  fireEvent.click(screen.getByRole('button', { name: /tovább/i }))
  await waitFor(() => expect(screen.getByText(/✓\s*Reális/i)).toBeInTheDocument())
  expect(screen.getByText(/0,6/)).toBeInTheDocument()
  vi.unstubAllEnvs()
})

test('GoalPlannerPage real-mode aggressive preview offers a realistic date that re-previews on accept', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const bodies: Record<string, unknown>[] = []
  server.use(
    http.post(`${API_BASE}/api/goals/feasibility-preview`, async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>
      bodies.push(body)
      // The first (default-window) draft is over the cap → aggressive + a suggestion.
      // Once the date is bumped to the suggestion the window widens → feasible.
      if (body.targetDate === '2026-09-15') {
        return HttpResponse.json({ derivedRatePctPerWeek: 0.6, withinSafeBand: true, verdict: 'feasible' })
      }
      return HttpResponse.json({
        derivedRatePctPerWeek: 1.3,
        withinSafeBand: false,
        verdict: 'aggressive',
        suggestedTargetDate: '2026-09-15',
      })
    }),
  )
  render(
    <QueryWrapper>
      <MemoryRouter>
        <GoalPlannerPage />
      </MemoryRouter>
    </QueryWrapper>,
  )
  await waitForWizard()
  fireEvent.click(screen.getByRole('button', { name: /fogyás/i }))
  fireEvent.click(screen.getByRole('button', { name: /tovább/i }))
  // The aggressive panel + the accept action appear.
  await waitFor(() => expect(screen.getByText(/⚠\s*Agresszív/i)).toBeInTheDocument())
  const accept = screen.getByRole('button', { name: /Elfogadom/i })
  expect(accept).toBeInTheDocument()
  // The first preview body carries the correct draft fields.
  expect(bodies[0]).toMatchObject({ trajectory: 'cut', startWeightKg: 80, targetWeightKg: 80 })
  expect(typeof bodies[0].startDate).toBe('string')
  expect(typeof bodies[0].targetDate).toBe('string')

  // Accepting the suggestion sets the cél-dátum input + fires a fresh preview.
  fireEvent.click(accept)
  expect((screen.getByLabelText('Cél dátum') as HTMLInputElement).value).toBe('2026-09-15')
  await waitFor(() => expect(bodies.some(b => b.targetDate === '2026-09-15')).toBe(true))
  // The new preview flips the panel to feasible.
  await waitFor(() => expect(screen.getByText(/✓\s*Reális/i)).toBeInTheDocument())
  vi.unstubAllEnvs()
})

test('GoalPlannerPage real-mode save posts the goal (no profile PUT) and activates', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const calls: string[] = []
  let goalBody: Record<string, unknown> | null = null
  server.use(
    // The biometric profile PUT must NOT fire during creation (G6, mezo-06n).
    http.put(`${API_BASE}/api/biometrics/profile`, () => {
      calls.push('profile')
      return HttpResponse.json({ sex: 'M', heightCm: 180, birthDate: '1991-03-01' })
    }),
    http.post(`${API_BASE}/api/goals`, async ({ request }) => {
      calls.push('goal')
      goalBody = (await request.json()) as Record<string, unknown>
      return HttpResponse.json({ id: 'g1', status: 'planned' })
    }),
    http.post(`${API_BASE}/api/goals/g1/activate`, () => {
      calls.push('activate')
      return HttpResponse.json({ id: 'g1', status: 'active' })
    }),
  )
  render(
    <QueryWrapper>
      <MemoryRouter initialEntries={['/me/goals/new']}>
        <GoalPlannerPage />
      </MemoryRouter>
    </QueryWrapper>,
  )
  await waitForWizard()
  // Step 0 -> 1 (cél): pick a trajectory, advance.
  fireEvent.click(screen.getByRole('button', { name: /fogyás/i }))
  fireEvent.click(screen.getByRole('button', { name: /tovább/i }))
  // The default target date (start + 56 days) already satisfies canNext; just a title.
  fireEvent.change(screen.getByLabelText('Cél neve'), { target: { value: 'Nyári cut' } })
  // create + activate — this is the final/save step (no third step).
  fireEvent.click(screen.getByRole('button', { name: /létrehozása \+ aktiválás/i }))
  await waitFor(() => expect(calls).toEqual(['goal', 'activate']))
  // The goal body carries NO rateTargetPctPerWeek (backend derives it) and NO profile.
  expect(goalBody).not.toBeNull()
  expect(goalBody!).not.toHaveProperty('rateTargetPctPerWeek')
  expect(goalBody!).not.toHaveProperty('profile')
  expect(goalBody!.title).toBe('Nyári cut')
  vi.unstubAllEnvs()
})

// --- route-level biometric gate (G6, mezo-06n — review fix) ------------------

test('GoalPlannerPage redirects an incomplete-profile user away from the wizard (real mode, 404)', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  // 404 = no biometric profile yet → incomplete → the route must NOT render the
  // wizard; it redirects to /me/goals where the GoalGate setup flow lives.
  server.use(
    http.get(`${API_BASE}/api/biometrics/profile`, () => new HttpResponse(null, { status: 404 })),
  )
  render(
    <QueryWrapper>
      <MemoryRouter initialEntries={['/me/goals/new']}>
        <Routes>
          <Route path="/me/goals" element={<div>cél-nézet</div>} />
          <Route path="/me/goals/new" element={<GoalPlannerPage />} />
        </Routes>
      </MemoryRouter>
    </QueryWrapper>,
  )
  // Lands on the Cél view, NOT the wizard.
  await waitFor(() => expect(screen.getByText('cél-nézet')).toBeInTheDocument())
  expect(screen.queryByText('Mit építünk?')).not.toBeInTheDocument()
  vi.unstubAllEnvs()
})

test('GoalPlannerPage renders the wizard for a complete-profile user (real mode, default handler)', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  // The default MSW handler returns a COMPLETE profile → the route renders the
  // wizard (no redirect).
  render(
    <QueryWrapper>
      <MemoryRouter initialEntries={['/me/goals/new']}>
        <Routes>
          <Route path="/me/goals" element={<div>cél-nézet</div>} />
          <Route path="/me/goals/new" element={<GoalPlannerPage />} />
        </Routes>
      </MemoryRouter>
    </QueryWrapper>,
  )
  await waitFor(() => expect(screen.getByText('Mit építünk?')).toBeInTheDocument())
  expect(screen.queryByText('cél-nézet')).not.toBeInTheDocument()
  vi.unstubAllEnvs()
})

// --- loading skeleton (mezo-f2z) ---------------------------------------------
// Real mode renders the generic ScreenSkeleton (role="status") while the
// biometric-profile query is unresolved; mock mode seeds the profile
// synchronously (initialData) → isLoading is false → no skeleton flashes (parity).
describe('GoalPlannerPage (real mode, pending)', () => {
  afterEach(() => vi.unstubAllEnvs())
  it('shows the skeleton while the biometric-profile query is unresolved', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    server.use(
      http.get(`${API_BASE}/api/biometrics/profile`, () => new Promise(() => {})),
    )
    render(
      <QueryWrapper>
        <MemoryRouter initialEntries={['/me/goals/new']}>
          <GoalPlannerPage />
        </MemoryRouter>
      </QueryWrapper>,
    )
    expect(await screen.findByRole('status')).toBeInTheDocument()
    // The redirect target / wizard heading must NOT have rendered yet.
    expect(screen.queryByText('Mit építünk?')).not.toBeInTheDocument()
  })
})

describe('GoalPlannerPage (mock mode)', () => {
  afterEach(() => vi.unstubAllEnvs())
  it('renders the wizard with no skeleton (synchronous seed → isLoading false)', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    render(
      <QueryWrapper>
        <MemoryRouter initialEntries={['/me/goals/new']}>
          <GoalPlannerPage />
        </MemoryRouter>
      </QueryWrapper>,
    )
    await waitFor(() => expect(screen.getByText('Mit építünk?')).toBeInTheDocument())
    expect(screen.queryByRole('status')).toBeNull()
  })
})
