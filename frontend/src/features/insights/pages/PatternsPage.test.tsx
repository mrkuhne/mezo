import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/data/_client/api'
import { QueryWrapper } from '@/test/queryWrapper'
import { PatternsPage } from '@/features/insights/pages/PatternsPage'

const renderPage = () =>
  render(
    <MemoryRouter>
      <PatternsPage />
    </MemoryRouter>,
    { wrapper: QueryWrapper },
  )

describe('PatternsPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('shows the pattern count, the confidence floor and the recently-confirmed list', () => {
    renderPage()
    expect(screen.getByText('Új minták · 3')).toBeInTheDocument()
    expect(screen.getByText('min. 65% conf')).toBeInTheDocument()
    expect(screen.getByText('Recently confirmed · L3')).toBeInTheDocument()
    expect(screen.getByText('Hét 18: Pre-workout 2-3h whey + carb')).toBeInTheDocument()
  })

  test('renders one card per pattern', () => {
    renderPage()
    expect(screen.getByText('Reta beadás + 36h ablakban étvágy lefulladás')).toBeInTheDocument()
    expect(screen.getByText('Caffeine 14:00 utáni dózis → sleep onset +24 perc')).toBeInTheDocument()
  })

  test('highlights the ?pair= match and renders the motor back-link on every card', () => {
    render(
      <MemoryRouter initialEntries={['/insights/patterns?pair=late-meal~next-sleep-quality']}>
        <PatternsPage />
      </MemoryRouter>,
      { wrapper: QueryWrapper },
    )
    const cards = screen.getAllByTestId('pattern-card')
    const highlighted = cards.filter((c) => c.getAttribute('data-highlighted') === 'true')
    expect(highlighted).toHaveLength(1)
    expect(within(highlighted[0]).getByText('Késő szénhidrát (>20:00 · >60g) → másnap reggeli RPE +1')).toBeInTheDocument()
    expect(within(highlighted[0]).getByRole('link', { name: /Motor-diagnosztika/ })).toHaveAttribute(
      'href',
      '/insights/motor',
    )
  })
})

describe('PatternsPage (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('lists the backend patterns (statistical rows show "tanulom", no critique bars)', async () => {
    server.use(
      http.get(`${API_BASE}/api/companion/pattern`, () =>
        HttpResponse.json([
          {
            id: 'w1',
            kind: 'statistical',
            category: 'physiology',
            categoryLabel: 'Fiziológia',
            title: 'Alvásminőség ↔ másnapi edzés-RPE',
            mechanism: 'Erős negatív együttjárás.',
            evidence: ['r=-0.82', 'n=14 nap'],
            confidence: null,
            critique: null,
            status: 'proposed',
            lastDetectedAt: '2026-07-04T02:40:00Z',
          },
        ]),
      ),
    )
    renderPage()

    expect(await screen.findByText('Alvásminőség ↔ másnapi edzés-RPE')).toBeInTheDocument()
    expect(screen.getByText('Új minták · 1')).toBeInTheDocument()
    expect(screen.getByText('tanulom')).toBeInTheDocument()
    expect(screen.getByText('r=-0.82')).toBeInTheDocument()
    expect(screen.queryByText('Statistical')).not.toBeInTheDocument() // no critique grid
  })

  test('a switch-off 404 renders the honest degraded card, with a link to the motor page', async () => {
    server.use(
      http.get(`${API_BASE}/api/companion/pattern`, () =>
        HttpResponse.json([{ code: 'NOT_FOUND' }], { status: 404 }),
      ),
    )
    renderPage()

    expect(await screen.findByText(/minta-motor most nem elérhető/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Miért nincs még minta? →' })).toHaveAttribute(
      'href',
      '/insights/motor',
    )
  })

  test('an empty (non-degraded) pattern list also links to the motor page', async () => {
    server.use(http.get(`${API_BASE}/api/companion/pattern`, () => HttpResponse.json([])))
    renderPage()

    expect(
      await screen.findByText('Még nincs felismert minta — az éjszakai elemzés magától tölti, ahogy gyűlnek a napok.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Miért nincs még minta? →' })).toHaveAttribute(
      'href',
      '/insights/motor',
    )
  })
})
