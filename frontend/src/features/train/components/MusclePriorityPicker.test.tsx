import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MusclePriorityPicker } from '@/features/train/components/MusclePriorityPicker'
import { EMPHASIZE_CAP, TIER_GROUPS } from '@/features/train/logic/musclePriorities'
import { BUDGET_GROUP_LABELS } from '@/features/train/logic/setBudget'
import type { MusclePriorities } from '@/data/types'

function rowGroup(group: string) {
  const label = BUDGET_GROUP_LABELS[group] ?? group
  return screen.getByRole('group', { name: `${label} prioritás` })
}

describe('MusclePriorityPicker', () => {
  it('renders one segmented row per TIER_GROUPS entry, labeled from BUDGET_GROUP_LABELS', () => {
    render(<MusclePriorityPicker value={{}} onChange={vi.fn()} />)
    expect(screen.getAllByRole('group')).toHaveLength(TIER_GROUPS.length)
    for (const group of TIER_GROUPS) {
      expect(rowGroup(group)).toBeInTheDocument()
    }
  })

  it('all rows default to Grow pressed, others not pressed', () => {
    render(<MusclePriorityPicker value={{}} onChange={vi.fn()} />)
    for (const group of TIER_GROUPS) {
      const row = rowGroup(group)
      expect(within(row).getByRole('button', { name: 'Grow' })).toHaveAttribute('aria-pressed', 'true')
      expect(within(row).getByRole('button', { name: 'Emphasize' })).toHaveAttribute('aria-pressed', 'false')
      expect(within(row).getByRole('button', { name: 'Maintain' })).toHaveAttribute('aria-pressed', 'false')
    }
  })

  it('reflects the current tier from value as the pressed button', () => {
    const value: MusclePriorities = { back: 'emphasize', chest: 'maintain' }
    render(<MusclePriorityPicker value={value} onChange={vi.fn()} />)
    expect(within(rowGroup('back')).getByRole('button', { name: 'Emphasize' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(rowGroup('chest')).getByRole('button', { name: 'Maintain' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(rowGroup('quad')).getByRole('button', { name: 'Grow' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('clicking Emphasize calls onChange with the sparse map (grow never stored)', () => {
    const onChange = vi.fn()
    render(<MusclePriorityPicker value={{}} onChange={onChange} />)
    fireEvent.click(within(rowGroup('back')).getByRole('button', { name: 'Emphasize' }))
    expect(onChange).toHaveBeenCalledWith({ back: 'emphasize' })
  })

  it('clicking Grow on an emphasized row deletes the key from the map', () => {
    const onChange = vi.fn()
    render(<MusclePriorityPicker value={{ back: 'emphasize', chest: 'maintain' }} onChange={onChange} />)
    fireEvent.click(within(rowGroup('back')).getByRole('button', { name: 'Grow' }))
    expect(onChange).toHaveBeenCalledWith({ chest: 'maintain' })
  })

  it('clicking Maintain calls onChange with maintain set for that group only', () => {
    const onChange = vi.fn()
    render(<MusclePriorityPicker value={{}} onChange={onChange} />)
    fireEvent.click(within(rowGroup('calf')).getByRole('button', { name: 'Maintain' }))
    expect(onChange).toHaveBeenCalledWith({ calf: 'maintain' })
  })

  it(`once ${EMPHASIZE_CAP} groups are emphasized, Emphasize disables on the rest but Grow/Maintain stay clickable`, () => {
    const value: MusclePriorities = { back: 'emphasize', chest: 'emphasize' }
    const onChange = vi.fn()
    render(<MusclePriorityPicker value={value} onChange={onChange} />)

    // Already-emphasized rows: Emphasize stays enabled (so it can be toggled off) and pressed.
    const backEmphasize = within(rowGroup('back')).getByRole('button', { name: 'Emphasize' })
    expect(backEmphasize).not.toBeDisabled()
    expect(backEmphasize).toHaveAttribute('aria-pressed', 'true')

    // A row that is not emphasized: Emphasize is disabled (present, not hidden), Grow/Maintain still clickable.
    const quadRow = rowGroup('quad')
    const quadEmphasize = within(quadRow).getByRole('button', { name: 'Emphasize' })
    const quadGrow = within(quadRow).getByRole('button', { name: 'Grow' })
    const quadMaintain = within(quadRow).getByRole('button', { name: 'Maintain' })
    expect(quadEmphasize).toBeDisabled()
    expect(quadGrow).not.toBeDisabled()
    expect(quadMaintain).not.toBeDisabled()

    fireEvent.click(quadMaintain)
    expect(onChange).toHaveBeenCalledWith({ back: 'emphasize', chest: 'emphasize', quad: 'maintain' })

    fireEvent.click(quadEmphasize)
    expect(onChange).not.toHaveBeenCalledWith(expect.objectContaining({ quad: 'emphasize' }))
  })

  it('shows the header and helper copy', () => {
    render(<MusclePriorityPicker value={{}} onChange={vi.fn()} />)
    expect(screen.getByText('Mire gyúr ez a blokk?')).toBeInTheDocument()
    expect(screen.getByText(/Válassz 1–2 hangsúlyt/)).toBeInTheDocument()
  })
})
