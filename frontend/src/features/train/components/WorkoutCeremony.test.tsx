import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi, afterEach } from 'vitest'
import {
  WorkoutCeremony, ceremonyChallenges, ceremonyRecord, type CeremonyChallenge,
} from '@/features/train/components/WorkoutCeremony'
import type { CerScore, MuscleStarRow } from '@/features/train/logic/cerScore'
import type { Challenge } from '@/data/types'

// The details step reads the Fuel day's frame itself when no `dayKcal` is handed in. One switchable stub stands in
// for the hook, so the three faces (frame known / no frame / still loading) are testable without a query client.
const fuelDay = vi.hoisted(() => ({ energy: { baseKcal: 3100 } as { baseKcal: number } | null, isPending: false, isError: false }))
vi.mock('@/data/fuel/fuelHooks', () => ({
  useFuelDay: () => ({ fuel: { energy: fuelDay.energy }, isPending: fuelDay.isPending, isError: fuelDay.isError, refetch: () => {} }),
}))

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

afterEach(() => {
  vi.restoreAllMocks()
  fuelDay.energy = { baseKcal: 3100 }
  fuelDay.isPending = false
  fuelDay.isError = false
})

/** Step two is one tap away — the prototype's single `Részletek` CTA. */
async function goToDetails(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /Részletek/ }))
}

// ---- step one: the stage ----

test('reduced motion paints the final state instantly: told, full counters, stars lit to the score', () => {
  const { container } = render(<WorkoutCeremony {...props()} />)
  // No pass: every beat is on the root on the very first paint.
  expect(container.querySelector('.fo-cer')).toHaveClass('b1', 'b2', 'b3', 'told', 'inst')
  const stage = container.querySelector('[data-cer-stage]') as HTMLElement
  expect(stage.style.getPropertyValue('--p')).toBe('0.8')
  // Counters sit at the session's real done values (volume hu-grouped, digits asserted).
  const counts = [...container.querySelectorAll('.ec-tally [data-cer-count]')].map((el) => el.textContent)
  expect(counts[0]).toBe('9')
  expect(counts[1]).toBe('96')
  expect(counts[2]).toMatch(/^7\D?200$/)
  expect(screen.getByText('szett')).toBeInTheDocument()
  expect(screen.getByText('ismétlés')).toBeInTheDocument()
  // Wording (README (c)): „kg × ism", never „rep".
  expect(screen.getByText('kg × ism')).toBeInTheDocument()
  expect(screen.queryByText('kg × rep')).not.toBeInTheDocument()
  // 4 stars of 5: four lit, none half.
  const stars = container.querySelectorAll('.fo-cer-stars i')
  expect(stars).toHaveLength(5)
  expect(container.querySelectorAll('.fo-cer-stars i.is-lit')).toHaveLength(4)
  expect(container.querySelectorAll('.fo-cer-stars i.is-half')).toHaveLength(0)
})

test('a half star lights the next star as half', () => {
  const half = { ...SCORE, ratio: 0.9, stars: 4.5 }
  const { container } = render(<WorkoutCeremony {...props({ score: half })} />)
  expect(container.querySelectorAll('.fo-cer-stars i.is-lit')).toHaveLength(4)
  expect(container.querySelectorAll('.fo-cer-stars i.is-half')).toHaveLength(1)
})

test('the title row is the screen\'s heading and takes focus; the stage says the stars with a Hungarian decimal comma', () => {
  const { container } = render(<WorkoutCeremony {...props({ score: { ...SCORE, ratio: 0.9, stars: 4.5 } })} />)
  // `/train/session` is chrome-free: the screen draws its own title row (back · context · title).
  const heading = screen.getByRole('heading', { level: 1 })
  expect(heading).toHaveTextContent('Edzés lezárva')
  expect(heading).toHaveFocus()
  expect(container.querySelector('.ec-top .fo-trow .fo-back')).not.toBeNull()
  // The stars in words — the old sr-only announcement is the stage's visible overline now.
  expect(container.querySelector('.fo-cer-stage .fo-hero-lbl')).toHaveTextContent('Így sikerült · 4,5 csillag az ötből')
})

test('the title row\'s context line is the caller\'s workout („Pull Day · szept 24."), with a plain fallback', () => {
  const { container, rerender } = render(<WorkoutCeremony {...props()} />)
  expect(container.querySelector('.ec-top small')).toHaveTextContent('Edzés · ma')
  rerender(<WorkoutCeremony {...props({ context: 'Pull Day · szept 24.' })} />)
  expect(container.querySelector('.ec-top small')).toHaveTextContent('Pull Day · szept 24.')
  // The Üveg overline is gone (README (c): „EDZÉS LEZÁRVA" → „Így sikerült · N csillag az ötből").
  rerender(<WorkoutCeremony {...props({ eyebrow: 'EDZÉS LEZÁRVA' })} />)
  expect(screen.queryByText('EDZÉS LEZÁRVA')).not.toBeInTheDocument()
})

