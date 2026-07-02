import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, vi } from 'vitest'
import { ReplanSheet } from '@/features/fuel/sheets/ReplanSheet'
import { QueryWrapper } from '@/test/queryWrapper'

// ReplanSheet reads the dual-mode useProtocol (mezo-09g) for the next-version label — pin mock mode
// (non-null seed protocol) and provide a QueryClientProvider. Scenarios stay static.
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

test('lists scenarios and shows the cascade for the selected one', () => {
  render(<QueryWrapper><ReplanSheet onClose={() => {}} /></QueryWrapper>)
  expect(screen.getByText(/Replan · Mezo/)).toBeInTheDocument()
  expect(screen.getByText(/Cascade/)).toBeInTheDocument()
})

test('Alkalmazom transitions to the applied phase', async () => {
  render(<QueryWrapper><ReplanSheet onClose={() => {}} /></QueryWrapper>)
  await userEvent.click(screen.getByRole('button', { name: /Alkalmazom/ }))
  expect(screen.getByText(/Megnézem/)).toBeInTheDocument()
})
