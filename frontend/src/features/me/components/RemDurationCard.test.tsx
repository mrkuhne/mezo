import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RemDurationCard } from '@/features/me/components/RemDurationCard'
import type { SleepEntry } from '@/data/types'

const base = {
  date: '2026-05-22', bedtime: '23:00', wakeup: '06:30', duration: 7.5, quality: 8,
  awakenings: 1, mealToSleep: 0, notes: null, inBedMin: 470, awakeMin: 20,
}
const short = (rem: number): SleepEntry => ({ ...base, lightMin: 150, remMin: rem, deepMin: 90 })
const long = (rem: number): SleepEntry => ({ ...base, lightMin: 210, remMin: rem, deepMin: 105 })

describe('RemDurationCard', () => {
  it('renders nothing without three nights on each side of the 7h line', () => {
    const { container } = render(<RemDurationCard entries={[short(100), short(110), long(150)]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('states the REM gap in minutes', () => {
    render(<RemDurationCard entries={[short(100), short(110), short(120), long(140), long(150), long(160)]} />)
    expect(screen.getByText(/40 perccel/)).toBeInTheDocument()
  })

  it('plots one dot per qualifying night', () => {
    const { container } = render(
      <RemDurationCard entries={[short(100), short(110), short(120), long(140), long(150), long(160)]} />,
    )
    expect(container.querySelectorAll('circle')).toHaveLength(6)
  })
})
