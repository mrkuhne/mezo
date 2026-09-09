import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { QueryWrapper } from '@/test/queryWrapper'
import { setToken } from '@/data/_client/api'
import { ADMIN_ALERTS_EMPTY, ADMIN_ALERTS_MOCK } from '@/data/admin/adminInsightsMock'

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
    // mezo-pfdv fix round 3: the mock's cost_spike link is derived relative to "now" (so it
    // stays aligned with the LLM_CALLS_MOCK seed's own day — see adminInsightsMock.ts's comment),
    // not a hardcoded date — read it back off the fixture instead of hardcoding it here too.
    renderBand()
    fireEvent.click(await screen.findByText('Tegnapi AI-költés kiugróan magas'))
    expect(mocks.navigate).toHaveBeenCalledWith(ADMIN_ALERTS_MOCK.alerts[0].link)
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

  // Final review F1: `llm_errors` fires once PER FEATURE — same `key`, different `subject` —
  // which used to collide into duplicate React keys (`key={a.key}`). Both rows must still
  // render distinctly; this is the closest a test gets to proving the key collision is gone
  // (React swallows the dev-only duplicate-key warning rather than failing the render, so the
  // real assertion is that BOTH alerts survive onto the screen).
  it('renders every alert distinctly even when several share the same rule key (llm_errors per feature)', async () => {
    server.use(http.get(`${API_BASE}/api/admin/alerts`, () => HttpResponse.json({
      generatedAt: new Date().toISOString(),
      alerts: [
        {
          key: 'llm_errors', severity: 'bad', title: 'Magas hibaarány',
          detail: 'A beszélgetés hívások 24%-a hibára futott.', link: '/admin/cost', subject: 'companion_chat',
        },
        {
          key: 'llm_errors', severity: 'bad', title: 'Magas hibaarány',
          detail: 'Az étkezés-tanácsadó hívások 30%-a hibára futott.', link: '/admin/cost', subject: 'meal_coach',
        },
      ],
    })))
    renderBand()
    expect(await screen.findByText(/Beszélgetés a társsal/)).toBeInTheDocument()
    expect(await screen.findByText(/Étkezési tanácsadó/)).toBeInTheDocument()
  })
})
