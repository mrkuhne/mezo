import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, afterEach, expect, test, vi } from 'vitest'
import { TrainWeekMozgasPage } from '@/features/train/pages/TrainWeekMozgasPage'
import { QueryWrapper } from '@/test/queryWrapper'
import type { SportLoadResult } from '@/features/train/logic/sportMuscleLoad'
import type { WorkoutDetailResponse } from '@/data/train/trainApi'
import { sport as sportFixture } from '@/data/train/train'
import { runSessionsMock } from '@/data/train/running'

// The test week's two logged volleyball rows and the two run fixtures — their kcal are the
// published net model's (mezo-32m82), so the expected sums come off the fixtures, not literals.
const kcalOf = (id: string) => sportFixture.sessions.find((s) => s.id === id)!.kcal!
const WEEK_SPORT_KCAL = kcalOf('vb-2026-05-20') + kcalOf('vb-2026-05-18')
const RUN_KCAL = runSessionsMock.reduce((a, r) => a + r.kcal!, 0)

// The mock/week fixtures always carry at least one sport/run event — the honest-absence
// test needs to force sportLoadForWeek's result to empty rather than fighting the fixtures.
let sportLoadOverride: SportLoadResult | null = null
vi.mock('@/features/train/logic/sportMuscleLoad', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/train/logic/sportMuscleLoad')>()
  return {
    ...actual,
    sportLoadForWeek: (...args: Parameters<typeof actual.sportLoadForWeek>) =>
      sportLoadOverride ?? actual.sportLoadForWeek(...args),
  }
})

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

// The gym/sport-honesty test needs a weight-less goal — mock mode's own goal fixture
// always carries a weight on file. The skeleton test needs the week's own detail fetch
// still pending — mock mode resolves synchronously otherwise.
let weightOverride: number | null | undefined
let weekLogOverride: { details: WorkoutDetailResponse[]; pending: boolean } | null = null
// Fix round 1 (mezo-88iwa.13 review): goal/timing-profile pending must NOT gate the whole
// page — only per-card honesty (known:false fallbacks) should react to it, mirroring
// TrainTodayPage's workoutPending||runningPending-only gate.
let goalPendingOverride = false
let timingPendingOverride = false
// Fix round 2 (mezo-88iwa.13 review): the "sport box never claims a kcal number it has no
// source for" test was vacuous — the mock fixtures always carry at least one logged sport/
// run session with kcal:null, so `sportKcal` was already null for a reason UNRELATED to the
// empty-side fabricated-zero bug (loadWeek.ts movementWeek used to return `sportKcal: 0` for
// a truly EMPTY sport side, which this test never exercised). This override forces both the
// logged volleyball sessions and the logged run sessions to empty so the empty-side path is
// actually hit.
let emptySportFixture = false
// T8 Task 6: the all-or-null kcal gate needs a week where one logged session is missing
// its kcal while the rest carry one — strips it off `vb-2026-05-18`, one of the two
// sessions the mock fixture's own test week (2026-05-18..24) carries (the other is
// `vb-2026-05-20`; a `vb-today` entry may also be in scope, dated off the real system
// clock, so matching by id rather than array position keeps this deterministic).
let stripOneSessionKcal = false
// T8 Task 6 final review: the RUN mock carried no kcal at all, so a logged run permanently
// blanked this page's sum in mock mode (`movementWeek` is all-or-null) while real mode —
// where the run service runs the same MET estimator — would have shown it. The mock's own
// run rows are dated outside this suite's frozen test week, so this override re-dates them
// INTO it without touching their (now present) kcal.
let runsInTestWeek = false
vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return {
    ...actual,
    useGoal: (...args: Parameters<typeof actual.useGoal>) => {
      const real = actual.useGoal(...args)
      const withPending = goalPendingOverride ? { ...real, pending: true } : real
      if (weightOverride === undefined) return withPending
      return { ...withPending, goal: withPending.goal ? { ...withPending.goal, currentWeight: weightOverride } : withPending.goal, goalResponse: null }
    },
    useTimingProfile: (...args: Parameters<typeof actual.useTimingProfile>) => {
      const real = actual.useTimingProfile(...args)
      return timingPendingOverride ? { ...real, isPending: true } : real
    },
    useWeekMuscleLog: (...args: Parameters<typeof actual.useWeekMuscleLog>) => {
      const real = actual.useWeekMuscleLog(...args)
      return weekLogOverride ? { ...real, details: weekLogOverride.details, pending: weekLogOverride.pending } : real
    },
    useTrain: (...args: Parameters<typeof actual.useTrain>) => {
      const real = actual.useTrain(...args)
      if (emptySportFixture) return { ...real, sport: { ...real.sport, sessions: [] } }
      if (stripOneSessionKcal) {
        return { ...real, sport: { ...real.sport, sessions: real.sport.sessions.map((s) => (s.id === 'vb-2026-05-18' ? { ...s, kcal: null } : s)) } }
      }
      return real
    },
    useRunning: (...args: Parameters<typeof actual.useRunning>) => {
      const real = actual.useRunning(...args)
      if (emptySportFixture) return { ...real, runSessions: [] }
      if (runsInTestWeek) {
        return { ...real, runSessions: real.runSessions.map((r, i) => ({ ...r, date: i === 0 ? '2026-05-22' : '2026-05-23' })) }
      }
      return real
    },
  }
})

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-05-21T09:00:00'))
  vi.stubEnv('VITE_USE_MOCK', 'true')
  mockNavigate.mockReset()
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  weightOverride = undefined
  weekLogOverride = null
  goalPendingOverride = false
  timingPendingOverride = false
  sportLoadOverride = null
  emptySportFixture = false
  stripOneSessionKcal = false
  runsInTestWeek = false
})

