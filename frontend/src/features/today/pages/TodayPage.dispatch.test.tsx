// ============================================================
// Mezo · TodayPage dispatch coverage (mezo-j7u4 fix round 1, re-anchored onto the
// daypart-tabs composition by mezo-puci — the behavioral guarantees are unchanged;
// only the surface the assertions reach through changed: the rows are part of the
// daypart view now, so nothing has to be unfolded first).
// The screen is the sheet host the retired cards were, so the dead-control risk lives
// HERE: `buildTodayItems` gives every habit an action pill, and a kind `act()` does not
// serve renders a button that does nothing. This file walks EVERY `habitAction` kind and
// asserts each one either performs its check, follows its route, opens its sheet, or
// renders NO button at all. It also covers the consume-once level-up dance.
//
// Separate from TodayPage.test.tsx because it module-mocks the data hooks; the
// composition file deliberately runs against the real ones.
// ============================================================
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { TodayPage } from '@/features/today/pages/TodayPage'
import { LevelUpProvider } from '@/features/progression/LevelUpProvider'
import { QueryWrapper } from '@/test/queryWrapper'
import { gymLevelUpMock } from '@/data/progression/progressionMock'
import { today, user, workoutPrediction, volleyballNote } from '@/data/today/today'
// `workout` mirrors useToday()'s real mock branch (mezo-oyhy.3): Train's own recipe-shaped
// WorkoutPlan — the estimator needs the recipe fields to compute a real chip minute count.
import { workout } from '@/data/train/train'
import { onToast, type ToastMessage } from '@/shared/lib/toastBus'
import type { LevelUpResult } from '@/data/train/trainApi'
import type { CheckinSlot, DailyQuest, HabitChainInfo, HabitItem, VolleyballSession } from '@/data/types'

const mocks = vi.hoisted(() => ({
  useHabitDay: vi.fn(),
  useHabitActions: vi.fn(),
  useHabitCatalog: vi.fn(),
  useDailyQuests: vi.fn(),
  useQuestActions: vi.fn(),
  useToday: vi.fn(),
  useCheckins: vi.fn(),
  useWaterActions: vi.fn(),
}))
vi.mock('@/data/hooks', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@/data/hooks')>()
  return {
    ...orig,
    useHabitDay: mocks.useHabitDay,
    useHabitActions: mocks.useHabitActions,
    useHabitCatalog: mocks.useHabitCatalog,
    useDailyQuests: mocks.useDailyQuests,
    useQuestActions: mocks.useQuestActions,
    useToday: mocks.useToday,
    useCheckins: mocks.useCheckins,
    useWaterActions: mocks.useWaterActions,
  }
})

const habit = (over: Partial<HabitItem>): HabitItem => ({
  key: 'x', chain: 'EVENING', position: 1, title: 't', why: 'w', anchorCopy: 'a',
  mode: 'DERIVED', status: 'pending', xp: 5, strengthPct: 50, ...over,
})

// The two seed chains (mezo-n5e9.2 — mirrors `mockHabitCatalog`).
const SEED_CHAINS: HabitChainInfo[] = [
  { id: 'chain-morning', chainKey: 'MORNING', title: 'Reggeli rutin', daypart: 'MORNING', position: 1, isActive: true, defs: [] },
  { id: 'chain-evening', chainKey: 'EVENING', title: 'Esti rutin', daypart: 'EVENING', position: 2, isActive: true, defs: [] },
]

/**
 * One habit per `habitAction` kind, all on the EVENING chain so every row lands on the
 * evening daypart. `chain` is plain data — `habitAction` keys off `key` + `mode`.
 */
const KIND_FIXTURES = [
  // MANUAL lands on TodayRow's `tick` accessory (a ✓ circle, not a text pill — mezo-e26w).
  { kind: 'check', key: 'caffeine_cutoff', title: 'MANUAL lánc', mode: 'MANUAL' as const, pill: '✓' },
  { kind: 'nav', key: 'morning_coffee', title: 'DERIVED nav', mode: 'DERIVED' as const, pill: 'Logolás' },
  { kind: 'meal-sheet', key: 'protein_breakfast', title: 'DERIVED étkezés', mode: 'DERIVED' as const, pill: 'Logolás' },
  { kind: 'sleep-sheet', key: 'wake_on_time', title: 'DERIVED alvás', mode: 'DERIVED' as const, pill: 'Logolás' },
  { kind: 'intention-sheet', key: 'daily_intention', title: 'DERIVED szándék', mode: 'DERIVED' as const, pill: 'Logolás' },
  { kind: 'intention-reflect', key: 'intention_reflect', title: 'DERIVED reflexió', mode: 'DERIVED' as const, pill: 'Logolás' },
  { kind: 'none', key: 'bed_on_time', title: 'DERIVED felület nélkül', mode: 'DERIVED' as const, pill: null },
] as const

