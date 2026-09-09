import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { QueryWrapper } from '@/test/queryWrapper'
import { setToken } from '@/data/_client/api'
import { AdminMemoryPage } from '@/features/admin/memory/AdminMemoryPage'
import { ADMIN_USER_DETAIL_MOCK } from '@/data/admin/adminInsightsMock'

afterEach(() => { vi.unstubAllEnvs(); setToken(null) })

function renderPage(search = '') {
  return render(
    <MemoryRouter initialEntries={[`/admin/users/${ADMIN_USER_DETAIL_MOCK.user.id}/memory${search}`]}>
      <Routes>
        <Route path="/admin/users/:id/memory" element={<AdminMemoryPage />} />
        <Route path="/admin/users/:id" element={<div>USER DETAIL PAGE</div>} />
      </Routes>
    </MemoryRouter>,
    { wrapper: QueryWrapper },
  )
}

describe('AdminMemoryPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  it('the default view is Áttekintés', async () => {
    renderPage()
    await screen.findByText(ADMIN_USER_DETAIL_MOCK.user.name)
    expect(screen.getByRole('tab', { name: 'Áttekintés' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Emlék-egészség')).toBeInTheDocument()
  })

  it('?view=runs selects Felidézések (the old "Futások" URL value keeps working)', async () => {
    renderPage('?view=runs')
    await screen.findByText(ADMIN_USER_DETAIL_MOCK.user.name)
    expect(screen.getByRole('tab', { name: 'Felidézések' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText(/Futáslista/)).toBeInTheDocument()
  })

  it('?view=graph selects Gráf', async () => {
    renderPage('?view=graph')
    await screen.findByText(ADMIN_USER_DETAIL_MOCK.user.name)
    expect(screen.getByRole('tab', { name: 'Gráf' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Tudásgráf')).toBeInTheDocument()
  })

  it('an unknown view falls back to Áttekintés', async () => {
    renderPage('?view=nonsense')
    await screen.findByText(ADMIN_USER_DETAIL_MOCK.user.name)
    expect(screen.getByRole('tab', { name: 'Áttekintés' })).toHaveAttribute('aria-selected', 'true')
  })

  // mezo-k5zy Task 3 — the stray "Feature-ök" tab label, fixed to match AdminUserDetailPage's own
  // rename (mezo-zde2 Task 3).
  it('the top tab bar reads "Funkciók", not the stray "Feature-ök"', async () => {
    renderPage()
    await screen.findByText(ADMIN_USER_DETAIL_MOCK.user.name)
    expect(screen.getByRole('tab', { name: 'Funkciók' })).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Feature-ök' })).not.toBeInTheDocument()
  })

  it('clicking the segment bar navigates between views', async () => {
    renderPage()
    await screen.findByText(ADMIN_USER_DETAIL_MOCK.user.name)
    fireEvent.click(screen.getByRole('tab', { name: 'Térkép' }))
    expect(screen.getByRole('tab', { name: 'Térkép' })).toHaveAttribute('aria-selected', 'true')
  })
})

describe('AdminMemoryPage (real mode)', () => {
  beforeEach(() => { vi.stubEnv('VITE_USE_MOCK', 'false'); setToken('t') })

  it('a 404-with-no-code renders the "ki van kapcsolva" tile while a sibling view stays untouched', async () => {
    server.use(http.get(`${API_BASE}/api/admin/users/:userId/memory/runs`, () => new HttpResponse(null, { status: 404 })))
    renderPage('?view=runs')
    await screen.findByText(ADMIN_USER_DETAIL_MOCK.user.name)
    expect(await screen.findByText(/ki van kapcsolva/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Rétegek' }))
    expect(await screen.findByText(/memory_vector · státusz szerint/)).toBeInTheDocument()
  })
})
