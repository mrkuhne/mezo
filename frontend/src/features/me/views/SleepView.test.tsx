import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import { SleepView } from './SleepView'
import { QueryWrapper } from '@/test/queryWrapper'

// Asserts the Phase-1 mock sleep hero, so pin mock mode explicitly.
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

test('renders the last-night hero', () => {
  render(<SleepView />, { wrapper: QueryWrapper })
  expect(screen.getByRole('heading', { level: 1, name: /Sleep/ })).toBeInTheDocument()
  expect(screen.getByText('Tegnap éjjel')).toBeInTheDocument()
  // hero duration (48px) renders "7.4" — also appears in the log, so assert it is present at least once
  expect(screen.getAllByText('7.4').length).toBeGreaterThan(0)
  // hero quality (32px) renders "7" — collides with other quality values, so assert presence
  expect(screen.getAllByText('7').length).toBeGreaterThan(0)
})

test('renders sleep factors (incl. the warning factor) with tool chips', () => {
  render(<SleepView />, { wrapper: QueryWrapper })
  expect(screen.getByText('Magnézium 21:00 stack megtartva')).toBeInTheDocument()
  expect(screen.getByText('Caffeine 14:00 utáni napok')).toBeInTheDocument()
  expect(screen.getByText(/get_sleep_log/)).toBeInTheDocument()
})

test('renders the recent log (last 7 nights, newest first)', () => {
  const { container } = render(<SleepView />, { wrapper: QueryWrapper })
  expect(container.querySelectorAll('[data-sleep-log-row]')).toHaveLength(7)
})
