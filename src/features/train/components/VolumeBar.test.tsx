import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { activeMeso, MUSCLE_LABELS } from '@/data/train'
import { VolumeBar } from './VolumeBar'

const chest = activeMeso.volumePerMuscle!.chest

test('shows the Hungarian muscle label and the current set count collapsed', () => {
  render(<VolumeBar muscle="chest" profile={chest} />)
  expect(screen.getByText(MUSCLE_LABELS.chest)).toBeInTheDocument() // "Mell"
  // baseline detail is hidden until expanded
  expect(screen.queryByText('01 · Baseline')).not.toBeInTheDocument()
})

test('expanding reveals the 3-stage provenance and confidence', async () => {
  render(<VolumeBar muscle="chest" profile={chest} />)
  // The expand toggle is targetable by an accessible name including the label.
  const toggle = screen.getByRole('button', { name: new RegExp(MUSCLE_LABELS.chest) })
  expect(toggle).toHaveAttribute('aria-expanded', 'false')

  await userEvent.click(toggle)

  expect(toggle).toHaveAttribute('aria-expanded', 'true')
  expect(screen.getByText('01 · Baseline')).toBeInTheDocument()
  expect(screen.getByText(chest.source.baseline.name)).toBeInTheDocument()
  expect(screen.getByText('03 · Eredő · most')).toBeInTheDocument()
  // confidence 0.78 → "78%"
  expect(screen.getByText('78%')).toBeInTheDocument()
})
