import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi, afterEach } from 'vitest'
import { WorkoutCeremony } from '@/features/train/components/WorkoutCeremony'
import type { CerScore, MuscleStarRow } from '@/features/train/logic/cerScore'

const SCORE: CerScore = {
  target: { sets: 12, reps: 120, volume: 9000 },
  done: { sets: 9, reps: 96, volume: 7200 },
  // 0.75 / 0.8 / 0.8 → mean 0.7833 → 4 stars (round(7.83)/2)
  ratio: 0.8,
  stars: 4,
}

const MUSCLES: MuscleStarRow[] = [
  { muscle: 'back-mid', label: 'Hát · közép', done: 5, plan: 6, ratio: 5 / 6, stars: 4 },
  { muscle: 'biceps', label: 'Bicepsz', done: 2, plan: 4, ratio: 0.5, stars: 2.5 },
]

function props(overrides: Partial<Parameters<typeof WorkoutCeremony>[0]> = {}) {
  return {
    score: SCORE,
    eyebrow: 'EDZÉS LEZÁRVA',
    minutes: null,
    xpGained: null,
    records: [],
    muscles: MUSCLES,
    kcal: null,
    note: '',
    onNote: vi.fn(),
    onClose: vi.fn(),
    onGoFuel: vi.fn(),
    reducedMotion: true,
    ...overrides,
  }
}

afterEach(() => vi.restoreAllMocks())

// ---- act one ----

test('reduced motion paints the final state instantly: told, full counters, stars lit to the score', () => {
  const { container } = render(<WorkoutCeremony {...props()} />)
  // No pass: act two is revealed on the very first paint.
  expect(container.querySelector('.cer-screen')).toHaveClass('is-told')
  const stage = container.querySelector('.cer') as HTMLElement
  expect(stage.style.getPropertyValue('--p')).toBe('0.8')
  // Counters sit at the session's real done values (volume hu-grouped, digits asserted).
  expect(screen.getByText('9')).toBeInTheDocument()
  expect(screen.getByText('96')).toBeInTheDocument()
  expect(screen.getByText(/7\D?200/)).toBeInTheDocument()
  expect(screen.getByText('szett')).toBeInTheDocument()
  expect(screen.getByText('ismétlés')).toBeInTheDocument()
  expect(screen.getByText('kg × rep')).toBeInTheDocument()
  // 4 stars of 5: four lit, none half.
  const stars = container.querySelectorAll('.cer-stars i')
  expect(stars).toHaveLength(5)
  expect(container.querySelectorAll('.cer-stars i.is-lit')).toHaveLength(4)
  expect(container.querySelectorAll('.cer-stars i.is-half')).toHaveLength(0)
})

test('a half star lights the next star as half', () => {
  const half = { ...SCORE, ratio: 0.9, stars: 4.5 }
  const { container } = render(<WorkoutCeremony {...props({ score: half })} />)
  expect(container.querySelectorAll('.cer-stars i.is-lit')).toHaveLength(4)
  expect(container.querySelectorAll('.cer-stars i.is-half')).toHaveLength(1)
})

test('the sr-only heading announces the stars with a Hungarian decimal comma and takes focus', () => {
  render(<WorkoutCeremony {...props({ score: { ...SCORE, ratio: 0.9, stars: 4.5 } })} />)
  const heading = screen.getByRole('heading', { level: 1 })
  expect(heading).toHaveTextContent('4,5 csillag az ötből')
  expect(heading).toHaveFocus()
})

test('the eyebrow is the caller\'s', () => {
  render(<WorkoutCeremony {...props()} />)
  expect(screen.getByText('EDZÉS LEZÁRVA')).toBeInTheDocument()
})

// ---- the single pass ----

test('the rAF pass runs exactly once — a re-render never restarts it', () => {
  const frames: FrameRequestCallback[] = []
  const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
    frames.push(cb)
    return frames.length
  })
  const { container, rerender } = render(<WorkoutCeremony {...props({ reducedMotion: false })} />)
  expect(raf).toHaveBeenCalledTimes(1)
  // Act two is still held back while the pass runs.
  expect(container.querySelector('.cer-screen')).not.toHaveClass('is-told')
  rerender(<WorkoutCeremony {...props({ reducedMotion: false, minutes: 42 })} />)
  expect(raf).toHaveBeenCalledTimes(1)
})

test('the pass drives --p, the counters and the star classes, then reveals act two', () => {
  const frames: FrameRequestCallback[] = []
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
    frames.push(cb)
    return frames.length
  })
  const now = vi.spyOn(performance, 'now')
  now.mockReturnValue(0)
  const { container } = render(<WorkoutCeremony {...props({ reducedMotion: false })} />)
  const stage = container.querySelector('.cer') as HTMLElement
  expect(stage.style.getPropertyValue('--p')).toBe('0')
  // Halfway through the 2400 ms pass: cubic ease-out 1-(1-.5)^3 = .875 of the ratio.
  frames.shift()?.(1200)
  expect(Number(stage.style.getPropertyValue('--p'))).toBeCloseTo(0.7, 5)
  expect(container.querySelector('.cer-screen')).not.toHaveClass('is-told')
  // The final frame lands on the real values and tells act two.
  act(() => { frames.shift()?.(2400) })
  expect(Number(stage.style.getPropertyValue('--p'))).toBeCloseTo(0.8, 5)
  expect(container.querySelector('[data-cer-count="sets"]')).toHaveTextContent('9')
  expect(container.querySelectorAll('.cer-stars i.is-lit')).toHaveLength(4)
  expect(container.querySelector('.cer-screen')).toHaveClass('is-told')
})

