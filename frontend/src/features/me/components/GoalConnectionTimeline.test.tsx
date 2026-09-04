import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import type { GoalOverviewResponse } from '@/data/me/goalApi'
import { GoalConnectionTimeline } from '@/features/me/components/GoalConnectionTimeline'

const plans = {
  links: [
    { id: 'm1', planType: 'mesocycle' as const, planId: 'p1', startWeek: 2, endWeek: 5, plan: { title: 'Erőblokk', status: 'active', startDate: '2026-09-01', endDate: '2026-09-28', weeks: 4 } },
    { id: 'r1', planType: 'running_block' as const, planId: 'p2', startWeek: 4, endWeek: 7, plan: { title: '5K alap', status: 'planned', startDate: '2026-09-15', endDate: '2026-10-12', weeks: 4 } },
  ],
  gaps: [{ fromWeek: 1, toWeek: 1 }],
  sportSchedule: [{ id: 's1', dayOfWeek: 2, time: '19:00', durationMin: 75, kind: 'training', location: 'Városi csarnok', sport: 'handball' }],
  activeLinkCount: 2,
  uncoveredWeekCount: 1,
  topIssueCode: 'mesocycle_gap',
} satisfies GoalOverviewResponse['plans']

test('renders separate plan lanes, actual sport schedule and gaps from server data', () => {
  render(<GoalConnectionTimeline plans={plans} totalWeeks={8} />)
  expect(screen.getByText('Mesociklus')).toBeInTheDocument()
  expect(screen.getByText('Futóblokk')).toBeInTheDocument()
  expect(screen.getByText('Erőblokk')).toBeInTheDocument()
  expect(screen.getByText('5K alap')).toBeInTheDocument()
  expect(screen.getByText(/Városi csarnok/)).toBeInTheDocument()
  expect(screen.getByText(/Kézilabda/)).toBeInTheDocument()
  expect(screen.getByText(/Kedd/)).toBeInTheDocument()
  expect(screen.getByText(/75 perc/)).toBeInTheDocument()
  expect(screen.getByText('W1 fedezetlen')).toBeInTheDocument()
  expect(screen.queryByText(/BVSC|végig/i)).not.toBeInTheDocument()
})

test('detaches only the selected server link', async () => {
  const onDetach = vi.fn()
  render(<GoalConnectionTimeline plans={plans} totalWeeks={8} onDetach={onDetach} />)
  await userEvent.click(screen.getByRole('button', { name: 'Erőblokk leválasztása' }))
  expect(onDetach).toHaveBeenCalledWith('m1')
})
