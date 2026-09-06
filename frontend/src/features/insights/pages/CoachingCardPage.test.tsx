import { render, screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { QueryWrapper } from '@/test/queryWrapper'
import { API_BASE } from '@/test/msw/handlers'
import { server } from '@/test/msw/server'
import { CoachingCardPage } from '@/features/insights/pages/CoachingCardPage'
import { localDateString } from '@/shared/lib/dates'

const renderPage = () =>
  render(<MemoryRouter><CoachingCardPage /></MemoryRouter>, { wrapper: QueryWrapper })

describe('CoachingCardPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('shows the card with its facts and suggestions', () => {
    const { container } = renderPage()
    // The winner's label ("Terhelés–táplálás") appears twice on the page — once as the
    // PageHero subtitle, once as the card's own eyebrow — so this scopes to the card itself
    // (`.propcard`) rather than weakening either piece of copy to dodge the ambiguity.
    const cardEl = container.querySelector('.propcard') as HTMLElement
    expect(within(cardEl).getByText('Terhelés–táplálás')).toBeInTheDocument()
    expect(screen.getByText(/7 napos terhelés 412 perc/)).toBeInTheDocument()
    expect(screen.getByText('Egy plusz szénhidrátos fogás ebédre.')).toBeInTheDocument()
  })

  test('„Miért ez nyert" ranks the beaten candidates — this exists nowhere else in the app', () => {
    renderPage()
    expect(screen.getByText('Miért ez nyert')).toBeInTheDocument()
    expect(screen.getByText('Alvásadósság')).toBeInTheDocument()
    expect(screen.getByText('rang 6')).toBeInTheDocument()
  })

  test('the action button is the existing advice path, not a parallel one', () => {
    renderPage()
    expect(screen.getByRole('button', { name: 'Könnyítsd a holnapot' })).toBeInTheDocument()
  })
})

describe('CoachingCardPage (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('an unresolved fetch shows neither a card nor a fabricated absence', () => {
    const { container } = renderPage()
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
    expect(screen.queryByText('Ma nem érkezett kártya.')).not.toBeInTheDocument()
  })

  test('no card today says exactly that, rather than inventing one', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Ma nem érkezett kártya.')).toBeInTheDocument())
  })

  test('no card today means the hero names no rule either, even if the trace has a winner', async () => {
    const date = localDateString()
    // The feed genuinely has no card, but the trace still names a winner (as it would once the
    // day's decision has run but before the card itself is delivered) — the hero must not borrow
    // that winner's name for a card that is not there.
    server.use(
      http.get(`${API_BASE}/api/proactive/feed`, () => HttpResponse.json([])),
      http.get(`${API_BASE}/api/companion/flags/trace`, () => HttpResponse.json({
        date, winner: { flagKey: 'sleep_debt', rank: 1, cardId: 'trace-card-only' },
        rules: [{
          flagKey: 'sleep_debt', label: 'Alvásadósság', domain: 'sleep', rank: 1,
          outcome: 'raised', disposition: 'logged', cardOutcome: 'won',
          reasonText: 'Alvásadósság magas.', facts: [],
        }],
        transitions: [],
      })),
    )
    const { container } = renderPage()
    await waitFor(() => expect(screen.getByText('Ma nem érkezett kártya.')).toBeInTheDocument())
    expect(container.querySelector('.mz-hero-sb')).toBeNull()
    expect(screen.queryByText('Alvásadósság')).not.toBeInTheDocument()
  })

  test('a card and a trace winner from different decisions never share a screen', async () => {
    const date = localDateString()
    // Two independent queries, deliberately made to disagree: the feed's card is `feed-card-x`,
    // but the trace's winner points at `trace-card-y` — as if a decision re-ran between the two
    // fetches. The trace still carries a `lost` rule, so there IS a loser list to suppress.
    server.use(
      http.get(`${API_BASE}/api/proactive/feed`, () => HttpResponse.json([{
        id: 'feed-card-x', date, kind: 'advice', eyebrow: 'Terhelés–táplálás',
        body: ['Egy plusz szénhidrátos fogás ebédre.'], refs: [], flagKey: 'load_fuel_mismatch',
        generatedAt: `${date}T08:00:00Z`,
      }])),
      http.get(`${API_BASE}/api/companion/flags/trace`, () => HttpResponse.json({
        date, winner: { flagKey: 'load_fuel_mismatch', rank: 2, cardId: 'trace-card-y' },
        rules: [
          { flagKey: 'load_fuel_mismatch', label: 'Terhelés–táplálás', domain: 'nutrition', rank: 2,
            outcome: 'raised', disposition: 'logged', cardOutcome: 'won',
            reasonText: '7 napos terhelés magas.', facts: [] },
          { flagKey: 'sleep_debt', label: 'Alvásadósság', domain: 'sleep', rank: 6,
            outcome: 'raised', disposition: 'logged', cardOutcome: 'lost',
            reasonText: 'Alvásadósság magas.', facts: [] },
        ],
        transitions: [],
      })),
    )
    const { container } = renderPage()
    // The card's own eyebrow ("Terhelés–táplálás") comes from the FEED, so it still renders —
    // but the hero subtitle is trace-winner-derived and the two disagree on cardId, so the hero
    // must stay quiet rather than also naming "Terhelés–táplálás" (which here would happen to
    // read the same string as the card, for the wrong reason).
    await waitFor(() =>
      expect(within(container.querySelector('.propcard') as HTMLElement)
        .getByText('Terhelés–táplálás')).toBeInTheDocument())
    expect(container.querySelector('.mz-hero-sb')).toBeNull()
    expect(screen.queryByText('Miért ez nyert')).not.toBeInTheDocument()
    expect(screen.queryByText('Alvásadósság')).not.toBeInTheDocument()
  })
})
