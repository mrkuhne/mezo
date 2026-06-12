import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NumberStep, SportLogSheet } from './SportLogSheet'

function setup() {
  const onClose = vi.fn()
  render(<SportLogSheet onClose={onClose} />)
  return { onClose }
}

test('renders the sport-log fields and Mezo observation', () => {
  setup()
  expect(screen.getByText('Sport log · Volleyball')).toBeInTheDocument()
  expect(screen.getByText('Hogy ment?')).toBeInTheDocument()
  expect(screen.getByText('Idő · perc')).toBeInTheDocument()
  expect(screen.getByText('RPE · összesített nehézség')).toBeInTheDocument()
  expect(screen.getByText('Váll terhelés')).toBeInTheDocument()
})

test('Mentés closes the sheet', async () => {
  const { onClose } = setup()
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  // The Sheet dismisses with a slide-down animation, so onClose fires async.
  await waitFor(() => expect(onClose).toHaveBeenCalled())
})

test('high shoulder strain swaps the observation copy', async () => {
  setup()
  // default shoulder 6 → baseline copy; raise to ≥7 via the scale grid
  await userEvent.click(screen.getByRole('button', { name: 'Váll terhelés 8' }))
  expect(screen.getByText(/Váll terhelés magas/)).toBeInTheDocument()
})

test('Mentés passes the sheet values to onSave (house WeightLogSheet idiom)', async () => {
  const onClose = vi.fn()
  const onSave = vi.fn()
  render(<SportLogSheet onClose={onClose} onSave={onSave} />)
  // duration 90 -> 105 (+15 step), sets 5 -> 6, rpe -> 8, shoulder -> 7
  await userEvent.click(screen.getByRole('button', { name: 'Idő · perc növelése' }))
  await userEvent.click(screen.getByRole('button', { name: 'Setek · összesen növelése' }))
  await userEvent.click(screen.getByRole('button', { name: 'RPE · összesített nehézség 8' }))
  await userEvent.click(screen.getByRole('button', { name: 'Váll terhelés 7' }))
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  expect(onSave).toHaveBeenCalledWith({ duration: 105, setsPlayed: 6, rpe: 8, shoulderStrain: 7 })
  await waitFor(() => expect(onClose).toHaveBeenCalled())
})

// Contract bounds (review finding): the steppers must clamp so the sheet can
// never produce a payload the backend's @Valid rejects with a 400.
test('NumberStep clamps to min/max bounds', async () => {
  const onChange = vi.fn()
  const { rerender } = render(<NumberStep label="X" val={600} step={15} max={600} onChange={onChange} />)
  await userEvent.click(screen.getByRole('button', { name: 'X növelése' }))
  expect(onChange).toHaveBeenCalledWith(600) // ceiling holds
  rerender(<NumberStep label="X" val={15} step={15} min={15} max={600} onChange={onChange} />)
  await userEvent.click(screen.getByRole('button', { name: 'X csökkentése' }))
  expect(onChange).toHaveBeenLastCalledWith(15) // floor holds
})

test('duration stepper never goes below 15 minutes', async () => {
  setup()
  const minus = screen.getByRole('button', { name: 'Idő · perc csökkentése' })
  for (let i = 0; i < 7; i++) await userEvent.click(minus) // 90 - 7×15 would be < 0
  const display = minus.closest('.stepper')!.querySelector('.stepper-display')!
  expect(display.textContent).toBe('15')
})

test('Mégse does not call onSave', async () => {
  const onClose = vi.fn()
  const onSave = vi.fn()
  render(<SportLogSheet onClose={onClose} onSave={onSave} />)
  await userEvent.click(screen.getByRole('button', { name: 'Mégse' }))
  expect(onSave).not.toHaveBeenCalled()
  await waitFor(() => expect(onClose).toHaveBeenCalled())
})
