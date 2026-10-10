import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FormationCurve, formationSeries } from '@/features/me/components/FormationCurve'
import { toWeeks } from '@/features/me/components/HabitFormationHistory'

describe('FormationCurve', () => {
  it('draws nothing without a fitted curve — the caller owns the null state', () => {
    const { container } = render(<FormationCurve curveK={null} reps={3} thresholdPct={90} />)
    expect(container.querySelector('svg')).toBeNull()
  })

  it('draws the repetitions done so far as a liquid surface, with the threshold as the target waterline', () => {
    const { container } = render(<FormationCurve curveK={0.03} reps={30} thresholdPct={90} />)
    const svg = container.querySelector('svg.fo-area')!
    expect(svg).not.toBeNull()
    // the dashed waterline sits ABOVE the surface's end: 30 repetitions at k=0.03 is ~59%, under 90%
    const target = svg.querySelector('path[stroke-dasharray]')!
    const targetY = Number(target.getAttribute('d')!.match(/^M[\d.]+ ([\d.]+)/)![1])
    const now = svg.querySelector('circle')!
    expect(targetY).toBeLessThan(Number(now.getAttribute('cy')))
    // …and the axis says REPETITIONS, the model's own unit
    expect(svg).toHaveTextContent('0 ismétlés')
    expect(svg).toHaveTextContent('30 ismétlés')
  })

  it('names itself for a screen reader with where the habit stands', () => {
    const { getByRole } = render(<FormationCurve curveK={0.03} reps={20} thresholdPct={90} />)
    expect(getByRole('img')).toHaveAccessibleName(/20 ismétlésnél tartasz/)
  })
})

describe('formationSeries', () => {
  it('starts at zero, rises monotonically and ends exactly on the curve at the repetitions done', () => {
    const series = formationSeries(0.03, 30)
    expect(series[0]).toBe(0)
    expect(series.every((v, i) => i === 0 || v > series[i - 1])).toBe(true)
    expect(series[series.length - 1]).toBeCloseTo((1 - Math.exp(-0.9)) * 100, 1)
  })

  it('never invents more samples than there are repetitions', () => {
    expect(formationSeries(0.03, 3)).toHaveLength(4)
    expect(formationSeries(0.03, 400)).toHaveLength(25)
  })
})

describe('toWeeks', () => {
  it('pads to whole weeks so every column has seven rows', () => {
    // 2026-07-01 is a Wednesday — the first column must be back-padded to its Monday.
    const weeks = toWeeks([
      { date: '2026-07-01', status: 'done' },
      { date: '2026-07-02', status: 'missed' },
    ])
    expect(weeks).toHaveLength(1)
    expect(weeks[0]).toHaveLength(7)
    expect(weeks[0][0].date).toBe('2026-06-29') // Monday
    expect(weeks[0][2].status).toBe('done')
    expect(weeks[0][3].status).toBe('missed')
    // padding days carry NO status — absence is not a miss
    expect(weeks[0][0].status).toBeNull()
  })

  it('is empty for a habit with no history at all', () => {
    expect(toWeeks([])).toEqual([])
  })
})
