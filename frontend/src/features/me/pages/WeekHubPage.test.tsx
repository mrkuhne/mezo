// Heti hub (mezo-d20.6.10) — behavioural coverage rewritten from the retired WeekPage.test
// onto the tile hub, in BOTH modes. The honest-state contracts (handoff §4) are asserted on
// the rendered page here; their pure rules live in `logic/weekHub.test.ts`.
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { WeekHubPage } from '@/features/me/pages/WeekHubPage'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { mondayIso, deriveWeekTitle } from '@/data/fuel/fuelWeekHooks'
import { mockMeWeekStart } from '@/data/me/meWeek'
import { prevMonday } from '@/features/me/logic/weekNav'

// The tile → own-page navigation goes through useNavigate; spy on it so the wiring tests can
// assert the exact target (the four detail pages belong to the sibling slices).
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

// Single hook-override point (the retired WeekPage.test's idiom): the mock seed's weekly score
// is always 78 and a past week ALWAYS has a review, so the „tanulom" hero and the
// closed-week-without-analysis branch are otherwise unreachable in mock mode.
const hoisted = vi.hoisted(() => ({
  forceNullScore: false,
  forceEmptyWeekly: false,
  dropReview: false,
  regenerateSpy: vi.fn(async () => {}),
}))
vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return {
    ...actual,
    useMeWeek: (startIso: string) => {
      const real = actual.useMeWeek(startIso)
      if (!real.week) return real
      if (hoisted.forceEmptyWeekly) {
        return { ...real, week: { ...real.week, weekly: {
          score: null, prevWeekScore: null, avgKcal: null, avgProteinG: null, avgSleepMin: null,
          avgCheckinEnergy: null, checkinRatio: null, latestWeightKg: null,
          weightWeeklyRateKg: null, totalXp: null,
        } } }
      }
      if (hoisted.forceNullScore) {
        return { ...real, week: { ...real.week, weekly: { ...real.week.weekly, score: null, prevWeekScore: null } } }
      }
      return real
    },
    useWeeklyReview: (startIso: string) => {
      const real = actual.useWeeklyReview(startIso)
      if (!hoisted.dropReview) return real
      return { ...real, review: null, regenerate: hoisted.regenerateSpy }
    },
  }
})

const renderPage = (path = '/me/week') =>
  render(
    <QueryWrapper>
      <MemoryRouter initialEntries={[path]}>
        <WeekHubPage />
      </MemoryRouter>
    </QueryWrapper>,
  )

afterEach(() => {
  vi.unstubAllEnvs()
  hoisted.forceNullScore = false
  hoisted.forceEmptyWeekly = false
  hoisted.dropReview = false
  hoisted.regenerateSpy.mockClear()
  mockNavigate.mockReset()
})

