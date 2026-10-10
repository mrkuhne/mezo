import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { NapFuelGraphic } from '@/features/today/components/NapFuelGraphic'

const consumed = { kcal: 1460, p: 110, c: 165, f: 40, water: 0 }
const targets = { kcal: 2200, p: 150, c: 265, f: 60, water: 0 }
const zero = { kcal: 0, p: 0, c: 0, f: 0, water: 0 }

describe('NapFuelGraphic', () => {
  it('switches the core from actual energy to a macro and back', () => {
    render(<NapFuelGraphic consumed={consumed} targets={targets} />)
    const core = screen.getByRole('button', { name: /teljes energiabevitel/i })
    expect(core).toHaveTextContent('1 460')
    fireEvent.click(screen.getByRole('button', { name: /fehérje/i }))
    expect(core).toHaveTextContent('110 g')
    expect(screen.getByRole('status')).toHaveTextContent('40 g a 150 g-os célig')
    expect(screen.getByRole('button', { name: /fehérje/i })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(core)
    expect(core).toHaveTextContent('1 460')
  })

  it('shows an over-target amount without negative remaining and caps the level', () => {
    const { container } = render(<NapFuelGraphic consumed={{ ...consumed, kcal: 2400, p: 190 }} targets={targets} />)
    expect(screen.getByRole('status')).toHaveTextContent('200 kcal a napi keret felett.')
    fireEvent.click(screen.getByRole('button', { name: /fehérje/i }))
    expect(screen.getByRole('status')).toHaveTextContent('40 g a 150 g-os cél felett')
    // the level is capped at the brim
    expect((container.querySelector('.fo-vial .fo-tube .l') as HTMLElement).style.getPropertyValue('--p')).toBe('100%')
  })

  it('a skipped window never makes an under-target day read „felett" (same rule as the Fuel hero)', () => {
    // target 2200, skipped 600, eaten 1800 → ate under the target → 0 left, not 200 over
    render(<NapFuelGraphic consumed={{ ...consumed, kcal: 1800 }} targets={targets} skippedKcal={600} fuelMode={null} />)
    expect(screen.getByRole('status')).toHaveTextContent('0 kcal a napi keretig.')
    expect(document.body.textContent).not.toMatch(/felett/)
  })

  it('still says „felett" when the user really ate more than the target, skips or not', () => {
    render(<NapFuelGraphic consumed={{ ...consumed, kcal: 2300 }} targets={targets} skippedKcal={600} fuelMode={null} />)
    expect(screen.getByRole('status')).toHaveTextContent('100 kcal a napi keret felett.')
  })

  it('an ESTIMATE day says „körül" and never „felett"', () => {
    render(<NapFuelGraphic consumed={{ ...consumed, kcal: 2400 }} targets={targets} fuelMode="ESTIMATE" />)
    expect(screen.getByRole('status')).toHaveTextContent('200 kcal a napi keret körül.')
    expect(document.body.textContent).not.toMatch(/felett/)
  })

  it('shows unknown targets without inventing progress or remaining', () => {
    const { container } = render(<NapFuelGraphic consumed={consumed} targets={zero} />)
    fireEvent.click(screen.getByRole('button', { name: /fehérje/i }))
    expect(screen.getByRole('status')).toHaveTextContent('Nincs beállított fehérjecél')
    expect((container.querySelector('.fo-vial .fo-tube .l') as HTMLElement).style.getPropertyValue('--p')).toBe('0%')
    expect(container.textContent).not.toMatch(/NaN|Infinity/)
  })

  it('distinguishes empty, pending and failed data and exposes retry', () => {
    const retry = vi.fn()
    const { rerender } = render(<NapFuelGraphic consumed={zero} targets={targets} />)
    expect(screen.getByRole('status')).toHaveTextContent('Még nincs rögzített energiabevitel')
    rerender(<NapFuelGraphic consumed={zero} targets={targets} isPending />)
    expect(screen.getByRole('status')).toHaveTextContent('Táplálkozási adatok betöltése')
    expect(screen.queryByRole('button', { name: /teljes energiabevitel/i })).not.toBeInTheDocument()
    rerender(<NapFuelGraphic consumed={zero} targets={targets} isError onRetry={retry} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Az üzemanyagot most nem sikerült betölteni.')
    fireEvent.click(screen.getByRole('button', { name: /újra/i }))
    expect(retry).toHaveBeenCalledOnce()
  })

  it('keeps each mounted instrument self-contained: three vials in their own macro colour, no rings, no shared ids', () => {
    const { container } = render(<><NapFuelGraphic consumed={consumed} targets={targets} /><NapFuelGraphic consumed={zero} targets={targets} /></>)
    expect(container.querySelectorAll('linearGradient, circle, .uv-ring')).toHaveLength(0)
    expect(container.querySelector('.fo-vial')).toHaveStyle({ '--c': 'var(--macro-protein)' })
    for (const region of screen.getAllByRole('region', { name: /mai energiabevitel/i })) {
      // the big number (reset) + the three macro vials
      expect(within(region).getAllByRole('button')).toHaveLength(4)
    }
  })

  it('wears the Folyadék kit: the macro glyphs in three vials, the selection marked and announced, a way back', () => {
    const open = vi.fn()
    const { container } = render(<NapFuelGraphic consumed={consumed} targets={targets} onOpenFuel={open} />)
    const card = screen.getByRole('region', { name: /mai energiabevitel/i })
    expect(card.querySelector('.glass, .uv-empty')).toBeNull()
    expect(card).not.toHaveClass('glass')
    const icons = [...container.querySelectorAll('.fo-vial use')].map(u => u.getAttribute('href'))
    expect(icons).toEqual(['#t-meat', '#t-carb', '#t-avocado'])
    expect(screen.getByRole('button', { name: /szénhidrát/i })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: /zsír/i })).toHaveTextContent('/ 60 g cél')
    expect(screen.queryByRole('button', { name: 'Vissza az összképhez' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /zsír/i }))
    expect(screen.getByRole('button', { name: /zsír/i }).querySelector('.fo-tube em')).toHaveTextContent('✓')
    expect(screen.getByRole('button', { name: /teljes energiabevitel/i })).toHaveTextContent('zsír · 67% a napi célból')
    fireEvent.click(screen.getByRole('button', { name: 'Vissza az összképhez' }))
    expect(screen.getByRole('button', { name: /teljes energiabevitel/i })).toHaveTextContent('kcal ma · 2 200 kcal keret')
    fireEvent.click(screen.getByRole('button', { name: 'Fuel megnyitása' }))
    expect(open).toHaveBeenCalledOnce()
  })
})

