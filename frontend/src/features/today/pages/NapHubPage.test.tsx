// ============================================================
// Mezo · NapHubPage — Titanium landing (mezo-mhum)
//
// Every test below is named after the row of the FROZEN coverage manifest
// (`docs/design_2.0/2026-09-10-nap-mai-coverage.md`) whose "Preservation test" column it
// implements — the manifest is the product contract, this file is its executable form.
//
// The harness is mode-agnostic (the same reason the pre-Titanium file gave): real-mode MSW
// fixtures carry none of the data these assertions are about, so every hook the page reads
// gets a deterministic stub. The clock is pinned (`useMinuteTick` mocked) AND the sleep goal
// is pinned to wake 06:45 / bed 23:15, because the daypart, the wind-down window and the
// evening extras are all derived from that one pair — an unpinned CI clock would flip them.
// ============================================================
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { NapHubPage } from '@/features/today/pages/NapHubPage'
import { LevelUpProvider } from '@/features/progression/LevelUpProvider'
import { ToastProvider } from '@/shared/ui/ToastProvider'
import { QueryWrapper } from '@/test/queryWrapper'

// The water pair shares one store: several hooks read `useFuelDay` (the page AND the needs
// sim), so a per-instance useState stub would let `logWater` update the wrong instance.
const waterStore = vi.hoisted(() => {
  const listeners = new Set<() => void>()
  return {
    water: 1850,
    undoable: false,
    subscribe: (l: () => void) => { listeners.add(l); return () => listeners.delete(l) },
    emit() { listeners.forEach((l) => l()) },
    add(ml: number) { this.water += ml; this.undoable = true; this.emit() },
    undo() { this.water -= 250; this.undoable = false; this.emit() },
    reset() { this.water = 1850; this.undoable = false; this.emit() },
  }
})

const habitStore = vi.hoisted(() => {
  const listeners = new Set<() => void>()
  const seed = () => [
    { key: 'morning_sunlight', chain: 'MORNING', position: 1, title: 'Napfény · 10 perc', why: '', anchorCopy: 'ébredés után', mode: 'MANUAL', status: 'done', xp: 10, strengthPct: 76, linkUrl: null },
    { key: 'morning_video', chain: 'MORNING', position: 2, title: 'Reggeli videó', why: '', anchorCopy: 'kávé mellé', mode: 'MANUAL', status: 'pending', xp: 5, strengthPct: 54, linkUrl: 'https://example.com/v' },
    { key: 'morning_pushups', chain: 'MORNING', position: 3, title: '50 fekvőtámasz', why: '', anchorCopy: 'videó után', mode: 'MANUAL', status: 'pending', xp: 10, strengthPct: 88, linkUrl: null },
    { key: 'morning_journal', chain: 'MORNING', position: 4, title: 'Reggeli napló', why: '', anchorCopy: 'videó után', mode: 'MANUAL', status: 'pending', xp: 5, strengthPct: 41, linkUrl: null },
    // ADR 0010 positive control: a DERIVED evening row must never grow a tick button.
    { key: 'bed_on_time', chain: 'EVENING', position: 1, title: 'Időben ágyban', why: '', anchorCopy: '', mode: 'DERIVED', status: 'pending', xp: 10, strengthPct: 71, linkUrl: null },
  ]
  return {
    habits: seed(),
    subscribe: (l: () => void) => { listeners.add(l); return () => listeners.delete(l) },
    check(key: string) {
      this.habits = this.habits.map((h) => (h.key === key ? { ...h, status: 'done' } : h))
      listeners.forEach((l) => l())
    },
    reset() { this.habits = seed(); listeners.forEach((l) => l()) },
  }
})

