import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/data/_client/api'
import { QueryWrapper } from '@/test/queryWrapper'
import { candidateSeed } from '@/data/insights/knowledge'
import { lifeEventCandidateSeed } from '@/data/insights/graph'
import { MOCK_OVERVIEW } from '@/data/character/characterMock'
import { mockClaimFeedbackLog } from '@/data/character/characterHooks'
import type { CharacterOverviewResponse } from '@/data/character/characterApi'
import { pickQuoteClaim, ROLAD_COPY } from '@/features/insights/logic/roladCopy'
import { lastSeenLabel } from '@/features/insights/logic/metricFormat'
import { TEAM } from '@/features/insights/logic/team'
import { BoopAboutPage } from '@/features/insights/pages/BoopAboutPage'

// U9b (mezo-zpxv7): Rólad — a közös kép. The decision inbox moved here from the Tudástár; its
// tests are ported from KnowledgeListPage.test.tsx, retargeted to the Rólad copy and route.
// The character overview starts EMPTY in mock mode (pre-bootstrap), so the quote is seeded via
// the hook override (the DimensionsPage.test.tsx idiom).
const hoisted = vi.hoisted(() => ({ overview: null as unknown as CharacterOverviewResponse | null }))
vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return { ...actual, useCharacterOverview: () => ({ overview: hoisted.overview, isLoading: false }) }
})

const OPEN = candidateSeed.length + lifeEventCandidateSeed.length

const renderPage = (search = '') =>
  render(
    <MemoryRouter initialEntries={[`/mezo/rolad${search}`]}>
      <Routes><Route path="/mezo/rolad" element={<BoopAboutPage />} /></Routes>
    </MemoryRouter>,
    { wrapper: QueryWrapper },
  )

const inbox = () => screen.getByRole('region', { name: 'Döntésre vár' })
const graphCard = (title: string) =>
  within(inbox()).getByText(title).closest('[data-graph-card]') as HTMLElement

beforeEach(() => { hoisted.overview = MOCK_OVERVIEW })

