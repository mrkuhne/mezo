import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import type { GymExercise } from '@/data/types'
import { ExerciseCard } from '@/features/train/components/ExerciseCard'

const EX: GymExercise = {
  id: 'e1', name: 'Döntött evezés', muscle: 'back', warmupSets: 1, workingSets: 4,
  repMin: 8, repMax: 10, targetRIR: 1, anchorWeightKg: 84, type: 'compound',
}

function setup(overrides: Partial<Parameters<typeof ExerciseCard>[0]> = {}) {
  const props = {
    ex: EX,
    contribution: [{ label: 'Hát', sets: 4, color: 'var(--tag-gym)' }],
    canMoveUp: true,
    canMoveDown: true,
    onChange: vi.fn(),
    onMove: vi.fn(),
    onRemove: vi.fn(),
    ...overrides,
  }
  render(<ExerciseCard {...props} />)
  return props
}

describe('ExerciseCard', () => {
  test('shows every value inline — no accordion to open', () => {
    setup()
    expect(screen.getByRole('spinbutton', { name: 'Munkaszettek' })).toHaveValue(4)
    expect(screen.getByRole('spinbutton', { name: 'Rep minimum' })).toHaveValue(8)
    expect(screen.getByRole('spinbutton', { name: 'Rep maximum' })).toHaveValue(10)
    expect(screen.getByRole('spinbutton', { name: 'Kiinduló súly (kg)' })).toHaveValue(84)
    expect(screen.getByRole('spinbutton', { name: 'Cél RIR' })).toHaveValue(1)
    expect(screen.getByRole('spinbutton', { name: 'Bemelegítő szettek' })).toHaveValue(1)
    // the retired disclosure must not come back
    expect(screen.queryByText('Finomhangolás')).not.toBeInTheDocument()
  })

  test('typing a set count patches workingSets', async () => {
    const user = userEvent.setup()
    const props = setup()
    const input = screen.getByRole('spinbutton', { name: 'Munkaszettek' })
    await user.clear(input)
    await user.type(input, '6')
    expect(props.onChange).toHaveBeenLastCalledWith({ workingSets: 6 })
  })

  test('an emptied weight field patches null, not zero', async () => {
    const user = userEvent.setup()
    const props = setup()
    await user.clear(screen.getByRole('spinbutton', { name: 'Kiinduló súly (kg)' }))
    expect(props.onChange).toHaveBeenLastCalledWith({ anchorWeightKg: null })
  })

  test('the Failure/Volume toggle rewrites targetRIR', async () => {
    const user = userEvent.setup()
    const props = setup()
    await user.click(screen.getByRole('button', { name: /Volume/ }))
    expect(props.onChange).toHaveBeenLastCalledWith({ targetRIR: 2 })
  })

  test('the arrows move the card and are disabled at the ends', () => {
    const props = setup({ canMoveUp: false })
    expect(screen.getByRole('button', { name: 'Döntött evezés feljebb' })).toBeDisabled()
    const down = screen.getByRole('button', { name: 'Döntött evezés lejjebb' })
    down.click()
    expect(props.onMove).toHaveBeenCalledWith(1)
  })

  test('the × removes and the contribution line names the muscles', () => {
    const props = setup()
    screen.getByRole('button', { name: 'Döntött evezés törlése' }).click()
    expect(props.onRemove).toHaveBeenCalled()
    expect(screen.getByText('Hát +4')).toBeInTheDocument()
  })
})
