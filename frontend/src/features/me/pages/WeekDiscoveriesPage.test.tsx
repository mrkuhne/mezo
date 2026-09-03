import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { QueryWrapper } from '@/test/queryWrapper'
import { WeekDiscoveriesPage } from '@/features/me/pages/WeekDiscoveriesPage'
import { mockMeWeekStart } from '@/data/me/meWeek'

const DIGEST = `${API_BASE}/api/proactive/weekly-review/:start/digest`
const EMPTY_DIGEST = { patterns: [], newFacts: [], lifeEvents: [], memoir: false, predictions: [] }

const renderPage = (path = `/me/week/felfedezesek?start=${mockMeWeekStart}`) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <WeekDiscoveriesPage />
    </MemoryRouter>,
    { wrapper: QueryWrapper },
  )

const QUIET = /Csendes hét volt — nem született új minta vagy tudás/

describe('WeekDiscoveriesPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('head card says these are TRACES, not proposals (mezo-d20.6.10)', () => {
    const { container } = renderPage()
    expect(screen.getByText('Heti felfedezések')).toBeInTheDocument()
    const head = container.querySelector('.wkl-head')?.textContent ?? ''
    expect(head).toMatch(/Amit a Mezo a héten .*magától.* tett a memóriába/s)
    expect(head).toContain('ezek nem javaslatok, hanem megtörtént nyomok')
  })

  test('renders the status information the old list discarded — pattern event, occurredOn, prediction outcome', () => {
    const { container } = renderPage()
    // 1 pattern + 1 fact + 1 life event + memoir + 1 prediction
    expect(container.querySelector('.mz-bignum')?.textContent).toBe('5')
    expect(screen.getByText('új nyom a memóriában')).toBeInTheDocument()
    expect(container.querySelectorAll('.wkd-tile')).toHaveLength(5)

    expect(screen.getByText('✓ Megerősítve')).toBeInTheDocument()   // pattern `event`
    expect(screen.getByText('◐ Folyamatban')).toBeInTheDocument()   // prediction `status`
    expect(screen.getByText('Nyaralás kezdete')).toBeInTheDocument()
    expect(screen.getByText('máj 23.')).toBeInTheDocument()          // lifeEvents[].occurredOn
    expect(screen.getByText('Új bejegyzés készült a hétről')).toBeInTheDocument()
  })

  test('every tile links out, and a new fact links to the SPECIFIC fact via newFacts[].id', () => {
    renderPage()
    expect(screen.getByText('Edzésnapokon jobban alszol').closest('a'))
      .toHaveAttribute('href', '/mezo/patterns/sleep_workout')
    expect(screen.getByText('A fehérjecél tartása javítja a check-in energiát.').closest('a')?.getAttribute('href'))
      .toBe('/mezo/knowledge?fact=b1a0c9e2-4f3d-4a2b-8e1c-6d5a9f0b2c31')
    expect(screen.getByText('Új bejegyzés készült a hétről').closest('a'))
      .toHaveAttribute('href', '/mezo/memoir')
    expect(screen.getByText('A súly csökkenő trendje folytatódik fehérjecél mellett').closest('a'))
      .toHaveAttribute('href', '/mezo/predictions')
  })
})

describe('WeekDiscoveriesPage (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('reads the wire digest — never the mock seed', async () => {
    const { container } = renderPage()
    await waitFor(() => expect(screen.getByText('Real-mode pattern')).toBeInTheDocument())
    expect(screen.queryByText('Edzésnapokon jobban alszol')).toBeNull()
    expect(container.querySelector('.mz-bignum')?.textContent).toBe('5')
  })

  test('CONTRACT — a quiet week says the quiet truth and the hero reads — not 0', async () => {
    server.use(http.get(DIGEST, () => HttpResponse.json(EMPTY_DIGEST)))
    const { container } = renderPage()
    await waitFor(() => expect(screen.getByText(QUIET)).toBeInTheDocument())
    expect(container.querySelector('.mz-bignum')?.textContent).toBe('—')
    expect(screen.getByText('csendes hét volt')).toBeInTheDocument()
    expect(container.querySelector('.wkd-tile')).toBeNull()
  })

  test('CONTRACT — a skeleton covers the cold-load window instead of a fabricated quiet week', () => {
    const { container } = renderPage()
    expect(container.querySelectorAll('.wk-skel').length).toBeGreaterThan(0)
    expect(screen.queryByText(QUIET)).toBeNull()
  })

  test('CONTRACT — a failed digest fetch renders a retryable error, not "csendes hét"', async () => {
    server.use(http.get(DIGEST, () => new HttpResponse(null, { status: 500 })))
    renderPage()
    await waitFor(() => expect(screen.getByText('Nem sikerült betölteni a heti felfedezéseket.')).toBeInTheDocument())
    expect(screen.queryByText(QUIET)).toBeNull()
    expect(screen.getByRole('button', { name: 'Újra' })).toBeInTheDocument()
  })

  test('the pattern event and prediction outcome chips follow the wire, and missed is amber — never red', async () => {
    server.use(
      http.get(DIGEST, () =>
        HttpResponse.json({
          patterns: [
            { pairKey: 'a_b', title: 'Erősödött minta', event: 'reinforced' },
            { pairKey: 'c_d', title: 'Előléptetett minta', event: 'promoted' },
          ],
          newFacts: [],
          lifeEvents: [],
          memoir: false,
          predictions: [
            { id: '12345678-90ab-4cde-8f01-234567890abc', title: 'Bevált', status: 'validated' },
            { id: '22345678-90ab-4cde-8f01-234567890abc', title: 'Nem jött be', status: 'missed' },
          ],
        }),
      ),
    )
    const { container } = renderPage()
    await waitFor(() => expect(screen.getByText('▲ Erősödött')).toBeInTheDocument())
    expect(screen.getByText('★ Előléptetve')).toBeInTheDocument()
    expect(screen.getByText('✓ Bevált')).toBeInTheDocument()
    const missed = screen.getByText('✗ Nem jött be')
    expect(missed).toBeInTheDocument()
    // amber (`warn`), the terracotta floor — the guardrail is "never red"
    expect(missed).toHaveClass('warn')
    expect(container.querySelector('.mz-bignum')?.textContent).toBe('4')
  })
})