describe('BoopAboutPage — Rólad, a közös kép (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('the csapatfal heading: eyebrow, title, living Boop', () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 1, name: 'Rólad' })).toBeInTheDocument()
    expect(screen.getByText('A közös kép · amit a csapat kimondott rólad')).toBeInTheDocument()
  })

  test('ranking: quote → Döntésre vár → A tények rólad → Életesemények → A te kezedben', () => {
    const { container } = renderPage()
    const order = [
      container.querySelector('.kr9-quote'),
      screen.getByRole('heading', { name: 'Döntésre vár' }),
      screen.getByRole('heading', { name: 'A tények rólad' }),
      screen.getByRole('heading', { name: 'Életesemények' }),
      screen.getByText('A te kezedben'),
    ]
    order.forEach((el) => expect(el).not.toBeNull())
    for (let i = 1; i < order.length; i++) {
      expect(order[i - 1]!.compareDocumentPosition(order[i]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    }
    expect(screen.getByText(ROLAD_COPY.note)).toBeInTheDocument()
  })

  test('the quote is the most certain claim, in its character’s name', () => {
    const pick = pickQuoteClaim(MOCK_OVERVIEW)!
    const { container } = renderPage()
    const quote = container.querySelector('.kr9-quote') as HTMLElement
    expect(quote).toHaveTextContent(pick.text)
    expect(within(quote).getByText(TEAM[pick.character].name)).toBeInTheDocument()
  })

  test('overview null → no quote section at all', () => {
    hoisted.overview = null
    const { container } = renderPage()
    expect(container.querySelector('.kr9-quote')).toBeNull()
    expect(screen.queryByText(ROLAD_COPY.quoteEmpty)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Talál' })).not.toBeInTheDocument()
  })

  test('Talál sends the feedback mutation; Pontosítom opens the reply thread', async () => {
    const pick = pickQuoteClaim(MOCK_OVERVIEW)!
    const { container } = renderPage()
    const quote = container.querySelector('.kr9-quote') as HTMLElement
    const before = mockClaimFeedbackLog.length
    await userEvent.click(within(quote).getByRole('button', { name: 'Talál' }))
    await waitFor(() => expect(mockClaimFeedbackLog.length).toBe(before + 1))
    expect(mockClaimFeedbackLog.at(-1)).toMatchObject({ claimId: pick.id, kind: 'TALAL' })
    expect(await within(quote).findByText('Megerősítetted — a benyomás erősödik')).toBeInTheDocument()
    await userEvent.click(within(quote).getByRole('button', { name: 'Pontosítom' }))
    expect(quote.querySelector('.kr-reply-thread')).not.toBeNull()
  })

  test('the facts: the seeded sleep fact wears SZUNYA, the door opens the full Tények view', () => {
    renderPage()
    const row = screen.getByText('Sleep target: 7.5h, evening kitchen close 21:30').closest('[data-rolad-fact]') as HTMLElement
    expect(within(row).getByText('SZUNYA')).toBeInTheDocument()
    expect(screen.getByText('14 AKTÍV')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Mind a 15 tény/ })).toHaveAttribute('href', '/mezo/knowledge?view=tenyek')
  })

  test('the doors: dimensions, communication, connections — and no embedded dimension list', () => {
    renderPage()
    expect(screen.getByRole('link', { name: /A csapat képe rólad, dimenziónként/ })).toHaveAttribute('href', '/mezo/karakter/dimenziok')
    expect(screen.getByRole('link', { name: /^Így beszélj velem/ })).toHaveAttribute('href', '/settings/mezo/communication')
    expect(screen.getByRole('link', { name: /^Kapcsolatok/ })).toHaveAttribute('href', '/mezo/knowledge?view=kategoriak')
    expect(screen.getByRole('link', { name: /dimenziónként/ }).querySelector('use[href="#t-person"]')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Amit eddig tudunk rólad' })).not.toBeInTheDocument()
  })

  // ---- ported from KnowledgeListPage.test.tsx (the inbox moved here) -------------------------

  test('the inbox (fact candidates) renders on Rólad', () => {
    renderPage()
    expect(within(inbox()).getByText(candidateSeed[0].text).closest('[data-fact-candidate]')).not.toBeNull()
  })

  test('the week banner: only for a valid ?start=, with the way back to that week, human date', () => {
    renderPage('?start=2026-09-14')
    const banner = document.querySelector('[data-week-banner]') as HTMLElement
    expect(banner).toHaveTextContent(`Heti áttekintés · ${lastSeenLabel('2026-09-14')}. A héten felmerült javaslatok is itt vannak.`)
    expect(banner).not.toHaveTextContent('2026-09-14')
    expect(screen.getByRole('link', { name: /Vissza ehhez a héthez/ })).toHaveAttribute('href', '/me/week?start=2026-09-14')
  })

  test('an invalid ?start= shows no week banner', () => {
    renderPage('?start=nope')
    expect(document.querySelector('[data-week-banner]')).toBeNull()
  })

  test('the inbox is the page’s loud group: a gold glass case per candidate', () => {
    renderPage()
    const card = within(inbox()).getByText(candidateSeed[0].text).closest('[data-fact-candidate]')
    expect(card).toHaveClass('glass', 'tf-case', 'tf-c-gold')
  })

  test('renders the pending candidates with the four actions', () => {
    renderPage()
    expect(within(inbox()).getByText(`${OPEN} JELÖLT`)).toBeInTheDocument()
    expect(within(inbox()).getAllByRole('button', { name: 'Igen, jegyezd meg' })).toHaveLength(OPEN)
    expect(within(inbox()).getAllByRole('button', { name: 'Most ne' })).toHaveLength(OPEN)
    expect(within(inbox()).getAllByRole('button', { name: 'Nem igaz' })).toHaveLength(OPEN)
  })

  test('accepting a candidate promotes it into the facts and leaves the kept line', async () => {
    renderPage()
    const card = within(inbox()).getByText(candidateSeed[0].text).closest('[data-fact-candidate]') as HTMLElement
    await userEvent.click(within(card).getByRole('button', { name: 'Igen, jegyezd meg' }))
    expect(await screen.findByText('15 AKTÍV')).toBeInTheDocument()
    expect(within(inbox()).getByText(`${OPEN - 1} JELÖLT`)).toBeInTheDocument()
    const kept = within(inbox()).getByText(candidateSeed[0].text).closest('.tf-case') as HTMLElement
    expect(kept).toHaveTextContent(ROLAD_COPY.keep)
  })

  test('refining reveals the inline input and keeps the corrected wording', async () => {
    renderPage()
    const card = within(inbox()).getByText(candidateSeed[0].text).closest('[data-fact-candidate]') as HTMLElement
    await userEvent.click(within(card).getByRole('button', { name: 'Pontosítom' }))
    const input = within(card).getByLabelText('Pontosított tény')
    await userEvent.clear(input)
    await userEvent.type(input, 'Pontosított tudás')
    await userEvent.click(within(card).getByRole('button', { name: 'Így jegyezd meg' }))
    expect(await screen.findByText('15 AKTÍV')).toBeInTheDocument()
    expect(within(inbox()).getByText('Pontosított tudás').closest('.tf-case')).toHaveTextContent(ROLAD_COPY.keep)
  })

  test('rejecting a candidate removes it without promoting, and says it will not ask again', async () => {
    renderPage()
    const card = within(inbox()).getByText(candidateSeed[0].text).closest('[data-fact-candidate]') as HTMLElement
    await userEvent.click(within(card).getByRole('button', { name: 'Nem igaz' }))
    expect(await within(inbox()).findByText(`${OPEN - 1} JELÖLT`)).toBeInTheDocument()
    expect(within(inbox()).getByText(candidateSeed[0].text).closest('.kr9-gone')).toHaveTextContent(ROLAD_COPY.reject)
    expect(screen.getByText('14 AKTÍV')).toBeInTheDocument()
  })

  test('snoozing a candidate says it will come back in about two weeks', async () => {
    renderPage()
    const card = within(inbox()).getByText(candidateSeed[1].text).closest('[data-fact-candidate]') as HTMLElement
    await userEvent.click(within(card).getByRole('button', { name: 'Most ne' }))
    expect(await within(inbox()).findByText(ROLAD_COPY.snooze)).toBeInTheDocument()
  })

  // c3 conflicts with f4 ("Volleyball: kedd + csütörtök + szombat") — accepting with the ticked
  // "A régit kikapcsolom" also switches f4 off: +1 promoted, −1 silenced → still 14 active.
  test('accepting the conflicting c3 with the box ticked switches the old f4 off', async () => {
    renderPage()
    const card = within(inbox()).getByText(candidateSeed[2].text).closest('[data-fact-candidate]') as HTMLElement
    expect(within(card).getByLabelText('A régit kikapcsolom')).toBeChecked()
    await userEvent.click(within(card).getByRole('button', { name: 'Igen, jegyezd meg' }))
    expect(await within(inbox()).findByText(ROLAD_COPY.keep)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('link', { name: /Mind a 16 tény/ })).toBeInTheDocument())
    expect(screen.getByText('14 AKTÍV')).toBeInTheDocument()
  })

  it('renders the life-event and season candidates with their own provenance', () => {
    renderPage()
    expect(graphCard('Új munkahely első hete')).toHaveTextContent('Életesemény-jelölt')
    expect(graphCard('Nyári alapozás')).toHaveTextContent('Évszak-jelölt')
    expect(within(inbox()).getByText(
      'Ezt a negyedév és az előző negyedév összefoglalóiból olvastam ki — csak akkor kerül a gráfba, ha elfogadod.',
    )).toBeInTheDocument()
    expect(within(inbox()).getByText(
      'Ezt a napod szövegeiből szűrtem ki — csak akkor kerül a gráfba, ha elfogadod.',
    )).toBeInTheDocument()
  })

  it('rejecting a life event turns the card into the quiet rejected line', async () => {
    renderPage()
    await userEvent.click(within(graphCard('Új munkahely első hete')).getByRole('button', { name: 'Nem igaz' }))
    await waitFor(() => expect(within(inbox()).getByText('Új munkahely első hete').closest('.kr9-gone')).not.toBeNull())
    expect(within(inbox()).queryAllByText('Új munkahely első hete').map((e) => e.closest('[data-graph-card]')).filter(Boolean)).toHaveLength(0)
  })

  it('accepting a SEASON that proposes no edge gives the short confirmation', async () => {
    renderPage()
    await userEvent.click(within(graphCard('Nyári alapozás')).getByRole('button', { name: 'Igen, jegyezd meg' }))
    const confirmed = (await within(inbox()).findByText('Nyári alapozás')).closest('[data-graph-card]') as HTMLElement
    expect(within(confirmed).getByText('Bekerült a gráfba')).toBeInTheDocument()
    expect(within(confirmed).queryByText(/kapcsolattal/)).not.toBeInTheDocument()
  })

  it('once everything is decided the hint says MIND ELDÖNTVE, never „0 JELÖLT”', async () => {
    renderPage()
    for (let n = 0; n < OPEN; n++) {
      await userEvent.click(within(inbox()).getAllByRole('button', { name: 'Most ne' })[0])
    }
    expect(await within(inbox()).findByText('MIND ELDÖNTVE')).toBeInTheDocument()
    expect(within(inbox()).queryByText(/0 JELÖLT/)).not.toBeInTheDocument()
  })

  it('an accepted life event keeps a confirmation card in place, without buttons or a link', async () => {
    renderPage()
    await userEvent.click(within(graphCard('Új munkahely első hete')).getByRole('button', { name: 'Igen, jegyezd meg' }))
    const accepted = (await within(inbox()).findByText(/Bekerült a gráfba/)).closest('[data-graph-card]') as HTMLElement
    expect(accepted).toHaveTextContent('Új munkahely első hete')
    expect(accepted).toHaveTextContent('1 kapcsolattal')
    expect(within(accepted).queryByRole('button')).not.toBeInTheDocument()
    expect(within(accepted).queryByRole('link')).not.toBeInTheDocument()
  })

  it('Pontosítom + Így jegyezd meg shows the edited title on the confirmation', async () => {
    renderPage()
    const card = graphCard('Új munkahely első hete')
    await userEvent.click(within(card).getByRole('button', { name: 'Pontosítom' }))
    const titleInput = within(card).getByLabelText('Jelölt címe')
    await userEvent.clear(titleInput)
    await userEvent.type(titleInput, 'Első hét az új csapatban')
    await userEvent.click(within(card).getByRole('button', { name: 'Így jegyezd meg' }))
    expect(await within(inbox()).findByText(/Bekerült a gráfba/)).toBeInTheDocument()
    expect(within(inbox()).getByText('Első hét az új csapatban')).toBeInTheDocument()
    expect(within(inbox()).queryByText('Új munkahely első hete')).not.toBeInTheDocument()
  })

  test('the timeline shows the seeded life event', () => {
    const { container } = renderPage()
    const rows = container.querySelectorAll('[data-life-row]')
    expect([...rows].some((r) => r.textContent?.includes('Új munkahely első hete'))).toBe(true)
  })
})