test('the title row\'s back button is the way out to Mai', async () => {
  const user = userEvent.setup()
  const onClose = vi.fn()
  render(<WorkoutCeremony {...props({ onClose })} />)
  await user.click(screen.getByRole('button', { name: 'Bezárás' }))
  expect(onClose).toHaveBeenCalledTimes(1)
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
  expect(container.querySelector('.fo-cer')).not.toHaveClass('told')
  expect(container.querySelector('.fo-cer')).not.toHaveClass('b1')
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
  const stage = container.querySelector('[data-cer-stage]') as HTMLElement
  expect(stage.style.getPropertyValue('--p')).toBe('0')
  expect(container.querySelector('.ec-tally [data-cer-count]')).toHaveTextContent('0')
  // mezo-7tj3j: az első frame horgonyoz (started = az első rAF-időbélyeg), utána mér.
  frames.shift()?.(0)
  // Halfway through the 1700 ms star phase: cubic ease-out 1-(1-.5)^3 = .875 of the ratio.
  frames.shift()?.(850)
  expect(Number(stage.style.getPropertyValue('--p'))).toBeCloseTo(0.7, 5)
  const root = container.querySelector('.fo-cer') as HTMLElement
  expect(root).not.toHaveClass('b1')
  expect(root).not.toHaveClass('told')
  // 2100 ms: the verdict (beat 1) and the numbers (beat 2) are in, beat 3 is not yet.
  frames.shift()?.(2100)
  expect(root).toHaveClass('b1')
  expect(root).toHaveClass('b2')
  expect(root).not.toHaveClass('b3')
  expect(root).not.toHaveClass('told')
  // The final frame (2700 ms) lands on the real values and tells the reading.
  act(() => { frames.shift()?.(2700) })
  expect(Number(stage.style.getPropertyValue('--p'))).toBeCloseTo(0.8, 5)
  expect(container.querySelector('.ec-tally [data-cer-count]')).toHaveTextContent('9')
  expect(container.querySelectorAll('.fo-cer-stars i.is-lit')).toHaveLength(4)
  expect(root).toHaveClass('told')
})

test('the level, the stars and the counters are frame-driven — the stage carries no inline transition and no old skin', () => {
  const { container } = render(<WorkoutCeremony {...props({ minutes: 47, xpGained: 240, records: [REC_ROW], challenges: CHALS })} />)
  // Nothing of the Üveg ceremony is left in the markup (the meal ceremony still owns `.cer-*`).
  expect(container.querySelector('[class*="cer-screen"], [class^="cer-"], [class*=" cer-"], .glass, [class*="uv-"]')).toBeNull()
  // No fuse bar, no comet: the level is the cup.
  expect(container.querySelector('.fo-cup svg')?.getAttribute('viewBox')).toBe('0 -34 200 166')
})

test('step one writes no star numeral beside the stars — the stars and the cup are the reward', () => {
  const { container } = render(<WorkoutCeremony {...props({ score: { ...SCORE, ratio: 0.9, stars: 4.5 } })} />)
  expect(screen.queryByText(/\/\s*5/)).not.toBeInTheDocument()
  // The only place the score is written is the overline; the verdict and its line carry no number.
  const reading = container.querySelector('.fo-cer-stage .fo-cer-res') as HTMLElement
  expect(reading.textContent).not.toMatch(/\d/)
})

const REC_ROW = { name: 'Chest Supported Row', kind: 'Súly-rekord', values: ['105 kg', '10 ism.'], prevShare: 80 }

test('the records get their OWN gold card first (with the verdict); the numbers come in their own card on beat 2', () => {
  const { container } = render(<WorkoutCeremony {...props({
    minutes: 47, xpGained: 240, records: [REC_ROW],
  })} />)
  const reveals = [...container.querySelectorAll<HTMLElement>('.fo-cer > .fo-cer-res, .fo-cer > .fo-cer-card')]
  expect(reveals.map((el) => el.className)).toEqual(['fo-cer-res ec-records', 'fo-cer-card ec-numbers'])
  // Card one: the records, and nothing else.
  const gold = reveals[0].querySelector('.fo-card') as HTMLElement
  expect(gold).toHaveClass('gold')
  expect(gold.querySelector('[data-cer-count]')).toBeNull()
  // Card two: every other number — minutes + XP and the tally. It is not gold.
  const numbers = reveals[1].querySelector('.fo-card') as HTMLElement
  expect(numbers).not.toHaveClass('gold')
  expect(numbers.querySelector('.ec-top-facts')).not.toBeNull()
  expect(numbers.querySelector('.ec-tally [data-cer-count]')).toHaveTextContent('9')
  // The counters are not on the stage: the hero is stars + cup + the verdict.
  expect(container.querySelector('.fo-cer-stage [data-cer-count]')).toBeNull()
  expect(container.querySelector('.fo-cer-stage .fo-hero-verdict')).toHaveTextContent('Erős nap.')
  // The sections are numbered in the order they appear.
  expect([...container.querySelectorAll('.fo-sec')].map((h) => h.textContent)).toEqual(['1Ez a tiéd mostantól · 1 új rekord', '2A mai számok'])
})