// Kihagyás S3 (mezo-q4xt2.3): a GUIDANCE nap nem mér kalóriát — egyetlen nyugodt sor a műszer helyén.
describe('NapFuelGraphic · kímélő mód', () => {
  it('shows ONE calm line instead of the macro instrument on a guidance day', () => {
    const { container } = render(<NapFuelGraphic guidance consumed={consumed} targets={targets} />)
    expect(screen.getByText('Kímélő mód · ma nincs kalóriacél — folyadék, könnyű étel')).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
    expect(container.querySelector('.fo-vials, .fo-big')).toBeNull()
    expect(container.textContent).not.toMatch(/keret|1 460|2 200|elrontott|túlléptél|hiba|rossz|bukta|kudarc/i)
    expect(container.querySelector('use')).not.toBeNull()
  })

  it('without guidance the instrument is unchanged', () => {
    render(<NapFuelGraphic consumed={consumed} targets={targets} />)
    expect(screen.getByRole('button', { name: /teljes energiabevitel/i })).toBeInTheDocument()
    expect(screen.queryByText(/ma nincs kalóriacél/)).toBeNull()
  })

  it('a loading or failed read still wins over the guidance line', () => {
    render(<NapFuelGraphic guidance consumed={zero} targets={targets} isPending />)
    expect(screen.getByRole('status')).toHaveTextContent('Táplálkozási adatok betöltése')
  })
})
