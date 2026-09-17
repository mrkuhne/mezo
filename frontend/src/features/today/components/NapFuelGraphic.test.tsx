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

  it('keeps gradient references unique across multiple mounted graphics', () => {
    const { container } = render(<><NapFuelGraphic consumed={consumed} targets={targets} /><NapFuelGraphic consumed={zero} targets={targets} /></>)
    const ids = [...container.querySelectorAll('linearGradient')].map(el => el.id)
    expect(new Set(ids).size).toBe(6)
    for (const region of screen.getAllByRole('region', { name: /mai energiabevitel/i })) {
      expect(within(region).getAllByRole('button')).toHaveLength(4)
    }
  })
})
