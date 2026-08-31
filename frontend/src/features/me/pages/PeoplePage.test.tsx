// Emberek S3 hub (mezo-06o0.2) — PeoplePage becomes the Kapcsolatok hub: a hero + 3-cell
// stat strip + 4 navigation tiles (Jelöltek / A köröm / Említések / Heti kép, each a sibling
// page — WeekHub precedent, never a local show/hide) + the Mezo-band chat handoff.
// `now` is pinned to the mock seed's own "today" (2026-05-24) so hubLines' 7-day window lands
// on a known, hand-checked set of mentions (see data/me/people.ts) instead of drifting with
// the real clock.
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, afterEach, describe, expect, test, vi } from 'vitest'
import { QueryWrapper } from '@/test/queryWrapper'
import { PeoplePage } from '@/features/me/pages/PeoplePage'
import { PeopleJeloltekPage } from '@/features/me/pages/PeopleJeloltekPage'

const NOW = new Date('2026-05-24T12:00:00')

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

// Flattens every person's affectTrend so nobody trends down/up — exercises the honest
// '—' fallback (statstrip down-cell) and the empty-circle Mezo-band sentence, both of
// which the always-has-a-down-person mock seed can never reach on its own.
const hoisted = vi.hoisted(() => ({ flattenTrends: false, empty: false }))
vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return {
    ...actual,
    usePeople: () => {
      const real = actual.usePeople()
      if (hoisted.empty) return { ...real, people: [], mentions: [] }
      if (!hoisted.flattenTrends) return real
      return { ...real, people: real.people.map((p) => ({ ...p, affectTrend: [3, 3, 3, 3] })) }
    },
  }
})

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  mockNavigate.mockReset()
  hoisted.flattenTrends = false
  hoisted.empty = false
})

const renderPage = () =>
  render(
    <MemoryRouter>
      <PeoplePage />
    </MemoryRouter>,
    { wrapper: QueryWrapper },
  )

test('hero: Kapcsolatok + active-people bignum + the derived week-mention subline', () => {
  const { container } = renderPage()
  expect(screen.getByText('Kapcsolatok')).toBeInTheDocument()
  expect(container.querySelector('.mz-bignum')?.textContent).toBe('5')
  expect(screen.getByText('aktív kör · 9 említés e héten')).toBeInTheDocument()
})

test('statstrip: 3 cells — mentions·week, top name, down name (or em dash)', () => {
  const { container } = renderPage()
  const cells = container.querySelectorAll('.mz-statcell')
  expect(cells).toHaveLength(3)
  expect(cells[0].querySelector('b')?.textContent).toBe('9')
  expect(cells[0].querySelector('small')?.textContent).toBe('említés · hét')
  expect(cells[1].querySelector('b')?.textContent).toBe('Petra')
  expect(cells[1].querySelector('small')?.textContent).toBe('legtöbbet említett')
  expect(cells[2].querySelector('b')?.textContent).toBe('Réka ↘')
  expect(cells[2].querySelector('small')?.textContent).toBe('hangulat-lejtő')
})

test('CONTRACT: the down-cell reads em dash — never a fabricated name — when nobody trends down', () => {
  hoisted.flattenTrends = true
  const { container } = renderPage()
  const cells = container.querySelectorAll('.mz-statcell')
  expect(cells[2].querySelector('b')?.textContent).toBe('—')
  // With nobody trending down, the Mezo-band falls back to the top-name sentence.
  expect(screen.getByText(/Petra volt e héten a legtöbbet veled/)).toBeInTheDocument()
})

test('the empty-circle Mezo-band sentence renders when there is no data at all', () => {
  hoisted.empty = true
  renderPage()
  expect(screen.getByText(/Ahogy írsz, magától épül itt a kapcsolati kép\./)).toBeInTheDocument()
})

test('four hub tiles render and each navigates to its own sibling route on click', () => {
  renderPage()

  fireEvent.click(screen.getByRole('button', { name: 'Jelöltek' }))
  expect(mockNavigate).toHaveBeenCalledWith('/me/people/jeloltek')

  fireEvent.click(screen.getByRole('button', { name: 'A köröm' }))
  expect(mockNavigate).toHaveBeenCalledWith('/me/people/kor')

  fireEvent.click(screen.getByRole('button', { name: 'Említések' }))
  expect(mockNavigate).toHaveBeenCalledWith('/me/people/emlitesek')

  fireEvent.click(screen.getByRole('button', { name: 'Heti kép' }))
  expect(mockNavigate).toHaveBeenCalledWith('/me/people/heti')
})

test('Jelöltek carries no badge in S3 (no candidate source wired yet)', () => {
  renderPage()
  const tile = screen.getByRole('button', { name: 'Jelöltek' })
  expect(tile.querySelector('.ppl-hub-badge')).toBeNull()
})

test('A köröm shows a facepile of the first four people\'s initials', () => {
  renderPage()
  const tile = screen.getByRole('button', { name: 'A köröm' })
  const initials = [...tile.querySelectorAll('.ppl-fp-avat')].map((n) => n.textContent)
  expect(initials).toEqual(['P', 'B', 'Á', 'R'])
})

test('Említések carries the flagCount badge when > 0', () => {
  renderPage()
  const tile = screen.getByRole('button', { name: 'Említések' })
  expect(tile.querySelector('.ppl-hub-badge')?.textContent).toBe('2')
})

test('Mezo-sáv renders the derived sentence and hands off to a person-anchored conversation', () => {
  renderPage()
  // Réka is trending down this week ⇒ the down-branch sentence wins.
  expect(screen.getByText(/Réka hangulata lejt az utóbbi hetekben/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /Mezo · észrevétel/ }))
  expect(mockNavigate).toHaveBeenCalledWith(expect.stringMatching(/^\/mezo\/chat\?c=/))
})

test('the filter row and mention feed are gone from the hub (owned by the sibling pages now)', () => {
  const { container } = renderPage()
  expect(container.querySelector('.ppl-chiprow')).toBeNull()
  expect(container.querySelector('.ppl-mrowt')).toBeNull()
  expect(container.querySelector('.ppl-grid')).toBeNull()
})

test('header actions still open Log and Új személy (the existing PeoplePage sheets)', () => {
  renderPage()
  expect(screen.getByText('＋ Új személy')).toBeInTheDocument()
  fireEvent.click(screen.getByText(/Log/))
  expect(screen.getByText('Mit jegyzünk meg?')).toBeInTheDocument()
})

describe('Jelöltek route', () => {
  test('the empty state renders the honest copy', () => {
    render(
      <MemoryRouter initialEntries={['/me/people/jeloltek']}>
        <Routes>
          <Route path="/me/people" element={<PeoplePage />} />
          <Route path="/me/people/jeloltek" element={<PeopleJeloltekPage />} />
        </Routes>
      </MemoryRouter>,
      { wrapper: QueryWrapper },
    )
    expect(screen.getByText('Nincs több jelölt — az éjszakai kör hajnalban néz újra.')).toBeInTheDocument()
    expect(screen.getByText('‹ Kapcsolatok')).toBeInTheDocument()
  })
})
