import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { GoalsView } from './GoalsView'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'

// GoalsView's `+ Új cél` entry uses useNavigate, so it needs router context.
function Wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryWrapper>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryWrapper>
  )
}

// The hero tests assert Phase-1 mock goal data, so pin mock mode explicitly.
describe('mock mode (demo goal)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('renders the goal hero, weights and identity frame', () => {
    render(<GoalsView />, { wrapper: Wrapper })
    expect(screen.getByRole('heading', { level: 1, name: /Hosszú cél/ })).toBeInTheDocument()
    expect(screen.getByText('Fogyás · Nyári forma')).toBeInTheDocument()
    expect(screen.getAllByText('78.6').length).toBeGreaterThan(0) // current weight
    expect(screen.getByText(/Egészséges erő/)).toBeInTheDocument() // identityFrame
    expect(screen.queryByText('7 nap')).not.toBeInTheDocument() // trend cells moved to /me/weight
  })

  test('renders the factors section with tool chips', () => {
    render(<GoalsView />, { wrapper: Wrapper })
    expect(screen.getByText('Reta D3-D5 alacsony étvágy')).toBeInTheDocument()
    expect(screen.getByText(/get_weight_log/)).toBeInTheDocument()
  })

  test('renders linked mesocycles with status chips', () => {
    render(<GoalsView />, { wrapper: Wrapper })
    expect(screen.getByText('Hypertrophy 04')).toBeInTheDocument()
    expect(screen.getByText('AKTÍV')).toBeInTheDocument()
  })
})

// Real mode with no active goal: the empty "set up a goal" state + CTA, never
// the mock placeholder hero.
describe('real mode (no goal)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('shows the empty-state setup CTA, not the mock placeholder', async () => {
    server.use(
      http.get(`${API_BASE}/api/goals`, () => HttpResponse.json([])),
      http.get(`${API_BASE}/api/biometrics/weight`, () => HttpResponse.json([])),
    )
    render(<GoalsView />, { wrapper: Wrapper })
    expect(await screen.findByText(/Még nincs aktív célod/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Új cél/ })).toBeInTheDocument()
    // the mock placeholder hero must NOT appear
    expect(screen.queryByText('Fogyás · Nyári forma')).not.toBeInTheDocument()
  })
})
