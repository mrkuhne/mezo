import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FormationCurve } from '@/features/me/components/FormationCurve'
import { toWeeks } from '@/features/me/components/HabitFormationHistory'

describe('FormationCurve', () => {
  it('draws nothing without a fitted curve — the caller owns the null state', () => {
    const { container } = render(<FormationCurve curveK={null} reps={3} thresholdPct={90} />)
    expect(container.querySelector('svg')).toBeNull()
  })

  it('puts the threshold line where the curve reaches it, not at the top of the frame', () => {
    const { container } = render(<FormationCurve curveK={0.03} reps={30} thresholdPct={90} />)
    const line = container.querySelector('.rt-curve-thr')!
    const y = Number(line.getAttribute('y1'))
    const svgTop = 14 // PAD_T
    expect(y).toBeGreaterThan(svgTop)
    // 90% of the plot height above the baseline — comfortably in the upper part, not AT the edge
    expect(y).toBeLessThan(40)
  })

  it('closes the uncertainty band into one filled shape', () => {
    const { container } = render(<FormationCurve curveK={0.03} reps={30} thresholdPct={90} />)
    const d = container.querySelector('.rt-curve-band')!.getAttribute('d')!
    expect(d.startsWith('M')).toBe(true)
    expect(d.endsWith('Z')).toBe(true)
    // exactly ONE move command: the return leg must be line segments, not a second subpath
    expect(d.match(/M/g)).toHaveLength(1)
  })

  it('splits the line into a solid past and a dashed projection', () => {
    const { container } = render(<FormationCurve curveK={0.03} reps={20} thresholdPct={90} />)
    expect(container.querySelector('.rt-curve-past')).not.toBeNull()
    expect(container.querySelector('.rt-curve-next')).not.toBeNull()
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
