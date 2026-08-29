import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { BadgesCard } from '@/features/me/components/BadgesCard'
import { achievementsMock } from '@/data/progression/achievementsMock'

const badges = achievementsMock.badges

test('renders all 9 badges with the megszerezve header from the mock (4 achieved)', () => {
  const { container } = render(<BadgesCard badges={badges} />)
  expect(screen.getByText('Badge-ek')).toBeInTheDocument()
  expect(screen.getByText('4 / 9 megszerezve')).toBeInTheDocument()
  // Mozaik reface (mezo-d20.6.5): the 3-col grid is the .gr-bdggrid CSS class now.
  const grid = container.querySelector('.gr-bdggrid') as HTMLElement
  expect(grid.children).toHaveLength(9)
})

test('achieved badges show ✓ and no progress current/target', () => {
  render(<BadgesCard badges={badges} />)
  // 4 achieved badges → 4 checkmarks.
  expect(screen.getAllByText('✓')).toHaveLength(4)
  // first_quest is achieved (current 23, target 1) → its current/target must NOT render.
  expect(screen.queryByText('23 / 1')).not.toBeInTheDocument()
})

// Prototype `.bdg` (en-body #page-growth, GR.kit): emoji → name → count → bar.
// The first cut put the bar between the name and the count (mezo-d20.11).
test('an unearned badge stacks name → count → progress bar, in the prototype order', () => {
  const { container } = render(<BadgesCard badges={badges} />)
  const unearned = [...container.querySelectorAll('.gr-bdg')].find((t) => !t.classList.contains('done'))!
  const order = [...unearned.children].map((c) => c.className || c.tagName.toLowerCase())
  expect(order).toEqual(['gr-bdg-em', 'b', 'small', 'gr-bdg-bar'])
})

test('unachieved badges show the formatted current / target progress', () => {
  render(<BadgesCard badges={badges} />)
  expect(screen.getByText('23 / 50')).toBeInTheDocument() // quests_50
  expect(screen.getByText('1085 / 10 000')).toBeInTheDocument() // life_xp_10k (4-digit hu-HU ungrouped)
  expect(screen.getByText('50 000 / 100 000')).toBeInTheDocument() // savings_100k
})
