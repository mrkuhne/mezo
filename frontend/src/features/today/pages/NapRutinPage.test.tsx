import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { NapRutinPage } from '@/features/today/pages/NapRutinPage'
import { NapHubPage } from '@/features/today/pages/NapHubPage'
import { LevelUpProvider } from '@/features/progression/LevelUpProvider'
import { ToastProvider } from '@/shared/ui/ToastProvider'
import { QueryWrapper } from '@/test/queryWrapper'
import type { HabitItem } from '@/data/types'

// Rutin page (mezo-d20.2.3) — the hub's habit tile → own full page (prototype page-hab):
// p-gold tone, hero = selected chain-group spot + done/total + name, stat strip
// (perfect days · lánc-erő · XP ma), habrow list with tick buttons, honest anchorCopy
// lines, quiet principle line. ?dp=reggel|este preselects the group shown first.

// Mode-agnostic data stubs — mock seeds and real-mode MSW fixtures differ, so the habit
// hooks are stubbed with a controlled day (QuickInputSheet.test pattern). One shared
// store so the tick's optimistic re-render reaches every hook instance.
const habitStore = vi.hoisted(() => {
  const listeners = new Set<() => void>()
  let habits: unknown[] = []
  return {
    checked: [] as string[],
    unchecked: [] as string[],
    seed(h: unknown[]) { habits = h; this.checked = []; this.unchecked = []; listeners.forEach((l) => l()) },
    subscribe(l: () => void) { listeners.add(l); return () => listeners.delete(l) },
    snapshot: () => habits,
    setStatus(key: string, status: string) {
      habits = (habits as { key: string }[]).map((h) => (h.key === key ? { ...h, status } : h))
      listeners.forEach((l) => l())
    },
  }
})

vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  const { useSyncExternalStore } = await import('react')
  return {
    ...actual,
    useHabitDay: () => ({
      habits: useSyncExternalStore(habitStore.subscribe, habitStore.snapshot),
      levelUps: [],
      mode: 'mock' as const,
    }),
    useHabitCatalog: () => ({
      catalog: {
        chains: [
          { id: 'c-m', chainKey: 'MORNING', title: 'Reggeli rutin', daypart: 'MORNING', position: 1, isActive: true, defs: [] },
          { id: 'c-e', chainKey: 'EVENING', title: 'Esti rutin', daypart: 'EVENING', position: 2, isActive: true, defs: [] },
        ],
      },
      isPending: false, isError: false, refetch: vi.fn(),
    }),
    useHabitActions: () => ({
      check: (k: string) => { habitStore.checked.push(k); habitStore.setStatus(k, 'done'); return Promise.resolve(undefined) },
      uncheck: (k: string) => { habitStore.unchecked.push(k); habitStore.setStatus(k, 'pending'); return Promise.resolve(undefined) },
      pending: false,
      consumeLevelUps: vi.fn(),
    }),
    useHabitSummary: () => ({
      data: { perfectMorningDays30: 6, perfectEveningDays30: 4, habits: [] },
      isPending: false, isError: false, refetch: vi.fn(),
    }),
  }
})

const morningHabits: Partial<HabitItem>[] = [
  { key: 'wake_on_time', chain: 'MORNING', position: 1, title: 'Ébredés időben', why: '', anchorCopy: 'a lánc kezdete', mode: 'DERIVED', status: 'done', xp: 10, strengthPct: 82 },
  { key: 'morning_sunlight', chain: 'MORNING', position: 2, title: 'Reggeli napfény', why: '', anchorCopy: 'ébredés után', mode: 'MANUAL', status: 'done', xp: 5, strengthPct: 64 },
  { key: 'morning_pushups', chain: 'MORNING', position: 3, title: '50 fekvőtámasz', why: '', anchorCopy: 'napfény után', mode: 'MANUAL', status: 'pending', xp: 10, strengthPct: 48 },
  { key: 'morning_weigh_in', chain: 'MORNING', position: 4, title: 'Reggeli súlymérés', why: '', anchorCopy: 'fogmosás után', mode: 'DERIVED', status: 'pending', xp: 10, strengthPct: 93 },
]
const eveningHabits: Partial<HabitItem>[] = [
  { key: 'kitchen_close', chain: 'EVENING', position: 1, title: 'Konyha zárva', why: '', anchorCopy: 'vacsora után', mode: 'MANUAL', status: 'pending', xp: 10, strengthPct: 68 },
  { key: 'bed_on_time', chain: 'EVENING', position: 2, title: 'Ágyban időben', why: '', anchorCopy: 'napzárás után', mode: 'DERIVED', status: 'pending', xp: 10, strengthPct: null },
]

