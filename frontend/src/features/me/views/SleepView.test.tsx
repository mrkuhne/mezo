import { render, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { SleepView } from './SleepView'
import { QueryWrapper, makeHookWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'

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

test('renders the recent log (last 7 nights, newest first)', () => {
  const { container } = render(<SleepView />, { wrapper: QueryWrapper })
  expect(container.querySelectorAll('[data-sleep-log-row]')).toHaveLength(7)
})

test('real mode with an empty sleep log renders the placeholder instead of crashing', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(http.get(`${API_BASE}/api/biometrics/sleep`, () => HttpResponse.json([])))

  render(<SleepView />, { wrapper: makeHookWrapper() })

  await waitFor(() => expect(screen.getByText('Még nincs alvásadat.')).toBeInTheDocument())
})
