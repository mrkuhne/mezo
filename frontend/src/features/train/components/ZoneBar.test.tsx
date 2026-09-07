import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { ZoneBar } from '@/features/train/components/ZoneBar'

const LM = { mev: 10, mav: 16, mrv: 22 }

describe('ZoneBar', () => {
  test('labels every landmark so the zones are readable', () => {
    render(<ZoneBar landmark={LM} value={13} target={22} colorMuscle="back" label="Hát" />)
    expect(screen.getByText('MEV 10')).toBeInTheDocument()
    expect(screen.getByText('MAV 16')).toBeInTheDocument()
    expect(screen.getByText('MRV 22')).toBeInTheDocument()
  })

  test('exposes the position as an accessible meter, never as percent text', () => {
    const { container } = render(<ZoneBar landmark={LM} value={13} target={22} colorMuscle="back" label="Hát" />)
    const meter = screen.getByRole('meter', { name: 'Hát · heti szettek' })
    expect(meter).toHaveAttribute('aria-valuenow', '13')
    expect(meter).toHaveAttribute('aria-valuemax', '24') // mrv + 2 headroom
    expect(container.textContent).not.toMatch(/%/)
  })

  test('the marker sits at value and the target line at target', () => {
    const { container } = render(<ZoneBar landmark={LM} value={12} target={16} colorMuscle="back" label="Hát" />)
    const marker = container.querySelector('.mz-zb-mk') as HTMLElement
    const targetLine = container.querySelector('.mz-zb-tg') as HTMLElement
    expect(marker.style.left).toBe('50%')      // 12 / 24
    expect(targetLine.style.left).toBe('66.66667%') // 16 / 24
  })

  test('a value past the scale is clamped inside the track', () => {
    const { container } = render(<ZoneBar landmark={LM} value={99} target={22} colorMuscle="back" label="Hát" />)
    expect((container.querySelector('.mz-zb-mk') as HTMLElement).style.left).toBe('100%')
  })
})
