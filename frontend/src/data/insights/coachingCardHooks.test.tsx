import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { mockCoachingCard } from '@/data/insights/coachingCardMock'
import { useCoachingCard } from '@/data/insights/coachingCardHooks'
import { mockCoachingDay } from '@/data/insights/coachingTraceMock'
import { API_BASE } from '@/test/msw/handlers'
import { server } from '@/test/msw/server'
import { makeHookWrapper } from '@/test/queryWrapper'

describe('mock mode', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('the demo card IS the demo day’s winner — the two seeds cannot drift apart', () => {
    const { result } = renderHook(() => useCoachingCard('2026-09-03'),
      { wrapper: makeHookWrapper() })
    const day = mockCoachingDay('2026-09-03')
    expect(result.current.card?.flagKey).toBe(day.winner?.flagKey)
    expect(result.current.card?.id).toBe(day.winner?.cardId)
    expect(result.current.card?.kind).toBe('advice')
    expect(result.current.card?.actions?.length).toBeGreaterThan(0)
    expect(result.current.isPending).toBe(false)
  })

  test('the demo card carries the winner’s own evidence lines', () => {
    const day = mockCoachingDay('2026-09-03')
    const winner = day.rules.find((r) => r.flagKey === day.winner?.flagKey)
    expect(mockCoachingCard('2026-09-03').facts).toEqual(winner?.facts)
  })
})

describe('real mode', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('picks the day’s ONE advice row out of the feed', async () => {
    server.use(http.get(`${API_BASE}/api/proactive/feed`, () => HttpResponse.json([
      { id: 'm1', kind: 'morning', eyebrow: 'Reggel', body: ['jó reggelt'], refs: [],
        generatedAt: '2026-09-03T06:00:00Z' },
      { id: 'm2', kind: 'advice', eyebrow: 'Alvás', body: ['aludj többet'], refs: [],
        facts: ['x'], suggestions: ['y'], flagKey: 'sleep_debt',
        actions: [{ key: 'shift_sleep_anchor', label: 'Korábbi lefekvés' }],
        generatedAt: '2026-09-03T08:00:00Z' },
    ])))
    const { result } = renderHook(() => useCoachingCard('2026-09-03'),
      { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.card?.id).toBe('m2'))
    expect(result.current.card?.flagKey).toBe('sleep_debt')
  })

  test('an unresolved fetch is null, never the demo card', () => {
    const { result } = renderHook(() => useCoachingCard('2026-09-03'),
      { wrapper: makeHookWrapper() })
    expect(result.current.isPending).toBe(true)
    expect(result.current.card).toBeNull()
  })

  test('a day with no advice row is honestly empty, not an error', async () => {
    server.use(http.get(`${API_BASE}/api/proactive/feed`, () => HttpResponse.json([])))
    const { result } = renderHook(() => useCoachingCard('2026-09-03'),
      { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.isPending).toBe(false))
    expect(result.current.card).toBeNull()
    expect(result.current.isError).toBe(false)
  })
})
