import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { GymScheduleSheet } from './GymScheduleSheet'

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
