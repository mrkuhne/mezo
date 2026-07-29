import { render } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import TodaySkeleton from '@/features/today/pages/TodaySkeleton'

describe('TodaySkeleton', () => {
  test('mirrors the real layout: greeting block, three pills, hero and a todo card', () => {
    const { container } = render(<TodaySkeleton />)
    expect(container.querySelector('.greet')).toBeTruthy()
    expect(container.querySelectorAll('.dfs-pill')).toHaveLength(3)
    expect(container.querySelector('.todaycard')).toBeTruthy()
    expect(container.querySelector('.tdc')).toBeTruthy()
  })

  // Fix-round correction: FaceMorning always stacks TWO `.todaycard`s (chain hero +
  // briefing), and FaceEvening stacks two for most of its span (wind-down + ritual) —
  // a single hero placeholder under-reserved height on both, so the swap still
  // reflowed. Only FaceDay renders exactly one; see TodaySkeleton.tsx's header comment
  // for the accepted residual mismatch on that face (and the early evening slice).
  test('reserves height for TWO hero cards, matching FaceMorning/FaceEvening\'s common shape', () => {
    const { container } = render(<TodaySkeleton />)
    expect(container.querySelectorAll('.todaycard')).toHaveLength(2)
  })

  test('is inert — no buttons, no tablist semantics', () => {
    const { container, queryByRole } = render(<TodaySkeleton />)
    expect(queryByRole('button')).toBeNull()
    expect(queryByRole('tablist')).toBeNull()
    expect(queryByRole('tab')).toBeNull()
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy()
  })

  // TrainTodaySkeleton precedent: `role="status"` makes the busy state an implicit
  // live region so it gets announced, not just marked `aria-busy` for AT that already
  // polls the subtree.
  test('is an announced live region, like the TrainTodaySkeleton precedent', () => {
    const { getByRole } = render(<TodaySkeleton />)
    expect(getByRole('status')).toBeTruthy()
  })
})
