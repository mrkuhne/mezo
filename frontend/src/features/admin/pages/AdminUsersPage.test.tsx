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

/** Switches from the default card grid to the legacy "Táblázat nézet" table — the pre-mezo-zde2
 *  table tests below all assume the table is on screen, same behavior as before this task, just
 *  reached through the toggle chip now instead of being the default view. */
async function switchToTableView() {
  const toggle = await screen.findByRole('button', { name: 'Táblázat nézet' })
  fireEvent.click(toggle)
  await waitFor(() => expect(toggle).toHaveAttribute('aria-pressed', 'true'))
}

// mock fixture recap (adminInsightsMock.ts): Daniel/OWNER active today (aktiv), Anna/USER quiet
// 25 days (lemorzsolodott), Béla/USER never active (meg_nem_aktiv, DISABLED) — no one lands in
// csendesedik, which is itself a useful "0" fixture value to assert on.

describe('AdminUsersPage (mock mode, card grid — default view)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  it('shows a card for every mock user', async () => {
    renderPage()
    expect(await screen.findByText('Emberek')).toBeInTheDocument()
    for (const u of ADMIN_USER_INSIGHTS_MOCK) {
      expect(screen.getByText(u.name)).toBeInTheDocument()
    }
  })

  it('renders a 90-cell heat strip per card', async () => {
    const { container } = renderPage()
    await screen.findByText(ADMIN_USER_INSIGHTS_MOCK[0].name)
    const cards = container.querySelectorAll('.ad-testercard')
    expect(cards).toHaveLength(ADMIN_USER_INSIGHTS_MOCK.length)
    cards.forEach((card) => expect(card.querySelectorAll('.ad-heat i')).toHaveLength(90))
  })

  it('shows the summary-strip counts, excluding the owner from the churn buckets', async () => {
    renderPage()
    await screen.findByText(ADMIN_USER_INSIGHTS_MOCK[0].name)
    // Aktív: owner only (1). Csendesedik: nobody (0). Lemorzsolódott: Anna only, owner excluded (1).
    // Még nem aktív: Béla (1).
    expect(screen.getByRole('button', { name: /Aktív/ })).toHaveTextContent('1')
    expect(screen.getByRole('button', { name: /Csendesedik/ })).toHaveTextContent('0')
    expect(screen.getByRole('button', { name: /Lemorzsolódott/ })).toHaveTextContent('1')
    expect(screen.getByRole('button', { name: /Még nem aktív/ })).toHaveTextContent('1')
  })

  it('filters the card grid when a summary cell is clicked, but always keeps the owner card visible', async () => {
    const { container } = renderPage()
    await screen.findByText('Daniel')
    const owner = ADMIN_USER_INSIGHTS_MOCK[0]
    const anna = ADMIN_USER_INSIGHTS_MOCK[1]
    const bela = ADMIN_USER_INSIGHTS_MOCK[2]

    fireEvent.click(screen.getByRole('button', { name: /Lemorzsolódott/ }))
    await waitFor(() => expect(container.querySelectorAll('.ad-testercard')).toHaveLength(2))
    expect(screen.getByText(owner.name)).toBeInTheDocument()
    expect(screen.getByText(anna.name)).toBeInTheDocument()
    expect(screen.queryByText(bela.name)).not.toBeInTheDocument()

    // Clicking the same cell again toggles the filter back off.
    fireEvent.click(screen.getByRole('button', { name: /Lemorzsolódott/ }))
    await waitFor(() => expect(container.querySelectorAll('.ad-testercard')).toHaveLength(ADMIN_USER_INSIGHTS_MOCK.length))
  })

  it('navigates to the user detail route on card click', async () => {
    renderPage()
    const target = ADMIN_USER_INSIGHTS_MOCK[1]
    const card = await screen.findByText(target.name)
    fireEvent.click(card.closest('a')!)
    expect(await screen.findByText('USER DETAIL PAGE')).toBeInTheDocument()
  })

  it('renders a real link (href) to the detail route, not just a click handler', async () => {
    renderPage()
    const target = ADMIN_USER_INSIGHTS_MOCK[1]
    const card = await screen.findByText(target.name)
    expect(card.closest('a')).toHaveAttribute('href', `/admin/users/${target.id}`)
  })

  it('has kockázat (quiet-first) as the default sort chip', async () => {
    renderPage()
    await screen.findByText(ADMIN_USER_INSIGHTS_MOCK[0].name)
    expect(screen.getByRole('button', { name: 'kockázat' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('re-sorts by cost when the költség chip is clicked', async () => {
    const { container } = renderPage()
    await screen.findByText(ADMIN_USER_INSIGHTS_MOCK[0].name)
    fireEvent.click(screen.getByRole('button', { name: 'költség' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'költség' })).toHaveAttribute('aria-pressed', 'true'))
    const names = Array.from(container.querySelectorAll('.ad-testercard .nm')).map((n) => n.textContent)
    // Highest 30d cost first: Daniel (14.62) > Anna (3.21) > Béla (0).
    expect(names).toEqual(['Daniel', 'Anna', 'Béla'])
  })

  it('filters as the search box changes', async () => {
    renderPage()
    await screen.findByText(ADMIN_USER_INSIGHTS_MOCK[0].name)
    fireEvent.change(screen.getByLabelText('Keresés'), { target: { value: 'zzz-no-match' } })
    await waitFor(() => expect(screen.getByText('Nincs találat.')).toBeInTheDocument())
  })

  it('switches to the table view and back via the Táblázat nézet toggle', async () => {
    const { container } = renderPage()
    await screen.findByText(ADMIN_USER_INSIGHTS_MOCK[0].name)
    expect(container.querySelector('.ad-testergrid')).toBeInTheDocument()
    await switchToTableView()
    expect(container.querySelector('table.ad-table')).toBeInTheDocument()
    expect(container.querySelector('.ad-testergrid')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Táblázat nézet' }))
    await waitFor(() => expect(container.querySelector('.ad-testergrid')).toBeInTheDocument())
  })
})

describe('AdminUsersPage (mock mode, Táblázat nézet — the pre-existing table, unchanged)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  it('lists every mock user', async () => {
    renderPage()
    await switchToTableView()
    for (const u of ADMIN_USER_INSIGHTS_MOCK) {
      expect(screen.getByText(u.name)).toBeInTheDocument()
    }
  })

  it('filters as the search box changes', async () => {
    renderPage()
    await switchToTableView()
    fireEvent.change(screen.getByLabelText('Keresés'), { target: { value: 'zzz-no-match' } })
    await waitFor(() => expect(screen.getByText('Nincs találat.')).toBeInTheDocument())
  })

  it('navigates to the user detail route on row click', async () => {
    renderPage()
    await switchToTableView()
    const target = ADMIN_USER_INSIGHTS_MOCK[1]
    const row = await screen.findByText(target.name)
    fireEvent.click(row.closest('tr')!)
    expect(await screen.findByText('USER DETAIL PAGE')).toBeInTheDocument()
  })
})

