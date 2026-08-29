import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { WeightPage } from '@/features/me/pages/WeightPage'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'

// Súly re-face (mezo-d20.6.3) — MozaikPage subpage scaffold (‹ Én back chip,
// page-head CTA, hero, stat strip, trend chart, weekly tiles). Behavior is
// unchanged: same hooks, same honest states, same log-sheet cascade.

function renderPage() {
  render(
    <MemoryRouter>
      <QueryWrapper><WeightPage /></QueryWrapper>
    </MemoryRouter>,
  )
}

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

test('renders the ‹ Én back chip, hero, stat strip, trend chart, weekly history, and opens the log sheet', () => {
  renderPage()
  expect(screen.getByText('‹ Én')).toBeInTheDocument()
  expect(screen.getByText('Napi súly')).toBeInTheDocument()
  expect(screen.getByText('Jelenleg')).toBeInTheDocument()
  expect(screen.getByText('Heti előzmény')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /naplózás/i }))
  expect(screen.getByText('Mi a számunk ma?')).toBeInTheDocument()
})

test('newest week is expanded by default and a day row is visible', () => {
  renderPage()
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
  renderPage()
  await waitFor(() => expect(screen.getByText('−0.5')).toBeInTheDocument()) // stat cell = fmtSigned(-0.5)
})
