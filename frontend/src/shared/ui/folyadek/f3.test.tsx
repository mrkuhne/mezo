import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Area, Box, Caps, DropsMeter, EmptyTank, FoSheetHead, InfoSheet, Legend, LevelMarks, Pair, Pour, SheetActs, Skel, Slider, Split, Stepper, Tags, Tubes, Vials, Btn } from './index'

describe('folyadék kit · F3 pieces', () => {
  it('Vials keep their defaults: no option classes, always a liquid, the 34px glyph', () => {
    const { container } = render(<Vials items={[{ label: 'Kalória', value: '0', pct: 0, icon: 't-flame' }]} />)
    expect(container.querySelector('.fo-vial')!.className).toBe('fo-vial')
    expect(container.querySelector('.fo-tube .l')).toHaveStyle({ '--p': '0%' })
    expect(container.querySelector('.fo-tube .wl')).toBeNull()
    expect(container.querySelector('.fo-vials')).not.toHaveClass('fo-tubes')
  })

  it('Tubes: waterline, ghost, hatch, over, now, sel, a custom node; a dry tube at zero, a sliver for any amount', () => {
    const on = vi.fn()
    const { container } = render(
      <Tubes aria-label="Hetek" gap={4} size="wk" items={[
        { label: '1.', value: 52, pct: 62, wl: 140, mark: 'MEV' },
        { label: '2.', value: 61, pct: 1, now: true, onClick: on, ariaLabel: '2. hét, most' },
        { label: '3.', pct: 0, ghost: true },
        { label: 'V', value: '–', pct: 0, hatch: true, node: <span data-testid="nd" /> },
        { label: '5.', value: 84, pct: 100, over: true, sel: true, note: 'csúcs' },
      ]} />,
    )
    const root = screen.getByRole('group', { name: 'Hetek' })
    expect(root).toHaveClass('fo-vials', 'fo-tubes', 'wk')
    expect(root).toHaveStyle({ gap: '4px' })
    const v = container.querySelectorAll('.fo-vial')
    expect(v[0].querySelector('.fo-tube')).toHaveStyle({ height: '112px' })
    expect(v[0].querySelector('.wl')).toHaveStyle({ bottom: '97%' })
    expect(v[1]).toHaveClass('now')
    expect(v[1].querySelector('.l')).toHaveStyle({ '--p': '3%' })
    fireEvent.click(screen.getByRole('button', { name: '2. hét, most' }))
    expect(on).toHaveBeenCalled()
    expect(v[2]).toHaveClass('ghost')
    expect(v[2].querySelector('.l')).toBeNull()
    expect(v[2].querySelector('b')).toBeNull()
    expect(v[3]).toHaveClass('hatch')
    expect(v[3].querySelector('.fo-tube-nd [data-testid="nd"]')).not.toBeNull()
    expect(v[4]).toHaveClass('over', 'sel')
    expect(v[4].querySelector('.ov')).not.toBeNull()
    expect(v[4].querySelector('small i')?.textContent).toBe('csúcs')
  })

  it('Caps: n capsules, the first `done` full, the current one half; sizes and the labelled week strip', () => {
    const { container, rerender } = render(<Caps n={4} done={2} cur={2} color="#123456" label="2 / 4 szett" />)
    const caps = screen.getByRole('img', { name: '2 / 4 szett' })
    expect(caps).toHaveStyle({ '--c': '#123456' })
    expect([...container.querySelectorAll('.fo-caps i')].map((i) => i.className)).toEqual(['f', 'f', 'h', ''])
    rerender(<Caps n={7} on={[0, 2, 4]} size="wide" labels={['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V']} />)
    expect(container.querySelector('.fo-caps')).toHaveClass('wide', 'wk')
    expect(container.querySelector('.fo-caps')).toHaveAttribute('aria-hidden', 'true')
    expect([...container.querySelectorAll('.fo-caps i')].filter((i) => i.className === 'f')).toHaveLength(3)
    expect(container.querySelectorAll('.fo-caps b')).toHaveLength(7)
    rerender(<Caps n={3} size="big" />)
    expect(container.querySelector('.fo-caps')).toHaveClass('big')
  })

  it('LevelMarks: a clamped level with solid / dashed waterlines and their labels', () => {
    const { container } = render(<LevelMarks pct={130} color="red" height={12} marks={[{ at: 80, label: 'MEV' }, { at: 150, dashed: true }]} />)
    expect(container.querySelector('.fo-wlv > i')).toHaveStyle({ width: '100%' })
    expect(container.querySelector('.fo-wlv')).toHaveStyle({ '--h': '12px' })
    const marks = container.querySelectorAll('.fo-wlv > u')
    expect(marks[0]).toHaveStyle({ left: '80%' })
    expect(marks[0].querySelector('em')?.textContent).toBe('MEV')
    expect(marks[1]).toHaveClass('d')
    expect(marks[1]).toHaveStyle({ left: '100%' })
  })

  it('Split: the coming liquid starts where the done one ends and never runs out of the vessel', () => {
    const { container } = render(<Split a={60} b={70} big />)
    expect(container.querySelector('.fo-split')).toHaveClass('big')
    expect(container.querySelector('.fo-split i')).toHaveStyle({ width: '60%' })
    expect(container.querySelector('.fo-split u')).toHaveStyle({ left: '60%', width: '40%' })
  })

  it('Pour: one layer per part with its number; thin strip without numbers; the dashed empty vessel', () => {
    const { container, rerender } = render(<Pour aria-label="16 szett" parts={[{ n: 4, color: 'red' }, { n: 3, color: 'blue', label: '3×' }]} />)
    expect(screen.getByRole('img', { name: '16 szett' })).toBeInTheDocument()
    const layers = container.querySelectorAll('.fo-pour i')
    expect(layers[0]).toHaveStyle({ '--c': 'red' })
    expect([...layers].map((l) => l.textContent)).toEqual(['4', '3×'])
    rerender(<Pour sm parts={[{ n: 4, color: 'red' }]} />)
    expect(container.querySelector('.fo-pour')).toHaveClass('sm')
    expect(container.querySelector('.fo-pour b')).toBeNull()
    rerender(<Pour parts={[]} empty="Még üres" />)
    expect(container.querySelector('.fo-pour')).toHaveClass('e')
    expect(container.textContent).toBe('Még üres')
  })

  it('Legend, DropsMeter, EmptyTank, Skel, Box, Tags', () => {
    const { container } = render(
      <>
        <Legend center items={[{ label: 'kész' }, { label: 'jön', kind: 'hatch', color: 'gold' }, { label: 'határ', kind: 'line' }, { label: 'múlt hét', kind: 'dash' }, { label: 'terv', kind: 'vessel' }]} />
        <DropsMeter n={2} color="red" />
        <EmptyTank icon="t-dumbbell" actions={<Btn>Új terv</Btn>}>Még nincs futó terved.</EmptyTank>
        <Skel blocks={[320, 130]} />
        <Box icon="t-info" title="Rear Delt Fly"><p>Ma óvatosan.</p></Box>
        <Tags items={['5 gyakorlat', { icon: 't-record', label: '3 medál' }, { left: <i data-testid="chip" />, label: 'Hát' }]} />
      </>,
    )
    expect(container.querySelector('.fo-lg')).toHaveClass('c')
    expect([...container.querySelectorAll('.fo-lg i')].map((i) => i.className)).toEqual(['', 'hatch', 'line', 'dash', 'vessel'])
    expect(screen.getByRole('img', { name: '2 / 3' }).querySelectorAll('i.f')).toHaveLength(2)
    expect(container.querySelector('.fo-ev p')?.textContent).toBe('Még nincs futó terved.')
    expect(container.querySelector('.fo-ev .fo-acts')).toHaveClass('center')
    expect(screen.getByRole('status', { name: 'Betöltés…' }).querySelectorAll('i')).toHaveLength(2)
    expect(container.querySelector('.fo-box .fo-bub')).not.toBeNull()
    expect(container.querySelector('.fo-box > div > b')?.textContent).toBe('Rear Delt Fly')
    expect([...container.querySelectorAll('.fo-tags span:not(.fo-bub)')].map((s) => s.className)).toEqual(['tx', 'ic', ''])
  })

  it('Stepper: named − / + buttons, bounds disable the ends; with a label it is a whole row', () => {
    const dec = vi.fn(), inc = vi.fn()
    const { container, rerender } = render(<Stepper label="Szettek" sub="gyakorlatonként" value="3" n={3} min={1} max={3} onDec={dec} onInc={inc} data-testid="st" />)
    expect(container.querySelector('[data-testid="st"]')).toHaveClass('fo-row')
    expect(screen.getByRole('group', { name: 'Szettek' })).toHaveClass('fo-stp')
    fireEvent.click(screen.getByRole('button', { name: 'Szettek csökkentése' }))
    expect(dec).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Szettek növelése' })).toBeDisabled()
    rerender(<Stepper name="Ismétlés" value="auto" auto onDec={dec} onInc={inc} decDisabled className="x" />)
    expect(container.querySelector('.fo-row')).toBeNull()
    expect(container.querySelector('.fo-stp')).toHaveClass('x')
    expect(container.querySelector('.fo-stp b')).toHaveClass('auto')
    expect(screen.getByRole('button', { name: 'Ismétlés csökkentése' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Ismétlés növelése' }))
    expect(inc).toHaveBeenCalledTimes(1)
  })

  it('Slider: a labelled range whose liquid follows the value, with „n / 10" beside it', () => {
    const on = vi.fn()
    const { container } = render(<Slider aria-label="Megélt terhelés (RPE)" value={7} onChange={on} />)
    const input = screen.getByRole('slider', { name: 'Megélt terhelés (RPE)' })
    expect(input.style.getPropertyValue('--p')).toMatch(/^66\.6/)
    expect(container.querySelector('.fo-rng b')?.textContent).toBe('7 / 10')
    fireEvent.change(input, { target: { value: '9' } })
    expect(on).toHaveBeenCalledWith(9)
  })

  it('Pair: two tiles, a button or a link; SheetActs: the primary and „Mégse"', () => {
    const a = vi.fn(), save = vi.fn(), cancel = vi.fn()
    render(
      <MemoryRouter>
        <Pair items={[{ icon: 't-dumbbell', small: 'Gyors indítás', label: 'Egyedi edzés', onClick: a }, { icon: 't-volley', label: 'Sport naplózása', to: '/train/sport' }]} />
        <SheetActs label="Mentés" onSave={save} onCancel={cancel} />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('button', { name: /Egyedi edzés/ }))
    expect(a).toHaveBeenCalled()
    expect(screen.getByRole('link', { name: 'Sport naplózása' })).toHaveAttribute('href', '/train/sport')
    fireEvent.click(screen.getByRole('button', { name: 'Mentés' }))
    fireEvent.click(screen.getByRole('button', { name: 'Mégse' }))
    expect(save).toHaveBeenCalled()
    expect(cancel).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Mentés' })).toHaveClass('fo-btn', 'grow')
  })

  it('FoSheetHead: with an eyebrow the × moves up beside it; `left` replaces the bubble; the old shape is unchanged', () => {
    const close = vi.fn()
    const { container, rerender } = render(<FoSheetHead eyebrow="Izomcsoportok" left={<i data-testid="chip" />} title="Hát" sub="10 szett" onClose={close} />)
    expect(container.querySelector('.fo-she span')?.textContent).toBe('Izomcsoportok')
    expect(container.querySelector('.fo-she .fo-x')).not.toBeNull()
    expect(container.querySelector('.fo-shh')).toHaveClass('mid')
    expect(container.querySelector('.fo-shh .fo-x')).toBeNull()
    expect(container.querySelector('.fo-shh [data-testid="chip"]')).not.toBeNull()
    expect(container.querySelector('.fo-shh .fo-bub')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Bezárás' }))
    expect(close).toHaveBeenCalled()
    rerender(<FoSheetHead icon="t-sleep" title="Alvás" onClose={close} />)
    expect(container.querySelector('.fo-she')).toBeNull()
    expect(container.querySelector('.fo-shh')!.className).toBe('fo-shh')
    expect(container.querySelector('.fo-shh .fo-x')).not.toBeNull()
  })

  it('InfoSheet: a light dialog named by its title, with the eyebrow and the copy; × closes it', async () => {
    const close = vi.fn()
    render(<InfoSheet eyebrow="Izomcsoportok" title="Mit mutat a sáv?" copy="A színes rész az elvégzett szett." onClose={close}><b>extra</b></InfoSheet>)
    const dialog = screen.getByRole('dialog', { name: 'Mit mutat a sáv?' })
    expect(dialog).toHaveClass('sheet', 'fo-sheet')
    expect(dialog.textContent).toContain('Izomcsoportok')
    expect(dialog.querySelector('.fo-txt')?.textContent).toBe('A színes rész az elvégzett szett.')
    expect(dialog.textContent).toContain('extra')
    fireEvent.click(screen.getByRole('button', { name: 'Bezárás' }))
    await waitFor(() => expect(close).toHaveBeenCalled())
  })

  it('Area: marks stand on the curve (now = ink point with a drop line, pr = a gold drop); min / max and colours are opt-in', () => {
    const { container, rerender } = render(<Area values={[1, 3, 2, 4]} />)
    expect(container.querySelector('.fo-area-now, .fo-area-pr')).toBeNull()
    expect(container.querySelector('stop')).toHaveAttribute('stop-color', 'var(--liq1)')
    rerender(<Area values={[1, 3, 2, 4]} min={0} max={8} color="#111111" color2="#222222" marks={[{ i: 3, label: 'most · 4', kind: 'now' }, { i: 1, label: 'csúcs', kind: 'pr' }, { i: 9, kind: 'pr' }]} />)
    expect(container.querySelectorAll('.fo-area-now')).toHaveLength(1)
    expect(container.querySelectorAll('.fo-area-pr')).toHaveLength(1)
    expect(container.querySelector('.fo-area-now text')?.textContent).toBe('most · 4')
    expect(container.querySelector('.fo-area-pr path')).toHaveAttribute('fill', 'var(--fo-gold)')
    expect(container.querySelector('stop')).toHaveAttribute('stop-color', '#111111')
    // with max = 8 the top value (4) sits at mid height, not at the top padding
    expect(Number(container.querySelector('.fo-area-now circle')!.getAttribute('cy'))).toBeGreaterThan(40)
  })
})
