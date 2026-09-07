import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { QueryWrapper } from '@/test/queryWrapper'
import { setToken } from '@/data/_client/api'
import { AdminUserDetailPage } from '@/features/admin/pages/AdminUserDetailPage'
import { ADMIN_USER_DETAIL_MOCK } from '@/data/admin/adminInsightsMock'

afterEach(() => { vi.unstubAllEnvs(); setToken(null) })

function renderPage(id = ADMIN_USER_DETAIL_MOCK.user.id) {
  return render(
    <MemoryRouter initialEntries={[`/admin/users/${id}`]}>
      <Routes>
        <Route path="/admin/users/:id" element={<AdminUserDetailPage />} />
        <Route path="/admin/users" element={<div>USERS LIST PAGE</div>} />
      </Routes>
    </MemoryRouter>,
    { wrapper: QueryWrapper },
  )
}

describe('AdminUserDetailPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  it('renders the four tabs, opening on Aktivitás', async () => {
    renderPage()
    expect(await screen.findByText(ADMIN_USER_DETAIL_MOCK.user.name)).toBeInTheDocument()
    for (const t of ['Aktivitás', 'Adatok', 'Feature-ök', 'Költség']) {
      expect(screen.getByRole('tab', { name: t })).toBeInTheDocument()
    }
    expect(screen.getByRole('tab', { name: 'Aktivitás' })).toHaveAttribute('aria-selected', 'true')
  })

  it('switches the rendered panel when a tab is clicked', async () => {
    renderPage()
    await screen.findByText(ADMIN_USER_DETAIL_MOCK.user.name)
    expect(screen.queryByText(ADMIN_USER_DETAIL_MOCK.inventory[0].table)).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: 'Adatok' }))
    expect(await screen.findByText(ADMIN_USER_DETAIL_MOCK.inventory[0].table)).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Adatok' })).toHaveAttribute('aria-selected', 'true')
  })

  it('navigates back to the users list', async () => {
    renderPage()
    await screen.findByText(ADMIN_USER_DETAIL_MOCK.user.name)
    fireEvent.click(screen.getByRole('button', { name: 'Vissza' }))
    expect(await screen.findByText('USERS LIST PAGE')).toBeInTheDocument()
  })
})

describe('AdminUserDetailPage (real mode)', () => {
  beforeEach(() => { vi.stubEnv('VITE_USE_MOCK', 'false'); setToken('t') })

  it('renders the fetched user', async () => {
    renderPage()
    expect(await screen.findByText(ADMIN_USER_DETAIL_MOCK.user.name)).toBeInTheDocument()
  })

  it('shows a tile-level error with a retry when the detail fetch fails', async () => {
    server.use(http.get(`${API_BASE}/api/admin/users/:id/insight`, () => new HttpResponse(null, { status: 500 })))
    renderPage()
    expect(await screen.findByText(/nem elérhető/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /újra/i })).toBeInTheDocument()
  })
})
