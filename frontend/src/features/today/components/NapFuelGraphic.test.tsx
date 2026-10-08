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

  it('shows an over-target amount without negative remaining and caps arcs', () => {
    const { container } = render(<NapFuelGraphic consumed={{ ...consumed, kcal: 2400, p: 190 }} targets={targets} />)
    expect(screen.getByText('200 kcal a napi keret felett')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /fehérje/i }))
    expect(screen.getByRole('status')).toHaveTextContent('40 g a 150 g-os cél felett')
    expect(container.querySelector('[data-macro="p"] .nap-fuel-arc')).toHaveAttribute('stroke-dasharray', '75 100')
  })

  it('a skipped window never makes an under-target day read „felett" (same rule as the Fuel hero)', () => {
    // target 2200, skipped 600, eaten 1800 → ate under the target → 0 left, not 200 over
    render(<NapFuelGraphic consumed={{ ...consumed, kcal: 1800 }} targets={targets} skippedKcal={600} fuelMode={null} />)
    expect(screen.getByText('0 kcal a napi keretig')).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/felett/)
  })

  it('still says „felett" when the user really ate more than the target, skips or not', () => {
    render(<NapFuelGraphic consumed={{ ...consumed, kcal: 2300 }} targets={targets} skippedKcal={600} fuelMode={null} />)
    expect(screen.getByText('100 kcal a napi keret felett')).toBeInTheDocument()
  })

  it('an ESTIMATE day says „körül" and never „felett"', () => {
    render(<NapFuelGraphic consumed={{ ...consumed, kcal: 2400 }} targets={targets} fuelMode="ESTIMATE" />)
    expect(screen.getByText('200 kcal a napi keret körül')).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/felett/)
  })

  it('shows unknown targets without inventing progress or remaining', () => {
    const { container } = render(<NapFuelGraphic consumed={consumed} targets={zero} />)
    fireEvent.click(screen.getByRole('button', { name: /fehérje/i }))
    expect(screen.getByRole('status')).toHaveTextContent('Nincs beállított fehérjecél')
    expect(container.querySelector('[data-macro="p"] .nap-fuel-arc')).toBeNull()
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
    expect(screen.getByRole('alert')).toHaveTextContent('Nem sikerült betölteni')
    fireEvent.click(screen.getByRole('button', { name: /újra/i }))
    expect(retry).toHaveBeenCalledOnce()
  })

  it('keeps each mounted graphic self-contained: arcs glow in their own macro colour, no shared gradient ids', () => {
    // Üveg U3: the per-instance gradients (and their id-collision risk) are gone — every arc
    // carries its macro accent on its own group (`--c`), so two mounted graphics cannot clash.
    const { container } = render(<><NapFuelGraphic consumed={consumed} targets={targets} /><NapFuelGraphic consumed={zero} targets={targets} /></>)
    expect(container.querySelectorAll('linearGradient')).toHaveLength(0)
    expect(container.querySelector('[data-macro="p"]')).toHaveStyle({ '--c': 'var(--macro-protein)' })
    expect(container.querySelector('[data-macro="p"] .nap-fuel-arc')).toHaveClass('uv-ring-prog')
    for (const region of screen.getAllByRole('region', { name: /mai energiabevitel/i })) {
      expect(within(region).getAllByRole('button')).toHaveLength(4)
    }
  })

  it('wears the üveg ranking: amber glass with flat 3D macro chips, a dashed card on an empty day', () => {
    const { container, rerender } = render(<NapFuelGraphic consumed={consumed} targets={targets} />)
    const card = screen.getByRole('region', { name: /mai energiabevitel/i })
    expect(card).toHaveClass('glass')
    expect(card).not.toHaveClass('uv-empty')
    expect(card).toHaveStyle({ '--c': 'var(--dv-amber)' })
    const icons = [...container.querySelectorAll('.nap-fuel-macro use')].map(u => u.getAttribute('href'))
    expect(icons).toEqual(['#t-meat', '#t-carb', '#t-avocado'])
    expect(container.querySelector('.nap-fuel-macro .glass')).toBeNull()
    rerender(<NapFuelGraphic consumed={zero} targets={targets} />)
    expect(card).toHaveClass('uv-empty')
    expect(card).not.toHaveClass('glass')
    // loading and failure keep the glass (they are not free space)
    rerender(<NapFuelGraphic consumed={zero} targets={targets} isPending />)
    expect(card).toHaveClass('glass')
    rerender(<NapFuelGraphic consumed={zero} targets={targets} isError onRetry={() => {}} />)
    expect(card).toHaveClass('glass')
  })
})

// Kihagyás S3 (mezo-q4xt2.3): a GUIDANCE nap nem mér kalóriát — egyetlen nyugodt sor a műszer helyén.
describe('NapFuelGraphic · kímélő mód', () => {
  it('shows ONE calm line instead of the macro instrument on a guidance day', () => {
    const { container } = render(<NapFuelGraphic guidance consumed={consumed} targets={targets} />)
    expect(screen.getByText('Kímélő mód · ma nincs kalóriacél — folyadék, könnyű étel')).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
    expect(container.querySelector('.nap-fuel-reactor')).toBeNull()
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
