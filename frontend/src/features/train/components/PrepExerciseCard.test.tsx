// ============================================================
// Mezo · PrepExerciseCard tests — mezo-bxpg mission-briefing exercise card.
// ============================================================
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { LoggedWorkoutExercise } from '@/data/types'
import { PrepExerciseCard } from '@/features/train/components/PrepExerciseCard'

const anchoredExercise: LoggedWorkoutExercise = {
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
const plyoExercise: LoggedWorkoutExercise = {
  id: 'ex2', name: 'Box Jump', muscle: 'quad', type: 'plyo',
  warmupSets: 0, workingSets: 3, repMin: 4, repMax: 6, targetRIR: 3,
  anchorWeightKg: null, sets: 3,
  prescribedSets: null,
  rationale: null,
  lastWeek: null,
}

describe('PrepExerciseCard', () => {
  it('renders the name, muscle pill, 1RM badge, warmup pill, working/rep/RIR pills and the start-weight pill', () => {
    render(<PrepExerciseCard exercise={anchoredExercise} oneRmKg={40} accentChallenge={null} />)
    expect(screen.getByText('Leg Press')).toBeInTheDocument()
    expect(screen.getByText('Comb')).toBeInTheDocument() // MUSCLE_LABELS.quad
    expect(screen.getByText('🏆 40 kg')).toBeInTheDocument()
    expect(screen.getByText('1RM REKORD')).toBeInTheDocument()
    expect(screen.getByText('🔥 1 bemelegítő')).toBeInTheDocument()
    expect(screen.getByText('3 × working')).toBeInTheDocument()
    expect(screen.getByText('8–12 rep')).toBeInTheDocument()
    expect(screen.getByText('RIR 2')).toBeInTheDocument()
    expect(screen.getByText('↑ 26 kg-ról indul')).toBeInTheDocument()
  })

  it('omits the 1RM badge when oneRmKg is null', () => {
    render(<PrepExerciseCard exercise={anchoredExercise} oneRmKg={null} accentChallenge={null} />)
    expect(screen.queryByText('1RM REKORD')).not.toBeInTheDocument()
    expect(screen.queryByText(/🏆/)).not.toBeInTheDocument()
  })

  it('omits the warmup pill (warmupSets=0) and the start-weight pill (no prescribedSets) for a plyo exercise', () => {
    render(<PrepExerciseCard exercise={plyoExercise} oneRmKg={null} accentChallenge={null} />)
    expect(screen.queryByText(/bemelegítő/)).not.toBeInTheDocument()
    expect(screen.queryByText(/kg-ról indul/)).not.toBeInTheDocument()
    expect(screen.getByText('3 × working')).toBeInTheDocument()
    expect(screen.getByText('4–6 rep')).toBeInTheDocument()
    expect(screen.getByText('RIR 3')).toBeInTheDocument()
  })

  it('renders the accepted-challenge line under the name when present, omits it otherwise', () => {
    const { rerender } = render(
      <PrepExerciseCard exercise={anchoredExercise} oneRmKg={null} accentChallenge={{ typeLabel: 'PR-kísérlet', target: '3×10 @ 28 kg' }} />,
    )
    expect(screen.getByText('PR-kísérlet · 3×10 @ 28 kg')).toBeInTheDocument()

    rerender(<PrepExerciseCard exercise={anchoredExercise} oneRmKg={null} accentChallenge={null} />)
    expect(screen.queryByText(/PR-kísérlet/)).not.toBeInTheDocument()
  })
})
