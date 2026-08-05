// ============================================================
// Mezo · TodayPage dispatch coverage (mezo-j7u4 fix round 1).
// The screen is the sheet host the retired RoutineCard / TodayQuestsCard were, so the
// dead-control risk lives HERE: `buildTodayItems` gives every habit an action pill, and a
// kind `act()` does not serve renders a button that does nothing. This file walks EVERY
// `habitAction` kind and asserts each one either performs its check, follows its route,
// opens its sheet, or renders NO button at all. It also covers the consume-once level-up
// dance both retired cards used to run.
//
// Separate from TodayPage.test.tsx because it module-mocks four data hooks; the composition
// file deliberately runs against the real ones.
// ============================================================
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { TodayPage } from '@/features/today/pages/TodayPage'
import { LevelUpProvider } from '@/features/progression/LevelUpProvider'
import { QueryWrapper } from '@/test/queryWrapper'
import { gymLevelUpMock } from '@/data/progression/progressionMock'
import { today, user, workout, workoutPrediction, volleyballNote } from '@/data/today/today'
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
  }
})

const habit = (over: Partial<HabitItem>): HabitItem => ({
  key: 'x', chain: 'EVENING', position: 1, title: 't', why: 'w', anchorCopy: 'a',
  mode: 'DERIVED', status: 'pending', xp: 5, strengthPct: 50, ...over,
})

// The two seed chains (mezo-n5e9.2 — mirrors `mockHabitCatalog`): every fixture in this file
// puts its habits on the literal 'MORNING'/'EVENING' chain keys, so this is the default catalog
// `setup()` feeds `useHabitCatalog` — keeps every existing test's bucketing byte-identical to
// the retired hardcoded MORNING/EVENING maps.
const SEED_CHAINS: HabitChainInfo[] = [
  { id: 'chain-morning', chainKey: 'MORNING', title: 'Reggeli rutin', daypart: 'MORNING', position: 1, isActive: true, defs: [] },
  { id: 'chain-evening', chainKey: 'EVENING', title: 'Esti rutin', daypart: 'EVENING', position: 2, isActive: true, defs: [] },
]

/**
 * One habit per `habitAction` kind, all on the EVENING chain so every row lands in the
 * evening face's `TodoCard` (the morning face promotes its chain into the hero and shows only
 * the next step). `chain` is plain data — `habitAction` keys off `key` + `mode` — so putting
 * `morning_coffee` on the evening chain is a legitimate way to reach the `nav` mapping;
 * `evening_ritual`, the only naturally-evening nav habit, is deliberately suppressed on that
 * face because the RitualCard hero owns it.
 */