test('the hero stars are the sprite — every slot carries the empty, half and lit star', () => {
  const { container } = render(<WorkoutCeremony {...props()} />)
  const slots = container.querySelectorAll('.fo-cer-stars i')
  expect(slots).toHaveLength(5)
  slots.forEach((slot) => {
    const refs = [...slot.querySelectorAll('use')].map((u) => u.getAttribute('href'))
    expect(refs).toEqual(['#t-star-empty', '#t-star-half', '#t-star'])
  })
})

test('the cup spills only when a record was set — five drops INSIDE the cup\'s own graphic, and the line says so', () => {
  const { container, rerender } = render(<WorkoutCeremony {...props()} />)
  expect(container.querySelectorAll('.fo-cup svg .sp')).toHaveLength(0)
  expect(screen.getByText('A kehely a tervedhez mérve telt meg.')).toBeInTheDocument()
  rerender(<WorkoutCeremony {...props({ records: [REC_ROW] })} />)
  expect(container.querySelectorAll('.fo-cup svg .sp')).toHaveLength(5)
  expect(screen.getByText('A kehely a tervedhez mérve telt meg — ami kicsordult, az új rekord.')).toBeInTheDocument()
})

test('settled skips the pass entirely and paints the end state without motion', () => {
  const raf = vi.spyOn(window, 'requestAnimationFrame')
  const { container } = render(<WorkoutCeremony {...props({ reducedMotion: false, settled: true })} />)
  expect(raf).not.toHaveBeenCalled()
  expect(container.querySelector('.fo-cer')).toHaveClass('told', 'inst')
  expect((container.querySelector('[data-cer-stage]') as HTMLElement).style.getPropertyValue('--p')).toBe('0.8')
})

// ---- step one: the reading ----

test('the verdict sentence comes from the star count', () => {
  render(<WorkoutCeremony {...props()} />)
  expect(screen.getByText('Erős nap.')).toBeInTheDocument()
})

test('no minutes, no XP and no kcal means no top facts at all — never a fabricated 0', () => {
  const { container } = render(<WorkoutCeremony {...props()} />)
  expect(container.querySelector('.ec-top-facts')).toBeNull()
  expect(screen.queryByText('szerzett XP')).not.toBeInTheDocument()
  expect(screen.queryByText(/a pulton töltött idő/)).not.toBeInTheDocument()
  expect(screen.queryByText(/kcal/)).not.toBeInTheDocument()
})

test('the +XP fact shows only when the finish response carried XP', () => {
  render(<WorkoutCeremony {...props({ xpGained: 240 })} />)
  expect(screen.getByText('+240')).toBeInTheDocument()
  expect(screen.getByText('szerzett XP')).toBeInTheDocument()
  // Minutes stay absent — the page passes null (no measured duration exists).
  expect(screen.queryByText(/a pulton töltött idő/)).not.toBeInTheDocument()
})

test('the minutes fact shows only when a measured value is passed', () => {
  render(<WorkoutCeremony {...props({ minutes: 47 })} />)
  expect(screen.getByText('47′')).toBeInTheDocument()
  expect(screen.getByText('a pulton töltött idő')).toBeInTheDocument()
})

test('the earned kcal is the third top fact, marked as an estimate; absent when unknown', () => {
  const { container, rerender } = render(<WorkoutCeremony {...props({ minutes: 47, xpGained: 240, kcal: { value: 460, known: true } })} />)
  const facts = [...container.querySelectorAll('.ec-top-facts > div')].map((d) => d.textContent)
  expect(facts).toEqual(['47′a pulton töltött idő', '+240szerzett XP', '+460kcal · becslés'])
  rerender(<WorkoutCeremony {...props({ minutes: 47, xpGained: 240 })} />)
  expect(container.querySelectorAll('.ec-top-facts > div')).toHaveLength(2)
  expect(screen.queryByText(/kcal/)).not.toBeInTheDocument()
})

test('the records card names each record with its kind and plain values on a record capsule; absent when none', () => {
  const { container, rerender } = render(<WorkoutCeremony {...props()} />)
  expect(container.querySelector('.ec-records')).toBeNull()
  rerender(<WorkoutCeremony {...props({ records: [
    REC_ROW,
    { name: 'Lat Pulldown', kind: 'Rep-rekord', values: ['12 ism.', '74,5 kg'] },
  ] })} />)
  expect(screen.getByText('Ez a tiéd mostantól · 2 új rekord')).toBeInTheDocument()
  const rows = container.querySelectorAll<HTMLElement>('.ec-records .fo-row')
  expect(rows).toHaveLength(2)
  expect(rows[0].querySelector('strong')).toHaveTextContent('Chest Supported Row')
  // The kind carries its own glyph; the values follow plainly — the first loud, the second quiet. No ×, no @, no előző.
  const kind = rows[0].querySelector('.ex-qt') as HTMLElement
  expect(kind).toHaveTextContent('Súly-rekord')
  expect(kind.querySelector('use')?.getAttribute('href')).toBe('#t-weight')
  expect(rows[0].querySelector('.v')).toHaveTextContent('105 kg 10 ism.')
  expect(rows[0].querySelector('.v small')).toHaveTextContent('10 ism.')
  expect(rows[1].querySelector('.ex-qt use')?.getAttribute('href')).toBe('#t-repeat')
  expect(container.querySelector('.ec-records')!.textContent).not.toMatch(/×|@|előző/)
  // The capsule shows where the OLD record stood (a dashed line) only when the medal knows it.
  expect((rows[0].querySelector('.ex-rc u') as HTMLElement).style.bottom).toBe('80%')
  expect(rows[1].querySelector('.ex-rc')).not.toBeNull()
  expect(rows[1].querySelector('.ex-rc u')).toBeNull()
})

