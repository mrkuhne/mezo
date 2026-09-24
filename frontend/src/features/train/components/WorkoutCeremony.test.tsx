import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi, afterEach } from 'vitest'
import {
  WorkoutCeremony, ceremonyChallenges, ceremonyRecord, targetChips, type CeremonyChallenge,
} from '@/features/train/components/WorkoutCeremony'
import type { CerScore, MuscleStarRow } from '@/features/train/logic/cerScore'
import type { Challenge } from '@/data/types'

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

/** Step two is one tap away — the prototype's single `Részletek` CTA. */
async function goToDetails(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /Részletek/ }))
}

// ---- act one ----

test('reduced motion paints the final state instantly: told, full counters, stars lit to the score', () => {
  const { container } = render(<WorkoutCeremony {...props()} />)
  // No pass: the reading is revealed on the very first paint.
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
  // The reading is still held back while the pass runs.
  expect(container.querySelector('.cer-screen')).not.toHaveClass('is-told')
  rerender(<WorkoutCeremony {...props({ reducedMotion: false, minutes: 42 })} />)
  expect(raf).toHaveBeenCalledTimes(1)
})

test('the pass drives --p, the counters and the star classes, then reveals the reading', () => {
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
  // Halfway through the 1700 ms star phase: cubic ease-out 1-(1-.5)^3 = .875 of the ratio.
  frames.shift()?.(850)
  expect(Number(stage.style.getPropertyValue('--p'))).toBeCloseTo(0.7, 5)
  const root = container.querySelector('.cer-screen') as HTMLElement
  expect(root).not.toHaveClass('is-b1')
  expect(root).not.toHaveClass('is-told')
  // 2100 ms: the verdict (beat 1) and the card (beat 2) are in, the record stamp is not yet.
  frames.shift()?.(2100)
  expect(root).toHaveClass('is-b1')
  expect(root).toHaveClass('is-b2')
  expect(root).not.toHaveClass('is-b3')
  expect(root).not.toHaveClass('is-told')
  // The final frame (2700 ms) lands on the real values and tells the reading.
  act(() => { frames.shift()?.(2700) })
  expect(Number(stage.style.getPropertyValue('--p'))).toBeCloseTo(0.8, 5)
  expect(container.querySelector('[data-cer-count="sets"]')).toHaveTextContent('9')
  expect(container.querySelectorAll('.cer-stars i.is-lit')).toHaveLength(4)
  expect(container.querySelector('.cer-screen')).toHaveClass('is-told')
})

test('step one writes no star numeral — the stars themselves are the reward', () => {
  const { container } = render(<WorkoutCeremony {...props({ score: { ...SCORE, ratio: 0.9, stars: 4.5 } })} />)
  expect(screen.queryByText(/\/\s*5/)).not.toBeInTheDocument()
  const stage = container.querySelector('.cer') as HTMLElement
  expect(stage.textContent).not.toMatch(/4,5|\b4\b/)
})

const REC_ROW = { name: 'Chest Supported Row', kind: 'Súly-rekord', values: ['105 kg', '10 ism.'] }

test('the records get their OWN glass card first; the tally and the stats share the second', () => {
  const { container } = render(<WorkoutCeremony {...props({
    minutes: 47, xpGained: 240, records: [REC_ROW],
  })} />)
  const cards = container.querySelectorAll<HTMLElement>('.cer-result .cer-card.glass')
  expect(cards).toHaveLength(2)
  // Card one: the records, and nothing else.
  expect(cards[0]).toHaveClass('cer-records')
  expect(cards[0].querySelector('.cer-record')).not.toBeNull()
  expect(cards[0].querySelector('.cer-stats')).toBeNull()
  // Card two: every other number — minutes + XP and the tally.
  expect(cards[1].querySelector('.cer-stats')).not.toBeNull()
  expect(cards[1].querySelector('[data-cer-count="sets"]')).toHaveTextContent('9')
  // The counters left the stage: the hero is stars + fuse only.
  expect(container.querySelector('.cer [data-cer-count]')).toBeNull()
  expect(container.querySelector('.cer-verdict')).toHaveTextContent('Erős nap.')
})

test('the hero stars are the 3D sprite — every slot carries the lit, half and empty star', () => {
  const { container } = render(<WorkoutCeremony {...props()} />)
  const slots = container.querySelectorAll('.cer-stars i')
  slots.forEach((slot) => {
    const refs = [...slot.querySelectorAll('use')].map((u) => u.getAttribute('href'))
    expect(refs).toEqual(['#t-star-empty', '#t-star-half', '#t-star'])
  })
})

