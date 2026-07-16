/**
 * Dual-mode switch for the swapped data hooks. Default = mock, so a missing
 * `VITE_USE_MOCK` never breaks `pnpm dev` or the backend-free runs (the S8
 * visual baselines, component tests, demos). Call this INSIDE hook bodies — never at module
 * scope — so tests can stub it per-case with `vi.stubEnv`.
 */
export const isMockMode = () => import.meta.env.VITE_USE_MOCK !== 'false'
