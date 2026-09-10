import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { NapGyorsPage } from '@/features/today/pages/NapGyorsPage'
import { LevelUpProvider } from '@/features/progression/LevelUpProvider'
import { QueryWrapper } from '@/test/queryWrapper'
import { initialCheckins } from '@/data/today/checkins'
import { localDateString } from '@/shared/lib/dates'

// Same data-layer stubs as QuickInputSheet.test.tsx (the two surfaces share the same
// `QuickLogSurface` grid — mezo-mhum) so this page's tiles/sublines render deterministically.
const checkinsMock = vi.hoisted(() => ({ useCheckins: vi.fn() }))
const fuelPreviewMock = vi.hoisted(() => ({ useFuelPreview: vi.fn() }))
const waterStore = vi.hoisted(() => ({ set: undefined as undefined | ((up: (n: number) => number) => void) }))
vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  const { useState } = await import('react')
  return {
    ...actual,
    useCheckins: () => checkinsMock.useCheckins(),
    useFuelPreview: () => fuelPreviewMock.useFuelPreview(),
    useFuelDay: () => {
      const [water, setWater] = useState(1850)
      waterStore.set = setWater
      return { fuel: { consumed: { water }, targets: { water: 3000 } } }
    },
    useWaterActions: () => ({ logWater: (ml: number) => waterStore.set?.(n => n + ml) }),
    useWeight: () => ({
      weightLog: [{ date: '2026-05-22', value: 78.6 }],
      weightTrends: { latestTrendKg: 78.6, weeklyRateKgPerWeek: -0.5, last4wRateKgPerWeek: -0.5 },
      logWeight: vi.fn(),
    }),
    useToday: () => ({
      today: { workoutTime: '17:00', workoutType: 'Pull Day' },
      workoutDone: false,
    }),
    useQuickLogSport: () => ({
      sessions: [
        { id: 's3', sport: 'volleyball', isoDate: localDateString(), duration: 45 },
      ],
      logSportSession: vi.fn(),
    }),
  }
})

const NOW_WINDOW = {
  time: '13:30', kind: 'meal', label: 'Ebéd-ablak', slotKey: 'lunch',
  state: 'now', mealName: 'Csirkés rizses tál',
} as const

beforeEach(() => {
  checkinsMock.useCheckins.mockReturnValue({ checkins: initialCheckins, saveCheckIn: vi.fn() })
  fuelPreviewMock.useFuelPreview.mockReturnValue({ visible: [NOW_WINDOW], nextStack: undefined, plan: { slots: [NOW_WINDOW] } })
})
afterEach(() => {
  checkinsMock.useCheckins.mockReset()
  fuelPreviewMock.useFuelPreview.mockReset()
})

function LocationProbe() {
  const loc = useLocation()
  return <div data-testid="loc">{loc.pathname}</div>
}

function renderPage() {
  return render(
    <QueryWrapper>
      <LevelUpProvider>
        <MemoryRouter initialEntries={['/nap/gyors']}>
          <Routes><Route path="*" element={<><NapGyorsPage /><LocationProbe /></>} /></Routes>
        </MemoryRouter>
      </LevelUpProvider>
    </QueryWrapper>,
  )
}

test('renders all nine quick-log tiles and the Mondd el Mezónak row', () => {
  renderPage()
  for (const label of ['Étkezés', 'Víz', 'Stack', 'Edzés', 'Sport', 'Súly', 'Check-in', 'Napló', 'Alvás'])
    expect(screen.getByText(label)).toBeInTheDocument()
  expect(screen.getByText('Mondd el Mezónak')).toBeInTheDocument()
})

test('the Stack tile navigates to /fuel/stack', async () => {
  renderPage()
  await userEvent.click(screen.getByRole('button', { name: /Stack/ }))
  await vi.waitFor(() => expect(screen.getByTestId('loc')).toHaveTextContent('/fuel/stack'))
})