const ALL_KINDS: HabitItem[] = KIND_FIXTURES.map((f, i) =>
  habit({ key: f.key, title: f.title, mode: f.mode, position: i + 1 }))

const baseToday = {
  today, user,
  workout, workoutTime: today.workoutTime, prediction: workoutPrediction,
  volleyballSessions: [] as VolleyballSession[], volleyballNote,
  // mezo-v84m / mezo-6kap — the gym hero's done + in-progress state and the sport hero's
  // done-state, all server truth in real mode (mock persists no instance and logs no session,
  // so the defaults here are the mock branch's own answers).
  workoutDone: false, workoutDoneSets: null as number | null,
  workoutInProgress: false, workoutOpenSets: null as number | null,
  loggedSportKinds: [] as string[],
}

function LocationProbe() {
  const loc = useLocation()
  return <div data-testid="loc">{loc.pathname}</div>
}

function tree(path = '/today?dp=este') {
  return (
    <QueryWrapper>
      <LevelUpProvider>
        <MemoryRouter initialEntries={[path]}>
          <TodayPage />
          <LocationProbe />
        </MemoryRouter>
      </LevelUpProvider>
    </QueryWrapper>
  )
}

function renderToday(path = '/today?dp=este') {
  return render(tree(path))
}

/** Which daypart the screen is showing — the selection's single observable. */
const shownFace = (container: HTMLElement) =>
  (container.querySelector('.dayview') as HTMLElement | null)?.dataset.tone ?? null

/** A daypart segment in the switcher, scoped so no row/CTA label can be mistaken for a tab. */
const tab = (name: RegExp) =>
  within(screen.getByRole('group', { name: 'Napszak' })).getByRole('button', { name })

const rowOf = (title: string) => screen.getByText(title).closest('.td-row') as HTMLElement

let check: ReturnType<typeof vi.fn>
let consumeHabitLevelUps: ReturnType<typeof vi.fn>
let consumeQuestLevelUps: ReturnType<typeof vi.fn>
let logWater: ReturnType<typeof vi.fn>

const DEFAULT_CHECKINS: CheckinSlot[] = [{ time: '14:00', state: 'now', values: null, note: null }]

function setup({
  habits = ALL_KINDS,
  habitLevelUps = [] as LevelUpResult[],
  questLevelUps = [] as LevelUpResult[],
  quests = [] as DailyQuest[],
  checkins = DEFAULT_CHECKINS,
  pending = false,
  catalogChains = SEED_CHAINS,
  catalogPending = false,
} = {}) {
  check = vi.fn().mockResolvedValue(undefined)
  consumeHabitLevelUps = vi.fn()
  consumeQuestLevelUps = vi.fn()
  mocks.useHabitDay.mockReturnValue({ habits, levelUps: habitLevelUps, mode: 'mock' })
  mocks.useHabitActions.mockReturnValue({
    check, uncheck: vi.fn(), pending, consumeLevelUps: consumeHabitLevelUps,
  })
  mocks.useHabitCatalog.mockReturnValue({ catalog: { chains: catalogChains }, isPending: catalogPending })
  mocks.useDailyQuests.mockReturnValue({
    quests, levelUps: questLevelUps, rerollsLeft: 1, date: '2026-05-21', mode: 'mock',
  })
  mocks.useCheckins.mockReturnValue({ checkins, saveCheckIn: vi.fn() })
  mocks.useQuestActions.mockReturnValue({
    reroll: vi.fn(), pending: false, consumeLevelUps: consumeQuestLevelUps,
  })
  mocks.useToday.mockReturnValue(baseToday)
  logWater = vi.fn()
  mocks.useWaterActions.mockReturnValue({ logWater })
}

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  // Clock-only fake timers: with setTimeout faked, RTL's waitFor polls a clock nobody advances.
  vi.useFakeTimers({ toFake: ['Date'] }).setSystemTime(new Date(2026, 4, 21, 21, 5))
  setup()
})
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); vi.clearAllMocks() })