beforeEach(() => habitStore.seed([...morningHabits, ...eveningHabits]))

function LocationProbe() {
  const loc = useLocation()
  return <div data-testid="loc">{loc.pathname + loc.search}</div>
}

function renderPage(path = '/nap/rutin?dp=reggel') {
  return render(
    <QueryWrapper>
      <ToastProvider>
        <LevelUpProvider>
          <MemoryRouter initialEntries={['/nap', path]} initialIndex={1}>
            <Routes>
              <Route path="/nap" element={<div data-testid="hub-stub" />} />
              <Route path="/nap/rutin" element={<><NapRutinPage /><LocationProbe /></>} />
              <Route path="*" element={<LocationProbe />} />
            </Routes>
          </MemoryRouter>
        </LevelUpProvider>
      </ToastProvider>
    </QueryWrapper>,
  )
}

test('gold page anatomy: back chip, hero with spot + done/total + chain name, principle line', async () => {
  renderPage()
  expect(await screen.findByRole('button', { name: 'Vissza' })).toBeInTheDocument()
  expect(document.querySelector('.mz-page.mz-p-gold')).not.toBeNull()
  // morning group: 2 of 4 done
  expect(screen.getByText('2/4')).toBeInTheDocument()
  expect(screen.getByText('Reggeli rutin')).toBeInTheDocument()
  expect(screen.getByText('4 elem · lánc')).toBeInTheDocument()
  expect(document.querySelector('.mz-page-hero use[href="#s-reggel"]')).not.toBeNull()
  expect(screen.getByText('A lánc-erő az elmúlt 28 nap konzisztenciája — egy kihagyás nem nullázza, csak halványítja.')).toBeInTheDocument()
})

test('the stat strip carries perfect days, chain strength and today XP for the shown group', async () => {
  renderPage()
  expect(await screen.findByText('6/30')).toBeInTheDocument()
  expect(screen.getByText('tökéletes reggel')).toBeInTheDocument()
  // mean of 82/64/48/93 → 72%
  expect(screen.getByText('72%')).toBeInTheDocument()
  expect(screen.getByText('lánc-erő · 28 nap')).toBeInTheDocument()
  // done rows: 10 + 5 XP
  expect(screen.getByText('+15')).toBeInTheDocument()
  expect(screen.getByText('XP ma')).toBeInTheDocument()
})

test('?dp=este shows the evening group first (hero) with the morning group below', async () => {
  renderPage('/nap/rutin?dp=este')
  expect(await screen.findByText('Esti rutin')).toBeInTheDocument()
  expect(screen.getByText('0/2')).toBeInTheDocument()
  expect(screen.getByText('2 elem · lánc')).toBeInTheDocument()
  expect(document.querySelector('.mz-page-hero use[href="#s-este"]')).not.toBeNull()
  expect(screen.getByText('tökéletes este')).toBeInTheDocument()
  // the other group is still listed below
  expect(screen.getByText('Reggeli rutin')).toBeInTheDocument()
  expect(screen.getByText('Ébredés időben')).toBeInTheDocument()
})

test('rows render honest anchorCopy lines and strength bars only where strength exists', async () => {
  renderPage()
  expect(await screen.findByText('a lánc kezdete')).toBeInTheDocument()
  expect(screen.getByText('ébredés után')).toBeInTheDocument()
  expect(screen.getByText('93%')).toBeInTheDocument()
  // bed_on_time (evening, strengthPct null) renders NO percent and NO bar
  const bedRow = screen.getByText('Ágyban időben').closest('.nr-row')!
  expect(within(bedRow as HTMLElement).queryByText(/%$/)).toBeNull()
  expect((bedRow as HTMLElement).querySelector('.nr-str')).toBeNull()
})

test('a pending MANUAL row ticks through the habit check write', async () => {
  renderPage()
  await userEvent.click(await screen.findByRole('button', { name: '50 fekvőtámasz' }))
  expect(habitStore.checked).toEqual(['morning_pushups'])
  // the row settles done: filled tick (the reward toast repeats the title, so scope to the row)
  const row = screen.getAllByText('50 fekvőtámasz')
    .map((e) => e.closest('.nr-row'))
    .find((r): r is HTMLElement => r !== null)!
  expect((row as HTMLElement).querySelector('.nr-tick.f')).not.toBeNull()
})

