import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LifelineCard } from './LifelineCard'
import { renderUnit } from './hubTestKit'
import { addDays, localDateString, mondayOf } from '@/shared/lib/dates'

// Életvonal (mezo-lhqw7). Hooks stubbed at the boundary; the weight log is dated relative to
// today so the 12-week window always contains it.
const MON = mondayOf(localDateString())
const wk = (weeksAgo: number, value: number) => ({ date: addDays(MON, -7 * weeksAgo), value })
const LOG = [wk(3, 80.4), wk(2, 80.2), wk(1, 79.8), wk(0, 79.6)] // one crossing: „80 kg alatt"

const store = vi.hoisted(() => ({
  log: [] as { date: string; value: number }[],
  sleep: [] as { date: string; duration: number }[],
  goal: { targetWeight: 73 } as { targetWeight: number } | null,
  avg7: 79.7, rate4w: -0.3,
  perks: [] as { name: string; effectCopy: string; unlockedAt: string }[],
  logWeight: vi.fn(), refetch: vi.fn(),
  pending: false, error: false,
}))

vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return {
    ...actual,
    useWeight: () => ({
      weightLog: store.log,
      weightTrends: { last7d: { avg: store.avg7, weeklyRate: -0.3 }, last4w: { weeklyRate: store.rate4w } },
      logWeight: store.logWeight,
      isPending: store.pending, isError: store.error, refetch: store.refetch,
    }),
    useSleep: () => ({ sleepLog: store.sleep, lastNight: null, logSleep: vi.fn() }),
    useGoal: () => ({ goal: store.goal, pending: false, isError: false }),
    useAchievements: () => ({ data: { badges: [], perks: store.perks } }),
  }
})

beforeEach(() => {
  store.log = LOG
  store.sleep = [{ date: addDays(MON, -21), duration: 6.4 }, { date: MON, duration: 7.3 }]
  store.goal = { targetWeight: 73 }
  store.avg7 = 79.7
  store.rate4w = -0.3
  store.perks = []
  store.logWeight.mockClear()
  store.refetch.mockClear()
  store.pending = false
  store.error = false
})

test('too few measurements → the dashed empty state, and „Mérj most" opens the weight sheet', async () => {
  store.log = []
  renderUnit(<LifelineCard />)
  const card = document.querySelector('.enh-elv')!
  expect(card).toHaveClass('uv-empty')
  expect(card).not.toHaveClass('glass')
  expect(card).toHaveTextContent('Még kevés a mérés — két mérés után rajzolódik ki az életvonalad.')
  expect(card.querySelector('use')?.getAttribute('href')).toBe('#t-weight')
  expect(card.querySelector('svg.enh-elv-svg')).toBeNull()
  await userEvent.click(screen.getByRole('button', { name: 'Mérj most' }))
  expect(await screen.findByRole('dialog')).toBeInTheDocument()
})

test('the card: one sky glass, the 12-week delta, the 7-day average and the drawn curve', () => {
  renderUnit(<LifelineCard />)
  const card = document.querySelector<HTMLElement>('.enh-elv')!
  expect(card).toHaveClass('glass')
  expect(card.tagName).toBe('DIV') // never a button around buttons
  expect(card.style.getPropertyValue('--c')).toBe('var(--dv-sky)')
  expect(card.querySelector('.enh-elv-eb')).toHaveTextContent('Életvonal · 4 hét')
  expect(card.querySelector('.enh-elv-big')).toHaveTextContent('−0,8kg')
  expect(card.querySelector('.enh-elv-side')).toHaveTextContent('79,7 kg7 napos átlag')
  const curve = card.querySelector('path.enh-elv-curve')!
  expect(curve.getAttribute('d')!.startsWith('M')).toBe(true)
  expect(curve.getAttribute('pathLength')).toBe('100')
  expect(card.querySelector('.enh-elv-area')).not.toBeNull()
  expect(card.querySelector('.enh-elv-endp')).not.toBeNull()
  // heading to the target → dashed target line, its label and the dotted projection
  expect(card.querySelector('.enh-elv-tgt')).not.toBeNull()
  expect(card.querySelector('.enh-elv-tgl')).toHaveTextContent('cél 73')
  expect(card.querySelector('.enh-elv-proj')).not.toBeNull()
  expect(card.querySelectorAll('.glass .glass')).toHaveLength(0)
})

