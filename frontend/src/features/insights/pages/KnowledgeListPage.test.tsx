import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/data/_client/api'
import { QueryWrapper } from '@/test/queryWrapper'
import { KnowledgeListPage } from '@/features/insights/pages/KnowledgeListPage'
import { candidateSeed } from '@/data/insights/knowledge'

const renderPage = () => render(<KnowledgeListPage />, { wrapper: QueryWrapper })

describe('KnowledgeListPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('shows the fact count and the active-in-prompt count', () => {
    renderPage()
    expect(screen.getByText('Tudás · 15 fact')).toBeInTheDocument()
    // 14 of the 15 seeded facts start active (f9 is inactive)
    expect(screen.getByText('14 aktív promptban')).toBeInTheDocument()
    expect(screen.getByText('Caffeine cutoff: 14:00 hard limit')).toBeInTheDocument()
  })

  test('toggling a fact updates the active count', async () => {
    renderPage()
    const toggles = screen.getAllByRole('switch')
    await userEvent.click(toggles[0]) // f1 active → inactive
    expect(await screen.findByText('13 aktív promptban')).toBeInTheDocument()
  })

  test('renders the pending candidates with the L2 actions', () => {
    renderPage()
    expect(screen.getByText(`Jóváhagyásra vár · ${candidateSeed.length}`)).toBeInTheDocument()
    expect(screen.getByText(candidateSeed[0].text)).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Elfogad' })).toHaveLength(candidateSeed.length)
  })

  test('accepting a candidate promotes it into the fact list', async () => {
    renderPage()
    await userEvent.click(screen.getAllByRole('button', { name: 'Elfogad' })[0])
    expect(await screen.findByText('Tudás · 16 fact')).toBeInTheDocument()
    expect(screen.getByText('Jóváhagyásra vár · 1')).toBeInTheDocument()
  })

  test('refining reveals the inline input and promotes the corrected wording', async () => {
    renderPage()
    await userEvent.click(screen.getAllByRole('button', { name: 'Pontosít' })[0])
    const input = screen.getByLabelText('Pontosított tény')
    await userEvent.clear(input)
    await userEvent.type(input, 'Pontosított tudás')
    await userEvent.click(screen.getByRole('button', { name: 'Mentés' }))
    expect(await screen.findByText('Pontosított tudás')).toBeInTheDocument()
    expect(screen.getByText('Tudás · 16 fact')).toBeInTheDocument()
  })

  test('rejecting a candidate removes it without promoting', async () => {
    renderPage()
    await userEvent.click(screen.getAllByRole('button', { name: 'Elvet' })[0])
    expect(await screen.findByText('Jóváhagyásra vár · 1')).toBeInTheDocument()
    expect(screen.getByText('Tudás · 15 fact')).toBeInTheDocument()
  })
})

describe('KnowledgeListPage (V3.3 evidence link, real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('a pattern-sourced fact renders the promoting pattern chip', async () => {
    server.use(
      http.get(`${API_BASE}/api/companion/fact`, () =>
        HttpResponse.json([
          {
            id: 'pf1',
            factText: 'Stressz rontja az alvást',
            category: 'health',
            source: 'pattern',
            reinforcementCount: 2,
            includeInPrompt: true,
            lastReinforcedAt: null,
            createdAt: '2026-07-04T02:40:00Z',
            patternTitle: 'Stressz-szint ↔ aznapi alvásminőség',
          },
        ]),
      ),
      http.get(`${API_BASE}/api/companion/fact/candidate`, () => HttpResponse.json([])),
    )
    renderPage()

    expect(await screen.findByText('Stressz rontja az alvást')).toBeInTheDocument()
    expect(screen.getByText('minta: Stressz-szint ↔ aznapi alvásminőség')).toBeInTheDocument()
  })
})

describe('KnowledgeListPage (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('renders the fetched facts + pending candidates from the API', async () => {
    renderPage()
    expect(await screen.findByText('Tudás · 15 fact')).toBeInTheDocument()
    expect(screen.getByText(`Jóváhagyásra vár · ${candidateSeed.length}`)).toBeInTheDocument()
    expect(screen.getByText(candidateSeed[1].text)).toBeInTheDocument()
  })

  test('accepting a candidate POSTs the decision and refetches without it', async () => {
    // stateful override: the pending list empties once the decision lands
    let posted = 0
    let pending = candidateSeed.map((c, i) => ({
      id: c.id, candidateText: c.text, category: c.category,
      userDecision: null, refinedText: null, promotedFactId: null,
      createdAt: `2026-07-03T06:0${i}:00Z`,
    }))
    server.use(
      http.get(`${API_BASE}/api/companion/fact/candidate`, () => HttpResponse.json(pending)),
      http.post(`${API_BASE}/api/companion/fact/candidate/c1/decision`, () => {
        posted++
        pending = []
        return HttpResponse.json({
          id: 'c1', candidateText: candidateSeed[0].text, category: 'fuel',
          userDecision: 'accept', refinedText: null, promotedFactId: 'kf-c1',
          createdAt: '2026-07-03T06:00:00Z',
        })
      }),
    )
    renderPage()
    await userEvent.click((await screen.findAllByRole('button', { name: 'Elfogad' }))[0])
    await waitFor(() => expect(posted).toBe(1))
    await waitFor(() => expect(screen.queryByText(/Jóváhagyásra vár/)).not.toBeInTheDocument())
  })

  test('renders the honest degraded state when the companion switch is off', async () => {
    server.use(
      http.get(`${API_BASE}/api/companion/fact`, () =>
        HttpResponse.json([{ code: 'RESOURCE_NOT_FOUND' }], { status: 404 })),
      http.get(`${API_BASE}/api/companion/fact/candidate`, () =>
        HttpResponse.json([{ code: 'RESOURCE_NOT_FOUND' }], { status: 404 })),
    )
    renderPage()
    expect(await screen.findByText(/A társ jelenleg nincs bekapcsolva/)).toBeInTheDocument()
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
  })
})
