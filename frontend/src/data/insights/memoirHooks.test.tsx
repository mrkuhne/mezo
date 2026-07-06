import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { makeHookWrapper } from '@/test/queryWrapper'
import { useMemoir } from '@/data/insights/memoirHooks'
import { memoir as mockMemoir, anniversaryNote as mockAnniversaryNote } from '@/data/insights/insights'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('useMemoir (real mode default)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))

  it('maps the server memoir with a derived week label', async () => {
    server.use(
      http.get(`${API_BASE}/api/proactive/memoir`, () =>
        HttpResponse.json({
          weekStart: '2026-06-29',
          title: 'A várakozás hete',
          body: 'Szép hét volt.',
          anchors: [{ kind: 'Memory', label: '2026-07-01' }],
          generatedAt: '2026-07-05T19:00:00Z',
        }),
      ),
    )
    const { result } = renderHook(() => useMemoir(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.memoir).not.toBeNull())
    expect(result.current.memoir!.title).toBe('A várakozás hete')
    expect(result.current.memoir!.body).toBe('Szép hét volt.')
    expect(result.current.memoir!.week).toMatch(/^Hét \d+/)
    expect(result.current.memoir!.anchors).toEqual([{ kind: 'Memory', label: '2026-07-01' }])
    expect(result.current.anniversaryNote).toBeNull()
    expect(result.current.mode).toBe('live')
  })

  it('returns null memoir on the default 404', async () => {
    const { result } = renderHook(() => useMemoir(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.mode).toBe('live'))
    expect(result.current.memoir).toBeNull()
    expect(result.current.anniversaryNote).toBeNull()
  })
})

describe('useMemoir (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  it('returns the seed + anniversaryNote without fetching', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { result } = renderHook(() => useMemoir(), { wrapper: makeHookWrapper() })
    expect(result.current.memoir).toEqual(mockMemoir)
    expect(result.current.anniversaryNote).toBe(mockAnniversaryNote)
    expect(result.current.mode).toBe('mock')
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
