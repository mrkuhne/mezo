import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { WeightPage } from '@/features/me/pages/WeightPage'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { huMonthDayDow, localDateString } from '@/shared/lib/dates'

// Súly re-face (mezo-d20.6.3) — MozaikPage subpage scaffold (‹ Én back chip,
// page-head CTA, hero, stat strip, trend chart, weekly tiles). Behavior is
// unchanged: same hooks, same honest states, same log-sheet cascade.

function renderPage() {
  return render(
    <MemoryRouter>
      <QueryWrapper><WeightPage /></QueryWrapper>
    </MemoryRouter>,
  )
}

// ── entrance choreography (mezo-d20.11) ──
// The prototype (#page-suly) staggers the whole body: statstrip 0 · chips 40 ·
// chart 80 · „Heti előzmény" 120 · weekly tiles 150/190/230 · pager 260.
test('the Súly body staggers — stat strip, chips, chart, section label and the weekly tiles', () => {
  const { container } = renderPage()
  const rises = [...container.querySelectorAll('.rise')]
  expect(rises.length).toBeGreaterThanOrEqual(5)
  for (const r of rises) expect(r.closest('.mz-play')).not.toBeNull()
  expect(container.querySelector('.mz-statstrip')).toHaveClass('rise')
  expect(container.querySelector('.wt-lsec')).toHaveClass('rise')
  const weekDelays = [...container.querySelectorAll('.wt-week')]
    .map((w) => (w as HTMLElement).style.getPropertyValue('--d'))
  expect(weekDelays.slice(0, 3)).toEqual(['150ms', '190ms', '230ms'])
})

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
  // mezo-idz2 appended a date-relative today row to weightLog (DayOrb mock parity), so the
  // genuinely-newest week is now the one containing today, not the old fixed 2026-05-22
  // spine end — computed date-relatively so this doesn't go stale.
  expect(screen.getByText(huMonthDayDow(localDateString()))).toBeInTheDocument()
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
