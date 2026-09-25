import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter } from 'react-router-dom'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { QueryWrapper } from '@/test/queryWrapper'
import { ExperimentsPage } from '@/features/insights/pages/ExperimentsPage'

const renderPage = () =>
  render(
    <MemoryRouter>
      <ExperimentsPage />
    </MemoryRouter>,
    { wrapper: QueryWrapper },
  )

describe('ExperimentsPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('renders the count, an active + a completed experiment, and the inert propose CTA', async () => {
    renderPage()
    // Üveg halo hero (mezo-me75u.8): t-flask art + the named count + the principle line.
    expect(screen.getByText('N=1 kísérletek')).toBeInTheDocument()
    expect(document.querySelector('.exl-page .uv-hero use')?.getAttribute('href')).toBe('#t-flask')
    await waitFor(() => expect(document.querySelector('.mz-bignum')?.textContent).toBe('2 kísérlet'))
    expect(screen.getByText('a saját testeden bizonyítjuk')).toBeInTheDocument()
    expect(screen.getByText('Glikogén-feltöltés volleyball előtt')).toBeInTheDocument()
    // status glyphs became words + 3D icons (bible rule 45): Aktív → t-clock, Megerősítve → t-tick
    const activeChip = screen.getByText('Aktív', { selector: '.exl-chip' })
    const okChip = screen.getByText('Megerősítve', { selector: '.exl-chip' })
    expect(activeChip.querySelector('use')?.getAttribute('href')).toBe('#t-clock')
    expect(okChip.querySelector('use')?.getAttribute('href')).toBe('#t-tick')
    expect(screen.queryByText(/[◐◇✓◯◌＋]/)).not.toBeInTheDocument()
    expect(screen.getByText('Megerősítve · 3/4 mérés')).toBeInTheDocument()
    // the ＋ glyph became a t-bulb icon; the accessible name is the words
    const cta = screen.getByRole('button', { name: 'Új kísérletet javasol Mezo' })
    expect(cta.querySelector('use')?.getAttribute('href')).toBe('#t-bulb')
    // the mock seed has no proposed rows, so no accept/dismiss buttons appear (byte-parity)
    expect(screen.queryByRole('button', { name: 'Elfogadom' })).not.toBeInTheDocument()
  })

  test('ranking: active → the one amber glass card with day segments + bar, closed → flat sage-chip row (mezo-me75u.8)', () => {
    const { container } = renderPage()
    // active exp (4/7): the only glass card, amber, one segment per day, the elapsed ones lit, today outlined
    expect(container.querySelectorAll('.exl-page .mz-page-body .glass')).toHaveLength(1)
    const active = container.querySelector('.exl-card[data-status="active"]') as HTMLElement
    expect(active).not.toBeNull()
    expect(active.classList.contains('glass')).toBe(true)
    expect(active.style.getPropertyValue('--c')).toBe('var(--dv-amber)')
    const dots = active.querySelectorAll('.exl-dots i')
    expect(dots).toHaveLength(7)
    expect(active.querySelectorAll('.exl-dots i.is-done')).toHaveLength(4)
    expect(active.querySelectorAll('.exl-dots i.is-now')).toHaveLength(1)
    expect(active.textContent).toContain('4/7 nap')
    const fill = active.querySelector('.exl-bar.uv-bar > b') as HTMLElement
    expect(fill).not.toBeNull()
    expect(fill.style.getPropertyValue('--w')).toBe('57%') // round(4/7)
    // confirmed exp: flat row (no glass), sage chip, no segments, no bar — just the outcome line
    const done = container.querySelector('.exl-card[data-status="completed"]') as HTMLElement
    expect(done).not.toBeNull()
    expect(done.classList.contains('glass')).toBe(false)
    expect(done.querySelector('.exl-chip')?.getAttribute('data-tone')).toBe('sage')
    expect(done.querySelector('.exl-dots')).toBeNull()
    expect(done.querySelector('.exl-bar')).toBeNull()
    expect(container.querySelector('.mz-play')).not.toBeNull()
  })
})

