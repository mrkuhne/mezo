import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, describe, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { AttachPlanSheet } from '@/features/me/sheets/AttachPlanSheet'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'

afterEach(() => vi.unstubAllEnvs())

// --- Mock mode: candidate listing + exclusion of already-linked plans -----
// The static mock timeline (data/goals.ts) links meso-hyp-04 / meso-str-02 /
// meso-maint-01; the mock library (data/train.ts) also has meso-rec-03. So the
// mesocycle picker must show only the un-linked one (Recovery 03) and exclude
// the three already on the goal.
describe('mock mode (candidate listing + exclusion)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  test('lists an un-linked mesocycle and excludes already-linked ones', () => {
    render(<AttachPlanSheet planType="mesocycle" goalId="goal-cut-2026" onClose={() => {}} />, { wrapper: QueryWrapper })
    expect(screen.getByText('Recovery 03')).toBeInTheDocument()
    // Already linked under the goal → must NOT be offered again.
    expect(screen.queryByText('Hypertrophy 04')).not.toBeInTheDocument()
    expect(screen.queryByText('Strength 02')).not.toBeInTheDocument()
    expect(screen.queryByText('Maintenance')).not.toBeInTheDocument()
  })
})

// --- Real mode: confirm attach hits goalLinkApi.attach with the exact body ---
const GOAL = {
  id: 'g1', title: 'Nyári cut', trajectory: 'cut', guards: [], status: 'active',
  startDate: '2026-06-01', targetDate: '2026-07-27', startWeightKg: 84.2, targetWeightKg: 80,
  rateTargetPctPerWeek: 0.7, identityFrame: 'x',
}
const TIMELINE = {
  goalId: 'g1', weeks: 8,
  // run-1 is already linked → the running picker must exclude it.
  links: [{ id: 'link-1', planType: 'running_block', planId: 'run-1', startWeek: 1, endWeek: 4, plan: { title: 'Base Build', status: 'active', startDate: '2026-06-01', endDate: '2026-06-29', weeks: 4 } }],
  gaps: [],
}
const MESO = {
  id: 'meso-9', title: 'Hypertrophy 09', shortTitle: 'Hypertrophy 09', goal: '', status: 'planned',
  startDate: '2026-06-16', endDate: '2026-07-27', weeks: 6, currentWeek: 0,
  split: 'PPL · 5×/hét', style: 'RP · 6 hét', phaseCurve: ['MEV', 'MAV'],
}

function realModeHandlers() {
  server.use(
    http.get(`${API_BASE}/api/goals`, () => HttpResponse.json([GOAL])),
    http.get(`${API_BASE}/api/biometrics/weight`, () => HttpResponse.json([])),
    http.get(`${API_BASE}/api/goals/g1/timeline`, () => HttpResponse.json(TIMELINE)),
    http.get(`${API_BASE}/api/train/mesocycles`, () => HttpResponse.json([MESO])),
    http.get(`${API_BASE}/api/train/running-blocks`, () => HttpResponse.json([])),
  )
}

describe('real mode (attach wire body)', () => {
  beforeEach(() => { vi.stubEnv('VITE_USE_MOCK', 'false'); realModeHandlers() })

  test('confirming attach POSTs { planType, planId, startWeek } and closes', async () => {
    let attached: { planType?: string; planId?: string; startWeek?: number } | null = null
    server.use(
      http.post(`${API_BASE}/api/goals/g1/plans`, async ({ request }) => {
        attached = (await request.json()) as typeof attached
        return HttpResponse.json({ id: 'link-new', planType: 'mesocycle', planId: 'meso-9', startWeek: 3, endWeek: 8, plan: MESO }, { status: 201 })
      }),
    )
    const onClose = vi.fn()
    render(<AttachPlanSheet planType="mesocycle" goalId="g1" onClose={onClose} />, { wrapper: QueryWrapper })

    // Wait for the goal timeline to load (weeks=8 → the start-week input maxes at 8).
    const weekInput = await screen.findByLabelText('Kezdő hét')
    await waitFor(() => expect(weekInput).toHaveAttribute('max', '8'))
    // Pick the candidate, set the start week (fireEvent.change sets the controlled
    // number input in one shot — avoids per-keystroke clamping), confirm.
    await userEvent.click(await screen.findByText('Hypertrophy 09'))
    fireEvent.change(weekInput, { target: { value: '3' } })
    expect(weekInput).toHaveValue(3)
    await userEvent.click(screen.getByRole('button', { name: /Csatolás/ }))

    await waitFor(() => expect(attached).toEqual({ planType: 'mesocycle', planId: 'meso-9', startWeek: 3 }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  test('excludes an already-linked running block from the picker', async () => {
    server.use(
      http.get(`${API_BASE}/api/train/running-blocks`, () =>
        HttpResponse.json([
          { id: 'run-1', title: 'Base Build', goal: null, kind: 'interval', status: 'active', startDate: '2026-06-01', endDate: '2026-06-29', weeks: 4, currentWeek: 1, summary: null, structure: { weeks: [] } },
          { id: 'run-2', title: 'Speed Block', goal: null, kind: 'interval', status: 'planned', startDate: '2026-07-01', endDate: '2026-07-28', weeks: 4, currentWeek: 0, summary: null, structure: { weeks: [] } },
        ]),
      ),
    )
    render(<AttachPlanSheet planType="running_block" goalId="g1" onClose={() => {}} />, { wrapper: QueryWrapper })
    // run-2 is un-linked → offered; run-1 is already on the goal timeline → excluded
    // (wait for the timeline query to resolve so the linked set is populated).
    expect(await screen.findByText('Speed Block')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('Base Build')).not.toBeInTheDocument())
  })
})
