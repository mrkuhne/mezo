import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { QueryWrapper } from '@/test/queryWrapper'
import { setToken } from '@/data/_client/api'
import { OverviewView } from '@/features/admin/memory/views/OverviewView'
import { ADMIN_MEMORY_GLOBAL_HEALTH_MOCK, ADMIN_MEMORY_HEALTH_ANNA_MOCK, ADMIN_MEMORY_HEALTH_MOCK } from '@/data/admin/adminMemoryMock'
import { userFeedbackMockFor } from '@/data/admin/adminInsightsMock'
import { MOCK_ANNA_ID } from '@/data/admin/adminMock'
import { huInt } from '@/shared/lib/huNum'

afterEach(() => { vi.unstubAllEnvs(); setToken(null) })

function renderOverview(userId = 'u-1', onGo = vi.fn()) {
  render(
    <QueryWrapper>
      <MemoryRouter>
        <OverviewView userId={userId} isOwner onGo={onGo} />
      </MemoryRouter>
    </QueryWrapper>,
  )
  return onGo
}

describe('OverviewView (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  it('renders the health-summary counts', async () => {
    renderOverview()
    await screen.findByText('Emlék-egészség')
    expect(screen.getByText('kész vektor')).toBeInTheDocument()
    expect(screen.getByText('elakadt vektor')).toBeInTheDocument()
    expect(screen.getByText('elavult vektor')).toBeInTheDocument()
    expect(screen.getByText('emlék összesen')).toBeInTheDocument()
  })

  it('renders the recall-quality percentage and suppress count from useAdminUserFeedback', async () => {
    const onGo = renderOverview(MOCK_ANNA_ID)
    const mock = userFeedbackMockFor(MOCK_ANNA_ID)
    const pct = Math.round((100 * mock.recall!.useful) / (mock.recall!.useful + mock.recall!.irrelevant))
    expect(await screen.findByText(new RegExp(`${pct}%-a volt hasznos`))).toBeInTheDocument()
    expect(screen.getByText(`elnémítva: ${mock.recall!.suppress}`)).toBeInTheDocument()
    expect(onGo).not.toHaveBeenCalled()
  })

  // Fix round 1 — Anna's own explorer must show HER numbers (132/2/6/356), not the
  // install-wide seed (now 912/14/11/2496, the sum of every per-user seed — F2).
  it("renders Anna's own scaled health numbers, not the install-wide seed", async () => {
    renderOverview(MOCK_ANNA_ID)
    await screen.findByText('Emlék-egészség')
    const readyCount = ADMIN_MEMORY_HEALTH_ANNA_MOCK.vectorsByStatus.find((b) => b.key === 'ready')!.count
    expect(screen.getByText(huInt(readyCount))).toBeInTheDocument()
    expect(screen.getByText(huInt(ADMIN_MEMORY_HEALTH_ANNA_MOCK.staleVectorCount))).toBeInTheDocument()
    expect(screen.queryByText(huInt(ADMIN_MEMORY_GLOBAL_HEALTH_MOCK.vectorsReady))).not.toBeInTheDocument()
  })

  it('clicking a failed/stale problem link calls onGo("layers", null)', async () => {
    const onGo = renderOverview()
    await screen.findByText('Emlék-egészség')
    const btn = await screen.findByText(/sikertelen vektor a Rétegeken/)
    fireEvent.click(btn)
    expect(onGo).toHaveBeenCalledWith('layers', null)
  })

  // Fix round 1 (F4) — the health-summary's failed/stale cells are real <button>s now (a11y:
  // Space activates them, not just Enter/click), matching the file's own `ad-fk` button precedent.
  it('the elakadt/elavult health cells are real buttons and call onGo("layers", null)', async () => {
    const onGo = renderOverview()
    await screen.findByText('Emlék-egészség')
    // Two DIFFERENT elements' text both contain "elakadt/elavult vektor" (this health-summary
    // cell AND the "Legutóbbi problémák" link below it) — `.closest('button')` on the LABEL text
    // disambiguates, same idiom LayersView's own tests already use (`stale.closest('a')`).
    const failedBtn = screen.getByText('elakadt vektor').closest('button')
    const staleBtn = screen.getByText('elavult vektor').closest('button')
    expect(failedBtn).not.toBeNull()
    expect(staleBtn).not.toBeNull()
    fireEvent.click(failedBtn!)
    fireEvent.click(staleBtn!)
    expect(onGo).toHaveBeenCalledTimes(2)
    expect(onGo).toHaveBeenCalledWith('layers', null)
  })
})

describe('OverviewView (real mode)', () => {
  beforeEach(() => { vi.stubEnv('VITE_USE_MOCK', 'false'); setToken('t') })

  it('a 404-with-no-ADMIN_MEMORY-code renders the degraded tile', async () => {
    server.use(http.get(`${API_BASE}/api/admin/users/:userId/memory/health`, () => new HttpResponse(null, { status: 404 })))
    renderOverview()
    expect(await screen.findByText(/ki van kapcsolva/)).toBeInTheDocument()
  })

  it('recall === null (companion off) renders the honest empty copy, not a NaN%', async () => {
    server.use(
      http.get(`${API_BASE}/api/admin/users/:id/feedback`, () => HttpResponse.json({ surfaces: null, recall: null })),
      http.get(`${API_BASE}/api/admin/users/:userId/memory/health`, () => HttpResponse.json(ADMIN_MEMORY_HEALTH_MOCK)),
    )
    renderOverview()
    expect(await screen.findByText('Még nincs elég emlék-felidézési visszajelzés.')).toBeInTheDocument()
  })

  it('no failed/no stale vectors renders the honest "nincs probléma" copy', async () => {
    server.use(
      http.get(`${API_BASE}/api/admin/users/:userId/memory/health`, () =>
        HttpResponse.json({
          ...ADMIN_MEMORY_HEALTH_MOCK,
          vectorsByStatus: [{ key: 'ready', count: 10 }],
          staleVectorCount: 0,
        })),
    )
    renderOverview()
    expect(await screen.findByText('Nincs sikertelen vagy elavult vektor.')).toBeInTheDocument()
  })
})
