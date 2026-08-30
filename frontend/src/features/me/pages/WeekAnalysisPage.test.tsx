import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/data/_client/api'
import { QueryWrapper } from '@/test/queryWrapper'
import { WeekAnalysisPage } from '@/features/me/pages/WeekAnalysisPage'
import { mockMeWeekStart } from '@/data/me/meWeek'
import { mondayIso } from '@/data/fuel/fuelWeekHooks'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

// The mock seed only goes review-less for the CURRENT week, so the "closed week, no review"
// branch (handoff §4 — the bug this slice fixes) is otherwise unreachable in mock mode.
// Same hoisted single-hook override WeekPage.test uses.
const hoisted = vi.hoisted(() => ({ dropReview: false, forceStale: false, regenerateSpy: vi.fn() }))
vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return {
    ...actual,
    useWeeklyReview: (startIso: string) => {
      const real = actual.useWeeklyReview(startIso)
      if (hoisted.dropReview) return { ...real, review: null, regenerate: hoisted.regenerateSpy }
      if (hoisted.forceStale && real.review) {
        return { ...real, review: { ...real.review, stale: true }, regenerate: hoisted.regenerateSpy }
      }
      return real
    },
  }
})

function renderAt(search = '') {
  return render(
    <MemoryRouter initialEntries={[`/me/week/elemzes${search}`]}>
      <WeekAnalysisPage />
    </MemoryRouter>,
    { wrapper: QueryWrapper },
  )
}

afterEach(() => {
  vi.unstubAllEnvs()
  hoisted.dropReview = false
  hoisted.forceStale = false
  hoisted.regenerateSpy.mockClear()
  mockNavigate.mockReset()
})

