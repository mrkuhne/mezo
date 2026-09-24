import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ApiError } from '@/data/_client/api'
import { AuthGate } from '@/app/auth/AuthGate'
import { invalidateTodayDay } from '@/data/me/liveDay'
import { DEFAULT_QUERY_STALE_TIME_MS } from '@/data/useDualQuery'
import { emitToast } from '@/shared/lib/toastBus'

// `client` is referenced by its own `mutationCache`'s `onSuccess`, so the cache is built first
// and handed a `let`-hoisted client reference rather than the other way round.
let client: QueryClient

const mutationCache = new MutationCache({
  // Every failed write surfaces as an error toast by default — per-mutation onError
  // handlers still run and may add richer handling on top; nothing fails silently.
  onError: (error) => {
    console.error('Mutation failed', error)
    const trace = error instanceof ApiError ? error.messages[0]?.exceptionTraceId : undefined
    emitToast({
      kind: 'error',
      text: trace ? `Mentés sikertelen — próbáld újra (${trace.slice(0, 8)})` : 'Mentés sikertelen — próbáld újra',
    })
  },
  // A napom S3: today is LIVE — any successful write (a meal, a set, a check-in, a sleep or
  // weight log, a habit tick) can move a day input, so one global hook invalidates today's
  // evaluation + this week instead of wiring each logging mutation by hand.
  onSuccess: () => { void invalidateTodayDay(client) },
})

client = new QueryClient({
  mutationCache,
  defaultOptions: { queries: { staleTime: DEFAULT_QUERY_STALE_TIME_MS, retry: 1 } },
})

export function QueryProvider({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={client}>
      <AuthGate>{children}</AuthGate>
    </QueryClientProvider>
  )
}
