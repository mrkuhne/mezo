import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { QueryWrapper } from '@/test/queryWrapper'
import { WeekLessonsPage } from '@/features/me/pages/WeekLessonsPage'
import { mockMeWeekStart } from '@/data/me/meWeek'
import { mondayIso } from '@/data/fuel/fuelWeekHooks'

const LESSONS = `${API_BASE}/api/proactive/weekly-review/:start/lessons`

const renderPage = (path = `/me/week/tanulsagok?start=${mockMeWeekStart}`) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <WeekLessonsPage />
    </MemoryRouter>,
    { wrapper: QueryWrapper },
  )

const HEAD_CARD = /Ezeket a hét .*napokon átnyúló.* összefüggéseiből szedte össze/s

describe('WeekLessonsPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('renders the head card, the candidates with their evidence lines and the footnote (mezo-d20.6.10)', () => {
    const { container } = renderPage()
    expect(screen.getByText('A hét tanulságai')).toBeInTheDocument()
    expect(screen.getByText('3 javaslat · te döntesz róluk')).toBeInTheDocument()
    expect(container.querySelector('.wkl-head')?.textContent).toMatch(HEAD_CARD)
    expect(container.querySelector('.wkl-head')?.textContent).toContain('Tudástárba')

    expect(screen.getByText('Az edzésnapokat követő éjszakákon átlagosan 38 perccel többet alszol.')).toBeInTheDocument()
    expect(screen.getByText('5 hét · 14 edzésnap · konfidencia erős')).toBeInTheDocument()
    expect(container.querySelectorAll('.wkl-tile')).toHaveLength(3)

    // the two-button decision (handoff §6.2/8) — and the footnote SAYS refining lives elsewhere
    expect(screen.getAllByRole('button', { name: '✓ Tanuld meg' })).toHaveLength(3)
    expect(screen.getAllByRole('button', { name: 'Nem rólam szól' })).toHaveLength(3)
    expect(screen.queryByRole('button', { name: /Pontosít/ })).not.toBeInTheDocument()
    const foot = container.querySelector('.wkl-foot')?.textContent ?? ''
    expect(foot).toContain('A Mezo nem ír a tudásba magától: a heti elemzés jelöltet állít, a döntés a tiéd.')
    expect(foot).toContain('a Tudástárban teheted meg')
  })

  test('accept flips the tile to the sage "bekerült a Tudástárba" state; reject to the dashed muted one', async () => {
    const { container } = renderPage()
    const tiles = () => Array.from(container.querySelectorAll('.wkl-tile'))

    await userEvent.click(within(tiles()[0] as HTMLElement).getByRole('button', { name: '✓ Tanuld meg' }))
    await waitFor(() => expect(tiles()[0]).toHaveClass('ok'))
    expect(within(tiles()[0] as HTMLElement).getByText('✓ Bekerült a Tudástárba · aktív a promptban')).toBeInTheDocument()
    // the decision row is gone — a candidate is decided exactly once
    expect(within(tiles()[0] as HTMLElement).queryByRole('button', { name: '✓ Tanuld meg' })).toBeNull()

    await userEvent.click(within(tiles()[1] as HTMLElement).getByRole('button', { name: 'Nem rólam szól' }))
    await waitFor(() => expect(tiles()[1]).toHaveClass('no'))
    expect(within(tiles()[1] as HTMLElement).getByText('elvetve · nem kérdezi újra')).toBeInTheDocument()

    // and the hero sub-line follows the remaining open count, then the decided summary
    expect(screen.getByText('1 javaslat · te döntesz róluk')).toBeInTheDocument()
    await userEvent.click(within(tiles()[2] as HTMLElement).getByRole('button', { name: 'Nem rólam szól' }))
    await waitFor(() => expect(screen.getByText('1 megtanult · 2 elvetve')).toBeInTheDocument())
  })

  test('CONTRACT — the RUNNING week has no candidates yet and says so; the hero reads — not 0', () => {
    const { container } = renderPage(`/me/week/tanulsagok?start=${mondayIso()}`)
    expect(container.querySelector('.mz-bignum')?.textContent).toBe('—')
    // The running week's sub-line must NOT read as a verdict on a week that is still
    // happening — "nincs javaslat ehhez a héthez" belongs to a CLOSED week only.
    expect(screen.getByText('a hét közben még gyűlik')).toBeInTheDocument()
    expect(screen.queryByText('nincs javaslat ehhez a héthez')).toBeNull()
    expect(screen.getByText('A hét közben még gyűlik — a tanulságok a hétfői elemzéssel érkeznek.')).toBeInTheDocument()
    expect(container.querySelector('.wkl-tile')).toBeNull()
    expect(container.querySelector('.wkl-foot')).toBeNull()
  })
})

