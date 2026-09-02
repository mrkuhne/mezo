import '@testing-library/jest-dom/vitest'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { server } from '@/test/msw/server'
import { resetTutorialProgressState } from '@/test/msw/handlers'

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
afterAll(() => server.close())
