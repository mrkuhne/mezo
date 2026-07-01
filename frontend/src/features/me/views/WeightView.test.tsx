import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { WeightView } from '@/features/me/views/WeightView'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

test('renders the hero, trend chart, weekly history, and opens the log sheet', () => {
  render(<WeightView />, { wrapper: QueryWrapper })
  expect(screen.getByText('Napi súly')).toBeInTheDocument()
  expect(screen.getByText('Induláshoz képest')).toBeInTheDocument()
  expect(screen.getByText('Jelenleg')).toBeInTheDocument()
  expect(screen.getByText('Heti előzmény')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /naplózás/i }))
  expect(screen.getByText('Mi a számunk ma?')).toBeInTheDocument()
})

test('newest week is expanded by default and a day row is visible', () => {
  render(<WeightView />, { wrapper: QueryWrapper })
  // mock spine ends 2026-05-22 (Fri); huMonthDayDow → "Máj 22 · Pén"
  expect(screen.getByText('Máj 22 · Pén')).toBeInTheDocument()
})

test('real mode: the 7-nap/hét stat reads the backend EWMA weekly rate', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(
    http.get(`${API_BASE}/api/biometrics/weight`, () => HttpResponse.json([])), // empty log → the stat value is unique
    http.get(`${API_BASE}/api/biometrics/weight/trend`, () =>
      HttpResponse.json({
        ewmaSeries: [{ date: '2026-06-01', trendKg: 81.3 }],
        latestTrendKg: 81.3, weeklyRateKgPerWeek: -0.5, weeklyRatePctPerWeek: -0.62,
        last4wRateKgPerWeek: -0.7, dataSufficiency: 'full',
      }),
    ),
  )
  render(<WeightView />, { wrapper: QueryWrapper })
  await waitFor(() => expect(screen.getByText('−0.5')).toBeInTheDocument()) // hero 7-nap/hét = fmtSigned(-0.5)
})
