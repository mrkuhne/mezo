import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { QueryWrapper } from '@/test/queryWrapper'
import { setToken } from '@/data/_client/api'
import { ADMIN_ALERTS_EMPTY } from '@/data/admin/adminInsightsMock'

// mezo-m079 (Task 1): AdminStatusBand is self-contained (calls useAdminAlerts itself), so
// the only outside seam a test needs to control is navigation — mocked exactly like
// GoalsPage.test.tsx's `useNavigate` recipe.
const mocks = vi.hoisted(() => ({ navigate: vi.fn() }))
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mocks.navigate }
})

import { AdminStatusBand } from '@/features/admin/components/AdminStatusBand'

afterEach(() => { vi.unstubAllEnvs(); setToken(null); mocks.navigate.mockReset() })

function renderBand() {
  return render(<MemoryRouter><AdminStatusBand /></MemoryRouter>, { wrapper: QueryWrapper })
}

describe('AdminStatusBand (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  it('lists clickable alert chips when alerts exist (mock seed has 2)', async () => {
    renderBand()
    expect(await screen.findByText('Tegnapi AI-költés kiugróan magas')).toBeInTheDocument()
    expect(screen.getByText('Elakadt emlék-feldolgozás')).toBeInTheDocument()
    expect(screen.getByText(/figyelmet kér/)).toBeInTheDocument()
  })

  it('navigates to the alert link on chip click', async () => {
    renderBand()
    fireEvent.click(await screen.findByText('Tegnapi AI-költés kiugróan magas'))
    expect(mocks.navigate).toHaveBeenCalledWith('/admin/cost?day=2026-09-07')
  })
})

// Mock mode's queryFn never rejects and never resolves empty (it always serves the frozen
// seed synchronously — useDualQuery.ts), so the empty/error/subject-labeling states can only
// be exercised in real mode via MSW overrides — the same reasoning AdminUsagePage.test.tsx's
// real-mode error tests already document.
describe('AdminStatusBand (real mode)', () => {
  beforeEach(() => { vi.stubEnv('VITE_USE_MOCK', 'false'); setToken('test-token') })

  it('renders the green all-good state on empty alerts', async () => {
    server.use(http.get(`${API_BASE}/api/admin/alerts`, () => HttpResponse.json(ADMIN_ALERTS_EMPTY)))
    renderBand()
    expect(await screen.findByText('Minden rendben')).toBeInTheDocument()
  })

  it('renders the grey unavailable state on error, never green', async () => {
    server.use(http.get(`${API_BASE}/api/admin/alerts`, () => new HttpResponse(null, { status: 500 })))
    renderBand()
    expect(await screen.findByText('Az ellenőrzés most nem fut')).toBeInTheDocument()
    expect(screen.queryByText('Minden rendben')).not.toBeInTheDocument()
  })

  it('labels the subject via the dictionary when present', async () => {
    server.use(http.get(`${API_BASE}/api/admin/alerts`, () => HttpResponse.json({
      generatedAt: new Date().toISOString(),
      alerts: [{
        key: 'llm_errors',
        severity: 'bad',
        title: 'Magas hibaarány',
        detail: 'A beszélgetés hívások 24%-a hibára futott az elmúlt napon.',
        link: '/admin/cost',
        subject: 'companion_chat',
      }],
    })))
    renderBand()
    expect(await screen.findByText(/Beszélgetés a társsal/)).toBeInTheDocument()
  })
})
