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
  // Backend parity: every S2 report is written `pending` with the feature off (the entity
  // default; regenerate resets to it). Tests that want the poll opt in via `aiEvalEnabled`.
  aiEvalStatus: 'pending',
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

/** The hook's poll cadence (mesoReportHooks POLL_MS) — the waits below are measured in it. */
const POLL_MS = 3000
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

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

  // --- the polling rule, pinned from both sides ---

  it(
    'does NOT poll a pending AI eval while the feature is off (all of S2)',
    async () => {
      let calls = 0
      server.use(
        http.get(`${API_BASE}/api/train/mesocycles/:id/report`, () => {
          calls += 1
          return HttpResponse.json(reportBody({ aiEvalStatus: 'pending', aiEvalEnabled: false }))
        }),
      )
      const { result } = renderHook(() => useMesoReport(ID), { wrapper: makeHookWrapper() })
      await waitFor(() => expect(result.current.report).not.toBeNull())
      expect(calls).toBe(1)

      // Sit through more than one poll window: a `pending` status alone must not re-read.
      await wait(POLL_MS + 500)
      expect(calls).toBe(1)
    },
    15_000,
  )

  it(
    'DOES poll while a pending AI eval is actually enabled (the S3 path)',
    async () => {
      let calls = 0
      server.use(
        http.get(`${API_BASE}/api/train/mesocycles/:id/report`, () => {
          calls += 1
          return HttpResponse.json(reportBody({ aiEvalStatus: 'pending', aiEvalEnabled: true }))
        }),
      )
      const { result } = renderHook(() => useMesoReport(ID), { wrapper: makeHookWrapper() })
      await waitFor(() => expect(result.current.report).not.toBeNull())
      expect(calls).toBe(1)

      await wait(POLL_MS + 500)
      expect(calls).toBeGreaterThan(1)
    },
    15_000,
  )

  it(
    'rides out transitional 404s after the regenerate is accepted',
    async () => {
      let generated = false
      let posted = 0
      server.use(
        http.get(`${API_BASE}/api/train/mesocycles/:id/report`, () =>
          generated ? HttpResponse.json(reportBody()) : notFound(),
        ),
        // The report does NOT exist the moment the 202 lands — it shows up only after more
        // than one poll tick, so the invalidate-driven refetch alone cannot find it.
        http.post(`${API_BASE}/api/train/mesocycles/:id/report/regenerate`, () => {
          posted += 1
          setTimeout(() => { generated = true }, POLL_MS + 300)
          return new HttpResponse(null, { status: 202 })
        }),
      )
      const { result } = renderHook(() => useMesoReport(ID), { wrapper: makeHookWrapper() })
      await waitFor(() => expect(result.current.notFound).toBe(true))

      await result.current.regenerate()
      expect(posted).toBe(1)
      // still 404 right after the accept — the hook must keep polling rather than settle here
      expect(result.current.report).toBeNull()

      await waitFor(() => expect(result.current.report?.title).toBe('Lezárt blokk'), { timeout: 15_000 })
      expect(result.current.notFound).toBe(false)
    },
    25_000,
  )

  // --- a real failure is not a 404 ---

  it('surfaces a non-404 failure as `error`, and refetch recovers', async () => {
    let broken = true
    server.use(
      http.get(`${API_BASE}/api/train/mesocycles/:id/report`, () =>
        broken ? new HttpResponse(null, { status: 500 }) : HttpResponse.json(reportBody()),
      ),
    )
    const { result } = renderHook(() => useMesoReport(ID), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.error).toBe(true))
    expect(result.current.report).toBeNull()
    expect(result.current.notFound).toBe(false) // a 500 is NOT "no report yet"

    broken = false
    result.current.refetch()

    await waitFor(() => expect(result.current.report?.title).toBe('Lezárt blokk'))
    expect(result.current.error).toBe(false)
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
    // S2 keeps the AI block dark — the page must be able to hide it entirely. `pending` is
    // what the backend actually writes, so the fixture must say so (and must not poll).
    expect(result.current.report?.aiEvalStatus).toBe('pending')
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
