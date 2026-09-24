import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  CollapsibleStrip,
  MCells,
  Mosaic,
  MozaikPage,
  PageBody,
  PageHead,
  PageHero,
  StatCell,
  StatStrip,
  Tile,
} from '@/shared/ui/mozaik'

// Mozaik 2.0 primitives (mezo-d20.1.3) — the design_2.0 tile language as shared
// components. CSS values are the prototype's, ×1.18 (330→390px frame scale).

test('Tile renders eyebrow + clay spot + bottom line, carries wash class and stagger delay', () => {
  const { container } = render(
    <Tile wash="sage" icon="i-suly" eyebrow="Súly" line="78,6 kg · −0,5 / hét" delayMs={150} onClick={() => {}} />,
  )
  const tile = container.querySelector('.mz-tile')!
  expect(tile.className).toContain('mz-w-sage')
  expect(tile.className).toContain('rise')
  expect((tile as HTMLElement).style.getPropertyValue('--d')).toBe('150ms')
  expect(tile.querySelector('.mz-eyebrow')!.textContent).toBe('Súly')
  expect(tile.querySelector('use')!.getAttribute('href')).toBe('#i-suly')
  expect(tile.querySelector('.mz-tile-line')!.textContent).toContain('78,6 kg')
})

test('a Tile with onClick is a real button with an accessible name', async () => {
  const onClick = vi.fn()
  render(<Tile wash="coral" icon="i-edzes" eyebrow="Edzés" line="Pull nap" onClick={onClick} />)
  await userEvent.click(screen.getByRole('button', { name: 'Edzés' }))
  expect(onClick).toHaveBeenCalled()
})

test('a Tile without onClick is not a button', () => {
  const { container } = render(<Tile wash="white" icon="i-cel" eyebrow="Cél" line="tartás" />)
  expect(container.querySelector('button')).toBeNull()
  expect(container.querySelector('.mz-tile')).not.toBeNull()
})

test('Tile dot badge renders only when asked', () => {
  const { container, rerender } = render(<Tile wash="coral" icon="i-mezo" eyebrow="Mezo" line="2 új üzenet" dot />)
  expect(container.querySelector('.mz-dot')).not.toBeNull()
  rerender(<Tile wash="coral" icon="i-mezo" eyebrow="Mezo" line="minden olvasva" />)
  expect(container.querySelector('.mz-dot')).toBeNull()
})

test('Mosaic is the 2-column grid wrapper', () => {
  const { container } = render(<Mosaic><div /><div /></Mosaic>)
  expect(container.querySelector('.mz-mosaic')).not.toBeNull()
})

test('StatStrip renders cells with value + label', () => {
  render(
    <StatStrip>
      <StatCell value="2/4" label="alkalom" />
      <StatCell value="7,4" label="átlag RPE" />
    </StatStrip>,
  )
  expect(screen.getByText('2/4')).toBeInTheDocument()
  expect(screen.getByText('átlag RPE')).toBeInTheDocument()
})

test('MCells renders tinted mini-cells from data', () => {
  const { container } = render(
    <MCells cells={[
      { label: 'KCAL', value: '420', tone: 'sage' },
      { label: 'F', value: '32 g', tone: 'coral' },
    ]} />,
  )
  const cells = container.querySelectorAll('.mz-mcells span')
  expect(cells).toHaveLength(2)
  expect(cells[0].className).toContain('mz-c-sage')
  expect(cells[0].textContent).toContain('KCAL')
})

test('MozaikPage scaffold: tone gradient + back chip + hero + body', async () => {
  const onBack = vi.fn()
  const { container } = render(
    <MozaikPage tone="coral">
      <PageHead onBack={onBack} />
      <PageHero icon="i-eletjel" big="72" name="Életjel" sub="hat szükséglet" />
      <PageBody principle="A test jelez — mi csak lefordítjuk.">tartalom</PageBody>
    </MozaikPage>,
  )
  expect(container.querySelector('.mz-page.mz-p-coral')).not.toBeNull()
  expect(container.querySelector('.mz-bignum')!.textContent).toBe('72')
  expect(screen.getByText('A test jelez — mi csak lefordítjuk.')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Vissza' }))
  expect(onBack).toHaveBeenCalled()
})

test('PageHero renders a clay SPOT in the hero row when `spot` is given (mezo-rmi0.1)', () => {
  const { container } = render(<PageHero spot="s-hajtas" big={33} name="skill" />)
  expect(container.querySelector('.mz-hero-row use')?.getAttribute('href')).toBe('#s-hajtas')
  expect(container.querySelector('.mz-bignum')?.textContent).toBe('33')
})

test('CollapsibleStrip: closed header carries the summary; toggling flips aria-expanded and reveals the body', async () => {
  render(
    <CollapsibleStrip eyebrow="Szettek" summary="2/6 ✓ · 1 234 kg">
      <div>set table</div>
    </CollapsibleStrip>,
  )
  const head = screen.getByRole('button', { name: /Szettek/ })
  expect(head).toHaveAttribute('aria-expanded', 'false')
  expect(screen.getByText('2/6 ✓ · 1 234 kg')).toBeInTheDocument()
  expect(screen.queryByText('set table')).not.toBeVisible()
  await userEvent.click(head)
  expect(head).toHaveAttribute('aria-expanded', 'true')
  expect(screen.getByText('set table')).toBeVisible()
})

// U4 (mezo-me75u.4, bible U3 rule 21): the page frame's üveg variant, so a slice reuses it
// instead of copying the Nap pages' own glass back pill + halo hero markup.
test('PageHead `glass` renders the glass back pill with the arrow split from the label', () => {
  const { container } = render(<PageHead glass label="Edzés" onBack={() => {}} />)
  const btn = container.querySelector('.mz-backbtn.glass.uv-back')!
  expect(btn).not.toBeNull()
  expect(btn).toHaveTextContent('‹Edzés')
})

test('PageHero `art` renders the frameless halo hero with a 3D icon in the accent', () => {
  const { container } = render(<PageHero art="t-volley" accent="var(--dv-rose)" big="4/5" name="Sport" sub="a héten" />)
  const hero = container.querySelector('.mz-page-hero.uv-hero.uv-halo') as HTMLElement
  expect(hero.style.getPropertyValue('--c')).toBe('var(--dv-rose)')
  expect(hero.querySelector('use[href="#t-volley"]')).not.toBeNull()
  expect(hero.querySelector('.mz-bignum')).toHaveTextContent('4/5')
  expect(hero.querySelector('.mz-hero-row')).toBeNull()
})
