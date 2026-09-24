import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { delay, http, HttpResponse } from 'msw'
import { NapomPage } from '@/features/today/pages/NapomPage'
import { seenKey } from '@/features/today/logic/napom'
import { QueryWrapper } from '@/test/queryWrapper'
import { ToastProvider } from '@/shared/ui/ToastProvider'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { mockDayEvaluationDates } from '@/data/me/dayEvaluation'
import type { DayDimension, DayEvaluationResponse } from '@/data/me/dayEvaluation'

// A napom (mezo-yjzhw.4) — `/nap/napom` + `/nap/napom/:date`, the day page in glass
// (prototype uveg-napod-body.html, layout 2 = rows). "Today" is pinned with a fake clock onto
// the mock fixture dates: 2026-05-21 is both the `in_progress` fixture and a Thursday of the
// mock week (Monday 2026-05-18, the scored fixture).
const TODAY = new Date(`${mockDayEvaluationDates.inProgress}T10:00:00`)

function LocationProbe() {
  const loc = useLocation()
  return <div data-testid="loc">{loc.pathname}</div>
}

function renderAt(path: string) {
  return render(
    <QueryWrapper>
      <ToastProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/nap/napom" element={<NapomPage />} />
            <Route path="/nap/napom/:date" element={<NapomPage />} />
            <Route path="*" element={null} />
          </Routes>
          <LocationProbe />
        </MemoryRouter>
      </ToastProvider>
    </QueryWrapper>,
  )
}

const DIM_ROW = /Tápanyag|Minőség|Edzés|Alvás|Logolás|Ritmus/

function evaluationFixture(date: string, patch: Partial<DayEvaluationResponse> = {}): DayEvaluationResponse {
  const dim = (id: string, label: string): DayDimension => ({
    id, label, weight: 1 / 6, score: 70, status: 'DONE', facts: [], note: null,
  })
  return {
    date, state: 'scored', score: 70, base: 70, adjustment: null,
    narrative: ['Egy nyugodt nap volt.'], highlights: [], context: [],
    dimensions: [
      dim('nutrition', 'Táplálkozás'), dim('quality', 'Minőség'), dim('training', 'Edzés'),
      dim('sleep', 'Alvás'), dim('logging', 'Naplózás'), dim('rhythm', 'Ritmus'),
    ],
    ...patch,
  }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(TODAY)
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs() })

