import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { GrowthTodayRow } from '@/features/today/components/GrowthTodayRow'
import { mockQuestDay } from '@/data/quest/questMock'
import { mockActivities } from '@/data/activity/activityMock'

const hooks = vi.hoisted(() => ({
  useDailyQuests: vi.fn(),
  useActivities: vi.fn(),
}))
vi.mock('@/data/hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/data/hooks')>()),
  useDailyQuests: hooks.useDailyQuests,
  useActivities: hooks.useActivities,
}))

function renderRow() {
  return render(
    <MemoryRouter>
      <GrowthTodayRow />
    </MemoryRouter>,
  )
}

afterEach(() => vi.clearAllMocks())

describe('GrowthTodayRow', () => {
  // Mock seed: mockQuestDay has 3 quests, 1 completed (dq2, +15 XP). mockActivities
  // carries 3 entries with xpAwarded 18 + 15 + 0 = 33. Total xp = 15 + 33 = 48.
  beforeEach(() => {
    hooks.useDailyQuests.mockReturnValue({ quests: mockQuestDay, levelUps: [], rerollsLeft: 1, mode: 'mock' })
    hooks.useActivities.mockReturnValue({ data: mockActivities, isPending: false })
  })

  test('renders the Growth teaser row with the derived done/total + xp from the mock seed', () => {
    renderRow()
    expect(screen.getByText('Növekedés ma')).toBeInTheDocument()
    expect(screen.getByText('1/3 küldetés · +48 XP')).toBeInTheDocument()
  })

  test('links to /me/growth', () => {
    renderRow()
    expect(screen.getByRole('link')).toHaveAttribute('href', '/me/growth')
  })

  test('renders null when both quests and activities are empty (real-mode ghost)', () => {
    hooks.useDailyQuests.mockReturnValue({ quests: [], levelUps: [], rerollsLeft: 0, mode: 'live' })
    hooks.useActivities.mockReturnValue({ data: [], isPending: false })
    const { container } = renderRow()
    expect(container.firstChild).toBeNull()
  })

  test('renders when only quests are present (activities empty)', () => {
    hooks.useDailyQuests.mockReturnValue({ quests: mockQuestDay, levelUps: [], rerollsLeft: 1, mode: 'mock' })
    hooks.useActivities.mockReturnValue({ data: [], isPending: false })
    renderRow()
    expect(screen.getByText('1/3 küldetés · +15 XP')).toBeInTheDocument()
  })

  test('renders when only activities are present (quests empty)', () => {
    hooks.useDailyQuests.mockReturnValue({ quests: [], levelUps: [], rerollsLeft: 0, mode: 'live' })
    hooks.useActivities.mockReturnValue({ data: mockActivities, isPending: false })
    renderRow()
    expect(screen.getByText('0/0 küldetés · +33 XP')).toBeInTheDocument()
  })
})
