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

// Egy nap (mezo-d20.6.10) — /me/week/napok/:date, prototype `#page-hday`. This route is the fix
// for audit gap §8.3/6: a single day becomes deep-linkable, so a push notification can point at
// one. The clock is pinned so "future" is deterministic (2026-05-21 = Thursday of the seed week
// starting 2026-05-18).
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

beforeEach(() => {
  mockNavigate.mockClear()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs() })

describe('WeekDayPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  test('a scored day: hero ring + chips + verdict, the four sub-score rings, and the fuel goals', () => {
    const { container } = renderDay('2026-05-13', '2026-05-11') // the seed's Wednesday (85)
    expect(screen.getByText('Szerda')).toBeInTheDocument()
    expect(screen.getByText('· máj 13')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Pontszám: 85 / 100' })).toBeInTheDocument()
    expect(screen.getByText('a hét legjobb napja')).toBeInTheDocument()

    expect(screen.getByText('Miből jött össze')).toBeInTheDocument()
    // the four sub-scores, in the prototype's order (alvás · fuel · check-in · aktív)
    expect([...container.querySelectorAll('.wkd-subring')].map((r) => r.textContent))
      .toEqual(['90alvás', '82fuel', '80check-in', '90aktív'])

    // `kcalTarget` / `proteinTargetG` are fetched today and never shown — this is where they land.
    expect(screen.getByText('Fuel · a cél ellenében')).toBeInTheDocument()
    expect(screen.getByText('3 120 / 3 100')).toBeInTheDocument()
    expect(screen.getByText('225 / 220 g')).toBeInTheDocument()
    expect(screen.getByText('355 g · 95 g')).toBeInTheDocument()

    expect(screen.getByText('7ó 50p')).toBeInTheDocument() // alvás cell
    expect(screen.getByText('84,1')).toBeInTheDocument()   // súly cell
    expect(screen.getByText('155')).toBeInTheDocument()    // XP cell
  })

  test("the Mezo's note rides an orb card with feedback and the day chat handoff", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderDay('2026-05-13', '2026-05-11')
    expect(screen.getByText('Mezo · erről a napról')).toBeInTheDocument()
    expect(screen.getByText(/Szerdán volt a heted legjobb alvása/)).toBeInTheDocument()
    expect(screen.getByRole('group', { name: /a napról írt jegyzetről/ })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Beszélgess a napról ›' }))
    expect(mockNavigate).toHaveBeenCalledWith(expect.stringMatching(/^\/mezo\/chat\?c=/))
  })

  test('CONTRACT — the analysis did not write about this day, and says so', () => {
    renderDay('2026-05-14', '2026-05-11') // no dayNote at offset 3
    expect(screen.getByText(
      'A heti elemzés nem írt külön ehhez a naphoz — a Mezo csak azokhoz a napokhoz ír, ahol volt mit mondani.',
    )).toBeInTheDocument()
    expect(screen.queryByText('Mezo · erről a napról')).not.toBeInTheDocument()
    // the chat chip survives — there is always something to talk about
    expect(screen.getByRole('button', { name: 'Beszélgess a napról ›' })).toBeInTheDocument()
  })

  test('CONTRACT — fewer than two sub-scores: `tanulom`, and the reason spelled out', () => {
    renderDay('2026-05-14', '2026-05-11')
    expect(screen.getByRole('img', { name: 'Pontszám: tanulom' })).toBeInTheDocument()
    expect(screen.getByText('még gyűlik')).toBeInTheDocument()
    expect(screen.getByText('kevés adat a pontszámhoz')).toBeInTheDocument()
    expect(screen.getByText(
      'Kettőnél kevesebb területről van adat, ezért a Mezo nem ad pontszámot: kitalálni nem fog.',
    )).toBeInTheDocument()
    expect(screen.queryByText('Fuel · a cél ellenében')).not.toBeInTheDocument() // no kcal → no bars
  })

  test('CONTRACT — nothing logged: `nincs adat`, a different sentence from `tanulom`', () => {
    renderDay('2026-05-16', '2026-05-11')
    expect(screen.getByRole('img', { name: 'Pontszám: nincs' })).toBeInTheDocument()
    expect(screen.getByText('adat')).toBeInTheDocument()
    expect(screen.getByText('ezen a napon nem logoltál')).toBeInTheDocument()
    expect(screen.getByText('Egyik területről sincs adat — a nap a heti pontszámba sem számít bele.'))
      .toBeInTheDocument()
    expect(screen.queryByText(/Kettőnél kevesebb területről/)).not.toBeInTheDocument()
  })

  test('CONTRACT — a future day shows only its waiting card and the stepper', () => {
    renderDay('2026-05-23', '2026-05-18')
    expect(screen.getByText('még előtted')).toBeInTheDocument()
    expect(screen.getByText('Ez a nap még előtted van — ide majd a logolt adatai kerülnek.')).toBeInTheDocument()
    expect(screen.queryByText('Miből jött össze')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Előző nap/ })).toBeInTheDocument()
  })

  test('the prev/next tiles carry the neighbour’s day and score, and step by date', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderDay('2026-05-13', '2026-05-11')
    expect(screen.getByText('Kedd · 72')).toBeInTheDocument()
    expect(screen.getByText('Csü · —')).toBeInTheDocument() // an unscored neighbour, never a 0
    await user.click(screen.getByRole('button', { name: /Következő nap/ }))
    expect(mockNavigate).toHaveBeenCalledWith('/me/week/napok/2026-05-14?start=2026-05-11')
  })

  test('the week edges disable the stepper rather than wrapping', () => {
    renderDay('2026-05-11', '2026-05-11')
    expect(screen.getByRole('button', { name: 'Előző nap' })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Következő nap:/ })).toBeEnabled()
  })

  test('a bare deep link (no ?start=) derives the week from :date', () => {
    renderDay('2026-05-13')
    expect(screen.getByText('Szerda')).toBeInTheDocument()
    expect(screen.getByText('Máj 11 – 17')).toBeInTheDocument()
  })

  test('a ?start= from ANOTHER week is ignored — the date wins', () => {
    renderDay('2026-05-13', '2026-06-01')
    expect(screen.getByText('Máj 11 – 17')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Pontszám: 85 / 100' })).toBeInTheDocument()
  })

  test('a malformed :date redirects to the mosaic instead of crashing', () => {
    renderDay('2026-02-31')
    expect(screen.getByTestId('loc')).toHaveTextContent('/me/week/napok')
  })
})

describe('WeekDayPage (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))

  test('renders the FETCHED day, never the mock seed, and says the review is missing', async () => {
    renderDay('2026-05-11', '2026-05-11')
    expect(await screen.findByRole('img', { name: 'Pontszám: 65 / 100' })).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'Pontszám: 78 / 100' })).not.toBeInTheDocument()
    // the default MSW review 404s → "the analysis has not been written yet", not the §4 noNote line
    expect(await screen.findByText(
      'A heti elemzés nem írt külön ehhez a naphoz — az elemzés még nem készült el.',
    )).toBeInTheDocument()
  })

  test('a failed week fetch is a retryable error, not an empty day', async () => {
    server.use(http.get(`${API_BASE}/api/me/week/:start`, () => new HttpResponse(null, { status: 500 })))
    renderDay('2026-05-11', '2026-05-11')
    expect(await screen.findByRole('alert')).toHaveTextContent('Nem sikerült betölteni a hét adatait.')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Próbáld újra' })).toBeInTheDocument())
  })
})
