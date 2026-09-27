import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/data/_client/api'
import { QueryWrapper } from '@/test/queryWrapper'
import { ROLAD_COPY } from '@/features/insights/logic/roladCopy'
import { RoladLifeEventsPage } from '@/features/insights/pages/RoladLifeEventsPage'

// S6c (mezo-2dfy2): the life-event timeline moved off the Rólad page onto its own subpage.
const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/mezo/rolad/eletesemenyek']}>
      <Routes><Route path="/mezo/rolad/eletesemenyek" element={<RoladLifeEventsPage />} /></Routes>
    </MemoryRouter>,
    { wrapper: QueryWrapper },
  )

describe('RoladLifeEventsPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('header, lede, the seeded life event and the footnote', () => {
    const { container } = renderPage()
    expect(screen.getByText('Életesemények', { selector: 'strong' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Vissza: Rólad' })).toBeInTheDocument()
    expect(screen.getByText(ROLAD_COPY.lifeEventsLede)).toBeInTheDocument()
    const rows = container.querySelectorAll('[data-life-row]')
    expect([...rows].some((r) => r.textContent?.includes('Új munkahely első hete'))).toBe(true)
    expect(screen.getByText(ROLAD_COPY.lifeEventsFoot)).toBeInTheDocument()
  })
})

describe('RoladLifeEventsPage (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('an empty graph is a real answer, never a blank page', async () => {
    server.use(http.get(`${API_BASE}/api/companion/graph/node`, () => HttpResponse.json([])))
    renderPage()
    expect(await screen.findByText(ROLAD_COPY.lifeEventsEmpty)).toBeInTheDocument()
  })
})
