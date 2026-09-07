import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import type { GymExercise, MesoDay } from '@/data/types'
import { MesoWeekEditor } from '@/features/train/components/MesoWeekEditor'

function ex(id: string, name: string, muscle: string, workingSets: number): GymExercise {
  return { id, name, muscle, warmupSets: 1, workingSets, repMin: 8, repMax: 10, targetRIR: 1, anchorWeightKg: null, type: 'compound' }
}
function day(dayKey: string, type: string, exercises: GymExercise[], muscle = 'back'): MesoDay {
  return { day: dayKey, type, muscle, exerciseCount: exercises.length, exercises }
}

const DAYS: MesoDay[] = [
  day('Hét', 'Upper', [ex('a', 'Evezés', 'back', 6), ex('b', 'Press', 'shoulder', 3)]),
  day('Kedd', 'Push', [ex('c', 'Oldalemelés', 'shoulder', 4)], 'shoulder'),
]

function setup(overrides: Partial<Parameters<typeof MesoWeekEditor>[0]> = {}) {
  const props = {
    mode: 'template' as const,
    name: 'Hypertrophy · Ősz',
    meta: '6 hét · Upper/Lower · 3× futtatva',
    days: DAYS,
    activeDay: null as string | null,
    onOpenDay: vi.fn(),
    onBack: vi.fn(),
    onRename: vi.fn(),
    onRenameDay: vi.fn(),
    onChangeExercise: vi.fn(),
    onMoveExercise: vi.fn(),
    onRemoveExercise: vi.fn(),
    onAddClick: vi.fn(),
    ...overrides,
  }
  const { rerender, ...view } = render(<MesoWeekEditor {...props} />)
  return {
    props,
    view,
    /**
     * Re-renders with a patched prop (typically `name`) — stands in for the parent
     * re-rendering with an updated name, e.g. after a rename commits. Follows the
     * ExerciseCard and MesoDayEditor idiom.
     */
    rerender: (patch: Partial<Parameters<typeof MesoWeekEditor>[0]> = {}) =>
      rerender(<MesoWeekEditor {...props} {...patch} />),
  }
}

describe('MesoWeekEditor', () => {
  test('the mesocycle name is editable and the meta line shows', async () => {
    const user = userEvent.setup()
    const { props } = setup()
    const field = screen.getByRole('textbox', { name: 'Mezociklus neve' })
    expect(field).toHaveValue('Hypertrophy · Ősz')
    expect(screen.getByText('6 hét · Upper/Lower · 3× futtatva')).toBeInTheDocument()
    await user.type(field, '!')
    expect(props.onRename).toHaveBeenCalledWith('Hypertrophy · Ősz!')
  })

  test('one day tile per day, in a single horizontally scrollable row', () => {
    const { view } = setup()
    const row = view.container.querySelector('.mz-dayrow')!
    expect(row.querySelectorAll('.mz-dst')).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Hét · Upper · szerkesztés' })).toBeInTheDocument()
  })

  test('tapping a day asks the caller to open it', async () => {
    const user = userEvent.setup()
    const { props } = setup()
    await user.click(screen.getByRole('button', { name: 'Kedd · Push · szerkesztés' }))
    expect(props.onOpenDay).toHaveBeenCalledWith('Kedd')
  })

  test('the weekly load tile opens the weekly load page', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('button', { name: /Heti terhelés/ }))
    expect(screen.getByText('Heti terhelés · izmonként')).toBeInTheDocument()
  })

  test('an adjacent-day conflict flags both day tiles and shows a lint row', () => {
    const { view } = setup()
    expect(view.container.querySelectorAll('.mz-dst-dot')).toHaveLength(2)
    expect(screen.getByText(/pihenőnap ajánlott/i)).toBeInTheDocument()
  })

  test('activeDay renders the day editor instead of the week view', () => {
    setup({ activeDay: 'Hét' })
    expect(screen.getByRole('textbox', { name: 'Hét nap neve' })).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Mezociklus neve' })).not.toBeInTheDocument()
  })

  test('draft mode says the block is unsaved; template mode names the template', () => {
    const { view } = setup({ mode: 'draft' })
    expect(screen.getByText('Vázlat · még nincs mentve')).toBeInTheDocument()
    view.unmount()
    setup({ mode: 'template' })
    expect(screen.getByText('Sablon · mentve')).toBeInTheDocument()
  })

  test('the footer slot renders the mode-specific CTAs', () => {
    setup({ footer: <button type="button">Mentés + indítás</button> })
    expect(screen.getByRole('button', { name: 'Mentés + indítás' })).toBeInTheDocument()
  })

  // ---- Buffered-input contract (mezo-yty6 fix round 1) --------------------
  // The mesocycle-name field buffers its text locally (useBufferedText), re-synced from
  // the `name` prop via useEffect — same contract as ExerciseCard and MesoDayEditor.
  // This test pins that an external `name` change reaches the field.

  test('an external value change reaches the field', () => {
    const { rerender } = setup()
    const field = screen.getByRole('textbox', { name: 'Mezociklus neve' })
    expect(field).toHaveValue('Hypertrophy · Ősz')
    rerender({ name: 'Hypertrophy · Tél' })
    expect(field).toHaveValue('Hypertrophy · Tél')
  })

  // mezo-yty6 fix round 1: the generator's rationale had no slot in the editor hero.
  test('an optional coach note renders under the meta line when given, nothing when omitted', () => {
    const { view } = setup()
    expect(view.container.querySelector('.mz-coach')).not.toBeInTheDocument()
    view.unmount()

    setup({ note: 'A hátra tettem a hangsúlyt, a vállad kímélve.' })
    expect(screen.getByText('A hátra tettem a hangsúlyt, a vállad kímélve.')).toBeInTheDocument()
  })
})