test('settled skips the pass entirely and marks the stage settled', () => {
  const raf = vi.spyOn(window, 'requestAnimationFrame')
  const { container } = render(<WorkoutCeremony {...props({ reducedMotion: false, settled: true })} />)
  expect(raf).not.toHaveBeenCalled()
  expect(container.querySelector('.cer')).toHaveClass('is-settled')
  expect(container.querySelector('.cer-screen')).toHaveClass('is-told')
})

// ---- step one: the reading ----

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

test('the records card names each record with a type chip and plain value chips; absent when none', () => {
  const { container, rerender } = render(<WorkoutCeremony {...props()} />)
  expect(container.querySelector('.cer-records')).toBeNull()
  rerender(<WorkoutCeremony {...props({ records: [
    REC_ROW,
    { name: 'Lat Pulldown', kind: 'Rep-rekord', values: ['12 ism.', '74,5 kg'] },
  ] })} />)
  expect(screen.getByText('2 új rekord')).toBeInTheDocument()
  expect(screen.getByText('Ez a tiéd mostantól')).toBeInTheDocument()
  const rows = container.querySelectorAll<HTMLElement>('.cer-rec-row')
  expect(rows).toHaveLength(2)
  expect(rows[0]).toHaveTextContent('Chest Supported Row')
  // The type chip carries its own 3D icon, then the values as lit pills — no ×, no @, no előző.
  const chip = rows[0].querySelector('.cer-tchip') as HTMLElement
  expect(chip).toHaveTextContent('Súly-rekord')
  expect(chip.querySelector('use')?.getAttribute('href')).toBe('#t-weight')
  expect([...rows[0].querySelectorAll('b.is-lit')].map((b) => b.textContent)).toEqual(['105 kg', '10 ism.'])
  expect(rows[1].querySelector('.cer-tchip use')?.getAttribute('href')).toBe('#t-repeat')
  expect(container.querySelector('.cer-records')!.textContent).not.toMatch(/×|@|előző/)
})

test('one record reads "1 új rekord"', () => {
  render(<WorkoutCeremony {...props({ records: [REC_ROW] })} />)
  expect(screen.getByText('1 új rekord')).toBeInTheDocument()
})

// ---- the stats card's Küldetések (owner-approved, mezo-me75u.4) ----

const CHALS: CeremonyChallenge[] = [
  { id: 'c1', type: 'overload', typeLabel: '⚡ Túlterhelés', exercise: 'Chest Supported Row', target: '107.5 kg × 8', status: 'hit' },
  { id: 'c2', type: 'Depth', typeLabel: 'Mélység', exercise: 'Lat Pulldown', target: 'Az utolsó szett RIR 0-ig', status: 'miss' },
  { id: 'c3', type: 'Volume', typeLabel: 'Volumen', exercise: 'Face Pull', target: '+1 szett · 4×15-20', status: 'inconclusive' },
]

test('the Küldetések section lists the accepted challenges with an outcome icon and its accessible name', () => {
  const { container } = render(<WorkoutCeremony {...props({ challenges: CHALS })} />)
  const section = container.querySelector('.cer-sum .cer-quests') as HTMLElement
  expect(section).not.toBeNull()
  expect(section).toHaveTextContent('Küldetések · 1 / 3')
  expect(screen.getByRole('img', { name: 'teljesült' })).toBeInTheDocument()
  expect(screen.getByRole('img', { name: 'nem teljesült' })).toBeInTheDocument()
  expect(screen.getByRole('img', { name: 'nem értékelhető' })).toBeInTheDocument()
  const rows = section.querySelectorAll<HTMLElement>('.cer-quest')
  expect(rows[0]).toHaveClass('is-hit')
  expect(rows[0].querySelector('.cer-quest-res use')?.getAttribute('href')).toBe('#t-tick')
  expect(rows[1]).toHaveClass('is-miss')
  expect(rows[1].querySelector('.cer-quest-res use')?.getAttribute('href')).toBe('#t-skip')
  // The type chip: 3D icon + the label, cleaned of its emoji; the target split into chips.
  const chip = rows[0].querySelector('.cer-tchip') as HTMLElement
  expect(chip.textContent).toBe('Túlterhelés')
  expect(chip.querySelector('use')?.getAttribute('href')).toBe('#t-up')
  expect([...rows[0].querySelectorAll('.cer-vals > b')].map((b) => b.textContent)).toEqual(['107,5 kg', '8 ism.'])
  expect(rows[1].querySelector('.cer-tchip use')?.getAttribute('href')).toBe('#t-hold')
  // No outcome TEXT — the icon's accessible name carries it.
  expect(section.textContent).not.toMatch(/teljesült|megcsináltad|nem jött össze/)
})

