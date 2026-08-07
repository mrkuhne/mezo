import { render } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import TodaySkeleton from '@/features/today/pages/TodaySkeleton'

describe('TodaySkeleton', () => {
  test('mirrors the island layout: one big island and two capsules in the sky', () => {
    const { container } = render(<TodaySkeleton />)
    expect(container.querySelector('.sky-islands')).toBeTruthy()
    expect(container.querySelectorAll('.isl')).toHaveLength(3)
    expect(container.querySelectorAll('.isl.isl-big')).toHaveLength(1)
  })

  test('is inert — no buttons, no tablist semantics', () => {
    const { container, queryByRole } = render(<TodaySkeleton />)
    expect(queryByRole('button')).toBeNull()
    expect(queryByRole('tablist')).toBeNull()
    expect(queryByRole('tab')).toBeNull()
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy()
  })

  // TrainTodaySkeleton precedent: `role="status"` makes the busy state an implicit
  // live region so it gets announced, not just marked `aria-busy`.
  test('is an announced live region', () => {
    const { getByRole } = render(<TodaySkeleton />)
    expect(getByRole('status')).toBeTruthy()
  })
})
