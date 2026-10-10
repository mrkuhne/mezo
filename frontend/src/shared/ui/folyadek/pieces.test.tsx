import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { DropChain, Jar, Msg, Pill, Row, Scale, Seg, Step, Tank, Tick } from './index'

describe('folyadék kit · F2 pieces', () => {
  it('Seg as tabs: a tablist, one selected tab, click and arrow keys move the selection', () => {
    function T() {
      const [v, set] = useState<'a' | 'b' | 'c'>('a')
      return <Seg tabs aria-label="Napszak" items={[{ key: 'a', label: 'Reggel' }, { key: 'b', label: 'Napközben', dot: true }, { key: 'c', label: 'Este' }]} value={v} onChange={set} />
    }
    render(<T />)
    expect(screen.getByRole('tablist', { name: 'Napszak' })).toBeInTheDocument()
    const tabs = screen.getAllByRole('tab')
    expect(tabs.map((t) => t.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false'])
    expect(tabs.map((t) => t.tabIndex)).toEqual([0, -1, -1])
    fireEvent.click(tabs[2])
    expect(screen.getByRole('tab', { name: 'Este' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Este' })).toHaveClass('on')
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Este' }), { key: 'ArrowRight' })
    expect(screen.getByRole('tab', { name: 'Reggel' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Reggel' })).toHaveFocus()
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Reggel' }), { key: 'ArrowLeft' })
    expect(screen.getByRole('tab', { name: 'Este' })).toHaveAttribute('aria-selected', 'true')
  })

  it('Seg without tabs: a group of pressed buttons, no tab roles', () => {
    const on = vi.fn()
    render(<Seg items={[{ key: 'x', label: 'Szokás-láncolás' }, { key: 'y', label: 'Négy törvény' }]} value="x" onChange={on} />)
    expect(screen.queryByRole('tab')).toBeNull()
    expect(screen.getByRole('button', { name: 'Szokás-láncolás' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Négy törvény' }))
    expect(on).toHaveBeenCalledWith('y')
  })

  it('Scale: a radiogroup of ten, the chosen one checked, vials below it filled; click and arrows pick', () => {
    const on = vi.fn()
    const { container } = render(<Scale aria-label="Energia" value={7} onPick={on} />)
    expect(screen.getByRole('radiogroup', { name: 'Energia' })).toBeInTheDocument()
    const radios = screen.getAllByRole('radio')
    expect(radios).toHaveLength(10)
    expect(radios.map((r) => r.getAttribute('aria-label'))).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'])
    expect(radios.filter((r) => r.getAttribute('aria-checked') === 'true')).toEqual([radios[6]])
    expect(container.querySelectorAll('button.f')).toHaveLength(6)
    expect(radios[6]).toHaveClass('a')
    expect(radios[6]).toHaveStyle({ '--k': '7' })
    expect(radios.filter((r) => r.tabIndex === 0)).toEqual([radios[6]])
    fireEvent.click(radios[2])
    expect(on).toHaveBeenLastCalledWith(3)
    fireEvent.keyDown(radios[6], { key: 'ArrowRight' })
    expect(on).toHaveBeenLastCalledWith(8)
    fireEvent.keyDown(radios[6], { key: 'ArrowLeft' })
    expect(on).toHaveBeenLastCalledWith(6)
  })

  it('Scale with no value: nothing checked, the first vial is the tab stop, arrows start from the ends', () => {
    const on = vi.fn()
    render(<Scale aria-label="Stressz" value={null} onPick={on} />)
    const radios = screen.getAllByRole('radio')
    expect(radios.some((r) => r.getAttribute('aria-checked') === 'true')).toBe(false)
    expect(radios[0].tabIndex).toBe(0)
    fireEvent.keyDown(radios[0], { key: 'ArrowRight' })
    expect(on).toHaveBeenLastCalledWith(1)
    fireEvent.keyDown(radios[0], { key: 'ArrowLeft' })
    expect(on).toHaveBeenLastCalledWith(10)
  })

  it('Row: a button when clickable, a div otherwise (the existing API)', () => {
    const on = vi.fn()
    const { container, rerender } = render(<Row icon="t-flame" title="Kalória" sub="1 040 van még" value="2 060" onClick={on} />)
    const row = container.querySelector('.fo-row')!
    expect(row.tagName).toBe('BUTTON')
    expect(row.querySelector('.chev')).not.toBeNull()
    fireEvent.click(row)
    expect(on).toHaveBeenCalledTimes(1)
    rerender(<Row icon="t-flame" title="Kalória" />)
    expect(container.querySelector('.fo-row')!.tagName).toBe('DIV')
    expect(container.querySelector('button')).toBeNull()
  })

  it('Row as="div": never a button around interactive children; the title part is the button', () => {
    const open = vi.fn(), tick = vi.fn(), del = vi.fn()
    const { container } = render(
      <Row as="div" state="now" className="x" left={<Tick on={false} label="Napfény · pipa" onClick={tick} />} title="Reggeli napfény" sub="10 perc"
        more={<i data-testid="more" />} onClick={open} right={<button type="button" onClick={del}>Törlés</button>} />,
    )
    const row = container.querySelector('.fo-row')!
    expect(row.tagName).toBe('DIV')
    expect(row).toHaveClass('now', 'x')
    expect(container.querySelector('button button')).toBeNull()
    expect(row.querySelector('.chev')).toBeNull()
    expect(row.querySelector('.g [data-testid="more"]')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Napfény · pipa' }))
    expect(tick).toHaveBeenCalledTimes(1)
    expect(open).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /Reggeli napfény/ }))
    expect(open).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Törlés' }))
    expect(del).toHaveBeenCalledTimes(1)
    expect(open).toHaveBeenCalledTimes(1)
  })

  it('Row: `left` stands before the icon slot, `right` suppresses the chevron', () => {
    const { container } = render(<Row left={<b data-testid="l" />} title="Sor" onClick={() => {}} right={<em>x</em>} />)
    const row = container.querySelector('.fo-row')!
    expect(row.firstElementChild).toHaveAttribute('data-testid', 'l')
    expect(row.querySelector('.chev')).toBeNull()
  })

  it('Step: the next step is marked, a step with its own button is not itself a button', () => {
    const on = vi.fn(), go = vi.fn()
    const { container } = render(<><Step now time="21:45" title="Lecsendesítés" onClick={on} right={<button type="button" onClick={go}>Indítom</button>} /><Step title="Villanyoltás" onClick={on} /></>)
    const steps = container.querySelectorAll('.fo-step')
    expect(steps[0]).toHaveClass('now')
    expect(steps[0].tagName).toBe('DIV')
    expect(steps[1].tagName).toBe('BUTTON')
    expect(container.querySelector('button button')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Indítom' }))
    expect(go).toHaveBeenCalledTimes(1)
    expect(on).not.toHaveBeenCalled()
  })

  it('DropChain: a drop with onClick is a labelled button, the others are not; states map to classes', () => {
    const on = vi.fn()
    const { container } = render(
      <DropChain items={[{ state: 'done', label: 'H' }, { state: 'now', label: 'K', ariaLabel: 'Kedd, ma', onClick: on }, { state: 'missed', ariaLabel: 'Szerda, kimaradt' }, {}]} />,
    )
    const drops = container.querySelectorAll('.fo-dr')
    expect([...drops].map((d) => d.tagName)).toEqual(['SPAN', 'BUTTON', 'SPAN', 'SPAN'])
    expect([...drops].map((d) => d.className)).toEqual(['fo-dr d', 'fo-dr now', 'fo-dr x', 'fo-dr'])
    expect(screen.getAllByRole('button')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Kedd, ma' }))
    expect(on).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('img', { name: 'Szerda, kimaradt' })).toBeInTheDocument()
    expect(container.querySelector('.fo-drops')).not.toHaveClass('big')
  })

  it('Tick: a pressed-state button with its label', () => {
    const on = vi.fn()
    const { rerender } = render(<Tick on={false} label="Gombakávé · pipa" onClick={on} />)
    const b = screen.getByRole('button', { name: 'Gombakávé · pipa' })
    expect(b).toHaveAttribute('aria-pressed', 'false')
    expect(b).not.toHaveClass('on')
    fireEvent.click(b)
    expect(on).toHaveBeenCalledTimes(1)
    rerender(<Tick on label="Gombakávé · pipa" onClick={on} />)
    expect(b).toHaveAttribute('aria-pressed', 'true')
    expect(b).toHaveClass('on')
  })

  it('Pill reports its pressed state', () => {
    render(<><Pill on>Energia</Pill><Pill>Hangulat</Pill></>)
    expect(screen.getByRole('button', { name: 'Energia' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Hangulat' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('Jar: the text turns white once the liquid reaches it (bible trap 8), an empty jar holds no liquid', () => {
    const { container, rerender } = render(<Jar pct={64} text="64" lid />)
    expect(container.querySelector('text')).toHaveAttribute('fill', '#fff')
    expect(container.querySelector('text')).toHaveAttribute('y', '90')
    expect(container.querySelectorAll('rect')).toHaveLength(2)
    rerender(<Jar pct={20} text="20" />)
    expect(container.querySelector('text')).toHaveAttribute('fill', 'var(--fo-ink)')
    expect(container.querySelector('text')).toHaveAttribute('y', '74')
    expect(container.querySelector('rect')).toBeNull()
    rerender(<Jar pct={0} />)
    expect(container.querySelector('.fo-fill-wv path')!.getAttribute('d')).toMatch(/^M-100 120 /)
  })

  it('Msg names the member by field and drops a meta that only repeats it', () => {
    const { container } = render(<><Msg member="szunya" meta="alvás · ma reggel">a</Msg><Msg member="falat" meta="étel">b</Msg><Msg member="szk">c</Msg></>)
    const nm = [...container.querySelectorAll('.nm')].map((n) => n.textContent)
    expect(nm).toEqual(['Alvásma reggel', 'Étkezésétrend', 'Szkeptikus'])
  })

  it('Tank: height, dusk tone, extra node, a clickable air area; the level is published for the base-level mark', () => {
    const on = vi.fn()
    const { container } = render(<Tank pct={66} num="87" height={430} tone="dusk" verdict="Jó nap." air="Hajnalban megírom." onAir={on} airLabel="Részletek" cta="Tovább" extra={<b data-testid="x" />} />)
    const tank = container.querySelector('.fo-tank') as HTMLElement
    expect(tank).toHaveClass('fo-dusk')
    expect(tank.style.height).toBe('430px')
    expect(tank.style.getPropertyValue('--fo-tank-lv')).toBe('66%')
    expect(tank.querySelector('[data-testid="x"]')).not.toBeNull()
    expect(tank.querySelector('.fo-tank-airs')).toHaveTextContent('Hajnalban megírom.')
    fireEvent.click(screen.getByRole('button', { name: 'Részletek' }))
    expect(on).toHaveBeenCalledTimes(1)
  })
})