describe('ExperimentsPage (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('renders a proposed experiment with L2 accept/dismiss; accepting posts and flips to ◐ Aktív 0/7', async () => {
    let accepted = false
    server.use(
      http.get(`${API_BASE}/api/proactive/experiment`, () =>
        HttpResponse.json([
          {
            id: 'e1',
            title: 'Esti magnézium',
            hypothesis: 'Korábbi adagolás → mélyebb alvás.',
            status: accepted ? 'active' : 'proposed',
            metricKey: 'sleep_avg',
            expectedDirection: 'up',
            startDate: null,
            totalDays: 7,
            outcome: null,
            outcomeGood: null,
            generatedAt: '2026-07-07T06:45:00Z',
          },
        ]),
      ),
    )
    renderPage()
    expect(await screen.findByText('Esti magnézium')).toBeInTheDocument()
    expect(screen.getByText('Javaslat', { selector: '.exl-chip' })).toBeInTheDocument()
    expect(screen.getByText('Javaslat', { selector: '.exl-chip' }).querySelector('use')?.getAttribute('href')).toBe('#t-bulb')
    expect(screen.queryByText('hamarosan')).not.toBeInTheDocument()

    let posted = false
    server.use(
      http.post(`${API_BASE}/api/proactive/experiment/:id/decision`, async ({ params }) => {
        posted = true
        accepted = true
        return HttpResponse.json({
          id: params.id, title: 'Esti magnézium', hypothesis: 'x', status: 'active',
          metricKey: 'sleep_avg', expectedDirection: 'up', startDate: null, totalDays: 7,
          outcome: null, outcomeGood: null, generatedAt: '2026-07-07T06:45:00Z',
        })
      }),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Elfogadom' }))
    await waitFor(() => expect(posted).toBe(true))
    // the accept mutation invalidates → the refetched row re-faces as the active amber tile
    expect(await screen.findByText('Aktív', { selector: '.exl-chip' })).toBeInTheDocument()
    expect(screen.getByText('0/7 nap')).toBeInTheDocument()
    expect(screen.queryByText('Javaslat', { selector: '.exl-chip' })).not.toBeInTheDocument()
  })

  test('renders the honest still-learning null-state on the default empty array', async () => {
    renderPage()
    expect(
      await screen.findByText('Az első N=1 kísérletet a megerősített mintákból javasolja Mezo.'),
    ).toBeInTheDocument()
    // no fabricated 0 in the hero — the empty branch renders no big number at all
    await waitFor(() => expect(document.querySelector('.mz-bignum')).toBeNull())
  })
})

// mezo-hq44: az „Elvetve" státusz-chip x-ikont kap; a ✓ Megerősítve marad glifa
// (házi pipa-idióma), ezért a fenti byte-parity elvárások érintetlenek.
describe('ExperimentsPage — emoji→ikon (mezo-hq44)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('a dismissed chip ikonos, a szöveg marad „Elvetve"', async () => {
    server.use(
      http.get(`${API_BASE}/api/proactive/experiment`, () =>
        HttpResponse.json([
          {
            id: 'e9', title: 'Elvetett kísérlet', hypothesis: 'h', status: 'dismissed',
            metricKey: 'sleep_avg', expectedDirection: 'up', startDate: null, totalDays: 7,
            outcome: null, outcomeGood: null, generatedAt: '2026-07-07T06:45:00Z',
          },
        ]),
      ),
    )
    const { container } = renderPage()
    expect(await screen.findByText('Elvetett kísérlet')).toBeInTheDocument()
    // a dismissed experiment is neutral (never red) and wears t-skip (bible rule 45)
    const chip = container.querySelector('.exl-chip[data-tone="mute"]') as HTMLElement
    expect(chip).not.toBeNull()
    expect(chip.querySelector('use')?.getAttribute('href')).toBe('#t-skip')
    expect(chip.textContent).not.toMatch(/✕/)
    expect(chip.textContent).toMatch(/Elvetve/)
  })
})

// Proactive P2 product rule: a refuted experiment is muted, never red (bible U7 rule 53).
describe('ExperimentsPage — Nem igazolódott stays neutral (mezo-me75u.8)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('a refuted chip is the neutral tone with t-down, the outcome line keeps its text', async () => {
    server.use(
      http.get(`${API_BASE}/api/proactive/experiment`, () =>
        HttpResponse.json([
          {
            id: 'e7', title: 'Hideg zuhany', hypothesis: 'h', status: 'completed',
            metricKey: 'sleep_avg', expectedDirection: 'up', startDate: '2026-07-01', totalDays: 7,
            outcome: 'a regeneráció nem változott', outcomeGood: false, generatedAt: '2026-07-07T06:45:00Z',
          },
        ]),
      ),
    )
    const { container } = renderPage()
    expect(await screen.findByText('Hideg zuhany')).toBeInTheDocument()
    const chip = screen.getByText('Nem igazolódott', { selector: '.exl-chip' })
    expect(chip.getAttribute('data-tone')).toBe('mute')
    expect(chip.querySelector('use')?.getAttribute('href')).toBe('#t-down')
    expect(screen.getByText('a regeneráció nem változott')).toBeInTheDocument()
    expect(container.querySelector('.exl-card[data-status="completed"]')?.classList.contains('glass')).toBe(false)
  })
})
