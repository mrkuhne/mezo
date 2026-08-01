import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { GymExercise } from '@/data/types'
import { ExerciseAccordionRow } from '@/features/train/components/ExerciseAccordionRow'

const ex: GymExercise = {
  id: 'e1', name: 'Fekvenyomás', muscle: 'chest-mid',
  warmupSets: 1, workingSets: 4, repMin: 8, repMax: 10, targetRIR: 0, type: 'compound',
}
const noop = () => {}

describe('ExerciseAccordionRow', () => {
  it('collapsed: shows name + style summary chip, no steppers', () => {
    render(<ExerciseAccordionRow ex={ex} expanded={false} onToggle={noop} onRemove={noop} onChange={noop} />)
    expect(screen.getByText('Fekvenyomás')).toBeInTheDocument()
    expect(screen.getByText(/4×8–10/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Fekvenyomás · Munkaszett növelése')).not.toBeInTheDocument()
  })

  it('expanded: failure toggle is active at RIR 0 and Volume writes targetRIR 2', () => {
    const onChange = vi.fn()
    render(<ExerciseAccordionRow ex={ex} expanded onToggle={noop} onRemove={noop} onChange={onChange} />)
    expect(screen.getByRole('button', { name: /Failure/ })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: /Volume/ }))
    expect(onChange).toHaveBeenCalledWith({ targetRIR: 2 })
  })

  it('expanded: Failure writes targetRIR 0 when currently volume', () => {
    const onChange = vi.fn()
    render(<ExerciseAccordionRow ex={{ ...ex, targetRIR: 2 }} expanded onToggle={noop} onRemove={noop} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /Failure/ }))
    expect(onChange).toHaveBeenCalledWith({ targetRIR: 0 })
  })

  it('rep window shifts both ends together', () => {
    const onChange = vi.fn()
    render(<ExerciseAccordionRow ex={ex} expanded onToggle={noop} onRemove={noop} onChange={onChange} />)
    fireEvent.click(screen.getByLabelText('Fekvenyomás · Rep tartomány növelése'))
    expect(onChange).toHaveBeenCalledWith({ repMin: 9, repMax: 11 })
  })

  it('header click toggles', () => {
    const onToggle = vi.fn()
    render(<ExerciseAccordionRow ex={ex} expanded={false} onToggle={onToggle} onRemove={noop} onChange={noop} />)
    fireEvent.click(screen.getByRole('button', { name: /Fekvenyomás/ }))
    expect(onToggle).toHaveBeenCalled()
  })
})
