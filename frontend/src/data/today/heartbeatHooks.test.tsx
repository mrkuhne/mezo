import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { makeHookWrapper } from '@/test/queryWrapper'
import { useCompanionNote } from '@/data/today/heartbeatHooks'

afterEach(() => {
  vi.unstubAllEnvs()
})

const noteFixture = {
  date: '2026-07-07',
  window: 'evening',
  kind: 'closing',
  content: 'Szép zárás: az edzés és a víz is megvolt.',
  generatedAt: '2026-07-07T18:30:00Z',
}

describe('useCompanionNote (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))

  test('maps the wire note to CompanionNote', async () => {
    server.use(
      http.get(`${API_BASE}/api/proactive/heartbeat`, () => HttpResponse.json(noteFixture)),
    )
    const { result } = renderHook(() => useCompanionNote(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current).not.toBeNull())
    expect(result.current).toEqual({
      window: 'evening',
      kind: 'closing',
      text: 'Szép zárás: az edzés és a víz is megvolt.',
    })
  })

  test('returns null on the default 404 (honest absence)', async () => {
    const { result } = renderHook(() => useCompanionNote(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current).toBeNull())
  })
})

describe('useCompanionNote (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  test('is null without fetching (Phase-1 byte-parity — no such card in mock)', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { result } = renderHook(() => useCompanionNote(), { wrapper: makeHookWrapper() })
    expect(result.current).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
