import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { makeHookWrapper } from '@/test/queryWrapper'
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

test('real mode: login stores the token', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(http.post(`${API_BASE}/api/auth/login`, () => HttpResponse.json({ token: 'fresh' })))
  const { result } = renderHook(() => useAuthActions(), { wrapper: makeHookWrapper() })
  await result.current.login({ email: 'a@b.c', password: 'x' })
  expect(tokenStore.get()).toBe('fresh')
})

test('logout clears the token and the query cache', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  setToken('t')
  const wrapper = makeHookWrapper()
  const me = renderHook(() => useMe(), { wrapper })
  await waitFor(() => expect(me.result.current.data).toBeDefined())
  const actions = renderHook(() => useAuthActions(), { wrapper })
  actions.result.current.logout()
  expect(tokenStore.get()).toBeNull()
})
