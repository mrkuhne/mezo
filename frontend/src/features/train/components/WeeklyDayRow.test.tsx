import { fireEvent, render, screen, within } from '@testing-library/react'
import { expect, it, test, vi } from 'vitest'
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

it('a done gym day is tappable and calls onReviewGym (not onStartGym)', () => {
  const onReviewGym = vi.fn()
  const onStartGym = vi.fn()
  render(
    <WeeklyDayRow
      agenda={{
        day: 'Hét', date: '2026-06-15', isToday: false,
        gym: { day: 'Hét', active: true, time: '18:30', duration: null, type: 'Plyo Power' } as never,
        sport: [], running: [],
      }}
      gymLogged
      onReviewGym={onReviewGym}
      onStartGym={onStartGym}
    />,
  )
  // the done (kész) gym row is now a tap target → opens the review, never the start flow
  expect(screen.getByText('kész')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button'))
  expect(onReviewGym).toHaveBeenCalledTimes(1)
  expect(onStartGym).not.toHaveBeenCalled()
})

it('shows the folyamatban chip when gymInProgress', () => {
  render(
    <WeeklyDayRow
      agenda={{
        day: 'Hét', isToday: true,
        gym: { day: 'Hét', active: true, time: '18:30', duration: null, type: 'Plyo Power' } as never,
        sport: [], running: [],
      }}
      gymInProgress
      onStartGym={() => {}}
    />,
  )
  expect(screen.getByText('folyamatban')).toBeInTheDocument()
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

test('the chevron affordance renders only on a day with content, never on a rest row', () => {
  const { container: withContent } = render(
    <WeeklyDayRow
      agenda={{
        day: 'Kedd', isToday: false,
        gym: { day: 'Kedd', active: true, time: '18:30', duration: null, type: 'Plyo Power' } as never,
        sport: [], running: [],
      }}
      onStartGym={() => {}} onLogSport={() => {}}
    />,
  )
  expect(withContent.querySelector('.chev')).toBeInTheDocument()

  const { container: rest } = render(
    <WeeklyDayRow
      agenda={{ day: 'Szo', isToday: false, gym: null, sport: [], running: [] }}
      onStartGym={() => {}} onLogSport={() => {}}
    />,
  )
  expect(rest.querySelector('.chev')).not.toBeInTheDocument()
})

it('a non-today, not-done gym row is tappable and calls onOpenGymDay (mezo-j3x0)', () => {
  const onOpenGymDay = vi.fn()
  const onStartGym = vi.fn()
  const onReviewGym = vi.fn()
  render(
    <WeeklyDayRow
      agenda={{
        day: 'Szo', date: '2026-06-20', isToday: false,
        gym: { day: 'Szo', active: true, time: '10:00', duration: null, type: 'Pull Day' } as never,
        sport: [], running: [],
      }}
      onOpenGymDay={onOpenGymDay}
      onStartGym={onStartGym}
      onReviewGym={onReviewGym}
    />,
  )
  fireEvent.click(screen.getByRole('button'))
  expect(onOpenGymDay).toHaveBeenCalledTimes(1)
  expect(onStartGym).not.toHaveBeenCalled()
  expect(onReviewGym).not.toHaveBeenCalled()
})

it('renders a completed custom (saját) workout row and opens its review (mezo-ws2x)', () => {
  const onReviewCustom = vi.fn()
  const { container } = render(
    <WeeklyDayRow
      agenda={{ day: 'Szo', isToday: false, gym: null, sport: [], running: [], custom: [{ id: 'w9', title: 'Pihenőnapi felső' }] }}
      onStartGym={() => {}}
      onReviewCustom={onReviewCustom}
    />,
  )
  expect(screen.getByText('SAJÁT')).toBeInTheDocument()
  expect(screen.getByText('Pihenőnapi felső')).toBeInTheDocument()
  expect(screen.getByText('kész')).toBeInTheDocument()
  // a day with only a custom session is NOT a rest row
  expect(container.querySelector('.dayrow.rest')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button'))
  expect(onReviewCustom).toHaveBeenCalledWith('w9')
})