/** Sleep is mutable so the honest-empty branch (A2) can render with no last night at all. */
const sleepStore = vi.hoisted(() => ({
  lastNight: null as null | { date: string; bedtime: string; wakeup: string; duration: number; quality: number; awakenings: number; mealToSleep: number; notes: string | null },
  reset() {
    this.lastNight = { date: '2026-05-22', bedtime: '00:42', wakeup: '09:03', duration: 7.5, quality: 9, awakenings: 1, mealToSleep: 125, notes: null }
  },
}))

/** Weight is mutable so A3 can slice the log down to ONE weigh-in and prove the arrow goes. */
const weightStore = vi.hoisted(() => ({
  log: [{ date: '2026-05-21', value: 84.6 }, { date: '2026-05-22', value: 84.2 }],
  reset() { this.log = [{ date: '2026-05-21', value: 84.6 }, { date: '2026-05-22', value: 84.2 }] },
}))

/** The workout plan is mutable so A7 can assert the honest `—` cell with no plan. */
const workoutStore = vi.hoisted(() => ({
  type: 'Pull A' as string | null,
  doneSets: 12 as number | null,
  reset() { this.type = 'Pull A'; this.doneSets = 12 },
}))

/** The meal plan is mutable so B4's "now window" branch has a deterministic window. */
const fuelPlanStore = vi.hoisted(() => ({
  slots: [] as { time: string; kind: string; label: string; slotKey?: string; state: string }[],
  reset() {
    this.slots = [
      { time: '08:00', kind: 'meal', label: 'Reggeli', slotKey: 'breakfast', state: 'done' },
      { time: '13:00', kind: 'meal', label: 'Ebéd', slotKey: 'lunch', state: 'pending' },
    ]
  },
}))

const CATALOG = {
  chains: [
    {
      id: 'c-m', chainKey: 'MORNING', title: 'Reggeli rutin', daypart: 'MORNING', position: 0, isActive: true,
      defs: [
        { habitKey: 'morning_video', framework: null, celebration: 'ez a rutin első lépése', anchorHabitKey: null },
        // mezo-3zue.6: a napló a videóra van kötve — a sorrend szerint a fekvőtámasz jönne
        { habitKey: 'morning_journal', framework: 'FOGG', celebration: 'becsukom a füzetet', anchorHabitKey: 'morning_video' },
      ],
    },
    { id: 'c-e', chainKey: 'EVENING', title: 'Esti rutin', daypart: 'EVENING', position: 1, isActive: true, defs: [] },
  ],
  habits: [],
}

// A délelőtti sáv kitöltve → a létra NEM a check-in fokán áll, tehát a víz-fok jön (a mock
// 1,85 / 4 L a 60%-os küszöb alatt van). Így a „következő lépés" determinisztikus.
const CHECKINS = [
  { time: '06:30', state: 'done', values: { energy: 7, stress: 3, body: 6, mental: 7 }, note: null },
  { time: '10:00', state: 'done', values: { energy: 8, stress: 4, body: 7, mental: 8 }, note: null },
  { time: '14:00', state: 'now', values: null, note: null },
  { time: '20:00', state: 'pending', values: null, note: null },
]

/** Mutable so the "still loading" branch can be asserted: a pending read's empty list looks
 *  exactly like an honest "semmi ma", and a fabricated 0 would be a lie. */
const journalStore = vi.hoisted(() => ({
  notes: [] as { id: string; occurredOn: string; text: string; source: string; createdAt: string }[],
  pending: false,
  reset() {
    this.pending = false
    this.notes = [
      { id: 'jn1', occurredOn: '2026-05-22', text: 'Első bejegyzés', source: 'quickinput', createdAt: '2026-05-22T09:00:00Z' },
      { id: 'jn2', occurredOn: '2026-05-22', text: 'Második bejegyzés', source: 'quickinput', createdAt: '2026-05-22T12:00:00Z' },
    ]
  },
}))

/** Mutable so A7 can assert the honest `—` while the gamification read is still open: the
 *  day read's `realEmpty` is `xpTotal: 0`, so a rendered `+0` would be indistinguishable from
 *  a real zero-XP day. */
