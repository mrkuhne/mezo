/**
 * The bearer token, persisted so a reload does not need a fresh login (S1, mezo-qw37.1).
 * localStorage is the source of truth, read on every `get()` (not cached) so a sign-out or
 * cleared session in another tab takes effect here too. `memory` is only a fallback for a
 * storage that throws (private mode, blocked site data), so auth still works session-only.
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
