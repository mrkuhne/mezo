import '@testing-library/jest-dom/vitest'
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest'
import { server } from '@/test/msw/server'
import { resetTutorialProgressState } from '@/test/msw/handlers'
import { setCurrentUserId } from '@/shared/lib/userScope'

// Node 25 ships an experimental native `localStorage` global that lacks the
// Web Storage methods (getItem/setItem/clear). It shadows jsdom's Storage, so
// install a spec-compliant in-memory Storage for the test environment.
class MemoryStorage implements Storage {
  private store = new Map<string, string>()
  get length(): number { return this.store.size }
  clear(): void { this.store.clear() }
  getItem(key: string): string | null { return this.store.has(key) ? this.store.get(key)! : null }
  key(index: number): string | null { return Array.from(this.store.keys())[index] ?? null }
  removeItem(key: string): void { this.store.delete(key) }
  setItem(key: string, value: string): void { this.store.set(String(key), String(value)) }
  [name: string]: unknown
}

function installStorage(name: 'localStorage' | 'sessionStorage'): void {
  const current = (globalThis as Record<string, unknown>)[name] as Storage | undefined
  if (current && typeof current.getItem === 'function' && typeof current.clear === 'function') return
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: new MemoryStorage() })
}

installStorage('localStorage')
installStorage('sessionStorage')

// jsdom does not implement Element.scrollIntoView — stub it as a no-op so
// focus-jump effects (e.g. MemoryJournalPanel's focusDate scroll) don't throw.
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}

// MSW — intercept the backend REST API in tests. 'bypass' keeps every other
// request (and all mock-mode hooks, which never fetch) untouched, so the
// existing suite is unaffected.
beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => server.resetHandlers())
// `server.resetHandlers()` only re-registers the handler list — it doesn't clear module-level
// in-memory state a handler closes over (e.g. the tutorial-progress seen-store), so that state
// needs its own explicit reset or a PUT in one test leaks into the next test's GET.
afterEach(() => resetTutorialProgressState())
// Sticky in-view tabs (useStickyTab) persist to sessionStorage; clear it between
// tests so a remembered segment never leaks into the next test's default.
afterEach(() => {
  try {
    sessionStorage.clear()
  } catch {
    /* ignore */
  }
})
// Mezo-kalauz seen-store (mezo-gb1s.1): a localStorage tesztek között NEM ürül, egy persistált
// "látva" jel a következő teszt auto-felugrását némítaná — a kalauz-kulcsokat célzottan töröljük.
afterEach(() => {
  try {
    const doomed: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith('mezo.kalauz.')) doomed.push(k)
    }
    doomed.forEach((k) => localStorage.removeItem(k))
  } catch {
    /* ignore */
  }
})
// Per-user localStorage keys (mezo-qw37.6): clear all storage and reset the
// module-level user scope between tests, so a scope or key set by one test
// never leaks into the next (which defaults to the `anon` scope).
afterEach(() => {
  try {
    localStorage.clear()
  } catch {
    /* ignore */
  }
  setCurrentUserId(null)
})
// Review Finding (Task 10 fix round 1): the afterEach above only resets AFTER a test runs — a
// file that sets the scope at module scope or in its own beforeAll (rather than inside a test)
// would run its FIRST case unreset. Mirror the reset before each test too, so both edges are
// covered.
beforeEach(() => {
  try {
    localStorage.clear()
  } catch {
    /* ignore */
  }
  setCurrentUserId(null)
})

afterAll(() => server.close())
