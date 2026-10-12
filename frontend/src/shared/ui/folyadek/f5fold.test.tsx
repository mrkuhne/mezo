// The pieces the nine Fuel areas built locally and the integration step folded into ONE recipe each (bible F2.4 / F3.6,
// mezo-n4wf5.5): the hero's graphic slot, a catalog sentence with a bold run, a note in a state tone, removable chips.
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Badge, Chips, Hero, Level, Note, RemoveChips } from './index'

const KIT_CSS = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../../styles/folyadek-kit.css'), 'utf8')

describe('Hero `graphic`: the graphic stands between the label and the verdict', () => {
  it('DOM order is label → graphic → verdict → sub → body → liquid row (what a screen reader walks)', () => {
    const { container } = render(
      <Hero label="Mai keret" verdict="Még 742 kcal fér bele." sub="s" graphic={<div data-testid="g"><Level pct={40} /></div>} actions={<button>Logolok</button>}>
        <p data-testid="body">body</p>
      </Hero>,
    )
    const hero = container.querySelector('.fo-hero')!
    expect(hero).toHaveClass('has-g')
    expect([...hero.children].map(c => c.getAttribute('data-testid') ?? c.className)).toEqual(
      ['fo-hero-lbl', 'g', 'fo-hero-verdict', 'fo-hero-sub', 'body', 'fo-hero-acts'])
  })

  it('a fragment of two graphics keeps its order, and a nested kit piece is not re-dressed', () => {
    const { container } = render(<Hero label="l" verdict="v" graphic={<><i data-testid="a" /><i data-testid="b" /></>} />)
    expect([...container.querySelector('.fo-hero')!.children].map(c => c.getAttribute('data-testid') ?? c.className))
      .toEqual(['fo-hero-lbl', 'a', 'b', 'fo-hero-verdict'])
  })

  it('without `graphic` nothing changes: no class, children after the text (Nap and Edzés heroes)', () => {
    const { container } = render(<Hero label="l" verdict="v"><span data-testid="c" /></Hero>)
    const hero = container.querySelector('.fo-hero')!
    expect(hero).not.toHaveClass('has-g')
    expect([...hero.children].map(c => c.getAttribute('data-testid') ?? c.className)).toEqual(['fo-hero-lbl', 'fo-hero-verdict', 'c'])
    expect(render(<Hero verdict="v" graphic={false} />).container.querySelector('.fo-hero')).not.toHaveClass('has-g')
  })

  it('with `left` the graphic stays inside the text column, under the label', () => {
    const { container } = render(<Hero label="l" verdict="v" left={<Badge member="mezo" size={64} />} graphic={<i data-testid="g" />} />)
    expect([...container.querySelector('.fo-hero-tx')!.children].map(c => c.getAttribute('data-testid') ?? c.className))
      .toEqual(['fo-hero-lbl', 'g', 'fo-hero-verdict'])
  })

  it('the kit rule lays the hero out as a column only when it carries a graphic', () => {
    expect(KIT_CSS).toMatch(/\.fo-hero\.has-g \{ display: flex; flex-direction: column; \}/)
  })
})

describe('Note `tone`, RemoveChips, Chips `plain`', () => {
  it('Note: a state tone is a class of the kit note, nothing else changes', () => {
    const { container } = render(<><Note>a</Note><Note tone="warn" role="alert">b</Note><Note tone="bad" className="x">c</Note></>)
    expect([...container.querySelectorAll('p')].map(p => p.className)).toEqual(['fo-note', 'fo-note warn', 'fo-note bad x'])
    expect(screen.getByRole('alert')).toHaveTextContent('b')
    expect(KIT_CSS).toMatch(/\.fo-note\.warn \{ color: var\(--fo-warn\); font-weight: 600; \}/)
    expect(KIT_CSS).toMatch(/\.fo-note\.bad \{ color: var\(--fo-bad\); \}/)
  })

  it('RemoveChips: one named button per chip, the × is decoration, a tap takes that chip off; the kit owns the 44 px area', () => {
    const off = vi.fn()
    const { container } = render(<RemoveChips items={[
      { key: 'meat', label: 'Hús', ariaLabel: 'Hús szűrő levétele', onRemove: () => off('meat') },
      { key: 'fish', label: <Level pct={10} />, ariaLabel: 'Hal szűrő levétele', onRemove: () => off('fish') },
    ]} />)
    const chips = [...container.querySelectorAll('.fo-rmc > button')]
    expect(chips).toHaveLength(2)
    expect(chips[0]).toHaveAccessibleName('Hús szűrő levétele')
    expect(chips[0].querySelector('b')).toHaveAttribute('aria-hidden', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Hal szűrő levétele' }))
    expect(off).toHaveBeenCalledWith('fish')
    // a nested kit piece is not re-dressed (bible F3.9): the rules address the chip's own children
    expect(KIT_CSS).toMatch(/\.fo-rmc > button::after \{[^}]*height: 44px/)
    expect(KIT_CSS).not.toMatch(/\.fo-rmc (span|b|i|div)\b/)
  })

  it('Chips `plain`: the word alone, without the leading drop', () => {
    const { container } = render(<><Chips items={['a']} /><Chips plain className="x" items={['b']} /></>)
    expect([...container.querySelectorAll('.fo-chips')].map(c => c.className)).toEqual(['fo-chips', 'fo-chips plain x'])
    expect(KIT_CSS).toMatch(/\.fo-chips\.plain > span::before \{ content: none; \}/)
  })
})
