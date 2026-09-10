import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { TitanCompanion } from './TitanCompanion'

const states = [
  { key: 'energia', band: 'green' }, { key: 'hidratacio', band: 'yellow' }, { key: 'pihenes', band: 'green' },
] as never

describe('TitanCompanion', () => {
  test('tap opens the signals surface and the button is labelled', () => {
    const open = vi.fn()
    render(<TitanCompanion states={states} onOpenSignals={open} />)
    fireEvent.click(screen.getByRole('button', { name: /életjelek/i }))
    expect(open).toHaveBeenCalledOnce()
  })
  test('aura colors come from the need meta, per band', () => {
    render(<TitanCompanion states={states} onOpenSignals={() => {}} />)
    const aura = document.querySelector('.titan-aura') as HTMLElement
    expect(aura.style.getPropertyValue('--aura-0')).not.toBe('')
  })
})
