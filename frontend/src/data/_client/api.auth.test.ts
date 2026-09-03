import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE, apiFetch, setToken } from '@/data/_client/api'
import { tokenStore } from '@/data/_client/tokenStore'
import { authEvents } from '@/data/_client/authEvents'

beforeEach(() => { localStorage.clear(); setToken(null) })

test('apiFetch attaches the persisted token as Bearer', async () => {
  let seen: string | null = null
  server.use(http.get(`${API_BASE}/api/ping`, ({ request }) => { seen = request.headers.get('authorization'); return HttpResponse.json({ ok: true }) }))
  tokenStore.set('persisted')
  await apiFetch('/api/ping')
  expect(seen).toBe('Bearer persisted')
})

test('a 401 clears the token and emits signedOut(expired)', async () => {
  server.use(http.get(`${API_BASE}/api/ping`, () => new HttpResponse(null, { status: 401 })))
  setToken('stale')
  const reasons: string[] = []
  const off = authEvents.onSignedOut((r) => reasons.push(r))
  await expect(apiFetch('/api/ping')).rejects.toMatchObject({ status: 401 })
  expect(tokenStore.get()).toBeNull()
  expect(reasons).toEqual(['expired'])
  off()
})

test('a 403 AUTH_ACCOUNT_DISABLED clears the token and emits signedOut(disabled)', async () => {
  server.use(http.get(`${API_BASE}/api/ping`, () =>
    HttpResponse.json([{ code: 'AUTH_ACCOUNT_DISABLED', message: 'x' }], { status: 403 })))
  setToken('t')
  const reasons: string[] = []
  const off = authEvents.onSignedOut((r) => reasons.push(r))
  await expect(apiFetch('/api/ping')).rejects.toMatchObject({ status: 403 })
  expect(tokenStore.get()).toBeNull()
  expect(reasons).toEqual(['disabled'])
  off()
})

test('a 403 AUTH_FORBIDDEN keeps the token (not a session problem)', async () => {
  server.use(http.get(`${API_BASE}/api/ping`, () =>
    HttpResponse.json([{ code: 'AUTH_FORBIDDEN', message: 'x' }], { status: 403 })))
  setToken('t')
  await expect(apiFetch('/api/ping')).rejects.toMatchObject({ status: 403 })
  expect(tokenStore.get()).toBe('t')
})

test('a 401 on /api/auth/login does NOT emit signedOut (wrong password is not a dead session)', async () => {
  server.use(http.post(`${API_BASE}/api/auth/login`, () =>
    HttpResponse.json([{ code: 'AUTH_LOGIN_INVALID_CREDENTIALS', message: 'x' }], { status: 401 })))
  const reasons: string[] = []
  const off = authEvents.onSignedOut((r) => reasons.push(r))
  await expect(apiFetch('/api/auth/login', { method: 'POST', body: '{}' })).rejects.toMatchObject({ status: 401 })
  expect(reasons).toEqual([])
  off()
})