describe('Heti hub (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  test('hero: week title, the counted-up score ring and the delta pill with the previous week', () => {
    renderPage()
    expect(screen.getByText(deriveWeekTitle(mondayIso()))).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Pontszám: 78 / 100' })).toBeInTheDocument()
    expect(screen.getByText('+4')).toBeInTheDocument()
    expect(screen.getByText('előző hét 74')).toBeInTheDocument()
  })

  test('eight mini-cells, including Energia and Súly — the two /api/me/week already returns and the old UI dropped', () => {
    renderPage()
    for (const label of ['Kcal átlag', 'Fehérje', 'Alvás', 'Check-in', 'Energia', 'Súly', 'Súly-trend', 'XP']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
    expect(screen.getByText('7,0')).toBeInTheDocument()   // avgCheckinEnergy
    expect(screen.getByText('83,9')).toBeInTheDocument()  // latestWeightKg
    expect(screen.getByText('−0,30')).toBeInTheDocument() // weightWeeklyRateKg
  })

  test('missing data renders „—", never a 0', () => {
    hoisted.forceEmptyWeekly = true
    renderPage()
    // eight cells + the „A hét tanulságai" tile's own „—" (no week-scoped candidates yet) +
    // one WeekGoalsCard arrow glyph (mezo-iizd.9: the third mock goal's arrow is `insufficient`,
    // which honestly renders the same „—" glyph as the no-data placeholder, never a direction)
    expect(screen.getAllByText('—').length).toBe(10)
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })

  test('a week with fewer than 2 measured days: no score, „tanulom" + the contract sentence', () => {
    hoisted.forceNullScore = true
    renderPage()
    expect(screen.getByText('tanulom')).toBeInTheDocument()
    expect(screen.getByText('még gyűjtöm az adatokat a heti értékeléshez')).toBeInTheDocument()
  })

  test('running week without an analysis: the ghost + „N / 7 nap logolva", and NO repair action', () => {
    renderPage()
    expect(screen.getByText('hétfőn jön')).toBeInTheDocument()
    expect(screen.getByText(/Hétfő reggel érkezik — a Mezo a lezárt hét adataiból írja meg\./)).toBeInTheDocument()
    expect(screen.getByText('5 / 7 nap logolva')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Készítsd el most/ })).not.toBeInTheDocument()
    expect(screen.getByText('ez a hét · még fut')).toBeInTheDocument()
  })

  test('closed week WITH an analysis: first sentence, a real generation stamp and the honest sub-line', () => {
    renderPage(`/me/week?start=${mockMeWeekStart}`)
    expect(screen.getByText('Erős hét volt: a fehérjecélt öt napon tartottad, és a legjobb alvásod pont az edzésnappal esett egybe.')).toBeInTheDocument()
    expect(screen.getByText(/^\p{L}+ \d{2}:\d{2}$/u)).toBeInTheDocument()
    expect(screen.getByText('lezárt hét · a Mezo elemzésével')).toBeInTheDocument()
    expect(screen.getByText('napi pontszám · 5 / 7 nap')).toBeInTheDocument()
  })

  test('closed week WITHOUT an analysis: NOT the running-week ghost, plus „✦ Készítsd el most"', () => {
    hoisted.dropReview = true
    renderPage(`/me/week?start=${mockMeWeekStart}`)
    expect(screen.getByText('Ez a hét lezárt, de nem készült elemzés — a hét adatai megvannak, bármikor pótolható.')).toBeInTheDocument()
    expect(screen.queryByText(/Hétfő reggel érkezik/)).not.toBeInTheDocument()
    expect(screen.getByText('nincs még')).toBeInTheDocument()
    expect(screen.getByText('lezárt hét · elemzés nélkül')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '✦ Készítsd el most' }))
    expect(hoisted.regenerateSpy).toHaveBeenCalledTimes(1)
  })

  test('„tanulom" and „nincs adat" are separated on the days tile, not conflated', () => {
    const { container } = renderPage(`/me/week?start=${mockMeWeekStart}`)
    // the seed week: 5 scored days, Csütörtök = one measured area (tanulom), Szombat = nothing logged
    expect(screen.getByRole('img', { name: '5 mért nap · 1 tanulom · 1 nincs adat' })).toBeInTheDocument()
    const rings = container.querySelectorAll('.wkh-miniring i')
    expect(rings).toHaveLength(7)
    expect(container.querySelectorAll('.wkh-miniring i.is-nodata')).toHaveLength(1)
    expect(rings[3].getAttribute('title'))
      .toBe('Kettőnél kevesebb területről van adat, ezért a Mezo nem ad pontszámot: kitalálni nem fog.')
    expect(rings[5].getAttribute('title'))
      .toBe('ezen a napon nem logoltál — a hét pontszámába nem számít bele')
  })

  test('the four view tiles open their own pages, carrying ?start=', () => {
    renderPage(`/me/week?start=${mockMeWeekStart}`)
    const cases: [RegExp, string][] = [
      [/Mezo · heti elemzés/, `/me/week/elemzes?start=${mockMeWeekStart}`],
      [/A hét tanulságai/, `/me/week/tanulsagok?start=${mockMeWeekStart}`],
      [/A hét napjai/, `/me/week/napok?start=${mockMeWeekStart}`],
      [/Heti felfedezések/, `/me/week/felfedezesek?start=${mockMeWeekStart}`],
    ]
    for (const [label, target] of cases) {
      mockNavigate.mockReset()
      fireEvent.click(screen.getByText(label).closest('button')!)
      expect(mockNavigate).toHaveBeenCalledWith(target)
    }
  })

  test('the discoveries tile counts the digest, quiet weeks included', () => {
    renderPage(`/me/week?start=${mockMeWeekStart}`)
    expect(screen.getByText('5 új nyom a memóriában')).toBeInTheDocument()
    expect(screen.getByText('1 minta · 1 új tudás · 1 életesemény · memoár · 1 előrejelzés')).toBeInTheDocument()
  })

  test('week stepping: next is disabled on the current week, prev steps the title back', () => {
    renderPage()
    expect(screen.getByRole('button', { name: 'Következő hét' })).toBeDisabled()
    const prev = screen.getByRole('button', { name: 'Előző hét' })
    expect(prev).not.toBeDisabled()
    fireEvent.click(prev)
    expect(screen.getByText(deriveWeekTitle(prevMonday(mondayIso())))).toBeInTheDocument()
    expect(screen.queryByText(deriveWeekTitle(mondayIso()))).not.toBeInTheDocument()
  })

  test('„Mezo · a következő heted" sits at the bottom of the running week only', () => {
    renderPage()
    expect(screen.getByText('Mezo · a következő heted')).toBeInTheDocument()
    renderPage(`/me/week?start=${mockMeWeekStart}`)
    expect(screen.getAllByText('Mezo · a következő heted')).toHaveLength(1) // still only the first render's
  })

  test('the honesty footnote is on the page', () => {
    renderPage()
    expect(screen.getByText(/A Mezo sosem talál ki számot/)).toBeInTheDocument()
  })

  test('a heti hub viszi a cél-kártyát (mezo-iizd.9)', async () => {
    renderPage()
    expect(await screen.findByText('Célok · a hét iránya')).toBeInTheDocument()
  })
})