describe('BoopAboutPage — Rólad (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('renders the fetched candidates from the API', async () => {
    renderPage()
    expect(await screen.findByText(candidateSeed[1].text)).toBeInTheDocument()
    // no default graph handler in the test server → the graph candidates read as realEmpty
    expect(await screen.findByText(`${candidateSeed.length} JELÖLT`)).toBeInTheDocument()
  })

  test('accepting a candidate POSTs the decision and the card leaves the open list', async () => {
    let posted = 0
    let pending = candidateSeed.map((c, i) => ({
      id: c.id, candidateText: c.text, category: c.category, owner: c.owner, source: c.source,
      userDecision: null, refinedText: null, promotedFactId: null,
      createdAt: `2026-07-03T06:0${i}:00Z`,
    }))
    server.use(
      http.get(`${API_BASE}/api/companion/fact/candidate`, () => HttpResponse.json(pending)),
      http.post(`${API_BASE}/api/companion/fact/candidate/c1/decision`, () => {
        posted++
        pending = pending.filter((p) => p.id !== 'c1')
        return HttpResponse.json({
          id: 'c1', candidateText: candidateSeed[0].text, category: 'fuel',
          userDecision: 'accept', refinedText: null, promotedFactId: 'kf-c1',
          createdAt: '2026-07-03T06:00:00Z',
        })
      }),
    )
    renderPage()
    const card = (await screen.findByText(candidateSeed[0].text)).closest('[data-fact-candidate]') as HTMLElement
    await userEvent.click(within(card).getByRole('button', { name: 'Igen, jegyezd meg' }))
    await waitFor(() => expect(posted).toBe(1))
    await waitFor(() => expect(inbox().querySelectorAll('[data-fact-candidate]')).toHaveLength(candidateSeed.length - 1))
    expect(within(inbox()).getByText(candidateSeed[0].text).closest('.tf-case')).toHaveTextContent(ROLAD_COPY.keep)
  })

  test('degraded (companion off): the honest line, no facts section, the graph candidates still render', async () => {
    server.use(
      http.get(`${API_BASE}/api/companion/fact`, () =>
        HttpResponse.json([{ code: 'RESOURCE_NOT_FOUND' }], { status: 404 })),
      http.get(`${API_BASE}/api/companion/fact/candidate`, () =>
        HttpResponse.json([{ code: 'RESOURCE_NOT_FOUND' }], { status: 404 })),
      http.get(`${API_BASE}/api/companion/graph/node/candidate`, () =>
        HttpResponse.json([
          {
            id: 'n1', kind: 'LIFE_EVENT', title: 'Új munkahely első hete', summary: 'Első hét.',
            status: 'candidate', occurredOn: '2026-08-21', proposedEdgeCount: 1,
            createdAt: '2026-08-22T02:00:00Z', updatedAt: '2026-08-22T02:00:00Z',
          },
        ])),
    )
    renderPage()
    expect(await screen.findByText(/A társ jelenleg nincs bekapcsolva — a tényjavaslatok most nem elérhetők/)).toBeInTheDocument()
    expect(await within(inbox()).findByText('Új munkahely első hete')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'A tények rólad' })).not.toBeInTheDocument()
  })

  test('the honest loading state while the fetch is unresolved', async () => {
    server.use(
      http.get(`${API_BASE}/api/companion/fact`, async () => { await delay('infinite'); return HttpResponse.json([]) }),
      http.get(`${API_BASE}/api/companion/fact/candidate`, async () => { await delay('infinite'); return HttpResponse.json([]) }),
    )
    renderPage()
    expect(await screen.findByText('A javaslatok betöltése…')).toBeInTheDocument()
    expect(screen.queryByText(/JELÖLT/)).not.toBeInTheDocument()
  })

  test('a genuinely failed fetch (500) renders a retry state', async () => {
    server.use(
      http.get(`${API_BASE}/api/companion/fact`, () => new HttpResponse(null, { status: 500 })),
      http.get(`${API_BASE}/api/companion/fact/candidate`, () => HttpResponse.json([])),
    )
    renderPage()
    expect(await screen.findByText('Nem sikerült betölteni a javaslatokat.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Újra' })).toBeInTheDocument()
  })
})