test('one record reads "1 új rekord"', () => {
  render(<WorkoutCeremony {...props({ records: [REC_ROW] })} />)
  expect(screen.getByText('Ez a tiéd mostantól · 1 új rekord')).toBeInTheDocument()
})

// ---- Küldetések (owner-approved, mezo-me75u.4; Folyadék: capsule + outcome pill) ----

const CHALS: CeremonyChallenge[] = [
  { id: 'c1', type: 'overload', typeLabel: '⚡ Túlterhelés', exercise: 'Chest Supported Row', target: '107.5 kg × 8', status: 'hit' },
  { id: 'c2', type: 'Depth', typeLabel: 'Mélység', exercise: 'Lat Pulldown', target: 'Az utolsó szett RIR 0-ig', status: 'miss' },
  { id: 'c3', type: 'Volume', typeLabel: 'Volumen', exercise: 'Face Pull', target: '+1 szett · 4×15-20', status: 'inconclusive' },
]

test('the Küldetések section lists the accepted quests with a capsule and the outcome in words at the row\'s end', () => {
  const { container } = render(<WorkoutCeremony {...props({ challenges: CHALS })} />)
  expect(screen.getByText('Küldetések · 1 / 3')).toBeInTheDocument()
  const section = container.querySelector('.ec-numbers .ec-quests') as HTMLElement
  expect(section).not.toBeNull()
  const rows = section.querySelectorAll<HTMLElement>('.fo-row')
  expect(rows).toHaveLength(3)
  // Three outcomes: came through (full capsule + the green pill), did not, could not be judged (both quiet).
  expect(rows[0]).toHaveAttribute('data-outcome', 'hit')
  expect(rows[0].querySelector('.ex-qc')).toHaveClass('on')
  expect(rows[0].querySelector('.fo-st')).toHaveClass('ok')
  expect(rows[0].querySelector('.fo-st')).toHaveTextContent('teljesült')
  expect(rows[1]).toHaveAttribute('data-outcome', 'miss')
  expect(rows[1].querySelector('.ex-qc')).not.toHaveClass('on')
  expect(rows[1].querySelector('.fo-st')).toHaveClass('q')
  expect(rows[1].querySelector('.fo-st')).toHaveTextContent('nem jött össze')
  expect(rows[2]).toHaveAttribute('data-outcome', 'inconclusive')
  expect(rows[2].querySelector('.ex-qc')).not.toHaveClass('on')
  expect(rows[2].querySelector('.fo-st')).toHaveTextContent('nem értékelhető')
  // A miss is never the bad tone — the closing screen does not punish.
  expect(section.querySelector('.fo-st.bad, .fo-st.warn')).toBeNull()
  // Name, then ONE line: the kind (cleaned of its emoji) and the target in the app's own number format.
  expect(rows[0].querySelector('strong')).toHaveTextContent('Chest Supported Row')
  expect(rows[0].querySelector('small')).toHaveTextContent('Túlterhelés · 107,5 kg · 8 ism.')
  expect(rows[1].querySelector('small')).toHaveTextContent('Mélység · RIR 0 · utolsó szett')
  // The Üveg outcome words are gone (README (c)).
  expect(section.textContent).not.toMatch(/megcsináltad|skippelted|nem teljesült/)
})