test('settled skips the pass entirely and marks the stage settled', () => {
  const raf = vi.spyOn(window, 'requestAnimationFrame')
  const { container } = render(<WorkoutCeremony {...props({ reducedMotion: false, settled: true })} />)
  expect(raf).not.toHaveBeenCalled()
  expect(container.querySelector('.cer')).toHaveClass('is-settled')
  expect(container.querySelector('.cer-screen')).toHaveClass('is-told')
})

// ---- act two ----

test('the verdict sentence comes from the star count', () => {
  render(<WorkoutCeremony {...props()} />)
  expect(screen.getByText('Erős nap.')).toBeInTheDocument()
})

test('no minutes and no XP means no stat tiles at all — never a fabricated 0', () => {
  const { container } = render(<WorkoutCeremony {...props()} />)
  expect(container.querySelector('.cer-stats')).toBeNull()
  expect(screen.queryByText('szerzett XP')).not.toBeInTheDocument()
  expect(screen.queryByText(/a pulton töltött idő/)).not.toBeInTheDocument()
})

test('the +XP tile shows only when the finish response carried XP', () => {
  render(<WorkoutCeremony {...props({ xpGained: 240 })} />)
  expect(screen.getByText('+240')).toBeInTheDocument()
  expect(screen.getByText('szerzett XP')).toBeInTheDocument()
  // Minutes stay absent — the page passes null (no measured duration exists).
  expect(screen.queryByText(/a pulton töltött idő/)).not.toBeInTheDocument()
})

test('the minutes tile shows only when a measured value is passed', () => {
  render(<WorkoutCeremony {...props({ minutes: 47 })} />)
  expect(screen.getByText('47')).toBeInTheDocument()
  expect(screen.getByText('a pulton töltött idő')).toBeInTheDocument()
})

test('the records strip names the session\'s real records; absent when there are none', () => {
  const { container, rerender } = render(<WorkoutCeremony {...props()} />)
  expect(container.querySelector('.cer-record')).toBeNull()
  rerender(<WorkoutCeremony {...props({ records: [
    { name: 'Chest Supported Row', value: '80 kg × 10' },
    { name: 'Lat Pulldown', value: '65 kg × 12' },
  ] })} />)
  expect(screen.getByText('2 új rekord')).toBeInTheDocument()
  expect(screen.getByText('Chest Supported Row · 80 kg × 10 · Lat Pulldown · 65 kg × 12')).toBeInTheDocument()
})

test('one record reads singular', () => {
  render(<WorkoutCeremony {...props({ records: [{ name: 'Chest Supported Row', value: '80 kg × 10' }] })} />)
  expect(screen.getByText('Új rekord')).toBeInTheDocument()
})

test('the muscle rows carry the label, done/plan and a fill width from the ratio', () => {
  const { container } = render(<WorkoutCeremony {...props()} />)
  const rows = container.querySelectorAll('.cer-mstar')
  expect(rows).toHaveLength(2)
  expect(screen.getByText('Hát · közép')).toBeInTheDocument()
  expect(screen.getByText('5 / 6 szett')).toBeInTheDocument()
  expect(screen.getByText('Bicepsz')).toBeInTheDocument()
  expect(screen.getByText('2 / 4 szett')).toBeInTheDocument()
  const fill = rows[1].querySelector('.fill') as HTMLElement
  expect(fill.style.getPropertyValue('--w')).toBe('50%')
  // The mini star rows are drawn, not written: 5 slots per row.
  expect(rows[0].querySelectorAll('.cer-starrow.mini i')).toHaveLength(5)
})

test('a 0-ratio muscle row lights no stars — the CSS default must stay dim, not gold', () => {
  const untouched: MuscleStarRow[] = [
    { muscle: 'back-mid', label: 'Hát · közép', done: 0, plan: 4, ratio: 0, stars: 0 },
  ]
  const { container } = render(<WorkoutCeremony {...props({ muscles: untouched })} />)
  const row = container.querySelector('.cer-mstar') as HTMLElement
  expect(row.querySelectorAll('.cer-starrow.mini i.is-lit')).toHaveLength(0)
  expect(row.querySelectorAll('.cer-starrow.mini i.is-half')).toHaveLength(0)
})

test('the kcal tile is hidden when unknown — no 0 kcal anywhere', () => {
  const { container } = render(<WorkoutCeremony {...props()} />)
  expect(container.querySelector('.cer-kcal')).toBeNull()
  expect(screen.queryByText(/kcal/)).not.toBeInTheDocument()
})