// ── mock mode ───────────────────────────────────────────────────────────────
describe('WeekAnalysisPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  test('hero + the analysis prose render for a closed week that HAS a review', () => {
    const { container } = renderAt(`?start=${mockMeWeekStart}`)
    expect(screen.getByText('Heti elemzés')).toBeInTheDocument()
    expect(container.querySelector('.mz-bignum')).toHaveTextContent('78 / 100')
    expect(screen.getByText('napi pontszámok · a Mezo olvasata')).toBeInTheDocument()
    expect(screen.getByText(/Erős hét volt/)).toBeInTheDocument()
  })

  test('the day axis comes from the real dates — Szerda and Szombat no longer collide as „Sz"', () => {
    const { container } = renderAt(`?start=${mockMeWeekStart}`)
    const axis = [...container.querySelectorAll('.wka-col .dw')].map((n) => n.textContent)
    expect(axis).toEqual(['Hét', 'Ked', 'Sze', 'Csü', 'Pén', 'Szo', 'Vas'])
  })

  test('a column is a real button that opens that day (ISO deeplink), and the chart is not aria-hidden', () => {
    const { container } = renderAt(`?start=${mockMeWeekStart}`)
    expect(container.querySelector('[aria-hidden="true"] .wka-col')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /^Szerda, Máj 20/ }))
    expect(mockNavigate).toHaveBeenCalledWith('/me/week/napok/2026-05-20')
  })

  test('CONTRACT: an unscored day shows „—", never 0 — and its accessible name separates tanulom from nincs adat', () => {
    const { container } = renderAt(`?start=${mockMeWeekStart}`)
    const values = [...container.querySelectorAll('.wka-col .vl')].map((n) => n.textContent)
    expect(values).toEqual(['78', '72', '85', '—', '74', '—', '80'])
    expect(values).not.toContain('0')
    // Csütörtök logged two check-ins but has fewer than two measured areas ⇒ tanulom.
    expect(screen.getByRole('button', { name: 'Csütörtök, Máj 21 — tanulom' })).toBeInTheDocument()
    // Szombat logged nothing at all ⇒ a DIFFERENT state (today's code conflates the two).
    expect(screen.getByRole('button', { name: 'Szombat, Máj 23 — nincs adat' })).toBeInTheDocument()
  })

  test('the `amire épült` chips are built from highlights[] and jump to the /mezo routes', () => {
    renderAt(`?start=${mockMeWeekStart}`)
    expect(screen.getByText('amire épült')).toBeInTheDocument()
    expect(screen.getByText('Minta')).toBeInTheDocument()
    expect(screen.getByText('Tudás')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Edzésnapokon jobban alszol'))
    expect(mockNavigate).toHaveBeenCalledWith('/mezo/patterns/sleep_workout')
    fireEvent.click(screen.getByText('A fehérjecél tartása javítja a check-in energiát'))
    expect(mockNavigate).toHaveBeenCalledWith('/mezo/knowledge')
  })

  test('generatedAt reads in human language, not as an ISO stamp', () => {
    const { container } = renderAt(`?start=${mockMeWeekStart}`)
    const stamp = container.querySelector('.wka-stamp')!.textContent!
    expect(stamp).toMatch(/^(ma|tegnap|hétfő|kedd|szerda|csütörtök|péntek|szombat|vasárnap|[a-záéíóöőúüű]{3} \d{1,2}\.) \d{2}:\d{2}$/)
    expect(stamp).not.toMatch(/T\d{2}:\d{2}:\d{2}Z/)
  })

  test('„Beszélgess a hétről" hands off to a week-anchored conversation', () => {
    renderAt(`?start=${mockMeWeekStart}`)
    fireEvent.click(screen.getByRole('button', { name: /Beszélgess a hétről/ }))
    expect(mockNavigate).toHaveBeenCalledWith(expect.stringMatching(/^\/mezo\/chat\?c=/))
  })

  test('the quiet hand-off strip goes to the lessons page, carrying the week', () => {
    renderAt(`?start=${mockMeWeekStart}`)
    fireEvent.click(screen.getByRole('button', { name: /A hét tanulságai/ }))
    expect(mockNavigate).toHaveBeenCalledWith(`/me/week/tanulsagok?start=${mockMeWeekStart}`)
  })

  test('‹ Heti returns to the hub with the browsed week', () => {
    renderAt(`?start=${mockMeWeekStart}`)
    fireEvent.click(screen.getByRole('button', { name: 'Vissza' }))
    expect(mockNavigate).toHaveBeenCalledWith(`/me/week?start=${mockMeWeekStart}`)
  })

  test('CONTRACT: a RUNNING week with no review gets the „hétfő reggel érkezik" ghost + N / 7 nap', () => {
    renderAt(`?start=${mondayIso()}`)
    expect(screen.getByText(/Hétfő reggel érkezik/)).toBeInTheDocument()
    expect(screen.getByText('5 / 7 nap')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Készítsd el most/ })).not.toBeInTheDocument()
  })

  test('CONTRACT: a CLOSED week with no review gets its OWN copy + „✦ Készítsd el most" (not the ghost)', () => {
    hoisted.dropReview = true
    renderAt(`?start=${mockMeWeekStart}`)
    expect(screen.getByText(/Ez a hét lezárt, de/)).toBeInTheDocument()
    expect(screen.getByText('nem készült elemzés')).toBeInTheDocument()
    expect(screen.queryByText(/Hétfő reggel érkezik/)).not.toBeInTheDocument()
    expect(screen.getByText('napi pontszámok · elemzés nélkül')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Készítsd el most/ }))
    expect(hoisted.regenerateSpy).toHaveBeenCalled()
  })

  test('a stale review offers „↻ Frissítsd az elemzést"', () => {
    hoisted.forceStale = true
    renderAt(`?start=${mockMeWeekStart}`)
    fireEvent.click(screen.getByRole('button', { name: /Frissítsd az elemzést/ }))
    expect(hoisted.regenerateSpy).toHaveBeenCalled()
  })
})

