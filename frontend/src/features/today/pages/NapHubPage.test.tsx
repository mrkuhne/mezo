import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { NapHubPage } from '@/features/today/pages/NapHubPage'
import { LevelUpProvider } from '@/features/progression/LevelUpProvider'
import { ToastProvider } from '@/shared/ui/ToastProvider'
import { QueryWrapper } from '@/test/queryWrapper'

// Mode-agnostic data stubs for the hero/water assertions — real-mode MSW fixtures differ
// from the mock seeds (same pattern as QuickInputSheet.test). The water pair shares a
// setter through a ref so the in-place log re-renders the counter.
// Several hooks read useFuelDay (the page AND the needs sim) — a per-instance useState
// stub would let logWater update the wrong instance, so the stub is one shared store.
const waterStore = vi.hoisted(() => {
  const listeners = new Set<() => void>()
  return {
    water: 1850,
    subscribe: (l: () => void) => { listeners.add(l); return () => listeners.delete(l) },
    add(ml: number) { this.water += ml; listeners.forEach((l) => l()) },
    reset() { this.water = 1850; listeners.forEach((l) => l()) },
  }
})
// The 1:1-audit assertions below (quest dots, the Rutin tile's name/count/tick, the Kreed
// more-line, the weight+focus hero row) are all DATA-shaped, and the real-mode MSW fixtures
// carry none of them — so quests / habits / intention / weight get the same mode-agnostic
// stub treatment the sleep+water pair already had. The habit store is mutable so the tile's
// in-place tick has something real to move (mezo-d20.11).
const habitStore = vi.hoisted(() => {
  const listeners = new Set<() => void>()
  const seed = () => [
    { key: 'morning_sunlight', chain: 'MORNING', position: 1, title: 'Napfény · 10 perc', why: '', anchorCopy: 'ébredés után', mode: 'MANUAL', status: 'done', xp: 10, strengthPct: 76, linkUrl: null },
    { key: 'morning_video', chain: 'MORNING', position: 2, title: 'Reggeli videó', why: '', anchorCopy: 'kávé mellé', mode: 'MANUAL', status: 'pending', xp: 5, strengthPct: 54, linkUrl: 'https://example.com/v' },
    { key: 'morning_pushups', chain: 'MORNING', position: 3, title: '50 fekvőtámasz', why: '', anchorCopy: 'videó után', mode: 'MANUAL', status: 'pending', xp: 10, strengthPct: 88, linkUrl: null },
    { key: 'bed_on_time', chain: 'EVENING', position: 1, title: 'Időben ágyban', why: '', anchorCopy: '', mode: 'MANUAL', status: 'pending', xp: 10, strengthPct: 71, linkUrl: null },
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
const CATALOG = {
  chains: [
    {
      id: 'c-m', chainKey: 'MORNING', title: 'Reggeli rutin', daypart: 'MORNING', position: 0, isActive: true,
      defs: [{ habitKey: 'morning_video', framework: null, celebration: 'ez a rutin első lépése' }],
    },
    { id: 'c-e', chainKey: 'EVENING', title: 'Esti rutin', daypart: 'EVENING', position: 1, isActive: true, defs: [] },
  ],
  habits: [],
}
const QUESTS = [
  { id: 'q1', questDate: '2026-05-22', slot: 'BODY', skillKey: 'mindset', title: 'Zárd 18 szett felett a Pull A-t', why: '', targetLabel: '', metric: 'gym_session_done', xp: 25, status: 'completed', completionMode: 'DERIVED' },
  { id: 'q2', questDate: '2026-05-22', slot: 'FUELBIO', skillKey: 'cooking', title: 'Érd el a 180 g fehérjét', why: '', targetLabel: '', metric: 'protein_g', xp: 20, status: 'offered', completionMode: 'DERIVED' },
  { id: 'q3', questDate: '2026-05-22', slot: 'GROWTH', skillKey: 'learning', title: 'Írj egy sort a naplóba', why: '', targetLabel: '', metric: 'journal_entry', xp: 15, status: 'offered', completionMode: 'DERIVED' },
]
vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  const { useSyncExternalStore } = await import('react')
  return {
    ...actual,
    useSleep: () => ({
      sleepLog: [],
      lastNight: { date: '2026-05-22', bedtime: '00:42', wakeup: '09:03', duration: 7.5, quality: 9, awakenings: 1, mealToSleep: 125, notes: null },
      logSleep: vi.fn(),
    }),
    useFuelDay: () => {
      const water = useSyncExternalStore(waterStore.subscribe, () => waterStore.water)
      return { fuel: { targets: { kcal: 3100, p: 220, c: 380, f: 95, water: 4000 }, consumed: { kcal: 1300, p: 100, c: 152, f: 30, water }, meals: [], pacing: { msg: '' }, micronutrients: [], supplements: [] } }
    },
    useWaterActions: () => ({ logWater: (ml: number) => waterStore.add(ml) }),
    useDailyQuests: () => ({ quests: QUESTS, rerollsLeft: 1 }),
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
      weightLog: [{ date: '2026-05-21', value: 84.6 }, { date: '2026-05-22', value: 84.2 }],
      weightTrends: { last7d: { avg: 84.4, weeklyRate: -0.3 }, last4w: { weeklyRate: -0.25 } },
      logWeight: vi.fn(),
    }),
  }
})

