import { render, screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import { WeeklyDayRow } from './WeeklyDayRow'

test('renders the morning run before the evening gym and shows the run time', () => {
  render(<WeeklyDayRow
    agenda={{
      day: 'Kedd', isToday: false,
      gym: { day: 'Kedd', active: true, time: '18:30', duration: null, type: 'Plyo Power' } as never,
      volleyball: null,
      running: [{ key: 'tue-sprint', timeOfDay: '08:00', label: 'Sprint-intervallum', kind: 'sprint', rpeTarget: { min: 9, max: 10 } } as never],
    }}
    onStartGym={() => {}} onLogVolleyball={() => {}} />)
  const buttons = screen.getAllByRole('button')
  // first session button is the 08:00 run
  expect(within(buttons[0]).getByText('Sprint-intervallum')).toBeInTheDocument()
  expect(within(buttons[0]).getByText(/08:00/)).toBeInTheDocument()
})

test('a PAST gym day with a logged workout shows the done chip (no isToday needed)', () => {
  render(<WeeklyDayRow
    agenda={{
      day: 'Hét', date: '2026-06-15', isToday: false,
      gym: { day: 'Hét', active: true, time: '18:30', duration: null, type: 'Plyo Power' } as never,
      volleyball: null, running: [],
    }}
    gymLogged
    onStartGym={() => {}} onLogVolleyball={() => {}} />)
  expect(screen.getByText('kész')).toBeInTheDocument()
})

test('today volleyball row shows the "log" chip, or the done chip once logged', () => {
  const agenda = {
    day: 'Hét', isToday: true,
    gym: null,
    volleyball: { day: 'Hét', time: '18:00', duration: 120, court: '', intensity: '', role: 'edzés' },
    running: [],
  } as never
  const { rerender } = render(
    <WeeklyDayRow agenda={agenda} onStartGym={() => {}} onLogVolleyball={() => {}} />,
  )
  // not logged -> the "log" chip
  expect(screen.getByText('log')).toBeInTheDocument()
  expect(screen.queryByText('kész')).not.toBeInTheDocument()

  // logged today -> the done chip replaces it
  rerender(
    <WeeklyDayRow agenda={agenda} vbLogged onStartGym={() => {}} onLogVolleyball={() => {}} />,
  )
  expect(screen.getByText('kész')).toBeInTheDocument()
  expect(screen.queryByText('log')).not.toBeInTheDocument()
})
