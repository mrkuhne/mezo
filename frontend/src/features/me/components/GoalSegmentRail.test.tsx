import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { GoalSegmentRail } from '@/features/me/components/GoalSegmentRail'

test('shows the current and next segment on a single rail', () => {
  render(<GoalSegmentRail label="MAV" fromWeek={3} toWeek={5} nextLabel="Deload" nextFromWeek={6} nextChangeDate="2026-09-14" />)
  expect(screen.getByText('MAV')).toBeInTheDocument()
  expect(screen.getByText('W3–5')).toBeInTheDocument()
  expect(screen.getByText('Deload')).toBeInTheDocument()
  expect(screen.getByText(/Szep/)).toBeInTheDocument()
})

test('states when there is no next segment', () => {
  render(<GoalSegmentRail label="Alapozó" fromWeek={1} toWeek={8} />)
  expect(screen.getByText('Nincs következő szakasz')).toBeInTheDocument()
})
