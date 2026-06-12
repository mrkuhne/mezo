import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SportLogSheet } from './SportLogSheet'

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

test('Mégse does not call onSave', async () => {
  const onClose = vi.fn()
  const onSave = vi.fn()
  render(<SportLogSheet onClose={onClose} onSave={onSave} />)
  await userEvent.click(screen.getByRole('button', { name: 'Mégse' }))
  expect(onSave).not.toHaveBeenCalled()
  await waitFor(() => expect(onClose).toHaveBeenCalled())
})
