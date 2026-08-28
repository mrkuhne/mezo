import { render, screen } from '@testing-library/react'
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
  }
})

// Pin the wall clock: dayFace(tick) decides which face counts as "now", and setFace
// DELETES ?dp when the clicked face IS the now-face — on a CI runner whose clock lands
// in the este band, the dp=este assertion below would flip vacuously (this exact flake
// failed CI run 33144018103). 13:42 → nowFace 'nap', deterministic everywhere.
vi.mock('@/features/today/logic/useMinuteTick', () => ({
  useMinuteTick: () => new Date('2026-05-22T13:42:00'),
}))

beforeEach(() => waterStore.reset())

// Nap hub (mezo-d20.2.1) — the day spine's Mozaik face: header recipe (date eyebrow +
// daypart switch + bell + orb avatar), one hero per daypart panel, then the 2-column
// mosaic. Detail pages are F1.2–F1.6; until they land the tiles open the existing sheets.

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

test('the header carries the date eyebrow, the daypart switch, the bell and the orb avatar', async () => {
  renderHub()
  expect(await screen.findByRole('button', { name: 'Napszak váltása' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Értesítések/ })).toBeInTheDocument()
  expect(document.querySelector('.nap-avatar use[href="#i-mezo"]')).not.toBeNull()
})

test('the daypart switch opens a 3-option menu and switching re-renders the panel + updates ?dp', async () => {
  renderHub('/nap?dp=nap')
  await userEvent.click(await screen.findByRole('button', { name: 'Napszak váltása' }))
  const menu = screen.getByRole('menu')
  await userEvent.click(screen.getByRole('menuitem', { name: 'Este' }))
  expect(screen.getByTestId('loc')).toHaveTextContent('dp=este')
  expect(await screen.findByText('Villanyoltásig')).toBeInTheDocument()
  expect(menu).not.toBeInTheDocument()
})

test('the Nap panel hero is the keret: remaining kcal + day-bar', async () => {
  renderHub('/nap?dp=nap')
  expect(await screen.findByText(/kcal maradt/)).toBeInTheDocument()
  expect(document.querySelector('.daybar')).not.toBeNull()
})

test('the Reggel panel hero is the night summary with the h:mm duration', async () => {
  renderHub('/nap?dp=reggel')
  expect(await screen.findByText('Éjszakád')).toBeInTheDocument()
  // seed lastNight: duration 7.5 HOURS → 7:30 (a minutes-fed formatter would show 0:07)
  expect(screen.getByText('7:30')).toBeInTheDocument()
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

test('the mosaic tiles render with clay spots — Mezo, Küldetések, Check-in, Életjel', async () => {
  renderHub('/nap?dp=nap')
  expect(await screen.findByRole('button', { name: 'Mezo üzenetei' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Napi küldetések' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Check-in' })).toBeInTheDocument()
  expect(document.querySelector('.nap-bigring')).not.toBeNull()
})

test('the Mezo tile opens the messages sheet in place', async () => {
  renderHub('/nap?dp=nap')
  await userEvent.click(await screen.findByRole('button', { name: 'Mezo üzenetei' }))
  expect(await screen.findByText('Mezo üzenetei')).toBeInTheDocument()
})

test('the water tile logs +2,5 dl in place and the counter moves', async () => {
  renderHub('/nap?dp=nap')
  const tile = await screen.findByRole('button', { name: /Víz/ })
  expect(tile).toHaveTextContent('1,85')
  await userEvent.click(tile)
  expect(tile).toHaveTextContent('2,1')
})
