// ============================================================
// Mezo · FuelMealBlocks tests (Fuel Titanium S1b, mezo-33k6 — fagyasztott manifeszt
// A10 · A11 · A14). A lane-t a VALÓDI builder adja (`buildWindowLane`), a
// fuelSwimlane.test.ts `slot()`/`meal()` fixture-stílusában: ha a VM szerződése
// elmozdul, ezek a tesztek törnek, nem egy kézzel írt literál hazudik zöldet.
// ============================================================
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import type { FuelMeal, FuelSlot } from '@/data/types'
import type { DayBudget } from '@/features/fuel/logic/buildDayPlan'
import { buildWindowLane } from '@/features/fuel/logic/fuelSwimlane'
import { doneMealRows } from '@/features/fuel/logic/keretHero'
import { FuelMealBlocks } from '@/features/fuel/components/FuelMealBlocks'

const BUDGET: DayBudget = {
  kcal: 2400, p: 180, c: 240, f: 72,
  energy: { base: 2000, activity: 400, balance: 0, target: 2400 },
}

const meal = (over: Partial<FuelMeal> = {}): FuelMeal => ({
  id: 'meal-1', slot: 'breakfast', title: 'Skyr-bowl zabbal', score: 0.88,
  kcal: 420, p: 36, c: 48, f: 9,
  mealItems: [], items: [], tags: [],
  loggedAt: '2026-09-12T07:40:00', mealDate: '2026-09-12',
  breakdown: { confidence: 0.8, summary: null, tagline: null, dimensions: [], improve: [], tools: [] },
  ...over,
} as FuelMeal)

const slot = (over: Partial<FuelSlot> = {}): FuelSlot => ({
  time: '07:30', kind: 'meal', label: 'Reggeli', slotKey: 'breakfast', state: 'pending',
  kcal: 400, p: 30, c: 40, f: 10,
  ...over,
})

/** A nap négy tervezett blokkja: a reggeli be van logolva, a többi nyitott/jövő. */
function fixture({ missed = false }: { missed?: boolean } = {}) {
  const slots: FuelSlot[] = [
    slot({ time: '07:40', label: 'Reggeli', slotKey: 'breakfast', state: 'done', mealId: 'meal-1', mealName: 'Skyr-bowl zabbal', kcal: 420 }),
    slot({ time: '12:30', label: 'Ebéd', slotKey: 'lunch', state: missed ? 'missed' : 'now' }),
    slot({ time: '16:30', label: 'Uzsonna', slotKey: 'snack', state: 'pending' }),
    slot({ time: '19:30', label: 'Vacsora', slotKey: 'dinner', state: 'pending' }),
  ]
  const meals = [meal()]
  return {
    lane: buildWindowLane({ slots, budget: BUDGET, meals }),
    meals: doneMealRows(meals, slots),
    dayKcal: BUDGET.kcal,
  }
}

const props = (over: Record<string, unknown> = {}) => ({
  ...fixture(over as { missed?: boolean }),
  onLogInto: vi.fn(),
  onOpenMeal: vi.fn(),
  ...over,
})

// A10/A14 (mezo-33k6): a nap TERVEZETT blokkjai a lista, és minden blokk a saját
// étkezési ablakát viseli — nem külön idővonal-sáv, hanem a blokk címe alatti csík.
test('minden tervezett blokk megjelenik a saját ablak-csíkjával', () => {
  const { container } = render(<FuelMealBlocks {...props()} />)
  const blocks = container.querySelectorAll('.fmx-block')
  expect(blocks).toHaveLength(4)
  expect(Array.from(blocks).map(b => b.querySelector('.fmx-block-name')!.textContent))
    .toEqual(['Reggeli', 'Ebéd', 'Uzsonna', 'Vacsora'])
  for (const b of blocks) expect(b.querySelector('.fmx-window')).not.toBeNull()
})

// Az owner döntése: a SORBAN nincs kcal — a keret a blokk gyűrűjén ül.
test('a blokk gyűrűje viszi a keretet, az étkezés-sor nem ismétli meg', () => {
  const { container } = render(<FuelMealBlocks {...props()} />)
  const done = container.querySelector('.fmx-block.is-done')!
  expect(done.querySelector('.fmx-budget-ring')).not.toBeNull()
  expect(done.querySelector('.fmx-meal-row')!.textContent).not.toMatch(/kcal/)
})

// A logolás a blokkba történik — ez a fő útvonal.
test('az üres blokk koppintása a saját ablakával indítja a naplózást', async () => {
  const onLogInto = vi.fn()
  render(<FuelMealBlocks {...props({ onLogInto })} />)
  await userEvent.click(screen.getByRole('button', { name: /Uzsonna/ }))
  expect(onLogInto).toHaveBeenCalledTimes(1)
  expect(onLogInto.mock.calls[0][0].slotKey).toBe('snack')
})

// A11: a pontszám-chip kattintható és a részletekbe visz.
test('a logolt étkezés pont-chipje a részletekbe visz', async () => {
  const onOpenMeal = vi.fn()
  render(<FuelMealBlocks {...props({ onOpenMeal })} />)
  await userEvent.click(screen.getByRole('button', { name: /AI értékelés/ }))
  expect(onOpenMeal).toHaveBeenCalledWith('meal-1')
})

// Őszinte-null + szégyenmentesség: kihagyott ablak nem hibaállapot.
test('a kihagyott ablak semlegesen jelenik meg, pontszám nélkül', () => {
  const { container } = render(<FuelMealBlocks {...props({ missed: true })} />)
  const missed = container.querySelector('.fmx-block.is-missed')!
  expect(missed.querySelector('.fmx-score')).toBeNull()
  expect(missed.textContent).not.toMatch(/elrontott|kihagytad|hiba/i)
})

// Az ablak-csík a blokk ANKER idejét rajzolja ki, és a logolt étkezés jelölője rajta ül —
// a sáv szélei a tervezett időből származnak, nem találgatott „optimális" sávból.
test('az ablak-csík a blokk saját idejét viszi, a logolt étkezés jelölőjével', () => {
  const { container } = render(<FuelMealBlocks {...props()} />)
  const done = container.querySelector('.fmx-block.is-done')!
  const bar = done.querySelector('.fmx-window')!
  expect(bar.getAttribute('aria-label')).toContain('07:40')
  expect(bar.querySelectorAll('.fmx-window-at')).toHaveLength(1)
})