const KIND_FIXTURES = [
  { kind: 'check', key: 'caffeine_cutoff', title: 'MANUAL lánc', mode: 'MANUAL' as const, pill: 'Pipa' },
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
  today, user, briefing: null, briefingDemo: false,
  workout, workoutTime: today.workoutTime, prediction: workoutPrediction,
  volleyballSessions: [] as VolleyballSession[], volleyballNote,
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

const rowOf = (title: string) => screen.getByText(title).closest('.itemrow') as HTMLElement

let check: ReturnType<typeof vi.fn>
let consumeHabitLevelUps: ReturnType<typeof vi.fn>
let consumeQuestLevelUps: ReturnType<typeof vi.fn>

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

describe('TodayPage — consume-once level-ups', () => {
  test('a habit level-up fires the overlay once and is consumed', async () => {
    setup({ habitLevelUps: [gymLevelUpMock] })
    renderToday()
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(consumeHabitLevelUps).toHaveBeenCalledTimes(1)
  })

  test('a quest level-up fires the overlay once and is consumed', async () => {
    setup({ questLevelUps: [gymLevelUpMock] })
    renderToday()
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(consumeQuestLevelUps).toHaveBeenCalledTimes(1)
  })

  test('an empty payload never fires the overlay and never consumes', () => {
    renderToday()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(consumeHabitLevelUps).not.toHaveBeenCalled()
    expect(consumeQuestLevelUps).not.toHaveBeenCalled()
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
    // quest-catalog.json ships `growth_intention` with metric `intention_focus_set` on
    // dayTypes ["ANY"]; questAction.ts has no mapping for it, so its `Naplózz` pill used to
    // do nothing every single day the rotation offered it.
    setup({ quests: [quest({ id: 'gi', title: 'Fogalmazd meg a mai szándékod', metric: 'intention_focus_set' })] })
    renderToday()
    const row = rowOf('Fogalmazd meg a mai szándékod')
    expect(within(row).queryByRole('button')).toBeNull()
  })

  // The pill says what it will DO (mezo-mvb4.1). `water_target` is the case that matters:
  // tapping it commits an immediate 250 ml write with no sheet and no confirmation, so a pill
  // reading „Naplózz" — the word every log-surface row on this screen uses — hid a mutation
  // behind what looked like a navigation.
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
 * C1 — the ship-blocker. A slot whose window has passed with nothing recorded used to become
 * `status: 'missed'`, and nothing on the branch renders a `missed` item, so from 10:00 onward
 * every unfilled morning slot was invisible AND unfillable: `RitualPage` and the quest CTA both
 * only ever opened the single OPEN slot. This is the real-mode 15:00 day the review described:
 * `buildDaySlots` yields ['skipped','skipped','now','pending'].
 */
describe('TodayPage — a passed check-in slot is still fillable (mezo-mvb4.1)', () => {
  const slot = (time: string, state: CheckinSlot['state']): CheckinSlot =>
    ({ time, state, values: null, note: null })
  const AT_15 = [slot('06:30', 'skipped'), slot('10:00', 'skipped'), slot('14:00', 'now'), slot('20:00', 'pending')]

  test('the morning face renders BOTH passed slots, each with a Pótold pill', () => {
    setup({ habits: [], checkins: AT_15 })
    const { container } = renderToday('/today?dp=reggel')
    const card = within(container.querySelector('.tdc') as HTMLElement)
    const rows = card.getAllByText('Hogy voltál?')
    expect(rows).toHaveLength(2)
    for (const r of rows) {
      expect(within(r.closest('.itemrow') as HTMLElement).getByRole('button')).toHaveTextContent('Pótold')
    }
  })

  test('the copy does not pretend it was on time — past tense + „elmaradt" + its own clock time', () => {
    setup({ habits: [], checkins: AT_15 })
    const { container } = renderToday('/today?dp=reggel')
    const row = within(container.querySelector('.tdc') as HTMLElement)
      .getAllByText('Hogy voltál?')[0].closest('.itemrow') as HTMLElement
    expect(row).toHaveTextContent('06:30 · elmaradt')
    expect(within(row).queryByText('Koppints')).toBeNull()
  })

  test('Pótold opens the sheet for THAT slot, so the morning can be recorded', () => {
    setup({ habits: [], checkins: AT_15 })
    const { container } = renderToday('/today?dp=reggel')
    const row = within(container.querySelector('.tdc') as HTMLElement)
      .getAllByText('Hogy voltál?')[0].closest('.itemrow') as HTMLElement
    fireEvent.click(within(row).getByRole('button', { name: 'Pótold' }))
    expect(screen.getByRole('dialog').textContent).toContain('06:30')
  })
})

describe('TodayPage — an in-flight habit write withdraws its controls', () => {
  test('a pending check withdraws the chain rows AND the hero CTA', () => {
    setup({ habits: ALL_KINDS, pending: true })
    const { container } = renderToday('/today?dp=este')
    // the labels stay as inert copy — no clickable control survives
    expect(within(rowOf('MANUAL lánc')).queryByRole('button')).toBeNull()
    expect(within(rowOf('MANUAL lánc')).getByText('Pipa')).toBeInTheDocument()
    expect(container.querySelector('.itemrow-act.is-inert')).toBeTruthy()
  })

  test('the morning hero CTA is withdrawn while a check is in flight', () => {
    setup({ habits: [habit({ key: 'morning_sunlight', chain: 'MORNING', title: 'Napfény', mode: 'MANUAL' })], pending: true })
    const { container } = renderToday('/today?dp=reggel')
    expect(container.querySelector('.fhc-next-go.is-inert')?.textContent).toBe('Pipa')
    expect(container.querySelector('button.fhc-next-go')).toBeNull()
  })

  test('with no write in flight the controls are live', () => {
    setup({ habits: ALL_KINDS })
    renderToday('/today?dp=este')
    fireEvent.click(within(rowOf('MANUAL lánc')).getByRole('button', { name: 'Pipa' }))
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

  test('the morning face toasts once when its chain completes', () => {
    const seen: ToastMessage[] = []
    const off = onToast((t) => seen.push(t))
    setup({ habits: chain('MORNING', true) })
    const { rerender } = renderToday('/today?dp=reggel')
    // A re-render of an already-complete chain stays silent (the wasComplete edge).
    rerender(<div />)
    off()
    expect(seen).toEqual([{ kind: 'success', text: '🌅 Tökéletes reggel' }])
  })

  test('the evening face toasts once when its chain completes', () => {
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

describe('TodayPage — the day hero carries its companion copy', () => {
  test('a stacked day (workout + sport session) shows the load note', () => {
    const session: VolleyballSession = {
      day: 'Csü', time: '19:30', duration: 90, court: 'BVSC csarnok',
      intensity: 'közepes', role: 'edzés', today: true,
    }
    mocks.useToday.mockReturnValue({ ...baseToday, volleyballSessions: [session] })
    renderToday('/today?dp=nap')
    expect(screen.getByText(/T-2h carb-ablakot/)).toBeInTheDocument()
  })

  test('a gym-only day shows no load note (honest absence)', () => {
    renderToday('/today?dp=nap')
    expect(screen.queryByText(/T-2h carb-ablakot/)).toBeNull()
  })

  test('a rest day offers the custom-workout sheet instead of a hero', async () => {
    mocks.useToday.mockReturnValue({ ...baseToday, workout: null, workoutTime: null })
    renderToday('/today?dp=nap')
    fireEvent.click(screen.getByRole('button', { name: /Saját edzés/ }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
  })
})

/**
 * I3 + I5 — one root cause. Session bucketing and hero selection used to be two independent
 * computations over the same data, built from near-duplicate literals, so they could disagree:
 *   • I5 (duplication) — a real early gym slot (real mode's schedule is 07:30) bucketed onto
 *     `reggel` as an inert `GYM` row while the SAME session was the Nap face's hero, with a
 *     different eyebrow and a CTA the row did not have. Mock hides it only because
 *     `data/today/today.ts` pins `workoutTime = '17:00'`.
 *   • I3 (loss) — `FaceDay` filtered EVERY `source === 'session'` row, but only one session can
 *     be the hero, so a second session inside the nap window had no surface at all.
 * The session is now authored once, the hero is a reference to that object, and the faces filter
 * by its ID — which closes both.
 */
describe('TodayPage — a session is authored once (mezo-mvb4.1)', () => {
  const rowsOfTodoCard = (container: HTMLElement) =>
    [...container.querySelectorAll('.tdc .itemrow')]
      .map((r) => r.querySelector('.itemrow-t1')?.textContent)

  test('an EARLY gym slot renders once — the Nap hero, never a twin row on Reggel', () => {
    mocks.useToday.mockReturnValue({ ...baseToday, workoutTime: '07:30' })
    const { container } = renderToday('/today?dp=reggel')
    // On the morning face it is NOT a TodoCard row (that inert twin is what I5 was)…
    expect(rowsOfTodoCard(container)).not.toContain('Pull Day')
    // …its single appearance there is the „Ma még vár rád" preview, which JUMPS to its face.
    const preview = screen.getAllByRole('button', { name: /^Pull Day — ugrás/ })
    expect(preview).toHaveLength(1)
    fireEvent.click(preview[0])
    // …and on the Nap face it is the hero card, exactly once, with its real CTA — and still
    // not a row.
    expect(screen.getByRole('tab', { selected: true })).toHaveAccessibleName(/^Nap/)
    expect(screen.getAllByRole('heading', { name: 'Pull Day' })).toHaveLength(1)
    expect(screen.getByRole('button', { name: /Indítsuk/ })).toBeInTheDocument()
    expect(rowsOfTodoCard(container)).not.toContain('Pull Day')
  })

  test('the hero eyebrow and the item are the same object — no tag drift', () => {
    mocks.useToday.mockReturnValue({ ...baseToday, workoutTime: '07:30' })
    renderToday('/today?dp=nap')
    // `GYM · {workout.tag}` was the hero's literal; the row's was a bare `GYM`.
    expect(screen.getByText('GYM · Week 3 · MAV')).toBeInTheDocument()
  })

  test('on a STACKED day the non-hero session still renders as a row on its own face', () => {
    // Gym + a 17:00 sport session: with wake 06:45 / bed 23:15 the nap window is 11:45–19:15,
    // so 17:00 is `nap` — the same face the gym hero occupies. The old `source` filter swept
    // the sport session away, and `later` only carries `este`, so its time, court, role and
    // duration were visible nowhere. The old page rendered exactly this case explicitly.
    const session: VolleyballSession = {
      day: 'Csü', time: '17:00', duration: 90, court: 'BVSC csarnok',
      intensity: 'közepes', role: 'edzés', today: true,
    }
    mocks.useToday.mockReturnValue({ ...baseToday, volleyballSessions: [session] })
    const { container } = renderToday('/today?dp=nap')
    // the gym is the hero…
    expect(screen.getAllByRole('heading', { name: 'Pull Day' })).toHaveLength(1)
    // …and the volleyball session is a row, with its own facts
    expect(rowsOfTodoCard(container)).toContain('Volleyball')
    const row = screen.getByText('Volleyball').closest('.itemrow') as HTMLElement
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
    expect(screen.getAllByRole('heading', { name: 'Volleyball' })).toHaveLength(1)
    expect(rowsOfTodoCard(container)).not.toContain('Volleyball')
  })
})

/**
 * Catalog-driven bucketing (mezo-n5e9.2). `buildTodayItems` now looks up each habit's chain in
 * `useHabitCatalog()`'s live chains instead of a hardcoded MORNING/EVENING map — real mode's
 * `{chains: []}` unresolved frame must never crash, and the habit rows must show up the moment
 * the catalog resolves (both reads live in the same TanStack cache; TodayPage's `items` useMemo
 * has to track `catalog.chains`, or a resolved catalog would render a stale, still-empty face).
 */
describe('TodayPage — habit bucketing tracks the live catalog (mezo-n5e9.2)', () => {
  test('an unresolved catalog ({chains: []}) skips every habit row without crashing', () => {
    setup({ habits: ALL_KINDS, catalogChains: [], catalogPending: true })
    renderToday('/today?dp=este')
    // Every chain lookup misses while the catalog is unresolved — every habit row vanishes
    // rather than the page throwing on an undefined chain (non-habit sources — ritual, fuel,
    // check-ins — don't route through the catalog, so they still render normally: reaching
    // this assertion at all is itself the no-crash proof).
    for (const f of KIND_FIXTURES) {
      expect(screen.queryByText(f.title)).toBeNull()
    }
    expect(screen.getByRole('tablist', { name: 'Napszakok' })).toBeInTheDocument()
  })

  test('habit rows appear the moment the catalog resolves — the items memo tracks catalog.chains', () => {
    setup({ habits: ALL_KINDS, catalogChains: [], catalogPending: true })
    const { rerender } = renderToday('/today?dp=este')
    expect(screen.queryByText('MANUAL lánc')).toBeNull()

    mocks.useHabitCatalog.mockReturnValue({ catalog: { chains: SEED_CHAINS }, isPending: false })
    rerender(tree('/today?dp=este'))

    expect(screen.getByText('MANUAL lánc')).toBeInTheDocument()
    expect(within(rowOf('MANUAL lánc')).getByRole('button')).toHaveTextContent('Pipa')
  })
})
