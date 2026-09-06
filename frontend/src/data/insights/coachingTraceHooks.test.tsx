import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { mockCoachingDay } from '@/data/insights/coachingTraceMock'
import { useCoachingTrace } from '@/data/insights/coachingTraceHooks'
import { API_BASE } from '@/test/msw/handlers'
import { server } from '@/test/msw/server'
import { makeHookWrapper } from '@/test/queryWrapper'

describe('mock mode', () => {
  // Explicit stub, not reliance on the ambient default: `VITE_USE_MOCK` unset means mock, but a
  // caller running the suite a SECOND time with the real env var forced to 'false' (the
  // real-mode gate check) must not flip these tests to real mode too.
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('serves a deterministic day exercising all five screen states', () => {
    const { result } = renderHook(() => useCoachingTrace('2026-09-03'),
      { wrapper: makeHookWrapper() })
    const day = result.current.day
    expect(result.current.isPending).toBe(false)
    expect(day.rules).toHaveLength(13)
    expect(day.rules.map((r) => r.rank)).toEqual(Array.from({ length: 13 }, (_, i) => i + 1))
    expect(day.rules.some((r) => r.outcome === 'raised' && r.disposition === 'logged')).toBe(true)
    expect(day.rules.some((r) => r.outcome === 'clear')).toBe(true)
    expect(day.rules.some((r) => r.outcome === 'unavailable')).toBe(true)
    expect(day.rules.some((r) => r.disposition === 'suppressed_by_cooldown')).toBe(true)
    expect(day.rules.some((r) => r.cardOutcome === 'won')).toBe(true)
    expect(day.rules.some((r) => r.cardOutcome === 'lost')).toBe(true)
    expect(day.winner?.flagKey).toBe(day.rules.find((r) => r.cardOutcome === 'won')?.flagKey)
    expect(day.transitions.length).toBeGreaterThan(0)
  })

  test('every mock rule carries a label, a domain and an explanation', () => {
    for (const rule of mockCoachingDay('2026-09-03').rules) {
      expect(rule.label).not.toBe('')
      expect(rule.domain).not.toBe('')
      expect(rule.reasonText).not.toBe('')
    }
  })
})

describe('real mode', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('maps the wire day and never returns the mock seed', async () => {
    server.use(http.get(`${API_BASE}/api/companion/flags/trace`, () => HttpResponse.json({
      date: '2026-09-03',
      earliestDate: '2026-09-01',
      winner: { flagKey: 'sleep_debt', rank: 6, cardId: 'c1' },
      rules: [{
        flagKey: 'sleep_debt', label: 'Alvásadósság', domain: 'sleep', rank: 6,
        outcome: 'raised', reasonText: 'Alvásadósság: 1,4 óra/éjszaka', facts: ['x'],
        disposition: 'logged', cardOutcome: 'won', changedAt: '2026-09-03T07:00:00Z',
      }],
      transitions: [{
        at: '2026-09-03T07:00:00Z', flagKey: 'sleep_debt', label: 'Alvásadósság',
        from: 'clear', to: 'raised', reasonText: 'A szabály jelzett.',
      }],
    })))
    const { result } = renderHook(() => useCoachingTrace('2026-09-03'),
      { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.day.rules).toHaveLength(1))
    expect(result.current.day.winner?.cardId).toBe('c1')
    expect(result.current.day.rules[0].cardOutcome).toBe('won')
  })

  test('an unresolved fetch shows an empty day, never the mock seed', () => {
    const { result } = renderHook(() => useCoachingTrace('2026-09-03'),
      { wrapper: makeHookWrapper() })
    expect(result.current.isPending).toBe(true)
    expect(result.current.day.rules).toEqual([])
  })

  test('a rule the frontend has never seen still arrives whole (the round-2 guarantee)', async () => {
    server.use(http.get(`${API_BASE}/api/companion/flags/trace`, () => HttpResponse.json({
      date: '2026-09-03',
      rules: [{
        flagKey: 'round_two_rule', label: 'Új szabály', domain: 'something_new', rank: 1,
        outcome: 'clear', reasonText: 'Rendben.', facts: [],
      }],
      transitions: [],
    })))
    const { result } = renderHook(() => useCoachingTrace('2026-09-03'),
      { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.day.rules).toHaveLength(1))
    expect(result.current.day.rules[0].label).toBe('Új szabály')
    expect(result.current.day.rules[0].domain).toBe('something_new')
  })
})
