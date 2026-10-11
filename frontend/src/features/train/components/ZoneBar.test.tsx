import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { ZoneBar } from '@/features/train/components/ZoneBar'

const LM = { mev: 10, mav: 16, mrv: 20 }

describe('ZoneBar', () => {
  // Folyadék (mezo-n4wf5.3): the MV / MEV / MAV / MRV captions left the surface — the legend
  // above the rows says in words what the two waterlines and the rim mean.
  test('carries no landmark jargon', () => {
    const { container } = render(<ZoneBar landmark={LM} value={13} target={20} colorMuscle="back" label="Hát" />)
    expect(container.textContent).not.toMatch(/MEV|MAV|MRV|MV/)
  })

  test('exposes the position as an accessible meter, never as percent text', () => {
    const { container } = render(<ZoneBar landmark={LM} value={13} target={20} colorMuscle="back" label="Hát" />)
    const meter = screen.getByRole('meter', { name: 'Hát · heti szettek' })
    expect(meter).toHaveAttribute('aria-valuenow', '13')
    expect(meter).toHaveAttribute('aria-valuemax', '20') // the rim of the vessel is the weekly maximum
    expect(container.textContent).not.toMatch(/%/)
  })

  test('the level stands at value, a solid waterline at the growth floor and a dashed one at the target', () => {
    const { container } = render(<ZoneBar landmark={LM} value={12} target={16} colorMuscle="back" label="Hát" />)
    const level = container.querySelector('.fo-wlv > i') as HTMLElement
    const marks = [...container.querySelectorAll('.fo-wlv > u')] as HTMLElement[]
    expect(level.style.width).toBe('60%') // 12 / 20
    expect(marks).toHaveLength(2)
    expect(marks[0].style.left).toBe('50%') // mev 10 / 20
    expect(marks[0]).not.toHaveClass('d')
    expect(marks[1].style.left).toBe('80%') // target 16 / 20
    expect(marks[1]).toHaveClass('d')
  })

  test('a value past the rim is clamped inside the vessel', () => {
    const { container } = render(<ZoneBar landmark={LM} value={99} target={20} colorMuscle="back" label="Hát" />)
    expect((container.querySelector('.fo-wlv > i') as HTMLElement).style.width).toBe('100%')
  })
})
