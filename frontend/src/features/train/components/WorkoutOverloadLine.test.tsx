import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { WorkoutOverloadLine } from '@/features/train/components/WorkoutOverloadLine'

// The two honesty tests restored from the retired PrepFejlodesPage.test.tsx
// (mezo-e1ii9 fix round 1): the overload tally's ONLY surface moved to the card
// list's head, and the contract that moved with it is that a load DROP is never
// folded into an up-count.
describe('WorkoutOverloadLine · overload honesty', () => {
  test('a drops-only day never claims overload, and shows the honest −súly chip', () => {
    render(<WorkoutOverloadLine overload={{ weightUp: 0, weightDown: 2, repUp: 0, hold: 3 }} />)
    expect(screen.queryByText(/Túlterhelés/)).toBeNull()
    expect(screen.queryByText(/\+súly/)).toBeNull()
    expect(screen.getByText(/Visszavett súlyok/)).toBeInTheDocument()
    expect(screen.getByText(/2× −súly/)).toBeInTheDocument()
    expect(screen.getByText(/A visszavett súly is a terv része — innen indul a következő emelkedés\./)).toBeInTheDocument()
    expect(screen.queryByText(/Ezek a gyakorlatok adják az XP-lökés nagyját ma\./)).toBeNull()
  })

  test('a mixed day shows both directions side by side', () => {
    render(<WorkoutOverloadLine overload={{ weightUp: 1, weightDown: 1, repUp: 0, hold: 2 }} />)
    expect(screen.getByText(/Túlterhelés/)).toBeInTheDocument()
    expect(screen.getByText(/1× \+súly/)).toBeInTheDocument()
    expect(screen.getByText(/1× −súly/)).toBeInTheDocument()
  })

  // Titanium global constraint: clay icons, never emojis (mezo-e1ii9 fix wave). The strip
  // first shipped with a ⚡ — the very artefact the parity matrix §21 row 11 lists for removal.
  test('the up-move headline wears a clay glyph, not an emoji', () => {
    const { container } = render(<WorkoutOverloadLine overload={{ weightUp: 2, weightDown: 0, repUp: 1, hold: 1 }} />)
    const title = container.querySelector('.wo-overload-title')
    expect(title?.textContent).toContain('Túlterhelés')
    expect(title?.textContent).not.toContain('⚡')
    expect(container.querySelector('use[href="#i-growth"]')).not.toBeNull()
  })

  test('honest empty: no summary, or a day that moves nothing, renders nothing', () => {
    const { container, rerender } = render(<WorkoutOverloadLine overload={null} />)
    expect(container.querySelector('.wo-overload')).toBeNull()
    rerender(<WorkoutOverloadLine overload={{ weightUp: 0, weightDown: 0, repUp: 0, hold: 5 }} />)
    expect(container.querySelector('.wo-overload')).toBeNull()
  })
})
