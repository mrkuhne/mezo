import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { QueryWrapper } from '@/test/queryWrapper'
import { setToken } from '@/data/_client/api'
import { AdminUserDetailPage } from '@/features/admin/pages/AdminUserDetailPage'
import { ADMIN_USER_DETAIL_MOCK } from '@/data/admin/adminInsightsMock'
import { ADMIN_ROWS_MOCK } from '@/data/admin/adminDataMock'

afterEach(() => { vi.unstubAllEnvs(); setToken(null) })

function renderPage(id = ADMIN_USER_DETAIL_MOCK.user.id) {
  return render(
    <MemoryRouter initialEntries={[`/admin/users/${id}`]}>
      <Routes>
        <Route path="/admin/users/:id" element={<AdminUserDetailPage />} />
        <Route path="/admin/users" element={<div>USERS LIST PAGE</div>} />
        <Route path="/admin/users/:id/memory" element={<div>MEMORY PAGE</div>} />
      </Routes>
    </MemoryRouter>,
    { wrapper: QueryWrapper },
  )
}

// Fix round 1 (Finding 1): mount the page under a route that does NOT capture an `:id` param,
// so `useParams().id` is `undefined` and `userId` is `''` — the same shape the app hits if this
// page is ever reached without an id. `useAdminUserDetail` passes `enabled: id !== ''`, so in
// real mode this query never fetches and (pre-fix) never leaves `isPending`.
function renderPageWithoutId() {
  return render(
    <MemoryRouter initialEntries={['/admin/users/detail']}>
      <Routes>
        <Route path="/admin/users/detail" element={<AdminUserDetailPage />} />
      </Routes>
    </MemoryRouter>,
    { wrapper: QueryWrapper },
  )
}

describe('AdminUserDetailPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  it('renders the five tabs, opening on Aktivitás', async () => {
    renderPage()
    expect(await screen.findByText(ADMIN_USER_DETAIL_MOCK.user.name)).toBeInTheDocument()
    for (const t of ['Aktivitás', 'Adatok', 'Feature-ök', 'Költség', 'Memória']) {
      expect(screen.getByRole('tab', { name: t })).toBeInTheDocument()
    }
    expect(screen.getByRole('tab', { name: 'Aktivitás' })).toHaveAttribute('aria-selected', 'true')
  })

  // mezo-4qyt.3: "Memória" is a link dressed as a tab — it NAVIGATES to its own route rather
  // than switching local tab state, so `aria-selected` is never true for it (asserted below).
  it('Memória navigates to the memory sub-route instead of switching the local tab', async () => {
    renderPage()
    await screen.findByText(ADMIN_USER_DETAIL_MOCK.user.name)
    expect(screen.getByRole('tab', { name: 'Memória' })).toHaveAttribute('aria-selected', 'false')
    fireEvent.click(screen.getByRole('tab', { name: 'Memória' }))
    expect(await screen.findByText('MEMORY PAGE')).toBeInTheDocument()
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

  // Fix round 1 (Finding 1): with no `:id` in the route, `useAdminUserDetail`'s query is
  // `enabled: false` and (in real mode, no cache) never leaves `isPending` — a `notFound` that
  // waited on `!isPending` could never fire. Assert the message renders instead of hanging.
  it('shows the not-found message when the route has no id, without waiting on a query that never resolves', async () => {
    renderPageWithoutId()
    expect(await screen.findByText('Ez a user nem található.')).toBeInTheDocument()
  })

  // Fix round 1 (Finding 2): the brief's Step 5 deliverable — the row browser embedded in the
  // Adatok tab — was previously never mounted by any test. The prior "switches the rendered
  // panel when a tab is clicked" test only clicks the Adatok TAB and asserts the inventory
  // table renders; it never clicks an inventory ROW, so <DataTable>/useAdminRows inside this
  // page were never exercised, and the report's "transitively covers it" claim was false (now
  // corrected there too). This clicks a row and proves the embedded browser actually mounts,
  // is bound to that table, and — the whole point of embedding it here rather than sending the
  // owner to the standalone /admin/data — is scoped to the CURRENT route user's id.
  it('clicking an inventory row mounts the embedded row browser scoped to this user', async () => {
    let seen = ''
    server.use(http.get(`${API_BASE}/api/admin/data/tables/:table/rows`, ({ request }) => {
      seen = new URL(request.url).search
      return HttpResponse.json(ADMIN_ROWS_MOCK.train_session)
    }))
    renderPage()
    await screen.findByText(ADMIN_USER_DETAIL_MOCK.user.name)
    fireEvent.click(screen.getByRole('tab', { name: 'Adatok' }))

    const tableName = ADMIN_USER_DETAIL_MOCK.inventory[0].table // 'train_session'
    fireEvent.click(await screen.findByText(tableName))

    // Bound to the selected table (eyebrow echoes `{table} · {total} sor`, DataTable renders
    // that table's own columns) — not some other/unfiltered surface.
    expect(await screen.findByText(`${tableName} · 2 sor`)).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /created_by/ })).toBeInTheDocument()

    // Scoped to the route's user, not the whole table.
    await waitFor(() => expect(seen).toContain(`userId=${ADMIN_USER_DETAIL_MOCK.user.id}`))
  })
})
