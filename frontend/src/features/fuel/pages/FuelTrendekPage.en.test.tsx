// Fuel · Trendek in English (Folyadék F5, mezo-n4wf5.5): the page, the day sheet and the longer-term card, verbatim from the
// approved prototype's `L(hu, en)` pairs (docs/design_2.0/prototypes/vilagos/fuel.js `trendek()` / `sheetsB.day`). Mock mode,
// so no fetch. The clock is a fixed Friday noon (only `Date` is faked): Thursday of the mock week is an unlogged past day,
// Sunday is a day still ahead.
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setLang } from '@/shared/i18n'
import { QueryWrapper } from '@/test/queryWrapper'
import { FuelTrendekPage } from '@/features/fuel/pages/FuelTrendekPage'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 9, 9, 12, 0, 0) })
  vi.stubEnv('VITE_USE_MOCK', 'true')
  setLang('en', { persist: false })
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); setLang('hu', { persist: false }) })

const mount = (path = '/fuel/trendek') => render(
  <QueryWrapper>
    <MemoryRouter initialEntries={[path]}>
      <Routes><Route path="/fuel/trendek" element={<FuelTrendekPage />} /><Route path="*" element={null} /></Routes>
    </MemoryRouter>
  </QueryWrapper>,
)

describe('Fuel · Trends in English', () => {
  it('the week navigator, the hero, the four sections', () => {
    const { container } = mount()
    expect(screen.getByRole('button', { name: /Last week/ })).toBeEnabled()
    expect(screen.getByRole('button', { name: /This week/ })).toBeDisabled()
    expect(screen.getByText('5–11 Oct')).toBeInTheDocument()
    const hero = container.querySelector('.fr-hero')!
    expect(hero).toHaveTextContent('5 of 7 days logged · the week’s picture')
    expect(hero).toHaveTextContent('The number is the day’s meal score. Tap a vessel for details.')
    expect(screen.getByRole('group', { name: 'The seven days of the week against their budget' })).toBeInTheDocument()
    expect([...container.querySelectorAll('.fr-wd > b')].map((n) => n.textContent)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
    expect(container.querySelector('.fr-lg')).toHaveTextContent('what you atethe day’s budgetover budgetno dataweekendtraining day')
    expect(screen.getByRole('heading', { name: /The week in numbers/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Weekdays and weekend/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Longer term · 7 weeks/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Patterns · \d/ })).toBeInTheDocument()
    expect(screen.getByText('Patterns live in Mezo. A tap takes you there; this is not a copy.')).toBeInTheDocument()
  })

  it('the tiles: names, decimal point, the change from last week as direction and amount', () => {
    const { container } = mount()
    expect(container.querySelector('.fr-t3 .is-avg')).toHaveTextContent(/^Daily average[\d,]+kcal[\d,]+ kcal (more|less)$/)
    expect(container.querySelector('.fr-t3 .is-score')).toHaveTextContent('Meal quality7.8/ 100.7 more')
    expect(container.querySelector('.fr-t3 .is-weight')).toHaveTextContent('Weekly weight81.3kg0.6 kg less')
    expect(screen.getByText('The bottom line on each tile is the change from last week: direction and amount, not a verdict.')).toBeInTheDocument()
  })

  it('weekdays and weekend, the longer term', () => {
    const { container } = mount()
    expect(container.querySelector('.fr-linked')).toHaveTextContent(/Weekdays · \d+%Weekend · \d+%budget/)
    expect(screen.getByText(/^The gap is/)).toHaveTextContent(/The gap is \d+ percentage points, towards (the weekend|weekdays)\./)
    expect(screen.getByRole('heading', { name: 'Weekly weight average' })).toBeInTheDocument()
    expect(screen.getByText('Weekly average kcal')).toBeInTheDocument()
    expect(screen.getByText('weekly weight average')).toBeInTheDocument()
    expect(screen.getAllByText(/^goal · \d+\.\d kg$/)).toHaveLength(2)
    expect(screen.getByText(/Neither causes the other; they just move together\./)).toBeInTheDocument()
  })

  it('a day still ahead: its vessel and its sheet say so, with no backfill row', async () => {
    mount()
    await userEvent.click(screen.getByRole('button', { name: 'Sunday, 11 October: still ahead' }))
    const box = screen.getByRole('dialog')
    expect(within(box).getByRole('heading', { name: 'Sunday, 11 October' })).toBeInTheDocument()
    expect(within(box).getByText('still ahead')).toBeInTheDocument()
    expect(within(box).getByText('This day is still ahead.')).toBeInTheDocument()
    expect(within(box).queryByText('Fill in the day')).toBeNull()
    expect(box.textContent).not.toMatch(/You didn’t log|no data/)
    expect(within(box).getByRole('button', { name: 'Close' })).toBeInTheDocument()
  })

  it('an unlogged past day: the honest sentence and the backfill row', async () => {
    mount()
    await userEvent.click(screen.getByRole('button', { name: 'Thursday, 8 October: no data' }))
    const box = screen.getByRole('dialog')
    expect(within(box).getByText('No data for this day')).toBeInTheDocument()
    expect(within(box).getByText('You didn’t log on this day. We don’t fill it with a guess, and it stays out of the weekly average.')).toBeInTheDocument()
    expect(within(box).getByRole('button', { name: /Fill in the day/ })).toBeInTheDocument()
  })

  it('a logged day: the budget sentence, the two aspects, the facts, the meals (names stay as stored)', async () => {
    mount()
    await userEvent.click(screen.getByRole('button', { name: /^Tuesday, 6 October: 2,260 kcal of a 2,400 kcal budget, meal score \d\.\d$/ }))
    const box = screen.getByRole('dialog')
    expect(within(box).getByText('meal score')).toBeInTheDocument()
    expect(box).toHaveTextContent('Your budget that day was 2,400 kcal, adjusted for a training day. You stayed within it.')
    expect(within(box).getByText('Nutrition · 30% of the day’s rating')).toBeInTheDocument()
    expect(within(box).getByText('Quality · 15% of the day’s rating')).toBeInTheDocument()
    expect(within(box).getAllByRole('listitem').map((li) => li.querySelector('.l')!.textContent)).toEqual(['Calories', 'Protein', 'Carbs', 'Fat'])
    expect(within(box).getByText('The day’s meals')).toBeInTheDocument()
    expect(await within(box).findByText('Túrós zabkása · áfonyával')).toBeInTheDocument()
    expect(within(box).getByRole('button', { name: /Open the day/ })).toBeInTheDocument()
  })

  it('a day over budget is described, never judged', async () => {
    mount()
    await userEvent.click(screen.getByRole('button', { name: /^Saturday, 10 October/ }))
    expect(screen.getByRole('dialog')).toHaveTextContent(/It went [\d,]+ kcal over\./)
  })

  it('last week: the title bar reading and no change lines', () => {
    const { container } = mount('/fuel/trendek?w=elozo')
    expect(screen.getByText('28 Sep – 4 Oct')).toBeInTheDocument()
    expect(container.querySelector('.fr-t3 .fo-stat-s')).toBeNull()
    expect(screen.getByRole('button', { name: /Last week/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('the page text follows a language change at runtime, without a remount', () => {
    setLang('hu', { persist: false })
    const { container } = mount()
    const hero = container.querySelector('.fr-hero')!
    const weekend = container.querySelector('.fr-wd.we > b')!
    expect(hero).toHaveTextContent('5 / 7 naplózott nap · ebből áll a heti kép')
    expect(weekend).toHaveTextContent('Szo')
    expect(screen.getAllByText('Döntésre vár').length).toBeGreaterThan(0)
    act(() => setLang('en', { persist: false }))
    expect(hero).toHaveTextContent('5 of 7 days logged · the week’s picture')
    expect(weekend).toHaveTextContent('Sat')
    expect(screen.getAllByText('Awaiting your decision').length).toBeGreaterThan(0)
    expect(screen.queryByText('Döntésre vár')).toBeNull()
  })
})
