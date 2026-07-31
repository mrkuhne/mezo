import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PhaseAverageCard } from '@/features/me/components/PhaseAverageCard'
import type { SleepEntry } from '@/data/types'

const night = (over: Partial<SleepEntry> = {}): SleepEntry => ({
  date: '2026-05-22', bedtime: '23:00', wakeup: '06:30', duration: 7.5, quality: 8,
  awakenings: 1, mealToSleep: 0, notes: null,
  inBedMin: 470, awakeMin: 20, lightMin: 200, remMin: 140, deepMin: 100, ...over,
})
const manual: SleepEntry = { ...night(), awakeMin: null, lightMin: null, remMin: null, deepMin: null }

describe('PhaseAverageCard', () => {
  it('renders nothing below three qualifying nights — no misleading average', () => {
    const { container } = render(<PhaseAverageCard entries={[night(), night(), manual]} windowDays={14} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('names how many nights the average rests on', () => {
    render(<PhaseAverageCard entries={[night(), night(), night(), manual]} windowDays={14} />)
    expect(screen.getByText(/3 éjszakából/)).toBeInTheDocument()
  })

  it('shows both reference rows', () => {
    render(<PhaseAverageCard entries={[night(), night(), night()]} windowDays={14} />)
    expect(screen.getAllByText(/ref \d+–\d+%/)).toHaveLength(2)
  })
})
