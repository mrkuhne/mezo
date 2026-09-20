import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { MemoryRouter } from 'react-router-dom'
import { QueryWrapper } from '@/test/queryWrapper'
import { DiagnosisListPage } from '@/features/insights/pages/DiagnosisListPage'
import { API_BASE } from '@/test/msw/handlers'
import { server } from '@/test/msw/server'

const renderPage = () =>
  render(
    <MemoryRouter>
      <DiagnosisListPage />
    </MemoryRouter>,
    { wrapper: QueryWrapper },
  )

describe('DiagnosisListPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('renders all THREE live ask cards, the upcoming catalog and the seeded reports', () => {
    renderPage()
    expect(screen.getByText('Diagnózis')).toBeInTheDocument()
    // three live questions since mezo-85x5r (weight joined fatigue+sleep) — the fatigue title
    // also heads a seeded past tile
    expect(screen.getAllByText('Miért vagyok fáradt?').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Miért alszom rosszul?')).toBeInTheDocument()
    // the weight title also heads the seeded weight past tile, same as fatigue above
    expect(screen.getAllByText('Miért mozog a súlyom?').length).toBeGreaterThanOrEqual(1)
    // generate is inert in mock — it costs a real SMART call — on EVERY live card
    const asks = screen.getAllByRole('button', { name: 'Kérdezd meg most' })
    expect(asks).toHaveLength(3)
    // the ask CTA is the house pill button, not an unstyled bare 'cta' (the live-app regression)
    asks.forEach((b) => expect(b).toHaveClass('mzp-cta'))
    asks.forEach((b) => expect(b).toBeDisabled())
    expect(screen.getByText('demo — a kérdezés az élő appban fut')).toBeInTheDocument()
    // the upcoming grid: sleep+weight LEFT it by going live; weight's old title is gone
    expect(screen.queryByText('Miért nem mozdul a súlyom?')).not.toBeInTheDocument()
    expect(screen.getByText('Kell most deload?')).toBeInTheDocument()
    expect(screen.getByText('Havi Mezo Riport')).toBeInTheDocument()
    // the seeded past reports with their strongest suspect
    expect(screen.getByText(/a legerősebb: Alváshiány \(erős\)/)).toBeInTheDocument()
    expect(screen.getByText(/a legerősebb: Vízvisszatartás — só és szénhidrát \(erős\)/)).toBeInTheDocument()
  })
})

describe('DiagnosisListPage (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('honest empty state — never the mock seed', async () => {
    renderPage()
    await waitFor(() =>
      expect(screen.getByText('Még nem kérdezted meg. A Mezo az elmúlt két hét adataiból keres okokat.')).toBeInTheDocument(),
    )
    expect(screen.queryByText(/Alváshiány/)).not.toBeInTheDocument()
    screen.getAllByRole('button', { name: 'Kérdezd meg most' }).forEach((b) => expect(b).toBeEnabled())
    expect(screen.getByText('napi 3 kérdés · a megnyitás mindig ingyen')).toBeInTheDocument()
  })

  // mezo-85x5r final-review wave: the two 409 codes render DIFFERENT copy here too (the catalog
  // asks weight as well as fatigue/sleep, so both codes are reachable from this page).
  test('409 DIAGNOSIS_INSUFFICIENT_DATA renders the few-domains copy', async () => {
    server.use(
      http.get(`${API_BASE}/api/proactive/diagnosis`, () => HttpResponse.json([])),
      http.post(`${API_BASE}/api/proactive/diagnosis`, () =>
        HttpResponse.json([{ code: 'DIAGNOSIS_INSUFFICIENT_DATA', message: 'thin' }], { status: 409 })),
    )
    renderPage()
    const [fatigueAsk] = await screen.findAllByRole('button', { name: 'Kérdezd meg most' })
    fireEvent.click(fatigueAsk)
    await waitFor(() =>
      expect(screen.getByText('Kettőnél kevesebb területről van adat az elmúlt két hétben — a Mezo nem tippel.'))
        .toBeInTheDocument(),
    )
  })

  test('409 DIAGNOSIS_INSUFFICIENT_WEIGHINS renders the weigh-in copy, not the few-domains copy', async () => {
    server.use(
      http.get(`${API_BASE}/api/proactive/diagnosis`, () => HttpResponse.json([])),
      http.post(`${API_BASE}/api/proactive/diagnosis`, () =>
        HttpResponse.json([{ code: 'DIAGNOSIS_INSUFFICIENT_WEIGHINS', message: 'too few weigh-ins' }], { status: 409 })),
    )
    renderPage()
    const asks = await screen.findAllByRole('button', { name: 'Kérdezd meg most' })
    // the third live question is 'weight' (see LIVE_QUESTIONS) — the one that actually hits the
    // weigh-in gate on the real backend.
    fireEvent.click(asks[2])
    await waitFor(() =>
      expect(screen.getByText('Ehhez a héthez kevés a mérés — legalább 3 reggeli mérés kell.')).toBeInTheDocument(),
    )
    expect(
      screen.queryByText('Kettőnél kevesebb területről van adat az elmúlt két hétben — a Mezo nem tippel.'),
    ).not.toBeInTheDocument()
  })
})

// mezo-hq44: a „Kérdezd meg" szemöldök és a CTA ✦-ja sparkle-ikon lett. A gomb
// akadálymentes neve emiatt a puszta szöveg — a látható copy változatlan.
describe('DiagnosisListPage — emoji→ikon (mezo-hq44)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('a szemöldök és a CTA ikont rajzol, nem ✦ glifát', () => {
    const { container } = renderPage()
    const eyebrows = container.querySelectorAll('.mzp-pred .mz-eyebrow')
    const ask = Array.from(eyebrows).find((e) => /Kérdezd meg/.test(e.textContent ?? '')) as HTMLElement
    expect(ask).toBeTruthy()
    expect(ask.querySelector('svg')).toBeTruthy()
    expect(ask.textContent).not.toMatch(/✦/)
    const ctas = screen.getAllByRole('button', { name: 'Kérdezd meg most' })
    expect(ctas).toHaveLength(3)
    ctas.forEach((b) => {
      expect(b.querySelector('svg')).toBeTruthy()
      expect(b.textContent).not.toMatch(/✦/)
    })
  })
})
