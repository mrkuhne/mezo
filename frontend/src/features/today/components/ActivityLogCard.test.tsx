import { render, screen, fireEvent } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { ActivityLogCard } from '@/features/today/components/ActivityLogCard'
import { LevelUpProvider } from '@/features/progression/LevelUpProvider'
import { makeHookWrapper } from '@/test/queryWrapper'
import type { ActivityEntry } from '@/data/types'

const acts = vi.hoisted(() => ({ useActivities: vi.fn() }))
vi.mock('@/data/hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/data/hooks')>()),
  useActivities: acts.useActivities,
}))

const seed: ActivityEntry[] = [
  { id: 'act1', occurredOn: '2026-07-11', text: 'Olvastam 30 percet', skillKey: 'learning', confidence: 0.92, xpAwarded: 18, durationMin: 30, amountHuf: null, categorizedBy: 'AI' },
  { id: 'act2', occurredOn: '2026-07-11', text: 'Átraktam 50 ezret megtakarításba', skillKey: 'financial', confidence: 0.88, xpAwarded: 15, durationMin: null, amountHuf: 50000, categorizedBy: 'AI' },
  { id: 'act3', occurredOn: '2026-07-11', text: 'Rendet raktam a garázsban', skillKey: null, confidence: 0.4, xpAwarded: 0, durationMin: null, amountHuf: null, categorizedBy: null },
]

function renderCard() {
  const Wrapper = makeHookWrapper()
  return render(
    <Wrapper>
      <LevelUpProvider>
        <ActivityLogCard />
      </LevelUpProvider>
    </Wrapper>,
  )
}

describe('ActivityLogCard', () => {
  beforeEach(() => acts.useActivities.mockReturnValue({ data: seed, isPending: false }))
  afterEach(() => vi.clearAllMocks())

  test('renders the seed rows with XP chips', () => {
    renderCard()
    expect(screen.getByText('Tevékenységnapló')).toBeInTheDocument()
    expect(screen.getByText('Olvastam 30 percet')).toBeInTheDocument()
    expect(screen.getByText('+18 XP')).toBeInTheDocument()
    expect(screen.getByText('+15 XP')).toBeInTheDocument()
  })

  test('"Besorolás?" chip appears only on the uncategorized entry', () => {
    renderCard()
    expect(screen.getAllByRole('button', { name: 'Besorolás?' })).toHaveLength(1)
  })

  test('empty state prompts to log', () => {
    acts.useActivities.mockReturnValue({ data: [], isPending: false })
    renderCard()
    expect(screen.getByText('Mi történt ma? Jegyezd fel — az XP a tiéd.')).toBeInTheDocument()
  })

  test('"+ Bejegyzés" opens the log sheet', () => {
    renderCard()
    fireEvent.click(screen.getByRole('button', { name: '+ Bejegyzés' }))
    expect(screen.getByText('Mi történt ma?')).toBeInTheDocument()
  })
})
