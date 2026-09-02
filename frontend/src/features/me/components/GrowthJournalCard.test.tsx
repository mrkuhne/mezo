import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { GrowthJournalCard } from '@/features/me/components/GrowthJournalCard'
import { buildGrowthJournal } from '@/features/me/logic/growthJournal'
import { mockQuestHistory } from '@/data/quest/questMock'
import { mockActivityHistory } from '@/data/activity/activityMock'

test('day headers carry label + XP; quest ✓ / activity ✎ / expired — rows with honest meta', () => {
  const days = buildGrowthJournal(mockQuestHistory, mockActivityHistory, '2026-07-12')
  const { container } = render(<div className="mz-play"><GrowthJournalCard days={days} /></div>)
  expect(container.querySelectorAll('.gr-day')).toHaveLength(days.length)
  expect(screen.getByText('Tegnap')).toBeInTheDocument()
  expect(screen.getByText(/csendben lejárt/)).toBeInTheDocument()
  expect(container.querySelector('.gr-jrow.gone')).not.toBeNull()
  expect(container.querySelectorAll('.gr-jrow.act')).toHaveLength(mockActivityHistory.length)
  expect(screen.getAllByText(/^\+\d+ XP$/).length).toBe(days.length)
})
test('empty: the quiet line', () => {
  render(<GrowthJournalCard days={[]} />)
  expect(screen.getByText('Még nincs bejegyzés — a teljesített küldetések és tevékenységek itt gyűlnek.')).toBeInTheDocument()
})
