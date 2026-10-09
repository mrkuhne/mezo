import { render } from '@testing-library/react'
import { Wave, Tank, Vials, Mini, Level, Fill, Area, Linked, Stream, PerDay } from './index'

const D = 'M0 0H10V10H0Z'

describe('vessels', () => {
  it('Wave draws an aria-hidden strip', () => {
    const { container } = render(<Wave color="#19C7C0" opacity={0.5} />)
    const svg = container.querySelector('svg.fo-wave')!
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg.querySelector('path')).toHaveAttribute('opacity', '0.5')
  })

  it('Level clamps to 0–100 and exposes it', () => {
    const { container, rerender } = render(<Level pct={140} />)
    expect(container.querySelector('.fo-level i')).toHaveStyle({ width: '100%' })
    rerender(<Level pct={-5} value="3" label="x" />)
    expect(container.querySelector('.fo-level i')).toHaveStyle({ width: '0%' })
    expect(container.querySelector('.fo-level b')?.textContent).toBe('3')
  })

  it('Mini clamps its level', () => {
    const { container } = render(<Mini pct={250} icon="t-sleep" value="7" label="ó" />)
    expect(container.querySelector('.fo-mini .t i')).toHaveStyle({ height: '100%' })
    expect(container.querySelector('.fo-mini b')?.textContent).toBe('7')
  })

  it('Tank keeps the liquid between 44 and 78 percent and fires the CTA', () => {
    const onCta = vi.fn()
    const { container, getByText } = render(<Tank pct={5} num="68" verdict="Jó nap" cta="Check-in" onCta={onCta} marks={[100, 50, 0]} />)
    expect(container.querySelector('.fo-tank-liq')).toHaveStyle({ height: '56%' })
    getByText('Check-in').click()
    expect(onCta).toHaveBeenCalled()
    expect(container.querySelectorAll('.fo-tank-marks span')).toHaveLength(3)
  })

  it('Vials render one tube per item with its own level and click', () => {
    const on = vi.fn()
    const { container } = render(
      <Vials items={[{ label: 'Kalória', value: '2 060', pct: 66, icon: 't-flame', color: '#1877F2', onClick: on }, { label: 'Alvás', value: '7 ó', pct: 130 }]} />,
    )
    const l = container.querySelectorAll('.fo-tube .l')
    expect(l).toHaveLength(2)
    expect(l[1]).toHaveStyle({ '--p': '100%' })
    ;(container.querySelector('.fo-vial') as HTMLElement).click()
    expect(on).toHaveBeenCalled()
  })

  it('gives every Fill its own clip and gradient id (bible trap 2)', () => {
    const { container } = render(<><Fill d={D} pct={50} /><Fill d={D} pct={50} /></>)
    const clips = [...container.querySelectorAll('clipPath')].map((c) => c.id)
    const grads = [...container.querySelectorAll('linearGradient')].map((c) => c.id)
    expect(new Set(clips).size).toBe(2)
    expect(new Set(grads).size).toBe(2)
    expect(clips.every((i) => !i.includes(':'))).toBe(true)
    expect(container.querySelector('g[clip-path]')?.getAttribute('clip-path')).toMatch(/^url\(#[^:]+\)$/)
  })

  it('Fill sets the stops as attributes per instance', () => {
    const { container } = render(<Fill d={D} pct={50} color="#123456" color2="#abcdef" />)
    const stops = container.querySelectorAll('stop')
    expect(stops[0]).toHaveAttribute('stop-color', '#123456')
    expect(stops[1]).toHaveAttribute('stop-color', '#abcdef')
  })

  it('Area gives each chart its own gradient id and a target line', () => {
    const { container } = render(<><Area values={[1, 3, 2, 4]} target={3} /><Area values={[1, 2]} /></>)
    const ids = [...container.querySelectorAll('linearGradient')].map((c) => c.id)
    expect(new Set(ids).size).toBe(2)
    expect(container.querySelectorAll('path[stroke-dasharray]')).toHaveLength(1)
  })

  it('Area survives a single value', () => {
    expect(() => render(<Area values={[3]} />)).not.toThrow()
  })

  it('Linked draws two communicating vessels with unique ids', () => {
    const { container } = render(<><Linked a={40} b={80} labelA="A" labelB="B" valueA="6,0" valueB="7,5" /><Linked a={1} b={2} labelA="C" labelB="D" /></>)
    const ids = [...container.querySelectorAll('clipPath')].map((c) => c.id)
    expect(new Set(ids).size).toBe(4)
    expect(container.textContent).toContain('6,0')
  })

  it('Stream marks the current item and routes clicks', () => {
    const on = vi.fn()
    const { container } = render(<Stream items={[{ time: '14:00', title: 'Check-in', now: true, onClick: on, right: 'Kitöltöm' }, { time: '18:00', title: 'Edzés' }]} />)
    const items = container.querySelectorAll('.fo-stream-item')
    expect(items[0]).toHaveClass('now')
    expect(items[1]).not.toHaveClass('now')
    ;(items[0] as HTMLElement).click()
    expect(on).toHaveBeenCalled()
  })

  it('PerDay renders a vessel per day, dashes the ones that argue against', () => {
    const { container } = render(<PerDay days={[{ label: '4.', pct: 50, group: 'a' }, { label: '5.', pct: 80, group: 'b', against: true }]} />)
    expect(container.querySelectorAll('.fo-perday .gv')).toHaveLength(2)
    expect(container.querySelectorAll('.fo-perday .gv.x')).toHaveLength(1)
  })

  it('never renders a progress ring anywhere', () => {
    const { container } = render(
      <><Tank pct={50} num="1" /><Vials items={[{ label: 'a', value: 1, pct: 3 }]} /><Mini pct={3} /><Level pct={3} /><Fill d={D} pct={3} /><Linked a={1} b={2} labelA="a" labelB="b" /></>,
    )
    expect(container.querySelector('circle[stroke-dasharray]')).toBeNull()
  })
})
