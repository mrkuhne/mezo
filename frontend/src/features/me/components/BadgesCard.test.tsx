import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { BadgesCard } from '@/features/me/components/BadgesCard'
import { achievementsMock } from '@/data/progression/achievementsMock'

const badges = achievementsMock.badges

test('renders all 9 badges with the megszerezve header from the mock (4 achieved)', () => {
  const { container } = render(<BadgesCard badges={badges} />)
  expect(screen.getByText('Badge-ek')).toBeInTheDocument()
  expect(screen.getByText('4 / 9 megszerezve')).toBeInTheDocument()
  const grid = container.querySelector('[style*="grid-template-columns"]') as HTMLElement
  expect(grid.children).toHaveLength(9)
})

test('achieved badges show ✓ and no progress current/target', () => {
  render(<BadgesCard badges={badges} />)
  // 4 achieved badges → 4 checkmarks.
  expect(screen.getAllByText('✓')).toHaveLength(4)
  // first_quest is achieved (current 23, target 1) → its current/target must NOT render.
  expect(screen.queryByText('23 / 1')).not.toBeInTheDocument()
})

test('unachieved badges show the formatted current / target progress', () => {
  render(<BadgesCard badges={badges} />)
  expect(screen.getByText('23 / 50')).toBeInTheDocument() // quests_50
  expect(screen.getByText('1085 / 10 000')).toBeInTheDocument() // life_xp_10k (4-digit hu-HU ungrouped)
  expect(screen.getByText('50 000 / 100 000')).toBeInTheDocument() // savings_100k
})