const gamStore = vi.hoisted(() => ({
  xpTotal: 210,
  pending: false,
  reset() { this.xpTotal = 210; this.pending = false },
}))

/** Mutable so C6 can drive the page's goal rung: the default is the empty list (no goal), the
 *  goal case seeds one so the ladder's 7th rung can be reached from the page itself. */
const lifeGoalStore = vi.hoisted(() => ({
  goals: [] as { id: string; title: string }[],
  pending: false,
  isError: false,
  reset() { this.goals = []; this.pending = false; this.isError = false },
}))

vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  const { useSyncExternalStore } = await import('react')
  return {
    ...actual,
    // A napszakot, a lefekvés-visszaszámlálót és az Éjszakai mód ablakát UGYANEZ a pár dönti el.
    useSleepGoal: () => ({
      goal: { wakeTime: '06:45', bedTime: '23:15', targetMinutes: 480, targetHours: 8 },
      isPending: false,
    }),
    useSleep: () => ({ sleepLog: [], lastNight: sleepStore.lastNight, logSleep: vi.fn() }),
    useFuelDay: () => {
      const water = useSyncExternalStore(waterStore.subscribe, () => waterStore.water)
      return { fuel: { targets: { kcal: 3100, p: 220, c: 380, f: 95, water: 4000 }, consumed: { kcal: 1300, p: 100, c: 152, f: 30, water }, meals: [], pacing: { msg: '' }, micronutrients: [], supplements: [] } }
    },
    useFuelPreview: () => ({ plan: { slots: fuelPlanStore.slots } }),
    useWaterActions: () => ({
      logWater: (ml: number) => waterStore.add(ml),
      undoLastWater: () => waterStore.undo(),
      canUndo: useSyncExternalStore(waterStore.subscribe, () => waterStore.undoable),
    }),
    useToday: () => ({
      today: { workoutType: workoutStore.type },
      workoutDone: false,
      workoutDoneSets: workoutStore.doneSets,
    }),
    useCheckins: () => ({ checkins: CHECKINS, saveCheckIn: vi.fn() }),
    useHabitDay: () => ({ habits: useSyncExternalStore(habitStore.subscribe, () => habitStore.habits) }),
    useHabitCatalog: () => ({ catalog: CATALOG, isPending: false }),
    useHabitActions: () => ({
      check: async (key: string) => { habitStore.check(key); return undefined },
      uncheck: async () => undefined,
      pending: false,
    }),
    useIntentionDay: () => ({
      data: { date: '2026-05-22', creed: 'A rendszer véd — nekem csak jelen kell lennem.', foci: [{ id: 'f1', text: 'evezés-tempó' }], reflection: null },
      isPending: false,
    }),
    useWeight: () => ({
      weightLog: weightStore.log,
      weightTrends: { last7d: { avg: 84.4, weeklyRate: -0.3 }, last4w: { weeklyRate: -0.25 } },
      logWeight: vi.fn(),
    }),
    useJournalNotes: () => ({ data: journalStore.notes, isPending: journalStore.pending, isError: false, refetch: vi.fn() }),
    useLifeGoalToday: () => ({
      today: { goals: lifeGoalStore.goals },
      isPending: lifeGoalStore.pending,
      isError: lifeGoalStore.isError,
    }),
    useRitualDay: () => ({
      data: { date: '2026-05-22', closed: false, closedAt: null, reflectionText: null, window: 'open' },
      isPending: false,
    }),
    useGamificationDay: () => ({
      data: { date: '2026-05-22', xpTotal: gamStore.xpTotal, events: [] },
      isPending: gamStore.pending,
    }),
  }
})