test('no accepted challenges → no Küldetések section', () => {
  const { container } = render(<WorkoutCeremony {...props({ challenges: [] })} />)
  expect(container.querySelector('.cer-quests')).toBeNull()
  expect(screen.queryByText(/Küldetések/)).not.toBeInTheDocument()
})

test('ceremonyRecord renders the medal fields as plain chips, with a decimal comma', () => {
  const base = { tier: 'RECORD', exerciseName: 'Row', date: '2026-09-24', unit: 'KG' } as const
  expect(ceremonyRecord({ ...base, type: 'WEIGHT', value: 107.5, weightKg: 107.5, reps: 10 }))
    .toEqual({ name: 'Row', kind: 'Súly-rekord', values: ['107,5 kg', '10 ism.'] })
  expect(ceremonyRecord({ ...base, type: 'REPS_AT_WEIGHT', unit: 'REPS', value: 12, weightKg: 74.5, reps: 12 }).values)
    .toEqual(['12 ism.', '74,5 kg'])
  expect(ceremonyRecord({ ...base, type: 'E1RM', value: 126.7, weightKg: 105, reps: 10 }).values).toEqual(['126,7 kg'])
  // hu-HU groups only from five digits (2450, but 12 450) — the locale's rule, not ours.
  expect(ceremonyRecord({ ...base, type: 'SESSION_VOLUME', value: 2450 }).values[0]).toMatch(/^2 ?450 kg$/)
})

test('ceremonyChallenges keeps only the accepted ones and resolves every non-hit/miss to inconclusive', () => {
  const list = [
    { id: 'a', type: 'PR', typeLabel: 'PR', exerciseId: 'x', target: '1', risk: 'low', why: '', refs: [], glory: '', status: 'hit' },
    { id: 'b', type: 'Depth', typeLabel: 'Mélység', exerciseId: 'x', target: '1', risk: 'low', why: '', refs: [], glory: '', status: 'accepted' },
    { id: 'c', type: 'Volume', typeLabel: 'Volumen', exerciseId: 'x', target: '1', risk: 'low', why: '', refs: [], glory: '', status: 'proposed' },
    { id: 'd', type: 'Tempo', typeLabel: 'Tempó', exerciseId: 'x', target: '1', risk: 'low', why: '', refs: [], glory: '', status: 'inconclusive' },
  ] as Challenge[]
  const rows = ceremonyChallenges(list, { a: true, b: true })
  expect(rows.map((r) => [r.id, r.status])).toEqual([['a', 'hit'], ['b', 'inconclusive'], ['d', 'inconclusive']])
})

test('targetChips splits on × and ·, and unit-labels the load and the reps', () => {
  expect(targetChips('107.5 kg × 8')).toEqual(['107,5 kg', '8 ism.'])
  expect(targetChips('+1 szet · 4×15-20')).toEqual(['+1 szet', '4×15-20'])
  expect(targetChips('Az utolsó szet RIR 0-ig')).toEqual(['Az utolsó szet RIR 0-ig'])
})

