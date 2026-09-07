import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import type { GymExercise, MesoDay } from '@/data/types'
import { MesoDayEditor } from '@/features/train/components/MesoDayEditor'

function ex(id: string, name: string, muscle: string, workingSets: number): GymExercise {
  return { id, name, muscle, warmupSets: 1, workingSets, repMin: 8, repMax: 10, targetRIR: 1, anchorWeightKg: null, type: 'compound' }
}

const DAY: MesoDay = {
  day: 'Hét', type: 'Upper', muscle: 'back', exerciseCount: 2,
  exercises: [ex('a', 'Evezés', 'back', 4), ex('b', 'Press', 'shoulder', 3)],
}

function setup(overrides: Partial<Parameters<typeof MesoDayEditor>[0]> = {}) {
  const props = {
    day: DAY,
    minutes: 31,
    onBack: vi.fn(),
    onRename: vi.fn(),
    onChangeExercise: vi.fn(),
    onMoveExercise: vi.fn(),
    onRemoveExercise: vi.fn(),
    onAdd: vi.fn(),
    ...overrides,
  }
  render(<MesoDayEditor {...props} />)
  return props
}

describe('MesoDayEditor', () => {
  test('the day name is an editable field, not static text', async () => {
    const user = userEvent.setup()
    const props = setup()
    const field = screen.getByRole('textbox', { name: 'Hét nap neve' })
    expect(field).toHaveValue('Upper')
    await user.clear(field)
    await user.type(field, 'Húzónap')
    expect(props.onRename).toHaveBeenLastCalledWith('Húzónap')
  })

  test('one always-open card per exercise, above them the daily load tile', () => {
    setup()
    expect(screen.getByText('Napi terhelés · Hét')).toBeInTheDocument()
    expect(screen.getAllByRole('spinbutton', { name: 'Munkaszettek' })).toHaveLength(2)
    expect(screen.getAllByLabelText(/törlése$/)).toHaveLength(2)
  })

  test('the arrows report the exercise id and direction', async () => {
    const user = userEvent.setup()
    const props = setup()
    await user.click(screen.getByRole('button', { name: 'Evezés lejjebb' }))
    expect(props.onMoveExercise).toHaveBeenCalledWith('a', 1)
  })

  test('the first card cannot move up and the last cannot move down', () => {
    setup()
    expect(screen.getByRole('button', { name: 'Evezés feljebb' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Press lejjebb' })).toBeDisabled()
  })

  test('the load tile opens the daily load page and back returns to the day', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('button', { name: /Napi terhelés · Hét/ }))
    expect(screen.getByText('Napi terhelés · Hét · Upper')).toBeInTheDocument()
    const backButton = screen.getByRole('button', { name: 'Vissza' })
    expect(backButton).toHaveTextContent('‹ Upper')
    await user.click(backButton)
    expect(screen.getByRole('textbox', { name: 'Hét nap neve' })).toBeInTheDocument()
  })

  test('the add button asks the parent to open the picker', async () => {
    const user = userEvent.setup()
    const props = setup()
    await user.click(screen.getByRole('button', { name: /Gyakorlat hozzáadása/ }))
    expect(props.onAdd).toHaveBeenCalled()
  })

  test('the entrance choreography plays once and never replays on an edit', () => {
    const props = {
      day: DAY, minutes: 31, onBack: vi.fn(), onRename: vi.fn(), onChangeExercise: vi.fn(),
      onMoveExercise: vi.fn(), onRemoveExercise: vi.fn(), onAdd: vi.fn(),
    }
    const { rerender, container } = render(<MesoDayEditor {...props} />)
    // first paint: the cards carry the staggered entrance
    expect(screen.getByTestId('exercise-list')).toHaveAttribute('data-entered', 'false')
    expect(container.querySelectorAll('[data-testid="exercise-list"] > .rise')).toHaveLength(2)

    // an edit re-renders the list — no entrance class, so nothing flashes
    const moved: MesoDay = { ...DAY, exercises: [DAY.exercises[1], DAY.exercises[0]] }
    rerender(<MesoDayEditor {...props} day={moved} />)
    expect(screen.getByTestId('exercise-list')).toHaveAttribute('data-entered', 'true')
    expect(container.querySelectorAll('[data-testid="exercise-list"] > .rise')).toHaveLength(0)
  })
})
