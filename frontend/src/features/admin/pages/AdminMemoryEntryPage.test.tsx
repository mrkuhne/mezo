import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { QueryWrapper } from '@/test/queryWrapper'
import { setToken } from '@/data/_client/api'
import { AdminMemoryEntryPage, hoursSinceLabel } from '@/features/admin/pages/AdminMemoryEntryPage'
import { ADMIN_MEMORY_GLOBAL_HEALTH_MOCK, ADMIN_MEMORY_GLOBAL_HEALTH_EMPTY } from '@/data/admin/adminMemoryMock'
import { ADMIN_USER_INSIGHTS_MOCK } from '@/data/admin/adminInsightsMock'
import { huInt } from '@/shared/lib/huNum'

afterEach(() => { vi.unstubAllEnvs(); setToken(null) })

function renderPage() {
  return render(
    <QueryWrapper>
      <MemoryRouter>
        <AdminMemoryEntryPage />
      </MemoryRouter>
    </QueryWrapper>,
  )
}

describe('hoursSinceLabel', () => {
  it('renders "X órája" and warns above 26h', () => {
    const now = new Date('2026-09-09T06:00:00Z')
    expect(hoursSinceLabel('2026-09-08T00:00:00Z', now)).toEqual({ text: '30 órája', warnHours: true })
    expect(hoursSinceLabel('2026-09-09T04:00:00Z', now)).toEqual({ text: '2 órája', warnHours: false })
  })

  it('is honest about a summary that never ran', () => {
    expect(hoursSinceLabel(null)).toEqual({ text: 'még nem futott', warnHours: false })
    expect(hoursSinceLabel(undefined)).toEqual({ text: 'még nem futott', warnHours: false })
  })
})

describe('AdminMemoryEntryPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  it('renders the install-wide KPI posters', async () => {
    renderPage()
    await screen.findByText('Kész vektorok')
    expect(screen.getByText(huInt(ADMIN_MEMORY_GLOBAL_HEALTH_MOCK.vectorsReady))).toBeInTheDocument()
    expect(screen.getByText('Elakadt vektorok')).toBeInTheDocument()
    expect(screen.getByText('Elavult vektorok')).toBeInTheDocument()
    expect(screen.getByText('Emlékek összesen')).toBeInTheDocument()
  })

  it('renders the tester picker with a link into each user\'s memory explorer', async () => {
    renderPage()
    const first = ADMIN_USER_INSIGHTS_MOCK[0]
    const link = await screen.findByRole('link', { name: new RegExp(first.name) })
    expect(link).toHaveAttribute('href', `/admin/users/${first.id}/memory`)
  })
})

describe('AdminMemoryEntryPage (real mode)', () => {
  beforeEach(() => { vi.stubEnv('VITE_USE_MOCK', 'false'); setToken('t') })

  it('a 404-with-no-ADMIN_MEMORY-code renders the "ki van kapcsolva" tile, tester picker unaffected', async () => {
    server.use(http.get(`${API_BASE}/api/admin/memory/health`, () => new HttpResponse(null, { status: 404 })))
    renderPage()
    expect(await screen.findByText(/ki van kapcsolva/)).toBeInTheDocument()
    expect(await screen.findByText('Tesztelők')).toBeInTheDocument()
  })

  it('a null newestDailySummaryAt on a fresh install says "még nem futott", no warn tone', async () => {
    server.use(http.get(`${API_BASE}/api/admin/memory/health`, () => HttpResponse.json(ADMIN_MEMORY_GLOBAL_HEALTH_EMPTY)))
    renderPage()
    expect(await screen.findByText('még nem futott')).toBeInTheDocument()
    expect(screen.queryByText(/a napi összegzés a szokásosnál régebben futott/)).not.toBeInTheDocument()
  })
})
