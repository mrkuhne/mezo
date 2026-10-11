import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { GymScheduleSheet } from '@/features/train/sheets/GymScheduleSheet'

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

test('keeps edited values visible after failed persistence', async () => {
  render(<GymScheduleSheet slots={[]} onClose={vi.fn()} onSave={async () => { throw new Error('offline') }} />)
  await userEvent.type(screen.getByLabelText('Kedd időpont'), '18:30')
  await userEvent.click(screen.getByRole('button', { name: /mentés/i }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Nem sikerült menteni')
  expect(screen.getByLabelText('Kedd időpont')).toHaveValue('18:30')
})

// Folyadék (mezo-n4wf5.3): the light sheet with the kit head and fields — none of the old capture / glass skin.
test('the sheet wears the Folyadék sheet language', async () => {
  render(<GymScheduleSheet slots={[{ dayOfWeek: 1, time: '18:30' }] as never} onClose={() => {}} onSave={vi.fn()} />)
  const sheet = document.querySelector('.sheet.fo-sheet') as HTMLElement
  expect(sheet).not.toBeNull()
  expect(screen.getByRole('heading', { name: 'Heti gym-időpontok' })).toBeInTheDocument()
  expect(screen.getByText('Gym · heti idő')).toBeInTheDocument()
  // one row per weekday, each with its day badge; a set day reads in ink
  expect(sheet.querySelectorAll('.es-gymday')).toHaveLength(7)
  expect(sheet.querySelectorAll('.es-gymday.is-set')).toHaveLength(1)
  expect(screen.getByLabelText('Kedd időpont')).toHaveValue('18:30')
  expect(sheet.querySelector('.glass, [class*="capture-"], [class*="uvs-"], [class*="uvl-"], .chip, .stepper')).toBeNull()
  expect(screen.getByRole('button', { name: 'Mégse' })).toHaveClass('fo-lk')
})