describe('AdminUsersPage (real mode)', () => {
  beforeEach(() => { vi.stubEnv('VITE_USE_MOCK', 'false'); setToken('t') })

  it('lists the fetched users as cards', async () => {
    renderPage()
    expect(await screen.findByText(ADMIN_USER_INSIGHTS_MOCK[0].name)).toBeInTheDocument()
  })

  it('shows a tile-level error with a retry when the list fails', async () => {
    server.use(http.get(`${API_BASE}/api/admin/users-insight`, () => new HttpResponse(null, { status: 500 })))
    renderPage()
    expect(await screen.findAllByText(/nem elérhető/i)).not.toHaveLength(0)
    expect(screen.getAllByRole('button', { name: /újra/i }).length).toBeGreaterThan(0)
    expect(screen.getByText('Emberek')).toBeInTheDocument()
  })

  // Fix round 1 (Finding 3): mock mode's useAdminUserInsights ignores sort/dir, so a click on a
  // sort header changes nothing visible there — which is why nobody had tested this wiring.
  // Real mode actually sends sort/dir on the querystring, so intercept the request (the pattern
  // AdminUsagePage.test.tsx uses for `period`) and assert the header click both re-requests with
  // the new sort key/direction AND flips `aria-sort` on the clicked header. Table-view only —
  // the card grid's own sort chips are page-local (kockázat/költség), not this network sort.
  it('re-requests with the new sort/dir when a sort header is clicked, and flips aria-sort', async () => {
    const requests: string[] = []
    server.use(http.get(`${API_BASE}/api/admin/users-insight`, ({ request }) => {
      requests.push(new URL(request.url).search)
      return HttpResponse.json(ADMIN_USER_INSIGHTS_MOCK)
    }))
    renderPage()
    await switchToTableView()
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
