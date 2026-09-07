import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { QueryWrapper } from '@/test/queryWrapper'
import { setToken } from '@/data/_client/api'
import { AdminUsersPage } from '@/features/admin/pages/AdminUsersPage'
import { ADMIN_USER_INSIGHTS_MOCK } from '@/data/admin/adminInsightsMock'

afterEach(() => { vi.unstubAllEnvs(); setToken(null) })

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/users']}>
      <Routes>
        <Route path="/admin/users" element={<AdminUsersPage />} />
        <Route path="/admin/users/:id" element={<div>USER DETAIL PAGE</div>} />
      </Routes>
    </MemoryRouter>,
    { wrapper: QueryWrapper },
  )
}

describe('AdminUsersPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  it('lists every mock user', async () => {
    renderPage()
    expect(await screen.findByText('Userek')).toBeInTheDocument()
    for (const u of ADMIN_USER_INSIGHTS_MOCK) {
      expect(screen.getByText(u.name)).toBeInTheDocument()
    }
  })

  it('filters as the search box changes', async () => {
    renderPage()
    await screen.findByText(ADMIN_USER_INSIGHTS_MOCK[0].name)
    fireEvent.change(screen.getByLabelText('Keresés'), { target: { value: 'zzz-no-match' } })
    await waitFor(() => expect(screen.getByText('Nincs találat.')).toBeInTheDocument())
  })

  it('navigates to the user detail route on row click', async () => {
    renderPage()
    const target = ADMIN_USER_INSIGHTS_MOCK[1]
    const row = await screen.findByText(target.name)
    fireEvent.click(row.closest('tr')!)
    expect(await screen.findByText('USER DETAIL PAGE')).toBeInTheDocument()
  })
})

describe('AdminUsersPage (real mode)', () => {
  beforeEach(() => { vi.stubEnv('VITE_USE_MOCK', 'false'); setToken('t') })

  it('lists the fetched users', async () => {
    renderPage()
    expect(await screen.findByText(ADMIN_USER_INSIGHTS_MOCK[0].name)).toBeInTheDocument()
  })

  it('shows a tile-level error with a retry when the list fails', async () => {
    server.use(http.get(`${API_BASE}/api/admin/users-insight`, () => new HttpResponse(null, { status: 500 })))
    renderPage()
    expect(await screen.findByText(/nem elérhető/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /újra/i })).toBeInTheDocument()
    expect(screen.getByText('Userek')).toBeInTheDocument()
  })

  // Fix round 1 (Finding 3): mock mode's useAdminUserInsights ignores sort/dir, so a click on a
  // sort header changes nothing visible there — which is why nobody had tested this wiring.
  // Real mode actually sends sort/dir on the querystring, so intercept the request (the pattern
  // AdminUsagePage.test.tsx uses for `period`) and assert the header click both re-requests with
  // the new sort key/direction AND flips `aria-sort` on the clicked header.
  it('re-requests with the new sort/dir when a sort header is clicked, and flips aria-sort', async () => {
    const requests: string[] = []
    server.use(http.get(`${API_BASE}/api/admin/users-insight`, ({ request }) => {
      requests.push(new URL(request.url).search)
      return HttpResponse.json(ADMIN_USER_INSIGHTS_MOCK)
    }))
    renderPage()
    await screen.findByText(ADMIN_USER_INSIGHTS_MOCK[0].name)
    await waitFor(() => expect(requests.some((s) => s.includes('sort=lastActivityAt') && s.includes('dir=desc'))).toBe(true))

    const header = screen.getByRole('columnheader', { name: /Sorok/ })
    expect(header).toHaveAttribute('aria-sort', 'none')
    fireEvent.click(screen.getByRole('button', { name: 'Sorok' }))

    await waitFor(() => expect(requests.some((s) => s.includes('sort=rowCount') && s.includes('dir=desc'))).toBe(true))
    expect(header).toHaveAttribute('aria-sort', 'descending')

    fireEvent.click(screen.getByRole('button', { name: /Sorok/ }))
    await waitFor(() => expect(requests.some((s) => s.includes('sort=rowCount') && s.includes('dir=asc'))).toBe(true))
    expect(header).toHaveAttribute('aria-sort', 'ascending')
  })
})
