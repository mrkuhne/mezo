import { renderHook, waitFor, act } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { useIntentionDay, useIntentionActions } from '@/data/intention/intentionHooks'
import { API_BASE } from '@/data/_client/api'
import { server } from '@/test/msw/server'
import { makeHookWrapper } from '@/test/queryWrapper'

const DATE = '2026-07-20'

describe('useIntentionDay (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('serves the seed synchronously (creed + foci)', () => {
    const { result } = renderHook(() => useIntentionDay(DATE), { wrapper: makeHookWrapper() })
    expect(result.current.data.creed).toBeTruthy()
    expect(result.current.data.focusCap).toBe(3)
  })

  test('addFocus appends within the cap', async () => {
    const wrapper = makeHookWrapper()
    const day = renderHook(() => useIntentionDay(DATE), { wrapper })
    const actions = renderHook(() => useIntentionActions(DATE), { wrapper })
    const before = day.result.current.data.foci.length
    await act(() => actions.result.current.addFocus('Új fókusz.'))
    await waitFor(() => expect(day.result.current.data.foci.length).toBe(before + 1))
  })
})

describe('useIntentionDay (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('honest-empty while unresolved — never the seed', () => {
    const { result } = renderHook(() => useIntentionDay(DATE), { wrapper: makeHookWrapper() })
    expect(result.current.data.foci).toHaveLength(0)
    expect(result.current.data.creed).toBeNull()
  })

  test('maps the wire day', async () => {
    server.use(http.get(`${API_BASE}/api/intention/day/${DATE}`, () =>
      HttpResponse.json({
        date: DATE,
        creed: 'Élő hitvallás.',
        foci: [{ id: 'if-live', focusDate: DATE, text: 'Élő fókusz.' }],
        reflection: 'partial',
        focusCap: 3,
      })))
    const { result } = renderHook(() => useIntentionDay(DATE), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.data.foci).toHaveLength(1))
    expect(result.current.data.creed).toBe('Élő hitvallás.')
    expect(result.current.data.reflection).toBe('partial')
  })
})