test('no accepted quests → no Küldetések section', () => {
  const { container } = render(<WorkoutCeremony {...props({ challenges: [] })} />)
  expect(container.querySelector('.ec-quests')).toBeNull()
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

// ---- step two: Részletek ----

test('the muscle rows carry the chip, the label, their own stars and done / plan', async () => {
  const user = userEvent.setup()
  const { container } = render(<WorkoutCeremony {...props()} />)
  await goToDetails(user)
  expect(screen.getByText('A mai edzésen · izomcsoportok')).toBeInTheDocument()
  const rows = container.querySelectorAll<HTMLElement>('.ec-muscles .ex-mstar')
  expect(rows).toHaveLength(2)
  expect(screen.getByText('Hát · közép')).toBeInTheDocument()
  expect(screen.getByText('5 / 6 szett')).toBeInTheDocument()
  expect(screen.getByText('Bicepsz')).toBeInTheDocument()
  expect(screen.getByText('2 / 4 szett')).toBeInTheDocument()
  // The stars are drawn from the row's own ratio, by the stage's thresholds: 5/6 → 4, 0.5 → 2,5.
  expect(rows[0].querySelector('.ex-stars')).toHaveAccessibleName('4 csillag az ötből')
  expect(rows[1].querySelector('.ex-stars')).toHaveAccessibleName('2,5 csillag az ötből')
  expect(rows[0].querySelectorAll('.ex-stars use')).toHaveLength(5)
  // No fill bar any more: the stars are the row's only measure.
  expect(rows[1].querySelector('.fill')).toBeNull()
})

test('a 0-ratio muscle row lights no stars — five empty ones, never a gold default', async () => {
  const user = userEvent.setup()
  const untouched: MuscleStarRow[] = [
    { muscle: 'back-mid', label: 'Hát · közép', done: 0, plan: 4, ratio: 0, stars: 0 },
  ]
  const { container } = render(<WorkoutCeremony {...props({ muscles: untouched })} />)
  await goToDetails(user)
  const refs = [...container.querySelectorAll('.ec-muscles .ex-mstar .ex-stars use')].map((u) => u.getAttribute('href'))
  expect(refs).toEqual(Array(5).fill('#t-star-empty'))
})

test('step two opens on the kcal hero (with step one\'s stars and verdict in it), then the muscle card, then the note', async () => {
  const user = userEvent.setup()
  const { container } = render(<WorkoutCeremony {...props({ kcal: { value: 420, known: true }, dayKcal: 3100 })} />)
  await goToDetails(user)
  const page = container.querySelector('.ec-details') as HTMLElement
  const order = [...page.querySelectorAll(':scope > .ec-top, :scope > .ec-kc, :scope > .ec-muscles, :scope > .ec-note, :scope > .fo-foot')]
    .map((el) => el.className.split(' ').find((c) => c.startsWith('ec-') || c === 'fo-foot'))
  expect(order).toEqual(['ec-top', 'ec-kc', 'ec-muscles', 'ec-note', 'fo-foot'])
  // The recap: step one's verdict in one line, so step two reads as its sequel.
  const recap = page.querySelector('.ec-kc .ec-ms') as HTMLElement
  expect(recap).toHaveTextContent('Erős nap.')
  expect(recap.querySelector('.ex-stars')).toHaveAccessibleName('4 csillag az ötből')
  expect([...page.querySelectorAll('.fo-sec')].map((h) => h.textContent)).toEqual(['1A mai edzésen · izomcsoportok', '2Hogy ment?'])
})

test('each muscle row carries its muscle chip', async () => {
  const user = userEvent.setup()
  const { container } = render(<WorkoutCeremony {...props()} />)
  await goToDetails(user)
  const rows = container.querySelectorAll<HTMLElement>('.ec-muscles .ex-mstar')
  expect(rows).toHaveLength(2)
  rows.forEach((row) => expect(row.querySelector('.ex-mchp')).not.toBeNull())
})

test('no kcal → the quiet hero: the verdict and the stars, no kcal anywhere, nothing to open', async () => {
  const user = userEvent.setup()
  const onGoFuel = vi.fn()
  const { container } = render(<WorkoutCeremony {...props({ score: { ...SCORE, ratio: 0.9, stars: 4.5 }, onGoFuel })} />)
  // Step one's button names what step two holds.
  expect(screen.getByRole('button', { name: 'Részletek · izomcsoportok' })).toBeInTheDocument()
  await goToDetails(user)
  expect(container.querySelector('.ec-kc')).toBeNull()
  expect(screen.queryByText(/kcal/)).not.toBeInTheDocument()
  const hero = container.querySelector('.ec-quiet') as HTMLElement
  expect(hero.querySelector('.fo-hero-lbl')).toHaveTextContent('Így sikerült')
  expect(hero.querySelector('.fo-hero-verdict')).toHaveTextContent('Erős nap.')
  expect(hero.querySelector('.fo-hero-sub')).toHaveTextContent('4,5 csillag az ötből.')
  expect(hero.querySelector('.ex-stars')).not.toBeNull()
  expect(screen.queryByRole('button', { name: 'Megnézem a Fuelben' })).not.toBeInTheDocument()
  await user.click(hero)
  expect(onGoFuel).not.toHaveBeenCalled()
})

test('the kcal hero shows the estimate in the day\'s bowl, says it is an estimate, and the WHOLE hero opens Fuel', async () => {
  const user = userEvent.setup()
  const onGoFuel = vi.fn()
  const { container } = render(<WorkoutCeremony {...props({ kcal: { value: 420, known: true }, dayKcal: 3100, onGoFuel })} />)
  expect(screen.getByRole('button', { name: 'Részletek · izmok és a nyert kalória' })).toBeInTheDocument()
  await goToDetails(user)
  const hero = container.querySelector('.ec-kc') as HTMLElement
  expect(hero).toHaveAttribute('data-frame', 'known')
  expect(hero.querySelector('.fo-hero-lbl')).toHaveTextContent('A mai mozgással')
  expect(hero.querySelector('.fo-hero-verdict')).toHaveTextContent('+420 kcal került a mai keretedbe.')
  expect(screen.getByText('Ennyit nyertél a mai mozgással · becslés, nem mérés.')).toBeInTheDocument()
  // The bowl: the day's frame with today's movement poured on top, and the key that names the two.
  expect(hero.querySelector('.fo-hero-left svg.ex-bowl')).not.toBeNull()
  const key = hero.querySelector('.fo-lg') as HTMLElement
  expect(key).toHaveTextContent(/3\D?100 kcal a napi kereted/)
  expect(key).toHaveTextContent('+420 kcal a mai edzés')
  // The link is the hero's button; a tap anywhere on the hero does the same — once.
  await user.click(screen.getByRole('button', { name: 'Megnézem a Fuelben' }))
  expect(onGoFuel).toHaveBeenCalledTimes(1)
  await user.click(hero.querySelector('.fo-hero-verdict') as HTMLElement)
  expect(onGoFuel).toHaveBeenCalledTimes(2)
})

test('without the day\'s frame the bowl does not stand in for the number: the bowl glyph, no key', async () => {
  const user = userEvent.setup()
  const { container } = render(<WorkoutCeremony {...props({ kcal: { value: 420, known: true }, dayKcal: null })} />)
  await goToDetails(user)
  const hero = container.querySelector('.ec-kc') as HTMLElement
  expect(hero).toHaveAttribute('data-frame', 'none')
  expect(hero.querySelector('.ex-bowl')).toBeNull()
  expect(hero.querySelector('.fo-hero-left .fo-bub use')?.getAttribute('href')).toBe('#t-bowl')
  expect(hero.querySelector('.fo-lg')).toBeNull()
  expect(hero.querySelector('.fo-hero-verdict')).toHaveTextContent('+420 kcal került a mai keretedbe.')
  expect(screen.getByRole('button', { name: 'Megnézem a Fuelben' })).toBeInTheDocument()
})

test('with no frame handed in, the details step reads the Fuel day itself — and falls back while it loads, fails or has none', async () => {
  const user = userEvent.setup()
  const { container, unmount } = render(<WorkoutCeremony {...props({ kcal: { value: 420, known: true } })} />)
  await goToDetails(user)
  expect(container.querySelector('.ec-kc')).toHaveAttribute('data-frame', 'known')
  expect(container.querySelector('.ec-kc .fo-lg')).toHaveTextContent(/3\D?100 kcal a napi kereted/)
  unmount()
  for (const state of [{ energy: null }, { isPending: true }, { isError: true }]) {
    Object.assign(fuelDay, { energy: { baseKcal: 3100 }, isPending: false, isError: false }, state)
    const r = render(<WorkoutCeremony {...props({ kcal: { value: 420, known: true } })} />)
    await goToDetails(user)
    expect(r.container.querySelector('.ec-kc')).toHaveAttribute('data-frame', 'none')
    expect(r.container.querySelector('.ec-kc .ex-bowl')).toBeNull()
    r.unmount()
  }
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

test('the note sits in the flow ABOVE the floating way out, with its mic and the auto-save line', async () => {
  const user = userEvent.setup()
  const { container } = render(<WorkoutCeremony {...props()} />)
  await goToDetails(user)
  const card = container.querySelector('.ec-note') as HTMLElement
  expect(card.querySelector('.vfield textarea.fo-in')).toBe(screen.getByLabelText('Hogy ment?'))
  expect(screen.getByRole('button', { name: 'Diktálás' })).toBeInTheDocument()
  expect(screen.getByText('Nem kötelező — később is hozzáírhatod. Magától mentjük, amikor kilépsz.')).toBeInTheDocument()
  // In flow, before the foot: the keyboard pushes the button instead of covering the field.
  const foot = container.querySelector('.ec-details > .fo-foot') as HTMLElement
  expect(card.compareDocumentPosition(foot) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(foot.contains(card)).toBe(false)
})

test('the close button goes back to Mai — from step two; step one\'s only way out is its title row', async () => {
  const user = userEvent.setup()
  const onClose = vi.fn()
  render(<WorkoutCeremony {...props({ onClose })} />)
  expect(screen.queryByRole('button', { name: /lezárva és elmentve/ })).not.toBeInTheDocument()
  await goToDetails(user)
  await user.click(screen.getByRole('button', { name: 'Vissza a mai napra · lezárva és elmentve' }))
  expect(onClose).toHaveBeenCalledTimes(1)
})

test('the honesty line says where the stars come from — also when there are no muscle rows', async () => {
  const user = userEvent.setup()
  const line = 'A csillagok a tervezett szettből, ismétlésből és súlyból számolnak, nem gépi értékelés.'
  const { unmount } = render(<WorkoutCeremony {...props()} />)
  await goToDetails(user)
  expect(screen.getByText(line)).toBeInTheDocument()
  // Wording (README (c)): „nem gépi értékelés"; and the prototype's sample-workout prefix stays gone — this is real.
  expect(screen.queryByText(/AI-értékelés/)).not.toBeInTheDocument()
  expect(screen.queryByText(/Mintaedzés/)).not.toBeInTheDocument()
  unmount()
  render(<WorkoutCeremony {...props({ muscles: [] })} />)
  await goToDetails(user)
  expect(screen.getAllByText(line)).toHaveLength(1)
})

// ---- the two steps (mezo-e1ii9, Task 3) ----

test('step one is the reading, and exactly ONE way on', () => {
  const { container } = render(<WorkoutCeremony {...props({
    minutes: 47, xpGained: 240, kcal: { value: 420, known: true },
  })} />)
  // The step-one screen, not the details screen.
  expect(container.querySelector('.ec-summary')).not.toBeNull()
  expect(container.querySelector('.ec-details')).toBeNull()
  // Its own content: the title, the stars in words, the cup, the numbers.
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Edzés lezárva')
  expect(screen.getByText('Így sikerült · 4 csillag az ötből')).toBeInTheDocument()
  expect(screen.getByText('a pulton töltött idő')).toBeInTheDocument()
  expect(screen.getByText('szerzett XP')).toBeInTheDocument()
  // Step two's content is NOT here.
  expect(screen.queryByText('A mai edzésen · izomcsoportok')).not.toBeInTheDocument()
  expect(container.querySelector('.ec-kc')).toBeNull()
  expect(screen.queryByLabelText('Hogy ment?')).not.toBeInTheDocument()
  // One way on in the floating bar (the title row's back is the way OUT), and it is `Részletek`.
  const foot = container.querySelector('.ec-summary > .fo-foot.nonav') as HTMLElement
  const onward = foot.querySelectorAll('button')
  expect(onward).toHaveLength(1)
  expect(onward[0]).toHaveTextContent('Részletek · izmok és a nyert kalória')
  expect(screen.getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent)).toEqual([
    'Bezárás', 'Részletek · izmok és a nyert kalória',
  ])
})

test('Részletek opens step two: the muscle rows, the kcal hero, the close button and the way back', async () => {
  const user = userEvent.setup()
  const { container } = render(<WorkoutCeremony {...props({ kcal: { value: 420, known: true }, dayKcal: 3100 })} />)
  await goToDetails(user)
  expect(container.querySelector('.ec-details')).not.toBeNull()
  expect(container.querySelector('.ec-summary')).toBeNull()
  expect(screen.getByText('A mai edzésen · izomcsoportok')).toBeInTheDocument()
  expect(container.querySelectorAll('.ex-mstar')).toHaveLength(2)
  expect(container.querySelector('.ec-kc')).not.toBeNull()
  // The floating bar: the full-width way out, and the text link back under it (both in the stacked foot).
  const foot = container.querySelector('.ec-details > .fo-foot.nonav > .fo-fcol') as HTMLElement
  expect([...foot.children].map((el) => el.textContent)).toEqual(['Vissza a mai napra · lezárva és elmentve', 'Vissza az értékeléshez'])
  expect(foot.children[0]).toHaveClass('fo-btn')
  expect(foot.children[1]).toHaveClass('fo-lk')
  // The footnote about the stars stays on step two.
  expect(screen.getByText(/A csillagok a tervezett szettből/)).toBeInTheDocument()
  // Step one's stage is gone while step two is up.
  expect(container.querySelector('.fo-cer-stars')).toBeNull()
})

// Fix round 1 (mezo-e1ii9 Task 3): step two's focus target used to live inside the
// `muscles.length > 0` block — a session with no muscle rows left focus on <body>.
test('step two takes focus on its own title even when the session has no muscle rows', async () => {
  const user = userEvent.setup()
  const { container } = render(<WorkoutCeremony {...props({ muscles: [] })} />)
  await goToDetails(user)
  const heading = screen.getByRole('heading', { level: 1 })
  expect(heading).toHaveTextContent('Részletek')
  expect(heading).toHaveFocus()
  expect(container.querySelector('.ec-top small')).toHaveTextContent('Edzés lezárva · Erős nap.')
  expect(screen.queryByText('A mai edzésen · izomcsoportok')).not.toBeInTheDocument()
  // „Hogy ment?" is then the first numbered section.
  expect([...container.querySelectorAll('.fo-sec')].map((h) => h.textContent)).toEqual(['1Hogy ment?'])
})

test('both ways back return to step one — and never replay the ceremony', async () => {
  const user = userEvent.setup()
  const raf = vi.spyOn(window, 'requestAnimationFrame')
  const { container } = render(<WorkoutCeremony {...props({ xpGained: 240 })} />)
  await goToDetails(user)
  await user.click(screen.getByRole('button', { name: 'Vissza az értékeléshez' }))
  expect(container.querySelector('.ec-summary')).not.toBeNull()
  expect(screen.getByText('szerzett XP')).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 1 })).toHaveFocus()
  // Reduced motion → no pass was ever scheduled, and the round trip scheduled none either.
  expect(raf).not.toHaveBeenCalled()
  // Step one comes back already told, with its real counters.
  expect(container.querySelector('.fo-cer')).toHaveClass('told', 'inst')
  expect(container.querySelector('.ec-tally [data-cer-count]')).toHaveTextContent('9')
  // The title row's back on step two does the same.
  await goToDetails(user)
  await user.click(container.querySelector('.ec-top .fo-back') as HTMLElement)
  expect(container.querySelector('.ec-summary')).not.toBeNull()
  expect(raf).not.toHaveBeenCalled()
})

test('leaving step one mid-pass still brings back the FINAL numbers, not zeroes', () => {
  const frames: FrameRequestCallback[] = []
  const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
    frames.push(cb); return frames.length
  })
  vi.spyOn(performance, 'now').mockReturnValue(0)
  const { container } = render(<WorkoutCeremony {...props({ reducedMotion: false, records: [REC_ROW] })} />)
  expect(container.querySelector('.ec-tally [data-cer-count]')).toHaveTextContent('0')
  act(() => { frames.shift()?.(0) })
  // Step two, mid-pass: the stage leaves the DOM and the frame loop stops.
  act(() => { screen.getByRole('button', { name: /Részletek/ }).click() })
  act(() => { frames.shift()?.(600) })
  expect(frames).toHaveLength(0)
  // Back to step one — React owns the counters now, and paints the settled end state.
  act(() => { screen.getByRole('button', { name: 'Vissza az értékeléshez' }).click() })
  expect(container.querySelector('.fo-cer')).toHaveClass('b1', 'b2', 'b3', 'told', 'inst')
  expect(container.querySelector('.ec-tally [data-cer-count]')).toHaveTextContent('9')
  expect(container.querySelectorAll('.fo-cer-stars i.is-lit')).toHaveLength(4)
  expect((container.querySelector('[data-cer-stage]') as HTMLElement).style.getPropertyValue('--p')).toBe('0.8')
  // …and no second pass was started for it.
  expect(raf).toHaveBeenCalledTimes(2)
})

