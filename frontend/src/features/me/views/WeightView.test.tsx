import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { WeightView } from './WeightView'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'

// Asserts the Phase-1 mock weight hero/trends, so pin mock mode explicitly.
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

test('WeightView renders the Súly header, trend cells, and a log entry point', () => {
  render(<WeightView />, { wrapper: QueryWrapper })
  expect(screen.getByText('Napi súly')).toBeInTheDocument()
  expect(screen.getByText('7 nap')).toBeInTheDocument()
  expect(screen.getByText('4 hét')).toBeInTheDocument()
  // the log CTA opens the WeightLogSheet
  fireEvent.click(screen.getByRole('button', { name: /naplózás/i }))
  expect(screen.getByText('Mi a számunk ma?')).toBeInTheDocument() // WeightLogSheet title
})

test('WeightView (real mode) renders the hero rate from the backend EWMA trend', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(
    http.get(`${API_BASE}/api/biometrics/weight/trend`, () =>
      HttpResponse.json({
        ewmaSeries: [{ date: '2026-06-01', trendKg: 81.3 }],
        latestTrendKg: 81.3,
        weeklyRateKgPerWeek: -0.55,
        weeklyRatePctPerWeek: -0.68,
        last4wRateKgPerWeek: -0.7,
        dataSufficiency: 'full',
      }),
    ),
  )
  render(<WeightView />, { wrapper: QueryWrapper })
  // The 7-napos hero line reads the real EWMA weekly rate (kg/hét) once it loads.
  await waitFor(() => expect(screen.getByText(/-0\.55 kg\/hét/)).toBeInTheDocument())
})
