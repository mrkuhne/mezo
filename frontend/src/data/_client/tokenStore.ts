/**
 * The bearer token, persisted so a reload does not need a fresh login (S1, mezo-qw37.1).
 * In-memory mirror first, localStorage second — a storage that throws (private mode,
 * blocked site data) degrades to session-only auth instead of crashing boot.
 */
export const TOKEN_KEY = 'mezo.auth.token'

let memory: string | null = null
let loaded = false

function readStorage(): string | null {
  try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
}

export const tokenStore = {
  get(): string | null {
    if (!loaded) { memory = readStorage() ?? memory; loaded = true }
    return memory
  },
  set(token: string | null): void {
    memory = token
    loaded = true
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token)
      else localStorage.removeItem(TOKEN_KEY)
    } catch { /* session-only */ }
  },
  clear(): void { this.set(null) },
}