test('no projection (the trend is not heading to the target) → no target line, no dotted line', () => {
  store.rate4w = 0.2
  renderUnit(<LifelineCard />)
  expect(document.querySelector('.enh-elv-tgt')).toBeNull()
  expect(document.querySelector('.enh-elv-tgl')).toBeNull()
  expect(document.querySelector('.enh-elv-proj')).toBeNull()
})

test('a station is a real button: tapping it shows its caption and presses it; tapping again releases', async () => {
  renderUnit(<LifelineCard />)
  const cap = document.querySelector('.enh-elv-cap')!
  expect(cap).toHaveTextContent('Koppints egy arany pontra: mi történt ott.')
  const stn = screen.getByRole('button', { name: /kg alatt/ })
  expect(stn).toHaveAttribute('aria-pressed', 'false')
  expect(stn.closest('button')).toBe(stn)
  expect(stn.parentElement!.closest('button')).toBeNull()
  await userEvent.click(stn)
  expect(stn).toHaveAttribute('aria-pressed', 'true')
  expect(cap).toHaveTextContent('80 kg alatt')
  expect(cap).toHaveTextContent('Először ment a heti átlagod 80 kg alá.')
  expect(screen.getByTestId('loc')).toHaveTextContent('/me') // a station tap never navigates
  await userEvent.click(stn)
  expect(stn).toHaveAttribute('aria-pressed', 'false')
  expect(cap).toHaveTextContent('Koppints egy arany pontra')
})

test('without stations the caption line is absent', () => {
  store.goal = null
  renderUnit(<LifelineCard />)
  expect(document.querySelector('.enh-elv-cap')).toBeNull()
  expect(screen.queryByRole('button', { name: /kg alatt/ })).toBeNull()
})

test('the sleep band has one bar per point; a week without a logged night is marked, not invented', () => {
  renderUnit(<LifelineCard />)
  const band = screen.getByRole('img', { name: 'Alvás, heti átlag: 6,4–7,3 óra' }) // the range is read out
  const bars = [...band.querySelectorAll('i')]
  expect(bars).toHaveLength(4)
  expect(bars.map((b) => b.classList.contains('is-none'))).toEqual([false, true, true, false])
  expect(document.querySelector('.enh-elv-sleepleg')).toHaveTextContent('6,4–7,3 ó')
})

test('no sleep logged at all → no band', () => {
  store.sleep = []
  renderUnit(<LifelineCard />)
  expect(document.querySelector('.enh-elv-sleep')).toBeNull()
})

test('the footer names the next station and opens the Test tab', async () => {
  renderUnit(<LifelineCard />)
  const next = document.querySelector<HTMLButtonElement>('button.enh-elv-next')!
  expect(next).toHaveTextContent('A következő állomás: 73 kg — még 6,6 kg')
  await userEvent.click(next)
  expect(screen.getByTestId('loc')).toHaveTextContent('/me/weight')
})

test('without a weight goal the footer is the plain door, and the unresolved 7-day average is not a zero', async () => {
  store.goal = null
  store.avg7 = 0
  renderUnit(<LifelineCard />)
  const next = screen.getByRole('button', { name: 'A részletek a Test fülön' })
  expect(document.querySelector('.enh-elv-side')).toBeNull()
  await userEvent.click(next)
  expect(screen.getByTestId('loc')).toHaveTextContent('/me/weight')
  expect(within(document.querySelector<HTMLElement>('.enh-elv')!).queryByText(/^0/)).toBeNull()
})

// pending ≠ error ≠ empty (fix round 1): `weightLog` is [] in all three, only the flags differ.
test('while the weight log loads: a quiet skeleton — not the „még kevés a mérés" empty state', () => {
  store.log = []
  store.pending = true
  renderUnit(<LifelineCard />)
  expect(screen.getByTestId('enh-elv-skeleton')).toHaveClass('enh-elv')
  expect(screen.queryByText(/Még kevés a mérés/)).toBeNull()
  expect(screen.queryByRole('button')).toBeNull()
  expect(document.querySelector('.enh-elv')).toHaveTextContent('')
})

