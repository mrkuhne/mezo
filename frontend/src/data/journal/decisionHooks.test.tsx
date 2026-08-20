import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isDecisionDue, useDecisionActions, useDecisions } from '@/data/hooks'
import { makeHookWrapper } from '@/test/queryWrapper'

describe('isDecisionDue', () => {
  it('is due when unreviewed and reviewDue is today or past', () => {
    const base = { id: 'd1', decidedOn: '2026-07-21', decisionText: 'x', createdAt: '2026-07-21T10:00:00Z' }
    expect(isDecisionDue({ ...base, reviewDue: '2026-08-20', reviewedAt: null, outcomeRating: null, outcomeText: null }, '2026-08-20')).toBe(true)
    expect(isDecisionDue({ ...base, reviewDue: '2026-08-01', reviewedAt: null, outcomeRating: null, outcomeText: null }, '2026-08-20')).toBe(true)
    expect(isDecisionDue({ ...base, reviewDue: '2026-09-01', reviewedAt: null, outcomeRating: null, outcomeText: null }, '2026-08-20')).toBe(false)
    expect(isDecisionDue({ ...base, reviewDue: '2026-08-01', reviewedAt: '2026-08-02T10:00:00Z', outcomeRating: 4, outcomeText: null }, '2026-08-20')).toBe(false)
  })
})

describe('useDecisions (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  it('seeds decisions newest-first', async () => {
    const { result } = renderHook(() => useDecisions(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.isPending).toBe(false))
    expect(result.current.data.length).toBeGreaterThan(0)
    const days = result.current.data.map((d) => d.decidedOn)
    expect([...days].sort().reverse()).toEqual(days)
  })

  it('adds a decision into the cached list', async () => {
    const wrapper = makeHookWrapper()
    const list = renderHook(() => useDecisions(), { wrapper })
    await waitFor(() => expect(list.result.current.isPending).toBe(false))
    const before = list.result.current.data.length
    const actions = renderHook(() => useDecisionActions(), { wrapper })
    await act(async () => {
      await actions.result.current.addDecision('Új döntés.', '2026-08-20')
    })
    await waitFor(() => expect(list.result.current.data.length).toBe(before + 1))
  })

  it('review stamps rating and reviewedAt on the cached row', async () => {
    const wrapper = makeHookWrapper()
    const list = renderHook(() => useDecisions(), { wrapper })
    await waitFor(() => expect(list.result.current.isPending).toBe(false))
    const openOne = list.result.current.data.find((d) => d.reviewedAt === null)!
    const actions = renderHook(() => useDecisionActions(), { wrapper })
    await act(async () => {
      await actions.result.current.reviewDecision(openOne.id, 4, 'Bejött.')
    })
    await waitFor(() => {
      const updated = list.result.current.data.find((d) => d.id === openOne.id)!
      expect(updated.outcomeRating).toBe(4)
      expect(updated.reviewedAt).not.toBeNull()
    })
  })
})
