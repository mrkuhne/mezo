import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { DayNavigator } from '@/shared/ui/DayNavigator'

describe('DayNavigator', () => {
  it('steps back and forward one day', () => {
    const onChange = vi.fn()
    render(<DayNavigator date="2026-07-20" maxDate="2026-07-27" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /előző nap/i }))
    expect(onChange).toHaveBeenCalledWith('2026-07-19')
    fireEvent.click(screen.getByRole('button', { name: /következő nap/i }))
    expect(onChange).toHaveBeenCalledWith('2026-07-21')
  })

  it('disables "next" at maxDate (no future) and labels today as "Ma"', () => {
    render(<DayNavigator date="2026-07-27" maxDate="2026-07-27" onChange={() => {}} />)
    expect(screen.getByRole('button', { name: /következő nap/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /dátum kiválasztása/i })).toHaveTextContent('Ma')
  })

  it('opens the DatePicker calendar from the date label', () => {
    render(<DayNavigator date="2026-07-20" maxDate="2026-07-27" onChange={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /dátum kiválasztása/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