// A pipa-toast payloadja ugyanaz a builder, mint a Rutin oldalon — ezt kémleljük (B2), a
// megjelenítés maga a ToastProvider dolga, ezért a valódi `emitToast` fut tovább alatta.
const emitSpy = vi.hoisted(() => vi.fn())
vi.mock('@/shared/lib/toastBus', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/lib/toastBus')>()
  return {
    ...actual,
    emitToast: (t: unknown) => { emitSpy(t); return (actual.emitToast as (x: never) => void)(t as never) },
  }
})

// Pin the wall clock: `dayFace(tick, sleepGoal)` decides which face counts as "now".
// 13:42 with the pinned 06:45/23:15 anchor → nowFace 'nap', deterministic everywhere.
const clock = vi.hoisted(() => ({ now: new Date('2026-05-22T13:42:00') }))
vi.mock('@/features/today/logic/useMinuteTick', () => ({
  useMinuteTick: () => clock.now,
}))

beforeEach(() => {
  waterStore.reset()
  habitStore.reset()
  sleepStore.reset()
  weightStore.reset()
  workoutStore.reset()
  fuelPlanStore.reset()
  journalStore.reset()
  gamStore.reset()
  lifeGoalStore.reset()
  emitSpy.mockClear()
  clock.now = new Date('2026-05-22T13:42:00')
})
afterEach(() => vi.unstubAllGlobals())

function renderHub(path = '/nap?dp=nap', extraRoutes?: ReactNode) {
  return render(
    <QueryWrapper>
      <ToastProvider>
        <LevelUpProvider>
          <MemoryRouter initialEntries={[path]}>
            <Routes>
              <Route path="/nap" element={<NapHubPage />} />
              {extraRoutes}
            </Routes>
          </MemoryRouter>
        </LevelUpProvider>
      </ToastProvider>
    </QueryWrapper>,
  )
}

/** The six tiles' identity, in DOM order — each tile carries a `nap-t-<key>` class exactly so
 *  the fixed order is assertable without depending on daypart-specific labels. */
function tileOrder(): string[] {
  return [...document.querySelectorAll('.mz-mosaic > *')].map((el) => {
    const token = [...el.classList].find((c) => c.startsWith('nap-t-'))
    return token ?? '(untagged)'
  })
}

// ── A. hero layer ───────────────────────────────────────────────────────────

test('A1: a napszak a köszönést váltja — a hat csempe sorrendje reggel és este UGYANAZ', async () => {
  const morning = renderHub('/nap?dp=reggel')
  expect(await screen.findByText('Jó reggelt.')).toBeInTheDocument()
  const morningTiles = tileOrder()
  morning.unmount()

  renderHub('/nap?dp=este')
  expect(await screen.findByText('Megérkeztél.')).toBeInTheDocument()
  expect(tileOrder()).toEqual(morningTiles)
  expect(morningTiles).toEqual(['nap-t-viz', 'nap-t-alvas', 'nap-t-etkezes', 'nap-t-edzes', 'nap-t-rutin', 'nap-t-naplo'])
})

test('A2/B6: az alvás-csempe a tegnap éjszakát mondja (7:30 · minőség)', async () => {
  renderHub()
  const tile = await screen.findByRole('button', { name: 'Alvás' })
  // seed lastNight: duration 7.5 HOURS → 7:30 (a minutes-fed formatter would show 0:07)
  expect(tile).toHaveTextContent('7:30')
  expect(tile).toHaveTextContent('minőség 9/10')
})

test('A2/B6: alvásadat nélkül nagy „—" áll ott, sosem kitalált nulla', async () => {
  sleepStore.lastNight = null
  renderHub()
  const tile = await screen.findByRole('button', { name: 'Alvás' })
  expect(tile).toHaveTextContent('—')
  expect(tile).toHaveTextContent('Még nincs naplózva')
})

