import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { QueryWrapper } from '@/test/queryWrapper'
import { setToken } from '@/data/_client/api'
import { AdminDataPage } from '@/features/admin/pages/AdminDataPage'
import { ADMIN_ROWS_MOCK, ADMIN_TABLES_MOCK, ADMIN_VIEWS_MOCK } from '@/data/admin/adminDataMock'

afterEach(() => { vi.unstubAllEnvs(); setToken(null) })

function renderPage(initialEntry = '/admin/data') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/admin/data" element={<AdminDataPage />} />
      </Routes>
    </MemoryRouter>,
    { wrapper: QueryWrapper },
  )
}

async function pickTable(name: string) {
  fireEvent.click(await screen.findByRole('button', { name }))
}

describe('AdminDataPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  it('lists every mock table and every convenience view', async () => {
    renderPage()
    for (const t of ADMIN_TABLES_MOCK.tables) {
      expect(await screen.findByRole('button', { name: t.name })).toBeInTheDocument()
    }
    for (const v of ADMIN_VIEWS_MOCK) {
      expect(screen.getByRole('button', { name: v.label })).toBeInTheDocument()
    }
  })

  it('picking a view selects its table and applies its default sort', async () => {
    renderPage()
    const view = ADMIN_VIEWS_MOCK[0]
    fireEvent.click(await screen.findByRole('button', { name: view.label }))

    const tableChip = screen.getByRole('button', { name: view.table })
    expect(tableChip).toHaveAttribute('aria-pressed', 'true')
    const sortHeader = await screen.findByRole('columnheader', { name: new RegExp(`^${view.defaultSort}`) })
    expect(sortHeader).toHaveAttribute(
      'aria-sort',
      view.defaultDir === 'asc' ? 'ascending' : 'descending',
    )
  })

  it('expands a jsonb cell to formatted JSON on click', async () => {
    renderPage()
    await pickTable('food_log')
    const jsonButtons = await screen.findAllByRole('button', { expanded: false })
    const cell = jsonButtons.find((b) => b.className.includes('ad-json'))
    expect(cell).toBeDefined()
    fireEvent.click(cell!)
    expect(cell).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(/"source"/)).toBeInTheDocument()
  })

  it('navigates to the referenced table when an FK cell is clicked', async () => {
    renderPage()
    await pickTable('food_log')
    const fkLinks = await screen.findAllByRole('button', { name: /↗/ })
    fireEvent.click(fkLinks[0])
    const appUserChip = await screen.findByRole('button', { name: 'app_user' })
    expect(appUserChip).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('AdminDataPage (real mode)', () => {
  beforeEach(() => { vi.stubEnv('VITE_USE_MOCK', 'false'); setToken('t') })

  it('lists the fetched tables and views', async () => {
    renderPage()
    for (const t of ADMIN_TABLES_MOCK.tables) {
      expect(await screen.findByRole('button', { name: t.name })).toBeInTheDocument()
    }
    for (const v of ADMIN_VIEWS_MOCK) {
      expect(screen.getByRole('button', { name: v.label })).toBeInTheDocument()
    }
  })

  it('sends includeDeleted when the "Törölt sorok" toggle is on', async () => {
    let seen = ''
    server.use(http.get(`${API_BASE}/api/admin/data/tables/:table/rows`, ({ request }) => {
      seen = new URL(request.url).search
      return HttpResponse.json(ADMIN_ROWS_MOCK.food_log)
    }))
    renderPage()
    await pickTable('food_log')
    fireEvent.click(await screen.findByRole('checkbox', { name: /törölt/i }))
    await waitFor(() => expect(seen).toContain('includeDeleted=true'))
  })

  it('requests page=1 when paging forward', async () => {
    let seen = ''
    server.use(http.get(`${API_BASE}/api/admin/data/tables/:table/rows`, ({ request }) => {
      seen = new URL(request.url).search
      return HttpResponse.json(ADMIN_ROWS_MOCK.food_log)
    }))
    renderPage()
    await pickTable('food_log')
    // Wait for the real rows to land (not just the "realEmpty" cold-load frame) so the Next
    // button has already become enabled — clicking it while still disabled is a silent no-op.
    await screen.findAllByRole('button', { name: /↗/ })
    const nextBtn = await screen.findByRole('button', { name: /következő/i })
    await waitFor(() => expect(nextBtn).toBeEnabled())
    fireEvent.click(nextBtn)
    await waitFor(() => expect(seen).toContain('page=1'))
  })
})
