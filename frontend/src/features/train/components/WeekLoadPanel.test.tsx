import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import type { GymExercise, MesoDay } from '@/data/types'
import { WeekLoadPanel } from '@/features/train/components/WeekLoadPanel'

function ex(id: string, name: string, muscle: string, workingSets: number): GymExercise {
  return { id, name, muscle, warmupSets: 1, workingSets, repMin: 8, repMax: 10, targetRIR: 1, anchorWeightKg: null, type: 'compound' }
}
function day(dayKey: string, type: string, exercises: GymExercise[], muscle = 'back'): MesoDay {
  return { day: dayKey, type, muscle, exerciseCount: exercises.length, exercises }
}

const WEEK: MesoDay[] = [
  day('Hét', 'Upper', [ex('a', 'Evezés', 'back', 6), ex('b', 'Press', 'shoulder', 3)]),
  day('Kedd', 'Push', [ex('c', 'Oldalemelés', 'shoulder', 4)], 'shoulder'),
]

describe('WeekLoadPanel', () => {
  test('one card per muscle, sorted by weekly sets descending', () => {
    render(<WeekLoadPanel days={WEEK} onBack={vi.fn()} />)
    const cards = screen.getAllByTestId('week-load-card')
    expect(cards.map((c) => c.getAttribute('data-group'))).toEqual(['shoulder', 'back'])
  })

  test('each card shows the tier, the frequency and the direction toward the target', () => {
    render(<WeekLoadPanel days={WEEK} priorities={{ back: 'emphasize' }} onBack={vi.fn()} />)
    const back = screen.getAllByTestId('week-load-card').find((c) => c.dataset.group === 'back')!
    expect(within(back).getByText('Emphasize')).toBeInTheDocument()
    expect(within(back).getByText('1 nap / hét')).toBeInTheDocument()
    // 6 sets toward the MRV target of 22
    expect(within(back).getByText('6')).toBeInTheDocument()
    expect(within(back).getByText('▲')).toBeInTheDocument()
    expect(within(back).getByText('22')).toBeInTheDocument()
  })

  test('percent is never rendered as text', () => {
    const { container } = render(<WeekLoadPanel days={WEEK} onBack={vi.fn()} />)
    expect(container.textContent).not.toMatch(/%/)
  })

  // jsdom loads no stylesheet, so the `.mz-lcard-body { display: none }` rule is not in
  // effect here — assert the state the CSS keys off, not computed visibility.
  test('tapping a card toggles the day-by-day contribution open', async () => {
    const user = userEvent.setup()
    render(<WeekLoadPanel days={WEEK} onBack={vi.fn()} />)
    const shoulder = screen.getAllByTestId('week-load-card').find((c) => c.dataset.group === 'shoulder')!
    const toggle = within(shoulder).getByRole('button', { name: 'Váll · lebontás' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(shoulder).not.toHaveClass('open')
    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(shoulder).toHaveClass('open')
    expect(within(shoulder).getByText('Oldalemelés +4')).toBeInTheDocument()
  })

  test('adjacent-day muscle overlap is reported as passive advice', () => {
    // "Váll" also labels the shoulder card's pill, so scope the query to the
    // lint line itself rather than the whole document (would otherwise throw
    // on multiple matches).
    const { container } = render(<WeekLoadPanel days={WEEK} onBack={vi.fn()} />)
    const lint = container.querySelector('.mz-lint:not(.mz-lint-ok)')!
    expect(within(lint as HTMLElement).getByText(/Váll/)).toBeInTheDocument()
    expect(within(lint as HTMLElement).getByText(/pihenőnap ajánlott/i)).toBeInTheDocument()
  })

  test('a conflict-free week says so instead of staying silent', () => {
    const clean = [day('Hét', 'Upper', [ex('a', 'Evezés', 'back', 6)])]
    render(<WeekLoadPanel days={clean} onBack={vi.fn()} />)
    expect(screen.getByText(/Nincs egymást követő napi átfedés/i)).toBeInTheDocument()
  })
})