const renderPage = () => render(<QueryWrapper><MemoryRouter><TrainWeekMozgasPage /></MemoryRouter></QueryWrapper>)

/** The two tubes of the hero: [gym, sport]. Each holds its minutes (b) and its line (small). */
const tubes = (container: HTMLElement) => [...container.querySelectorAll('.fo-hero .et-vs .fo-vial')] as HTMLElement[]
const ready = () => waitFor(() => expect(screen.queryByRole('status', { name: 'Betöltés…' })).toBeNull())

test('renders the Minden mozgásod hero with the total minutes in its verdict and the back pill', async () => {
  const { container } = renderPage()
  await ready()
  const hero = container.querySelector('.fo-hero') as HTMLElement
  expect(within(hero).getByText('Minden mozgásod eddig a héten')).toHaveClass('fo-hero-lbl')
  const verdict = hero.querySelector('.fo-hero-verdict')!.textContent ?? ''
  const total = Number(/^(\d+) perc mozgás van mögötted ezen a héten\.$/.exec(verdict)?.[1])
  expect(Number.isInteger(total)).toBe(true)
  // the verdict's total is exactly the two tubes together — never a third source
  const [gym, sport] = tubes(container).map((t) => Number(/^(\d+) perc$/.exec(t.querySelector('b')!.textContent ?? '')?.[1]))
  expect(gym + sport).toBe(total)
  const back = screen.getByRole('button', { name: /Terhelés/ })
  expect(back).toHaveClass('fo-backpill')
  fireEvent.click(back)
  expect(mockNavigate).toHaveBeenCalledWith('/train/week')
})

test('the gym-estimate and sport-logged tubes never mix into one number', async () => {
  const { container } = renderPage()
  await ready()
  const t = tubes(container)
  expect(t).toHaveLength(2)
  expect(t[0].querySelector('b')!.textContent).toMatch(/^\d+ perc$/)
  expect(within(t[0]).getByText(/^Terem/)).toBeInTheDocument()
  expect(t[0].querySelector('use')?.getAttribute('href')).toBe('#t-dumbbell')
  expect(within(t[1]).getByText(/^Sport/)).toBeInTheDocument()
  expect(within(t[1]).getByText(/naplóztad/)).toBeInTheDocument()
  expect(t[1].querySelector('use')?.getAttribute('href')).toBe('#t-volley')
  // one scale for both: the levels compare
  expect(t[0].querySelector('.fo-tube .l')).toBeNull() // mock mode: no closed gym day, a dry tube
  expect(t[1].querySelector('.fo-tube .l')).not.toBeNull()
})

// With no weight on file, the gym side's kcal is honestly unknown — a number must never
// be fabricated where trainDayEnergy itself would return `known: false`. This needs an
// actual DONE gym day in the fixture (gymBlocks only covers done days, mock mode's own
// weekLog.details is otherwise always empty — see weekMuscleLogHooks.ts) so the
// "known:false" branch under test is the weight-missing one, not the "nothing done yet" one.
test('movementWeek known:false renders the honest sentence, never a fabricated kcal', async () => {
  weightOverride = 0
  weekLogOverride = {
    details: [{ id: 'w1', templateSessionId: 't1', date: '2026-05-18', status: 'completed', title: 'Push', dayLabel: 'Hét', exercises: [] }],
    pending: false,
  }
  const { container } = renderPage()
  await ready()
  const gym = tubes(container)[0]
  expect(within(gym).queryByText(/kcal/)).toBeNull()
  expect(within(gym).getByText(/nincs elég adat/)).toBeInTheDocument()
  // the done day's minutes are in the tube
  expect(gym.querySelector('.fo-tube .l')).not.toBeNull()
})

