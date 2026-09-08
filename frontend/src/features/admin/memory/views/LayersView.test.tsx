import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { QueryWrapper } from '@/test/queryWrapper'
import { setToken } from '@/data/_client/api'
import { LayersView } from '@/features/admin/memory/views/LayersView'
import { ADMIN_MEMORY_HEALTH_MOCK } from '@/data/admin/adminMemoryMock'

afterEach(() => { vi.unstubAllEnvs(); setToken(null) })

function renderLayersView() {
  return render(
    <QueryWrapper>
      <MemoryRouter>
        <LayersView userId="u-1" isOwner />
      </MemoryRouter>
    </QueryWrapper>,
  )
}

describe('LayersView (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  it('the stale vector count renders and links into the data browser on memory_vector', async () => {
    renderLayersView()
    const stale = await screen.findByText(String(ADMIN_MEMORY_HEALTH_MOCK.staleVectorCount))
    const link = stale.closest('a')
    expect(link).toHaveAttribute('href', expect.stringContaining('table=memory_vector'))
    expect(link).toHaveAttribute('href', expect.stringContaining('userId=u-1'))
  })

  it('the edge-weight histogram renders exactly one column per bucket', async () => {
    renderLayersView()
    await screen.findByText(/él-súly hisztogram/)
    const histobar = document.querySelector('.am-histobar')
    expect(histobar?.children.length).toBe(ADMIN_MEMORY_HEALTH_MOCK.edgeWeightHistogram.length)
  })

  it('the nightly job timestamps are labelled becsült', async () => {
    renderLayersView()
    const rows = await screen.findAllByText(/becsült/)
    expect(rows.length).toBeGreaterThan(0)
  })
})

describe('LayersView (real mode)', () => {
  beforeEach(() => { vi.stubEnv('VITE_USE_MOCK', 'false'); setToken('t') })

  it('an empty node-bucket payload (graph feature off) renders the vector half without erroring', async () => {
    server.use(
      http.get(`${API_BASE}/api/admin/users/:userId/memory/health`, () =>
        HttpResponse.json({
          ...ADMIN_MEMORY_HEALTH_MOCK,
          nodesByStatus: [],
          nodesByKind: [],
          edgeWeightHistogram: [],
        }),
      ),
    )
    renderLayersView()
    expect(await screen.findByText(/memory_vector · státusz szerint/)).toBeInTheDocument()
    expect(screen.getByText(/knowledge_node · státusz szerint/)).toBeInTheDocument()
  })

  it('a 404-with-no-ADMIN_MEMORY-code renders the degraded tile', async () => {
    server.use(http.get(`${API_BASE}/api/admin/users/:userId/memory/health`, () => new HttpResponse(null, { status: 404 })))
    renderLayersView()
    expect(await screen.findByText(/ki van kapcsolva/)).toBeInTheDocument()
  })
})
