import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { KnowledgeListView } from '@/features/insights/views/KnowledgeListView'

test('shows the fact count and the active-in-prompt count', () => {
  render(<KnowledgeListView />)
  expect(screen.getByText('Tudás · 15 fact')).toBeInTheDocument()
  // 14 of the 15 seeded facts start active (f9 is inactive)
  expect(screen.getByText('14 aktív promptban')).toBeInTheDocument()
  expect(screen.getByText('Caffeine cutoff: 14:00 hard limit')).toBeInTheDocument()
})

test('toggling a fact updates the active count', async () => {
  render(<KnowledgeListView />)
  const toggles = screen.getAllByRole('switch')
  await userEvent.click(toggles[0]) // f1 active → inactive
  expect(screen.getByText('13 aktív promptban')).toBeInTheDocument()
})
