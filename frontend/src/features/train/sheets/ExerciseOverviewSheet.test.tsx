import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ExerciseOverviewSheet } from '@/features/train/sheets/ExerciseOverviewSheet'

const exercises = [
  { id: 'a', name: 'Bench Press', state: 'done' as const, done: 4, total: 4 },
  { id: 'b', name: 'Chest Row', state: 'progress' as const, done: 2, total: 4 },
  { id: 'c', name: 'Face Pull', state: 'todo' as const, done: 0, total: 3 },
  { id: 'd', name: 'Dead Hang', state: 'skipped' as const, done: 0, total: 2 },
]

describe('ExerciseOverviewSheet', () => {
  it('lists every exercise with its status and jumps on tap', async () => {
    const user = userEvent.setup()
    const onJump = vi.fn()
    render(<ExerciseOverviewSheet exercises={exercises} currentId="b" onJump={onJump} onClose={() => {}} />)
    expect(screen.getByText('Bench Press')).toBeInTheDocument()
    expect(screen.getByText('kihagyva')).toBeInTheDocument()
    expect(screen.getByText('2/4')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Face Pull/ }))
    expect(onJump).toHaveBeenCalledWith('c')
  })
})
