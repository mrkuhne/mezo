import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StackNextCard } from '@/features/fuel/components/StackNextCard'
import type { StackDayEntry, StackDaySlot } from '@/features/fuel/logic/projectStackDay'

function entry(over: Partial<StackDayEntry> & { name: string }): StackDayEntry {
  return {
    occurrenceId: over.name, pantryItemId: over.name, persistedZone: 'pre_workout',
    dose: null, pinned: false, placementSource: 'rule', reason: null, dailyTotalHint: null,
    skippedToday: false, displacedToday: false, taken: false,
    ...over,
  }
}

const noop = () => {}

test('shows the KÖVETKEZŐ eyebrow with zone, time and anchor note', () => {
  const slot: StackDaySlot = {
    zone: 'pre_workout', time: '16:45', label: 'Edzés előtt', anchorNote: 'edzés −45p',
    entries: [entry({ name: 'Koffein' })],
  }
  render(<StackNextCard slot={slot} kindOf={() => 'stimulant'} onToggleTaken={noop} onOpenEntry={noop} />)
  expect(screen.getByText('KÖVETKEZŐ · EDZÉS ELŐTT · 16:45 · edzés −45p')).toBeInTheDocument()
})

test('surfaces the entry-level reason as the "miért ide" note when present', () => {
  const slot: StackDaySlot = {
    zone: 'pre_workout', time: '16:45', label: 'Edzés előtt', anchorNote: 'edzés −45p',
    entries: [entry({ name: 'Koffein', reason: 'A koffein csúcs-hatása pont a szett-munkára esik.' })],
  }
  render(<StackNextCard slot={slot} kindOf={() => 'stimulant'} onToggleTaken={noop} onOpenEntry={noop} />)
  expect(screen.getByText('A koffein csúcs-hatása pont a szett-munkára esik.')).toBeInTheDocument()
})

test('falls back to the slot anchorNote when no entry carries a reason', () => {
  const slot: StackDaySlot = {
    zone: 'lunch', time: '13:00', label: 'Ebéd', anchorNote: 'étkezéshez kötve',
    entries: [entry({ name: 'Multivitamin' })],
  }
  render(<StackNextCard slot={slot} kindOf={() => 'supplement'} onToggleTaken={noop} onOpenEntry={noop} />)
  expect(screen.getByText('étkezéshez kötve')).toBeInTheDocument()
})

test('the big tick calls onToggleTaken with the entry', async () => {
  const onToggleTaken = vi.fn()
  const slot: StackDaySlot = {
    zone: 'evening', time: '21:00', label: 'Este', anchorNote: null,
    entries: [entry({ name: 'Magnézium' })],
  }
  render(<StackNextCard slot={slot} kindOf={() => 'supplement'} onToggleTaken={onToggleTaken} onOpenEntry={noop} />)
  await userEvent.click(screen.getByRole('button', { name: 'Magnézium bevétel' }))
  expect(onToggleTaken).toHaveBeenCalledWith(expect.objectContaining({ name: 'Magnézium' }))
})

test('a skipped entry disables the tick', () => {
  const slot: StackDaySlot = {
    zone: 'pre_workout', time: '16:45', label: 'Edzés előtt', anchorNote: null,
    entries: [entry({ name: 'Origin PWO', skippedToday: true })],
  }
  render(<StackNextCard slot={slot} kindOf={() => 'stimulant'} onToggleTaken={noop} onOpenEntry={noop} />)
  expect(screen.getByRole('button', { name: 'Origin PWO bevétel' })).toBeDisabled()
})

test('tapping the label calls onOpenEntry with the entry', async () => {
  const onOpenEntry = vi.fn()
  const slot: StackDaySlot = {
    zone: 'evening', time: '21:00', label: 'Este', anchorNote: null,
    entries: [entry({ name: 'Magnézium' })],
  }
  render(<StackNextCard slot={slot} kindOf={() => 'supplement'} onToggleTaken={noop} onOpenEntry={onOpenEntry} />)
  await userEvent.click(screen.getByRole('button', { name: 'Magnézium beállítások' }))
  expect(onOpenEntry).toHaveBeenCalledWith(expect.objectContaining({ name: 'Magnézium' }))
})

test('the kind dot reflects the resolved supplement type', () => {
  const slot: StackDaySlot = {
    zone: 'evening', time: '21:00', label: 'Este', anchorNote: null,
    entries: [entry({ name: 'Retatrutid' })],
  }
  const { container } = render(<StackNextCard slot={slot} kindOf={() => 'medication'} onToggleTaken={noop} onOpenEntry={noop} />)
  expect(container.querySelector('.stk-kdot')).toHaveClass('stk-k-lav')
})
