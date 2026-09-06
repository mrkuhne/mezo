import { render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { QueryWrapper } from '@/test/queryWrapper'
import { CoachingCardPage } from '@/features/insights/pages/CoachingCardPage'

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
})
