import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryWrapper } from '@/test/queryWrapper'
import { DiagnosisListPage } from '@/features/insights/pages/DiagnosisListPage'
import { mondayIso } from '@/data/fuel/fuelWeekHooks'
import { API_BASE } from '@/test/msw/handlers'
import { server } from '@/test/msw/server'

const renderPage = (state?: unknown) =>
  render(
    <MemoryRouter initialEntries={[{ pathname: '/mezo/diagnozis', state }]}>
      <Routes>
        <Route path="/mezo/diagnozis" element={<DiagnosisListPage />} />
        <Route path="/mezo/diagnozis/:id" element={<p>riport-oldal</p>} />
        <Route path="/nap" element={<p>nap-oldal</p>} />
        <Route path="/mezo/csapat" element={<p>csapat-oldal</p>} />
      </Routes>
    </MemoryRouter>,
    { wrapper: QueryWrapper },
  )

const wire = (over: Record<string, unknown>) => ({
  id: 'x', phenomenon: 'fatigue', windowDays: 14, anchorStart: null, verdict: 'Rövid alvás.', confidence: 'moderate',
  evidence: [], suspects: [], generatedAt: '2026-09-01T08:00:00Z', stale: false, ...over,
})

describe('Kérdezd a csapatot (mock mode, mezo-u3712)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('every question sits under its host; upcoming ones are dimmed', () => {
    renderPage()
    expect(screen.getByRole('heading', { name: 'Kérdezd a csapatot' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Miért vagyok fáradt? — Mezo nézi meg' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Miért alszom rosszul? — Szunya nézi meg' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Miért mozog a súlyom? — Derű nézi meg' })).toBeInTheDocument()
    expect(screen.getByText('Kell most deload?').closest('.kt-qrow')).toHaveClass('is-soon')
    expect(screen.getByText('Havi Mezo Riport').closest('.kt-qrow')).toHaveClass('is-soon')
    expect(screen.getByText('demo — a kérdezés az élő appban fut')).toBeInTheDocument()
  })

  test('the newest report is the one glass card; past rows are flat and carry their host', () => {
    const { container } = renderPage()
    const latest = container.querySelector('.kt-latest')!
    expect(latest).toHaveClass('glass')
    // the seed's newest row is the weight report (Szep 6) → Derű answered
    expect(within(latest as HTMLElement).getByText('Derű válaszolt')).toBeInTheDocument()
    expect(latest.getAttribute('href')).toBe('/mezo/diagnozis/diag-demo-weight')
    const past = container.querySelectorAll('.kt-past')
    expect(past).toHaveLength(3)
    past.forEach((row) => expect(row).not.toHaveClass('glass'))
    // the stale seed (sleep) says it can be refreshed
    expect(screen.getByText('Frissíthető')).toBeInTheDocument()
  })

  test('the host chips filter the past answers', () => {
    const { container } = renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Szunya' }))
    expect(container.querySelectorAll('.kt-past')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Szunya' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Mind' }))
    expect(container.querySelectorAll('.kt-past')).toHaveLength(3)
  })

  test('the back pill returns to where the user came from; A csapat by default', () => {
    renderPage({ from: '/nap', label: 'Mai' })
    fireEvent.click(screen.getByRole('button', { name: '‹ Mai' }))
    expect(screen.getByText('nap-oldal')).toBeInTheDocument()
  })

  test('without router state the back pill goes to A csapat', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: '‹ A csapat' }))
    expect(screen.getByText('csapat-oldal')).toBeInTheDocument()
  })

  test('the ask sheet says who looks and what; asking is inert in mock', async () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Miért alszom rosszul? — Szunya nézi meg' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Szunya nézi meg')).toBeInTheDocument()
    expect(within(dialog).getByText('lefekvés ideje')).toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Kérdezem' })).not.toBeInTheDocument()
    expect(within(dialog).getByText('demo — a kérdezés az élő appban fut')).toBeInTheDocument()
  })
})

describe('Kérdezd a csapatot (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('honest empty state — never the mock seed; full quota', async () => {
    renderPage()
    expect(await screen.findByText('Még nem kérdeztél.')).toBeInTheDocument()
    expect(screen.queryByText(/Alváshiány/)).not.toBeInTheDocument()
    expect(screen.getByText('3 kérdés')).toBeInTheDocument()
    expect(screen.queryByText('Korábbi válaszok')).not.toBeInTheDocument()
  })

  test('the quota counts today\'s generated rows', async () => {
    server.use(http.get(`${API_BASE}/api/proactive/diagnosis`, () =>
      HttpResponse.json([wire({ id: 'a', generatedAt: new Date().toISOString() })])))
    renderPage()
    expect(await screen.findByText('2 kérdés')).toBeInTheDocument()
  })

  test('Kérdezem generates and opens the fresh report', async () => {
    server.use(
      http.get(`${API_BASE}/api/proactive/diagnosis`, () => HttpResponse.json([])),
      http.post(`${API_BASE}/api/proactive/diagnosis`, () => HttpResponse.json(wire({ id: 'fresh-1' }), { status: 201 })),
    )
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Miért vagyok fáradt? — Mezo nézi meg' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Kérdezem' }))
    expect(await screen.findByText('riport-oldal')).toBeInTheDocument()
  })

  test('409 DIAGNOSIS_INSUFFICIENT_DATA renders the few-domains copy in the sheet', async () => {
    server.use(
      http.get(`${API_BASE}/api/proactive/diagnosis`, () => HttpResponse.json([])),
      http.post(`${API_BASE}/api/proactive/diagnosis`, () =>
        HttpResponse.json([{ code: 'DIAGNOSIS_INSUFFICIENT_DATA', message: 'thin' }], { status: 409 })),
    )
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Miért vagyok fáradt? — Mezo nézi meg' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Kérdezem' }))
    await waitFor(() =>
      expect(screen.getByText('Kettőnél kevesebb területről van adat az elmúlt két hétben — a csapat nem tippel.')).toBeInTheDocument())
  })

  test('409 DIAGNOSIS_INSUFFICIENT_WEIGHINS renders the weigh-in copy for the weight question', async () => {
    server.use(
      http.get(`${API_BASE}/api/proactive/diagnosis`, () => HttpResponse.json([])),
      http.post(`${API_BASE}/api/proactive/diagnosis`, () =>
        HttpResponse.json([{ code: 'DIAGNOSIS_INSUFFICIENT_WEIGHINS', message: 'few' }], { status: 409 })),
    )
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Miért mozog a súlyom? — Derű nézi meg' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Kérdezem' }))
    await waitFor(() =>
      expect(screen.getByText('Ehhez a héthez kevés a mérés — legalább 3 reggeli mérés kell.')).toBeInTheDocument())
  })

  test('the weight question reopens a non-stale report for the chosen week instead of asking', async () => {
    server.use(http.get(`${API_BASE}/api/proactive/diagnosis`, () =>
      HttpResponse.json([wire({ id: 'w-this', phenomenon: 'weight', anchorStart: mondayIso() })])))
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Miért mozog a súlyom? — Derű nézi meg' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Erre a hétre már van válaszod')).toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Kérdezem' })).not.toBeInTheDocument()
    // last week has no report → asking is offered
    fireEvent.click(within(dialog).getByRole('button', { name: /Múlt hét/ }))
    expect(within(dialog).getByRole('button', { name: 'Kérdezem' })).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: /Ez a hét/ }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Megnyitom a választ' }))
    expect(await screen.findByText('riport-oldal')).toBeInTheDocument()
  })
})
