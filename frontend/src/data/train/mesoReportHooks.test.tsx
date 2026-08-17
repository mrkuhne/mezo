import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { useMesoReport } from '@/data/train/mesoReportHooks'
import { makeHookWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'

const ID = 'b6f3a0e2-0000-4000-8000-0000000000aa'

const reportBody = (over: Record<string, unknown> = {}) => ({
  mesocycleId: ID,
  templateId: null,
  title: 'Lezárt blokk',
  startDate: '2026-02-12',
  endDate: '2026-04-23',
  closedAt: '2026-04-23T18:00:00Z',
  weeks: 8,
  selfEval: null,
  aiEval: null,
  aiEvalStatus: 'ready',
  aiEvalGeneratedAt: null,
  aiEvalEnabled: false,
  adherence: { plannedSessions: 24, completedSessions: 21, plannedWeeks: 8, completedWeeks: 8, completionPct: 88 },
  volume: null,
  strength: [],
  records: { medalCount: 0, top: [] },
  context: null,
  ...over,
})

const notFound = () =>
  HttpResponse.json([{ code: 'TRAIN_MESO_REPORT_NOT_FOUND', message: 'Nincs riport' }], { status: 404 })

describe('useMesoReport (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  it('resolves the report of an archived run', async () => {
    server.use(http.get(`${API_BASE}/api/train/mesocycles/:id/report`, () => HttpResponse.json(reportBody())))
    const { result } = renderHook(() => useMesoReport(ID), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.report?.title).toBe('Lezárt blokk'))
    expect(result.current.notFound).toBe(false)
    expect(result.current.report?.adherence.completionPct).toBe(88)
  })

  it('resolves a 404 to notFound (not an error loop)', async () => {
    let calls = 0
    server.use(
      http.get(`${API_BASE}/api/train/mesocycles/:id/report`, () => {
        calls += 1
        return notFound()
      }),
    )
    const { result } = renderHook(() => useMesoReport(ID), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.notFound).toBe(true))
    expect(result.current.report).toBeNull()
    expect(calls).toBe(1) // no retry storm
  })

  it('regenerate POSTs .../report/regenerate and refetches until the report exists', async () => {
    let generated = false
    let posted = 0
    server.use(
      http.get(`${API_BASE}/api/train/mesocycles/:id/report`, () =>
        generated ? HttpResponse.json(reportBody()) : notFound(),
      ),
      http.post(`${API_BASE}/api/train/mesocycles/:id/report/regenerate`, () => {
        posted += 1
        generated = true
        return new HttpResponse(null, { status: 202 })
      }),
    )
    const { result } = renderHook(() => useMesoReport(ID), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.notFound).toBe(true))

    await result.current.regenerate()

    await waitFor(() => expect(result.current.report?.title).toBe('Lezárt blokk'))
    expect(posted).toBe(1)
  })
})

describe('useMesoReport (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  it('serves the archived fixture report for meso-rec-03 synchronously', () => {
    const { result } = renderHook(() => useMesoReport('meso-rec-03'), { wrapper: makeHookWrapper() })
    expect(result.current.report?.title).toBe('Recovery rebuild · Tél')
    expect(result.current.pending).toBe(false)
    expect(result.current.notFound).toBe(false)
    // S2 keeps the AI block dark — the page must be able to hide it entirely.
    expect(result.current.report?.aiEvalEnabled).toBe(false)
    expect(result.current.report?.context).toBeNull()
  })

  it('reports notFound for any other id', () => {
    const { result } = renderHook(() => useMesoReport('meso-hyp-04'), { wrapper: makeHookWrapper() })
    expect(result.current.report).toBeNull()
    expect(result.current.notFound).toBe(true)
  })

  it('regenerate fills the cache so the offline demo can generate a report', async () => {
    const { result } = renderHook(() => useMesoReport('meso-hyp-04'), { wrapper: makeHookWrapper() })
    expect(result.current.notFound).toBe(true)

    await result.current.regenerate()

    await waitFor(() => expect(result.current.report).not.toBeNull())
    expect(result.current.report?.mesocycleId).toBe('meso-hyp-04')
    expect(result.current.notFound).toBe(false)
  })
})
