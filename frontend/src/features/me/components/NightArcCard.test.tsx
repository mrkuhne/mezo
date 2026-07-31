import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { NightArcCard } from '@/features/me/components/NightArcCard'
import type { SleepEntry } from '@/data/types'

const base: SleepEntry = {
  date: '2026-05-22', bedtime: '00:42', wakeup: '09:03', duration: 7.5,
  quality: 9, awakenings: 1, mealToSleep: 0, notes: null,
  inBedMin: 501, awakeMin: 52, lightMin: 206, remMin: 144, deepMin: 100,
  hypnogram: { bucketMin: 15, stages: 'ALDDLRRLDDLLRRRLDDLLRRLALDDLRRLRRR' },
}

describe('NightArcCard', () => {
  it('renders the arc with the bed and wake times pinned to the ends', () => {
    render(<NightArcCard entry={base} />)
    expect(screen.getByText('00:42')).toBeInTheDocument()
    expect(screen.getByText('09:03')).toBeInTheDocument()
  })

  it('draws one bar per bucket', () => {
    const { container } = render(<NightArcCard entry={base} />)
    expect(container.querySelectorAll('rect[data-stage]')).toHaveLength(34)
  })

  it('labels both halves of the night', () => {
    render(<NightArcCard entry={base} />)
    expect(screen.getByText(/Első fél/)).toBeInTheDocument()
    expect(screen.getByText(/Második fél/)).toBeInTheDocument()
  })

  it('states the norm before the number in the front-load sentence', () => {
    render(<NightArcCard entry={base} />)
    expect(screen.getByText(/normális minta/)).toBeInTheDocument()
  })

  it('carries the standing caption about what the height means', () => {
    render(<NightArcCard entry={base} />)
    expect(screen.getByText(/nem mért mélységet/)).toBeInTheDocument()
  })

  it('renders nothing without a hypnogram', () => {
    const { container } = render(<NightArcCard entry={{ ...base, hypnogram: null }} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when the sequence is out of alphabet', () => {
    const { container } = render(
      <NightArcCard entry={{ ...base, hypnogram: { bucketMin: 15, stages: 'ALDX' } }} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('omits the front-load sentence when there is too little deep sleep to speak of', () => {
    render(<NightArcCard entry={{ ...base, hypnogram: { bucketMin: 15, stages: 'ALLRRLLRR' } }} />)
    expect(screen.queryByText(/normális minta/)).not.toBeInTheDocument()
    expect(screen.getByText(/Első fél/)).toBeInTheDocument()
  })

  it('produces ascending hour labels across a pre-midnight bedtime (wrap guard)', () => {
    // 23:15 -> 34 buckets * 15min = 510min span, wakes at 07:45. Ticks must read
    // 00, 01, ... 07 in order, never wrapping back through 23 or going negative.
    const wrap: SleepEntry = {
      ...base,
      bedtime: '23:15',
      wakeup: '07:45',
      hypnogram: { bucketMin: 15, stages: 'ALDDLRRLDDLLRRRLDDLLRRLALDDLRRLRRR' },
    }
    const { container } = render(<NightArcCard entry={wrap} />)
    const labels = Array.from(container.querySelectorAll('text[data-hour-tick]')).map(
      el => el.textContent,
    )
    expect(labels.length).toBeGreaterThan(0)
    const numeric = labels.map(Number)
    // strictly ascending, and never re-crossing back to a value >= the bedtime hour (23)
    for (let i = 1; i < numeric.length; i++) {
      expect(numeric[i]).toBeGreaterThan(numeric[i - 1])
    }
    expect(numeric.every(h => h < 23)).toBe(true)
  })
})