describe('TodayPage — no habitAction kind is a dead control', () => {
  test('every kind that offers a pill is served, and the one that cannot is pill-less', () => {
    renderToday()
    for (const f of KIND_FIXTURES) {
      const row = rowOf(f.title)
      const btn = within(row).queryByRole('button')
      if (f.pill === null) {
        // `none`: no log surface exists, so the row must not invite a tap at all —
        // and it explains itself instead of reading as broken.
        expect(btn, `${f.kind} must render NO button`).toBeNull()
        expect(row).toHaveTextContent('holnap reggel, az alvásnaplódból derül ki')
      } else {
        expect(btn, `${f.kind} must render a ${f.pill} pill`).toHaveTextContent(f.pill)
      }
    }
  })

  test("'check' performs the habit check (ADR 0010: MANUAL only)", () => {
    renderToday()
    fireEvent.click(within(rowOf('MANUAL lánc')).getByRole('button'))
    expect(check).toHaveBeenCalledWith('caffeine_cutoff')
  })

  test("'nav' follows the habit's own log route rather than self-completing", () => {
    renderToday()
    fireEvent.click(within(rowOf('DERIVED nav')).getByRole('button'))
    expect(screen.getByTestId('loc').textContent).toBe('/fuel/stack')
    expect(check).not.toHaveBeenCalled()
  })

  test.each([
    ['meal-sheet', 'DERIVED étkezés', 'Mit ettél?'],
    ['sleep-sheet', 'DERIVED alvás', 'Hogyan aludtunk?'],
    ['intention-sheet', 'DERIVED szándék', 'Mi ma a fókuszod?'],
    ['intention-reflect', 'DERIVED reflexió', 'Szándékkal élted a napot?'],
  ])("'%s' opens its sheet in place", (_kind, title, sheetName) => {
    renderToday()
    fireEvent.click(within(rowOf(title)).getByRole('button'))
    expect(screen.getByRole('dialog')).toHaveAccessibleName(sheetName)
    expect(screen.getByTestId('loc').textContent).toBe('/today') // it did not navigate away
    expect(check).not.toHaveBeenCalled()                          // nor self-complete
  })
})

describe('TodayPage — consume-once reward toasts', () => {
  const listen = () => {
    const seen: ToastMessage[] = []
    const off = onToast((t) => seen.push(t))
    return { seen, off }
  }

  test('egy habit level-up EGYSZER dob reward toastot és fogyasztódik', async () => {
    setup({ habitLevelUps: [gymLevelUpMock] })
    const { seen, off } = listen()
    renderToday()
    await waitFor(() => expect(consumeHabitLevelUps).toHaveBeenCalledTimes(1))
    off()
    expect(seen.filter((t) => t.kind === 'reward')).toHaveLength(1)
    // és NEM nyílt full-screen overlay
    expect(screen.queryByRole('dialog', { name: 'Szintlépés' })).toBeNull()
  })

  test('egy quest level-up EGYSZER dob reward toastot és fogyasztódik', async () => {
    setup({ questLevelUps: [gymLevelUpMock] })
    const { seen, off } = listen()
    renderToday()
    await waitFor(() => expect(consumeQuestLevelUps).toHaveBeenCalledTimes(1))
    off()
    expect(seen.filter((t) => t.kind === 'reward')).toHaveLength(1)
    expect(screen.queryByRole('dialog', { name: 'Szintlépés' })).toBeNull()
  })

  test('üres payload esetén nincs toast és nincs fogyasztás', () => {
    const { seen, off } = listen()
    renderToday()
    off()
    expect(seen.filter((t) => t.kind === 'reward')).toHaveLength(0)
    expect(consumeHabitLevelUps).not.toHaveBeenCalled()
    expect(consumeQuestLevelUps).not.toHaveBeenCalled()
  })
})

describe('TodayPage — a kézi pipa reward toastot dob', () => {
  test('a pipa a habit nevével és a lánc állásával jelez vissza', async () => {
    renderToday()
    const seen: ToastMessage[] = []
    const off = onToast((t) => seen.push(t))

    fireEvent.click(within(rowOf('MANUAL lánc')).getByRole('button'))
    await waitFor(() => expect(check).toHaveBeenCalledWith('caffeine_cutoff'))
    await waitFor(() => expect(seen.some((t) => t.kind === 'reward')).toBe(true))
    off()

    const reward = seen.find((t) => t.kind === 'reward')
    expect(reward).toMatchObject({ kind: 'reward', title: 'MANUAL lánc' })
    // All 7 KIND_FIXTURES share the EVENING chain and start `pending`, so the chain reads
    // 0/7 at click time; the builder adds the +1 for the row being checked. An off-by-one
    // in the CALLER (pre-incrementing chainDone) would render „Szokás · 2 / 7" and fail here.
    expect((reward as { eyebrow: string }).eyebrow).toBe('Szokás · 1 / 7')
  })
})

