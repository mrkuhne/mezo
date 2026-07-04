import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import { RetaWeekStrip } from '@/features/fuel/components/RetaWeekStrip'
import { QueryWrapper } from '@/test/queryWrapper'

// The strip reads useFuelWeek().retaWeek — a composed dual-mode hook since Fuel P4 (needs a
// QueryClient); mock mode pins the 7-cell Phase-1 seed these assertions describe.
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

const renderStrip = (currentDay: number) =>
  render(
    <QueryWrapper>
      <RetaWeekStrip currentDay={currentDay} />
    </QueryWrapper>,
  )

test('renders 7 day cells with phase labels', () => {
  renderStrip(3)
  expect(screen.getByText('D1')).toBeInTheDocument()
  expect(screen.getByText('D7')).toBeInTheDocument()
  expect(screen.getAllByText('Stable').length).toBeGreaterThan(0)
})
test('marks the current day active', () => {
  const { container } = renderStrip(3)
  expect(container.querySelector('[data-active="true"]')).toHaveTextContent('D3')
})
