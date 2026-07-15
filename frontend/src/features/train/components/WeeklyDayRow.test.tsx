import { render, screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import { WeeklyDayRow } from '@/features/train/components/WeeklyDayRow'

test('renders the morning run before the evening gym and shows the run time', () => {
  const { container } = render(<WeeklyDayRow
    agenda={{
      day: 'Kedd', isToday: false,
      gym: { day: 'Kedd', active: true, time: '18:30', duration: null, type: 'Plyo Power' } as never,
      sport: [],
      running: [{ key: 'tue-sprint', timeOfDay: '08:00', label: 'Sprint-intervallum', kind: 'sprint', rpeTarget: { min: 9, max: 10 } } as never],
    }}
    onStartGym={() => {}} onLogSport={() => {}} />)
  const buttons = screen.getAllByRole('button')
  // first session button is the 08:00 run, carrying the Napiv FUTÁS type tag
  expect(within(buttons[0]).getByText('Sprint-intervallum')).toBeInTheDocument()
  expect(within(buttons[0]).getByText(/08:00/)).toBeInTheDocument()
  expect(buttons[0].querySelector('.stag-run')).toHaveTextContent('FUTÁS')
  // second session button is the evening gym slot, carrying the GYM type tag
  expect(buttons[1].querySelector('.stag-gym')).toHaveTextContent('GYM')
  // a non-today day with content is a plain `.dayrow` — no `.today`/`.rest` modifier
  expect(container.querySelector('.dayrow')).toBeInTheDocument()
  expect(container.querySelector('.dayrow.today')).not.toBeInTheDocument()
  expect(container.querySelector('.dayrow.rest')).not.toBeInTheDocument()
})

test('a PAST gym day with a logged workout shows the done chip (no isToday needed)', () => {
  render(<WeeklyDayRow
    agenda={{
      day: 'Hét', date: '2026-06-15', isToday: false,
      gym: { day: 'Hét', active: true, time: '18:30', duration: null, type: 'Plyo Power' } as never,
      sport: [], running: [],
    }}
    gymLogged
    onStartGym={() => {}} onLogSport={() => {}} />)
  expect(screen.getByText('kész')).toBeInTheDocument()
})

test('today volleyball row shows the "log" chip, or the done chip once logged', () => {
  const agenda = {
    day: 'Hét', isToday: true,
    gym: null,
    sport: [{ day: 'Hét', time: '18:00', duration: 120, court: '', intensity: '', role: 'edzés' }],
    running: [],
  } as never
  const { container, rerender } = render(
    <WeeklyDayRow agenda={agenda} onStartGym={() => {}} onLogSport={() => {}} />,
  )
  // not logged -> the "log" chip; the row is ringed `.dayrow.today` and the day label carries the MA marker
  expect(screen.getByText('log')).toBeInTheDocument()
  expect(screen.queryByText('kész')).not.toBeInTheDocument()
  expect(container.querySelector('.dayrow.today')).toBeInTheDocument()
  expect(container.querySelector('.d small')).toHaveTextContent('MA')
  expect(container.querySelector('.stag-sport')).toHaveTextContent('RÖPI')

  // logged today -> the done chip replaces it
  rerender(
    <WeeklyDayRow agenda={agenda} isSportLogged={() => true} onStartGym={() => {}} onLogSport={() => {}} />,
  )
  expect(screen.getByText('kész')).toBeInTheDocument()
  expect(screen.queryByText('log')).not.toBeInTheDocument()
})

test('an empty day renders a dashed rest row with the Pihenőnap copy', () => {
  const { container } = render(
    <WeeklyDayRow
      agenda={{ day: 'Szo', isToday: false, gym: null, sport: [], running: [] }}
      onStartGym={() => {}} onLogSport={() => {}}
    />,
  )
  expect(screen.getByText('Pihenőnap')).toBeInTheDocument()
  expect(container.querySelector('.dayrow.rest')).toBeInTheDocument()
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})
