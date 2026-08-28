import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { NapCheckinPage } from '@/features/today/pages/NapCheckinPage'
import { NapHubPage } from '@/features/today/pages/NapHubPage'
import { LevelUpProvider } from '@/features/progression/LevelUpProvider'
import { ToastProvider } from '@/shared/ui/ToastProvider'
import { QueryWrapper } from '@/test/queryWrapper'

// Check-in detail page (mezo-d20.2.5) — prototype nap-body.html #page-check: the day's four
// slots as rows in ONE card; done slots carry their measured values as mini-cells, the NEXT
// fillable slot is the hot row and opens the real CheckInSheet flow from the page.

// Mode-agnostic checkins stub: the mock seed and the real-mode day-build (wall-clock
// dependent!) differ, so the slot set is pinned here. saveCheckIn mutates a shared store
// so the page re-renders exactly like the real hook's optimistic overlay.
const ckStore = vi.hoisted(() => {
  const seed = () => [
    { time: '06:30', state: 'done', values: { energy: 7, stress: 3, body: 6, mental: 7 }, note: 'Nyugodt ébredés · pihenve' },
    { time: '10:00', state: 'done', values: { energy: 8, stress: 4, body: 7, mental: 8 }, note: null },
    { time: '14:00', state: 'now', values: null, note: null },
    { time: '20:00', state: 'pending', values: null, note: null },
  ]
  const listeners = new Set<() => void>()
  let slots = seed()
  return {
    get slots() { return slots },
    subscribe: (l: () => void) => { listeners.add(l); return () => listeners.delete(l) },
    save(idx: number, data: object) {
      slots = slots.map((s, i) => (i === idx ? { ...s, ...data } : s))
      listeners.forEach((l) => l())
    },
    reset() { slots = seed(); listeners.forEach((l) => l()) },
  }
})
vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  const { useSyncExternalStore } = await import('react')
  return {
    ...actual,
    useCheckins: () => ({
      checkins: useSyncExternalStore(ckStore.subscribe, () => ckStore.slots),
      saveCheckIn: (idx: number, data: object) => ckStore.save(idx, data),
    }),
  }
})

beforeEach(() => ckStore.reset())

function renderPage(initialEntries: string[] = ['/nap/checkin']) {
  return render(
    <QueryWrapper>
      <ToastProvider>
        <LevelUpProvider>
          <MemoryRouter initialEntries={initialEntries} initialIndex={initialEntries.length - 1}>
            <Routes>
              <Route path="/nap" element={<NapHubPage />} />
              <Route path="/nap/checkin" element={<NapCheckinPage />} />
              <Route path="/elsewhere" element={<div>elsewhere-page</div>} />
            </Routes>
          </MemoryRouter>
        </LevelUpProvider>
      </ToastProvider>
    </QueryWrapper>,
  )
}

test('the hero counts the done slots and carries the prototype copy verbatim', async () => {
  renderPage()
  expect(await screen.findByText('2/4')).toBeInTheDocument()
  expect(screen.getByText('Check-in')).toBeInTheDocument()
  expect(screen.getByText('négy pillanatkép a napodról')).toBeInTheDocument()
  expect(screen.getByText('A kimaradt slot nem vész el — Pótold bármikor, a társ nem büntet.')).toBeInTheDocument()
})

test('done slots render their measured values as mini-cells; non-done slots show NO cells', async () => {
  renderPage()
  expect(await screen.findByText('Reggel · 06:30')).toBeInTheDocument()
  expect(screen.getByText('Délelőtt · 10:00')).toBeInTheDocument()
  // exactly the 2 done slots carry a mini-cell row (honest states: nothing fabricated)
  expect(document.querySelectorAll('.mz-mcells')).toHaveLength(2)
  expect(screen.getAllByText('Energia')).toHaveLength(2)
  // the saved note surfaces on its row
  expect(screen.getByText('Nyugodt ébredés · pihenve')).toBeInTheDocument()
})

test('the future slot renders muted as "később esedékes" and is not interactive', async () => {
  renderPage()
  expect(await screen.findByText('Este · 20:00 körül')).toBeInTheDocument()
  expect(screen.getByText('később esedékes')).toBeInTheDocument()
  // only the hot slot offers the fill affordance
  expect(screen.getAllByRole('button', { name: 'Kitöltöm' })).toHaveLength(1)
})

test('the hot slot opens the real CheckInSheet and a save flips the day to 3/4', async () => {
  renderPage()
  expect(await screen.findByText('Délután · most esedékes')).toBeInTheDocument()
  expect(screen.getByText('hogy vagy energiával?')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Kitöltöm' }))
  expect(await screen.findByText(/Hogy vagyunk/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: '8' }))
  for (let i = 0; i < 4; i++) {
    const skip = screen.queryByRole('button', { name: /Kihagy/ })
    if (skip) await userEvent.click(skip)
  }
  await userEvent.click(await screen.findByRole('button', { name: /Mentés/ }))
  expect(await screen.findByText('3/4')).toBeInTheDocument()
  // the slot row settled: no fill affordance left for it, its values render as mini-cells
  expect(screen.queryByText('Délután · most esedékes')).not.toBeInTheDocument()
  expect(document.querySelectorAll('.mz-mcells')).toHaveLength(3)
})

test('the back chip navigates back', async () => {
  renderPage(['/elsewhere', '/nap/checkin'])
  await userEvent.click(await screen.findByRole('button', { name: 'Vissza' }))
  expect(await screen.findByText('elsewhere-page')).toBeInTheDocument()
})

test('the hub Check-in tile navigates to /nap/checkin instead of opening the sheet', async () => {
  renderPage(['/nap?dp=nap'])
  await userEvent.click(await screen.findByRole('button', { name: 'Check-in' }))
  expect(await screen.findByText('négy pillanatkép a napodról')).toBeInTheDocument()
  expect(screen.queryByText(/Hogy vagyunk/)).not.toBeInTheDocument()
})
