import { act, renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, expect, test, vi } from 'vitest'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { makeHookWrapper } from '@/test/queryWrapper'
import { useCharacterCouncilStatus, useCharacterClaimRevisions } from '@/data/character/characterCouncilHooks'

afterEach(() => vi.unstubAllEnvs())
test('status serves the actual source-through day', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(http.get(`${API_BASE}/api/character/council`, () => HttpResponse.json({ day: '2026-09-21', sourceThrough: '2026-09-20', status: 'QUIET' })))
  const { result } = renderHook(() => useCharacterCouncilStatus(), { wrapper: makeHookWrapper() })
  expect(result.current.status).toBeNull()
  await waitFor(() => expect(result.current.status?.sourceThrough).toBe('2026-09-20'))
  expect(result.current.status?.status).toBe('QUIET')
})

test('failed status reads stay unknown rather than claiming completion', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(http.get(`${API_BASE}/api/character/council`, () => new HttpResponse(null, { status: 503 })))
  const { result } = renderHook(() => useCharacterCouncilStatus(), { wrapper: makeHookWrapper() })
  await waitFor(() => expect(result.current.isError).toBe(true))
  expect(result.current.status).toBeNull()
})

test('undo invalidates revisions and preserves data when the backend rejects a stale undo', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const revision = { id: 'r1', claimId: 'c1', operation: 'UPDATE', beforeText: 'Korábban', afterText: 'Most', reason: 'Új adat', canUndo: true, createdAt: '2026-09-21T06:00:00Z' }
  let undone = false
  server.use(
    http.get(`${API_BASE}/api/character/claims/c1/revisions`, () => HttpResponse.json([{ ...revision, canUndo: !undone, undoneAt: undone ? '2026-09-21T07:00:00Z' : null }])),
    http.post(`${API_BASE}/api/character/revisions/r1/undo`, () => { undone = true; return HttpResponse.json({ ...revision, canUndo: false, undoneAt: '2026-09-21T07:00:00Z' }) }),
  )
  const { result } = renderHook(() => useCharacterClaimRevisions('c1'), { wrapper: makeHookWrapper() })
  await waitFor(() => expect(result.current.revisions).toHaveLength(1))
  await act(async () => { await result.current.undo('r1') })
  await waitFor(() => expect(result.current.revisions[0].canUndo).toBe(false))
  server.use(http.post(`${API_BASE}/api/character/revisions/r1/undo`, () => new HttpResponse(null, { status: 409 })))
  await act(async () => { await expect(result.current.undo('r1')).rejects.toThrow() })
  expect(result.current.revisions[0].afterText).toBe('Most')
})
