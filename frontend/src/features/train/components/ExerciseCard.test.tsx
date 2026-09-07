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
  const { rerender } = render(<ExerciseCard {...props} />)
  return {
    ...props,
    /**
     * Re-renders with a patched prop (typically `ex`) — stands in for the parent
     * applying a commit, or handing the card an unrelated exercise, and re-rendering.
     * `onChange` is a bare `vi.fn()` here (not wired back to `ex`), so buffered
     * fields only pick up a committed/external value once this is called explicitly.
     */
    rerender: (patch: Partial<Parameters<typeof ExerciseCard>[0]> = {}) =>
      rerender(<ExerciseCard {...props} {...patch} />),
  }
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

  // ---- Buffered-input contract (mezo-yty6 fix round 1) --------------------
  // NumField/RepBoundInput hold the displayed text in local state, re-synced from
  // the `ex` prop via useEffect (see ExerciseCard.tsx). These tests pin that
  // contract: the parent is the source of truth, in-range multi-digit entry must
  // not lose digits, external `ex` changes must reach the field, and an emptied
  // integer field must stay typeable-out-of.

  test('multi-digit in-range entry keeps every digit', async () => {
    const user = userEvent.setup()
    const props = setup()
    const input = screen.getByRole('spinbutton', { name: 'Munkaszettek' })
    await user.clear(input)
    await user.type(input, '10')
    expect(props.onChange).toHaveBeenLastCalledWith({ workingSets: 10 })
    expect(input).toHaveValue(10)
  })

  test('an out-of-range entry clamps, and the field re-syncs to the clamped value', async () => {
    const user = userEvent.setup()
    const props = setup()
    const input = screen.getByRole('spinbutton', { name: 'Munkaszettek' })
    await user.clear(input)
    await user.type(input, '99')
    expect(props.onChange).toHaveBeenLastCalledWith({ workingSets: 10 })
    // the buffer still shows the raw, un-clamped keystrokes until the parent
    // hands back the committed (clamped) value — simulate that round-trip:
    props.rerender({ ex: { ...EX, workingSets: 10 } })
    expect(input).toHaveValue(10)
  })

  test('an external value change reaches the field', () => {
    const props = setup()
    props.rerender({ ex: { ...EX, workingSets: 7, anchorWeightKg: 100 } })
    expect(screen.getByRole('spinbutton', { name: 'Munkaszettek' })).toHaveValue(7)
    expect(screen.getByRole('spinbutton', { name: 'Kiinduló súly (kg)' })).toHaveValue(100)
  })

  test('rep bounds buffer the same way as other number fields', async () => {
    const user = userEvent.setup()
    const props = setup()
    const min = screen.getByRole('spinbutton', { name: 'Rep minimum' })
    await user.clear(min)
    await user.type(min, '12')
    expect(props.onChange).toHaveBeenLastCalledWith({ repMin: 12 })
    expect(min).toHaveValue(12)

    const max = screen.getByRole('spinbutton', { name: 'Rep maximum' })
    await user.clear(max)
    await user.type(max, '15')
    expect(props.onChange).toHaveBeenLastCalledWith({ repMax: 15 })
    expect(max).toHaveValue(15)
  })

  test('an emptied integer field is recoverable — typing out of it works', async () => {
    const user = userEvent.setup()
    const props = setup()
    const input = screen.getByRole('spinbutton', { name: 'Bemelegítő szettek' })
    await user.clear(input)
    expect(props.onChange).toHaveBeenLastCalledWith({ warmupSets: 0 })
    await user.type(input, '3')
    expect(props.onChange).toHaveBeenLastCalledWith({ warmupSets: 3 })
    expect(input).toHaveValue(3)
  })
})
