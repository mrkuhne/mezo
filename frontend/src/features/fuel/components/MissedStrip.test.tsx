import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import type { FuelSlot } from '@/data/types'
import { MissedStrip } from '@/features/fuel/components/MissedStrip'

const missed = (over: Partial<FuelSlot> = {}): FuelSlot => ({
  time: '11:30', kind: 'snack', label: 'Tízórai', slotKey: 'snack', state: 'missed', kcal: 300, ...over,
})

test('renders nothing when no window was missed', () => {
  const { container } = render(<MissedStrip slots={[]} onLogMeal={vi.fn()} />)
  expect(container).toBeEmptyDOMElement()
})

test('names the missed window and retro-logs it', async () => {
  const slot = missed()
  const onLogMeal = vi.fn()
  render(<MissedStrip slots={[slot]} onLogMeal={onLogMeal} />)
  expect(screen.getByText(/Tízórai kimaradt/)).toBeInTheDocument()
  expect(screen.getByText(/300 kcal/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Tízórai pótlása' }))
  expect(onLogMeal).toHaveBeenCalledWith(slot)
})

test('counts the remaining missed windows instead of stacking strips', () => {
  render(<MissedStrip slots={[missed(), missed({ label: 'Reggeli', time: '09:15' })]} onLogMeal={vi.fn()} />)
  expect(screen.getByText(/\+1 másik/)).toBeInTheDocument()
  expect(screen.getAllByRole('button')).toHaveLength(1)
})
