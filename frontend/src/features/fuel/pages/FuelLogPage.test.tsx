// Mezo · FuelLogPage — the /fuel/log stacked-window logging page (mezo-byo1).
// The crafted-plan harness carries over from the retired FuelMaiPage.logMeal.test.tsx:
// the planner never emits recipe-suggestion / budget-only slots off the frozen mock seed,
// so we override useFuelTimeline with a crafted plan; every OTHER hook stays real
// (mock mode) via the importOriginal spread.
import type { ReactNode } from 'react'
import { render, screen, renderHook } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, vi } from 'vitest'
import type { FuelPlanToday } from '@/data/types'
import { QueryWrapper } from '@/test/queryWrapper'

const hoisted = vi.hoisted(() => ({ plan: null as FuelPlanToday | null }))
vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return {
    ...actual,
    useFuelTimeline: () =>
      hoisted.plan
        ? {
            plan: hoisted.plan,
            budget: { kcal: 2400, p: 180, c: 240, f: 73, energy: hoisted.plan.energy },
            blocks: [],
            weightKg: 82,
            energyBreakdown: null,
            wake: '06:45',
            bed: '23:00',
            nowHHmm: '13:30',
            getScoredMeal: () => null,
          }
        : actual.useFuelTimeline(),
  }
})

import { FuelLogPage } from '@/features/fuel/pages/FuelLogPage'
import { useRecipes } from '@/data/hooks'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => {
  hoisted.plan = null
  vi.unstubAllEnvs()
})

const wrapper = ({ children }: { children: ReactNode }) => <QueryWrapper>{children}</QueryWrapper>
const renderView = () =>
  render(
    <QueryWrapper>
      <MemoryRouter initialEntries={['/fuel/log']}>
        <Routes>
          <Route path="/fuel/log" element={<FuelLogPage />} />
          <Route path="/fuel/plan" element={<div>PLAN PAGE PROBE</div>} />
          <Route path="/fuel" element={<div>FUEL HUB PROBE</div>} />
        </Routes>
      </MemoryRouter>
    </QueryWrapper>,
  )

const baseCtx = {
  workout: { type: '', start: '—', end: '—', duration: 0 },
  volleyball: { start: '—', end: '—', noneToday: true },
  bedtime: '23:00', kitchenClose: '21:30', caffeineCutoff: '14:00',
  energy: { base: 2400, activity: 0, balance: 0, target: 2400 },
}

test('a recipe-suggestion window expands the composer IN PLACE, pre-filled, without a MIKOR segment', async () => {
  const recipe = renderHook(() => useRecipes(), { wrapper }).result.current.recipes[0]
  hoisted.plan = {
    ...baseCtx,
    slots: [
      { time: '08:00', kind: 'meal', label: 'Reggeli', slotKey: 'breakfast', state: 'pending', mealName: recipe.name, suggestedRecipeId: recipe.id, kcal: 480, p: 30, c: 55, f: 12 },
    ],
  }
  renderView()
  await userEvent.click(screen.getByRole('button', { name: 'Logold · Reggeli' }))
  // In-place: no full-page "Mit ettél?" overlay title — the composer lives in the block.
  expect(screen.queryByText('Mit ettél?')).not.toBeInTheDocument()
  // The plan recipe surfaces as a pre-filled line.
  expect(screen.getAllByText(recipe.name).length).toBeGreaterThanOrEqual(1)
  expect(screen.getByText('recept')).toBeInTheDocument()
  // fixedSlot: the window IS the slot, so the MIKOR segmented control never renders.
  expect(screen.queryByRole('button', { name: 'Vacsora' })).not.toBeInTheDocument()
  // Save is live (a prefilled line exists).
  expect(screen.getByRole('button', { name: /logolás · \+10 XP/i })).toBeEnabled()
})

