import { renderHook, waitFor, act } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/data/_client/api'
import { QueryWrapper } from '@/test/queryWrapper'
import { isMockMode } from '@/data/_client/mode'
import {
  useEffectSubjects, useFactEvidence, useKnowledgeHubActions, useKnowledgeObservations,
} from '@/data/insights/knowledgeHubHooks'
import { MOCK_OBSERVATIONS, MOCK_EFFECT_SUBJECTS } from '@/data/insights/knowledgeHub'

describe('useKnowledgeObservations', () => {
  it('serves the seed (mock) or the MSW fixture (real) — same observations in both modes', async () => {
    const { result } = renderHook(() => useKnowledgeObservations(), { wrapper: QueryWrapper })
    await waitFor(() => expect(result.current.isPending).toBe(false))
    expect(result.current.observations.map((o) => o.patternId)).toEqual(MOCK_OBSERVATIONS.map((o) => o.patternId))
  })

  it('round-trips the refuted o4 row with its muted-by-refutation fact in both modes', async () => {
    const { result } = renderHook(() => useKnowledgeObservations(), { wrapper: QueryWrapper })
    await waitFor(() => expect(result.current.isPending).toBe(false))
    const o4 = result.current.observations.find((o) => o.patternId === 'o4')
    expect(o4).toMatchObject({
      status: 'refuted', factId: 'f16', factMutedReason: 'refuted', factMutedAt: '2026-09-16T03:40:00Z',
    })
  })

  it.runIf(!isMockMode())('maps a 404 to degraded, never to an error', async () => {
    server.use(http.get(`${API_BASE}/api/companion/observation/knowledge`, () => HttpResponse.json([], { status: 404 })))
    const { result } = renderHook(() => useKnowledgeObservations(), { wrapper: QueryWrapper })
    await waitFor(() => expect(result.current.degraded).toBe(true))
    expect(result.current.isError).toBe(false)
  })
})

describe('useEffectSubjects', () => {
  it('groups the effects per subject in both modes', async () => {
    const { result } = renderHook(() => useEffectSubjects(), { wrapper: QueryWrapper })
    await waitFor(() => expect(result.current.isPending).toBe(false))
    expect(result.current.subjects.map((s) => s.key)).toEqual(MOCK_EFFECT_SUBJECTS.map((s) => s.key))
  })
})

describe('useFactEvidence', () => {
  it('does not fetch without a fact id', () => {
    const { result } = renderHook(() => useFactEvidence(null), { wrapper: QueryWrapper })
    expect(result.current.evidence).toEqual([])
  })
})

describe('useKnowledgeHubActions', () => {
  it.runIf(!isMockMode())('forgetFact sends exactly one DELETE', async () => {
    let calls = 0
    server.use(http.delete(`${API_BASE}/api/companion/fact/:id`, () => { calls++; return new HttpResponse(null, { status: 204 }) }))
    const { result } = renderHook(() => useKnowledgeHubActions(), { wrapper: QueryWrapper })
    await act(() => result.current.forgetFact('f9'))
    expect(calls).toBe(1)
  })
})
