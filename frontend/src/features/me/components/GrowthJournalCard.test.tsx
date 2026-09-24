import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { GrowthJournalCard } from '@/features/me/components/GrowthJournalCard'
import { buildGrowthJournal } from '@/features/me/logic/growthJournal'
import { mockQuestHistory } from '@/data/quest/questMock'
import { mockActivityHistory } from '@/data/activity/activityMock'
import type { DailyQuest } from '@/data/types'

test('day headers carry label + XP; quest t-tick / activity t-note / expired dot rows with honest meta', () => {
  const days = buildGrowthJournal(mockQuestHistory, mockActivityHistory, '2026-07-12')
  const { container } = render(<div className="mz-play"><GrowthJournalCard days={days} /></div>)
  expect(container.querySelectorAll('.gr-day')).toHaveLength(days.length)
  expect(screen.getByText('Tegnap')).toBeInTheDocument()
  expect(screen.getByText(/csendben lejárt/)).toBeInTheDocument()
  expect(container.querySelector('.gr-jrow.gone')).not.toBeNull()
  expect(container.querySelectorAll('.gr-jrow.act')).toHaveLength(mockActivityHistory.length)
  expect(screen.getAllByText(/^\+\d+ XP$/).length).toBe(days.length)
  // üveg (mezo-me75u.7): 3D icons instead of the ✓ / ✎ / — glyphs; the meta line names the kind
  const completed = days.flatMap((d) => d.entries).filter((e) => e.kind === 'quest' && e.quest.status === 'completed').length
  expect(container.querySelectorAll('.gr-jrow:not(.act):not(.gone) use[href="#t-tick"]')).toHaveLength(completed)
  expect(container.querySelectorAll('.gr-jrow.act > svg use[href="#t-note"]')).toHaveLength(mockActivityHistory.length)
  expect(container.querySelector('.gr-jrow.gone .gr-jdot')).not.toBeNull()
  expect(container.textContent).not.toMatch(/[✓✎]/u)
})
test('empty: the quiet line', () => {
  render(<GrowthJournalCard days={[]} />)
  expect(screen.getByText('Még nincs bejegyzés — a teljesített küldetések és tevékenységek itt gyűlnek.')).toBeInTheDocument()
})

test('completed ACTIVITY-mode quest shows "— tevékenységgel teljesült" and +xp, never .gone', () => {
  const quest: DailyQuest = { ...mockQuestHistory[0], id: 'qa', status: 'completed', completionMode: 'ACTIVITY', questDate: '2026-07-11', xp: 20 }
  const days = buildGrowthJournal([quest], [mockActivityHistory[0]], '2026-07-12')
  const { container } = render(<GrowthJournalCard days={days} />)
  const questRow = container.querySelector('.gr-jrow:not(.act)')
  expect(questRow).not.toBeNull()
  expect(questRow?.classList.contains('gone')).toBe(false)
  const meta = questRow?.querySelector('.gr-jmeta')?.textContent ?? ''
  expect(meta).toContain('— tevékenységgel teljesült')
  expect(meta).toContain('+20')
})
