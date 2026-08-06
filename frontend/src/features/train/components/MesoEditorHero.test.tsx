import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MesoEditorHero } from '@/features/train/components/MesoEditorHero'

const baseProps = { dayType: 'Push A', daySets: 14, dayExerciseCount: 5, dayMinutes: 0, weekSets: 58, trainingDays: 4, warningCount: 0 }

describe('MesoEditorHero', () => {
  it('shows day + week numbers and the ok state', () => {
    render(<MesoEditorHero {...baseProps} />)
    expect(screen.getByText('14')).toBeInTheDocument()
    expect(screen.getByText(/58 szett/)).toBeInTheDocument()
    expect(screen.getByText(/kereten belül/)).toBeInTheDocument()
  })
  it('shows the warning count when over', () => {
    render(<MesoEditorHero {...baseProps} daySets={18} weekSets={64} warningCount={2} />)
    expect(screen.getByText(/2 jelzés/)).toBeInTheDocument()
    expect(screen.queryByText(/kereten belül/)).not.toBeInTheDocument()
  })
  it('shows the ~perc fragment when dayMinutes > 0 and omits it at 0 (mezo-oyhy.3)', () => {
    const { rerender } = render(<MesoEditorHero {...baseProps} dayMinutes={63} />)
    expect(screen.getByText(/gyakorlat · ~63 perc/)).toBeInTheDocument()
    rerender(<MesoEditorHero {...baseProps} dayMinutes={0} />)
    expect(screen.queryByText(/~0 perc|· ~/)).not.toBeInTheDocument()
  })
})
