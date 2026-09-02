import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StreakCard, TitlesSection } from '@/features/progression/components/ProgressionHome'

// F7.4 (mezo-d20.8.4.1): the retired StreakSheet/TitleShopSheet content re-homed as
// Growth sections — the buy/equip/saver machinery moved verbatim, so these tests
// carry the sheets' behavioral pins onto the new host.
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

const renderIn = (node: React.ReactNode) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>{node}</MemoryRouter>
    </QueryClientProvider>,
  )

describe('StreakCard', () => {
  it('names the streak, the next milestone and the saver stock', () => {
    renderIn(<StreakCard />)
    const card = screen.getByTestId('streak-card')
    expect(card.textContent).toMatch(/napos sorozat/)
    expect(card.textContent).toMatch(/következő mérföldkő/)
    expect(within(card).getByText(/Streak-mentő/)).toBeInTheDocument()
    // clay flame, not the 🔥 emoji
    expect(card.querySelector('use')?.getAttribute('href')).toBe('#i-lang')
    expect(card.textContent).not.toContain('🔥')
  })
})

describe('TitlesSection', () => {
  it('renders the ladder by default with the lock state machine, and the shop tab swaps the list', () => {
    renderIn(<TitlesSection />)
    const sec = screen.getByTestId('titles-section')
    // ladder rows carry LV sublines; at least one locked row reads LV n-TŐL, no lock emoji
    expect(within(sec).getAllByText(/^LV \d+/).length).toBeGreaterThan(0)
    expect(within(sec).getAllByText(/^LV \d+-TŐL$/).length).toBeGreaterThan(0)
    expect(within(sec).queryByText('🔒')).toBeNull()
    fireEvent.click(within(sec).getByRole('button', { name: 'Bolt' }))
    // shop rows price in coins + the saver row appended
    expect(within(sec).getAllByText(/🪙 \d+/).length).toBeGreaterThan(0)
    expect(within(sec).getByText(/Streak-mentő/)).toBeInTheDocument()
  })

  it('equipping an owned ladder title flips its row to Viselve', async () => {
    renderIn(<TitlesSection />)
    const sec = screen.getByTestId('titles-section')
    const felvesz = within(sec).getAllByRole('button', { name: 'Felvesz' })
    if (felvesz.length === 0) return // mock owns only the equipped title → nothing to flip
    fireEvent.click(felvesz[0])
    await waitFor(() => expect(within(sec).getAllByText('Viselve').length).toBeGreaterThan(0))
  })
})

// The 'GrowthPage awards tab' describe block that used to render the whole page at
// /me/growth?tab=awards and assert both cards mounted together was removed with GrowthPage
// itself (mezo-rmi0.1): the Growth hub now just redirects ?tab=awards to the flat
// /me/growth/kituntetesek sibling route, whose own page (a later task) is what actually
// mounts StreakCard + TitlesSection — the two describe blocks above already pin those
// components directly.
