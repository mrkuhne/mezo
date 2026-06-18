import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

/**
 * Test helper — wraps a tree in a fresh QueryClientProvider. The swapped data
 * hooks (useWeight/useGoal/useSleep) call useQuery/useMutation, so any test that renders
 * them (directly or via a component) needs this provider. A fresh client per
 * call keeps the query cache isolated between tests.
 */
export function QueryWrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

/**
 * Factory for renderHook wrappers — each call returns a wrapper backed by a
 * FRESH QueryClient (retry disabled) so hook tests stay isolated from one
 * another. Pass the returned component as renderHook's `wrapper` option.
 */
export function makeHookWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}
