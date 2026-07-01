import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { GymScheduleSheet } from '@/features/train/components/GymScheduleSheet'

test('saves a slot per weekday that has a time', async () => {
  const onSave = vi.fn()
  render(<GymScheduleSheet slots={[]} onClose={() => {}} onSave={onSave} />)
  // set Kedd (index 1) to 18:30 — target the input by its exact per-day label,
  // not a /időpont/i substring (the dialog's accessible name "Heti gym-időpontok"
  // also matches that, which would shift the matched indices).
  await userEvent.type(screen.getByLabelText('Kedd időpont'), '18:30')
  await userEvent.click(screen.getByRole('button', { name: /mentés/i }))
  expect(onSave).toHaveBeenCalledWith([{ dayOfWeek: 1, time: '18:30' }])
})

test('empty time inputs contribute no slot: only the filled day is saved', async () => {
  const onSave = vi.fn()
  render(<GymScheduleSheet slots={[]} onClose={() => {}} onSave={onSave} />)
  // Fill exactly ONE day (Pén, index 4); the other 6 days stay empty.
  await userEvent.type(screen.getByLabelText('Pén időpont'), '07:00')
  await userEvent.click(screen.getByRole('button', { name: /mentés/i }))
  // The 6 empty days produce nothing — onSave gets exactly the one filled slot.
  expect(onSave).toHaveBeenCalledWith([{ dayOfWeek: 4, time: '07:00' }])
})

test('an existing slot seeds its weekday input', () => {
  render(<GymScheduleSheet slots={[{ dayOfWeek: 1, time: '18:30' }]} onClose={() => {}} onSave={() => {}} />)
  expect(screen.getByLabelText('Kedd időpont')).toHaveValue('18:30')
})
