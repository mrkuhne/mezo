import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GoalTimeline } from './GoalTimeline'
import type { GoalTimelineResponse } from '@/lib/goalLinkApi'

const timeline: GoalTimelineResponse = {
  goalId: 'goal-1',
  weeks: 8,
  links: [
    {
      id: 'link-meso-1',
      planType: 'mesocycle',
      planId: 'meso-1',
      startWeek: 1,
      endWeek: 6,
      plan: { title: 'Nyári erő-tartó', status: 'active', startDate: '2026-06-01', endDate: '2026-07-12', weeks: 6 },
    },
    {
      id: 'link-run-1',
      planType: 'running_block',
      planId: 'run-1',
      startWeek: 1,
      endWeek: 4,
      plan: { title: 'Intervallum', status: 'active', startDate: '2026-06-01', endDate: '2026-06-28', weeks: 4 },
    },
  ],
  gaps: [{ fromWeek: 7, toWeek: 8 }],
}

test('GoalTimeline renders the gym bar with its plan title', () => {
  render(<GoalTimeline timeline={timeline} />)
  expect(screen.getByText(/Nyári erő-tartó/)).toBeInTheDocument()
})

test('GoalTimeline renders the running bar with its plan title', () => {
  render(<GoalTimeline timeline={timeline} />)
  expect(screen.getByText(/Intervallum/)).toBeInTheDocument()
})

test('GoalTimeline renders a gap chip with "W7–8 fedezetlen" text', () => {
  render(<GoalTimeline timeline={timeline} />)
  expect(screen.getByText(/W7–8 fedezetlen/)).toBeInTheDocument()
})

test('GoalTimeline renders the ambient volleyball band', () => {
  render(<GoalTimeline timeline={timeline} />)
  expect(screen.getByText(/Röplabda/)).toBeInTheDocument()
})

test('GoalTimeline shows the ambient sessionsPerWeek when provided', () => {
  render(<GoalTimeline timeline={timeline} ambient={{ label: 'BVSC', sessionsPerWeek: 2 }} />)
  expect(screen.getByText(/2×\/hét/)).toBeInTheDocument()
})

test('GoalTimeline renders one ruler cell per week', () => {
  render(<GoalTimeline timeline={timeline} />)
  for (let w = 1; w <= timeline.weeks; w++) {
    expect(screen.getByTestId(`ruler-week-${w}`)).toBeInTheDocument()
  }
  expect(screen.queryByTestId(`ruler-week-${timeline.weeks + 1}`)).not.toBeInTheDocument()
})

test('GoalTimeline omits detach controls when onDetach is not provided', () => {
  render(<GoalTimeline timeline={timeline} />)
  expect(screen.queryByLabelText(/leválasztás/i)).not.toBeInTheDocument()
})

test('GoalTimeline calls onDetach with the link id when a bar detach control is clicked', async () => {
  const onDetach = vi.fn()
  render(<GoalTimeline timeline={timeline} onDetach={onDetach} />)
  const detachButtons = screen.getAllByLabelText(/leválasztás/i)
  expect(detachButtons).toHaveLength(2) // gym + run, NOT volleyball
  await userEvent.click(detachButtons[0])
  expect(onDetach).toHaveBeenCalledWith('link-meso-1')
})

test('GoalTimeline volleyball band has no detach control', () => {
  const onDetach = vi.fn()
  render(<GoalTimeline timeline={timeline} onDetach={onDetach} ambient={{ label: 'BVSC', sessionsPerWeek: 2 }} />)
  // only the 2 plan links get detach controls; the ambient band is read-only
  expect(screen.getAllByLabelText(/leválasztás/i)).toHaveLength(2)
})
