import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { MemoryRouter } from 'react-router-dom'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { GoalPlanner } from './GoalPlanner'

test('GoalPlanner step 0 picks a trajectory and a guard', () => {
  render(
    <QueryWrapper>
      <MemoryRouter>
        <GoalPlanner />
      </MemoryRouter>
    </QueryWrapper>,
  )
  expect(screen.getByText('Mit építünk?')).toBeInTheDocument()
  // Tovább is disabled until a trajectory is picked
  expect(screen.getByRole('button', { name: /tovább/i })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: /fogyás/i }))
  fireEvent.click(screen.getByRole('button', { name: /erő megtartása/i }))
  // Tovább becomes enabled once a trajectory is picked
  expect(screen.getByRole('button', { name: /tovább/i })).toBeEnabled()
})

test('GoalPlanner is a 2-step wizard (no third step) ending on the cél step', () => {
  render(
    <QueryWrapper>
      <MemoryRouter>
        <GoalPlanner />
      </MemoryRouter>
    </QueryWrapper>,
  )
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

test('GoalPlanner has no manual rate input and no biometric fields', () => {
  render(
    <QueryWrapper>
      <MemoryRouter>
        <GoalPlanner />
      </MemoryRouter>
    </QueryWrapper>,
  )
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

test('GoalPlanner mock-mode cél step renders the static feasibility preview', async () => {
  // Force mock mode so this passes in both `pnpm test` (real default) and the
  // VITE_USE_MOCK=true run — the static preview comes from data/goals.ts, no MSW.
  vi.stubEnv('VITE_USE_MOCK', 'true')
  render(
    <QueryWrapper>
      <MemoryRouter>
        <GoalPlanner />
      </MemoryRouter>
    </QueryWrapper>,
  )
  fireEvent.click(screen.getByRole('button', { name: /fogyás/i }))
  fireEvent.click(screen.getByRole('button', { name: /tovább/i }))
  // The static mock preview (data/goals.ts) is feasible at 0,6 %BW/hét.
  await waitFor(() => expect(screen.getByText(/Reális/i)).toBeInTheDocument())
  expect(screen.getByText(/0,6/)).toBeInTheDocument()
  expect(screen.getByText(/%BW\s*\/\s*hét/i)).toBeInTheDocument()
  vi.unstubAllEnvs()
})

test('GoalPlanner real-mode cél step renders the derived rate + verdict from the preview', async () => {
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
        <GoalPlanner />
      </MemoryRouter>
    </QueryWrapper>,
  )
  fireEvent.click(screen.getByRole('button', { name: /fogyás/i }))
  fireEvent.click(screen.getByRole('button', { name: /tovább/i }))
  await waitFor(() => expect(screen.getByText(/✓\s*Reális/i)).toBeInTheDocument())
  expect(screen.getByText(/0,6/)).toBeInTheDocument()
  vi.unstubAllEnvs()
})

test('GoalPlanner real-mode aggressive preview offers a realistic date that re-previews on accept', async () => {
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
        <GoalPlanner />
      </MemoryRouter>
    </QueryWrapper>,
  )
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

test('GoalPlanner real-mode save posts the goal (no profile PUT) and activates', async () => {
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
        <GoalPlanner />
      </MemoryRouter>
    </QueryWrapper>,
  )
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
