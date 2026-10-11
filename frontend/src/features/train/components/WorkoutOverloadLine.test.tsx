import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { WorkoutOverloadLine, overloadMoves, overloadParts } from '@/features/train/components/WorkoutOverloadLine'

// The two honesty tests restored from the retired PrepFejlodesPage.test.tsx
// (mezo-e1ii9 fix round 1): the overload tally's ONLY surface is one row of the
// Eligazítás („Ma itt lépünk előre", Folyadék mezo-n4wf5.4), and the contract that
// moved with it is that a load DROP is never folded into an up-count.
describe('WorkoutOverloadLine · overload honesty', () => {
  test('a drops-only day never claims overload, and shows the honest −súly chip', () => {
    render(<WorkoutOverloadLine overload={{ weightUp: 0, weightDown: 2, repUp: 0, hold: 3 }} />)
    expect(screen.queryByText(/Túlterhelés/)).toBeNull()
    expect(screen.queryByText(/\+súly/)).toBeNull()
    expect(screen.getByText(/Visszavett súlyok/)).toBeInTheDocument()
    expect(screen.getByText(/2× −súly/)).toBeInTheDocument()
    expect(screen.getByText(/A visszavett súly is a terv része — innen indul a következő emelkedés\./)).toBeInTheDocument()
    expect(screen.queryByText(/Ezeken a gyakorlatokon lépünk ma előre\./)).toBeNull()
  })

  test('a drops-only day is led by the down glyph', () => {
    const { container } = render(<WorkoutOverloadLine overload={{ weightUp: 0, weightDown: 2, repUp: 0, hold: 3 }} />)
    expect(container.querySelector('.fo-row .si use[href="#t-down"]')).not.toBeNull()
    expect(container.querySelector('use[href="#t-up"]')).toBeNull()
  })

  test('a mixed day shows both directions side by side', () => {
    render(<WorkoutOverloadLine overload={{ weightUp: 1, weightDown: 1, repUp: 0, hold: 2 }} />)
    expect(screen.getByText(/Túlterhelés/)).toBeInTheDocument()
    expect(screen.getByText(/1× \+súly/)).toBeInTheDocument()
    expect(screen.getByText(/1× −súly/)).toBeInTheDocument()
    expect(screen.getByText('Ezeken a gyakorlatokon lépünk ma előre.')).toBeInTheDocument()
  })

  test('every lever is spelled out in the shipped order, reps as „ism."', () => {
    expect(overloadParts({ weightUp: 2, weightDown: 1, repUp: 3, hold: 0 })).toEqual(['2× +súly', '3× +ism.', '1× −súly'])
    render(<WorkoutOverloadLine overload={{ weightUp: 2, weightDown: 1, repUp: 3, hold: 0 }} />)
    expect(screen.getByText('Túlterhelés · 2× +súly · 3× +ism. · 1× −súly')).toBeInTheDocument()
    expect(screen.queryByText(/\+rep/)).toBeNull()
  })

  // Sprite icons, never emojis (mezo-e1ii9 fix wave). The strip first shipped with a ⚡ — the
  // very artefact the parity matrix §21 row 11 lists for removal.
  test('the up-move headline is a kit row led by the sprite up-mark, not an emoji', () => {
    const { container } = render(<WorkoutOverloadLine overload={{ weightUp: 2, weightDown: 0, repUp: 1, hold: 1 }} />)
    const title = container.querySelector('.fo-row strong')
    expect(title?.textContent).toContain('Túlterhelés')
    expect(container.textContent).not.toContain('⚡')
    expect(container.querySelector('.fo-row .si use[href="#t-up"]')).not.toBeNull()
    // the old skin is gone
    expect(container.querySelector('[class*="wo-"], [class*="wos-"]')).toBeNull()
  })

  test('honest empty: no summary, or a day that moves nothing, renders nothing', () => {
    const { container, rerender } = render(<WorkoutOverloadLine overload={null} />)
    expect(container).toBeEmptyDOMElement()
    rerender(<WorkoutOverloadLine overload={{ weightUp: 0, weightDown: 0, repUp: 0, hold: 5 }} />)
    expect(container).toBeEmptyDOMElement()
    rerender(<WorkoutOverloadLine overload={undefined} />)
    expect(container).toBeEmptyDOMElement()
  })

  test('overloadMoves says the same thing the row does (the section heading follows it)', () => {
    expect(overloadMoves(null)).toBe(false)
    expect(overloadMoves(undefined)).toBe(false)
    expect(overloadMoves({ weightUp: 0, weightDown: 0, repUp: 0, hold: 5 })).toBe(false)
    expect(overloadMoves({ weightUp: 0, weightDown: 1, repUp: 0, hold: 0 })).toBe(true)
    expect(overloadMoves({ weightUp: 0, weightDown: 0, repUp: 1, hold: 0 })).toBe(true)
  })
})