test('the kcal tile shows the estimate, says it is an estimate and opens Fuel', async () => {
  const user = userEvent.setup()
  const onGoFuel = vi.fn()
  render(<WorkoutCeremony {...props({ kcal: { value: 420, known: true }, onGoFuel })} />)
  expect(screen.getByText('420')).toBeInTheDocument()
  expect(screen.getByText('kcal')).toBeInTheDocument()
  expect(screen.getByText('Ennyit nyertél a mai mozgással')).toBeInTheDocument()
  expect(screen.getByText('Becslés, nem mérés')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /Ennyit nyertél a mai mozgással/ }))
  expect(onGoFuel).toHaveBeenCalledTimes(1)
})

test('the note field round-trips the closing-note draft', async () => {
  const user = userEvent.setup()
  const onNote = vi.fn()
  render(<WorkoutCeremony {...props({ note: 'Nehéz', onNote })} />)
  const field = screen.getByLabelText('Hogy ment?')
  expect(field).toHaveValue('Nehéz')
  await user.type(field, '!')
  expect(onNote).toHaveBeenCalledWith('Nehéz!')
})

test('the close CTA goes back to Mai', async () => {
  const user = userEvent.setup()
  const onClose = vi.fn()
  render(<WorkoutCeremony {...props({ onClose })} />)
  await user.click(screen.getByRole('button', { name: /Vissza a mai napra/ }))
  expect(onClose).toHaveBeenCalledTimes(1)
})

test('the honesty line says where the stars come from', () => {
  render(<WorkoutCeremony {...props()} />)
  expect(screen.getByText(
    'A csillagok a tervezett szettből, ismétlésből és súlyból számolnak, nem AI-értékelés.',
  )).toBeInTheDocument()
  // The prototype's sample-workout prefix is gone — this is real.
  expect(screen.queryByText(/Mintaedzés/)).not.toBeInTheDocument()
})

// ---- the challenge strip (T7 Task 4) ----

const CHALLENGES = [
  { id: 'c1', typeLabel: 'Súlyemelés', exercise: 'Chest Supported Row', target: '80 kg × 8', state: 'hit' as const, detail: '80 kg × 9 — cél igazolva' },
  { id: 'c2', typeLabel: 'Ismétlésszám', exercise: 'Lat Pulldown', target: '12 ismétlés', state: 'miss' as const },
  { id: 'c3', typeLabel: 'Tempó', target: '3 mp excentrikus', state: 'skipped' as const },
]

test('no challenges means no strip at all', () => {
  const { container } = render(<WorkoutCeremony {...props()} />)
  expect(container.querySelector('.cer-chals')).toBeNull()
})

test('the challenge strip carries the real outcome of every challenge, records-adjacent', () => {
  const { container } = render(<WorkoutCeremony {...props({ challenges: CHALLENGES })} />)
  const strip = container.querySelector('.cer-chals')
  expect(strip).not.toBeNull()
  // Act two owns the strip — it sits in `.cer-result`, next to the records row.
  expect(container.querySelector('.cer-result .cer-chals')).not.toBeNull()
  const rows = strip!.querySelectorAll('.cer-chal')
  expect(rows).toHaveLength(3)
  // Every row is a `.cer-record`-shaped row, toned by its outcome.
  expect(rows[0]).toHaveClass('cer-record')
  expect(rows[0]).toHaveClass('is-hit')
  expect(rows[1]).toHaveClass('is-miss')
  expect(rows[2]).toHaveClass('is-skip')
  // Title = type · exercise; the detail beats the target when the server sent one.
  expect(screen.getByText('Súlyemelés · Chest Supported Row')).toBeInTheDocument()
  expect(screen.getByText(/80 kg × 9 — cél igazolva/)).toBeInTheDocument()
  expect(screen.getByText(/12 ismétlés/)).toBeInTheDocument()
  expect(screen.getByText('Tempó')).toBeInTheDocument()
  // The verdict words are the summary's own, not restyled away.
  expect(screen.getByText('megcsináltad')).toBeInTheDocument()
  expect(screen.getByText('nem jött össze')).toBeInTheDocument()
  expect(screen.getByText('skippelted')).toBeInTheDocument()
})

test('an inconclusive challenge reads as unevaluable', () => {
  render(<WorkoutCeremony {...props({ challenges: [
    { id: 'c9', typeLabel: 'Tempó', target: '3 mp', state: 'inconclusive' as const },
  ] })} />)
  expect(screen.getByText('nem értékelhető')).toBeInTheDocument()
})

// ---- the settled recap (T7 Task 4) ----

test('the settled recap notes how many sets closed pending', () => {
  render(<WorkoutCeremony {...props({ settled: true, pendingSets: 4 })} />)
  expect(screen.getByText('4 szett kihagyott státusszal zárult.')).toBeInTheDocument()
})

test('nothing pending means no pending note', () => {
  const { container } = render(<WorkoutCeremony {...props({ settled: true, pendingSets: 0 })} />)
  expect(container.textContent).not.toMatch(/kihagyott státusszal/)
})
