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

  // mezo-yty6 fix round 1: spec §3 requires the peak-week check after the adjacency lint —
  // amber when peakWeekFit flags out-of-band days, green .mz-lint-ok otherwise. Fixture is
  // peakWeekFit.test.ts's own primary case (same hand-computed 109/29-minute projection).
  test('a peak-week fit issue renders an amber lint row naming the day and the minutes', () => {
    // Exact fixture from peakWeekFit.test.ts's primary case (109/29-minute projection) — the
    // local `ex` helper above fixes warmupSets to 1, so these are built by hand instead.
    const peakEx = (id: string, muscle: string, workingSets: number, warmupSets: number): GymExercise =>
      ({ id, name: id, muscle, warmupSets, workingSets, repMin: 8, repMax: 10, targetRIR: 2, type: 'compound' })
    const a1 = peakEx('a1', 'back-mid', 3, 2)
    const a2 = peakEx('a2', 'back-wide', 2, 1)
    const b1 = peakEx('b1', 'lats', 1, 1)
    const peakDays = [day('Szo', 'Push', [a1, a2]), day('Sze', 'Push', [b1])]
    render(
      <WeekLoadPanel
        days={peakDays}
        priorities={{ back: 'emphasize' }}
        volumePerMuscle={{ back: { mev: 5, mav: 20, mrv: 40 } }}
        onBack={vi.fn()}
      />,
    )
    expect(screen.getByText('Szo: csúcshéten ~109 perc — vegyél el, vagy tedd át.')).toBeInTheDocument()
    expect(screen.getByText('Sze: csúcshéten is csak ~29 perc — férne még bele inger.')).toBeInTheDocument()
  })

  test('a peak-week that fits everywhere says so instead of staying silent', () => {
    const clean = [day('Hét', 'Upper', [ex('a', 'Evezés', 'back', 6)])]
    render(<WeekLoadPanel days={clean} onBack={vi.fn()} />)
    expect(screen.getByText(/A csúcshét is elfér/i)).toBeInTheDocument()
  })

  // mezo-yty6 final review, C2: `up` means "still ramping toward the tier target". In week 1
  // EVERY grow/emphasize group is below its target by design, so amber there would repaint
  // the exact unexplained warning this redesign exists to delete. Amber is reserved for
  // `down` — above the target, the only case that actually asks for a change.
  test('a group still ramping toward its target reads as healthy, not amber', () => {
    const { container } = render(<WeekLoadPanel days={WEEK} priorities={{ back: 'emphasize' }} onBack={vi.fn()} />)
    const back = screen.getAllByTestId('week-load-card').find((c) => c.dataset.group === 'back')!
    const stat = within(back).getByText(/szett a célig$/)
    expect(stat).toHaveClass('mz-arr-up')
    expect(stat).not.toHaveClass('mz-arr-dn')
    // the arrow carries the same class, so glyph and sentence can never disagree
    expect(within(back).getByText('▲')).toHaveClass('mz-arr-up')
    expect(container.querySelector('.mz-arr-dn')).toBeNull()
  })

  test('a group ABOVE its target is the amber one', () => {
    // 'maintain' targets MEV; 30 back sets is far above any MEV, so direction is 'down'.
    const heavy = [day('Hét', 'Upper', [ex('a', 'Evezés', 'back', 30)])]
    render(<WeekLoadPanel days={heavy} priorities={{ back: 'maintain' }} onBack={vi.fn()} />)
    const back = screen.getAllByTestId('week-load-card').find((c) => c.dataset.group === 'back')!
    const stat = within(back).getByText(/szettel a cél fölött$/)
    expect(stat).toHaveClass('mz-arr-dn')
    expect(within(back).getByText('▼')).toHaveClass('mz-arr-dn')
  })

  test('a group exactly on its target reads neutral', () => {
    // 'maintain' targets MEV; the explicit landmark below puts the group exactly on it.
    const onTarget = [day('Hét', 'Upper', [ex('a', 'Evezés', 'back', 8)])]
    render(
      <WeekLoadPanel
        days={onTarget}
        priorities={{ back: 'maintain' }}
        volumePerMuscle={{ back: { mev: 8, mav: 16, mrv: 22 } }}
        onBack={vi.fn()}
      />,
    )
    const back = screen.getAllByTestId('week-load-card').find((c) => c.dataset.group === 'back')!
    const stat = within(back).getByText('a célon')
    expect(stat).toHaveClass('mz-arr-eq')
    expect(within(back).getByText('=')).toHaveClass('mz-arr-eq')
  })

  // mezo-yty6 final review, I4: spec §3 names structureLint as a week-page lint source; it
  // was rendered nowhere in the new editor path.
  test('a structureLint finding renders as a lint row', () => {
    // One 8-set compound on one day: over the 2–4 sets/exercise band (R2) and a 1-exercise
    // session (R5) — both are structureLint findings, neither is an adjacency or peak issue.
    const lintable = [day('Hét', 'Upper', [ex('a', 'Evezés', 'back', 8)])]
    render(<WeekLoadPanel days={lintable} onBack={vi.fn()} />)
    const rows = screen.getAllByTestId('structure-lint')
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.map((r) => r.textContent).join(' ')).toMatch(/Evezés: 8 szett/)
  })
})