// Sport kcal comes off the wire (SportSessionResponse.kcal / RunSessionLogResponse.kcal) —
// the mock week's two logged sessions (05-18, 05-20) both carry one, so the tube's line sums
// them rather than falling back to the honest-absence copy.
test('the sport tube shows the summed kcal once every logged session this week carries one', async () => {
  const { container } = renderPage()
  await ready()
  const sport = tubes(container)[1]
  expect(within(sport).getByText(`${WEEK_SPORT_KCAL} kcal · naplóztad`)).toBeInTheDocument()
})

// A mock-mode RUN in the week must NOT blank the sum: the two volleyball sessions + the two
// run fixtures' own estimates.
test('a logged run in the week keeps the sum visible — the mock run carries kcal too', async () => {
  runsInTestWeek = true
  const { container } = renderPage()
  await ready()
  const sport = tubes(container)[1]
  expect(within(sport).getByText(new RegExp(`^${WEEK_SPORT_KCAL + RUN_KCAL} kcal`))).toBeInTheDocument()
})

// movementWeek's all-or-null gate (loadWeek.ts): ONE session in the week missing kcal
// hides the WHOLE sum rather than under-reporting it — never a partial/fabricated total.
test('the sport tube hides the kcal sum when one logged session this week is missing it', async () => {
  stripOneSessionKcal = true
  const { container } = renderPage()
  await ready()
  const sport = tubes(container)[1]
  expect(within(sport).queryByText(/kcal/)).toBeNull()
  expect(within(sport).getByText(/a kalóriáját még nem tudjuk becsülni/)).toBeInTheDocument()
})

// An actually-empty sport/run fixture must render no kcal number AND no "naplóztad" (you
// logged it) claim — never „0 kcal", a claimed measurement of a session that was never logged.
test('an empty-sport week renders no kcal number and no false "naplóztad" claim, never a fabricated zero', async () => {
  emptySportFixture = true
  const { container } = renderPage()
  await ready()
  const sport = tubes(container)[1]
  expect(sport.querySelector('b')!.textContent).toBe('0 perc')
  expect(sport.querySelector('.fo-tube .l')).toBeNull()
  expect(within(sport).queryByText(/kcal/)).toBeNull()
  expect(within(sport).queryByText(/^naplóztad/)).toBeNull()
  expect(within(sport).getByText(/nincs naplózott sport/)).toBeInTheDocument()
  // nothing moved at all (mock mode has no closed gym day either): the hero says so
  expect(screen.getByText('Ezen a héten még nincs lezárt mozgásod.')).toHaveClass('fo-hero-verdict')
})

test('the group rows carry a "sport is" pill only where the sport/futás estimate reaches them', async () => {
  const { container } = renderPage()
  await ready()
  const groups = [...container.querySelectorAll('.et-groups .et-grp')] as HTMLElement[]
  expect(groups.length).toBeGreaterThan(0)
  const withChip = groups.filter((g) => within(g).queryByText('sport is') !== null)
  const withoutChip = groups.filter((g) => within(g).queryByText('sport is') === null)
  // At least one of each — the mock volleyball schedule reaches some groups (shoulder/quad/
  // calf/core), not the whole body (e.g. biceps-only groups stay pill-less).
  expect(withChip.length).toBeGreaterThan(0)
  expect(withoutChip.length).toBeGreaterThan(0)
  expect(within(withChip[0]).getByText('sport is')).toHaveClass('fo-st', 'plan')
  // every row: its muscle chip, done / planned sets, its level — and it is not a button here
  for (const g of groups) {
    expect(g.querySelector('.ex-mchp')).not.toBeNull()
    expect(g.querySelector('.fo-wlv')).not.toBeNull()
    expect(g.querySelector('.v')!.textContent).toMatch(/^\d+ \/ \d+ szett$/)
    expect(g.tagName).toBe('DIV')
  }
})

