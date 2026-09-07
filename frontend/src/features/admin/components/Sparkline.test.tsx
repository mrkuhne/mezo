import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Sparkline } from '@/features/admin/components/Sparkline'

// Resting-state guard (mezo-d5iy.11 spec requirement — Task 8's fixed defect must not
// reappear): the `.ad-spark` CSS only ANIMATES under a `.mz-play` ancestor (EntranceGroup,
// armed once per mount) — the graphic itself must be fully present in the DOM regardless of
// whether that ancestor class is there. Rendered with NO EntranceGroup/`.mz-play` wrapper at
// all (the worst case: a tile whose entrance choreography never fires, e.g. a hidden tab that
// mounts after the page's own play class has already been consumed, or a print view), so this
// asserts the line/dot are drawn, not merely that the animation classes exist.
describe('Sparkline (resting state, no .mz-play ancestor)', () => {
  it('draws the full line and dot even without an entrance wrapper', () => {
    const { container } = render(<Sparkline points={[1, 4, 2, 8, 5]} tone="coral" ariaLabel="Teszt · 30 nap" />)
    const svg = container.querySelector('svg.ad-spark')
    expect(svg).not.toBeNull()
    const polyline = container.querySelector('polyline.ln')
    expect(polyline).not.toBeNull()
    // 5 input points -> 5 "x,y" pairs, never empty/collapsed
    expect(polyline!.getAttribute('points')!.trim().split(/\s+/)).toHaveLength(5)
    const dot = container.querySelector('circle.dot')
    expect(dot).not.toBeNull()
    expect(dot!.getAttribute('cx')).not.toBeNull()
  })

  it('still renders a (empty but valid) chart for an empty series instead of throwing', () => {
    const { container } = render(<Sparkline points={[]} tone="sage" ariaLabel="Üres · 30 nap" />)
    expect(container.querySelector('svg.ad-spark')).not.toBeNull()
  })
})