test('saving inside a window block closes the composer', async () => {
  const recipe = renderHook(() => useRecipes(), { wrapper }).result.current.recipes[0]
  hoisted.plan = {
    ...baseCtx,
    slots: [
      { time: '13:00', kind: 'meal', label: 'Ebéd', slotKey: 'lunch', state: 'now', mealName: recipe.name, suggestedRecipeId: recipe.id, kcal: 640, p: 42, c: 68, f: 14 },
    ],
  }
  renderView()
  await userEvent.click(screen.getByRole('button', { name: 'Logold · Ebéd' }))
  await userEvent.click(screen.getByRole('button', { name: /logolás · \+10 XP/i }))
  // The composer collapsed: its CTA row is back, the save button gone. (The crafted plan is
  // frozen by the hoisted override, so the block state itself cannot re-derive here — the
  // real-day flip is covered by the mock data layer's own logMeal tests.)
  expect(screen.queryByRole('button', { name: /logolás · \+10 XP/i })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Logold · Ebéd' })).toBeInTheDocument()
})

test('a missed window offers Pótold and says "még pótolható" — never punitive', () => {
  hoisted.plan = {
    ...baseCtx,
    slots: [
      { time: '10:30', kind: 'meal', label: 'Tízórai', slotKey: 'snack', state: 'missed', kcal: 380, p: 26, c: 34, f: 15 },
    ],
  }
  renderView()
  expect(screen.getByText('KIMARADT')).toBeInTheDocument()
  expect(screen.getByText('még pótolható')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Pótold · Tízórai' })).toBeInTheDocument()
})

test('the free block carries the MIKOR segment (slot-less launch)', async () => {
  hoisted.plan = { ...baseCtx, slots: [] }
  renderView()
  await userEvent.click(screen.getByRole('button', { name: 'Logolás · ablakon kívül' }))
  // The out-of-window composer shows the segmented control.
  expect(screen.getByRole('button', { name: 'Vacsora' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Reggeli' })).toBeInTheDocument()
})

test('an empty day leads with the tervezz door to /fuel/plan', async () => {
  hoisted.plan = { ...baseCtx, slots: [] }
  renderView()
  expect(screen.getByText('Nincs mai terv')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: '＋ tervezz' }))
  expect(await screen.findByText('PLAN PAGE PROBE')).toBeInTheDocument()
})

test('the back chip returns to the Fuel hub', async () => {
  hoisted.plan = { ...baseCtx, slots: [] }
  renderView()
  await userEvent.click(screen.getByRole('button', { name: 'Vissza' }))
  expect(await screen.findByText('FUEL HUB PROBE')).toBeInTheDocument()
})

test('a scored done meal WITH a breakdown opens MealScoreSheet from its block score chip', async () => {
  // Real mock timeline (no crafted plan): the demo day carries two scored done meals.
  renderView()
  const chips = await screen.findAllByRole('button', { name: /AI score részletek$/ })
  expect(chips.length).toBeGreaterThan(0)
  await userEvent.click(chips[0])
  expect(await screen.findByText('AI score · részletek')).toBeInTheDocument()
})

test('a done window shows KÉSZ ✓ with no Logold CTA', () => {
  // The done join needs a real meal id; the crafted slot points at a nonexistent meal, so the
  // name falls back to the slot's own mealName and the score chip reads "✨ folyamatban".
  hoisted.plan = {
    ...baseCtx,
    slots: [
      { time: '07:30', kind: 'meal', label: 'Reggeli', slotKey: 'breakfast', state: 'done', mealName: 'Skyr-bowl zabbal', kcal: 420, p: 32, c: 48, f: 9 },
    ],
  }
  renderView()
  expect(screen.getByText('KÉSZ ✓')).toBeInTheDocument()
  expect(screen.getByText('Skyr-bowl zabbal')).toBeInTheDocument()
  expect(screen.getByText('✨ folyamatban')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Logold · Reggeli' })).not.toBeInTheDocument()
})
