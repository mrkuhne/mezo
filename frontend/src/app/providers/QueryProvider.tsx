import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'
import { bootstrapOwnerToken } from '@/lib/auth'
import { isMockMode } from '@/lib/mode'

const client = new QueryClient({
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