describe('TodayPage — no quest row is a dead control either', () => {
  const quest = (over: Partial<DailyQuest>): DailyQuest => ({
    id: 'q', questDate: '2026-05-21', slot: 'GROWTH', skillKey: 'mindset',
    title: 'Q', why: 'w', targetLabel: 't', metric: 'water_target', xp: 20,
    status: 'offered', completionMode: 'DERIVED', ...over,
  })
  const slot = (time: string, state: CheckinSlot['state']): CheckinSlot =>
    ({ time, state, values: null, note: null })

  test('an unmapped metric renders NO button — the production growth_intention case', () => {
    setup({ quests: [quest({ id: 'gi', title: 'Fogalmazd meg a mai szándékod', metric: 'intention_focus_set' })] })
    renderToday()
    const row = rowOf('Fogalmazd meg a mai szándékod')
    expect(within(row).queryByRole('button')).toBeNull()
  })

  // The pill says what it will DO (mezo-mvb4.1): `water_target` commits an immediate
  // 250 ml write with no sheet, so its pill must read `+250 ml`, never `Naplózz`.
  test('the water quest\'s pill reads +250 ml and performs the log in place', () => {
    setup({ quests: [quest({ id: 'w', title: 'Igyál vizet', metric: 'water_target' })] })
    renderToday()
    fireEvent.click(within(rowOf('Igyál vizet')).getByRole('button', { name: '+250 ml' }))
    expect(screen.getByTestId('loc').textContent).toBe('/today') // it did not navigate
    expect(screen.queryByRole('dialog')).toBeNull()              // and opened no sheet
  })

  test('a nav quest keeps its own destination label', () => {
    setup({ quests: [quest({ id: 'wl', title: 'Mérd meg magad', metric: 'weight_logged' })] })
    renderToday()
    fireEvent.click(within(rowOf('Mérd meg magad')).getByRole('button', { name: 'Mérés' }))
    expect(screen.getByTestId('loc').textContent).toBe('/me/weight')
  })

  test('a check-in quest renders NO button once every slot is already recorded', () => {
    setup({
      quests: [quest({ id: 'c', title: 'Töltsd ki a check-int', metric: 'checkin_full' })],
      checkins: [slot('06:30', 'done'), slot('10:00', 'done'), slot('14:00', 'done'), slot('20:00', 'done')],
    })
    renderToday()
    expect(within(rowOf('Töltsd ki a check-int')).queryByRole('button')).toBeNull()
  })

  test('a check-in quest keeps its button while a slot is still open', () => {
    setup({
      quests: [quest({ id: 'c', title: 'Töltsd ki a check-int', metric: 'checkin_full' })],
      checkins: [slot('06:30', 'done'), slot('10:00', 'skipped'), slot('14:00', 'done'), slot('20:00', 'pending')],
    })
    renderToday()
    fireEvent.click(within(rowOf('Töltsd ki a check-int')).getByRole('button', { name: 'Check-in' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  // C1's other half: with a skipped slot still fillable, the quest stays winnable, so its CTA
  // must survive AND open a slot that can actually be filled — the first unrecorded one.
  test('a check-in quest keeps its button when only SKIPPED slots are left, and opens one', () => {
    setup({
      quests: [quest({ id: 'c', title: 'Töltsd ki a check-int', metric: 'checkin_full' })],
      checkins: [slot('06:30', 'done'), slot('10:00', 'skipped'), slot('14:00', 'skipped'), slot('20:00', 'skipped')],
    })
    renderToday()
    fireEvent.click(within(rowOf('Töltsd ki a check-int')).getByRole('button', { name: 'Check-in' }))
    expect(screen.getByRole('dialog').textContent).toContain('10:00')
  })
})

/**
 * C1 — a slot whose window has passed with nothing recorded stays OPEN and fillable
 * (`Pótold`), with honest past-tense copy. The real-mode 15:00 day:
 * `buildDaySlots` yields ['skipped','skipped','now','pending'].
 */
describe('TodayPage — a passed check-in slot is still fillable (mezo-mvb4.1)', () => {
  const slot = (time: string, state: CheckinSlot['state']): CheckinSlot =>
    ({ time, state, values: null, note: null })
  const AT_15 = [slot('06:30', 'skipped'), slot('10:00', 'skipped'), slot('14:00', 'now'), slot('20:00', 'pending')]

  test('the morning daypart renders BOTH passed slots, each with a Pótold pill', () => {
    setup({ habits: [], checkins: AT_15 })
    renderToday('/today?dp=reggel')
    const rows = screen.getAllByText('Hogy voltál?')
    expect(rows).toHaveLength(2)
    for (const r of rows) {
      expect(within(r.closest('.td-row') as HTMLElement).getByRole('button')).toHaveTextContent('Pótold')
    }
  })

  test('the copy does not pretend it was on time — past tense + „elmaradt" + its own clock time', () => {
    setup({ habits: [], checkins: AT_15 })
    renderToday('/today?dp=reggel')
    const row = screen.getAllByText('Hogy voltál?')[0].closest('.td-row') as HTMLElement
    expect(row).toHaveTextContent('06:30 · elmaradt')
    expect(within(row).queryByText('Koppints')).toBeNull()
  })

  test('Pótold opens the sheet for THAT slot, so the morning can be recorded', () => {
    setup({ habits: [], checkins: AT_15 })
    renderToday('/today?dp=reggel')
    const row = screen.getAllByText('Hogy voltál?')[0].closest('.td-row') as HTMLElement
    fireEvent.click(within(row).getByRole('button', { name: 'Pótold' }))
    expect(screen.getByRole('dialog').textContent).toContain('06:30')
  })
})

describe('TodayPage — an in-flight habit write withdraws its controls', () => {
  const waterQuest: DailyQuest = {
    id: 'w', questDate: '2026-05-21', slot: 'GROWTH', skillKey: 'mindset',
    title: 'Igyál vizet', why: 'w', targetLabel: 't', metric: 'water_target', xp: 20,
    status: 'offered', completionMode: 'DERIVED',
  }

  test('an in-flight habit write withdraws habit pills but leaves quest pills live', () => {
    setup({ habits: ALL_KINDS, quests: [waterQuest], pending: true })
    const { container } = renderToday('/today?dp=este')
    // no clickable control survives on a HABIT row — the DERIVED rows' pills stay as inert
    // copy (`.td-act.is-inert`), but the MANUAL row's tick WITHDRAWS entirely (TodayRow's own
    // rule: it withdraws, it does not dim), so no button and no leftover ✓ ghost either.
    // The row itself is NOT gone, though — its title stays readable while the write is in
    // flight, it just loses the tappable control (the positive half of "withdraw, don't dim").
    expect(within(rowOf('MANUAL lánc')).getByText('MANUAL lánc')).toBeInTheDocument()
    expect(within(rowOf('MANUAL lánc')).queryByRole('button')).toBeNull()
    expect(rowOf('MANUAL lánc').querySelector('.td-tick')).toBeNull()
    expect(container.querySelector('.td-act.is-inert')).toBeTruthy()
    // …while a quest row, which the habit write cannot double-fire, stays live
    expect(within(rowOf('Igyál vizet')).getByRole('button', { name: '+250 ml' })).toBeInTheDocument()
  })

  test('with no write in flight the controls are live', () => {
    setup({ habits: ALL_KINDS })
    renderToday('/today?dp=este')
    fireEvent.click(within(rowOf('MANUAL lánc')).getByRole('button', { name: /kipipálása/ }))
    expect(check).toHaveBeenCalledWith('caffeine_cutoff')
  })
})

describe('TodayPage — the chain-completion celebration', () => {
  const chain = (which: 'MORNING' | 'EVENING', allDone: boolean): HabitItem[] => [
    habit({ key: 'a', chain: which, title: 'A', mode: 'MANUAL', status: 'done', position: 1 }),
    habit({
      key: 'b', chain: which, title: 'B', mode: 'MANUAL',
      status: allDone ? 'done' : 'pending', position: 2,
    }),
  ]

  test('the morning daypart toasts once when its chain completes', () => {
    const seen: ToastMessage[] = []
    const off = onToast((t) => seen.push(t))
    setup({ habits: chain('MORNING', true) })
    const { rerender } = renderToday('/today?dp=reggel')
    // A re-render of an already-complete chain stays silent (the wasComplete edge).
    rerender(<div />)
    off()
    expect(seen).toEqual([{ kind: 'success', text: '🌅 Tökéletes reggel' }])
  })

  test('the evening daypart toasts once when its chain completes', () => {
    const seen: ToastMessage[] = []
    const off = onToast((t) => seen.push(t))
    setup({ habits: chain('EVENING', true) })
    renderToday('/today?dp=este')
    off()
    expect(seen).toEqual([{ kind: 'success', text: '🌙 Tökéletes este' }])
  })

  test('an incomplete chain never celebrates', () => {
    const seen: ToastMessage[] = []
    const off = onToast((t) => seen.push(t))
    setup({ habits: chain('MORNING', false) })
    renderToday('/today?dp=reggel')
    off()
    expect(seen).toEqual([])
  })
})

describe('TodayPage — the day daypart hero', () => {
  test('a rest day offers the custom-workout sheet instead of a session hero', async () => {
    mocks.useToday.mockReturnValue({ ...baseToday, workout: null, workoutTime: null })
    const { container } = renderToday('/today?dp=nap')
    // Zero-guard: no workout ⇒ no duration fact anywhere in the hero markup (the
    // Pihenő placeholder's own `.td-hero-u` reads "nap", never a `~X perc` chip).
    expect(container.querySelector('.td-hero-u')?.textContent).not.toMatch(/perc/)
    fireEvent.click(screen.getByRole('button', { name: 'Saját edzés' }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
  })

  // mezo-v84m — the bug this describe block was missing: the gym session was authored with a
  // hardcoded `logged: false`, so a workout already finished today still read „Indítsuk" on Ma
  // while the Train tab read „Kész · N szett". The done-state is one flag from `useToday` now.
  test('a finished workout retires the start CTA for the done footnote', () => {
    mocks.useToday.mockReturnValue({ ...baseToday, workoutDone: true, workoutDoneSets: 18 })
    const { container } = renderToday('/today?dp=nap')
    expect(screen.queryByRole('button', { name: 'Indítsuk' })).toBeNull()
    expect(container.querySelector('.td-foot.is-done')?.textContent).toContain('Kész · 18 szett')
    // The hero itself survives — the day still had a session, it is simply over.
    expect(container.querySelector('.td-hero-u')?.textContent).toContain('Pull Day')
  })

  test('an unfinished workout keeps the start CTA', () => {
    mocks.useToday.mockReturnValue(baseToday)
    renderToday('/today?dp=nap')
    expect(screen.getByRole('button', { name: 'Indítsuk' })).toBeInTheDocument()
  })

  // mezo-6kap — a half-finished session is not a fresh one: the CTA resumes (and says how far
  // in), it never invites a restart. Same `/train` target, honest label.
  test('an open instance turns the CTA into Folytassuk with the logged set count', () => {
    mocks.useToday.mockReturnValue({ ...baseToday, workoutInProgress: true, workoutOpenSets: 6 })
    renderToday('/today?dp=nap')
    expect(screen.queryByRole('button', { name: 'Indítsuk' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Folytassuk · 6 szett kész' })).toBeInTheDocument()
  })

  test('an open instance with nothing logged yet reads a bare Folytassuk', () => {
    mocks.useToday.mockReturnValue({ ...baseToday, workoutInProgress: true, workoutOpenSets: 0 })
    renderToday('/today?dp=nap')
    expect(screen.getByRole('button', { name: 'Folytassuk' })).toBeInTheDocument()
  })

  test('a finished workout beats an open one — done wins over resume', () => {
    mocks.useToday.mockReturnValue({
      ...baseToday, workoutDone: true, workoutDoneSets: 18, workoutInProgress: true, workoutOpenSets: 6,
    })
    const { container } = renderToday('/today?dp=nap')
    expect(screen.queryByRole('button', { name: /Folytassuk/ })).toBeNull()
    expect(container.querySelector('.td-foot.is-done')?.textContent).toContain('Kész · 18 szett')
  })
})

// mezo-6kap — the sport hero carried the same hardcoded `logged: false` the gym hero did.
describe('TodayPage — the sport hero done-state', () => {
  // 17:00 lands in the nap window (11:45–19:15), and with no gym workout the sport session
  // is `sessions[0]` — the day daypart's hero.
  const sportOnly = (over: Record<string, unknown> = {}) => ({
    ...baseToday,
    workout: null,
    workoutTime: null,
    volleyballSessions: [{
      day: 'Csü', time: '17:00', duration: 90, court: 'BVSC csarnok',
      intensity: 'közepes', role: 'ütő', today: true,
    }] as VolleyballSession[],
    ...over,
  })

  // Scoped to the promoted hero button (`.td-cta`): a fuel ROW carries its own „Logold" pill
  // (`.td-act`), so an unscoped role query matches two buttons and proves nothing about the hero.
  const heroCta = (container: HTMLElement) => container.querySelector('.td-cta')

  test('an unlogged sport session keeps its Logold CTA', () => {
    mocks.useToday.mockReturnValue(sportOnly())
    const { container } = renderToday('/today?dp=nap')
    expect(heroCta(container)?.textContent).toBe('Logold')
  })

  test('a logged sport session drops the CTA for the done footnote', () => {
    // No `sport` discriminator ⇒ `sportOf` resolves volleyball (the Phase-1 default).
    mocks.useToday.mockReturnValue(sportOnly({ loggedSportKinds: ['volleyball'] }))
    const { container } = renderToday('/today?dp=nap')
    expect(heroCta(container)).toBeNull()
    expect(container.querySelector('.td-foot.is-done')?.textContent).toContain('Kész')
  })

  test('a different logged kind leaves this hero alone — a mixed day flips each independently', () => {
    mocks.useToday.mockReturnValue(sportOnly({ loggedSportKinds: ['trx'] }))
    const { container } = renderToday('/today?dp=nap')
    expect(heroCta(container)?.textContent).toBe('Logold')
  })
})

/**
 * I3 + I5 heritage (mezo-mvb4.1): the session is authored once — the hero is a reference to
 * the same object the item is built from, and the daypart views filter it by ID. An early gym
 * slot must render exactly once (the day view's hero), and a stacked day's non-hero session
 * must still render as a row on its own daypart.
 */
describe('TodayPage — a session is authored once (mezo-mvb4.1)', () => {
  const rows = (container: HTMLElement) =>
    [...container.querySelectorAll('.dv-groups .td-row')]
      .map((r) => r.querySelector('.td-t1')?.textContent)

  test('the promoted session renders on the day view only', () => {
    mocks.useToday.mockReturnValue({ ...baseToday, workoutTime: '07:30' })
    const { container } = renderToday('/today?dp=reggel')
    // On the morning daypart it renders NOWHERE (that inert twin is what I5 was) — the
    // capsule essence line that used to carry it is gone with the islands…
    expect(shownFace(container)).toBe('reggel')
    // scoped to the daypart view: the standing mezo message's prose names Pull Day too,
    // and that band is not the morning's content.
    const morning = container.querySelector('.dayview') as HTMLElement
    expect(within(morning).queryByText(/Pull Day/)).toBeNull()
    // …and switching to the day tab shows it as the hero with its real CTA.
    fireEvent.click(tab(/Nap/))
    expect(shownFace(container)).toBe('nap')
    expect(container.querySelector('.td-hero-v')?.textContent).toContain('07:30')
    expect(container.querySelector('.td-hero-u')?.textContent).toContain('Pull Day')
    // Hand-computed duration (sessionLength.ts estimateSessionMinutes), never call the
    // estimator here — derived from the mock `workout.exercises` (src/data/train/train.ts,
    // 5 exercises). avgReps=(repMin+repMax)/2, repSec=3.5 (none plyo), restSecondsFor
    // compound=150 / isolation=90, warmup set = warmupSetSeconds 20 + warmupRestSeconds 45
    // = 65s/set, +90s transition per exercise, ONE Math.round on the summed seconds, +8min block.
    //   ex1 Chest Supported Row  compound  warmupSets=2 workingSets=3 repMin=8  repMax=10
    //     avgReps=9;    work=3*9*3.5=94.5;    rest=(3-1)*150=300; warmup=2*65=130; transition=90 -> 614.5
    //   ex2 Lat Pulldown         compound  warmupSets=2 workingSets=3 repMin=10 repMax=12
    //     avgReps=11;   work=3*11*3.5=115.5;  rest=2*150=300;     warmup=2*65=130; transition=90 -> 635.5
    //   ex3 Cable Pull-Around    isolation warmupSets=1 workingSets=3 repMin=12 repMax=15
    //     avgReps=13.5; work=3*13.5*3.5=141.75; rest=2*90=180;    warmup=1*65=65;  transition=90 -> 476.75
    //   ex4 Hammer Curl          isolation warmupSets=1 workingSets=3 repMin=10 repMax=12
    //     avgReps=11;   work=3*11*3.5=115.5;  rest=2*90=180;      warmup=1*65=65;  transition=90 -> 450.5
    //   ex5 Face Pull            isolation warmupSets=1 workingSets=3 repMin=15 repMax=20
    //     avgReps=17.5; work=3*17.5*3.5=183.75; rest=2*90=180;    warmup=1*65=65;  transition=90 -> 518.75
    //   total seconds = 614.5 + 635.5 + 476.75 + 450.5 + 518.75 = 2696
    //   minutes = Math.round(2696 / 60) + warmupBlockMinutes(8) = Math.round(44.9333) + 8 = 45 + 8 = 53
    expect(container.querySelector('.td-hero-u')?.textContent).toContain('~53 perc')
    expect(screen.getByRole('button', { name: 'Indítsuk' })).toBeInTheDocument()
    expect(rows(container)).not.toContain('Pull Day')
  })

  test('on a STACKED day the non-hero session still renders as a row on its own daypart', () => {
    // Gym + a 17:00 sport session: the nap window is 11:45–19:15, so 17:00 is `nap` — the same
    // daypart the gym hero occupies. The sport session must surface as a row with its facts.
    const session: VolleyballSession = {
      day: 'Csü', time: '17:00', duration: 90, court: 'BVSC csarnok',
      intensity: 'közepes', role: 'edzés', today: true,
    }
    mocks.useToday.mockReturnValue({ ...baseToday, volleyballSessions: [session] })
    const { container } = renderToday('/today?dp=nap')
    // the gym is the hero…
    expect(container.querySelector('.td-hero-u')?.textContent).toContain('Pull Day')
    // …and the volleyball session is a row, with its own facts
    expect(rows(container)).toContain('Volleyball')
    const row = screen.getByText('Volleyball').closest('.td-row') as HTMLElement
    expect(row).toHaveTextContent('90 perc · BVSC csarnok · edzés')
    expect(row).toHaveTextContent('17:00')
  })

  test('with no gym the sport session is the hero, and is not also a row', () => {
    const session: VolleyballSession = {
      day: 'Csü', time: '17:00', duration: 90, court: 'BVSC csarnok',
      intensity: 'közepes', role: 'edzés', today: true,
    }
    mocks.useToday.mockReturnValue({
      ...baseToday, workout: null, workoutTime: null, volleyballSessions: [session],
    })
    const { container } = renderToday('/today?dp=nap')
    expect(container.querySelector('.td-hero-u')?.textContent).toContain('Volleyball')
    expect(rows(container)).not.toContain('Volleyball')
  })
})

/**
 * Catalog-driven bucketing (mezo-n5e9.2): real mode's `{chains: []}` unresolved frame must
 * never crash, and the habit rows must show up the moment the catalog resolves.
 */
describe('TodayPage — habit bucketing tracks the live catalog (mezo-n5e9.2)', () => {
  test('an unresolved catalog ({chains: []}) skips every habit row without crashing', () => {
    setup({ habits: ALL_KINDS, catalogChains: [], catalogPending: true })
    renderToday('/today?dp=este')
    // Every chain lookup misses while the catalog is unresolved — every habit row vanishes
    // rather than the page throwing on an undefined chain; reaching this assertion at all
    // is itself the no-crash proof.
    for (const f of KIND_FIXTURES) {
      expect(screen.queryByText(f.title)).toBeNull()
    }
    // the screen itself is still standing — the daypart switcher renders as always
    expect(screen.getByRole('group', { name: 'Napszak' })).toBeInTheDocument()
  })

  test('habit rows appear the moment the catalog resolves — the items memo tracks catalog.chains', () => {
    setup({ habits: ALL_KINDS, catalogChains: [], catalogPending: true })
    const { rerender } = renderToday('/today?dp=este')
    expect(screen.queryByText('MANUAL lánc')).toBeNull()

    mocks.useHabitCatalog.mockReturnValue({ catalog: { chains: SEED_CHAINS }, isPending: false })
    rerender(tree('/today?dp=este'))

    expect(screen.getByText('MANUAL lánc')).toBeInTheDocument()
    expect(within(rowOf('MANUAL lánc')).getByRole('button')).toHaveTextContent('✓')
  })
})

/**
 * The Életjel-ring detail sheet + its quick-log CTA (mezo-dhzk Task 4): a ring tap opens
 * `NeedRingSheet` on `needSheet`, and the sheet's own CTA dispatches through `onNeedCta` —
 * the SAME sheet states / mutations every other row on this screen already reaches for. Only
 * the hidratáció ring is covered here (an immediate mutation, no sheet-in-sheet to route
 * through); the other four CTAs reuse `onAct`'s already-covered branches one-for-one.
 */
describe('TodayPage — the Életjel-ring detail sheet and its quick-log CTA (mezo-dhzk)', () => {
  test('tapping the hidratáció ring opens its detail sheet', () => {
    renderToday()
    fireEvent.click(screen.getByRole('button', { name: /Hidratáció/ }))
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Hidratáció')
  })

  test("the sheet's CTA logs 250 ml and closes the sheet", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderToday()
    fireEvent.click(screen.getByRole('button', { name: /Hidratáció/ }))
    await user.click(screen.getByRole('button', { name: '💧 +250 ml — Logolás' }))
    expect(logWater).toHaveBeenCalledWith(250)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })
})
