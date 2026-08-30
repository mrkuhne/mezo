import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { WeekScoreRing } from './WeekScoreRing'
import { WeekTrendSpark } from './WeekTrendSpark'

describe('WeekScoreRing', () => {
  test('a scored period announces the score and lands on it (reduced motion in jsdom)', () => {
    render(<WeekScoreRing score={78} />)
    expect(screen.getByRole('img', { name: 'Pontszám: 78 / 100' })).toBeInTheDocument()
  })

  test('an unscored period says tanulom — never a zero ring', () => {
    render(<WeekScoreRing score={null} learningCaption="még gyűjtöm" />)
    expect(screen.getByRole('img', { name: 'Pontszám: tanulom' })).toBeInTheDocument()
    expect(screen.getByText('tanulom')).toBeInTheDocument()
    expect(screen.getByText('még gyűjtöm')).toBeInTheDocument()
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })
})

describe('WeekTrendSpark', () => {
  test('renders one bar per week and rings the viewed one', () => {
    const { container } = render(
      <WeekTrendSpark
        points={[
          { weekStart: '2026-05-11', score: 74 },
          { weekStart: '2026-05-18', score: 84 },
        ]}
        currentWeekStart="2026-05-18"
      />,
    )
    const bars = container.querySelectorAll('.wk-trend i')
    expect(bars).toHaveLength(2)
    expect(bars[0].className).toBe('sc-mid')
    expect(bars[1].className).toBe('sc-hi is-current')
  })

  test('no series renders nothing at all (honest absence, and the pre-F6.6 state)', () => {
    const { container } = render(<WeekTrendSpark points={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
