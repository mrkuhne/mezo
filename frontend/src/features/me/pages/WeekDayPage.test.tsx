import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { WeekDayPage } from '@/features/me/pages/WeekDayPage'
import { QueryWrapper } from '@/test/queryWrapper'
import { ToastProvider } from '@/shared/ui/ToastProvider'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { mockDayEvaluationDates } from '@/data/me/dayEvaluation'
import type { DayDimension, DayEvaluationResponse } from '@/data/me/dayEvaluation'

// Egy nap (mezo-d20.6.10 → mezo-jcpt.4) — /me/week/napok/:date. The page is now driven by
// `GET /api/me/day/{date}/evaluation` (six dimensions, narrative, ±5 AI adjustment) rendered in
// the approved Mozaik 2.0 prototype's language; `useMeWeek` still supplies the hero chips, the
// fuel goal bars and the mcells. The clock is pinned so `future` is deterministic
// (2026-05-21 = Thursday of the seed week starting 2026-05-18, and the mock evaluation's
// `in_progress` fixture date).
const NOW = new Date('2026-05-21T10:00:00')

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

function LocationProbe() {
  const loc = useLocation()
  return <div data-testid="loc">{loc.pathname}</div>
}

/** `start` omitted on purpose in the deep-link test — the page must derive the week from `:date`. */
function renderDay(dateIso: string, start?: string) {
  const to = `/me/week/napok/${dateIso}${start ? `?start=${start}` : ''}`
  return render(
    <QueryWrapper>
      <ToastProvider>
        <MemoryRouter initialEntries={[to]}>
          <Routes>
            <Route path="/me/week/napok/:date" element={<WeekDayPage />} />
            <Route path="/me/week/napok" element={<LocationProbe />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryWrapper>,
  )
}

/** A full six-dimension evaluation, overridable per test — the real-mode escape hatch for the
 *  shapes the four mock fixtures deliberately do not carry (an `empty` day, a NO_DATA dimension
 *  that still has a FACT to show). */
function evaluationFixture(date: string, patch: Partial<DayEvaluationResponse> = {}): DayEvaluationResponse {
  const dim = (id: string, label: string, over: Partial<DayDimension> = {}): DayDimension => ({
    id, label, weight: 1 / 6, score: 70, status: 'DONE', facts: [], note: null, ...over,
  })
  return {
    date,
    state: 'scored',
    score: 70,
    base: 70,
    adjustment: null,
    narrative: [],
    highlights: [],
    context: [],
    dimensions: [
      dim('nutrition', 'Táplálkozás'), dim('quality', 'Minőség'), dim('training', 'Edzés'),
      dim('sleep', 'Alvás'), dim('logging', 'Logolás'), dim('rhythm', 'Ritmus'),
    ],
    ...patch,
  }
}

function serveEvaluation(body: DayEvaluationResponse) {
  server.use(http.get(`${API_BASE}/api/me/day/:date/evaluation`, () => HttpResponse.json(body)))
}

beforeEach(() => {
  mockNavigate.mockClear()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs() })

describe('WeekDayPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  test('a scored day: the evaluation score rides the hero ring over the `alap · Mezo-kontextus` chip pair', () => {
    renderDay(mockDayEvaluationDates.scored, '2026-05-18')
    expect(screen.getByText('Hétfő')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Pontszám: 78 / 100' })).toBeInTheDocument()
    // the deterministic base and the ±5 AI context are SEPARATE, visible chips — never one number
    expect(screen.getByText('alap 75')).toBeInTheDocument()
    expect(screen.getByText('Mezo-kontextus +3')).toBeInTheDocument()
  })

  test('a scored day renders all SIX dimension tiles, each with its weight, score and note', () => {
    const { container } = renderDay(mockDayEvaluationDates.scored, '2026-05-18')
    const tiles = [...container.querySelectorAll('.dev-dim')]
    expect(tiles).toHaveLength(6)
    expect(tiles.map((t) => t.querySelector('.dev-dnm')?.textContent))
      .toEqual(['Táplálkozás', 'Minőség', 'Edzés', 'Alvás', 'Logolás', 'Ritmus'])
    // the renormalised weight is the tile's eyebrow, the dimension score its sring
    expect(screen.getByText('súly 30%')).toBeInTheDocument()
    expect(tiles[0]?.querySelector('.dev-sring i')?.textContent).toBe('82')
    // facts and the per-dimension sentence
    expect(screen.getByText('fehérje · 205g / 220g cél')).toBeInTheDocument()
    expect(screen.getByText('A fehérjecélt majdnem hoztad, a kalória is célban volt.')).toBeInTheDocument()
    // no dimension is a ghost on a closed, fully-logged day
    expect(container.querySelectorAll('.dev-dim.is-ghost')).toHaveLength(0)
  })

  test('the narrative, the highlight chips and the +3 reason ride the review card', () => {
    const { container } = renderDay(mockDayEvaluationDates.scored, '2026-05-18')
    expect(screen.getByText('Mezo · a napodról')).toBeInTheDocument()
    expect(container.querySelectorAll('.dev-prose')).toHaveLength(3)
    expect(screen.getByText(/Hétfőn erős napot zártál/)).toBeInTheDocument()
    // highlights: kind → its own eyebrow word and colour class
    expect(screen.getByText('Teljes napi logolás')).toBeInTheDocument()
    // …in the prototype's reading order (the key leads), NOT the wire order (which is win-first)
    expect([...container.querySelectorAll('.dev-hlch')].map((c) => c.className))
      .toEqual(['dev-hlch is-key', 'dev-hlch is-pattern', 'dev-hlch is-win'])
    expect(screen.getByText('A nap kulcsa')).toBeInTheDocument()
    // the adjustment always carries its reason — an unexplained delta is not shown at all
    expect(screen.getByText('Következetes napi ritmus és jó regeneráció miatt +3 korrekció.')).toBeInTheDocument()
  })

  test('the chat handoff survives the rebuild, and the context signals get their own unscored tile', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderDay(mockDayEvaluationDates.scored, '2026-05-18')
    expect(screen.getByText('Kontextus · nem pontozott')).toBeInTheDocument()
    expect(screen.getByText('nap típusa · edzésnap')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Beszélgess a napról ›' }))
    expect(mockNavigate).toHaveBeenCalledWith(expect.stringMatching(/^\/mezo\/chat\?c=/))
  })

  test('the mcells and the day stepper stay on the page', () => {
    renderDay(mockDayEvaluationDates.scored, '2026-05-18')
    expect(screen.getByText('súly · kg')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Következő nap:/ })).toBeEnabled()
  })

  test('CONTRACT — a day still in progress: a dashed `este zárom` ring and NO overall score', () => {
    const { container } = renderDay(mockDayEvaluationDates.inProgress, '2026-05-18')
    expect(screen.getByRole('img', { name: 'Pontszám: este zárom' })).toBeInTheDocument()
    expect(container.querySelector('.wk-ring.dev-ringdash')).not.toBeNull()
    // no fabricated part-way score, and no base/adjustment chips either
    expect(screen.queryByRole('img', { name: /Pontszám: \d/ })).not.toBeInTheDocument()
    expect(screen.queryByText(/^alap /)).not.toBeInTheDocument()
    // the honest tally instead
    expect(screen.getByText('2 dimenzió kész · 4 még íródik')).toBeInTheDocument()
    // and no LLM prose during the day — the orb says it writes at close
    expect(screen.getByText('A napodról a zárás után írok — addig gyűjtöm, ami történik.')).toBeInTheDocument()
    expect(screen.queryByText('Mezo · a napodról')).not.toBeInTheDocument()
  })

  test('CONTRACT — in progress: what is FINAL floats up as a full tile, the rest stays a ghost', () => {
    const { container } = renderDay(mockDayEvaluationDates.inProgress, '2026-05-18')
    const tiles = [...container.querySelectorAll('.dev-dim')]
    expect(tiles.map((t) => t.querySelector('.dev-dnm')?.textContent))
      .toEqual(['Edzés', 'Alvás', 'Táplálkozás', 'Minőség', 'Logolás', 'Ritmus'])
    expect(tiles.slice(0, 2).some((t) => t.classList.contains('is-ghost'))).toBe(false)
    expect(tiles.slice(2).every((t) => t.classList.contains('is-ghost'))).toBe(true)
    expect(screen.getAllByText('még íródik').length).toBeGreaterThan(0)
    expect(screen.getAllByText('nincs adat').length).toBeGreaterThan(0)
  })

  test('CONTRACT — fewer than two DONE dimensions: `tanulom`, and the reason spelled out', () => {
    renderDay(mockDayEvaluationDates.thin, '2026-05-18')
    expect(screen.getByRole('img', { name: 'Pontszám: tanulom' })).toBeInTheDocument()
    expect(screen.getByText('kevés adat a pontszámhoz')).toBeInTheDocument()
    expect(screen.getByText(
      'Kettőnél kevesebb területről van adat, ezért a Mezo nem ad pontszámot: kitalálni nem fog.',
    )).toBeInTheDocument()
  })

  test('CONTRACT — a future day shows only its waiting card and the stepper', () => {
    const { container } = renderDay(mockDayEvaluationDates.future, '2026-05-25')
    expect(screen.getByText('még előtted')).toBeInTheDocument()
    expect(screen.getByText('Ez a nap még előtted van — ide majd a logolt adatai kerülnek.')).toBeInTheDocument()
    expect(container.querySelectorAll('.dev-dim')).toHaveLength(0)
    expect(screen.getByRole('button', { name: /Előző nap/ })).toBeInTheDocument()
  })

  test('a bare deep link (no ?start=) derives the week from :date', () => {
    renderDay('2026-05-13')
    expect(screen.getByText('Szerda')).toBeInTheDocument()
    expect(screen.getByText('Máj 11 – 17')).toBeInTheDocument()
  })

  test('a ?start= from ANOTHER week is ignored — the date wins', () => {
    renderDay('2026-05-13', '2026-06-01')
    expect(screen.getByText('Máj 11 – 17')).toBeInTheDocument()
  })

  test('a malformed :date redirects to the mosaic instead of crashing', () => {
    renderDay('2026-02-31')
    expect(screen.getByTestId('loc')).toHaveTextContent('/me/week/napok')
  })
})