describe('Heti hub (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))

  test('renders the FETCHED week, never the mock seed', async () => {
    renderPage(`/me/week?start=${mockMeWeekStart}`)
    // skeleton first — a week switch must never show a blank page
    expect(screen.getByTestId('wkh-skeleton')).toBeInTheDocument()
    expect(await screen.findByRole('img', { name: 'Pontszám: 65 / 100' })).toBeInTheDocument()
    expect(screen.getByText('+5')).toBeInTheDocument()
    expect(screen.getByText('előző hét 60')).toBeInTheDocument()
    expect(screen.queryByText('83,9')).not.toBeInTheDocument() // the seed's latestWeightKg
    expect(screen.getByText('82,5')).toBeInTheDocument()       // the fetched one
  })

  test('a failed week fetch offers a retry instead of rendering as an empty week', async () => {
    server.use(http.get(`${API_BASE}/api/me/week/:start`, () => new HttpResponse(null, { status: 500 })))
    renderPage(`/me/week?start=${mockMeWeekStart}`)
    expect(await screen.findByText('Nem sikerült betölteni a hetet.', undefined, { timeout: 5000 })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Újra' })).toBeInTheDocument()
  })

  test('a closed week whose review 404s shows the repair action, not the running-week ghost', async () => {
    renderPage(`/me/week?start=${mockMeWeekStart}`)
    await waitFor(() => expect(screen.getByText('nincs még')).toBeInTheDocument())
    expect(screen.getByText('Ez a hét lezárt, de nem készült elemzés — a hét adatai megvannak, bármikor pótolható.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '✦ Készítsd el most' })).toBeInTheDocument()
  })
})
