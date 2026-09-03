/**
 * The bearer token, persisted so a reload does not need a fresh login (S1, mezo-qw37.1).
 * localStorage is the source of truth, read on every `get()` (not cached) so the very next
 * request THIS tab makes after another tab changes the token already carries the new value.
 * That alone does not tell an already-rendered tab its session changed — a tab sitting on
 * `ready` with cached data does not re-derive anything just because a future `get()` would
 * answer differently. `AuthGate` closes that gap with a `window` `storage` listener (mezo-qw37.1
 * review). `memory` is only a fallback for a storage that throws (private mode, blocked site
 * data), so auth still works session-only.
 */
export const TOKEN_KEY = 'mezo.auth.token'

let memory: string | null = null

export const tokenStore = {
  get(): string | null {
    try {
      memory = localStorage.getItem(TOKEN_KEY)
      return memory
    } catch {
      return memory
    }
  },
  set(token: string | null): void {
    memory = token
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token)
      else localStorage.removeItem(TOKEN_KEY)
    } catch { /* session-only */ }
  },
  clear(): void { this.set(null) },
}
