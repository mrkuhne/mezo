import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import type { HeroWindow } from '@/features/fuel/logic/heroWindow'
import type { FuelSlot } from '@/data/types'
import { NowWindowCard } from '@/features/fuel/components/NowWindowCard'

const slot: FuelSlot = {
  time: '13:00', kind: 'meal', label: 'Ebéd', slotKey: 'lunch', state: 'now',
  mealName: 'Csirkés rizs bowl', suggestedRecipeId: 'r1', kcal: 900, p: 68, c: 105, f: 24,
}
const openHero: HeroWindow = { kind: 'open', slot, suggestion: true, why: 'Pull Day 17:00 — fuel' }

const renderCard = (hero: HeroWindow, handlers: Partial<Parameters<typeof NowWindowCard>[0]> = {}) => {
  const props = {
    hero, onLogMeal: vi.fn(), onAiLog: vi.fn(), onLogOther: vi.fn(), onLogEmpty: vi.fn(), ...handlers,
  }
  render(<NowWindowCard {...props} />)
  return props
}

test('an open suggestion hero shows the recipe, the why line and the window budget', () => {
  const { container } = render(
    <NowWindowCard hero={openHero} onLogMeal={vi.fn()} onAiLog={vi.fn()} onLogOther={vi.fn()} onLogEmpty={vi.fn()} />,
  )
  expect(container.querySelector('.nowcard')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Csirkés rizs bowl' })).toBeInTheDocument()
  expect(screen.getByText('Pull Day 17:00 — fuel')).toBeInTheDocument()
  expect(screen.getByText(/900/)).toBeInTheDocument()
  expect(screen.getByText('F 68')).toBeInTheDocument()
  expect(screen.getByText('13:00 óta')).toBeInTheDocument()
})

test('the primary CTA is slot-scoped so it cannot collide with the header log chip', async () => {
  const props = renderCard(openHero)
  const cta = screen.getByRole('button', { name: 'Ebéd logolása' })
  expect(cta).toHaveTextContent('Logolás')
  await userEvent.click(cta)
  expect(props.onLogMeal).toHaveBeenCalledWith(slot)
})

test('the AI button fires onAiLog for the open window', async () => {
  const props = renderCard(openHero)
  await userEvent.click(screen.getByRole('button', { name: 'Ebéd AI-logolása' }))
  expect(props.onAiLog).toHaveBeenCalledWith(slot)
})

test('the foot link logs something else into the same window', async () => {
  const props = renderCard(openHero)
  await userEvent.click(screen.getByRole('button', { name: 'Más ételt logolok az Ebéd ablakba' }))
  expect(props.onLogOther).toHaveBeenCalledWith(slot)
})

test('a suggestion-less open window asks what was eaten instead of naming a recipe', () => {
  const bare: FuelSlot = { ...slot, mealName: undefined, suggestedRecipeId: undefined }
  renderCard({ kind: 'open', slot: bare, suggestion: false, why: '900 kcal ebben az ablakban' })
  expect(screen.getByRole('heading', { name: 'Ebéd-ablak' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Ebéd logolása' })).toHaveTextContent('Mit ettél?')
})

test('the closed-day hero summarises and offers only a real affordance', async () => {
  const onLogEmpty = vi.fn()
  const { container } = render(
    <NowWindowCard
      hero={{ kind: 'closed', consumedKcal: 2940, targetKcal: 3010, doneCount: 5, totalCount: 5, proteinG: 178, proteinTargetG: 185 }}
      onLogMeal={vi.fn()} onAiLog={vi.fn()} onLogOther={vi.fn()} onLogEmpty={onLogEmpty}
    />,
  )
  expect(container.querySelector('.nowcard.closed')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: '2940 / 3010 kcal' })).toBeInTheDocument()
  expect(screen.getByText(/5\/5 ablak/)).toBeInTheDocument()
  expect(screen.getByText(/fehérje 178\/185 g/)).toBeInTheDocument()
  // No dead CTA: the day-closing view does not exist yet, so there is no "Napi zárás" button.
  expect(screen.queryByRole('button', { name: /napi zárás/i })).toBeNull()
  await userEvent.click(screen.getByRole('button', { name: 'Késői snack logolása' }))
  expect(onLogEmpty).toHaveBeenCalled()
})
