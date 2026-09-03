import { render, screen } from '@testing-library/react'
import { StackDayArc, isSlotDone } from '@/features/fuel/components/StackDayArc'
import type { StackDayEntry, StackDaySlot } from '@/features/fuel/logic/projectStackDay'

function entry(over: Partial<StackDayEntry> & { name: string }): StackDayEntry {
  return {
    occurrenceId: over.name, pantryItemId: over.name, persistedZone: 'wake',
    dose: null, pinned: false, placementSource: 'rule', reason: null, dailyTotalHint: null,
    skippedToday: false, displacedToday: false, taken: false,
    ...over,
  }
}

function slot(over: Partial<StackDaySlot> & { zone: StackDaySlot['zone']; time: string }): StackDaySlot {
  return { label: over.zone, anchorNote: null, entries: [], ...over }
}

describe('isSlotDone', () => {
  test('true when every entry is taken', () => {
    expect(isSlotDone(slot({ zone: 'wake', time: '06:45', entries: [entry({ name: 'a', taken: true })] }))).toBe(true)
  })
  test('true when the only entry is skipped (not applicable today), even if not taken', () => {
    expect(isSlotDone(slot({ zone: 'pre_workout', time: '16:45', entries: [entry({ name: 'a', skippedToday: true })] }))).toBe(true)
  })
  test('false when any entry is neither taken nor skipped', () => {
    expect(isSlotDone(slot({ zone: 'evening', time: '21:00', entries: [entry({ name: 'a' })] }))).toBe(false)
  })
})

describe('StackDayArc', () => {
  const slots: StackDaySlot[] = [
    slot({ zone: 'wake', time: '06:45', entries: [entry({ name: 'D3', taken: true })] }),
    slot({ zone: 'pre_workout', time: '16:45', entries: [entry({ name: 'Koffein' })] }),
    slot({ zone: 'evening', time: '21:00', entries: [entry({ name: 'Mg' })] }),
  ]
  const now = new Date('2026-08-29T13:30:00')

  test('renders the wake→lefekvés eyebrow with the real anchors', () => {
    render(<StackDayArc slots={slots} wake="06:45" bed="23:00" nextIndex={1} now={now} />)
    expect(screen.getByText('Nap-ív · 06:45 → 23:00')).toBeInTheDocument()
  })

  test('the done zone gets a check mark, the next zone does not', () => {
    const { container } = render(<StackDayArc slots={slots} wake="06:45" bed="23:00" nextIndex={1} now={now} />)
    const dots = container.querySelectorAll('.stk-arc-dot')
    expect(dots[0]).toHaveClass('done')
    expect(dots[0]).toHaveTextContent('✓')
    expect(dots[1]).toHaveClass('next')
    expect(dots[1]).not.toHaveTextContent('✓')
    expect(dots[2]).toHaveClass('todo')
  })

  test('labels stagger above/below (alternating .alt class) in slot order', () => {
    const { container } = render(<StackDayArc slots={slots} wake="06:45" bed="23:00" nextIndex={1} now={now} />)
    const labels = [...container.querySelectorAll('.stk-arc-lbl')]
    expect(labels[0]).not.toHaveClass('alt')
    expect(labels[1]).toHaveClass('alt')
    expect(labels[2]).not.toHaveClass('alt')
  })

  test('the MA marker renders at the given now time', () => {
    render(<StackDayArc slots={slots} wake="06:45" bed="23:00" nextIndex={1} now={now} />)
    expect(screen.getByText('▏MA 13:30')).toBeInTheDocument()
  })
})
