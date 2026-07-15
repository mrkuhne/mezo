import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SportScheduleSheet } from '@/features/train/sheets/SportScheduleSheet'
import type { VolleyballSession } from '@/data/types'

const initial: VolleyballSession[] = [
  { day: 'Hét', time: '18:15', duration: 90, court: 'BVSC csarnok', intensity: 'közepes', role: 'edzés' },
  { day: 'Szo', time: '10:00', duration: 120, court: 'Kőbánya Sport', intensity: 'magas', role: 'meccs/scrim' },
]

test('prefills slots from the current schedule and saves the slot list with sport', async () => {
  const onSave = vi.fn()
  const onClose = vi.fn()
  render(<SportScheduleSheet initial={initial} onSave={onSave} onClose={onClose} />)

  expect(screen.getByRole('heading', { name: 'Heti rend' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  expect(onSave).toHaveBeenCalledWith([
    { dayOfWeek: 0, time: '18:15', durationMin: 90, sport: 'volleyball', kind: 'training', location: 'BVSC csarnok', intensityLabel: 'közepes' },
    { dayOfWeek: 5, time: '10:00', durationMin: 120, sport: 'volleyball', kind: 'match', location: 'Kőbánya Sport', intensityLabel: 'magas' },
  ])
  await waitFor(() => expect(onClose).toHaveBeenCalled())
})

test('adding a slot appends it with defaults; a second add on the same day is allowed', async () => {
  const onSave = vi.fn()
  render(<SportScheduleSheet initial={[]} onSave={onSave} onClose={vi.fn()} />)
  await userEvent.click(screen.getByRole('button', { name: 'Kedd sport hozzáadása' }))
  await userEvent.click(screen.getByRole('button', { name: 'Kedd sport hozzáadása' }))
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  expect(onSave).toHaveBeenCalledWith([
    { dayOfWeek: 1, time: '18:00', durationMin: 90, sport: 'volleyball', kind: 'training' },
    { dayOfWeek: 1, time: '18:00', durationMin: 90, sport: 'volleyball', kind: 'training' },
  ])
})

test('switching a slot to TRX hides the kind toggle and saves sport trx / kind training', async () => {
  const onSave = vi.fn()
  render(<SportScheduleSheet initial={[]} onSave={onSave} onClose={vi.fn()} />)
  await userEvent.click(screen.getByRole('button', { name: 'Kedd sport hozzáadása' }))
  await userEvent.click(screen.getByRole('button', { name: 'Kedd 1. TRX' }))
  expect(screen.queryByRole('button', { name: 'Kedd 1. meccs' })).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  expect(onSave).toHaveBeenCalledWith([
    { dayOfWeek: 1, time: '18:00', durationMin: 90, sport: 'trx', kind: 'training' },
  ])
})

test('removing a slot drops it from the saved list', async () => {
  const onSave = vi.fn()
  render(<SportScheduleSheet initial={initial} onSave={onSave} onClose={vi.fn()} />)
  await userEvent.click(screen.getByRole('button', { name: 'Hétfő 1. slot törlése' }))
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  expect(onSave.mock.calls[0][0]).toHaveLength(1)
  expect(onSave.mock.calls[0][0][0].dayOfWeek).toBe(5)
})

test('slot duration clamps to the contract ceiling (360)', async () => {
  const onSave = vi.fn()
  render(
    <SportScheduleSheet
      initial={[{ day: 'Hét', time: '18:15', duration: 360, court: '', intensity: '', role: 'edzés' }]}
      onSave={onSave}
      onClose={vi.fn()}
    />,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Hossz · perc növelése' }))
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  expect(onSave.mock.calls[0][0][0].durationMin).toBe(360)
})

test('kind toggle switches a volleyball slot to match', async () => {
  const onSave = vi.fn()
  render(<SportScheduleSheet initial={[initial[0]]} onSave={onSave} onClose={vi.fn()} />)
  await userEvent.click(screen.getByRole('button', { name: 'Hétfő 1. meccs' }))
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  expect(onSave.mock.calls[0][0][0].kind).toBe('match')
})

test('a TRX slot prefills its sport from the schedule', async () => {
  const onSave = vi.fn()
  render(
    <SportScheduleSheet
      initial={[{ day: 'Kedd', time: '12:00', duration: 60, court: 'Life1 Corvin', intensity: '', role: 'edzés', sport: 'trx' }]}
      onSave={onSave}
      onClose={vi.fn()}
    />,
  )
  expect(screen.getByRole('button', { name: 'Kedd 1. TRX' })).toHaveAttribute('aria-pressed', 'true')
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  expect(onSave.mock.calls[0][0][0]).toMatchObject({ sport: 'trx', location: 'Life1 Corvin' })
})
