import { render, screen, within } from '@testing-library/react'
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
    const field = screen.getByRole('textbox', { name: 'A terv neve' })
    expect(field).toHaveValue('Hypertrophy · Ősz')
    expect(screen.getByText('6 hét · Upper/Lower · 3× futtatva')).toBeInTheDocument()
    await user.type(field, '!')
    expect(props.onRename).toHaveBeenCalledWith('Hypertrophy · Ősz!')
  })

  test('one row per day in the first numbered card', () => {
    const { view } = setup()
    expect(screen.getByRole('heading', { name: /A heted · koppints egy napra/ })).toBeInTheDocument()
    expect(view.container.querySelectorAll('.fo-row.ew-day')).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Hét · Upper · szerkesztés' })).toBeInTheDocument()
  })

  // Folyadék (mezo-n4wf5.3): the hero says the week in one sentence and shows the busiest
  // muscles as vessels whose rim is the weekly maximum.
  test('the hero carries the verdict and one vessel per muscle', () => {
    const { view } = setup()
    expect(screen.getByText('13 szett az első héten, 2 edzésnapra.')).toBeInTheDocument()
    expect(view.container.querySelectorAll('.fo-hero .fo-tubes .fo-vial')).toHaveLength(2)
  })

  test('a rest day stays in the list as a quiet row that still opens', async () => {
    const user = userEvent.setup()
    const { props } = setup({ days: [...DAYS, day('Vas', 'Rest', [], '')] })
    expect(screen.getByText('Pihenőnap')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Vas · Rest · szerkesztés' }))
    expect(props.onOpenDay).toHaveBeenCalledWith('Vas')
  })

  test('tapping a day asks the caller to open it', async () => {
    const user = userEvent.setup()
    const { props } = setup()
    await user.click(screen.getByRole('button', { name: 'Kedd · Push · szerkesztés' }))
    expect(props.onOpenDay).toHaveBeenCalledWith('Kedd')
  })

  test('the hero button and the weekly load row both open the weekly load page', async () => {
    const user = userEvent.setup()
    const { view } = setup()
    // the hero button, and the row of section 2 (its name also carries the set count)
    const [hero, row] = screen.getAllByRole('button', { name: /^Heti terhelés · izmonként/ })
    expect(row).toHaveTextContent('13 szett · 1. hét')
    await user.click(hero)
    expect(screen.getByText('Csökkenő sorrendben · koppints a lebontásért')).toBeInTheDocument()
    view.unmount()

    setup()
    await user.click(screen.getAllByRole('button', { name: /^Heti terhelés · izmonként/ })[1])
    expect(screen.getByText('Csökkenő sorrendben · koppints a lebontásért')).toBeInTheDocument()
  })

  test('an adjacent-day conflict flags both day rows, counts on the load row and shows the advice', () => {
    setup()
    expect(screen.getAllByText('átfedés')).toHaveLength(2)
    expect(screen.getByText('1 jelzés')).toBeInTheDocument()
    expect(within(screen.getByTestId('week-conflict')).getByText(/pihenőnap ajánlott/i)).toBeInTheDocument()
  })

  test('activeDay renders the day editor instead of the week view', () => {
    setup({ activeDay: 'Hét' })
    expect(screen.getByRole('textbox', { name: 'Hét nap neve' })).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'A terv neve' })).not.toBeInTheDocument()
  })

  test('draft mode says the block is unsaved; template mode names the template', () => {
    const { view } = setup({ mode: 'draft' })
    expect(screen.getByText('Vázlat · még nincs mentve')).toBeInTheDocument()
    view.unmount()
    setup({ mode: 'template' })
    expect(screen.getByText('Sablon · mentve')).toBeInTheDocument()
  })

  test('the footer slot renders after the sections', () => {
    setup({ footer: <button type="button">Újragenerálás</button> })
    expect(screen.getByRole('button', { name: 'Újragenerálás' })).toBeInTheDocument()
  })

  test('the actions slot replaces the hero button (the draft has its own save buttons)', () => {
    const { view } = setup({ mode: 'draft', actions: <button type="button">Mentés + indítás</button> })
    const acts = view.container.querySelector('.fo-hero-acts')!
    expect(within(acts as HTMLElement).getByRole('button', { name: 'Mentés + indítás' })).toBeInTheDocument()
    expect(within(acts as HTMLElement).queryByRole('button', { name: /Heti terhelés/ })).not.toBeInTheDocument()
  })

  // ---- Buffered-input contract (mezo-yty6 fix round 1) --------------------
  // The mesocycle-name field buffers its text locally (useBufferedText), re-synced from
  // the `name` prop via useEffect — same contract as ExerciseCard and MesoDayEditor.
  // This test pins that an external `name` change reaches the field.

  test('an external value change reaches the field', () => {
    const { rerender } = setup()
    const field = screen.getByRole('textbox', { name: 'A terv neve' })
    expect(field).toHaveValue('Hypertrophy · Ősz')
    rerender({ name: 'Hypertrophy · Tél' })
    expect(field).toHaveValue('Hypertrophy · Tél')
  })

  // mezo-yty6 fix round 1: the generator's rationale had no slot in the editor hero.
  test('an optional note renders in the hero when given, nothing when omitted', () => {
    const { view } = setup()
    expect(view.container.querySelector('.fo-hero .fo-box, .fo-hero .fo-msg')).not.toBeInTheDocument()
    view.unmount()

    // a template's note is its goal …
    const tpl = setup({ note: 'A hátra tettem a hangsúlyt, a vállad kímélve.' })
    expect(screen.getByText('A sablon célja')).toBeInTheDocument()
    expect(screen.getByText('A hátra tettem a hangsúlyt, a vállad kímélve.')).toBeInTheDocument()
    tpl.view.unmount()

    // … a draft's is Mezo's reasoning, signed by Mezo
    const draft = setup({ mode: 'draft', note: 'A hátra tettem a hangsúlyt, a vállad kímélve.' })
    expect(draft.view.container.querySelector('.fo-hero .fo-msg')).toHaveTextContent('Mezo')
    expect(screen.queryByText('A sablon célja')).not.toBeInTheDocument()
  })

  // mezo-yty6 final review, I3: the week tile summed `weekMuscleLoad` rows, which drop
  // exempt work (plyo) and landmark-less groups — so on a week containing either, the day
  // tiles visibly added up to MORE than the week tile sitting right under them.
  test('the week headline equals the sum of the day rows, even with exempt (plyo) work', () => {
    const plyo: GymExercise = {
      id: 'p', name: 'Box jump', muscle: 'quad', warmupSets: 0, workingSets: 4,
      repMin: 3, repMax: 5, targetRIR: 3, anchorWeightKg: null, type: 'plyo',
    }
    const { view } = setup({
      days: [
        day('Hét', 'Upper', [ex('a', 'Evezés', 'back', 6), plyo]),
        day('Kedd', 'Push', [ex('c', 'Oldalemelés', 'shoulder', 4)], 'shoulder'),
      ],
    })
    const leading = (el: Element | null) => Number(/\d+/.exec(el?.textContent ?? '')?.[0])
    const dayTotals = [...view.container.querySelectorAll('.ew-day .g > small')].map(leading)
    expect(dayTotals).toEqual([10, 4])
    // 6 + 4 (exempt plyo) + 4 — the filtered per-muscle view would say 10.
    const loadRow = screen.getAllByRole('button', { name: /^Heti terhelés · izmonként/ })[1]
    expect(leading(loadRow.querySelector('.g > small'))).toBe(14)
    expect(leading(loadRow.querySelector('.g > small'))).toBe(dayTotals.reduce((a, b) => a + b, 0))
    expect(screen.getByText('14 szett az első héten, 2 edzésnapra.')).toBeInTheDocument()
  })
})
