import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { makeHookWrapper, makeHookWrapperWithClient } from '@/test/queryWrapper'
import { API_BASE, setToken } from '@/data/_client/api'
import { useMe, useAuthActions } from '@/data/auth/authHooks'
import { tokenStore } from '@/data/_client/tokenStore'

afterEach(() => { vi.unstubAllEnvs(); localStorage.clear(); setToken(null) })

test('mock mode: useMe returns the static owner without fetching', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  const { result } = renderHook(() => useMe(), { wrapper: makeHookWrapper() })
  await waitFor(() => expect(result.current.data?.name).toBe('Daniel'))
  expect(result.current.data?.role).toBe('OWNER')
})

test('real mode: useMe fetches /api/auth/me', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  setToken('t')
  const { result } = renderHook(() => useMe(), { wrapper: makeHookWrapper() })
  await waitFor(() => expect(result.current.data?.email).toBe('owner@mezo.local'))
})

test('real mode: useMe without a token does not fetch', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  let requested = false
  server.use(http.get(`${API_BASE}/api/auth/me`, () => { requested = true; return HttpResponse.json({}) }))
  const { result } = renderHook(() => useMe(), { wrapper: makeHookWrapper() })
  // No token was set (afterEach clears it, and this test sets none) — the query must stay
  // disabled: idle fetch status, no data, and the handler above must never be hit.
  expect(result.current.fetchStatus).toBe('idle')
  expect(result.current.data).toBeUndefined()
  expect(requested).toBe(false)
})

test('real mode: login stores the token', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(http.post(`${API_BASE}/api/auth/login`, () => HttpResponse.json({ token: 'fresh' })))
  const { result } = renderHook(() => useAuthActions(), { wrapper: makeHookWrapper() })
  await result.current.login({ email: 'a@b.c', password: 'x' })
  expect(tokenStore.get()).toBe('fresh')
})

test('real mode: login clears cached data from a previous account', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(http.post(`${API_BASE}/api/auth/login`, () => HttpResponse.json({ token: 'fresh' })))
  const { wrapper, client } = makeHookWrapperWithClient()
  // Simulate a previous account's cached data left over from before an automatic
  // sign-out (session expired / account disabled) — those paths only clear the token,
  // never the cache, so this key must still be wiped by login itself.
  client.setQueryData(['weight'], [{ id: 'w1', value: 82.5 }])
  const { result } = renderHook(() => useAuthActions(), { wrapper })
  await result.current.login({ email: 'a@b.c', password: 'x' })
  expect(client.getQueryData(['weight'])).toBeUndefined()
})

test('logout clears the token and the query cache', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  setToken('t')
  const { wrapper, client } = makeHookWrapperWithClient()
  client.setQueryData(['weight'], [{ id: 'w1', value: 82.5 }])
  const me = renderHook(() => useMe(), { wrapper })
  await waitFor(() => expect(me.result.current.data).toBeDefined())
  const actions = renderHook(() => useAuthActions(), { wrapper })
  actions.result.current.logout()
  expect(tokenStore.get()).toBeNull()
  expect(client.getQueryData(ME_QUERY_KEY_FOR_TEST)).toBeUndefined()
  expect(client.getQueryData(['weight'])).toBeUndefined()
})

// Local copy of the hook module's query key — kept intentionally decoupled from an import
// so this assertion checks the real cache key contract, not just whatever the module exports.
const ME_QUERY_KEY_FOR_TEST = ['auth', 'me'] as const
