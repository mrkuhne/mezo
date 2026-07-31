import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MedalChip } from '@/features/train/components/MedalChip'
import type { Medal } from '@/data/train/medalTypes'

// Base RECORD-tier medal; each case overrides only what it exercises.
const record: Medal = {
  type: 'WEIGHT', tier: 'RECORD', exerciseName: 'Chest Supported Row',
  date: '2026-07-20', setIndex: 2,
  value: 105, unit: 'KG', weightKg: 105, reps: 10,
  previousValue: 102.5, previousDate: null,
}

describe('MedalChip', () => {
  it('renders a gold 🏅 disc named in Hungarian for a RECORD medal', () => {
    render(<MedalChip medal={record} />)
    const chip = screen.getByRole('img', { name: 'Súly-rekord' })
    expect(chip).toHaveTextContent('🏅')
  })

  it.each([
    ['WEIGHT', 'Súly-rekord'],
    ['REPS_AT_WEIGHT', 'Rep-rekord'],
    ['E1RM', '1RM-rekord'],
    ['SESSION_VOLUME', 'Volumen-rekord'],
  ] as const)('names a %s RECORD medal "%s"', (type, label) => {
    render(<MedalChip medal={{ ...record, type }} />)
    expect(screen.getByRole('img', { name: label })).toBeInTheDocument()
  })

  // The quiet half of the two-tier split: TARGET_HIT fires on most working sets, so
  // it must add NO mark of its own — the set row's existing done-tick turns sage
  // instead (the double-tick fix, asserted end-to-end in ActiveWorkoutPage.test.tsx).
  it('renders nothing at all for a TARGET-tier medal', () => {
    const { container } = render(
      <MedalChip medal={{
        ...record, type: 'TARGET_HIT', tier: 'TARGET',
        value: 10, unit: 'REPS', previousValue: null,
      }} />,
    )
    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.queryByText('🏅')).not.toBeInTheDocument()
  })
})
