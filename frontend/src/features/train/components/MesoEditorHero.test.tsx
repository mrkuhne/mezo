import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MesoEditorHero } from '@/features/train/components/MesoEditorHero'

describe('MesoEditorHero', () => {
  it('shows day + week numbers and the ok state', () => {
    render(<MesoEditorHero dayType="Push A" daySets={14} dayExerciseCount={5} weekSets={58} trainingDays={4} warningCount={0} />)
    expect(screen.getByText('14')).toBeInTheDocument()
    expect(screen.getByText(/58 szett/)).toBeInTheDocument()
    expect(screen.getByText(/kereten belül/)).toBeInTheDocument()
  })
  it('shows the warning count when over', () => {
    render(<MesoEditorHero dayType="Push A" daySets={18} dayExerciseCount={5} weekSets={64} trainingDays={4} warningCount={2} />)
    expect(screen.getByText(/2 jelzés/)).toBeInTheDocument()
    expect(screen.queryByText(/kereten belül/)).not.toBeInTheDocument()
  })
})
