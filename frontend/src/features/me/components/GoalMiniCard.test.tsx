import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { afterEach, beforeEach, vi } from 'vitest'
import { GoalMiniCard } from '@/features/me/components/GoalMiniCard'
import { QueryWrapper } from '@/test/queryWrapper'

// Mirrors GoalsPage.test.tsx's "mock mode (demo goal)" pin — the concrete
// numbers below (81.4 / 78.6 / 73.0) come from the static mock seed in
// src/data/me/goals.ts, so pinning mock mode keeps the assertions deterministic
// regardless of the ambient VITE_USE_MOCK default.
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

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
