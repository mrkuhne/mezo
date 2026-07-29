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

  test('is inert — no buttons, no tablist semantics', () => {
    const { container, queryByRole } = render(<TodaySkeleton />)
    expect(queryByRole('button')).toBeNull()
    expect(queryByRole('tablist')).toBeNull()
    expect(queryByRole('tab')).toBeNull()
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy()
  })
})
