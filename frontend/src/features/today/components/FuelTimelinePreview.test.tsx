import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import { FuelTimelinePreview } from './FuelTimelinePreview'
import { QueryWrapper } from '@/test/queryWrapper'

// The tap mounts LogMealSheet, which reads the dual-mode useFuelDay/useRecipes/usePantry
// TanStack queries — pin mock mode + wrap in a QueryClientProvider so the sheet renders
// off the synchronous mock seed (no MSW round-trips).
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

const renderPreview = () =>
  render(
    <QueryWrapper>
      <FuelTimelinePreview />
    </QueryWrapper>,
  )

test('shows the fuel header and a MOST chip on the active slot', () => {
  renderPreview()
  expect(screen.getByText('Mai fuel · timeline')).toBeInTheDocument()
  expect(screen.getByText('MOST')).toBeInTheDocument()
})
test('opens the LogMealSheet when the log affordance is tapped', async () => {
  renderPreview()
  fireEvent.click(screen.getByRole('button', { name: /log/i }))
  expect(await screen.findByText('Mit ettél?')).toBeInTheDocument()
})