describe('NapomPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  test('scored day: review card, adjustment toggle, six rows, context, no italic class', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const { container } = renderAt(`/nap/napom/${mockDayEvaluationDates.scored}`)
    expect(await screen.findByText('MEZO · A NAPODRÓL')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Pontszám: 78 / 100' })).toBeInTheDocument()
    expect(screen.getByText('LEZÁRVA')).toBeInTheDocument()

    const pill = screen.getByRole('button', { name: /alap 75/ })
    expect(pill).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText(/Következetes napi ritmus/)).toBeNull()
    await user.click(pill)
    expect(pill).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(/Következetes napi ritmus/)).toBeInTheDocument()

    expect(screen.getAllByRole('button', { name: DIM_ROW })).toHaveLength(6)
    expect(screen.getByText('Miből jött össze')).toBeInTheDocument()
    expect(screen.getByText('A nap körülményei')).toBeInTheDocument()
    expect(screen.getByText('NEM SZÁMÍT A PONTBA')).toBeInTheDocument()
    expect(screen.getByText('edzésnap')).toBeInTheDocument()
    expect(screen.getByText('Ha utólag beírsz még valamit erre a napra, a jegyzetet egyszer újraírom.'))
      .toBeInTheDocument()
    // owner 2026-09-24: no italic serif anywhere on this page
    expect(container.querySelector('.uv-voice')).toBeNull()
  })

  test('scored day: the week strip marks the viewed day and steps by date', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderAt(`/nap/napom/${mockDayEvaluationDates.scored}`)
    const strip = screen.getByRole('group', { name: 'A hét napjai' })
    const days = within(strip).getAllByRole('button')
    expect(days).toHaveLength(7)
    expect(days[0]).toHaveAttribute('aria-current', 'date')
    // Thursday is today, Friday+ are still ahead and cannot be opened
    expect(days[3]).toHaveClass('is-today')
    expect(days[4]).toBeDisabled()
    await user.click(days[1])
    expect(screen.getByTestId('loc')).toHaveTextContent('/nap/napom/2026-05-19')
    expect(screen.getByText('A NAPOM')).toBeInTheDocument()
    expect(screen.getByText('MÁJ 18 – 24')).toBeInTheDocument()
  })

  test('open day: live eyebrow, N/6 centre, reading, no overall number', async () => {
    renderAt(`/nap/napom/${mockDayEvaluationDates.inProgress}`)
    expect(await screen.findByText(/TERÜLET KÉSZ/)).toBeInTheDocument()
    expect(screen.getByRole('img', { name: '2 / 6 terület kész' })).toBeInTheDocument()
    expect(screen.getByText(/ÉLŐ · FRISSÜLT \d{2}:\d{2}/)).toBeInTheDocument()
    expect(screen.queryByText(/alap \d+/)).toBeNull()
    expect(screen.queryByRole('img', { name: /Pontszám/ })).toBeNull()
    expect(screen.getByText(/Napközben nincs pontszám\./)).toBeInTheDocument()
    expect(screen.getByText('Ma eddig')).toBeInTheDocument()
    expect(screen.getByText('6 TERÜLET')).toBeInTheDocument()
    // status words per dimension: DONE / IN_PROGRESS / NO_DATA
    expect(screen.getAllByText('KÉSZ')).toHaveLength(2)
    expect(screen.getAllByText('ÚTON')).toHaveLength(1)
    expect(screen.getAllByText('NYITVA')).toHaveLength(3)
    // no LLM prose during the day
    expect(screen.queryByText('MEZO · A NAPODRÓL')).toBeNull()
  })

  test('open day at 10:00: the lead card offers the missing check-in', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderAt(`/nap/napom/${mockDayEvaluationDates.inProgress}`)
    expect(screen.getByText('Egy check-in hiányzik')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Check-in/ }))
    expect(screen.getByTestId('loc')).toHaveTextContent('/nap/checkin')
  })

  test('thin day shows the dashed no-data card', async () => {
    vi.setSystemTime(new Date('2026-05-23T10:00:00'))
    const { container } = renderAt(`/nap/napom/${mockDayEvaluationDates.thin}`)
    expect(await screen.findByText('Erre a napra kevés az adat')).toBeInTheDocument()
    expect(screen.getByText(/Kettőnél kevesebb területről van adat/)).toBeInTheDocument()
    // the one row with data stays glass, the other five are dashed
    const rows = [...container.querySelectorAll('.napom-drow')]
    expect(rows).toHaveLength(6)
    expect(rows.filter((r) => r.classList.contains('glass'))).toHaveLength(1)
    expect(rows.filter((r) => r.classList.contains('is-open'))).toHaveLength(5)
    expect(screen.queryByRole('img', { name: /Pontszám/ })).toBeNull()
  })

  test('future day shows only its dashed waiting card', () => {
    renderAt(`/nap/napom/${mockDayEvaluationDates.future}`)
    expect(screen.getByText('Ez a nap még előtted van — ide majd a logolt adatai kerülnek.')).toBeInTheDocument()
    expect(screen.queryAllByRole('button', { name: DIM_ROW })).toHaveLength(0)
  })

  test('expanding a scored row reveals its note', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderAt(`/nap/napom/${mockDayEvaluationDates.scored}`)
    const note = 'A fehérjecélt majdnem hoztad, a kalória is célban volt.'
    expect(screen.queryByText(note)).toBeNull()
    const row = screen.getByRole('button', { name: /^Tápanyag/ })
    await user.click(row)
    expect(row).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(note)).toBeInTheDocument()
    expect(screen.getByText('fehérje · 205 / 220 g')).toBeInTheDocument()
  })

  test('the review card carries the feedback chips and the chat handoff', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderAt(`/nap/napom/${mockDayEvaluationDates.scored}`)
    expect(screen.getByRole('button', { name: /Segített/ })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Beszélgess a napról/ }))
    expect(screen.getByTestId('loc')).toHaveTextContent('/mezo/chat')
  })

  test('invalid date redirects to /nap/napom', () => {
    renderAt('/nap/napom/xx')
    expect(screen.getByTestId('loc')).toHaveTextContent(/^\/nap\/napom$/)
  })

  test('/nap/napom without a date opens today when there is nothing new from yesterday', () => {
    localStorage.setItem(seenKey('2026-05-20'), '1')
    renderAt('/nap/napom')
    expect(screen.getByText('Csütörtök')).toBeInTheDocument()
    expect(screen.getByText(/TERÜLET KÉSZ/)).toBeInTheDocument()
  })

  test('morning mode: /nap/napom opens an unseen scored yesterday, marks it seen, and leads on to today', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    vi.setSystemTime(new Date('2026-05-19T07:30:00'))
    renderAt('/nap/napom')
    expect(screen.getByText('Hétfő')).toBeInTheDocument()
    expect(screen.getByText('MEZO · A NAPODRÓL')).toBeInTheDocument()
    expect(localStorage.getItem(seenKey(mockDayEvaluationDates.scored))).toBe('1')
    // …and the page does not flip to today once it is marked seen
    expect(screen.getByText('Hétfő')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Tovább a mai napra/ }))
    expect(screen.getByTestId('loc')).toHaveTextContent('/nap/napom/2026-05-19')
  })
})

