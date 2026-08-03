import { render, screen } from '@testing-library/react'
import { StackZoneCard } from '@/features/fuel/components/StackZoneCard'
import type { StackDayEntry, StackDaySlot } from '@/features/fuel/logic/projectStackDay'

// Coverage for the rest-day badge branch (review finding, mezo-vx9v Task 8): the literal badge
// strings for displaced vs skipped, the skipped row's disabled tick, and the precedence rule that
// displacedToday/skippedToday wins over BOTH 'auto' and a user pin's '📌' — a pinned pre_workout/
// post_workout occurrence can be simultaneously `pinned: true` and `displacedToday`/`skippedToday`
// on a rest day (projectStackDay copies `pinned` through independent of the skip/displace branch).

function entry(over: Partial<StackDayEntry> & { name: string }): StackDayEntry {
  return {
    occurrenceId: 'o1',
    pantryItemId: 'p1',
    persistedZone: 'pre_workout',
    dose: null,
    pinned: false,
    placementSource: 'rule',
    reason: null,
    dailyTotalHint: null,
    skippedToday: false,
    displacedToday: false,
    taken: false,
    ...over,
  }
}

function slotWith(e: StackDayEntry): StackDaySlot {
  return { zone: 'breakfast', time: '07:00', label: 'Reggeli', anchorNote: null, entries: [e] }
}

const noop = () => {}

test('a plain rule-placed, non-displaced entry badges "auto"', () => {
  render(<StackZoneCard slot={slotWith(entry({ name: 'Kreatin' }))} onToggleTaken={noop} onOpenEntry={noop} />)
  expect(screen.getByRole('button', { name: 'Kreatin beállítások' })).toHaveTextContent('auto')
})

test('a pinned, non-displaced entry badges "📌"', () => {
  render(<StackZoneCard slot={slotWith(entry({ name: 'Kreatin', pinned: true }))} onToggleTaken={noop} onOpenEntry={noop} />)
  expect(screen.getByRole('button', { name: 'Kreatin beállítások' })).toHaveTextContent('📌')
})

test('a displaced (not skipped) entry badges the literal "ma nincs edzés" string, no kimarad suffix', () => {
  render(<StackZoneCard slot={slotWith(entry({ name: 'Whey', displacedToday: true }))} onToggleTaken={noop} onOpenEntry={noop} />)
  const row = screen.getByRole('button', { name: 'Whey beállítások' })
  expect(row).toHaveTextContent('ma nincs edzés')
  expect(row.textContent).not.toContain('kimarad')
})

test('a skipped entry badges the literal "ma nincs edzés → kimarad" string', () => {
  render(<StackZoneCard slot={slotWith(entry({ name: 'Origin PWO', skippedToday: true }))} onToggleTaken={noop} onOpenEntry={noop} />)
  expect(screen.getByRole('button', { name: 'Origin PWO beállítások' })).toHaveTextContent('ma nincs edzés → kimarad')
})

test('a skipped row disables its tick button', () => {
  render(<StackZoneCard slot={slotWith(entry({ name: 'Origin PWO', skippedToday: true }))} onToggleTaken={noop} onOpenEntry={noop} />)
  expect(screen.getByRole('button', { name: 'Origin PWO bevétel' })).toBeDisabled()
})

test('a non-skipped row leaves its tick button enabled', () => {
  render(<StackZoneCard slot={slotWith(entry({ name: 'Whey', displacedToday: true }))} onToggleTaken={noop} onOpenEntry={noop} />)
  expect(screen.getByRole('button', { name: 'Whey bevétel' })).toBeEnabled()
})

test('displacedToday wins over a user pin — badges "ma nincs edzés", never "📌"', () => {
  const pinnedAndDisplaced = entry({ name: 'AAKG', pinned: true, displacedToday: true })
  render(<StackZoneCard slot={slotWith(pinnedAndDisplaced)} onToggleTaken={noop} onOpenEntry={noop} />)
  const row = screen.getByRole('button', { name: 'AAKG beállítások' })
  expect(row).toHaveTextContent('ma nincs edzés')
  expect(row.textContent).not.toContain('📌')
})

test('skippedToday wins over a user pin — badges "ma nincs edzés → kimarad", never "📌"', () => {
  const pinnedAndSkipped = entry({ name: 'Origin PWO', pinned: true, skippedToday: true })
  render(<StackZoneCard slot={slotWith(pinnedAndSkipped)} onToggleTaken={noop} onOpenEntry={noop} />)
  const row = screen.getByRole('button', { name: 'Origin PWO beállítások' })
  expect(row).toHaveTextContent('ma nincs edzés → kimarad')
  expect(row.textContent).not.toContain('📌')
})