// ---- what the ceremony does NOT have (mezo-e1ii9, Task 3) ----

test('the quests live on step one only, in the new words — step two carries none', async () => {
  const user = userEvent.setup()
  const { container } = render(<WorkoutCeremony {...props({ kcal: { value: 420, known: true }, dayKcal: 3100, challenges: CHALS })} />)
  expect(container.querySelector('.ec-quests')).not.toBeNull()
  expect(container.textContent).not.toMatch(/skippelted|megcsináltad|Kihívások/i)
  await goToDetails(user)
  expect(container.querySelector('.ec-quests')).toBeNull()
  expect(container.textContent).not.toMatch(/Küldetések|teljesült|nem jött össze|nem értékelhető/)
})

test('no streak line anywhere — the ceremony carries its own XP and nothing else', async () => {
  const user = userEvent.setup()
  const { container } = render(<WorkoutCeremony {...props({ xpGained: 480 })} />)
  expect(container.textContent).not.toMatch(/napos sorozat/)
  await goToDetails(user)
  expect(container.textContent).not.toMatch(/napos sorozat/)
})

// ---- the honest tail (T7 Task 4) ----

test('the closing screen notes how many sets closed pending', () => {
  render(<WorkoutCeremony {...props({ settled: true, pendingSets: 4 })} />)
  expect(screen.getByText('4 szett kihagyott státusszal zárult.')).toBeInTheDocument()
})

