import { render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { setToken } from '@/data/_client/api'
import { QueryProvider } from './QueryProvider'

/**
 * mezo-qw37.1: the boot state machine (pending/login/register/mustChangePassword/failed/ready)
 * moved to AuthGate — see src/app/auth/AuthGate.test.tsx for that behaviour in full.
 * QueryProvider itself only has to wire the QueryClientProvider around AuthGate.
 */
afterEach(() => { vi.unstubAllEnvs(); localStorage.clear(); setToken(null) })

test('mock mode renders the app immediately (AuthGate short-circuits)', () => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  render(<QueryProvider><div>APP</div></QueryProvider>)
  expect(screen.getByText('APP')).toBeInTheDocument()
})

test('real mode with a valid token renders the app once /api/auth/me resolves', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  setToken('t')
  render(<QueryProvider><div>APP</div></QueryProvider>)
  expect(await screen.findByText('APP')).toBeInTheDocument()
})

test('real mode with no token renders the login page, not the app', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  render(<QueryProvider><div>APP</div></QueryProvider>)
  expect(await screen.findByRole('heading', { name: 'Bejelentkezés' })).toBeInTheDocument()
})
