/**
 * Dual-mode switch for the swapped data hooks. Default = mock, so a missing
 * `VITE_USE_MOCK` never breaks `pnpm dev` or the Playwright parity run (which
 * run without a backend). Call this INSIDE hook bodies — never at module
 * scope — so tests can stub it per-case with `vi.stubEnv`.
 */
export const isMockMode = () => import.meta.env.VITE_USE_MOCK !== 'false'