test('A3: reggel a súly-chip a trend-nyíllal jön — EGYETLEN mérésnél nyíl nélkül', async () => {
  const withTrend = renderHub('/nap?dp=reggel')
  const chip = await screen.findByRole('button', { name: 'Súly · részletek' })
  expect(chip).toHaveTextContent('84,2 kg ↘')
  withTrend.unmount()

  weightStore.log = [{ date: '2026-05-22', value: 84.2 }]
  renderHub('/nap?dp=reggel')
  const single = await screen.findByRole('button', { name: 'Súly · részletek' })
  expect(single).toHaveTextContent('84,2 kg')
  expect(single.textContent).not.toMatch(/[↘↗]/)
})

test('A3: két AZONOS mérés között sincs nyíl — a trend csak akkor hír, ha tényleg változott', async () => {
  weightStore.log = [{ date: '2026-05-21', value: 84.2 }, { date: '2026-05-22', value: 84.2 }]
  renderHub('/nap?dp=reggel')
  const chip = await screen.findByRole('button', { name: 'Súly · részletek' })
  expect(chip).toHaveTextContent('84,2 kg')
  expect(chip.textContent).not.toMatch(/[↘↗]/)
})

test('A4: reggel az első fókusz ott áll a társ blokkjában', async () => {
  renderHub('/nap?dp=reggel')
  await screen.findByText('Jó reggelt.')
  const chips = [...document.querySelectorAll('.nap-titan-ctx .nap-titan-chip')]
  const focus = chips.find((c) => c.textContent?.startsWith('Fókusz'))
  expect(focus).toBeDefined()
  expect(focus).toHaveTextContent('evezés-tempó')
})

test('A5/B4: az étkezés-csempe a keret maradékát és a fehérjét viszi', async () => {
  renderHub()
  const tile = await screen.findByRole('button', { name: 'Étkezés' })
  // 3100 − 1300 = 1800; a count-up miatt az érték a ~600 ms rámpa végén áll be
  await waitFor(() => expect(tile).toHaveTextContent('1800'))
  expect(tile).toHaveTextContent('fehérje 100/220 g')
  expect(tile).toHaveTextContent('Keret · ma')
})

test('B4: nyitott étkezési ablakban a csempe „most"-ot jelez és a logolóba visz', async () => {
  fuelPlanStore.slots = [
    { time: '13:00', kind: 'meal', label: 'Ebéd', slotKey: 'lunch', state: 'now' },
  ]
  renderHub('/nap?dp=nap', <Route path="/fuel/log/uj" element={<div>log-uj-page</div>} />)
  const tile = await screen.findByRole('button', { name: 'Étkezés' })
  expect(tile).toHaveTextContent('Ebéd · most')
  await userEvent.click(tile)
  expect(await screen.findByText('log-uj-page')).toBeInTheDocument()
})

test('A6: este a következő lépés maga a napzárás — egy koppintás a /ritual', async () => {
  renderHub('/nap?dp=este', <Route path="/ritual" element={<div>ritual-page</div>} />)
  await userEvent.click(await screen.findByText('Tegyük le a napot.'))
  expect(await screen.findByText('ritual-page')).toBeInTheDocument()
})

test('A7: az este a nap három statisztikájával zár (kcal · edzés · XP)', async () => {
  renderHub('/nap?dp=este')
  await screen.findByText('Megérkeztél.')
  expect(document.querySelectorAll('.mz-statcell')).toHaveLength(3)
  expect(document.body.textContent).toContain('a mai termés')
})

test('A7: edzésterv nélkül a strip cellája őszinte „—", nem kitalált nulla', async () => {
  workoutStore.type = null
  workoutStore.doneSets = null
  renderHub('/nap?dp=este')
  await screen.findByText('Megérkeztél.')
  const cells = [...document.querySelectorAll('.mz-statcell')]
  expect(cells.some((c) => c.querySelector('b')?.textContent === '—')).toBe(true)
})

