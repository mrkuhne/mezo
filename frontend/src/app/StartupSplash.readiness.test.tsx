import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { StartupSplash } from '@/app/StartupSplash'

vi.mock('@/features/today/components/TitanCompanion', () => ({
  TitanArtwork: ({ onReady }: { onReady?: () => void }) => <button data-testid="first-frame" onClick={onReady} />,
}))
beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

test('the full three seconds begin after the first rendered frame', () => {
  render(<StartupSplash>Dashboard</StartupSplash>)
  act(() => vi.advanceTimersByTime(3200))
  expect(screen.getByRole('status')).toBeInTheDocument()
  fireEvent.click(screen.getByTestId('first-frame'))
  act(() => vi.advanceTimersByTime(2999))
  expect(screen.getByRole('status')).toBeInTheDocument()
  act(() => vi.advanceTimersByTime(1))
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})

test('an artwork that never becomes ready cannot block startup forever', () => {
  render(<StartupSplash>Dashboard</StartupSplash>)
  act(() => vi.advanceTimersByTime(4999))
  expect(screen.getByRole('status')).toBeInTheDocument()
  act(() => vi.advanceTimersByTime(1))
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})
