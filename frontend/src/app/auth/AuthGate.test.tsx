import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE, setToken } from '@/data/_client/api'
import { AuthGate } from '@/app/auth/AuthGate'
import { QueryWrapper, makeHookWrapperWithClient } from '@/test/queryWrapper'
import { authEvents } from '@/data/_client/authEvents'

afterEach(() => { vi.unstubAllEnvs(); localStorage.clear(); setToken(null) })

const App = () => <div>APP</div>
const renderGate = () => render(<QueryWrapper><AuthGate><App /></AuthGate></QueryWrapper>)

test('mock mode renders the app immediately', () => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  renderGate()
  expect(screen.getByText('APP')).toBeInTheDocument()
})

test('no token → login page', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  renderGate()
  expect(await screen.findByRole('heading', { name: 'Bejelentkezés' })).toBeInTheDocument()
})

test('valid token → me → app', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  setToken('t')
  renderGate()
  expect(await screen.findByText('APP')).toBeInTheDocument()
})

test('must-change-password → change-password page', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(http.get(`${API_BASE}/api/auth/me`, () => HttpResponse.json({
    id: '1', email: 'a@b.c', name: 'A', role: 'USER', onboarded: true, mustChangePassword: true, timezone: 'Europe/Budapest',
  })))
  setToken('t')
  renderGate()
  expect(await screen.findByRole('heading', { name: 'Új jelszó' })).toBeInTheDocument()
})

test('backend unreachable → degraded screen with retry', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(http.get(`${API_BASE}/api/auth/me`, () => HttpResponse.error()))
  setToken('t')
  renderGate()
  // BOOT_RETRY_DELAYS_MS (500/1500/4000ms) is exhausted before the degraded screen shows —
  // the default findBy timeout (1000ms) is too tight for that backoff.
  expect(await screen.findByText('Nem érem el a szervert', undefined, { timeout: 8000 })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Újra' })).toBeInTheDocument()
}, 10000)

test('a signedOut event while ready drops back to the login page', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  setToken('t')
  renderGate()
  await screen.findByText('APP')
  setToken(null)
  authEvents.emitSignedOut('expired')
  expect(await screen.findByRole('heading', { name: 'Bejelentkezés' })).toBeInTheDocument()
  expect(screen.getByText('A munkameneted lejárt, jelentkezz be újra.')).toBeInTheDocument()
})

test('login page → register link → register page and back', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  renderGate()
  await userEvent.click(await screen.findByRole('button', { name: 'Van meghívó kódod?' }))
  expect(await screen.findByRole('heading', { name: 'Regisztráció' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Vissza a belépéshez' }))
  expect(await screen.findByRole('heading', { name: 'Bejelentkezés' })).toBeInTheDocument()
})

// mezo-qw37.1 review carry-over (Task 9): the AUTOMATIC sign-out paths (expired/disabled) used
// to clear only the token, leaving every OTHER cached key (meals, weight, check-ins, …) behind
// for the next account on a shared device. AuthGate owns the onSignedOut subscription and the
// QueryClient, so it must clear the whole cache for EVERY reason, not just on manual logout.
test('a signedOut event clears the query cache for every reason, not just manual logout', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const { wrapper, client } = makeHookWrapperWithClient()
  setToken('t')
  render(<AuthGate><App /></AuthGate>, { wrapper })
  await screen.findByText('APP')

  client.setQueryData(['someone', 'elses', 'meals'], { secret: true })
  expect(client.getQueryData(['someone', 'elses', 'meals'])).toEqual({ secret: true })

  setToken(null)
  authEvents.emitSignedOut('expired')
  await screen.findByRole('heading', { name: 'Bejelentkezés' })

  expect(client.getQueryData(['someone', 'elses', 'meals'])).toBeUndefined()
})
