import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { GymScheduleSheet } from './GymScheduleSheet'

test('saves a slot per weekday that has a time', async () => {
  const onSave = vi.fn()
  render(<GymScheduleSheet slots={[]} onClose={() => {}} onSave={onSave} />)
  // set Kedd (index 1) to 18:30
  const inputs = screen.getAllByLabelText(/időpont/i)
  await userEvent.type(inputs[1], '18:30')
  await userEvent.click(screen.getByRole('button', { name: /mentés/i }))
  expect(onSave).toHaveBeenCalledWith([{ dayOfWeek: 1, time: '18:30' }])
})
