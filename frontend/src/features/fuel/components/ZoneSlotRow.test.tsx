import type { ComponentProps } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import type { FuelMeal, FuelSlot } from '@/data/types'
import { ZoneSlotRow } from '@/features/fuel/components/ZoneSlotRow'

const noop = () => {}
const defaults = {
  scoredMeal: null, tagline: null, coachPending: false, burnKcal: 0, anchored: false, onOpenScore: noop,
}

// `over`'s type is `Partial<ComponentProps<typeof ZoneSlotRow>>`, not the brief's literal
// `Record<string, unknown>` — that cast didn't type-check (`ReturnType<typeof vi.fn>` on an
// uninstantiated generic isn't assignable to `((slot: FuelSlot) => void) | undefined`). Same
// type-only fix already applied to DayBudgetCard.test.tsx in Task 5; no test body changed.
function renderRow(slot: FuelSlot, over: Partial<ComponentProps<typeof ZoneSlotRow>> = {}) {
  const onLogMeal = over.onLogMeal ?? vi.fn()
  render(<ZoneSlotRow slot={slot} {...defaults} {...over} onLogMeal={onLogMeal} />)
  return onLogMeal
}

// ── Recipe-suggestion window (ported) ─────────────────────────────────────────
const suggestion: FuelSlot = {
  time: '08:00', kind: 'meal', label: 'Reggeli', slotKey: 'breakfast', state: 'pending',
  mealName: 'Túrós palacsinta', suggestedRecipeId: 'r1', kcal: 500, p: 35, c: 50, f: 15,
}

test('suggestion row renders the recipe name, macros and an "ajánlott" marker', () => {
  renderRow(suggestion)
  expect(screen.getByText('Túrós palacsinta')).toBeInTheDocument()
  expect(screen.getByText('ajánlott')).toBeInTheDocument()
  expect(screen.getByText('500 kcal')).toBeInTheDocument()
  expect(screen.getByText('F 35')).toBeInTheDocument()
  expect(screen.getByText('Sz 50')).toBeInTheDocument()
  expect(screen.getByText('Zs 15')).toBeInTheDocument()
})

test('tapping the suggestion Logolás CTA fires onLogMeal(slot)', async () => {
  const onLogMeal = renderRow(suggestion)
  await userEvent.click(screen.getByRole('button', { name: 'Túrós palacsinta logolása' }))
  expect(onLogMeal).toHaveBeenCalledWith(suggestion)
})

// ── Budget-only window (ported) ───────────────────────────────────────────────
const budget: FuelSlot = { time: '12:30', kind: 'meal', label: 'Ebéd', state: 'pending', kcal: 700, p: 45, c: 70, f: 22 }

