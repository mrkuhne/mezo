import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { GoalPlanSlots } from './GoalPlanSlots'
import { QueryWrapper } from '@/test/queryWrapper'

// Spy on useNavigate so we can assert the exact planner-launch target (meso →
// /train/mesocycles/new; running → create-then-navigate to /train/futas/:id).
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

function Wrapper({ children }: { children: React.ReactNode }) {
  return <QueryWrapper><MemoryRouter>{children}</MemoryRouter></QueryWrapper>
}

// Slots use useRunning() (create-then-navigate) and useGoal()/useTrain() (the
// attach sheet) — drive them with the static Phase-1 mock data.
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => { vi.unstubAllEnvs(); mockNavigate.mockReset() })

test('renders both plan slots (Mesociklus + Futóblokk), volleyball is not a slot', () => {
  render(<GoalPlanSlots goalId="goal-cut-2026" />, { wrapper: Wrapper })
  expect(screen.getByText('Mesociklus')).toBeInTheDocument()
  expect(screen.getByText('Futóblokk')).toBeInTheDocument()
  expect(screen.queryByText(/röplabda/i)).not.toBeInTheDocument()
})

test('Mesociklus ＋ Tervezd navigates to the meso planner', async () => {
  render(<GoalPlanSlots goalId="goal-cut-2026" />, { wrapper: Wrapper })
  const mesoSlot = screen.getByText('Mesociklus').closest('.notch-8') as HTMLElement
  await userEvent.click(within(mesoSlot).getByRole('button', { name: /Tervezd/ }))
  expect(mockNavigate).toHaveBeenCalledWith('/train/mesocycles/new')
})

test('Futóblokk ＋ Tervezd creates a block then navigates to its builder', async () => {
  render(<GoalPlanSlots goalId="goal-cut-2026" />, { wrapper: Wrapper })
  const runSlot = screen.getByText('Futóblokk').closest('.notch-8') as HTMLElement
  await userEvent.click(within(runSlot).getByRole('button', { name: /Tervezd/ }))
  // create-then-navigate: the new block's :id route, not a /new route.
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith(expect.stringMatching(/^\/train\/futas\//)))
})

test('＋ Csatolj meglévőt opens the AttachPlanSheet for the mesocycle slot', async () => {
  render(<GoalPlanSlots goalId="goal-cut-2026" />, { wrapper: Wrapper })
  const mesoSlot = screen.getByText('Mesociklus').closest('.notch-8') as HTMLElement
  await userEvent.click(within(mesoSlot).getByRole('button', { name: '＋ Csatolj meglévőt' }))
  // The attach sheet's title for the mesocycle type appears.
  expect(await screen.findByText('Mesociklus csatolása')).toBeInTheDocument()
})
