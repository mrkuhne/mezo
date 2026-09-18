// ============================================================
// Mezo · NapCompanion — a visszaöltöztetett jelenlét-jel őre (mezo-ju4j6.10).
//
// A Titán-kori teszt a three.js-kaput őrizte (mikor NEM szabad behúzni a WebGL-chunkot).
// Az a kapu megszűnt a jelenettel együtt, ezért az itteni állítások arra vigyáznak, ami
// MOST számít: a jel agyag szimbólum (nem canvas, nem fém-SVG), a koppintás az Életjelekre
// visz, és az aura a szükséglet-színekből jön, sávonként.
// ============================================================
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { NapCompanion } from './NapCompanion'

const states = [
  { key: 'energia', band: 'green' }, { key: 'hidratacio', band: 'yellow' }, { key: 'pihenes', band: 'green' },
] as never

describe('NapCompanion', () => {
  test('tap opens the signals surface and the button is labelled', () => {
    const open = vi.fn()
    render(<NapCompanion states={states} onOpenSignals={open} />)
    fireEvent.click(screen.getByRole('button', { name: /életjelek/i }))
    expect(open).toHaveBeenCalledOnce()
  })

  test('a jel az AGYAG Mezo-szimbólum — nincs canvas és nincs titán-SVG', () => {
    const { container } = render(<NapCompanion states={states} onOpenSignals={() => {}} />)
    expect(container.querySelector('canvas')).toBeNull()
    expect(container.querySelector('.titan-svg')).toBeNull()
    expect(container.querySelector('.nap-companion-mark use')?.getAttribute('href')).toBe('#i-mezo')
  })

  test('aura colors come from the need meta, per band', () => {
    render(<NapCompanion states={states} onOpenSignals={() => {}} />)
    const halo = document.querySelector('.nap-companion-halo') as HTMLElement
    // zöld sáv = 35%, sárga = 22% — a sáv tehát TÉNYLEG halványít, nem csak színt vált
    expect(halo.style.getPropertyValue('--aura-0')).toContain('35%')
    expect(halo.style.getPropertyValue('--aura-1')).toContain('22%')
  })
})