describe('NapomPage (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))

  test('renders the FETCHED evaluation, never the mock seed', async () => {
    renderAt('/nap/napom/2026-05-11')
    expect(await screen.findByRole('img', { name: 'Pontszám: 66 / 100' })).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'Pontszám: 78 / 100' })).toBeNull()
    expect(screen.getByRole('button', { name: /Segített/ })).toBeInTheDocument()
  })

  test('a scored evaluation with no narrative renders no review card', async () => {
    server.use(http.get(`${API_BASE}/api/me/day/:date/evaluation`,
      () => HttpResponse.json(evaluationFixture('2026-05-11', { narrative: [] }))))
    renderAt('/nap/napom/2026-05-11')
    expect(await screen.findByText('Miből jött össze')).toBeInTheDocument()
    expect(screen.queryByText('MEZO · A NAPODRÓL')).toBeNull()
  })

  test('a scored evaluation with no reviewId renders the card without chips', async () => {
    server.use(http.get(`${API_BASE}/api/me/day/:date/evaluation`,
      () => HttpResponse.json(evaluationFixture('2026-05-11'))))
    renderAt('/nap/napom/2026-05-11')
    expect(await screen.findByText('MEZO · A NAPODRÓL')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Segített/ })).toBeNull()
  })

  test('an evaluation still in flight is an honest pending state with no number', async () => {
    server.use(http.get(`${API_BASE}/api/me/day/:date/evaluation`, async () => {
      await delay(80)
      return HttpResponse.json(evaluationFixture('2026-05-11'))
    }))
    const { container } = renderAt('/nap/napom/2026-05-11')
    expect(screen.getByRole('img', { name: 'számolom · egy pillanat' })).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /Pontszám/ })).toBeNull()
    expect(container.querySelectorAll('.napom-drow.is-open')).toHaveLength(6)
    expect(await screen.findByRole('img', { name: 'Pontszám: 70 / 100' })).toBeInTheDocument()
  })

  test('a failed evaluation is a retryable error, not an empty day', async () => {
    server.use(http.get(`${API_BASE}/api/me/day/:date/evaluation`,
      () => new HttpResponse(null, { status: 500 })))
    renderAt('/nap/napom/2026-05-11')
    expect(await screen.findByRole('alert')).toHaveTextContent('Nem sikerült betölteni a napot.')
    expect(screen.getByRole('button', { name: 'Próbáld újra' })).toBeInTheDocument()
  })

  test('the neighbour days are prefetched', async () => {
    const asked: string[] = []
    server.use(http.get(`${API_BASE}/api/me/day/:date/evaluation`, ({ params }) => {
      asked.push(String(params.date))
      return HttpResponse.json(evaluationFixture(String(params.date)))
    }))
    renderAt('/nap/napom/2026-05-13')
    expect(await screen.findByText('Miből jött össze')).toBeInTheDocument()
    await vi.waitFor(() => expect(asked).toEqual(expect.arrayContaining(['2026-05-12', '2026-05-13', '2026-05-14'])))
  })
})
