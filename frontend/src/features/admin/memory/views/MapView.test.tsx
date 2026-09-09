import { useState } from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { QueryWrapper } from '@/test/queryWrapper'
import { setToken } from '@/data/_client/api'
import { MapView } from '@/features/admin/memory/views/MapView'
import { ADMIN_MEMORY_NEIGHBORS_MOCK, ADMIN_MEMORY_VECTORS_MOCK } from '@/data/admin/adminMemoryMock'

// MapView (mezo-4qyt.5, Step 5.6). The `?worker` import is mocked with an "instant" fake that
// echoes the fit input's first two dims back as a `done` embedding — good enough to exercise
// every render path (sampled banner, hollow suppressed/superseded points, click -> neighbours ->
// highlight) without depending on umap-js's actual math (that belongs to
// umapWorker.protocol.test.ts).
//
// `vi.mock` factories are hoisted above every other top-level statement, so the fake class is
// declared inside `vi.hoisted` — a plain `class` below would still be in its temporal dead zone
// when the (hoisted) factory ran.
const InstantFakeWorker = vi.hoisted(() => {
  return class {
    onmessage: ((event: MessageEvent) => void) | null = null
    postMessage(msg: { type: string; data?: number[][] }) {
      if (msg.type === 'fit' && msg.data) {
        const coords = msg.data.map((row) => [row[0] ?? 0, row[1] ?? 0])
        queueMicrotask(() => {
          this.onmessage?.({ data: { type: 'done', coords } } as MessageEvent)
        })
      } else if (msg.type === 'transform') {
        queueMicrotask(() => {
          this.onmessage?.({ data: { type: 'transformed', coord: [0, 0] } } as MessageEvent)
        })
      }
    }
    terminate() {
      // no-op
    }
  }
})

vi.mock('@/features/admin/memory/umap.worker?worker', () => ({ default: InstantFakeWorker }))

afterEach(() => {
  vi.unstubAllEnvs()
  setToken(null)
  vi.restoreAllMocks()
})

function renderMapView(sel: string | null = null, onSelect = vi.fn(), onInspect = vi.fn()) {
  render(
    <QueryWrapper>
      <MemoryRouter>
        <MapView userId="u-1" isOwner sel={sel} onSelect={onSelect} onInspect={onInspect} />
      </MemoryRouter>
    </QueryWrapper>,
  )
  return { onSelect, onInspect }
}

/** Owns `sel` locally (mirroring AdminMemoryPage) so a click actually feeds back into the next
 *  render — needed to test that clicking a point fires the neighbours request. */
function SelectableMapHarness() {
  const [sel, setSel] = useState<string | null>(null)
  return <MapView userId="u-1" isOwner sel={sel} onSelect={setSel} onInspect={vi.fn()} />
}

const [ITEM_ACTIVE, ITEM_SUPPRESSED, ITEM_SUPERSEDED] = ADMIN_MEMORY_VECTORS_MOCK.items

describe('MapView (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  it('renders the sampled banner from the vectors response', async () => {
    renderMapView()
    expect(await screen.findByText(new RegExp(`a ${ADMIN_MEMORY_VECTORS_MOCK.total}-ból`))).toBeInTheDocument()
  })

  it('a suppressed item renders hollow (fill none, coloured stroke)', async () => {
    renderMapView()
    const circle = await screen.findByTestId(`am-point-${ITEM_SUPPRESSED.itemId}`)
    expect(circle.getAttribute('fill')).toBe('none')
    expect(circle.getAttribute('stroke')).not.toBeNull()
  })

  it('a superseded item also renders hollow', async () => {
    renderMapView()
    const circle = await screen.findByTestId(`am-point-${ITEM_SUPERSEDED.itemId}`)
    expect(circle.getAttribute('fill')).toBe('none')
  })

  it('an active item renders filled (no hollow stroke)', async () => {
    renderMapView()
    const circle = await screen.findByTestId(`am-point-${ITEM_ACTIVE.itemId}`)
    expect(circle.getAttribute('fill')).not.toBe('none')
  })

  it('a sessionStorage accessor that throws does not break the render', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked site data')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked site data')
    })
    renderMapView()
    expect(await screen.findByTestId(`am-point-${ITEM_ACTIVE.itemId}`)).toBeInTheDocument()
  })

  it('clicking a point fires the neighbours request and highlights the returned neighbour ids', async () => {
    render(
      <QueryWrapper>
        <MemoryRouter>
          <SelectableMapHarness />
        </MemoryRouter>
      </QueryWrapper>,
    )
    const point = await screen.findByTestId(`am-point-${ITEM_ACTIVE.itemId}`)
    fireEvent.click(point)

    for (const neighbor of ADMIN_MEMORY_NEIGHBORS_MOCK.neighbors) {
      await waitFor(() => {
        const n = screen.getByTestId(`am-point-${neighbor.itemId}`)
        expect(n.getAttribute('stroke')).not.toBeNull()
      })
    }
  })

  it('onSelect fires with the clicked point id', async () => {
    const { onSelect } = renderMapView()
    const point = await screen.findByTestId(`am-point-${ITEM_ACTIVE.itemId}`)
    fireEvent.click(point)
    expect(onSelect).toHaveBeenCalledWith(ITEM_ACTIVE.itemId)
  })

  // mezo-k5zy Task 3 — the visual-encoding legend note (color = source, size = salience).
  it('renders the color/size encoding note next to the source legend', async () => {
    renderMapView()
    await screen.findByTestId(`am-point-${ITEM_ACTIVE.itemId}`)
    expect(screen.getByText('szín = forrás · méret = fontosság (salience)')).toBeInTheDocument()
  })
})
