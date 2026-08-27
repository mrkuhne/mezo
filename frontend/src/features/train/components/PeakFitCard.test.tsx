import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { PeakDayFit } from '@/features/train/logic/peakWeekFit'
import { PeakFitCard } from '@/features/train/components/PeakFitCard'

describe('PeakFitCard', () => {
  it('renders null when there is nothing to flag', () => {
    const { container } = render(<PeakFitCard fits={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('collapsed: shows the count pill, hides the rows', () => {
    const fits: PeakDayFit[] = [
      { day: 'Szo', minutes: 104, direction: 'over' },
      { day: 'Sze', minutes: 38, direction: 'under' },
    ]
    render(<PeakFitCard fits={fits} />)
    expect(screen.getByText('2 nap')).toBeInTheDocument()
    expect(screen.queryByText(/vegyél el/)).not.toBeInTheDocument()
    expect(screen.queryByText(/férne még bele/)).not.toBeInTheDocument()
  })

  it('expanded: renders the over-day copy exactly', () => {
    render(<PeakFitCard fits={[{ day: 'Szo', minutes: 104, direction: 'over' }]} />)
    fireEvent.click(screen.getByRole('button', { name: /Csúcshét/i }))
    expect(screen.getByText('Szo: csúcshéten ~104 perc — vegyél el, vagy tedd át.')).toBeInTheDocument()
  })

  it('expanded: renders the under-day copy exactly', () => {
    render(<PeakFitCard fits={[{ day: 'Sze', minutes: 38, direction: 'under' }]} />)
    fireEvent.click(screen.getByRole('button', { name: /Csúcshét/i }))
    expect(screen.getByText('Sze: csúcshéten is csak ~38 perc — férne még bele inger.')).toBeInTheDocument()
  })

  it('never renders a red wash — over and under both share the same soft styling', () => {
    render(<PeakFitCard fits={[{ day: 'Szo', minutes: 104, direction: 'over' }]} />)
    const pill = screen.getByText('1 nap')
    expect(pill.style.background).not.toMatch(/error|red/i)
  })
})
