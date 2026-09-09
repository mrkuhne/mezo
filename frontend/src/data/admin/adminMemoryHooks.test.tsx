import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { QueryWrapper } from '@/test/queryWrapper'
import { setToken } from '@/data/_client/api'
import {
  useAdminMemoryGlobalHealth,
  useAdminMemoryGraph,
  useAdminMemoryHealth,
  useAdminMemoryNeighbors,
  useAdminMemoryRun,
  useAdminMemoryRuns,
  useAdminMemoryVectors,
} from '@/data/admin/adminMemoryHooks'
import {
  ADMIN_MEMORY_GLOBAL_HEALTH_EMPTY,
  ADMIN_MEMORY_GLOBAL_HEALTH_MOCK,
  ADMIN_MEMORY_HEALTH_ANNA_MOCK,
  ADMIN_MEMORY_HEALTH_BELA_MOCK,
  ADMIN_MEMORY_RUNS_EMPTY,
  ADMIN_MEMORY_RUNS_MOCK,
} from '@/data/admin/adminMemoryMock'
import { MOCK_ANNA_ID, MOCK_BELA_ID } from '@/data/admin/adminMock'

const USER_ID = 'u-1'

afterEach(() => { vi.unstubAllEnvs(); setToken(null) })

describe('adminMemory hooks (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  it('serves the runs seed synchronously', () => {
    const { result } = renderHook(() => useAdminMemoryRuns(USER_ID, 0, 25, true), { wrapper: QueryWrapper })
    expect(result.current.data).toEqual(ADMIN_MEMORY_RUNS_MOCK)
  })

  it('serves the installation-wide health seed synchronously', () => {
    const { result } = renderHook(() => useAdminMemoryGlobalHealth(true), { wrapper: QueryWrapper })
    expect(result.current.data).toEqual(ADMIN_MEMORY_GLOBAL_HEALTH_MOCK)
  })

  // Fix round 1 — the per-user health mock used to reuse the INSTALL-WIDE numbers for every
  // userId (Anna's own explorer showed 1780/6/9/1842 next to her 140-vector hero). Each known
  // mock user now gets its own internally-consistent seed, scaled to that user's own
  // vectorCount/rowCount (adminMemoryMock.ts's `adminMemoryHealthMockFor`).
  it('scales the per-user health seed to the actual inspected user (Anna, not the install-wide numbers)', () => {
    const { result } = renderHook(() => useAdminMemoryHealth(MOCK_ANNA_ID, true), { wrapper: QueryWrapper })
    expect(result.current.data).toEqual(ADMIN_MEMORY_HEALTH_ANNA_MOCK)
    expect(result.current.data.vectorsByStatus.find((b) => b.key === 'ready')?.count).not.toBe(
      ADMIN_MEMORY_GLOBAL_HEALTH_MOCK.vectorsReady,
    )
  })

  it('a user with zero vectors (Béla) gets an honest all-zero health seed', () => {
    const { result } = renderHook(() => useAdminMemoryHealth(MOCK_BELA_ID, true), { wrapper: QueryWrapper })
    expect(result.current.data).toEqual(ADMIN_MEMORY_HEALTH_BELA_MOCK)
    expect(result.current.data.vectorsByStatus).toEqual([])
    expect(result.current.data.staleVectorCount).toBe(0)
  })
})

describe('adminMemory hooks (real mode) — enabled gating', () => {
  beforeEach(() => { vi.stubEnv('VITE_USE_MOCK', 'false'); setToken('t') })

  it('does not fetch runs for a non-owner', () => {
    const { result } = renderHook(() => useAdminMemoryRuns(USER_ID, 0, 25, false), { wrapper: QueryWrapper })
    expect(result.current.isPending).toBe(false)
    expect(result.current.data).toEqual(ADMIN_MEMORY_RUNS_EMPTY)
  })

  it('does not fetch a run detail with no runId', () => {
    const { result } = renderHook(() => useAdminMemoryRun(USER_ID, '', true), { wrapper: QueryWrapper })
    expect(result.current.isPending).toBe(false)
  })

  it('does not fetch neighbors with no itemId', () => {
    const { result } = renderHook(() => useAdminMemoryNeighbors(USER_ID, null, 10, true), { wrapper: QueryWrapper })
    expect(result.current.isPending).toBe(false)
  })

  it('does not fetch installation-wide health for a non-owner', () => {
    const { result } = renderHook(() => useAdminMemoryGlobalHealth(false), { wrapper: QueryWrapper })
    expect(result.current.isPending).toBe(false)
    expect(result.current.data).toEqual(ADMIN_MEMORY_GLOBAL_HEALTH_EMPTY)
  })
})

