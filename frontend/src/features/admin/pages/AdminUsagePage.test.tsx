import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { QueryWrapper } from '@/test/queryWrapper'
import { setToken } from '@/data/_client/api'
import { AdminUsagePage } from '@/features/admin/pages/AdminUsagePage'
import { ADMIN_FEATURE_USAGE_MOCK } from '@/data/admin/adminInsightsMock'

afterEach(() => { vi.unstubAllEnvs(); setToken(null) })

function renderPage() {
  return render(<MemoryRouter><AdminUsagePage /></MemoryRouter>, { wrapper: QueryWrapper })
}

describe('AdminUsagePage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  it('renders a matrix cell per feature × day', async () => {
    renderPage()
    expect(await screen.findByText('Feature-használat')).toBeInTheDocument()
    const expected = ADMIN_FEATURE_USAGE_MOCK.features.length * ADMIN_FEATURE_USAGE_MOCK.days.length
    // every cell carries its own aria-label — MatrixGrid.tsx
    const cells = document.querySelectorAll('.ad-matrixtable td.cell')
    expect(cells.length).toBe(expected)
  })

  it('changing the period button selects it', async () => {
    renderPage()
    await screen.findByText('Feature-használat')
    const btn7 = screen.getByRole('button', { name: '7 nap' })
    fireEvent.click(btn7)
    expect(btn7).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('AdminUsagePage (real mode)', () => {
  beforeEach(() => { vi.stubEnv('VITE_USE_MOCK', 'false'); setToken('t') })

  it('renders the fetched matrix', async () => {
    renderPage()
    await screen.findByText('Feature-használat')
    await waitFor(() => {
      const cells = document.querySelectorAll('.ad-matrixtable td.cell')
      expect(cells.length).toBe(ADMIN_FEATURE_USAGE_MOCK.features.length * ADMIN_FEATURE_USAGE_MOCK.days.length)
    })
  })

  it('refetches when the period changes', async () => {
    let requestedPeriods: string[] = []
    server.use(http.get(`${API_BASE}/api/admin/usage/features`, ({ request }) => {
      const period = new URL(request.url).searchParams.get('period') ?? '30d'
      requestedPeriods.push(period)
      return HttpResponse.json({ ...ADMIN_FEATURE_USAGE_MOCK, period })
    }))
    renderPage()
    await screen.findByText('Feature-használat')
    await waitFor(() => expect(requestedPeriods).toContain('30d'))
    fireEvent.click(screen.getByRole('button', { name: '7 nap' }))
    await waitFor(() => expect(requestedPeriods).toContain('7d'))
  })

  it('shows a tile-level error with a retry when the matrix fails', async () => {
    server.use(http.get(`${API_BASE}/api/admin/usage/features`, () => new HttpResponse(null, { status: 500 })))
    renderPage()
    expect(await screen.findByText(/nem elérhető/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /újra/i })).toBeInTheDocument()
    expect(screen.getByText('Feature-használat')).toBeInTheDocument()
  })
})
