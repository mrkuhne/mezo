// ============================================================
// Mezo · PrepExerciseTile tests — mezo-d20.3.8 Gyakorlatok tile-page card.
// ============================================================
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { LoggedWorkoutExercise } from '@/data/types'
import { PrepExerciseTile } from '@/features/train/components/PrepExerciseTile'

const base: LoggedWorkoutExercise = {
  id: 'ex1', name: 'Leg Press', muscle: 'quad', type: 'compound',
  warmupSets: 1, workingSets: 3, repMin: 8, repMax: 12, targetRIR: 2,
  anchorWeightKg: 24, sets: 4,
  prescribedSets: [
    { kind: 'warmup', targetWeightKg: 20, targetReps: 12, targetRIR: null },
    { kind: 'working', targetWeightKg: 26, targetReps: 10, targetRIR: 2 },
    { kind: 'working', targetWeightKg: 26, targetReps: 10, targetRIR: 2 },
    { kind: 'working', targetWeightKg: 26, targetReps: 10, targetRIR: 2 },
  ],
  rationale: null,
  lastWeek: null,
}

describe('PrepExerciseTile', () => {
  it('renders the muscle · type eyebrow, name, Cél and Induló súly columns, and a mini dot per set', () => {
    render(<PrepExerciseTile exercise={base} oneRmKg={null} accentChallenge={null} />)
    expect(screen.getByText('Comb · compound')).toBeInTheDocument() // MUSCLE_LABELS.quad
    expect(screen.getByText('Leg Press')).toBeInTheDocument()
    expect(screen.getByText('Cél')).toBeInTheDocument()
    expect(screen.getByText('8–12 rep · RIR 2')).toBeInTheDocument()
    expect(screen.getByText('Induló súly')).toBeInTheDocument()
    expect(screen.getByText('26 kg')).toBeInTheDocument()
    expect(screen.getByLabelText('4 szett').querySelectorAll('.gx-dot')).toHaveLength(4)
    expect(screen.getByText('B1')).toBeInTheDocument() // warmup dot label
    expect(screen.getByText('1')).toBeInTheDocument() // first working dot label
  })

  it('omits the Induló súly column and the footer when there is no anchor/last-week/progression/challenge', () => {
    const noAnchor: LoggedWorkoutExercise = { ...base, prescribedSets: null, anchorWeightKg: null }
    const { container } = render(<PrepExerciseTile exercise={noAnchor} oneRmKg={null} accentChallenge={null} />)
    expect(screen.queryByText('Induló súly')).not.toBeInTheDocument()
    expect(container.querySelector('.gx-foot')).toBeNull()
  })

  it('renders the 1RM medal only when a real record exists', () => {
    const { rerender } = render(<PrepExerciseTile exercise={base} oneRmKg={null} accentChallenge={null} />)
    expect(screen.queryByText(/🏆/)).not.toBeInTheDocument()
    rerender(<PrepExerciseTile exercise={base} oneRmKg={133} accentChallenge={null} />)
    expect(screen.getByText('🏆 133 kg')).toBeInTheDocument()
    expect(screen.getByText('1RM')).toBeInTheDocument()
  })

  it('shows the "múlt héten → progresszió" footer and a challenge flag when present', () => {
    const withHistory: LoggedWorkoutExercise = {
      ...base,
      lastWeek: { weight: 102.5, reps: 9, rir: 2 },
      progression: { lever: 'weight', deltaKg: 2.5, deltaReps: null, targetWeightKg: 105, targetReps: 10, rationale: 'overload' },
    }
    render(<PrepExerciseTile exercise={withHistory} oneRmKg={null} accentChallenge={{ typeLabel: 'PR', target: '105 kg × 10' }} />)
    expect(screen.getByText(/102,5 × 9 @2/)).toBeInTheDocument()
    expect(screen.getByText('+2,5 kg')).toBeInTheDocument()
    expect(screen.getByText('kihívás')).toBeInTheDocument()
  })
})