test('a done MANUAL row unticks (the prototype tick toggles both ways)', async () => {
  renderPage()
  await userEvent.click(await screen.findByRole('button', { name: 'Reggeli napfény' }))
  expect(habitStore.unchecked).toEqual(['morning_sunlight'])
  expect(habitStore.checked).toEqual([])
})

test('ADR 0010: a pending DERIVED row never self-completes — its tick opens the log surface', async () => {
  renderPage()
  await userEvent.click(await screen.findByRole('button', { name: 'Reggeli súlymérés' }))
  expect(habitStore.checked).toEqual([])
  expect(screen.getByTestId('loc')).toHaveTextContent('/me/weight')
})

test('a DERIVED row with no surface of its own is not interactive (honest hint, no dead button)', async () => {
  renderPage('/nap/rutin?dp=este')
  await screen.findByText('Ágyban időben')
  // bed_on_time is decided by tomorrow's sleep log → explainer line, no tick button
  expect(screen.queryByRole('button', { name: 'Ágyban időben' })).toBeNull()
  expect(screen.getByText('holnap reggel, az alvásnaplódból derül ki')).toBeInTheDocument()
})

test('a done DERIVED row stays settled — no uncheck from this page', async () => {
  renderPage()
  await screen.findByText('Ébredés időben')
  expect(screen.queryByRole('button', { name: 'Ébredés időben' })).toBeNull()
  expect(habitStore.unchecked).toEqual([])
})

test('the back chip navigates back', async () => {
  renderPage()
  await userEvent.click(await screen.findByRole('button', { name: 'Vissza' }))
  expect(screen.getByTestId('hub-stub')).toBeInTheDocument()
})

test("the hub's Rutin tile navigates to /nap/rutin?dp=<face> instead of quick-ticking", async () => {
  render(
    <QueryWrapper>
      <ToastProvider>
        <LevelUpProvider>
          <MemoryRouter initialEntries={['/nap?dp=reggel']}>
            <Routes>
              <Route path="/nap" element={<NapHubPage />} />
              <Route path="/nap/rutin" element={<LocationProbe />} />
            </Routes>
          </MemoryRouter>
        </LevelUpProvider>
      </ToastProvider>
    </QueryWrapper>,
  )
  await userEvent.click(await screen.findByRole('button', { name: 'Reggeli rutin' }))
  expect(screen.getByTestId('loc')).toHaveTextContent('/nap/rutin?dp=reggel')
  expect(habitStore.checked).toEqual([])
})

// ── 1:1 fidelity audit (mezo-d20.11) ────────────────────────────────────────────

test('every habrow carries the habit OWN clay icon (prototype #page-hab items[].i)', async () => {
  renderPage()
  await screen.findByText('50 fekvőtámasz')
  const rows = document.querySelectorAll('.nr-row')
  expect(rows.length).toBeGreaterThan(0)
  const hrefs = [...rows].map((r) => r.querySelector('use')?.getAttribute('href'))
  expect(hrefs).toContain('#i-suly')   // morning_weigh_in
  expect(hrefs).toContain('#i-hajnal') // wake_on_time
  expect(hrefs).toContain('#i-edzes')  // morning_pushups
  expect(new Set(hrefs).size).toBeGreaterThan(1) // NOT one fixed icon for every row
})

test('a habit carrying a linkUrl renders its title as that external link (the affordance the redesign lost)', async () => {
  habitStore.seed([
    { key: 'morning_video', chain: 'MORNING', position: 1, title: 'Reggeli videó', why: '', anchorCopy: 'kávé mellé', mode: 'MANUAL', status: 'pending', xp: 5, strengthPct: 54, linkUrl: 'https://example.com/reggeli' },
  ])
  renderPage()
  const link = await screen.findByRole('link', { name: /Reggeli videó/ })
  expect(link).toHaveAttribute('href', 'https://example.com/reggeli')
  expect(link).toHaveAttribute('target', '_blank')
  expect(link.getAttribute('rel')).toContain('noopener')
  // the tick stays its own control — the anchor never sits inside a button
  expect(link.closest('button')).toBeNull()
})

test('a habit with no linkUrl renders a plain title — no fabricated link', async () => {
  renderPage()
  await screen.findByText('50 fekvőtámasz')
  expect(screen.queryByRole('link')).toBeNull()
})

test('the lánc-erő bars carry a staggered --d so the .mz-play fill animates', async () => {
  renderPage()
  await screen.findByText('50 fekvőtámasz')
  const bar = document.querySelector('.nr-str div') as HTMLElement
  expect(bar.style.getPropertyValue('--d')).toMatch(/ms$/)
  expect(bar.style.width).toMatch(/%$/)
})
