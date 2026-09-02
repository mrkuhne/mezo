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
 * The `enabled` check runs at RENDER time, so it does not by itself re-enable this query
 * the instant a token appears after a fresh login — `useAuthActions().login` handles that
 * by invalidating `ME_QUERY_KEY` after `authApi.login` resolves (token already stored by
 * then), which triggers a refetch on the now-enabled query in every mounted observer.
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
  return {
    login: async (body: LoginRequest) => { await authApi.login(body); await refresh() },
    register: async (body: RegisterRequest) => { await authApi.register(body); await refresh() },
    changePassword: async (body: ChangePasswordRequest) => { await authApi.changePassword(body); await refresh() },
    completeOnboarding: async () => { await authApi.completeOnboarding(); await refresh() },
    logout: () => { tokenStore.clear(); client.clear(); authEvents.emitSignedOut('manual') },
  }
}
