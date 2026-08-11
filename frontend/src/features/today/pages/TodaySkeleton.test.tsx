import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import TodaySkeleton from '@/features/today/pages/TodaySkeleton'

describe('TodaySkeleton', () => {
  test('mirrors the tabs + band + view layout, inert', () => {
    const { container } = render(<TodaySkeleton />)
    expect(container.querySelector('.sky-islands')).toBeNull()
    expect(container.querySelectorAll('.segtab')).toHaveLength(0)   // inert: no buttons
    expect(container.querySelector('.daytabs')).toBeInTheDocument()
    expect(container.querySelector('.cb-band')).toBeInTheDocument()
    expect(container.querySelector('.dayview')).toBeInTheDocument()
    expect(container.querySelectorAll('button')).toHaveLength(0)
  })

  test('announces itself as a loading status', () => {
    render(<TodaySkeleton />)
    expect(screen.getByRole('status', { name: 'Betöltés' })).toBeInTheDocument()
  })
})
