import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { afterEach, beforeEach, describe, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { GoalMiniCard } from '@/features/me/components/GoalMiniCard'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'

// Render inside a small route tree with a probe element at /me/goals, so the
// tap-through test can assert real navigation (not a mocked useNavigate) —
// mirrors the QueryWrapper+MemoryRouter harness the other Me component tests use.
function renderMini() {
  return render(
    <QueryWrapper>
      <MemoryRouter initialEntries={['/me']}>
        <Routes>
          <Route path="/me" element={<GoalMiniCard />} />
          <Route path="/me/goals" element={<div data-testid="goals-probe" />} />
        </Routes>
      </MemoryRouter>
    </QueryWrapper>,
  )
}

// The card tests assert Phase-1 mock goal data (concrete numbers 81.4 / 78.6 /
// 73.0 from the static seed in src/data/me/goals.ts), so pin mock mode
// explicitly — mirrors GoalsPage.test.tsx's "mock mode (demo goal)" describe.
describe('mock mode (demo goal)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('renders trajectory, title and the remaining-kg line', async () => {
    renderMini()
    await waitFor(() => expect(screen.getByText(/🎯/)).toBeInTheDocument())
    expect(screen.getByText(/% ·/)).toHaveTextContent(/kg hátra/)
  })

  test('renders the start / most / cél track labels', async () => {
    renderMini()
    await waitFor(() => expect(screen.getByText(/most$/)).toBeInTheDocument())
    expect(screen.getByText(/cél$/)).toBeInTheDocument()
    expect(document.querySelector('.goalmini .track .fill')).not.toBeNull()
  })

  test('taps through to /me/goals', async () => {
    renderMini()
    await waitFor(() => expect(screen.getByText(/🎯/)).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /Cél oldal megnyitása/ }))
    expect(await screen.findByTestId('goals-probe')).toBeInTheDocument()
  })
})

// Binding constraint: the card must render null (not a broken/partial card)
// both while the active-goal query is unresolved AND when real mode has no
// active goal — the real-mode cold window must never flash on Profil.
describe('real mode', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('renders nothing while the active-goal query is pending', () => {
    server.use(
      http.get(`${API_BASE}/api/goals`, () => new Promise(() => {})), // never resolves
    )
    renderMini()
    expect(document.querySelector('.goalmini')).toBeNull()
  })

  test('renders nothing when there is no active goal', async () => {
    const calls: string[] = []
    server.use(
      http.get(`${API_BASE}/api/goals`, () => {
        calls.push('goals')
        return HttpResponse.json([])
      }),
    )
    renderMini()
    // Wait for the ['goals'] query to actually resolve (empty list) before
    // asserting absence — otherwise the assertion could trivially pass while
    // still pending.
    await waitFor(() => expect(calls).toEqual(['goals']))
    expect(document.querySelector('.goalmini')).toBeNull()
  })
})

// Maintain goal (startWeight === targetWeight → total 0): the header must render a
// "tartás" caption, NOT "0% · X kg hátra" (which reads as a stalled cut). The track
// is already hidden for total 0; this drains the leftover percent/hátra pair. (#22)
describe('maintain goal (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  // startWeightKg === targetWeightKg → total 0 regardless of the latest weight entry.
  const maintainGoal = {
    id: 'goal-maintain',
    title: 'Tartás · Nyári forma',
    trajectory: 'maintain',
    guards: [],
    status: 'active',
    startDate: '2026-04-01',
    targetDate: '2026-08-15',
    startWeightKg: 80,
    targetWeightKg: 80,
    rateTargetPctPerWeek: 0,
  }

  test('renders a "tartás" caption instead of the percent/hátra pair', async () => {
    server.use(http.get(`${API_BASE}/api/goals`, () => HttpResponse.json([maintainGoal])))
    renderMini()
    await waitFor(() => expect(screen.getByText(/🎯/)).toBeInTheDocument())
    expect(screen.getByText('tartás')).toBeInTheDocument()
    expect(screen.queryByText(/% ·/)).toBeNull()
    expect(screen.queryByText(/kg hátra/)).toBeNull()
    // The progress track stays hidden for a maintain goal.
    expect(document.querySelector('.goalmini .track')).toBeNull()
  })
})
