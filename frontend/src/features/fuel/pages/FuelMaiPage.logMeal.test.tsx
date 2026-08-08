import type { ReactNode } from 'react'
import { render, screen, renderHook } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, vi } from 'vitest'
import type { FuelPlanToday } from '@/data/types'
import { QueryWrapper } from '@/test/queryWrapper'

// The planner never emits recipe-suggestion / budget-only slots off the frozen mock seed
// (they only arise from the real composition), so to drive the FuelMaiPage → LogMealSheet
// tap-to-log wiring we override useFuelTimeline with a crafted plan. Every OTHER hook the page
// pulls from @/data/hooks stays real (mock mode) via the importOriginal spread; when
// `hoisted.plan` is unset the real useFuelTimeline runs, so this override is inert elsewhere.
// The page also reads blocks/nowHHmm (workoutTime + hero/river composition) — fixed, sensible
// values here since neither test cares about window placement/ordering, only the tap-to-log
// wiring on the window island itself. Neither crafted slot carries a 'now' state, so the
// river's default-big island is the Keret-öv (mezo-jgh9's act-anywhere model) — both tests
// select the window's OWN capsule first, then act, exactly like a real user would.
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

import { FuelMaiPage } from '@/features/fuel/pages/FuelMaiPage'
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
      <MemoryRouter><FuelMaiPage /></MemoryRouter>
    </QueryWrapper>,
  )

const baseCtx = {
  workout: { type: '', start: '—', end: '—', duration: 0 },
  volleyball: { start: '—', end: '—', noneToday: true },
  bedtime: '23:00', kitchenClose: '21:30', caffeineCutoff: '14:00',
  energy: { base: 2400, activity: 0, balance: 0, target: 2400 },
}

test('tapping a recipe-suggestion window opens LogMealSheet pre-filled from that recipe', async () => {
  const recipe = renderHook(() => useRecipes(), { wrapper }).result.current.recipes[0]
  hoisted.plan = {
    ...baseCtx,
    slots: [
      { time: '08:00', kind: 'meal', label: 'Reggeli', slotKey: 'breakfast', state: 'pending', mealName: recipe.name, suggestedRecipeId: recipe.id, kcal: 480, p: 30, c: 55, f: 12 },
    ],
  }
  renderView()
  // Act-anywhere: no 'now' window in this crafted plan, so the Keret-öv is big by default —
  // select the window's own capsule first (its essence carries the recipe name), then act.
  await userEvent.click(screen.getByRole('button', { name: `Reggeli · 08:00 · ${recipe.name} · megnyitás` }))
  await userEvent.click(screen.getByRole('button', { name: 'Logold' }))
  expect(await screen.findByText('Mit ettél?')).toBeInTheDocument()
  // The recipe surfaces as a pre-filled item line inside the sheet (source: recipe).
  expect(screen.getAllByText(recipe.name).length).toBeGreaterThanOrEqual(1)
  expect(screen.getByText('recept')).toBeInTheDocument()
})

test('tapping a budget-only window opens LogMealSheet with the mapped slot pre-selected', async () => {
  hoisted.plan = {
    ...baseCtx,
    slots: [
      { time: '19:30', kind: 'meal', label: 'Vacsora', slotKey: 'dinner', state: 'pending', kcal: 700, p: 45, c: 70, f: 22 },
    ],
  }
  renderView()
  await userEvent.click(screen.getByRole('button', { name: 'Vacsora · 19:30 · Vacsora · megnyitás' }))
  await userEvent.click(screen.getByRole('button', { name: 'Logold' }))
  expect(await screen.findByText('Mit ettél?')).toBeInTheDocument()
  // Vacsora → dinner: the sheet's slot segmented control opens with 'Vacsora' active.
  expect(screen.getByRole('button', { name: 'Vacsora', pressed: true })).toBeInTheDocument()
})
