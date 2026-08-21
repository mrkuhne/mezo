import { act, renderHook, waitFor } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isDecisionDue, useDecisionActions, useDecisions } from '@/data/hooks'
import { API_BASE } from '@/data/_client/api'
import { server } from '@/test/msw/server'
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

  it('adds a decision into the cached list, sorted newest-first', async () => {
    const wrapper = makeHookWrapper()
    const list = renderHook(() => useDecisions(), { wrapper })
    await waitFor(() => expect(list.result.current.isPending).toBe(false))
    const before = list.result.current.data.length
    const actions = renderHook(() => useDecisionActions(), { wrapper })
    await act(async () => {
      await actions.result.current.addDecision('Új döntés.', '2026-08-20')
    })
    await waitFor(() => expect(list.result.current.data.length).toBe(before + 1))
    // 2026-08-20 is later than every seeded decidedOn (newest seed is dec3, 2026-08-18), so the
    // new row must sort to the very front, not merely appear somewhere in the list.
    expect(list.result.current.data[0].decisionText).toBe('Új döntés.')
    expect(list.result.current.data[0].decidedOn).toBe('2026-08-20')
  })

  it('addDecision derives reviewDue as decidedOn + 30 local-calendar days (mock mirror of the backend default)', async () => {
    const wrapper = makeHookWrapper()
    const list = renderHook(() => useDecisions(), { wrapper })
    await waitFor(() => expect(list.result.current.isPending).toBe(false))
    const actions = renderHook(() => useDecisionActions(), { wrapper })
    // 2026-08-18 + 30 days crosses a month end into September (2026-08-18 -> 2026-09-17). A
    // UTC-reserializing implementation (Date#setDate + toISOString().slice(0,10)) lands a day
    // early — 2026-09-16 — for any positive UTC offset, so this pins the exact boundary.
    let created
    await act(async () => {
      created = await actions.result.current.addDecision('Határnap teszt.', '2026-08-18')
    })
    expect(created!.reviewDue).toBe('2026-09-17')
    await waitFor(() => {
      const row = list.result.current.data.find((d) => d.decisionText === 'Határnap teszt.')!
      expect(row.reviewDue).toBe('2026-09-17')
    })
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

describe('useDecisions (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  it('honest-empty while unresolved, then resolves the default handler', async () => {
    const { result } = renderHook(() => useDecisions(), { wrapper: makeHookWrapper() })
    expect(result.current.data).toEqual([])
    await waitFor(() => expect(result.current.isPending).toBe(false))
    // isError:false pins this to the MSW default handler's real 200 response — without it, an
    // unhandled request (bypassed per test/setup.ts) would settle on the SAME empty-array/
    // non-pending state via the error path, silently proving nothing about the mapping.
    expect(result.current.isError).toBe(false)
    expect(result.current.data).toEqual([])
  })

  it('maps a wire row and normalizes undefined reviewedAt/outcomeRating/outcomeText to null', async () => {
    server.use(
      http.get(`${API_BASE}/api/journal/decision`, () =>
        HttpResponse.json([
          {
            id: 'dec-live',
            decidedOn: '2026-08-19',
            decisionText: 'Élő döntés.',
            reviewDue: '2026-09-18',
            createdAt: '2026-08-19T09:00:00Z',
            // reviewedAt / outcomeRating / outcomeText genuinely absent from the wire payload
          },
        ]),
      ),
    )
    const { result } = renderHook(() => useDecisions(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.data).toHaveLength(1))
    expect(result.current.data[0]).toEqual({
      id: 'dec-live',
      decidedOn: '2026-08-19',
      decisionText: 'Élő döntés.',
      reviewDue: '2026-09-18',
      reviewedAt: null,
      outcomeRating: null,
      outcomeText: null,
      createdAt: '2026-08-19T09:00:00Z',
    })
  })
})

describe('useDecisionActions (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  it('addDecision POSTs the expected body and resolves the mapped row', async () => {
    let capturedBody: unknown
    server.use(
      http.post(`${API_BASE}/api/journal/decision`, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json(
          {
            id: 'dec-new',
            decidedOn: '2026-08-20',
            decisionText: 'Élő új döntés.',
            reviewDue: '2026-09-19',
            reviewedAt: null,
            outcomeRating: null,
            outcomeText: null,
            createdAt: '2026-08-20T12:00:00Z',
          },
          { status: 201 },
        )
      }),
    )
    const { result } = renderHook(() => useDecisionActions(), { wrapper: makeHookWrapper() })
    let created
    await act(async () => {
      created = await result.current.addDecision('Élő új döntés.', '2026-08-20')
    })
    expect(capturedBody).toEqual({ decisionText: 'Élő új döntés.', decidedOn: '2026-08-20' })
    expect(created!.id).toBe('dec-new')
    expect(created!.reviewDue).toBe('2026-09-19')
  })

  it('reviewDecision PUTs to /{id}/review with the expected body and resolves the mapped row', async () => {
    let capturedBody: unknown
    server.use(
      http.put(`${API_BASE}/api/journal/decision/dec-1/review`, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json({
          id: 'dec-1',
          decidedOn: '2026-07-21',
          decisionText: 'Régi döntés.',
          reviewDue: '2026-08-20',
          reviewedAt: '2026-08-20T10:00:00Z',
          outcomeRating: 5,
          outcomeText: 'Nagyon bevált.',
          createdAt: '2026-07-21T21:30:00Z',
        })
      }),
    )
    const { result } = renderHook(() => useDecisionActions(), { wrapper: makeHookWrapper() })
    let updated
    await act(async () => {
      updated = await result.current.reviewDecision('dec-1', 5, 'Nagyon bevált.')
    })
    expect(capturedBody).toEqual({ outcomeRating: 5, outcomeText: 'Nagyon bevált.' })
    expect(updated!.outcomeRating).toBe(5)
    expect(updated!.reviewedAt).toBe('2026-08-20T10:00:00Z')
  })
})