test('nothing pending means no pending note', () => {
  const { container } = render(<WorkoutCeremony {...props({ settled: true, pendingSets: 0 })} />)
  expect(container.textContent).not.toMatch(/kihagyott státusszal/)
})

test('no emoji anywhere on either step — every glyph is the sprite', async () => {
  const user = userEvent.setup()
  const { container } = render(<WorkoutCeremony {...props({
    minutes: 47, xpGained: 240, records: [REC_ROW], challenges: CHALS, kcal: { value: 420, known: true }, dayKcal: 3100, pendingSets: 2,
  })} />)
  const emoji = /\p{Extended_Pictographic}/u
  expect(container.textContent ?? '').not.toMatch(emoji)
  await goToDetails(user)
  expect(container.textContent ?? '').not.toMatch(emoji)
})

test('ceremonyRecord keeps where the old record stood (the Folyadék capsule\'s dashed line), and omits it without one', () => {
  const base = { tier: 'RECORD', exerciseName: 'Row', date: '2026-09-24', unit: 'KG', type: 'WEIGHT', value: 12.5, weightKg: 12.5, reps: 8 } as const
  expect(ceremonyRecord({ ...base, previousValue: 10 }).prevShare).toBe(80)
  expect(ceremonyRecord(base).prevShare).toBeUndefined()
})
