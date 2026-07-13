import { render, screen } from '@testing-library/react'
import { DayArc } from '@/features/today/components/DayArc'
import type { CheckinSlot } from '@/data/types'

const slot = (time: string, state: CheckinSlot['state']): CheckinSlot =>
  ({ time, state, values: null, note: '' }) as unknown as CheckinSlot

const CHECKINS = [slot('06:30', 'done'), slot('10:00', 'done'), slot('14:00', 'now'), slot('20:00', 'pending')]

test('renders the arc with one dot per point plus the sun marker', () => {
  const { container } = render(
    <DayArc checkins={CHECKINS} workoutTime="17:00" now={new Date('2026-07-13T14:00:00')} />,
  )
  expect(screen.getByRole('img', { name: 'A napod íve' })).toBeInTheDocument()
  expect(container.querySelectorAll('.arc-dot')).toHaveLength(6)
  expect(container.querySelectorAll('.arc-sun')).toHaveLength(1)
  expect(container.querySelector('.arc-checkin-done')).not.toBeNull()
  expect(container.querySelector('.arc-workout')).not.toBeNull()
})

test('labels every point and no workout point on rest days', () => {
  const { container } = render(
    <DayArc checkins={CHECKINS} workoutTime={null} now={new Date('2026-07-13T09:00:00')} />,
  )
  expect(screen.getByText('06:30')).toBeInTheDocument()
  expect(screen.getByText('23:00')).toBeInTheDocument()
  expect(container.querySelector('.arc-workout')).toBeNull()
})
