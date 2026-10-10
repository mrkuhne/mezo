import { fireEvent, render, screen } from '@testing-library/react'
import { createRef, useState } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { Badge, Big, Card, DropChain, Hero, Input, Jar, Mark, Msg, Pill, Row, Scale, Seg, Select, St, Step, Tank, TextArea, Tick, Vials, Why } from './index'

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

  it('Hero: `left` puts a graphic beside label + verdict + sub; the body and the liquid row stay full width; rest props reach the section', () => {
    const { container, rerender } = render(
      <Hero className="x" role="group" aria-label="Kímélő mód" data-kalauz-anchor="h" data-testid="hero" warn left={<Badge member="mezo" size={64} />}
        label={<>Mezo · <b>ma</b></>} verdict="Három új üzenet." sub="Kettő választ vár." actions={<button type="button">Megnyitom</button>}>
        <i data-testid="body" />
      </Hero>,
    )
    const hero = screen.getByTestId('hero')
    expect(hero).toHaveClass('fo-card', 'fo-hero', 'warn', 'x')
    expect(hero).toHaveAttribute('data-kalauz-anchor', 'h')
    expect(screen.getByRole('group', { name: 'Kímélő mód' })).toBe(hero)
    const row = hero.firstElementChild!
    expect(row).toHaveClass('fo-hero-row')
    expect(row.querySelector('.fo-hero-left .fo-badge')).not.toBeNull()
    expect([...row.querySelector('.fo-hero-tx')!.children].map((c) => c.className)).toEqual(['fo-hero-lbl', 'fo-hero-verdict', 'fo-hero-sub'])
    expect(row.querySelector('.fo-hero-lbl b')).toHaveTextContent('ma')
    expect(row.nextElementSibling).toHaveAttribute('data-testid', 'body')
    expect(hero.lastElementChild).toHaveClass('fo-hero-acts')
    rerender(<Hero verdict="Nincs adat." />)
    expect(container.querySelector('.fo-hero-row')).toBeNull()
    expect(container.querySelector('.fo-hero > .fo-hero-verdict')).not.toBeNull()
    expect(container.querySelector('.fo-hero')).toHaveAttribute('data-closed', 'true')
  })

  it('Card hands a ref and its attributes to the section', () => {
    const ref = createRef<HTMLElement>()
    render(<Card ref={ref} id="c" data-testid="card" />)
    expect(ref.current).toBe(screen.getByTestId('card'))
    expect(ref.current?.tagName).toBe('SECTION')
  })

  it('Row passes data-* / id to its root and aria-* to the interactive element', () => {
    const { rerender } = render(<Row title="Korábbi üzenet" onClick={() => {}} data-testid="r" id="row1" aria-expanded={false} aria-describedby="d" aria-pressed />)
    const row = screen.getByTestId('r')
    expect(row.tagName).toBe('BUTTON')
    expect(row).toHaveAttribute('id', 'row1')
    expect(row).toHaveAttribute('aria-expanded', 'false')
    expect(row).toHaveAttribute('aria-describedby', 'd')
    expect(row).toHaveAttribute('aria-pressed', 'true')
    rerender(<Row as="div" title="Reggeli fény" onClick={() => {}} data-testid="r" data-rope="linked" aria-label="Reggeli fény · kész" right={<i />} />)
    const div = screen.getByTestId('r')
    expect(div.tagName).toBe('DIV')
    expect(div).toHaveAttribute('data-rope', 'linked')
    expect(div).not.toHaveAttribute('aria-label')
    expect(screen.getByRole('button', { name: 'Reggeli fény · kész' })).toHaveClass('fo-row-main')
    rerender(<Row title="Sima sor" data-testid="r" role="listitem" />)
    expect(screen.getByRole('listitem')).toHaveAttribute('data-testid', 'r')
  })

  it('Row with `to` is a real link with the chevron', () => {
    render(<MemoryRouter><Row to="/nap/rutin/epites" icon="t-chain" title="Rutinok szerkesztése" sub="láncok, szokások" data-testid="r" /></MemoryRouter>)
    const link = screen.getByRole('link', { name: /Rutinok szerkesztése/ })
    expect(link).toHaveAttribute('href', '/nap/rutin/epites')
    expect(link).toHaveClass('fo-row')
    expect(link).toHaveAttribute('data-testid', 'r')
    expect(link.querySelector('.chev')).not.toBeNull()
    expect(link.querySelector('button')).toBeNull()
  })

  it('Why, Seg, Step and Tank hand their attributes on', () => {
    render(
      <>
        <Why icon="t-info" data-testid="why" role="note">Váltásnál elveszik.</Why>
        <Seg data-testid="seg" data-kalauz-anchor="tabs" aria-label="Fülek" items={[{ key: 'a', label: 'A' }]} value="a" onChange={() => {}} />
        <Step data-testid="step" title="Lecsendesítés" aria-current="step" />
        <Tank data-testid="tank" role="group" aria-label="Pontszám: 87 / 100" pct={66} num="87" marks={[75, 50, 25]} cap="a 100-ból" />
      </>,
    )
    expect(screen.getByTestId('why')).toHaveClass('fo-why')
    expect(screen.getByRole('note')).toBe(screen.getByTestId('why'))
    expect(screen.getByRole('group', { name: 'Fülek' })).toHaveAttribute('data-kalauz-anchor', 'tabs')
    expect(screen.getByTestId('step')).toHaveAttribute('aria-current', 'step')
    expect(screen.getByRole('group', { name: 'Pontszám: 87 / 100' })).toHaveClass('fo-tank')
    expect(screen.getByTestId('tank').querySelector('.fo-tank-n')).toHaveClass('has-marks')
  })

  it('Tank: a disabled CTA stays in place and does not answer', () => {
    const on = vi.fn()
    render(<Tank pct={60} num="87" cta="Indítás…" onCta={on} ctaDisabled />)
    const cta = screen.getByRole('button', { name: /Indítás/ })
    expect(cta).toBeDisabled()
    fireEvent.click(cta)
    expect(on).not.toHaveBeenCalled()
  })

  it('Vials: `pressed` is announced on the vial button; a mark the liquid stands behind turns white', () => {
    const { container } = render(
      <Vials height={100} items={[
        { label: 'Fehérje', value: '148 g', pct: 100, mark: 'kész', pressed: true, onClick: () => {} },
        { label: 'Szénhidrát', value: '210 g', pct: 78, mark: '✓', pressed: false, onClick: () => {} },
        { label: 'Zsír', value: '60 g', pct: 77, mark: 'most', onClick: () => {} },
        { label: 'Rost', value: '12 g', pct: 100 },
      ]} />,
    )
    const vials = [...container.querySelectorAll('.fo-vial')]
    expect(vials.map((v) => v.getAttribute('aria-pressed'))).toEqual(['true', 'false', null, null])
    expect(vials.map((v) => v.querySelector('em')?.className ?? null)).toEqual(['on', 'on', '', null])
  })

  it('the text field is one recipe for input, textarea and select', () => {
    const ref = createRef<HTMLTextAreaElement>()
    render(<><Input aria-label="Név" className="x" defaultValue="Gombakávé" /><TextArea ref={ref} aria-label="Jegyzet" rows={3} /><Select aria-label="Napszak"><option>Reggel</option></Select></>)
    expect(screen.getByRole('textbox', { name: 'Név' })).toHaveClass('fo-in', 'x')
    expect(screen.getByRole('textbox', { name: 'Jegyzet' })).toHaveClass('fo-in')
    expect(ref.current).toBe(screen.getByRole('textbox', { name: 'Jegyzet' }))
    expect(screen.getByRole('combobox', { name: 'Napszak' })).toHaveClass('fo-in')
  })

  it('Big: the numeral with its unit and note; a button when clickable; the side slots', () => {
    const on = vi.fn()
    const { container, rerender } = render(<Big data-testid="v" value="7" unit="/ 10" left={<Jar pct={70} />} right={<i data-testid="end" />} />)
    const row = container.querySelector('.fo-bigrow')!
    expect(row.firstElementChild).toHaveClass('fo-jar')
    expect(screen.getByTestId('v').tagName).toBe('SPAN')
    expect(screen.getByTestId('v')).toHaveClass('fo-big')
    expect(screen.getByTestId('v')).toHaveTextContent('7/ 10')
    expect(row.querySelector('.fo-big-end [data-testid="end"]')).not.toBeNull()
    rerender(<Big value="2 060" unit="kcal ma" note="1,2 l a 2,5 l-ből" aria-label="Teljes energiabevitel megjelenítése" onClick={on} />)
    const b = screen.getByRole('button', { name: 'Teljes energiabevitel megjelenítése' })
    expect(b).toHaveClass('fo-big')
    expect(b.querySelector('small')).toHaveTextContent('kcal ma')
    expect(b.querySelector('em')).toHaveTextContent('1,2 l a 2,5 l-ből')
    fireEvent.click(b)
    expect(on).toHaveBeenCalledTimes(1)
  })

  it('Mark can take the size of a tick; St keeps its tone class', () => {
    const { container } = render(<><Mark state="done" size="tick" /><Mark state="empty" /><St tone="ok">Kész</St></>)
    expect([...container.querySelectorAll('.fo-mk')].map((m) => m.className)).toEqual(['fo-mk d tk', 'fo-mk'])
    expect(screen.getByText('Kész')).toHaveClass('fo-st', 'ok')
  })
})