test('A7: futó gamifikációs lekérés alatt az XP cella „—", nem egy kitalált +0', async () => {
  gamStore.pending = true
  gamStore.xpTotal = 0 // a lekérés `realEmpty`-je pontosan ez — ebből nem jöhet ki „+0"
  renderHub('/nap?dp=este')
  await screen.findByText('Megérkeztél.')
  const xpCell = [...document.querySelectorAll('.mz-statcell')]
    .find((c) => c.textContent?.includes('a mai termés'))
  expect(xpCell).toBeDefined()
  expect(xpCell!.querySelector('b')?.textContent).toBe('—')
  expect(xpCell!.textContent).not.toContain('+0')
})

test('A7: feloldott lekérésnél az XP cella a nap tényleges termését mondja', async () => {
  renderHub('/nap?dp=este')
  await screen.findByText('Megérkeztél.')
  const xpCell = [...document.querySelectorAll('.mz-statcell')]
    .find((c) => c.textContent?.includes('a mai termés'))!
  // a count-up rámpája miatt a végérték a ~600 ms-os ramp végén áll be
  await waitFor(() => expect(xpCell.querySelector('b')?.textContent).toBe('+210'))
})

// ── B. the six tiles ────────────────────────────────────────────────────────

test('B1: a víz „+" gombja 2,5 dl-t logol, és megjelenik a visszavonás — a visszavonás vissza is állítja', async () => {
  renderHub()
  const tile = await screen.findByRole('button', { name: 'Hidratáció · részletek' })
  expect(tile).toHaveTextContent('1,85')
  expect(within(tile).queryByRole('button', { name: 'Utolsó pohár visszavonása' })).toBeNull()

  await userEvent.click(within(tile).getByRole('button', { name: 'Víz +2,5 dl' }))
  expect(tile).toHaveTextContent('2,1')
  const undo = within(tile).getByRole('button', { name: 'Utolsó pohár visszavonása' })

  await userEvent.click(undo)
  expect(tile).toHaveTextContent('1,85')
  expect(within(tile).queryByRole('button', { name: 'Utolsó pohár visszavonása' })).toBeNull()
})

test('B1: a víz-csempe egésze a részletekbe visz (billentyűvel is)', async () => {
  renderHub('/nap?dp=nap', <Route path="/fuel" element={<div>fuel-page</div>} />)
  const tile = await screen.findByRole('button', { name: 'Hidratáció · részletek' })
  tile.focus()
  await userEvent.keyboard('{Enter}')
  expect(await screen.findByText('fuel-page')).toBeInTheDocument()
})

test('B2: a csempe pipája UGYANAZT a jutalom-payloadot küldi, mint a Rutin oldal', async () => {
  const { buildHabitRewardToast } = await import('@/features/progression/logic/rewardToast')
  renderHub('/nap?dp=reggel')
  const tile = await screen.findByRole('button', { name: 'Reggeli rutin' })
  await userEvent.click(within(tile).getByRole('button', { name: 'Kipipálás — Reggeli videó' }))
  await waitFor(() => expect(emitSpy).toHaveBeenCalled())
  expect(emitSpy).toHaveBeenCalledWith(buildHabitRewardToast({
    title: 'Reggeli videó',
    chainDone: 1,
    chainTotal: 4,
    xp: 5,
    levelUp: undefined,
    celebration: 'ez a rutin első lépése',
    chainLabel: null,
  }))
})

test('B2: pipa után a csempe a horgonyra kötött szemre vált („Most jön"), nem a sorrendire', async () => {
  renderHub('/nap?dp=reggel')
  const tile = await screen.findByRole('button', { name: 'Reggeli rutin' })
  await userEvent.click(within(tile).getByRole('button', { name: 'Kipipálás — Reggeli videó' }))
  expect(await screen.findByText('Reggeli napló')).toBeInTheDocument()
  expect(screen.getByText('Most jön')).toBeInTheDocument()
  expect(screen.queryByText('50 fekvőtámasz')).toBeNull()
})

