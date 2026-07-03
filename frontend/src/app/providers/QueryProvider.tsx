import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'
import { ApiError } from '@/data/_client/api'
import { bootstrapOwnerToken } from '@/data/_client/auth'
import { isMockMode } from '@/data/_client/mode'
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
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
})

export function QueryProvider({ children }: { children: ReactNode }) {
  const mock = isMockMode()
  const [ready, setReady] = useState(mock)
  useEffect(() => {
    if (mock) return
    bootstrapOwnerToken()
      .then(() => setReady(true))
      .catch((err) => {
        console.error('Owner token bootstrap failed', err)
        setReady(true)
      })
  }, [mock])
  if (!ready) return null
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