// Pin the wall clock: dayFace(tick) decides which face counts as "now", and setFace
// DELETES ?dp when the clicked face IS the now-face — on a CI runner whose clock lands
// in the este band, the dp=este assertion below would flip vacuously (this exact flake
// failed CI run 33144018103). 13:42 → nowFace 'nap', deterministic everywhere.
const clock = vi.hoisted(() => ({ now: new Date('2026-05-22T13:42:00') }))
vi.mock('@/features/today/logic/useMinuteTick', () => ({
  useMinuteTick: () => clock.now,
}))

beforeEach(() => { waterStore.reset(); habitStore.reset(); clock.now = new Date('2026-05-22T13:42:00') })

// Nap hub (mezo-d20.2.1) — the day spine's Mozaik face: one hero per daypart panel
// (the panel picked from `?dp=`; the header itself moved to the shell, mezo-atry), then
// the 2-column mosaic. Detail pages are F1.2–F1.6; until they land the tiles open the
// existing sheets.

function LocationProbe() {
  return <div data-testid="loc">{useLocation().pathname + useLocation().search}</div>
}

function renderHub(path = '/nap?dp=nap') {
  return render(
    <QueryWrapper>
      <ToastProvider>
        <LevelUpProvider>
          <MemoryRouter initialEntries={[path]}>
            <Routes><Route path="/nap" element={<><NapHubPage /><LocationProbe /></>} /></Routes>
          </MemoryRouter>
        </LevelUpProvider>
      </ToastProvider>
    </QueryWrapper>,
  )
}

test('a panel a ?dp paraméterből következik — a váltó maga a shell fejlécében él (mezo-atry)', async () => {
  renderHub('/nap?dp=este')
  expect(await screen.findByText('Villanyoltásig')).toBeInTheDocument()
  // A napszakváltó gomb NEM az oldalé többé.
  expect(screen.queryByRole('button', { name: 'Napszak váltása' })).toBeNull()
})

test('the Nap panel hero is the keret: remaining kcal + day-bar', async () => {
  renderHub('/nap?dp=nap')
  expect(await screen.findByText(/kcal maradt/)).toBeInTheDocument()
  expect(document.querySelector('.daybar')).not.toBeNull()
})

test('the Reggel panel hero is the night summary with the h:mm duration', async () => {
  renderHub('/nap?dp=reggel')
  expect(await screen.findByText('Éjszakád')).toBeInTheDocument()
  // seed lastNight: duration 7.5 HOURS → 7:30 (a minutes-fed formatter would show 0:07).
  // The prototype count-ups this hero (`data-kind="time"`), so the final value only lands
  // after the ~600 ms ramp — findByText polls, getByText would read the 0:00 first frame.
  expect(await screen.findByText('7:30')).toBeInTheDocument()
})

test('the Este panel offers the Napzárás CTA which navigates to /ritual', async () => {
  render(
    <QueryWrapper>
      <ToastProvider>
        <LevelUpProvider>
          <MemoryRouter initialEntries={['/nap?dp=este']}>
            <Routes>
              <Route path="/nap" element={<NapHubPage />} />
              <Route path="/ritual" element={<div>ritual-page</div>} />
            </Routes>
          </MemoryRouter>
        </LevelUpProvider>
      </ToastProvider>
    </QueryWrapper>,
  )
  await userEvent.click(await screen.findByRole('button', { name: 'Zárjuk le a napot' }))
  expect(await screen.findByText('ritual-page')).toBeInTheDocument()
})

