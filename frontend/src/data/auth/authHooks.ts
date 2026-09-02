import { useQuery, useQueryClient } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { tokenStore } from '@/data/_client/tokenStore'
import { authEvents } from '@/data/_client/authEvents'
import { authApi, type ChangePasswordRequest, type LoginRequest, type RegisterRequest } from '@/data/auth/authApi'
import { mockMe } from '@/data/auth/authMock'

export const ME_QUERY_KEY = ['auth', 'me'] as const

/**
 * The signed-in account. Mock mode: the static owner, synchronous (`initialData` +
 * `staleTime: Infinity`, no fetch). Real mode: GET /api/auth/me, only enabled while a
 * token exists (no token = signed out, nothing to ask) — never falls back to the mock
 * seed (dual-mode read invariant: this hook returns the raw useQuery result, so `data`
 * is `undefined` while a real-mode fetch is pending, never `mockMe`).
 *
 * The `enabled` gate is read at RENDER time, so it does NOT by itself pick up a token
 * that appears later — `invalidateQueries` skips an observer whose last-rendered `enabled`
 * was false, and an invalidation that leaves `.data` unchanged notifies nothing that would
 * force a re-render. What actually makes the post-login value show up is that
 * `useAuthActions().login`/`register` fetch `authApi.me()` themselves and push it straight
 * into the cache with `client.setQueryData(ME_QUERY_KEY, me)` — a write any mounted `useMe()`
 * observer picks up immediately, and a freshly-mounted one (e.g. after `AuthGate` swaps to
 * the signed-in tree) reads back from cache with no fetch needed. The `enabled` gate here
 * only has to cover "don't ask when we know there's no token" on cold/reload renders.
 */
export function useMe() {
  const mock = isMockMode()
  return useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: authApi.me,
    ...(mock
      ? { initialData: mockMe, staleTime: Infinity }
      : { enabled: tokenStore.get() != null, retry: false }),
  })
}

export function useAuthActions() {
  const client = useQueryClient()
  const refresh = () => client.invalidateQueries({ queryKey: ME_QUERY_KEY })
  /**
   * Fetches the just-authenticated account and pushes it directly into the cache — the
   * deterministic alternative to hoping a re-enabled query happens to refetch (see the
   * `useMe` doc comment). Any mounted `useMe()` observer sees the write immediately.
   */
  const seedMe = async () => {
    const me = await authApi.me()
    client.setQueryData(ME_QUERY_KEY, me)
  }
  return {
    // client.clear() runs BEFORE the request/token write, not after: this is what still
    // protects a login that follows an automatic sign-out (session expired / account
    // disabled — those paths only clear the token, not the cache) rather than a manual
    // logout. Without this, every OTHER cached key (meals, weight, check-ins, …) would
    // keep rendering the PREVIOUS account's data — stale-while-revalidate, possibly
    // forever for a long/Infinity staleTime query — until something happens to refetch
    // it. This is the account-isolation boundary the whole slice exists to enforce.
    login: async (body: LoginRequest) => {
      client.clear()
      await authApi.login(body)
      await seedMe()
    },
    register: async (body: RegisterRequest) => {
      client.clear()
      await authApi.register(body)
      await seedMe()
    },
    changePassword: async (body: ChangePasswordRequest) => { await authApi.changePassword(body); await refresh() },
    completeOnboarding: async () => { await authApi.completeOnboarding(); await refresh() },
    logout: () => { tokenStore.clear(); client.clear(); authEvents.emitSignedOut('manual') },
  }
}