// ── real mode (MSW) ─────────────────────────────────────────────────────────
describe('WeekAnalysisPage (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))

  const PAST = '2026-05-18'

  test('renders the FETCHED week, never the mock seed', async () => {
    const { container } = renderAt(`?start=${PAST}`)
    await waitFor(() => expect(container.querySelector('.mz-bignum')).toHaveTextContent('65 / 100'))
    expect(container.querySelector('.mz-bignum')).not.toHaveTextContent('78')
    expect(screen.queryByText(/Erős hét volt/)).not.toBeInTheDocument()
    // the fetched week's SIX honest-empty days, none of them a fabricated zero
    const values = [...container.querySelectorAll('.wka-col .vl')].map((n) => n.textContent)
    expect(values).toEqual(['65', '—', '—', '—', '—', '—', '—'])
  })

  test('CONTRACT: the default 404 review on a CLOSED week renders the „pótolható" branch, and the CTA POSTs regenerate', async () => {
    let regenerated = false
    server.use(
      http.post(`${API_BASE}/api/proactive/weekly-review/:start/regenerate`, ({ params }) => {
        regenerated = true
        return HttpResponse.json({
          id: 'e2b1c3d4-5f6a-4b7c-8d9e-0a1b2c3d4e5f', weekStart: params.start as string,
          summary: 'Frissített elemzés.', dayNotes: [], highlights: [],
          generatedAt: '2026-05-25T06:00:00Z', stale: false,
        })
      }),
    )
    renderAt(`?start=${PAST}`)
    const cta = await screen.findByRole('button', { name: /Készítsd el most/ })
    expect(screen.getByText(/Ez a hét lezárt, de/)).toBeInTheDocument()
    fireEvent.click(cta)
    await waitFor(() => expect(regenerated).toBe(true))
  })

  test('a fetched review with highlights renders the anchor chips + the stale refresh', async () => {
    server.use(
      http.get(`${API_BASE}/api/proactive/weekly-review/:start`, ({ params }) => HttpResponse.json({
        id: '11111111-2222-4333-8444-555555555555', weekStart: params.start as string,
        summary: 'Valós elemzés a hétről.', dayNotes: [],
        highlights: [
          { kind: 'Pattern', label: 'Real-mode pattern' },
          { kind: 'Memory', label: 'Heti memoár' },
        ],
        generatedAt: '2026-05-25T06:15:00Z', stale: true,
      })),
    )
    renderAt(`?start=${PAST}`)
    expect(await screen.findByText('Valós elemzés a hétről.')).toBeInTheDocument()
    // the digest's pairKey resolves the Minta deep link
    fireEvent.click(screen.getByText('Real-mode pattern'))
    expect(mockNavigate).toHaveBeenCalledWith('/mezo/patterns/sleep_workout')
    fireEvent.click(screen.getByText('Heti memoár'))
    expect(mockNavigate).toHaveBeenCalledWith('/mezo/memoir')
    expect(screen.getByRole('button', { name: /Frissítsd az elemzést/ })).toBeInTheDocument()
  })

  test('CONTRACT: a failed week fetch is a retryable error state, not a silent empty page', async () => {
    let calls = 0
    server.use(
      http.get(`${API_BASE}/api/me/week/:start`, () => { calls += 1; return new HttpResponse(null, { status: 500 }) }),
    )
    renderAt(`?start=${PAST}`)
    expect(await screen.findByText('Nem sikerült betölteni a hét adatait.')).toBeInTheDocument()
    const before = calls
    fireEvent.click(screen.getByRole('button', { name: 'Újra' }))
    await waitFor(() => expect(calls).toBeGreaterThan(before))
  })

  test('CONTRACT: the cold-load window shows a skeleton, never a fabricated zero week', async () => {
    server.use(
      http.get(`${API_BASE}/api/me/week/:start`, async () => {
        await new Promise((r) => setTimeout(r, 40))
        return new HttpResponse(null, { status: 404 })
      }),
    )
    const { container } = renderAt(`?start=${PAST}`)
    expect(container.querySelector('.wka-skels')).not.toBeNull()
    expect(screen.queryByText('0')).not.toBeInTheDocument()
    expect(container.querySelector('.wka-dcols')).toBeNull()
  })

  test('an empty highlights[] simply omits the „amire épült" row — no placeholder chips', async () => {
    server.use(
      http.get(`${API_BASE}/api/proactive/weekly-review/:start`, ({ params }) => HttpResponse.json({
        id: '11111111-2222-4333-8444-555555555556', weekStart: params.start as string,
        summary: 'Horgony nélküli elemzés.', dayNotes: [], highlights: [],
        generatedAt: '2026-05-25T06:15:00Z', stale: false,
      })),
    )
    const { container } = renderAt(`?start=${PAST}`)
    expect(await screen.findByText('Horgony nélküli elemzés.')).toBeInTheDocument()
    expect(screen.queryByText('amire épült')).not.toBeInTheDocument()
    expect(within(container.querySelector('.wka-rev')!).queryByText('Minta')).toBeNull()
  })
})
