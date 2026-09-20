import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { expect, test, vi } from 'vitest'
import { GoalGate } from '@/features/me/components/GoalGate'
vi.mock('@/data/hooks', () => ({ useBiometricProfile: () => ({ profile: null, isComplete: false }) }))
function Probe() { const location = useLocation(); return <output data-testid="location">{location.pathname}|{location.state?.from}</output> }
test('missing biometrics routes to the canonical editor with a return origin', async () => {
  render(<MemoryRouter initialEntries={['/me/goals/weight']}><GoalGate onClose={vi.fn()} onComplete={vi.fn()} /><Probe /></MemoryRouter>)
  await userEvent.click(screen.getByRole('button', { name: /Biometria beállítása/ }))
  expect(screen.getByTestId('location')).toHaveTextContent('/settings/me/biometrics|/me/goals/weight')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