test('a failed weight-log read: the retryable error — not the empty state', async () => {
  store.log = []
  store.error = true
  renderUnit(<LifelineCard />)
  expect(screen.getByText('Nem sikerült betölteni a súlynaplót.')).toBeInTheDocument()
  expect(screen.queryByText(/Még kevés a mérés/)).toBeNull()
  expect(screen.queryByRole('button', { name: 'Mérj most' })).toBeNull()
  await userEvent.click(screen.getByRole('button', { name: 'Újra' }))
  expect(store.refetch).toHaveBeenCalled()
})

test('only a RESOLVED log with fewer than two measured weeks is the empty state', () => {
  store.log = [wk(0, 80)]
  renderUnit(<LifelineCard />)
  expect(screen.getByText(/Még kevés a mérés/)).toBeInTheDocument()
  expect(screen.queryByTestId('enh-elv-skeleton')).toBeNull()
})

// final review
test('the sleep band names a single value when every logged week has the same mean', () => {
  store.sleep = [{ date: MON, duration: 7.3 }]
  renderUnit(<LifelineCard />)
  expect(screen.getByRole('img', { name: 'Alvás, heti átlag: 7,3 óra' })).toBeInTheDocument()
})

test('a reached (overshot) target: „Elérted a célod" — never „még 0,4 kg"', async () => {
  store.goal = { targetWeight: 80 } // the latest weekly average is 79,6
  renderUnit(<LifelineCard />)
  const next = document.querySelector<HTMLButtonElement>('button.enh-elv-next')!
  expect(next).toHaveTextContent('Elérted a célod: 80 kg›')
  expect(next).not.toHaveTextContent(/még|következő állomás/)
  await userEvent.click(next)
  expect(screen.getByTestId('loc')).toHaveTextContent('/me/weight')
})

// A perk's unlock instant, at local noon of a day inside the given week (timezone-proof).
const perkAt = (weeksAgo: number, dayOffset: number) => new Date(`${addDays(MON, -7 * weeksAgo + dayOffset)}T12:00:00`).toISOString()

test('a perk station is a button named after the perk; tapping it shows the perk\'s effect', async () => {
  store.goal = null // no kg stations — the perk is the only one
  store.perks = [{ name: 'Páncélzat', effectCopy: 'Tíz hét töretlenül: a sorozatod egy kihagyást elbír.', unlockedAt: perkAt(2, 1) }]
  renderUnit(<LifelineCard />)
  const stn = screen.getByRole('button', { name: /^Új képesség: Páncélzat · / })
  expect(stn).toHaveClass('enh-elv-stn')
  expect(stn).toHaveAttribute('aria-pressed', 'false')
  await userEvent.click(stn)
  expect(stn).toHaveAttribute('aria-pressed', 'true')
  const cap = document.querySelector('.enh-elv-cap')!
  expect(cap).toHaveTextContent('Új képesség: Páncélzat')
  expect(cap).toHaveTextContent('Tíz hét töretlenül: a sorozatod egy kihagyást elbír.')
})

test('two stations on the same point are both reachable and do not sit exactly on each other', async () => {
  store.goal = null
  store.perks = [
    { name: 'Páncélzat', effectCopy: 'első hatás', unlockedAt: perkAt(2, 1) },
    { name: 'Második szél', effectCopy: 'második hatás', unlockedAt: perkAt(2, 3) },
  ]
  renderUnit(<LifelineCard />)
  const a = screen.getByRole('button', { name: /^Új képesség: Páncélzat · / })
  const b = screen.getByRole('button', { name: /^Új képesség: Második szél · / })
  // same week → the same anchor point…
  expect(a.style.left).toBe(b.style.left)
  expect(a.style.top).toBe(b.style.top)
  // …so the later one steps up by its `--stack` (CSS: translateY(-50% − stack × 16px))
  expect(a.style.getPropertyValue('--stack')).toBe('0')
  expect(b.style.getPropertyValue('--stack')).toBe('1')
  await userEvent.click(b)
  expect(document.querySelector('.enh-elv-cap')).toHaveTextContent('második hatás')
  await userEvent.click(a)
  expect(document.querySelector('.enh-elv-cap')).toHaveTextContent('első hatás')
  expect(a).toHaveAttribute('aria-pressed', 'true')
  expect(b).toHaveAttribute('aria-pressed', 'false')
})
