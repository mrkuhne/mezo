import { render, screen, fireEvent } from '@testing-library/react'
import { beforeEach, afterEach, describe, expect, test, vi } from 'vitest'
import { DailyQuestsCard } from '@/features/today/components/DailyQuestsCard'
import { LevelUpProvider } from '@/features/progression/LevelUpProvider'
import { makeHookWrapper } from '@/test/queryWrapper'

const quests = vi.hoisted(() => ({
  useDailyQuests: vi.fn(),
  useQuestActions: vi.fn(),
}))
vi.mock('@/data/hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/data/hooks')>()),
  useDailyQuests: quests.useDailyQuests,
  useQuestActions: quests.useQuestActions,
}))

const offered = {
  id: 'q1', questDate: '2026-07-11', slot: 'BODY', skillKey: 'strength_endurance',
  title: 'A mai tervezett edzés a naptárban van — csináld végig',
  why: 'A megjelenés a legerősebb identitás-szavazat.', targetLabel: 'Mai tervezett edzés teljesítve',
  xp: 25, status: 'offered' as const,
}
const completed = {
  id: 'q2', questDate: '2026-07-11', slot: 'FUELBIO', skillKey: 'recovery',
  title: 'Reggeli súlymérés — logold be', why: 'Egy pont zaj, a sorozat trend.',
  targetLabel: 'Reggeli súly beloggolva', xp: 15, status: 'completed' as const,
}

function renderCard() {
  const Wrapper = makeHookWrapper()
  return render(
    <Wrapper>
      <LevelUpProvider>
        <DailyQuestsCard />
      </LevelUpProvider>
    </Wrapper>,
  )
}

describe('DailyQuestsCard', () => {
  const reroll = vi.fn()
  beforeEach(() => {
    quests.useDailyQuests.mockReturnValue({
      quests: [offered, completed], levelUps: [], rerollsLeft: 1, mode: 'mock',
    })
    quests.useQuestActions.mockReturnValue({ reroll, pending: false })
  })
  afterEach(() => vi.clearAllMocks())

  test('renders both quests with XP chips and completed state', () => {
    renderCard()
    expect(screen.getByText('Napi küldetések')).toBeInTheDocument()
    expect(screen.getByText(offered.title)).toBeInTheDocument()
    expect(screen.getByText(completed.title)).toBeInTheDocument()
    expect(screen.getByText('+25 XP')).toBeInTheDocument()
    expect(screen.getByText('1/2 ma')).toBeInTheDocument()
  })

  test('reroll button fires the action for offered quests only', () => {
    renderCard()
    const buttons = screen.getAllByRole('button', { name: 'Csere' })
    expect(buttons).toHaveLength(1) // completed quest has no reroll
    fireEvent.click(buttons[0])
    expect(reroll).toHaveBeenCalledWith('q1')
  })

  test('renders nothing when the day is empty', () => {
    quests.useDailyQuests.mockReturnValue({ quests: [], levelUps: [], rerollsLeft: 1, mode: 'live' })
    const { container } = renderCard()
    expect(container.firstChild).toBeNull()
  })
})
