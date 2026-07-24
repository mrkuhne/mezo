import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, expect, it, test, vi } from 'vitest'
import { SleepPage } from '@/features/me/pages/SleepPage'
import { QueryWrapper, makeHookWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'

vi.mock('@/features/me/logic/sleepEscalation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/me/logic/sleepEscalation')>()),
  evaluateEscalation: vi.fn(() => ({ triggered: false, reason: null })),
}))
import { evaluateEscalation, SNOOZE_KEY } from '@/features/me/logic/sleepEscalation'

// Asserts the Phase-1 mock sleep hero, so pin mock mode explicitly. Also clears the
// snooze localStorage key and resets the escalation mock to its not-triggered default
// so test order can't leak state between the escalation cases.
beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  localStorage.clear()
  vi.mocked(evaluateEscalation).mockReturnValue({ triggered: false, reason: null })
})
afterEach(() => vi.unstubAllEnvs())

// SleepPage renders a <Link> (night-mode entry row), so a router context is required.
const renderPage = () =>
  render(
    <MemoryRouter>
      <SleepPage />
    </MemoryRouter>,
    { wrapper: QueryWrapper },
  )

test('renders the last-night hero', () => {
  renderPage()
  expect(screen.getByRole('heading', { level: 1, name: 'Alvás' })).toBeInTheDocument()
  expect(screen.getByText('Tegnap éjjel')).toBeInTheDocument()
  // hero duration (48px) renders "7.4" — also appears in the log, so assert it is present at least once
  expect(screen.getAllByText('7.4').length).toBeGreaterThan(0)
  // hero quality (32px) renders "7" — collides with other quality values, so assert presence
  expect(screen.getAllByText('7').length).toBeGreaterThan(0)
})

test('renders the recent log (last 7 nights, newest first)', () => {
  const { container } = renderPage()
  expect(container.querySelectorAll('[data-sleep-log-row]')).toHaveLength(7)
})

test('real mode with an empty sleep log renders the placeholder instead of crashing', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(http.get(`${API_BASE}/api/biometrics/sleep`, () => HttpResponse.json([])))

  render(
    <MemoryRouter>
      <SleepPage />
    </MemoryRouter>,
    { wrapper: makeHookWrapper() },
  )

  await waitFor(() => expect(screen.getByText('Még nincs alvásadat.')).toBeInTheDocument())
})

it('renders the sleep-goal card with derived ends and the regularity band', () => {
  renderPage()
  expect(screen.getByText('23:15')).toBeInTheDocument()          // derived bed
  expect(screen.getAllByText('06:45').length).toBeGreaterThan(0) // fixed wake
  expect(screen.getByText('7.5 ó cél')).toBeInTheDocument()
  expect(screen.getByText(/a rendszeresség a király/i)).toBeInTheDocument()
  expect(screen.getByText('±15p')).toBeInTheDocument()
})

it('renders the two score rings with computed values', () => {
  renderPage()
  expect(screen.getByText('Rendszeresség')).toBeInTheDocument()
  expect(screen.getByText('Hatékonyság')).toBeInTheDocument()
  expect(screen.getByText('14 nap · ±15p')).toBeInTheDocument()
  expect(screen.getByText('cél ≥ 85%')).toBeInTheDocument()
})

it('opens the SleepGoalSheet from the szerkeszt button', async () => {
  renderPage()
  await userEvent.click(screen.getByRole('button', { name: /szerkeszt/i }))
  expect(screen.getByRole('dialog', { name: 'Alvás-cél' })).toBeInTheDocument()
})

it('shows the bed-delta stat on the hero', () => {
  renderPage()
  // last mock night bed 23:05 vs target 23:15 -> −10p
  expect(screen.getByText(/vs\. cél lefekvés/)).toHaveTextContent('−10p')
})

test('renders the night-mode entry row linking to /me/sleep/night', () => {
  renderPage() // the file's existing helper
  const link = screen.getByRole('link', { name: /Éjszakai mód/ })
  expect(link).toHaveAttribute('href', '/me/sleep/night')
})

test('renders the daily stat card when no escalation', () => {
  renderPage()
  expect(screen.getByText('Miért számít?')).toBeInTheDocument()
})

test('escalation replaces the stat card and Most nem snoozes it away', () => {
  vi.mocked(evaluateEscalation).mockReturnValue({ triggered: true, reason: 'short' })
  renderPage()
  expect(screen.getByText(/tartósan kevés/i)).toBeInTheDocument()
  expect(screen.queryByText('Miért számít?')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Most nem' }))
  expect(screen.getByText('Miért számít?')).toBeInTheDocument()
  expect(localStorage.getItem(SNOOZE_KEY)).not.toBeNull()
  vi.mocked(evaluateEscalation).mockReturnValue({ triggered: false, reason: null })
})

test('stat card opens the deck sheet', () => {
  renderPage()
  fireEvent.click(screen.getByText('Miért számít?'))
  expect(screen.getByText('A kutatás számai')).toBeInTheDocument()
})
