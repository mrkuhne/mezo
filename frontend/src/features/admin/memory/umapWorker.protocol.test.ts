import { createElement } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryWrapper } from '@/test/queryWrapper'
import { setToken } from '@/data/_client/api'
import { MapView } from '@/features/admin/memory/views/MapView'
import { ADMIN_MEMORY_VECTORS_MOCK } from '@/data/admin/adminMemoryMock'
import type { UmapRequest, UmapResponse } from '@/features/admin/memory/umap.worker'

// This file stays a plain `.ts` (not `.tsx`) per the plan's naming — `createElement` avoids JSX
// syntax while still rendering the exact same component tree the other `.test.tsx` files do.

// The umap.worker.ts message protocol, driven end-to-end through MapView (mezo-4qyt.5, Step
// 5.6). jsdom has no real Worker, so the ONE seam MapView exposes for this — the `?worker`
// import — is mocked with a hand-written fake that replays a scripted response queue and never
// touches umap-js. This is the test that proves MapView's state machine reacts correctly to
// `progress` -> `done` and to `error` (the PCA-2 fallback), independent of whatever umap-js
// itself actually computes.

// `vi.mock` factories are hoisted above every other top-level statement in the file, so a class
// declared normally below and merely CLOSED OVER by the factory hits its temporal dead zone —
// `vi.hoisted` lifts the mutable state (and the class) up WITH the mock, so both are actually
// initialised before the factory runs.
const fakeWorkerState = vi.hoisted(() => {
  const queuedResponses: unknown[] = []
  const postedRequests: unknown[] = []
  class FakeUmapWorker {
    onmessage: ((event: MessageEvent) => void) | null = null
    postMessage(msg: { type: string }) {
      postedRequests.push(msg)
      if (msg.type === 'fit') {
        queueMicrotask(() => {
          for (const response of queuedResponses) {
            this.onmessage?.({ data: response } as MessageEvent)
          }
        })
      }
    }
    terminate() {
      // no-op — nothing to release in the fake
    }
  }
  return { queuedResponses, postedRequests, FakeUmapWorker }
})

vi.mock('@/features/admin/memory/umap.worker?worker', () => ({ default: fakeWorkerState.FakeUmapWorker }))

const queuedResponses = fakeWorkerState.queuedResponses as UmapResponse[]
const postedRequests = fakeWorkerState.postedRequests as UmapRequest[]

afterEach(() => {
  vi.unstubAllEnvs()
  setToken(null)
  queuedResponses.length = 0
  postedRequests.length = 0
})

function renderMap() {
  return render(
    createElement(
      QueryWrapper,
      null,
      createElement(
        MemoryRouter,
        null,
        createElement(MapView, { userId: 'u-1', isOwner: true, sel: null, onSelect: vi.fn(), onInspect: vi.fn() }),
      ),
    ),
  )
}

const [FIRST_ITEM] = ADMIN_MEMORY_VECTORS_MOCK.items

describe('MapView / umap.worker protocol', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    sessionStorage.clear()
  })

  it('progress then done renders every point and shows no fallback caveat', async () => {
    queuedResponses.push(
      { type: 'progress', epoch: 0, total: 8, coords: [[0, 0], [1, 1], [2, 2]] },
      { type: 'done', coords: [[0, 0], [1, 1], [2, 2]] },
    )
    renderMap()

    await waitFor(() => expect(screen.getByTestId(`am-point-${FIRST_ITEM.itemId}`)).toBeInTheDocument())
    expect(screen.queryByText(/A UMAP nem futott le/)).not.toBeInTheDocument()
  })

  it('an error message is a first-class fallback state, not a silent failure', async () => {
    queuedResponses.push({ type: 'error', message: 'boom' })
    renderMap()

    await waitFor(() => expect(screen.getByText(/A UMAP nem futott le/)).toBeInTheDocument())
    // The fallback still plots something — the first two PCA components — rather than an empty map.
    expect(screen.getByTestId(`am-point-${FIRST_ITEM.itemId}`)).toBeInTheDocument()
  })

  it('clamps nNeighbors to data.length - 1 in the fit request', async () => {
    queuedResponses.push({ type: 'done', coords: [[0, 0], [1, 1], [2, 2]] })
    renderMap()

    await waitFor(() => expect(postedRequests.some((r) => r.type === 'fit')).toBe(true))
    const fitReq = postedRequests.find((r): r is Extract<UmapRequest, { type: 'fit' }> => r.type === 'fit')!
    // ADMIN_MEMORY_VECTORS_MOCK has 3 items — nNeighbors must never reach n.
    expect(fitReq.nNeighbors).toBeLessThan(fitReq.data.length)
  })
})
