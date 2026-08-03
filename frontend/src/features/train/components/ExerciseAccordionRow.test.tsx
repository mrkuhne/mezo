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

  it('rep window decrease is a no-op at the repMin=1 boundary (no width collapse)', () => {
    const onChange = vi.fn()
    const lowEx: GymExercise = { ...ex, repMin: 1, repMax: 3 }
    render(<ExerciseAccordionRow ex={lowEx} expanded onToggle={noop} onRemove={noop} onChange={onChange} />)
    fireEvent.click(screen.getByLabelText('Fekvenyomás · Rep tartomány csökkentése'))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('header click toggles', () => {
    const onToggle = vi.fn()
    render(<ExerciseAccordionRow ex={ex} expanded={false} onToggle={onToggle} onRemove={noop} onChange={noop} />)
    fireEvent.click(screen.getByRole('button', { name: /Fekvenyomás/ }))
    expect(onToggle).toHaveBeenCalled()
  })

  it('highlight marks the card root with data-over without disturbing the rail', () => {
    const { container } = render(
      <ExerciseAccordionRow ex={ex} expanded={false} onToggle={noop} onRemove={noop} onChange={noop} highlight />,
    )
    const card = container.querySelector('.card') as HTMLElement
    expect(card).toHaveAttribute('data-over', 'true')
    expect(card.style.borderLeft).toBe('5px solid var(--coral)')
    expect(card.style.borderTop).toContain('color-mix(in srgb, var(--error) 45%, transparent)')
  })

  it('no highlight by default: card root has no data-over attribute', () => {
    const { container } = render(<ExerciseAccordionRow ex={ex} expanded={false} onToggle={noop} onRemove={noop} onChange={noop} />)
    const card = container.querySelector('.card')
    expect(card).not.toHaveAttribute('data-over')
  })
})
