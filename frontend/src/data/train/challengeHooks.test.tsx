import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { useChallengeActions, useChallenges } from '@/data/train/challengeHooks'
import { API_BASE } from '@/test/msw/handlers'
import { server } from '@/test/msw/server'
import { makeHookWrapper } from '@/test/queryWrapper'

const SESSION = 'a1f3a0e2-0000-4000-8000-000000000010'
const DATE = '2026-07-07'

const prRow = {
  id: 'ch-1',
  exerciseId: 'ex-1',
  exercise: 'Chest Supported Row',
  type: 'PR',
  typeLabel: 'PR-attempt',
  status: 'proposed',
  target: '107.5 kg × 8',
  confidence: null,
  risk: 'low',
  why: 'Teszt indoklás.',
  glory: 'Új csúcs',
  refs: [{ kind: 'PR', label: 'Chest Row 105.8 · Márc 4' }],
  outcome: null,
  outcomeGood: null,
  generatedAt: '2026-07-07T06:45:00Z',
}

describe('useChallenges (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('maps a PR wire row, preserving null confidence', async () => {
    server.use(
      http.get(`${API_BASE}/api/proactive/challenge`, () => HttpResponse.json([prRow])),
    )
    const { result } = renderHook(() => useChallenges(SESSION, DATE), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.challenges).toHaveLength(1))
    const c = result.current.challenges[0]
    expect(c.type).toBe('PR')
    expect(c.status).toBe('proposed')
    expect(c.confidence).toBeNull()
    expect(c.tools).toBeUndefined()
    expect(result.current.mode).toBe('live')
  })

  test('returns [] on the default empty array (honest empty state)', async () => {
    const { result } = renderHook(() => useChallenges(SESSION, DATE), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.mode).toBe('live'))
    expect(result.current.challenges).toEqual([])
  })

  // The lazy-on-prep LLM generation gap (1-3s, observed in prod 2026-07-24) — the carousel
  // must render a visible skeleton for this window instead of silently showing nothing.
  // NOTE: kept BEFORE "stays disabled" below — that test's `vi.spyOn(fetch)` is never
  // restored, so it persists as a shared spy for the rest of the file; a real fetch fired
  // after it would pollute its call count for any later fetch-spy assertion.
  test('pending is true while the list query is in flight (the lazy generation gap)', () => {
    server.use(http.get(`${API_BASE}/api/proactive/challenge`, () => new Promise(() => {}))) // never resolves
    const { result } = renderHook(() => useChallenges(SESSION, DATE), { wrapper: makeHookWrapper() })
    expect(result.current.pending).toBe(true)
    expect(result.current.challenges).toEqual([])
  })

  test('pending flips to false once the list resolves (even to the honest empty array)', async () => {
    const { result } = renderHook(() => useChallenges(SESSION, DATE), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.pending).toBe(false))
    expect(result.current.challenges).toEqual([])
  })

  test('stays disabled (no fetch) until a templateSessionId exists', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { result } = renderHook(() => useChallenges(null, DATE), { wrapper: makeHookWrapper() })
    expect(result.current.challenges).toEqual([])
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

describe('useChallenges (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('returns the seed without fetching', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { result } = renderHook(() => useChallenges(null, DATE), { wrapper: makeHookWrapper() })
    expect(result.current.mode).toBe('mock')
    expect(result.current.challenges.length).toBeGreaterThan(0)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  test('pending is always false (the seed resolves synchronously)', () => {
    const { result } = renderHook(() => useChallenges(null, DATE), { wrapper: makeHookWrapper() })
    expect(result.current.pending).toBe(false)
  })
})

describe('useChallengeActions (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('decide posts the decision and invalidates the list (refetch)', async () => {
    let getCalls = 0
    let posted: unknown = null
    server.use(
      http.get(`${API_BASE}/api/proactive/challenge`, () => {
        getCalls += 1
        return HttpResponse.json([prRow])
      }),
      http.post(`${API_BASE}/api/proactive/challenge/:id/decision`, async ({ request }) => {
        posted = await request.json()
        return HttpResponse.json({ ...prRow, status: 'accepted' })
      }),
    )
    const wrapper = makeHookWrapper()
    const list = renderHook(() => useChallenges(SESSION, DATE), { wrapper })
    const actions = renderHook(() => useChallengeActions(SESSION, DATE), { wrapper })
    await waitFor(() => expect(list.result.current.challenges).toHaveLength(1))
    expect(getCalls).toBe(1)

    actions.result.current.decide('ch-1', 'accept')
    await waitFor(() => expect(posted).toEqual({ decision: 'accept' }))
    await waitFor(() => expect(getCalls).toBe(2))
  })
})