test('the skeleton renders while the week\'s own detail fetch is still pending', () => {
  weekLogOverride = { details: [], pending: true }
  render(<QueryWrapper><MemoryRouter><TrainWeekMozgasPage /></MemoryRouter></QueryWrapper>)
  expect(screen.getByRole('status', { name: 'Betöltés…' })).toBeInTheDocument()
})

// Fix round 1 (mezo-88iwa.13 review): goal/timing-profile pending must not block the whole
// page behind the skeleton — TrainTodayPage's precedent gates on workoutPending||runningPending
// only and lets the move boxes' own known:false fallback render the honest sentence.
test('goal/timing-profile still pending renders the page with the honest sentence, no skeleton', async () => {
  goalPendingOverride = true
  timingPendingOverride = true
  const { container } = renderPage()
  expect(screen.queryByRole('status', { name: 'Betöltés…' })).toBeNull()
  await waitFor(() => expect(container.querySelector('.et-vs .fo-vial')).not.toBeNull())
})

// The sport/run events of the weekly order: per event its glyph, title, kind pill, day/time
// and the regions it loads, each as drops (1–3).
test('the sport/futás event list renders each event\'s title, day/time and its region loads as drops', async () => {
  const { container } = renderPage()
  await ready()
  const events = [...container.querySelectorAll('.et-events .et-event')] as HTMLElement[]
  expect(events.length).toBeGreaterThan(0)
  const first = events[0]
  expect(first.querySelector('.fo-st')?.textContent).not.toBe('')
  expect(first.querySelector('.et-event-title')?.textContent).not.toBe('')
  expect(first.querySelector('.et-event-when')?.textContent).not.toBe('')
  expect(first.querySelector('use')?.getAttribute('href')).toMatch(/^#t-/)
  const loads = [...first.querySelectorAll('.fo-evc em')]
  expect(loads.length).toBeGreaterThan(0)
  for (const l of loads) {
    expect(l.querySelectorAll('.fo-dm i')).toHaveLength(3)
    expect(l.querySelectorAll('.fo-dm i.f').length).toBeGreaterThan(0)
  }
  expect(screen.getByText(/^Becslés, nem mérés\. Ha egyetlen sport-alkalomnál hiányzik a kalória/)).toBeInTheDocument()
})

test('the sport/futás event list renders the honest absence when the week has no events', async () => {
  sportLoadOverride = { perMuscle: {}, events: [] }
  const { container } = renderPage()
  await ready()
  expect(container.querySelectorAll('.et-event').length).toBe(0)
  expect(screen.getByText('Nincs tervezett sport/futás esemény ezen a héten.')).toBeInTheDocument()
})

// ── the explain layer (mezo-b516k, Task 2) ─────────────────────────────────────────────
// Text links (the prototype's `info` sheet, args `becsles` / `olvasd`); the accessible name
// stays `"<title> — mit jelent?"`.

test('the hero link explains why the minutes are an estimate, word for word', async () => {
  renderPage()
  const btn = await screen.findByRole('button', { name: 'Miért becslés? — mit jelent?' })
  expect(btn.closest('.fo-hero-acts')).not.toBeNull()
  fireEvent.click(btn)
  expect(
    within(screen.getByRole('dialog', { name: 'Miért becslés?' })).getByText(
      'A gym percei a szettjeidből becsültek, a röplabdát te naplóztad. A kalória mindkettőnél becslés a mozgás jellegéből — nem mérés.',
    ),
  ).toBeInTheDocument()
})

test('the link under „Izomcsoportok, sporttal együtt" explains how to read it, word for word', async () => {
  renderPage()
  const btn = await screen.findByRole('button', { name: 'Hogyan olvasd? — mit jelent?' })
  expect(btn.closest('.et-groups')).not.toBeNull()
  fireEvent.click(btn)
  expect(
    within(screen.getByRole('dialog', { name: 'Hogyan olvasd?' })).getByText(
      'A sáv a gym szettjeidet mutatja a heti tervhez képest. A „sport is” jel azt jelzi, hogy a sport is dolgoztatta a csoportot — ez becslés, és nem adódik hozzá a szettekhez.',
    ),
  ).toBeInTheDocument()
})

test('folyadék: the page skeleton and no old load classes', async () => {
  const { container } = renderPage()
  await ready()
  const heads = [...container.querySelectorAll('.fo-page > .fo-sec')]
  expect(heads.map((h) => h.textContent)).toEqual(['1Izomcsoportok, sporttal együtt', '2Sport és futás a heti rendben'])
  expect(container.querySelector('[class*="ld-"], [class*="tw-"], .mz-page, .glass')).toBeNull()
})
