import { act, render, screen, waitFor } from '@testing-library/react'
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { afterEach, expect, test, vi } from 'vitest'
import { setToken } from '@/data/_client/api'
import { localDateString } from '@/shared/lib/dates'
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

test('a successful mutation invalidates today\'s day evaluation (A napom S3, mezo-yjzhw.3)', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  const today = localDateString()
  let clientRef: QueryClient | undefined

  function Probe() {
    const qc = useQueryClient()
    clientRef = qc
    qc.setQueryData(['dayEvaluation', today], { seeded: true })
    const mutation = useMutation({ mutationFn: async () => 'ok' })
    return <button onClick={() => mutation.mutate()}>go</button>
  }

  render(<QueryProvider><Probe /></QueryProvider>)
  const button = await screen.findByText('go')
  await act(async () => { button.click() })

  await waitFor(() => {
    expect(clientRef?.getQueryState(['dayEvaluation', today])?.isInvalidated).toBe(true)
  })
})