describe('WeekDayPage (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))

  test('renders the FETCHED evaluation, never the mock seed', async () => {
    renderDay('2026-05-11', '2026-05-11')
    expect(await screen.findByRole('img', { name: 'Pontszám: 66 / 100' })).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'Pontszám: 78 / 100' })).not.toBeInTheDocument()
    expect(screen.queryByText('Mezo-kontextus +3')).not.toBeInTheDocument()
  })

  test('CONTRACT — a NO_DATA dimension still shows its FACT, under a dashed ring, never a 0', async () => {
    serveEvaluation(evaluationFixture('2026-05-11', {
      dimensions: evaluationFixture('2026-05-11').dimensions.map((d) => (
        d.id === 'training'
          ? { ...d, score: null, status: 'NO_DATA', facts: [{ label: 'edzés', value: 'Pihenőnap' }] }
          : d
      )),
    }))
    const { container } = renderDay('2026-05-11', '2026-05-11')
    expect(await screen.findByText('edzés · Pihenőnap')).toBeInTheDocument()
    const training = [...container.querySelectorAll('.dev-dim')]
      .find((t) => t.querySelector('.dev-dnm')?.textContent === 'Edzés')
    expect(training?.querySelector('.dev-sring')?.classList.contains('is-dash')).toBe(true)
    expect(training?.querySelector('.dev-sring i')?.textContent).toBe('—')
  })

  test('CONTRACT — nothing logged: `nincs adat`, a different sentence from `tanulom`', async () => {
    serveEvaluation(evaluationFixture('2026-05-11', {
      state: 'empty', score: null, base: null,
      dimensions: evaluationFixture('2026-05-11').dimensions.map(
        (d) => ({ ...d, score: null, status: 'NO_DATA' as const, weight: 0 }),
      ),
    }))
    renderDay('2026-05-11', '2026-05-11')
    expect(await screen.findByRole('img', { name: 'Pontszám: nincs' })).toBeInTheDocument()
    expect(screen.getByText('ezen a napon nem logoltál')).toBeInTheDocument()
    expect(screen.getByText('Egyik területről sincs adat — a nap a heti pontszámba sem számít bele.'))
      .toBeInTheDocument()
    expect(screen.queryByText(/Kettőnél kevesebb területről/)).not.toBeInTheDocument()
  })

  test('a failed week fetch is a retryable error, not an empty day', async () => {
    server.use(http.get(`${API_BASE}/api/me/week/:start`, () => new HttpResponse(null, { status: 500 })))
    renderDay('2026-05-11', '2026-05-11')
    expect(await screen.findByRole('alert')).toHaveTextContent('Nem sikerült betölteni a hét adatait.')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Próbáld újra' })).toBeInTheDocument())
  })
})
