// Mezo · FuelLogPage — the /fuel/log stacked-window logging page (mezo-byo1).
// The crafted-plan harness carries over from the retired FuelMaiPage.logMeal.test.tsx:
// the planner never emits recipe-suggestion / budget-only slots off the frozen mock seed,
// so we override useFuelTimeline with a crafted plan; every OTHER hook stays real
// (mock mode) via the importOriginal spread.
import type { ReactNode } from 'react'
import { render, screen, renderHook, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, vi } from 'vitest'
import type { FuelPlanToday } from '@/data/types'
import { QueryWrapper } from '@/test/queryWrapper'
import { addDays, localDateString } from '@/shared/lib/dates'

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
import { useRecipes, useFuelDay } from '@/data/hooks'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => {
  hoisted.plan = null
  vi.unstubAllEnvs()
})

const wrapper = ({ children }: { children: ReactNode }) => <QueryWrapper>{children}</QueryWrapper>
const renderView = (initialEntries: string[] = ['/fuel/log']) =>
  render(
    <QueryWrapper>
      <MemoryRouter initialEntries={initialEntries}>
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

// ── Day stepper + Pótlás mood + ?d= deep link (mezo-1j3z) ──────────────────

test('nap-léptető: ‹ visszalép, az oldal Pótlás-hangulatra vált, minden nem-done blokk Pótold', async () => {
  hoisted.plan = {
    ...baseCtx,
    slots: [
      { time: '07:30', kind: 'meal', label: 'Reggeli', slotKey: 'breakfast', state: 'done', mealName: 'Skyr-bowl zabbal', kcal: 420, p: 32, c: 48, f: 9 },
      { time: '13:00', kind: 'meal', label: 'Ebéd', slotKey: 'lunch', state: 'now', kcal: 640, p: 42, c: 68, f: 14 },
      { time: '19:00', kind: 'meal', label: 'Vacsora', slotKey: 'dinner', state: 'pending', kcal: 580, p: 38, c: 60, f: 16 },
    ],
  }
  const user = userEvent.setup()
  renderView()
  await user.click(screen.getByRole('button', { name: 'Előző nap' }))
  expect(screen.getByText('Pótlás')).toBeInTheDocument()
  expect(screen.getByText(/erre a napra könyvelődik/)).toBeInTheDocument()
  // The now + pending window both flip to missed → Pótold; no MOST stamp in the past.
  expect(screen.getAllByRole('button', { name: /^Pótold/ })).toHaveLength(2)
  expect(screen.queryByText('MOST')).not.toBeInTheDocument()
})

test('a ‹ 7 napnál, a › a mai napnál disabled', async () => {
  hoisted.plan = { ...baseCtx, slots: [] }
  const user = userEvent.setup()
  renderView()
  const prevBtn = () => screen.getByRole('button', { name: 'Előző nap' })
  const nextBtn = () => screen.getByRole('button', { name: 'Következő nap' })
  for (let i = 0; i < 7; i++) await user.click(prevBtn())
  expect(prevBtn()).toBeDisabled()
  for (let i = 0; i < 7; i++) await user.click(nextBtn())
  expect(nextBtn()).toBeDisabled()
})

test('?d= deep link: érvényes tegnapi dátum azon a napon nyit (Pótlás)', () => {
  hoisted.plan = { ...baseCtx, slots: [] }
  renderView([`/fuel/log?d=${addDays(localDateString(), -1)}`])
  expect(screen.getByText('Pótlás')).toBeInTheDocument()
})

test('?d= deep link: érvénytelen (távoli múlt) dátum a mai napra clampel', () => {
  hoisted.plan = { ...baseCtx, slots: [] }
  renderView(['/fuel/log?d=2020-01-01'])
  expect(screen.queryByText('Pótlás')).not.toBeInTheDocument()
  expect(screen.getByText('Logolás')).toBeInTheDocument()
})

test('múltbeli mentés a választott nap loggedAt-jával, az ablak idejével íródik', async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const qcWrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  hoisted.plan = {
    ...baseCtx,
    slots: [
      { time: '13:00', kind: 'meal', label: 'Ebéd', slotKey: 'lunch', state: 'now', kcal: 640, p: 42, c: 68, f: 14 },
    ],
  }
  const user = userEvent.setup()
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/fuel/log']}>
        <Routes>
          <Route path="/fuel/log" element={<FuelLogPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  await user.click(screen.getByRole('button', { name: 'Előző nap' }))
  await user.click(screen.getByRole('button', { name: 'Pótold · Ebéd' }))
  await user.click(screen.getByRole('button', { name: 'Kamra · hozzáadás' }))
  const addBtn = (await screen.findAllByRole('button', { name: /hozzáadása$/i }))[0]
  await user.click(addBtn)
  await user.click(screen.getByRole('button', { name: 'Bezárás' }))
  await user.click(screen.getByRole('button', { name: /pótlás/i }))

  const yesterday = addDays(localDateString(), -1)
  const probe = renderHook(() => useFuelDay(yesterday), { wrapper: qcWrapper })
  await waitFor(() => {
    const meals = probe.result.current.fuel.meals
    expect(meals.some(m => m.loggedAt?.startsWith(`${yesterday}T13:00`))).toBe(true)
  })
})

test('nap-váltás bezárja a nyitott composert', async () => {
  hoisted.plan = { ...baseCtx, slots: [] }
  const user = userEvent.setup()
  renderView()
  await user.click(screen.getByRole('button', { name: 'Logolás · ablakon kívül' }))
  expect(screen.getByText('MIKOR')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Előző nap' }))
  expect(screen.queryByText('MIKOR')).not.toBeInTheDocument()
})

test('lezárt múltbeli nap: minden done → zsálya kártya, a szabad blokk marad', async () => {
  hoisted.plan = {
    ...baseCtx,
    slots: [
      { time: '07:30', kind: 'meal', label: 'Reggeli', slotKey: 'breakfast', state: 'done', mealName: 'Skyr-bowl zabbal', kcal: 420, p: 32, c: 48, f: 9 },
    ],
  }
  const user = userEvent.setup()
  renderView()
  await user.click(screen.getByRole('button', { name: 'Előző nap' }))
  expect(screen.getByText('Minden ablak kész ✓')).toBeInTheDocument()
  expect(screen.getByText('Ablakon kívül')).toBeInTheDocument()
})

test('üres múltbeli nap: nincs ＋ tervezz CTA, a meta „nem volt ablak"-ot mond', async () => {
  hoisted.plan = { ...baseCtx, slots: [] }
  const user = userEvent.setup()
  renderView()
  await user.click(screen.getByRole('button', { name: 'Előző nap' }))
  expect(screen.queryByRole('button', { name: '＋ tervezz' })).not.toBeInTheDocument()
  expect(screen.getByText('ezen a napon nem volt étkezési ablak')).toBeInTheDocument()
})