test('budget-only row renders its label, macros and a Logolás affordance', async () => {
  const onLogMeal = renderRow(budget)
  expect(screen.getByText('Ebéd')).toBeInTheDocument()
  expect(screen.getByText('700 kcal')).toBeInTheDocument()
  expect(screen.getByText('F 45')).toBeInTheDocument()
  expect(screen.getByText('Sz 70')).toBeInTheDocument()
  expect(screen.getByText('Zs 22')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Ebéd logolása' }))
  expect(onLogMeal).toHaveBeenCalledWith(budget)
})

// ── Base row template (ported: SlotCard's ".slot/.fav/.mrow" markup lives on as .zrow/.zf/.zt) ──
test('a plain meal row renders the .zrow template with a .zf avatar and a .zt meta block', () => {
  const { container } = render(<ZoneSlotRow slot={suggestion} {...defaults} onLogMeal={vi.fn()} />)
  expect(container.querySelector('.zrow')).toBeInTheDocument()
  expect(container.querySelector('.zrow .zf')).toBeInTheDocument()
  expect(container.querySelector('.zrow .zt')).toBeInTheDocument()
})

// ── AI chip gating (ported, mezo-53su) ────────────────────────────────────────
const budgetWithSlotKey: FuelSlot = { ...budget, slotKey: 'lunch' }

test('an open window with a slotKey renders BOTH Logolás and the AI chip', () => {
  render(<ZoneSlotRow slot={budgetWithSlotKey} {...defaults} onLogMeal={vi.fn()} onAiLog={vi.fn()} />)
  expect(screen.getByRole('button', { name: 'Ebéd logolása' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Ebéd AI-logolása' })).toBeInTheDocument()
})

test('clicking the AI chip fires onAiLog(slot)', async () => {
  const onAiLog = vi.fn()
  render(<ZoneSlotRow slot={budgetWithSlotKey} {...defaults} onLogMeal={vi.fn()} onAiLog={onAiLog} />)
  await userEvent.click(screen.getByRole('button', { name: 'Ebéd AI-logolása' }))
  expect(onAiLog).toHaveBeenCalledWith(budgetWithSlotKey)
})

test('a window WITHOUT a slotKey renders Logolás but no AI chip', () => {
  render(<ZoneSlotRow slot={budget} {...defaults} onLogMeal={vi.fn()} onAiLog={vi.fn()} />)
  expect(screen.getByRole('button', { name: 'Ebéd logolása' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Ebéd AI-logolása' })).toBeNull()
})

test('a done window renders neither log affordance', () => {
  const done: FuelSlot = {
    time: '09:15', kind: 'meal', label: 'Reggeli', slotKey: 'breakfast', state: 'done',
    mealName: 'Zabkása', kcal: 500, p: 30, c: 55, f: 12,
  }
  render(<ZoneSlotRow slot={done} {...defaults} onLogMeal={vi.fn()} onAiLog={vi.fn()} />)
  expect(screen.queryByRole('button', { name: /logolása/ })).toBeNull()
})

// ── Missed window (ported, mezo-1oy5) ─────────────────────────────────────────
test('a missed window renders faded with a Pótlás retro-log', () => {
  const slot = { time: '13:00', kind: 'meal', label: 'Ebéd', slotKey: 'lunch', state: 'missed', kcal: 610 } as FuelSlot
  const onLogMeal = vi.fn()
  const { container } = render(<ZoneSlotRow slot={slot} {...defaults} onLogMeal={onLogMeal} />)
  expect(container.querySelector('.zrow.missedrow')).toBeInTheDocument()
  expect(screen.getByText('kihagyott')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /pótlása/i }))
  expect(onLogMeal).toHaveBeenCalledWith(slot)
})

test('a missed window that still carries suggestedRecipeId renders ONLY Pótlás', () => {
  const slot = {
    time: '13:00', kind: 'meal', label: 'Ebéd', slotKey: 'lunch', state: 'missed',
    mealName: 'Túrós tészta', suggestedRecipeId: 'r1', kcal: 610,
  } as FuelSlot
  render(<ZoneSlotRow slot={slot} {...defaults} onLogMeal={vi.fn()} />)
  expect(screen.getByRole('button', { name: /pótlása/i })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /logolása/i })).toBeNull()
})

// ── Empty mealName falls back to the label (ported, mezo-u68c) ─────────────────
test('falls back to the slot label when mealName is empty', () => {
  renderRow({
    time: '08:40', kind: 'meal', label: 'Reggeli', slotKey: 'breakfast', state: 'done', mealName: '',
    kcal: 500, p: 30, c: 55, f: 12,
  })
  expect(screen.getByText('Reggeli')).toBeInTheDocument()
})

// ── Activity rows: duration guard (ported) + the burn readout (new) ───────────
test('an activity row without a duration renders no "· perc" suffix', () => {
  renderRow({ time: '17:00', kind: 'workout', label: 'Push A', state: 'pending' })
  expect(screen.getByText('Push A')).toBeInTheDocument()
  expect(screen.queryByText(/perc/)).toBeNull()
  expect(screen.queryByText(/undefined/)).toBeNull()
})

test('an activity row with a duration keeps the "· N perc" suffix', () => {
  renderRow({ time: '17:00', kind: 'workout', label: 'Push A', state: 'pending', duration: 60 })
  expect(screen.getByText('Push A · 60 perc')).toBeInTheDocument()
})

test('an activity row shows the kcal it contributed to the target', () => {
  const { container } = render(
    <ZoneSlotRow
      slot={{ time: '17:00', kind: 'workout', label: 'Pull Day', state: 'pending', duration: 90 }}
      {...defaults} burnKcal={510}
    />,
  )
  expect(container.querySelector('.zrow.act')).toBeInTheDocument()
  expect(screen.getByText('+510')).toBeInTheDocument()
  expect(screen.getByText(/kcal a célban/)).toBeInTheDocument()
})

test('a sport activity row uses the sport accent', () => {
  const { container } = render(
    <ZoneSlotRow slot={{ time: '20:00', kind: 'sport', label: 'Röplabda', state: 'pending', duration: 90 }} {...defaults} burnKcal={420} />,
  )
  expect(container.querySelector('.zrow.act.sport')).toBeInTheDocument()
})

test('an activity row with no computed burn prints no burn block', () => {
  render(<ZoneSlotRow slot={{ time: '17:00', kind: 'workout', label: 'Push A', state: 'pending' }} {...defaults} burnKcal={0} />)
  expect(screen.queryByText(/kcal a célban/)).toBeNull()
})

// ── Supplement rows (ported: items + 🌙) ──────────────────────────────────────
test('a supplement row lists its items and offers the stack as its destination', async () => {
  const onOpenStack = vi.fn()
  render(
    <ZoneSlotRow
      slot={{
        time: '21:30', kind: 'evening', label: 'Esti stack', state: 'pending',
        items: [
          { type: 'supplement', refId: 'mg', label: 'Magnézium · 300mg', done: false },
          { type: 'supplement', refId: 'o3', label: 'Omega-3 · 2g', done: true },
        ],
      }}
      {...defaults} onOpenStack={onOpenStack}
    />,
  )
  expect(screen.getByText(/Magnézium · 300mg/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Esti stack · Stack megnyitása' }))
  expect(onOpenStack).toHaveBeenCalled()
})

// ── Coach tagline + score chip (ported, mezo-mr4n) ────────────────────────────
const loggedSlot: FuelSlot = {
  time: '06:15', kind: 'meal', label: 'Reggeli', slotKey: 'breakfast', state: 'done',
  mealName: 'Zabkása', kcal: 520, p: 24, c: 70, f: 12,
}
const scored: FuelMeal = {
  id: 'm1', slot: 'Reggeli', title: 'Zabkása', score: 0.74, kcal: 520, p: 24, c: 70, f: 12,
  mealItems: [], items: [], tags: [], loggedAt: '2026-07-28T06:15:00', mealDate: '2026-07-28',
}

test('renders the coach tagline when a verdict exists', () => {
  render(<ZoneSlotRow slot={loggedSlot} {...defaults} tagline="Remek pre-workout üzemanyag" />)
  expect(screen.getByTestId('coach-tagline')).toHaveTextContent('Remek pre-workout üzemanyag')
})

test('renders a skeleton line while the coach verdict is in flight — the expensive call is visible', () => {
  const { container } = render(<ZoneSlotRow slot={loggedSlot} {...defaults} coachPending scoredMeal={scored} />)
  expect(container.querySelector('.coachline.sk')).toBeInTheDocument()
  expect(screen.queryByTestId('coach-tagline')).toBeNull()
})

test('renders no coach row at all when the coach is settled and silent', () => {
  const { container } = render(<ZoneSlotRow slot={loggedSlot} {...defaults} tagline={null} />)
  expect(container.querySelector('.coachline')).toBeNull()
  expect(screen.queryByTestId('coach-tagline')).toBeNull()
})

test('the score chip opens the score sheet for the scored meal', async () => {
  const onOpenScore = vi.fn()
  render(<ZoneSlotRow slot={loggedSlot} {...defaults} scoredMeal={scored} onOpenScore={onOpenScore} />)
  await userEvent.click(screen.getByRole('button', { name: 'AI score' }))
  expect(onOpenScore).toHaveBeenCalledWith(scored)
})

// ── Done-row marker: the score chip is the done indicator ONLY when a score exists (fix round 1) ──
test('a done row without a score renders a ✓ done marker', () => {
  const { container } = render(<ZoneSlotRow slot={loggedSlot} {...defaults} scoredMeal={null} />)
  expect(container.querySelector('.zv')).toHaveTextContent('✓')
  expect(screen.queryByRole('button', { name: 'AI score' })).toBeNull()
})

test('a done row WITH a score renders the score chip and no ✓ marker', () => {
  const { container } = render(<ZoneSlotRow slot={loggedSlot} {...defaults} scoredMeal={scored} />)
  expect(screen.getByRole('button', { name: 'AI score' })).toBeInTheDocument()
  expect(container.querySelector('.zv')).toBeNull()
})

// ── Anchored row: the hero owns this window's CTA (new) ───────────────────────
test('an anchored now row points at the hero and renders NO duplicate CTA', () => {
  const now: FuelSlot = { ...budgetWithSlotKey, state: 'now' }
  const { container } = render(<ZoneSlotRow slot={now} {...defaults} anchored onLogMeal={vi.fn()} onAiLog={vi.fn()} />)
  expect(container.querySelector('.zrow.anchor')).toBeInTheDocument()
  expect(screen.getByText(/a kártya fent/)).toBeInTheDocument()
  // Critical: a second `Ebéd logolása` button would collide with the hero's aria-label.
  expect(screen.queryByRole('button', { name: /logolása/ })).toBeNull()
})
