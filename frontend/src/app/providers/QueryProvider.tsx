import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ApiError } from '@/data/_client/api'
import { AuthGate } from '@/app/auth/AuthGate'
import { DEFAULT_QUERY_STALE_TIME_MS } from '@/data/useDualQuery'
import { emitToast } from '@/shared/lib/toastBus'

const client = new QueryClient({
  // Every failed write surfaces as an error toast by default — per-mutation onError
  // handlers still run and may add richer handling on top; nothing fails silently.
  mutationCache: new MutationCache({
    onError: (error) => {
      console.error('Mutation failed', error)
      const trace = error instanceof ApiError ? error.messages[0]?.exceptionTraceId : undefined
      emitToast({
        kind: 'error',
        text: trace ? `Mentés sikertelen — próbáld újra (${trace.slice(0, 8)})` : 'Mentés sikertelen — próbáld újra',
      })
    },
  }),
  defaultOptions: { queries: { staleTime: DEFAULT_QUERY_STALE_TIME_MS, retry: 1 } },
})

export function QueryProvider({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={client}>
      <AuthGate>{children}</AuthGate>
    </QueryClientProvider>
  )
}
