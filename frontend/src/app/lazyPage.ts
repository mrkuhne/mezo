import { lazy, type ComponentType } from 'react'

/**
 * Route-level code splitting (mezo-9fcm). A page becomes its own chunk, fetched the first time
 * its route is opened; the entry chunk keeps only the shell and the landing domain (Nap).
 *
 * Two things keep a navigation from ever showing a loading state in practice:
 *
 * 1. `warmLazyPages` fetches every page chunk in the background once the app is idle.
 * 2. A page whose module has ALREADY arrived renders synchronously. `React.lazy` normally
 *    suspends for one tick even on a settled promise; handing it a thenable that calls back
 *    inline makes React read the module in the same render (its lazy initializer checks the
 *    payload status right after `.then`). So a warmed page behaves exactly like the static
 *    import it replaced — which is also what the test setup relies on (`preloadLazyPages`).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- pages take arbitrary props
type AnyComponent = ComponentType<any>
type Loaded = { default: AnyComponent }

const loaders: Array<() => Promise<unknown>> = []

export function lazyPage<M, K extends keyof M>(
  load: () => Promise<M>,
  name: K & (M[K] extends AnyComponent ? K : never),
) {
  let loaded: Loaded | undefined
  let pending: Promise<Loaded> | undefined
  const once = (): Promise<Loaded> => {
    pending ??= load().then(
      (m) => (loaded = { default: m[name] as AnyComponent }),
      (e: unknown) => {
        pending = undefined // let the next open retry (offline, a deploy swapped the chunks)
        throw e
      },
    )
    return pending
  }
  loaders.push(once)
  return lazy(() => {
    if (!loaded) return once()
    const ready = loaded
    const inline = { then: (resolve: (m: Loaded) => void) => resolve(ready) }
    return inline as unknown as Promise<Loaded>
  })
}

/** Resolve every registered page module. Awaited by the test setup; used by the warm-up. */
export async function preloadLazyPages(): Promise<void> {
  for (const load of loaders) {
    try {
      await load()
    } catch {
      // the route's own load surfaces the failure when it is opened
    }
  }
}

let warmed = false

/** Fetch every lazy page chunk in the background, without competing with the first paint. */
export function warmLazyPages(): void {
  if (warmed) return
  warmed = true
  const idle = (globalThis as { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback
  if (idle) idle(() => void preloadLazyPages())
  else setTimeout(() => void preloadLazyPages(), 2000)
}
