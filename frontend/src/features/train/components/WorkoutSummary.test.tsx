import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { WorkoutSummary } from '@/features/train/components/WorkoutSummary'

const exercises = [
  { id: 'a', name: 'Bench Press', plannedSets: 4, sets: [{ weight: 80, reps: 8, rir: 1 }], skipped: false },
  { id: 'b', name: 'Dead Hang', plannedSets: 2, sets: [], skipped: true },
]
const challenges = [
  { id: 'c1', typeLabel: 'PR', exercise: 'Bench Press', target: '85 kg × 8', state: 'hit' as const },
  { id: 'c2', typeLabel: 'Depth', exercise: 'Face Pull', target: 'RIR 0', state: 'skipped' as const },
]

describe('WorkoutSummary', () => {
  it('closing mode: stats + challenge outcomes + the finish CTA', async () => {
    const user = userEvent.setup()
    const onFinish = vi.fn()
    render(<WorkoutSummary title="Pull Day A" eyebrow="Edzés vége · Pull Day A" mode="closing"
      exercises={exercises} challenges={challenges} onFinish={onFinish} onBack={() => {}} onExit={() => {}} />)
    expect(screen.getByText('Mai mérleg')).toBeInTheDocument()
    expect(screen.getByText('megcsináltad')).toBeInTheDocument()
    expect(screen.getByText('skippelted')).toBeInTheDocument()
    expect(screen.getByText('kihagyva')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Edzés lezárása/ }))
    expect(onFinish).toHaveBeenCalledOnce()
  })
  it('closed mode: no finish CTA, set lines render', () => {
    render(<WorkoutSummary title="Pull Day A" eyebrow="Lezárva · ma" mode="closed" showSetLines
      exercises={exercises} challenges={challenges} onExit={() => {}} />)
    expect(screen.queryByRole('button', { name: /Edzés lezárása/ })).toBeNull()
    expect(screen.getByText(/80.*×.*8.*@RIR 1/)).toBeInTheDocument()
  })
})
