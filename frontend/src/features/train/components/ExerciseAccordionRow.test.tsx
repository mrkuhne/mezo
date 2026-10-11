import { fireEvent, render, screen, within } from '@testing-library/react'
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
    expect(screen.getByLabelText('Fekvenyomás · Rep tartomány csökkentése')).toBeDisabled()
    fireEvent.click(screen.getByLabelText('Fekvenyomás · Rep tartomány csökkentése'))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('header click toggles', () => {
    const onToggle = vi.fn()
    render(<ExerciseAccordionRow ex={ex} expanded={false} onToggle={onToggle} onRemove={noop} onChange={noop} />)
    fireEvent.click(screen.getByRole('button', { name: /Fekvenyomás/ }))
    expect(onToggle).toHaveBeenCalled()
  })

  it('highlight marks the row root with data-over', () => {
    const { container } = render(
      <ExerciseAccordionRow ex={ex} expanded={false} onToggle={noop} onRemove={noop} onChange={noop} highlight />,
    )
    expect(container.querySelector('.ee-ex')).toHaveAttribute('data-over', 'true')
  })

  it('collapsed: the sets are capsules — warm-ups quiet, working sets full; the old flame / sprout art is gone', () => {
    const { container } = render(<ExerciseAccordionRow ex={ex} expanded={false} onToggle={noop} onRemove={noop} onChange={noop} />)
    const caps = container.querySelectorAll('.fo-caps')
    expect(caps[0].querySelectorAll('i')).toHaveLength(1) // 1 warm-up
    expect(caps[1].querySelectorAll('i.f')).toHaveLength(4) // 4 working sets
    expect(screen.getByText(/· Failure$/)).toBeInTheDocument()
    expect(container.querySelector('use[href="#t-flame"], use[href="#t-sprout"]')).toBeNull()
  })

  it('expanded: every knob is a named − value + line; a button at its bound is disabled', () => {
    render(<ExerciseAccordionRow ex={{ ...ex, workingSets: 10, warmupSets: 0 }} expanded onToggle={noop} onRemove={noop} onChange={noop} />)
    expect(within(screen.getByRole('group', { name: 'Fekvenyomás · Munkaszett' })).getByText('10')).toBeInTheDocument()
    expect(screen.getByLabelText('Fekvenyomás · Munkaszett növelése')).toBeDisabled()
    expect(screen.getByLabelText('Fekvenyomás · Bemelegítő csökkentése')).toBeDisabled()
    expect(within(screen.getByRole('group', { name: 'Fekvenyomás · Kiinduló kg' })).getByText('auto')).toBeInTheDocument()
    expect(screen.getByLabelText('Fekvenyomás · Kiinduló kg csökkentése')).toBeDisabled()
  })

  it('expanded: the starting weight steps by 2.5 kg from 20 and shows a decimal comma', () => {
    const onChange = vi.fn()
    const { rerender } = render(<ExerciseAccordionRow ex={ex} expanded onToggle={noop} onRemove={noop} onChange={onChange} />)
    fireEvent.click(screen.getByLabelText('Fekvenyomás · Kiinduló kg növelése'))
    expect(onChange).toHaveBeenLastCalledWith({ anchorWeightKg: 20 })
    rerender(<ExerciseAccordionRow ex={{ ...ex, anchorWeightKg: 22.5 }} expanded onToggle={noop} onRemove={noop} onChange={onChange} />)
    expect(screen.getByText('22,5')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Fekvenyomás · Kiinduló kg csökkentése'))
    expect(onChange).toHaveBeenLastCalledWith({ anchorWeightKg: 20 })
  })

  it('expanded: the volume switch, the fine-tune disclosure and the remove link', () => {
    const onChange = vi.fn()
    const onRemove = vi.fn()
    render(<ExerciseAccordionRow ex={ex} expanded onToggle={noop} onRemove={onRemove} onChange={onChange} />)
    const sw = screen.getByRole('switch', { name: 'Fekvenyomás · számít a volumenbe' })
    expect(sw).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(sw)
    expect(onChange).toHaveBeenLastCalledWith({ countsTowardVolume: false })
    expect(screen.queryByLabelText('Fekvenyomás · RIR növelése')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Finomhangolás/ }))
    fireEvent.click(screen.getByLabelText('Fekvenyomás · RIR növelése'))
    expect(onChange).toHaveBeenLastCalledWith({ targetRIR: 1 })
    fireEvent.click(screen.getByLabelText('Fekvenyomás · Rep max csökkentése'))
    expect(onChange).toHaveBeenLastCalledWith({ repMax: 9 })
    fireEvent.click(screen.getByRole('button', { name: 'Fekvenyomás törlése' }))
    expect(onRemove).toHaveBeenCalled()
  })

  it('no highlight by default: card root has no data-over attribute', () => {
    const { container } = render(<ExerciseAccordionRow ex={ex} expanded={false} onToggle={noop} onRemove={noop} onChange={noop} />)
    expect(container.querySelector('.ee-ex')).not.toHaveAttribute('data-over')
  })

  it('shows the warmup suggestion chip when it differs from the stored count, and tapping it applies the suggestion', () => {
    const onChange = vi.fn()
    render(
      <ExerciseAccordionRow ex={ex} expanded onToggle={noop} onRemove={noop} onChange={onChange} suggestedWarmup={3} />,
    )
    expect(screen.getByText(/↺ javaslat: 3/)).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Fekvenyomás · bemelegítés javaslat alkalmazása'))
    expect(onChange).toHaveBeenCalledWith({ warmupSets: 3 })
  })

  it('no chip when the suggestion equals the stored warmup count', () => {
    render(<ExerciseAccordionRow ex={ex} expanded onToggle={noop} onRemove={noop} onChange={noop} suggestedWarmup={ex.warmupSets} />)
    expect(screen.queryByText(/javaslat/)).not.toBeInTheDocument()
  })

  it('no chip when suggestedWarmup is left undefined', () => {
    render(<ExerciseAccordionRow ex={ex} expanded onToggle={noop} onRemove={noop} onChange={noop} />)
    expect(screen.queryByText(/javaslat/)).not.toBeInTheDocument()
  })
})
