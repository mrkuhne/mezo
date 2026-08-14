import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { AiCallFilters } from '@/features/me/components/AiCallFilters'

const TOTALS = {
  callCount: 412, successCount: 381, errorCount: 24, cancelledCount: 7,
  unpricedCount: 38, costUsd: 1.86, currency: 'USD',
}

describe('AiCallFilters', () => {
  it('shows the error and cancelled counts on their chips', () => {
    render(<AiCallFilters totals={TOTALS} filters={{}} onChange={() => {}} />)
    expect(screen.getByRole('button', { name: /Hiba 24/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Megszakadt 7/ })).toBeInTheDocument()
  })

  it('sets a status filter on click and clears it when clicked again', () => {
    const onChange = vi.fn()
    const { rerender } = render(<AiCallFilters totals={TOTALS} filters={{}} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: /Hiba/ }))
    expect(onChange).toHaveBeenCalledWith({ status: 'ERROR' })

    rerender(<AiCallFilters totals={TOTALS} filters={{ status: 'ERROR' }} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /Hiba/ }))
    expect(onChange).toHaveBeenLastCalledWith({})
  })

  it('surfaces the active feature filter with a way to clear it', () => {
    const onChange = vi.fn()
    render(<AiCallFilters totals={TOTALS} filters={{ feature: 'meal_coach' }} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: /meal_coach/ }))
    expect(onChange).toHaveBeenCalledWith({})
  })
})