test('the mosaic tiles render with clay spots — Küldetések, Check-in, Életjel', async () => {
  renderHub('/nap?dp=nap')
  expect(await screen.findByRole('button', { name: 'Napi küldetések' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Check-in' })).toBeInTheDocument()
  expect(document.querySelector('.nap-bigring')).not.toBeNull()
})

test('the water tile logs +2,5 dl in place and the counter moves', async () => {
  renderHub('/nap?dp=nap')
  const tile = await screen.findByRole('button', { name: /Víz/ })
  expect(tile).toHaveTextContent('1,85')
  await userEvent.click(tile)
  expect(tile).toHaveTextContent('2,1')
})

// ── 1:1 fidelity audit (mezo-d20.11) — the prototype's tile internals ────────────

test('the Küldetés tile shows ONE big dot per quest + the XP pot — the count is never repeated as text', async () => {
  renderHub('/nap?dp=nap')
  const tile = await screen.findByRole('button', { name: 'Napi küldetések' })
  expect(tile.querySelector('use[href="#s-hajtas"]')).not.toBeNull() // spot, not i-lang
  const dots = tile.querySelectorAll('.nap-bigdots .hd')
  expect(dots.length).toBeGreaterThan(0)
  expect(tile.querySelector('.nap-qxp')).not.toBeNull()
  expect(tile.textContent).not.toMatch(/\d\/\d/)
})

test("the Rutin tile carries the next habit's OWN clay icon, its name and an in-place tick", async () => {
  renderHub('/nap?dp=reggel')
  const tile = await screen.findByRole('button', { name: 'Reggeli rutin' })
  expect(tile.querySelector('use[href="#i-rend"]')).toBeNull() // the fixed icon is gone
  expect(tile.querySelector('.nap-habname')?.textContent).toBeTruthy()
  expect(tile.querySelector('.nap-habcount')?.textContent).toMatch(/^\d+\/\d+$/)
  expect(within(tile).getByRole('button', { name: /Kipipálás/ })).toBeInTheDocument()
})

test('the Rutin tile tick completes the next habit in place (the capability the redesign dropped)', async () => {
  renderHub('/nap?dp=reggel')
  const tile = await screen.findByRole('button', { name: 'Reggeli rutin' })
  const before = tile.querySelector('.nap-habcount')!.textContent!
  await userEvent.click(within(tile).getByRole('button', { name: /Kipipálás/ }))
  const after = await screen.findByRole('button', { name: 'Reggeli rutin' })
  await waitFor(() => expect(after.querySelector('.nap-habcount')!.textContent).not.toBe(before))
})

// ── logging as reward (mezo-3zue.5) — the hub tile's OWN tick must replay the same
// celebration as /nap/rutin's tick, not a plain reward toast (finding 1, whole-branch review).
test('the hub tile tick also replays the habit its own celebration sentence', async () => {
  renderHub('/nap?dp=reggel')
  const tile = await screen.findByRole('button', { name: 'Reggeli rutin' })
  await userEvent.click(within(tile).getByRole('button', { name: /Kipipálás/ }))
  expect(await screen.findByText('ez a rutin első lépése')).toBeInTheDocument()
})

test('the Kreed tile has NO icon and carries the fókusz more-line', async () => {
  renderHub('/nap?dp=reggel')
  const tile = await screen.findByRole('button', { name: 'Kreed' })
  expect(tile.querySelector('.mz-spotwrap')).toBeNull()
  expect(tile.querySelector('.nap-kreedq')).not.toBeNull()
  expect(tile.textContent).toMatch(/fókusz ›/)
})

test('the reggel hero keeps Súly and Fókusz on ONE row', async () => {
  renderHub('/nap?dp=reggel')
  await screen.findByText('Éjszakád')
  const sub = document.querySelector('.nap-hero-sub')!
  expect(sub.children.length).toBeGreaterThan(0)
  expect(sub.textContent).toMatch(/^Súly/)
})

test('the day-bar segments animate in — no inline transform kills the .mz-play fill', async () => {
  renderHub('/nap?dp=nap')
  await screen.findByText(/kcal maradt/)
  const seg = document.querySelector('.daybar i') as HTMLElement
  expect(seg.style.transform).toBe('') // the CSS owns the scaleX, the element only the --d
  expect(seg.style.getPropertyValue('--d')).toMatch(/ms$/)
})

test('the water tile carries the filling bar, not a text line', async () => {
  renderHub('/nap?dp=nap')
  const tile = await screen.findByRole('button', { name: /Víz/ })
  const bar = tile.querySelector('.nap-waterfill div') as HTMLElement
  expect(bar).not.toBeNull()
  expect(Number(bar.style.getPropertyValue('--w'))).toBeGreaterThan(0)
})

test('the este panel closes on the day stat strip (kcal · edzés · XP)', async () => {
  renderHub('/nap?dp=este')
  await screen.findByText('Villanyoltásig')
  const cells = document.querySelectorAll('.mz-statcell')
  expect(cells).toHaveLength(3)
  expect(document.body.textContent).toContain('a mai termés')
})

test('?day=rough renders the horgony melt instead of the daypart panels (regression: it rendered nothing)', async () => {
  renderHub('/nap?day=rough')
  expect(await screen.findByText('Horgony mód · csendben')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Kilépés a horgony módból' })).toBeInTheDocument()
  expect(screen.getAllByRole('button', { name: /Megvolt —/ })).toHaveLength(3)
  expect(screen.queryByText(/kcal maradt/)).toBeNull()
})

test('a horgony row ticks in place', async () => {
  renderHub('/nap?day=rough')
  const btn = (await screen.findAllByRole('button', { name: /Megvolt —/ }))[0]
  expect(btn.querySelector('.nap-htick.f')).toBeNull()
  await userEvent.click(btn)
  expect(btn.querySelector('.nap-htick.f')).not.toBeNull()
})

// ── Éjszakai mód: the Nap-side door restored (mezo-d20.11) ──────────────────
// It died with `IslandEvening` when the Today view layer went. The Alvás page's row
// survived, but that row was designed as the TWIN of a timed evening entry, not its
// replacement — so the entry is timed here too, not a permanent tile.
function renderEste() {
  return render(
    <QueryWrapper>
      <ToastProvider>
        <LevelUpProvider>
          <MemoryRouter initialEntries={['/nap?dp=este']}>
            <Routes>
              <Route path="/nap" element={<NapHubPage />} />
              <Route path="/me/sleep/night" element={<div>night-page</div>} />
            </Routes>
          </MemoryRouter>
        </LevelUpProvider>
      </ToastProvider>
    </QueryWrapper>,
  )
}

test('the Éjszakai mód tile appears inside the wind-down window and opens the night surface', async () => {
  clock.now = new Date('2026-05-22T22:10:00')
  renderEste()
  await userEvent.click(await screen.findByRole('button', { name: 'Éjszakai mód' }))
  expect(await screen.findByText('night-page')).toBeInTheDocument()
})

test('the Éjszakai mód tile stays away earlier in the evening — a timed door, not a permanent tile', async () => {
  clock.now = new Date('2026-05-22T19:00:00')
  renderEste()
  await screen.findByRole('button', { name: 'Zárjuk le a napot' })
  expect(screen.queryByRole('button', { name: 'Éjszakai mód' })).toBeNull()
})

// mezo-atry: az Üzenetek a mozaikból a shell fejlécébe költözött — háromszori csempe-
// ismétlés helyett egy karika. A csempének mind a három napszakon el kell tűnnie.
test.each(['reggel', 'nap', 'este'])('a(z) %s panel mozaikjában nincs Mezo-üzenetek csempe', async (dp) => {
  renderHub(`/nap?dp=${dp}`)
  // Egy napszak-független horgony, hogy a panel biztosan felépüljön.
  expect(await screen.findByRole('button', { name: 'Napi küldetések' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Mezo üzenetei/ })).toBeNull()
  expect(document.querySelector('.nap-unread')).toBeNull()
})

test('a nap-panel mozaikja viszi a Célok · ma csempét (mezo-iizd.9)', async () => {
  renderHub('/nap?dp=nap')
  expect(await screen.findByRole('button', { name: /Célok · ma/ })).toBeInTheDocument()
})
