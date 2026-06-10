import '@testing-library/jest-dom/vitest'

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