test('B2: DERIVED szokás soha nem kap pipa-gombot (ADR 0010)', async () => {
  renderHub('/nap?dp=este')
  const tile = await screen.findByRole('button', { name: 'Esti rutin' })
  expect(tile).toHaveTextContent('Időben ágyban')
  expect(within(tile).queryByRole('button', { name: /Kipipálás/ })).toBeNull()
})

test('B3: edzésterv nélkül is ott a csempe, őszintén üresen', async () => {
  workoutStore.type = null
  workoutStore.doneSets = null
  renderHub()
  const tile = await screen.findByRole('button', { name: 'Edzés' })
  expect(tile).toHaveTextContent('Pihenő')
  expect(tile).toHaveTextContent('Ma nincs betervezve')
})

test('B5: a napló-csempe a mai bejegyzések számát mutatja', async () => {
  renderHub('/nap?dp=nap', <Route path="/me/naplo" element={<div>naplo-page</div>} />)
  const tile = await screen.findByRole('button', { name: 'Napló' })
  expect(tile).toHaveTextContent('2')
  expect(tile).toHaveTextContent('bejegyzés ma')
  await userEvent.click(tile)
  expect(await screen.findByText('naplo-page')).toBeInTheDocument()
})

test('B5: futó lekérés alatt „—" áll a napló-csempén, nem egy kitalált nulla', async () => {
  journalStore.pending = true
  journalStore.notes = []
  renderHub()
  const tile = await screen.findByRole('button', { name: 'Napló' })
  expect(tile).toHaveTextContent('—')
  expect(tile).not.toHaveTextContent('0')
})

// ── C. what left the landing ────────────────────────────────────────────────

test('C1: a küldetés-felület lekerült a nyitóoldalról (a route maga él tovább)', async () => {
  renderHub()
  await screen.findByText('Jó itt folytatni.')
  expect(screen.queryByText(/Küldetés/i)).toBeNull()
  expect(screen.queryByRole('button', { name: 'Napi küldetések' })).toBeNull()
})

test('C2: a check-in csempe eltűnt — a felület a gyors-felvevőé és a létráé', async () => {
  renderHub()
  await screen.findByText('Jó itt folytatni.')
  expect(screen.queryByRole('button', { name: 'Check-in' })).toBeNull()
})

test('C3: a kreed a társ blokkjában áll, és koppintásra nyílik a fókusz-sheet', async () => {
  renderHub()
  const creed = await screen.findByRole('button', { name: 'Kreed és fókuszok' })
  expect(creed).toHaveTextContent('A rendszer véd')
  expect(creed).toHaveTextContent('1 fókusz')
  await userEvent.click(creed)
  expect(await screen.findByText('Mi ma a fókuszod?')).toBeInTheDocument()
})

test('C4: a társ maga az Életjelek ajtaja', async () => {
  renderHub('/nap?dp=nap', <Route path="/nap/eletjel" element={<div>eletjel-page</div>} />)
  await userEvent.click(await screen.findByRole('button', { name: 'Életjelek' }))
  expect(await screen.findByText('eletjel-page')).toBeInTheDocument()
})

test('C5/C6: a stack- és a cél-csempe sincs többé a mozaikban', async () => {
  renderHub()
  await screen.findByText('Jó itt folytatni.')
  expect(screen.queryByRole('button', { name: 'Stack' })).toBeNull()
  expect(screen.queryByRole('button', { name: /Célok · ma/ })).toBeNull()
})

/** A cél NEM tűnt el a nyitóoldalról, csak a csempéjét váltotta a létra egy foka. Ez a fok a
 *  létra 7. rungja: minden korábbi feltétel (check-in, víz, edzés) kielégítve. */
function seedGoalRung() {
  waterStore.water = 3000 // a 4 literes cél 60%-a fölött → a víz-fok nem üt be
  workoutStore.type = null // nincs terv → az edzés-fok sem
}

