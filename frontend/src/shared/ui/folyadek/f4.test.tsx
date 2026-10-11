import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRef } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  Card, CeremonyCount, CeremonyReveal, CeremonyRoot, CupStage, DotsBtn, FootCol, Hero, OptionVessels, RangeBand, SheetGraphic,
  CEREMONY_MS, ratioStars, starState, useCeremonyPass, Btn, Caps, Pair, Row, RowEnd, St, TitleRow,
} from './index'

const KIT_CSS = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../../styles/folyadek-kit.css'), 'utf8')

describe('folyadék kit · F4 pieces', () => {
  it('RangeBand: liquid to lo, hatch on to hi, on a scale that ends at the next round step; ticks keep clear of the range', () => {
    const { container } = render(<RangeBand lo={70} hi={85} unit="perc" />)
    const root = container.querySelector('.fo-range')!
    expect(root).toHaveAttribute('aria-hidden', 'true')
    // max = ceil((85 + 8) / 30) * 30 = 120
    expect(root.querySelector('.t > i')).toHaveStyle({ width: `${(70 / 120) * 100}%` })
    expect(root.querySelector('.t > u')).toHaveStyle({ left: `${(70 / 120) * 100}%`, width: `${(15 / 120) * 100}%` })
    const labels = [...root.querySelectorAll('.ax > em')].map((e) => e.textContent)
    expect(labels).toEqual(['0', '30', '70–85 perc'])
  })

  it('RangeBand writes two labels when the range is wide enough, and is an empty vessel while pending', () => {
    const { container, rerender } = render(<RangeBand lo={30} hi={60} />)
    expect([...container.querySelectorAll('.ax > em.k')].map((e) => e.textContent)).toEqual(['30', '60'])
    rerender(<RangeBand pending />)
    expect(container.querySelector('.fo-range > .t')!.children).toHaveLength(0)
    expect(container.querySelector('.ax')).toBeNull()
  })

  it('OptionVessels: one pressed, each filled to what it means, the dashed line on every vessel', () => {
    const on = vi.fn()
    const { container } = render(
      <OptionVessels aria-label="Akarunk még?" value={1} onChange={on} line={64}
        items={[{ label: 'Kevés volt', pct: 34 }, { label: 'Pont jó', pct: 64 }, { label: 'Sok volt', pct: 100, color: 'var(--fo-bad)' }]} />,
    )
    const group = screen.getByRole('group', { name: 'Akarunk még?' })
    const b = [...group.querySelectorAll('button')]
    expect(b.map((x) => x.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false'])
    expect(b[1]).toHaveClass('on')
    expect(b[0]).toHaveStyle({ '--p': '34%', '--c': 'var(--dom)' })
    expect(b[2]).toHaveStyle({ '--c': 'var(--fo-bad)' })
    expect(container.querySelectorAll('.v > u')).toHaveLength(3)
    expect(container.querySelector('.v > u')).toHaveStyle({ bottom: '64%' })
    fireEvent.click(screen.getByRole('button', { name: 'Sok volt' }))
    expect(on).toHaveBeenCalledWith(2)
  })

  it('DotsBtn is a named button of three dots; inside a Hero it is the hero\'s direct child (the corner rule keys on that)', () => {
    const on = vi.fn()
    const { container } = render(<Hero verdict="Húzódzkodás"><DotsBtn aria-label="Húzódzkodás · további műveletek" onClick={on} /></Hero>)
    const btn = screen.getByRole('button', { name: 'Húzódzkodás · további műveletek' })
    expect(btn.querySelectorAll('i')).toHaveLength(3)
    expect(btn.parentElement).toBe(container.querySelector('.fo-hero'))
    fireEvent.click(btn)
    expect(on).toHaveBeenCalled()
  })

  it('FootCol stacks a button and a quiet line; SheetGraphic holds a nested kit piece untouched; Card gold', () => {
    const { container } = render(
      <>
        <FootCol sub="Röplabda · elmentve"><Btn>Vissza a mai napra</Btn></FootCol>
        <SheetGraphic note="2 / 4 szett kész"><Caps n={4} done={2} size="big" /></SheetGraphic>
        <Card gold data-testid="g" />
      </>,
    )
    expect(container.querySelector('.fo-fcol > .fo-btn')).not.toBeNull()
    expect(container.querySelector('.fo-fcol > .fo-fsub')).toHaveTextContent('Röplabda · elmentve')
    expect(container.querySelector('.fo-shg > .fo-caps.big')).not.toBeNull()
    expect(container.querySelector('.fo-shg > small')).toHaveTextContent('2 / 4 szett kész')
    expect(screen.getByTestId('g')).toHaveClass('fo-card', 'gold')
  })
})

describe('folyadék kit · the ceremony stage', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  it('starState / ratioStars: lit from a star\'s fifth, half from a tenth below it', () => {
    expect([0, 1, 2, 3, 4].map((i) => starState(i, 0.9))).toEqual(['lit', 'lit', 'lit', 'lit', 'half'])
    expect(ratioStars(0.9)).toBe(4.5)
    expect(ratioStars(1)).toBe(5)
    expect(ratioStars(0)).toBe(0)
    expect(ratioStars(0.5)).toBe(2.5)
  })

  function Stage({ ratio, settled, reducedMotion, spill }: { ratio: number; settled?: boolean; reducedMotion?: boolean; spill?: boolean }) {
    const pass = useCeremonyPass({ ratio, settled, reducedMotion })
    return (
      <CeremonyRoot pass={pass}>
        <CupStage pass={pass} label="Így sikerült" spill={spill}><CeremonyReveal beat={1}><p>Erős nap.</p></CeremonyReveal></CupStage>
        <CeremonyReveal beat={2}><CeremonyCount pass={pass} value={4193} /></CeremonyReveal>
      </CeremonyRoot>
    )
  }

  it('reduced motion paints the END state on the first render: level, stars, counters and every beat — no pass', () => {
    const raf = vi.fn()
    vi.stubGlobal('requestAnimationFrame', raf)
    const { container } = render(<Stage ratio={0.9} reducedMotion spill />)
    const root = container.querySelector('.fo-cer')!
    expect(root).toHaveClass('b1', 'b2', 'b3', 'told', 'inst')
    expect(container.querySelector('[data-cer-stage]')).toHaveStyle({ '--p': '0.9' })
    const stars = [...container.querySelectorAll('[data-cer-star]')]
    expect(stars.map((s) => s.className)).toEqual(['is-lit', 'is-lit', 'is-lit', 'is-lit', 'is-half'])
    expect(container.querySelector('[data-cer-count]')!.textContent!.replace(/\s/g, '')).toBe('4193')
    expect(container.querySelectorAll('.fo-cup .sp')).toHaveLength(5)
    expect(raf).not.toHaveBeenCalled()
  })

  it('a settled re-entry is the end state too; without a record nothing spills', () => {
    const { container } = render(<Stage ratio={0.5} settled />)
    expect(container.querySelector('.fo-cer')).toHaveClass('told', 'inst')
    expect(container.querySelectorAll('.fo-cup .sp')).toHaveLength(0)
  })

  it('ONE rAF pass drives level, stars, counters and beats; it lands on the end state and never restarts', () => {
    const frames: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { frames.push(cb); return frames.length })
    const step = (t: number) => act(() => { frames.shift()!(t) })
    const { container, rerender } = render(<Stage ratio={0.9} reducedMotion={false} />)
    const root = container.querySelector('.fo-cer')!
    const stage = container.querySelector<HTMLElement>('[data-cer-stage]')!
    const count = container.querySelector('[data-cer-count]')!
    expect(stage).toHaveStyle({ '--p': '0' })
    expect(count).toHaveTextContent('0')
    expect(root).not.toHaveClass('b1')
    expect(frames).toHaveLength(1)
    step(1000)                                   // t0
    step(1000 + CEREMONY_MS.stars)               // the stars part is over: the level is at the ratio
    expect(Number(stage.style.getPropertyValue('--p'))).toBeCloseTo(0.9, 5)
    expect(container.querySelectorAll('[data-cer-star].is-lit')).toHaveLength(4)
    expect(root).not.toHaveClass('b1')
    expect(count).toHaveTextContent('0')
    step(1000 + CEREMONY_MS.b2 + 10)             // the verdict and the numbers are in, the count has started
    expect(root).toHaveClass('b1', 'b2')
    expect(root).not.toHaveClass('b3')
    step(1000 + CEREMONY_MS.total)               // landed
    expect(root).toHaveClass('b1', 'b2', 'b3', 'told')
    expect(count.textContent!.replace(/\s/g, '')).toBe('4193')
    expect(frames).toHaveLength(0)
    rerender(<Stage ratio={0.9} reducedMotion={false} />)
    expect(frames).toHaveLength(0)
  })

  it('two stages on one page get different clip ids', () => {
    const { container } = render(<><Stage ratio={0.5} settled /><Stage ratio={0.6} settled /></>)
    const ids = [...container.querySelectorAll('clipPath')].map((c) => c.id)
    expect(new Set(ids).size).toBe(2)
    ids.forEach((id) => expect(id).toMatch(/^[a-zA-Z0-9_-]+$/))
  })
})