describe('adminMemory hooks (real mode) — fetch + degraded discrimination', () => {
  beforeEach(() => { vi.stubEnv('VITE_USE_MOCK', 'false'); setToken('t') })

  it('fetches runs from the API', async () => {
    const { result } = renderHook(() => useAdminMemoryRuns(USER_ID, 0, 25, true), { wrapper: QueryWrapper })
    await waitFor(() => expect(result.current.data.items.length).toBeGreaterThan(0))
  })

  it('fetches the graph, vectors and health reads', async () => {
    const graph = renderHook(() => useAdminMemoryGraph(USER_ID, false, false, true), { wrapper: QueryWrapper })
    await waitFor(() => expect(graph.result.current.data.nodes.length).toBeGreaterThan(0))

    const vectors = renderHook(() => useAdminMemoryVectors(USER_ID, null, true), { wrapper: QueryWrapper })
    await waitFor(() => expect(vectors.result.current.data.items.length).toBeGreaterThan(0))

    const health = renderHook(() => useAdminMemoryHealth(USER_ID, true), { wrapper: QueryWrapper })
    await waitFor(() => expect(health.result.current.data.jobs.lastRetrievalRun).not.toBeNull())
  })

  it('fetches the installation-wide health rollup', async () => {
    const { result } = renderHook(() => useAdminMemoryGlobalHealth(true), { wrapper: QueryWrapper })
    await waitFor(() => expect(result.current.data.itemsTotal).toBeGreaterThan(0))
  })

  it('a bodyless 404 (feature switched off) resolves the global health read as degraded', async () => {
    server.use(http.get(`${API_BASE}/api/admin/memory/health`, () => new HttpResponse(null, { status: 404 })))
    const { result } = renderHook(() => useAdminMemoryGlobalHealth(true), { wrapper: QueryWrapper })
    await waitFor(() => expect(result.current.data.degraded).toBe(true))
    expect(result.current.isError).toBe(false)
  })

  // Resolved ambiguity 6: a BODYLESS 404 (missing controller bean — the feature switch is off)
  // synthesizes an INTERNAL_ERROR message with no ADMIN_MEMORY_* code, so it must resolve to
  // `degraded: true`, never `isError`.
  it('a bodyless 404 (feature switched off) resolves as degraded, not an error', async () => {
    server.use(http.get(`${API_BASE}/api/admin/users/:userId/memory/runs`, () => new HttpResponse(null, { status: 404 })))
    const { result } = renderHook(() => useAdminMemoryRuns(USER_ID, 0, 25, true), { wrapper: QueryWrapper })
    await waitFor(() => expect(result.current.data.degraded).toBe(true))
    expect(result.current.isError).toBe(false)
  })

  // A REAL 404 (an ADMIN_MEMORY_* code — e.g. a hard-deleted run past retention) must re-throw
  // as an error, never masquerade as "switched off".
  it('an ADMIN_MEMORY_* 404 (a genuinely missing run) surfaces as isError, not degraded', async () => {
    server.use(http.get(`${API_BASE}/api/admin/users/:userId/memory/runs/:runId`, () =>
      HttpResponse.json([{ code: 'ADMIN_MEMORY_RUN_NOT_FOUND', message: 'nincs ilyen futás' }], { status: 404 })))
    const { result } = renderHook(() => useAdminMemoryRun(USER_ID, 'missing-run', true), { wrapper: QueryWrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})