describe('WeekLessonsPage (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('CONTRACT — F6.5 has not shipped: the 404 renders the honest empty, never the mock seed', async () => {
    const { container } = renderPage()
    await waitFor(() =>
      expect(screen.getByText(/Nincs javaslat ehhez a héthez\. Ha elkészül az elemzés/)).toBeInTheDocument(),
    )
    expect(container.querySelector('.mz-bignum')?.textContent).toBe('—')
    // the mock seed must never reach a live reader
    expect(screen.queryByText('Az edzésnapokat követő éjszakákon átlagosan 38 perccel többet alszol.')).toBeNull()
  })

  test('CONTRACT — a skeleton covers the cold-load window instead of a fabricated empty', () => {
    const { container } = renderPage()
    expect(container.querySelectorAll('.wk-skel').length).toBeGreaterThan(0)
    expect(screen.queryByText('nincs javaslat ehhez a héthez')).toBeNull()
  })

  test('CONTRACT — a failed fetch renders a retryable error, not "nothing was proposed"', async () => {
    server.use(http.get(LESSONS, () => new HttpResponse(null, { status: 500 })))
    renderPage()
    await waitFor(() => expect(screen.getByText('Nem sikerült betölteni a hét tanulságait.')).toBeInTheDocument())
    expect(screen.queryByText('nincs javaslat ehhez a héthez')).toBeNull()
    expect(screen.getByRole('button', { name: 'Újra' })).toBeInTheDocument()
  })

  test('when the backend DOES answer, the page lights up untouched — decided rows included', async () => {
    server.use(
      http.get(LESSONS, () =>
        HttpResponse.json([
          {
            id: '11111111-2222-4333-8444-555555555555',
            candidateText: 'Real-mode jelölt.',
            category: 'train',
            evidence: '5 hét · 14 edzésnap · konfidencia erős',
            userDecision: null,
          },
          {
            id: '66666666-7777-4888-8999-000000000000',
            candidateText: 'Már elfogadott jelölt.',
            category: 'fuel',
            evidence: null,
            userDecision: 'accept',
          },
        ]),
      ),
    )
    const { container } = renderPage()
    await waitFor(() => expect(screen.getByText('Real-mode jelölt.')).toBeInTheDocument())
    expect(container.querySelector('.mz-bignum')?.textContent).toBe('2')
    expect(screen.getByText('1 javaslat · te döntesz róluk')).toBeInTheDocument()
    expect(screen.getByText('✓ Bekerült a Tudástárba · aktív a promptban')).toBeInTheDocument()
    // no evidence on the wire → no evidence line invented
    expect(container.querySelectorAll('.wkl-ev')).toHaveLength(1)
  })

  test('a decision POSTs to the shipped candidate-decision endpoint — no new write path', async () => {
    const posted: { id: string; body: unknown }[] = []
    server.use(
      http.get(LESSONS, () =>
        HttpResponse.json([
          { id: '11111111-2222-4333-8444-555555555555', candidateText: 'Real-mode jelölt.', category: 'train', evidence: null, userDecision: null },
        ]),
      ),
      http.post(`${API_BASE}/api/companion/fact/candidate/:id/decision`, async ({ params, request }) => {
        posted.push({ id: params.id as string, body: await request.json() })
        return new HttpResponse(null, { status: 204 })
      }),
    )
    renderPage()
    await waitFor(() => expect(screen.getByText('Real-mode jelölt.')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: '✓ Tanuld meg' }))
    await waitFor(() => expect(posted).toHaveLength(1))
    expect(posted[0].id).toBe('11111111-2222-4333-8444-555555555555')
    expect(posted[0].body).toMatchObject({ decision: 'accept' })
  })
})
