import { render } from '@testing-library/react'
import { Hero, Section, Card, Row, Bub, Badge, Drop } from './index'

describe('chrome', () => {
  it('Hero with actions renders the liquid action row', () => {
    const { container } = render(<Hero label="Mai állapot" verdict="Jó nap" sub="s" actions={<button>Mehet</button>} />)
    expect(container.querySelector('.fo-hero-acts')).not.toBeNull()
    expect(container.querySelector('.fo-hero')).toHaveAttribute('data-closed', 'false')
  })
  it('Hero without actions closes with the liquid strip', () => {
    const { container } = render(<Hero verdict="Jó nap" warn />)
    expect(container.querySelector('.fo-hero-acts')).toBeNull()
    expect(container.querySelector('.fo-hero')).toHaveAttribute('data-closed', 'true')
    expect(container.querySelector('.fo-hero')).toHaveClass('warn')
  })
  it('Section shows the numbered drop badge only when n is given', () => {
    const a = render(<Section n={2} title="Mai szintek" link="Mind" />)
    expect(a.container.querySelector('.fo-sec b')?.textContent).toBe('2')
    expect(a.getByText('Mind')).toBeInTheDocument()
    const b = render(<Section title="Nincs szám" />)
    expect(b.container.querySelector('.fo-sec b')).toBeNull()
  })
  it('Card merges the class name', () => {
    const { container } = render(<Card className="x">hi</Card>)
    expect(container.firstElementChild).toHaveClass('fo-card', 'x')
  })
  it('Row is a button only when clickable', () => {
    const on = vi.fn()
    const a = render(<Row title="T" sub="S" value="9" onClick={on} icon="t-sleep" />)
    const btn = a.container.querySelector('button.fo-row') as HTMLElement
    btn.click()
    expect(on).toHaveBeenCalled()
    const b = render(<Row title="T2" />)
    expect(b.container.querySelector('button')).toBeNull()
    expect(b.container.querySelector('div.fo-row')).not.toBeNull()
  })
  it('Bub wraps an icon', () => {
    const { container } = render(<Bub icon="t-heart" size={40} color="#D9A94E" />)
    expect(container.querySelector('.fo-bub svg')).not.toBeNull()
    expect(container.querySelector('.fo-bub')).toHaveStyle({ '--s': '40px' })
  })
  it('Badge maps member to glyph and colour exactly', () => {
    const map = { szunya: ['t-sleep', '#AB9FD2'], mocor: ['t-dumbbell', '#5B9BD5'], falat: ['t-bowl', '#6FB08A'],
      deru: ['t-heart', '#D9A94E'], mezo: ['t-orb', '#8C97A8'], szk: ['t-lens', '#8494A6'] } as const
    for (const [m, [glyph, color]] of Object.entries(map)) {
      const { container, unmount } = render(<Badge member={m as keyof typeof map} />)
      expect(container.querySelector('use')?.getAttribute('href')).toBe(`#${glyph}`)
      expect((container.querySelector('.fo-badge') as HTMLElement).style.getPropertyValue('--c')).toBe(color)
      unmount()
    }
  })
  it('Badge shows a level behind the glyph, a value chip, and the big form', () => {
    const a = render(<Badge member="falat" pct={40} value="3" />)
    expect(a.container.querySelector('.fo-badge')).toHaveClass('lv')
    expect(a.container.querySelector('.fo-badge > b')?.textContent).toBe('3')
    const b = render(<Badge member="mezo" size={120} value="64%" label="érettség" />)
    expect(b.container.querySelector('.fo-badge')).toHaveClass('big')
    expect(b.container.querySelector('.fo-badge strong')?.textContent).toBe('64%')
    expect(b.container.querySelector('.fo-badge small')?.textContent).toBe('érettség')
  })
  it('Drop gets a unique clip id per instance and the alive flag', () => {
    const { container } = render(<><Drop pct={57} color="#1877F2" alive /><Drop pct={30} color="#F2683A" /></>)
    const ids = [...container.querySelectorAll('clipPath')].map((c) => c.id)
    expect(new Set(ids).size).toBe(2)
    expect(ids.every((i) => !i.includes(':'))).toBe(true)
    const drops = container.querySelectorAll('.fo-drop')
    expect(drops[0]).toHaveClass('alive')
    expect(drops[1]).not.toHaveClass('alive')
  })
})
