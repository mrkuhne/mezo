import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, afterEach, describe, expect, test, vi } from 'vitest'
import { TodayQuestsCard } from '@/features/today/components/TodayQuestsCard'
import { LevelUpProvider } from '@/features/progression/LevelUpProvider'
import { makeHookWrapper } from '@/test/queryWrapper'
import type { DailyQuest } from '@/data/types'

const navigate = vi.hoisted(() => vi.fn())
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => navigate,
}))

const hooks = vi.hoisted(() => ({
  useDailyQuests: vi.fn(),
  useActivities: vi.fn(),
  useQuestActions: vi.fn(),
  useWaterActions: vi.fn(),
}))
vi.mock('@/data/hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/data/hooks')>()),
  useDailyQuests: hooks.useDailyQuests,
  useActivities: hooks.useActivities,
  useQuestActions: hooks.useQuestActions,
  useWaterActions: hooks.useWaterActions,
}))

const quest = (overrides: Partial<DailyQuest>): DailyQuest => ({
  id: 'q1', questDate: '2026-07-19', slot: 'FUELBIO', skillKey: 'recovery',
  title: 'Igyál meg legalább 2,5 litert ma', why: 'Hidratáció.', targetLabel: '≥ 2500 ml víz',
  metric: 'water_target', xp: 15, status: 'offered', completionMode: 'DERIVED',
  ...overrides,
})

const water = quest({})
const checkin = quest({ id: 'q2', metric: 'checkin_full', title: 'Mind a 4 check-in ma' })
const gym = quest({ id: 'q3', slot: 'BODY', metric: 'gym_session_done', title: 'Mai edzés — csináld végig' })
const activity = quest({
  id: 'q4', slot: 'GROWTH', metric: 'activity_match', completionMode: 'ACTIVITY',
  title: 'Olvass ma legalább 10 percet',
})
const completedWeight = quest({
  id: 'q5', metric: 'weight_logged', title: 'Reggeli súlymérés', status: 'completed', xp: 15,
})
const expired = quest({ id: 'q6', metric: 'sleep_target', title: 'Aludj 7,5 órát', status: 'expired' })

const logWater = vi.fn()
const consumeLevelUps = vi.fn()

function setDay(quests: DailyQuest[], levelUps: unknown[] = [], entries: unknown[] = []) {
  hooks.useDailyQuests.mockReturnValue({ quests, levelUps, rerollsLeft: 1, mode: 'mock' })
  hooks.useActivities.mockReturnValue({ data: entries })
}

function renderCard(onCheckIn?: () => void) {
  const Wrapper = makeHookWrapper()
  return render(
    <Wrapper>
      <LevelUpProvider>
        <MemoryRouter>
          <TodayQuestsCard onCheckIn={onCheckIn} />
        </MemoryRouter>
      </LevelUpProvider>
    </Wrapper>,
  )
}

describe('TodayQuestsCard', () => {
  beforeEach(() => {
    setDay([water, completedWeight, activity])
    hooks.useQuestActions.mockReturnValue({ reroll: vi.fn(), pending: false, consumeLevelUps })
    hooks.useWaterActions.mockReturnValue({ logWater })
  })
  afterEach(() => vi.clearAllMocks())

  test('header shows the eyebrow and a done/total + XP summary linking to /me/growth', () => {
    setDay([water, completedWeight, activity], [], [{ xpAwarded: 20 }])
    renderCard()
    expect(screen.getByText('⚡ Napi küldetések')).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /1\/3 · \+35 XP/ })
    expect(link).toHaveAttribute('href', '/me/growth')
  })

  test('water quest CTA logs +250 ml instantly', () => {
    renderCard()
    fireEvent.click(screen.getByRole('button', { name: '+250 ml' }))
    expect(logWater).toHaveBeenCalledWith(250)
  })

  test('checkin quest CTA opens the next open slot via the callback; hidden without one', () => {
    const onCheckIn = vi.fn()
    setDay([checkin])
    renderCard(onCheckIn)
    fireEvent.click(screen.getByRole('button', { name: 'Check-in' }))
    expect(onCheckIn).toHaveBeenCalledTimes(1)

    setDay([checkin])
    renderCard() // no callback → no CTA
    expect(screen.queryAllByRole('button', { name: 'Check-in' })).toHaveLength(1) // only the first render's
  })

  test('nav quest CTA navigates to the target surface', () => {
    setDay([gym])
    renderCard()
    fireEvent.click(screen.getByRole('button', { name: 'Edzés' }))
    expect(navigate).toHaveBeenCalledWith('/train')
  })

  test('ACTIVITY quest CTA opens the activity log sheet with the quest banner', () => {
    setDay([activity])
    renderCard()
    fireEvent.click(screen.getByRole('button', { name: 'Naplózz' }))
    expect(screen.getByText('Mi történt ma?')).toBeInTheDocument()
    expect(screen.getByText('+15 XP a teljesítésért')).toBeInTheDocument()
  })

  test('completed quest shows its XP chip and no CTA; expired is dimmed without a chip', () => {
    setDay([completedWeight, expired])
    renderCard()
    expect(screen.getByText('+15 XP')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mérés' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Alvás' })).not.toBeInTheDocument()
    expect(screen.getByText('Aludj 7,5 órát')).toBeInTheDocument()
  })

  test('renders nothing when the quest day is empty', () => {
    setDay([])
    const { container } = renderCard()
    expect(container.firstChild).toBeNull()
  })

  test('a level-up payload fires once and is consumed from the cache', () => {
    const payload = {
      source: 'QUEST', workoutLabel: completedWeight.title, durationMin: null, rpe: null,
      totalXp: 15, gains: [], levelUps: [], perks: [], robustness: { xpGained: 0, streakWeeks: 0 },
    }
    setDay([completedWeight], [payload])
    renderCard()
    expect(consumeLevelUps).toHaveBeenCalledTimes(1)
  })
})
