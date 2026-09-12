// ============================================================
// Mezo · MealComposer — egy logolt étkezés SZERKESZTÉSE és TÖRLÉSE
// (Fuel Titanium S1c, mezo-33k6; manifeszt A8 · A9).
//
// A8: a szerkesztés a MEGLÉVŐ backend-műveletet hívja (`updateMeal`) — eddig nem volt UI-ja.
// A9: a törlés KÉT lépés (élesítés → megerősítés), egy félrekoppintás nem töröl.
//
// Amit külön őrzünk: a szerkesztés nem tolja MOSTRA a régi étkezés idejét, nem nevezi át
// csendben (a composerben nincs név-mező), és NEM jelent AI-piszkozat-visszajelzést — az a
// jelzés a piszkozat minőségéről beszél, nem a javításról.
// ============================================================
import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { FuelMeal } from '@/data/types'

const MEAL_DATE = '2026-09-10'
const MEAL: FuelMeal = {
  id: 'meal-1', slot: 'snack', title: 'Banán és skyr', score: 0.8,
  kcal: 310, p: 24, c: 44, f: 3,
  mealItems: [
    { source: 'estimate', refId: '', amount: 120, unit: 'g', name: 'Banán', contribution: { kcal: 107, p: 1, c: 27, f: 0 }, nova: 1 },
    { source: 'estimate', refId: '', amount: 150, unit: 'g', name: 'Skyr', contribution: { kcal: 95, p: 17, c: 6, f: 0 }, nova: 2 },
  ],
  items: [], tags: [],
  loggedAt: `${MEAL_DATE}T16:20:00+02:00`, mealDate: MEAL_DATE,
}

const hoisted = vi.hoisted(() => ({
  logMeal: vi.fn(),
  updateMeal: vi.fn(),
  deleteMeal: vi.fn(),
  reportDraftOutcome: vi.fn(),
}))
vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return {
    ...actual,
    useFuelDay: (date?: string) => {
      const real = actual.useFuelDay(date)
      return { ...real, fuel: { ...real.fuel, meals: [MEAL] } }
    },
    useMealActions: (date?: string) => ({
      ...actual.useMealActions(date),
      logMeal: hoisted.logMeal,
      updateMeal: hoisted.updateMeal,
      deleteMeal: hoisted.deleteMeal,
    }),
  }
})
vi.mock('@/data/aidraft/outcomeClient', () => ({ reportDraftOutcome: hoisted.reportDraftOutcome }))

import { MealComposer } from '@/features/fuel/components/MealComposer'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => {
  hoisted.logMeal.mockClear()
  hoisted.updateMeal.mockClear()
  hoisted.deleteMeal.mockClear()
  hoisted.reportDraftOutcome.mockClear()
  vi.unstubAllEnvs()
})

function renderComposer(props: { editMealId?: string } = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  return render(
    <MealComposer logDate={MEAL_DATE} prefill={null} onSaved={() => {}} onCancel={() => {}} {...props} />,
    { wrapper },
  )
}

// A8 (mezo-33k6): a szerkesztés a MEGLÉVŐ backend-műveletet hívja — eddig nem volt UI-ja.
test('szerkesztésnél a mentés frissít, nem új étkezést hoz létre', async () => {
  renderComposer({ editMealId: 'meal-1' })
  await userEvent.click(screen.getByRole('button', { name: /Mentem a javítást/ }))
  expect(hoisted.updateMeal).toHaveBeenCalledWith('meal-1', expect.objectContaining({ slot: 'snack' }))
  expect(hoisted.logMeal).not.toHaveBeenCalled()
})

test('a szerkesztő a meglévő étkezés soraival és idejével nyit', () => {
  renderComposer({ editMealId: 'meal-1' })
  expect(screen.getByText('Banán')).toBeInTheDocument()
  expect(screen.getByText('Skyr')).toBeInTheDocument()
  expect(screen.getByLabelText(/Mikor ettél/i)).toHaveValue('16:20')
})

test('a javítás az étkezés SAJÁT idejét tartja meg, nem tolja mostra', async () => {
  renderComposer({ editMealId: 'meal-1' })
  await userEvent.click(screen.getByRole('button', { name: /Mentem a javítást/ }))
  expect(hoisted.updateMeal.mock.calls[0][1].loggedAt.startsWith(`${MEAL_DATE}T16:20`)).toBe(true)
})

test('a javítás nem nevezi át csendben az étkezést', async () => {
  renderComposer({ editMealId: 'meal-1' })
  await userEvent.click(screen.getByRole('button', { name: /Mentem a javítást/ }))
  expect(hoisted.updateMeal.mock.calls[0][1].title).toBe('Banán és skyr')
})

test('az átírt időponttal megy a javítás', async () => {
  renderComposer({ editMealId: 'meal-1' })
  const time = screen.getByLabelText(/Mikor ettél/i)
  await userEvent.clear(time)
  await userEvent.type(time, '17:45')
  await userEvent.click(screen.getByRole('button', { name: /Mentem a javítást/ }))
  expect(hoisted.updateMeal.mock.calls[0][1].loggedAt.startsWith(`${MEAL_DATE}T17:45`)).toBe(true)
})

// A9: a törlés KÉT lépés — egy félrekoppintás nem töröl.
test('a törlés két lépéses', async () => {
  renderComposer({ editMealId: 'meal-1' })
  await userEvent.click(screen.getByRole('button', { name: 'Törlöm' }))
  expect(hoisted.deleteMeal).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: /Biztosan törlöm/ }))
  expect(hoisted.deleteMeal).toHaveBeenCalledWith('meal-1')
})

test('az élesített törlés visszavonható, és nem töröl', async () => {
  renderComposer({ editMealId: 'meal-1' })
  await userEvent.click(screen.getByRole('button', { name: 'Törlöm' }))
  await userEvent.click(screen.getByRole('button', { name: /Inkább megtartom/ }))
  expect(hoisted.deleteMeal).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Törlöm' })).toBeInTheDocument()
})

test('új étkezésnél nincs törlés gomb', () => {
  renderComposer()
  expect(screen.queryByRole('button', { name: 'Törlöm' })).not.toBeInTheDocument()
})

// A javítás NEM piszkozat-visszajelzés: az a jelzés az AI-piszkozat minőségéről beszél.
test('szerkesztésnél nem jelentünk AI-piszkozat-visszajelzést', async () => {
  const user = userEvent.setup()
  const { unmount } = renderComposer({ editMealId: 'meal-1' })
  await user.click(screen.getByRole('button', { name: '✨ AI · fotó vagy szöveg' }))
  await user.type(screen.getByLabelText('Mit ettél?'), 'egy wrap')
  await user.click(screen.getByRole('button', { name: '✨ Elemzés' }))
  expect(await screen.findByText('Csirkés wrap')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /Mentem a javítást/ }))
  unmount()
  expect(hoisted.reportDraftOutcome).not.toHaveBeenCalled()
})