// The pieces the five in-workout areas each built locally, folded into the kit at integration (bible F2.4 / F3.6).
describe('folyadék kit · F4 integration folds', () => {
  it('TitleRow: the sub-page row of a chrome-free route — a named back button, the context line with the dot, the title as h1', () => {
    const back = vi.fn()
    const { container } = render(<TitleRow context="Pull Day · Okt 11" title="Edzés lezárva" backLabel="Bezárás" onBack={back} data-kalauz-anchor="session-start" />)
    const root = container.querySelector('.fo-ptop') as HTMLElement
    expect(root).toHaveAttribute('data-kalauz-anchor', 'session-start')
    expect(root).not.toHaveClass('sticky-top')
    expect(root.querySelector('.fo-trow > .fo-title > small > i')).toHaveAttribute('aria-hidden', 'true')
    expect(root.querySelector('small')).toHaveTextContent('Pull Day · Okt 11')
    const h1 = screen.getByRole('heading', { level: 1, name: 'Edzés lezárva' })
    // not a focus target unless the screen asks for it
    expect(h1).not.toHaveAttribute('tabindex')
    fireEvent.click(screen.getByRole('button', { name: 'Bezárás' }))
    expect(back).toHaveBeenCalledTimes(1)
  })

  it('TitleRow: `sticky` pins it, `mark` sits beside the title, `headingRef` makes the title a focus target; back says „Vissza" by default', () => {
    const ref = createRef<HTMLHeadingElement>()
    const { container } = render(
      <TitleRow sticky context="3 / 15 szett kész" title="Pull Day" onBack={() => {}} headingRef={ref} mark={<button type="button" className="fo-help" aria-label="Kalauz ehhez az oldalhoz">?</button>} />,
    )
    expect(container.querySelector('.fo-ptop')).toHaveClass('sticky-top')
    expect(screen.getByRole('button', { name: 'Vissza' })).toHaveClass('fo-back')
    expect(container.querySelector('.fo-h.sm > h1 + .fo-help')).not.toBeNull()
    expect(ref.current).toBe(screen.getByRole('heading', { level: 1 }))
    expect(ref.current).toHaveAttribute('tabindex', '-1')
  })

  it('TitleRow CSS: the back disc gets its 44px target and the pinned row its own frosted ground on ::before', () => {
    expect(KIT_CSS).toMatch(/\.fo-ptop \.fo-ib::after \{[^}]*inset: -1px/)
    expect(KIT_CSS).toMatch(/\.fo-ptop\.sticky-top::before \{[^}]*backdrop-filter/)
    // the row itself carries no backdrop-filter (it would capture fixed descendants — F1.6)
    expect(KIT_CSS).not.toMatch(/\.fo-ptop(\.sticky-top)? \{[^}]*backdrop-filter/)
  })

  it('RowEnd: a mark beside the capsules, or (`stack`) a pill over them — with nested kit pieces left alone', () => {
    const { container, rerender } = render(<Row title="Evezés" right={<RowEnd><Caps n={3} done={1} /></RowEnd>} />)
    const end = container.querySelector('.fo-row > .fo-rr') as HTMLElement
    expect(end).not.toHaveClass('cl')
    expect(end.querySelectorAll('.fo-caps > i')).toHaveLength(3)
    rerender(<Row title="Evezés" right={<RowEnd stack><St tone="warn">Rekord</St><Caps n={3} done={3} /></RowEnd>} />)
    const stacked = container.querySelector('.fo-rr.cl') as HTMLElement
    expect([...stacked.children].map((c) => c.className.split(' ')[0])).toEqual(['fo-st', 'fo-caps'])
    expect(KIT_CSS).toMatch(/\.fo-rr\.cl \{[^}]*flex-direction: column/)
  })

  it('Pair: a button tile can be switched off and carry data-*; a link tile is never disabled', () => {
    const add = vi.fn(); const fin = vi.fn()
    render(
      <Pair items={[
        { icon: 't-addex', label: 'Gyakorlat hozzáadása', disabled: true, onClick: add },
        { icon: 't-tick', label: 'Edzés befejezése', data: { 'data-finish': 'full' }, onClick: fin },
      ]} />,
    )
    const off = screen.getByRole('button', { name: 'Gyakorlat hozzáadása' })
    expect(off).toBeDisabled()
    fireEvent.click(off)
    expect(add).not.toHaveBeenCalled()
    const on = screen.getByRole('button', { name: 'Edzés befejezése' })
    expect(on).toBeEnabled()
    expect(on).toHaveAttribute('data-finish', 'full')
    fireEvent.click(on)
    expect(fin).toHaveBeenCalledTimes(1)
    expect(KIT_CSS).toMatch(/\.fo-pair > button:disabled \{[^}]*opacity/)
  })

  it('a sheet that ends in a text link: the link\'s 44px hit area has its room INSIDE the scroller (no stray scroll), 22px in all', () => {
    // `.fo-lk::after` reaches (44 - line height) / 2 ≈ 13px past the link; the scroller's own bottom padding holds it.
    const frame = /\.sheet\.fo-sheet \{ padding-bottom: calc\((\d+)px \+ env\(safe-area-inset-bottom, 0px\)\); \}/.exec(KIT_CSS)
    const scroller = /\.sheet\.fo-sheet > \.sheet-scroll \{ padding-bottom: (\d+)px; \}/.exec(KIT_CSS)
    expect(frame && scroller).toBeTruthy()
    expect(Number(scroller![1])).toBeGreaterThanOrEqual(13)
    expect(Number(frame![1]) + Number(scroller![1])).toBe(22)
  })
})