test('C6: cél esetén a következő lépés a cél foka lesz, a cél címével', async () => {
  seedGoalRung()
  lifeGoalStore.goals = [{ id: 'g1', title: '10 km futás év végéig' }]
  renderHub('/nap?dp=nap', <Route path="/me/goals" element={<div>goals-page</div>} />)
  expect(await screen.findByText('Egy lépés a célod felé.')).toBeInTheDocument()
  expect(screen.getByText('10 km futás év végéig')).toBeInTheDocument()
  await userEvent.click(screen.getByText('Egy lépés a célod felé.'))
  expect(await screen.findByText('goals-page')).toBeInTheDocument()
})

test('C6: még fel nem oldott cél-lekérésből nem találunk ki lépést — marad a napló-fok', async () => {
  seedGoalRung()
  lifeGoalStore.pending = true
  lifeGoalStore.goals = [] // a futó lekérés üres listája megkülönböztethetetlen a „nincs célod"-tól
  renderHub()
  expect(await screen.findByText('Egy gondolatnyi hely.')).toBeInTheDocument()
  expect(screen.queryByText('Egy lépés a célod felé.')).toBeNull()
})

test('C7: az Éjszakai mód csempe csak a levezető ablakban jelenik meg', async () => {
  clock.now = new Date('2026-05-22T22:10:00')
  renderHub('/nap?dp=este', <Route path="/me/sleep/night" element={<div>night-page</div>} />)
  await userEvent.click(await screen.findByRole('button', { name: 'Éjszakai mód' }))
  expect(await screen.findByText('night-page')).toBeInTheDocument()
})

test('C7: délután nincs Éjszakai mód ajtó — időzített, nem állandó csempe', async () => {
  clock.now = new Date('2026-05-22T14:00:00')
  renderHub('/nap?dp=este')
  await screen.findByText('Megérkeztél.')
  expect(screen.queryByRole('button', { name: 'Éjszakai mód' })).toBeNull()
})

// ── D. shell, modes, motion ─────────────────────────────────────────────────

test('D1: ?day=rough a csendes horgony-felületet adja, mozaik nélkül', async () => {
  renderHub('/nap?day=rough')
  expect(await screen.findByText('Horgony mód · csendben')).toBeInTheDocument()
  expect(screen.getAllByRole('button', { name: /Megvolt —/ })).toHaveLength(3)
  expect(screen.getByRole('button', { name: 'Kilépés a horgony módból' })).toBeInTheDocument()
  // a hat csempe és a következő lépés is elmarad — a nehéz nap nem kér feladatokat
  expect(tileOrder()).not.toContain('nap-t-viz')
  expect(screen.queryByText('Most egy kis lépés')).toBeNull()
})

test('D4: prefers-reduced-motion mellett a szám azonnal a helyén áll (nincs beúszó animáció)', async () => {
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
    matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }))
  renderHub()
  // count-up nélkül a keret-maradék az ELSŐ frame-en a végérték (animálva 0-ról indulna)
  const tile = screen.getByRole('button', { name: 'Étkezés' })
  expect(tile).toHaveTextContent('1800')
})

test('D5: a kalauz horgonya megvan a normál ÉS a horgony-módú renderen is', async () => {
  const normal = renderHub()
  await screen.findByText('Jó itt folytatni.')
  expect(document.querySelector('[data-kalauz-anchor="nap-hero"]')).not.toBeNull()
  normal.unmount()

  renderHub('/nap?day=rough')
  await screen.findByText('Horgony mód · csendben')
  expect(document.querySelector('[data-kalauz-anchor="nap-hero"]')).not.toBeNull()
})

test('D6: a társ blokkjából egy koppintás a Mezo-beszélgetés', async () => {
  renderHub('/nap?dp=nap', <Route path="/nap/uzenetek" element={<div>uzenetek-page</div>} />)
  await userEvent.click(await screen.findByRole('button', { name: /Beszéljük át a napod/ }))
  expect(await screen.findByText('uzenetek-page')).toBeInTheDocument()
})
