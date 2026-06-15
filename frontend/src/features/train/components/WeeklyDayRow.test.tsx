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
