import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { QueryWrapper } from '@/test/queryWrapper'
import { setToken } from '@/data/_client/api'
import { RunsView } from '@/features/admin/memory/views/RunsView'
import { ADMIN_MEMORY_RUNS_MOCK } from '@/data/admin/adminMemoryMock'

afterEach(() => { vi.unstubAllEnvs(); setToken(null) })

function renderRunsView(selectedRunId: string | null = null, onSelectRun = vi.fn()) {
  render(
    <QueryWrapper>
      <MemoryRouter>
        <RunsView
          userId="u-1"
          isOwner
          selectedRunId={selectedRunId}
          onSelectRun={onSelectRun}
          onGo={vi.fn()}
          onInspect={vi.fn()}
        />
      </MemoryRouter>
    </QueryWrapper>,
  )
  return { onSelectRun }
}

describe('RunsView (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  it('a SHADOW row shows the árnyék badge and its title text', () => {
    renderRunsView()
    const badge = screen.getAllByText('árnyék')[0]
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveAttribute('title', 'Árnyékfutás — nem ezt látta a modell')
  })

  it('the retention line renders the number', () => {
    renderRunsView()
    expect(screen.getByText(new RegExp(`a futások ${ADMIN_MEMORY_RUNS_MOCK.retentionDays} nap után törlődnek`))).toBeInTheDocument()
  })

  // mezo-k5zy Task 3 — plain-Hungarian column headers, no raw technical words.
  it('humanizes the table headers (Policy → Felhasználás, Lekérdezés mód → Keresés módja)', () => {
    renderRunsView()
    expect(screen.getByRole('columnheader', { name: 'Felhasználás' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Keresés módja' })).toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Policy' })).not.toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Lekérdezés mód' })).not.toBeInTheDocument()
  })

  it('clicking a row selects that run', () => {
    const { onSelectRun } = renderRunsView()
    const run = ADMIN_MEMORY_RUNS_MOCK.items[0]
    fireEvent.click(screen.getByText(`„${run.rawQuery}”`, { exact: false }).closest('tr')!)
    expect(onSelectRun).toHaveBeenCalledWith(run.id)
  })
})

describe('RunsView (real mode) — paging shows the response page', () => {
  beforeEach(() => { vi.stubEnv('VITE_USE_MOCK', 'false'); setToken('t') })

  it('shows the page number from the response, not the requested page', async () => {
    server.use(http.get(`${API_BASE}/api/admin/users/:userId/memory/runs`, ({ request }) => {
      const url = new URL(request.url)
      const page = Number(url.searchParams.get('page') ?? 0)
      return HttpResponse.json({ ...ADMIN_MEMORY_RUNS_MOCK, page })
    }))
    renderRunsView()
    await waitFor(() => expect(screen.getByText(/1\. oldal/)).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /Következő/ }))
    await waitFor(() => expect(screen.getByText(/2\. oldal/)).toBeInTheDocument())
  })

  it('the "ki van kapcsolva" tile renders on a bodyless 404, not a crash', async () => {
    server.use(http.get(`${API_BASE}/api/admin/users/:userId/memory/runs`, () => new HttpResponse(null, { status: 404 })))
    renderRunsView()
    expect(await screen.findByText(/ki van kapcsolva/)).toBeInTheDocument()
  })
})
