// Behaviour change 1 (owner 2026-10-12, mezo-n4wf5.5) on the meal page and on Mezo's rating page: a meal the day plan
// placed on NO window is named „Ablakon kívül" / "Between meals" — not after its stored slot kind. The time is printed
// once: in the title bar's eyebrow on the meal page, after the name in the rating hero.
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FuelDay, FuelMeal, FuelSlot } from '@/data/types'
import { fuelDay } from '@/data/fuel/fuel'
import { setLang } from '@/shared/i18n'
import { QueryWrapper } from '@/test/queryWrapper'
import { FrameProvider, useFrame } from '@/shared/ui/folyadek'

const SEED = fuelDay.meals[0]
const EXTRA: FuelMeal = { ...SEED, id: 'tizorai', slot: 'snack', title: 'Whey + banán + mandulavaj', score: 0.72, kcal: 356, loggedAt: '2026-10-12T10:05:00', mealDate: '2026-10-12' }
const PLACED: FuelMeal = { ...SEED, id: 'reggeli', slot: 'breakfast', title: 'Túrós zabkása', score: 0.84, loggedAt: '2026-10-12T07:20:00', mealDate: '2026-10-12' }
const DAY: FuelDay = {
  targets: fuelDay.targets, consumed: fuelDay.consumed,
  fuelMode: null, recoveryCategory: null, recoveryDay: null, skippedKcal: 0,
  meals: [PLACED, EXTRA], pacing: { msg: '' }, micronutrients: [], supplements: [],
}
const SLOTS: FuelSlot[] = [
  { time: '07:20', kind: 'meal', label: 'Reggeli', slotKey: 'breakfast', state: 'done', mealId: 'reggeli', windowFrom: '06:30', windowTo: '08:30' },
  { time: '10:05', kind: 'snack', label: 'IRRELEVANT · 10:05', slotKey: 'snack', state: 'done', mealId: 'tizorai', extra: true },
]

vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return {
    ...actual,
    useFuelDay: () => ({ fuel: DAY, isPending: false }),
    useFuelTimeline: () => ({ plan: { slots: SLOTS } }),
  }
})

import { FuelMealDetailPage } from '@/features/fuel/pages/FuelMealDetailPage'
import { FuelMealScorePage } from '@/features/fuel/pages/FuelMealScorePage'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => { vi.unstubAllEnvs(); setLang('hu', { persist: false }) })

function FrameProbe() {
  const { title, eyebrow } = useFrame()
  return <div><span data-testid="frame-title">{title}</span><span data-testid="frame-eyebrow">{eyebrow}</span></div>
}
function renderAt(path: string) {
  const wrap = (el: React.ReactNode) => <FrameProvider><FrameProbe />{el}</FrameProvider>
  const router = createMemoryRouter([
    { path: '/fuel/etkezes/:id', element: wrap(<FuelMealDetailPage />) },
    { path: '/fuel/etkezes/:id/ertekeles', element: wrap(<FuelMealScorePage />) },
  ], { initialEntries: [path] })
  return render(<RouterProvider router={router} />, { wrapper: QueryWrapper })
}

describe('a window-less meal on its own pages', () => {
  it('the meal page is titled „Ablakon kívül", the time stands once, in the eyebrow', () => {
    renderAt('/fuel/etkezes/tizorai')
    expect(screen.getByTestId('frame-title').textContent).toBe('Ablakon kívül')
    expect(screen.getByTestId('frame-eyebrow').textContent).toBe('Fuel · 10:05')
  })

  it('the rating hero says „Ablakon kívül · 10:05": the time once', () => {
    const { container } = renderAt('/fuel/etkezes/tizorai/ertekeles')
    expect(container.querySelector('.fo-hero-lbl')!.textContent).toBe('Ablakon kívül · 10:05')
  })

  it('in English: "Between meals"', () => {
    setLang('en', { persist: false })
    const page = renderAt('/fuel/etkezes/tizorai')
    expect(screen.getByTestId('frame-title').textContent).toBe('Between meals')
    page.unmount()
    const { container } = renderAt('/fuel/etkezes/tizorai/ertekeles')
    expect(container.querySelector('.fo-hero-lbl')!.textContent).toBe('Between meals · 10:05')
  })

  it('a meal that sits on a window keeps the name of its place', () => {
    renderAt('/fuel/etkezes/reggeli')
    expect(screen.getByTestId('frame-title').textContent).toBe('Reggeli')
  })
})
