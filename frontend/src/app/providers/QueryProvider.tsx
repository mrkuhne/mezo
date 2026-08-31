import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'
import { ApiError } from '@/data/_client/api'
import { bootstrapOwnerToken } from '@/data/_client/auth'
import { isMockMode } from '@/data/_client/mode'
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

/** Backoff between bootstrap attempts (mezo-l0k0) — a restarting backend usually answers
 *  within the first two; the total (~6s) stays short enough for a blank-splash wait. */
const BOOTSTRAP_RETRY_DELAYS_MS = [500, 1500, 4000]

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

type BootState = 'pending' | 'ready' | 'failed'

export function QueryProvider({ children }: { children: ReactNode }) {
  const mock = isMockMode()
  const [state, setState] = useState<BootState>(mock ? 'ready' : 'pending')
  // Bumping the nonce re-runs the whole retry loop — the degraded screen's Újra button.
  const [attemptNonce, setAttemptNonce] = useState(0)

  useEffect(() => {
    if (mock) return
    let cancelled = false
    setState('pending')
    ;(async () => {
      // mezo-l0k0: the old code caught ONE failure and rendered the app tokenless for the
      // whole session — every write 401ed with a generic toast and only a reload recovered.
      // Now: retry with backoff, and a persistent failure renders the EXPLICIT degraded
      // screen below instead of an unauthenticated app.
      for (let attempt = 0; ; attempt++) {
        try {
          await bootstrapOwnerToken()
          if (!cancelled) setState('ready')
          return
        } catch (err) {
          console.error(`Owner token bootstrap failed (attempt ${attempt + 1})`, err)
          if (attempt >= BOOTSTRAP_RETRY_DELAYS_MS.length) {
            if (!cancelled) setState('failed')
            return
          }
          await sleep(BOOTSTRAP_RETRY_DELAYS_MS[attempt])
          if (cancelled) return
        }
      }
    })()
    return () => { cancelled = true }
  }, [mock, attemptNonce])

  if (state === 'pending') return null
  if (state === 'failed') {
    return (
      <div
        style={{
          minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24,
          background: 'var(--surface-base, #FDFAF4)', color: 'var(--text-primary, #2B2118)',
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: 320 }}>
          <p style={{ fontSize: 15, fontWeight: 700 }}>Nem érem el a szervert</p>
          <p style={{ fontSize: 12.5, lineHeight: 1.5, marginTop: 8, color: 'var(--text-secondary, #6E6257)' }}>
            Az app nem tud bejelentkezni — lehet, hogy a backend épp újraindul.
            Adatot most nem tudsz menteni.
          </p>
          <button
            type="button"
            className="cta-primary"
            style={{ marginTop: 16, padding: '10px 28px' }}
            onClick={() => setAttemptNonce((n) => n + 1)}
          >
            Újra
          </button>
        </div>
      </div>
    )
  }
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
