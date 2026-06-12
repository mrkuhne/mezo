import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SportScheduleSheet } from './SportScheduleSheet'
import type { VolleyballSession } from '@/data/types'

const initial: VolleyballSession[] = [
  { day: 'Hét', time: '18:15', duration: 90, court: 'BVSC csarnok', intensity: 'közepes', role: 'edzés' },
  { day: 'Szo', time: '10:00', duration: 120, court: 'Kőbánya Sport', intensity: 'magas', role: 'meccs/scrim' },
]

test('prefills drafts from the current schedule and saves the slot list', async () => {
  const onSave = vi.fn()
  const onClose = vi.fn()
  render(<SportScheduleSheet initial={initial} onSave={onSave} onClose={onClose} />)

  expect(screen.getByRole('heading', { name: 'Heti rend' })).toBeInTheDocument()
  // Hét + Szo are on, the other 5 days off
  expect(screen.getAllByRole('button', { name: /session$/ }).filter(
    (b) => b.getAttribute('aria-pressed') === 'true',
  )).toHaveLength(2)

  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  expect(onSave).toHaveBeenCalledWith([
    { dayOfWeek: 0, time: '18:15', durationMin: 90, kind: 'training', location: 'BVSC csarnok', intensityLabel: 'közepes' },
    { dayOfWeek: 5, time: '10:00', durationMin: 120, kind: 'match', location: 'Kőbánya Sport', intensityLabel: 'magas' },
  ])
  await waitFor(() => expect(onClose).toHaveBeenCalled())
})

test('toggling a day on adds it to the saved list with defaults', async () => {
  const onSave = vi.fn()
  render(<SportScheduleSheet initial={[]} onSave={onSave} onClose={vi.fn()} />)
  await userEvent.click(screen.getByRole('button', { name: 'Kedd session' }))
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  expect(onSave).toHaveBeenCalledWith([
    { dayOfWeek: 1, time: '18:00', durationMin: 90, kind: 'training' },
  ])
})

test('toggling a day off removes it from the saved list', async () => {
  const onSave = vi.fn()
  render(<SportScheduleSheet initial={initial} onSave={onSave} onClose={vi.fn()} />)
  await userEvent.click(screen.getByRole('button', { name: 'Hét session' }))
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  expect(onSave).toHaveBeenCalledWith([
    { dayOfWeek: 5, time: '10:00', durationMin: 120, kind: 'match', location: 'Kőbánya Sport', intensityLabel: 'magas' },
  ])
})

test('kind toggle switches a day to match', async () => {
  const onSave = vi.fn()
  render(<SportScheduleSheet initial={[initial[0]]} onSave={onSave} onClose={vi.fn()} />)
  await userEvent.click(screen.getByRole('button', { name: 'Hét meccs' }))
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  expect(onSave.mock.calls[0][0][0].kind).toBe('match')
})