test('the muscle rows carry the label, done/plan and a fill width from the ratio', async () => {
  const user = userEvent.setup()
  const { container } = render(<WorkoutCeremony {...props()} />)
  await goToDetails(user)
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

test('a 0-ratio muscle row lights no stars — the CSS default must stay dim, not gold', async () => {
  const user = userEvent.setup()
  const untouched: MuscleStarRow[] = [
    { muscle: 'back-mid', label: 'Hát · közép', done: 0, plan: 4, ratio: 0, stars: 0 },
  ]
  const { container } = render(<WorkoutCeremony {...props({ muscles: untouched })} />)
  await goToDetails(user)
  const row = container.querySelector('.cer-mstar') as HTMLElement
  expect(row.querySelectorAll('.cer-starrow.mini i.is-lit')).toHaveLength(0)
  expect(row.querySelectorAll('.cer-starrow.mini i.is-half')).toHaveLength(0)
})

test('step two opens on a recap chip, then the kcal hero, then the muscle card', async () => {
  const user = userEvent.setup()
  const { container } = render(<WorkoutCeremony {...props({ kcal: { value: 420, known: true } })} />)
  await goToDetails(user)
  const screenEl = container.querySelector('.cer-details-screen') as HTMLElement
  const order = [...screenEl.querySelectorAll('.cer-recap-chip, .cer-kcal, .cer-muscles')].map((el) => el.className.split(' ')[0])
  expect(order).toEqual(['cer-recap-chip', 'cer-kcal', 'cer-muscles'])
  const chip = screenEl.querySelector('.cer-recap-chip') as HTMLElement
  expect(chip).toHaveTextContent('Erős nap.')
  expect(chip.querySelectorAll('.cer-starrow.mini i')).toHaveLength(5)
  expect(chip.querySelectorAll('.cer-starrow.mini i.is-lit')).toHaveLength(4)
})

test('each muscle row carries its MuscleMap crop, tinted in the row colour', async () => {
  const user = userEvent.setup()
  const { container } = render(<WorkoutCeremony {...props()} />)
  await goToDetails(user)
  const rows = container.querySelectorAll<HTMLElement>('.cer-mstar')
  expect(rows).toHaveLength(2)
  rows.forEach((row) => {
    expect(row.querySelector('.cer-mstar-art')).not.toBeNull()
    expect(row.style.getPropertyValue('--ex-color')).not.toBe('')
  })
})

test('the kcal tile is hidden when unknown — no 0 kcal anywhere', async () => {
  const user = userEvent.setup()
  const { container } = render(<WorkoutCeremony {...props()} />)
  await goToDetails(user)
  expect(container.querySelector('.cer-kcal')).toBeNull()
  expect(screen.queryByText(/kcal/)).not.toBeInTheDocument()
})

test('the kcal tile shows the estimate, says it is an estimate and opens Fuel', async () => {
  const user = userEvent.setup()
  const onGoFuel = vi.fn()
  render(<WorkoutCeremony {...props({ kcal: { value: 420, known: true }, onGoFuel })} />)
  await goToDetails(user)
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
  await goToDetails(user)
  const field = screen.getByLabelText('Hogy ment?')
  expect(field).toHaveValue('Nehéz')
  await user.type(field, '!')
  expect(onNote).toHaveBeenCalledWith('Nehéz!')
})

test('the close CTA goes back to Mai — from step two, where the prototype puts it', async () => {
  const user = userEvent.setup()
  const onClose = vi.fn()
  render(<WorkoutCeremony {...props({ onClose })} />)
  expect(screen.queryByRole('button', { name: /Vissza a mai napra/ })).not.toBeInTheDocument()
  await goToDetails(user)
  await user.click(screen.getByRole('button', { name: /Vissza a mai napra/ }))
  expect(onClose).toHaveBeenCalledTimes(1)
})

test('the honesty line says where the stars come from', async () => {
  const user = userEvent.setup()
  render(<WorkoutCeremony {...props()} />)
  await goToDetails(user)
  expect(screen.getByText(
    'A csillagok a tervezett szettből, ismétlésből és súlyból számolnak, nem AI-értékelés.',
  )).toBeInTheDocument()
  // The prototype's sample-workout prefix is gone — this is real.
  expect(screen.queryByText(/Mintaedzés/)).not.toBeInTheDocument()
})

// ---- the two steps (mezo-e1ii9, Task 3) ----

test('step one is the prototype\'s: the reading, and exactly ONE way on', () => {
  const { container } = render(<WorkoutCeremony {...props({
    minutes: 47, xpGained: 240, kcal: { value: 420, known: true },
  })} />)
  // The step-one screen, not the details screen.
  expect(container.querySelector('.cer-screen')).not.toBeNull()
  expect(container.querySelector('.cer-details-screen')).toBeNull()
  // Its own content: eyebrow, stars, bar, counters, the sr-only star heading, the stats.
  expect(screen.getByText('EDZÉS LEZÁRVA')).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('4 csillag')
  expect(screen.getByText('a pulton töltött idő')).toBeInTheDocument()
  expect(screen.getByText('szerzett XP')).toBeInTheDocument()
  // Step two's content is NOT here.
  expect(screen.queryByText('Izomcsoportok fejlődése a mai edzésen')).not.toBeInTheDocument()
  expect(container.querySelector('.cer-kcal')).toBeNull()
  expect(screen.queryByLabelText('Hogy ment?')).not.toBeInTheDocument()
  // Exactly one button on the screen, and it is the prototype's `Részletek`.
  const buttons = screen.getAllByRole('button')
  expect(buttons).toHaveLength(1)
  expect(buttons[0]).toHaveTextContent('Részletek')
  expect(buttons[0]).toHaveTextContent('Izomcsoportok és a nyert kalória')
})

test('Részletek opens step two: the muscle rows, the kcal tile, the close CTA and the way back', async () => {
  const user = userEvent.setup()
  const { container } = render(<WorkoutCeremony {...props({ kcal: { value: 420, known: true } })} />)
  await goToDetails(user)
  expect(container.querySelector('.cer-details-screen')).not.toBeNull()
  expect(container.querySelector('.cer-screen')).toBeNull()
  expect(screen.getByText('Izomcsoportok fejlődése a mai edzésen')).toBeInTheDocument()
  expect(container.querySelectorAll('.cer-mstar')).toHaveLength(2)
  expect(screen.getByText('Ennyit nyertél a mai mozgással')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Vissza a mai napra/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Vissza az értékeléshez' })).toBeInTheDocument()
  // The prototype's footnote about the stars stays on step two.
  expect(screen.getByText(/A csillagok a tervezett szettből/)).toBeInTheDocument()
  // Step one's ceremony stage is gone while step two is up.
  expect(container.querySelector('.cer-stars')).toBeNull()
})

// Fix round 1 (mezo-e1ii9 Task 3): step two's focus target used to live inside the
// `muscles.length > 0` block — a session with no muscle rows left focus on <body>.
test('step two takes focus even when the session has no muscle rows', async () => {
  const user = userEvent.setup()
  render(<WorkoutCeremony {...props({ muscles: [] })} />)
  await goToDetails(user)
  const heading = screen.getByRole('heading', { level: 2 })
  expect(heading).toHaveFocus()
  expect(screen.queryByText('Izomcsoportok fejlődése a mai edzésen')).not.toBeInTheDocument()
})

test('Vissza az értékeléshez returns to step one — and never replays the ceremony', async () => {
  const user = userEvent.setup()
  const raf = vi.spyOn(window, 'requestAnimationFrame')
  const { container } = render(<WorkoutCeremony {...props({ xpGained: 240 })} />)
  await goToDetails(user)
  await user.click(screen.getByRole('button', { name: 'Vissza az értékeléshez' }))
  expect(container.querySelector('.cer-screen')).not.toBeNull()
  expect(screen.getByText('szerzett XP')).toBeInTheDocument()
  expect(screen.getAllByRole('button')).toHaveLength(1)
  // Reduced motion → no pass was ever scheduled, and the round trip scheduled none either.
  expect(raf).not.toHaveBeenCalled()
  // Step one comes back already told, with its real counters.
  expect(container.querySelector('.cer-screen')).toHaveClass('is-told')
  expect(container.querySelector('[data-cer-count="sets"]')).toHaveTextContent('9')
})

test('leaving step one mid-pass still brings back the FINAL numbers, not zeroes', () => {
  const frames: FrameRequestCallback[] = []
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
    frames.push(cb); return frames.length
  })
  vi.spyOn(performance, 'now').mockReturnValue(0)
  const { container } = render(<WorkoutCeremony {...props({ reducedMotion: false })} />)
  expect(container.querySelector('[data-cer-count="sets"]')).toHaveTextContent('0')
  // Step two, mid-pass: the stage leaves the DOM and the frame loop stops.
  act(() => { screen.getByRole('button', { name: /Részletek/ }).click() })
  act(() => { frames.shift()?.(600) })
  // Back to step one — React owns the counters now, and paints the real values.
  act(() => { screen.getByRole('button', { name: 'Vissza az értékeléshez' }).click() })
  expect(container.querySelector('.cer-screen')).toHaveClass('is-told')
  expect(container.querySelector('[data-cer-count="sets"]')).toHaveTextContent('9')
  expect(container.querySelectorAll('.cer-stars i.is-lit')).toHaveLength(4)
})

// ---- what the prototype's ceremony does NOT have (mezo-e1ii9, Task 3) ----

test('the old küldetés strip and its outcome copy stay gone — step two carries no challenges', async () => {
  const user = userEvent.setup()
  const { container } = render(<WorkoutCeremony {...props({ kcal: { value: 420, known: true }, challenges: CHALS })} />)
  expect(container.querySelector('.cer-chals')).toBeNull()
  expect(container.textContent).not.toMatch(/skippelted|megcsináltad|nem értékelhető/i)
  await goToDetails(user)
  expect(container.querySelector('.cer-chals')).toBeNull()
  expect(container.querySelector('.cer-quests')).toBeNull()
})

test('no streak line anywhere — the ceremony carries its own XP and nothing else', async () => {
  const user = userEvent.setup()
  const { container } = render(<WorkoutCeremony {...props({ xpGained: 480 })} />)
  expect(container.textContent).not.toMatch(/napos sorozat/)
  await goToDetails(user)
  expect(container.textContent).not.toMatch(/napos sorozat/)
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
