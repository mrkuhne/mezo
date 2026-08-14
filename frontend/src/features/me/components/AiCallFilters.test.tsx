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

  it('sets a call-kind filter from the Típus chips and clears it when the active one is tapped', () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <AiCallFilters totals={TOTALS} filters={{ status: 'SUCCESS' }} onChange={onChange} />,
    )

    // The eight kinds live behind a disclosure chip — still chips, no new widget pattern.
    expect(screen.queryByRole('button', { name: 'STREAM' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Típus/ }))
    fireEvent.click(screen.getByRole('button', { name: 'STREAM' }))
    // the other axis survives — the kind narrows, it does not replace
    expect(onChange).toHaveBeenCalledWith({ status: 'SUCCESS', callKind: 'CHAT_STREAM' })

    rerender(<AiCallFilters totals={TOTALS} filters={{ status: 'SUCCESS', callKind: 'CHAT_STREAM' }} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /STREAM ✕/ }))
    expect(onChange).toHaveBeenLastCalledWith({ status: 'SUCCESS' })
  })

  it('offers every call kind the backend can filter on', () => {
    render(<AiCallFilters totals={TOTALS} filters={{}} onChange={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /Típus/ }))

    for (const label of ['CHAT', 'STREAM', 'KÉP', 'SMART', 'TOOL', 'HANG', 'EMBED', 'EMBED?']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    }
  })

  it('omits the counts when the rollup is unavailable, keeping the chips clickable', () => {
    // Breakdown 500 + list 200: the chips still filter (server-side, on the list endpoint), but
    // "Siker 0 · Hiba 0 · Megszakadt 0" would be an invented rollup.
    const onChange = vi.fn()
    render(<AiCallFilters totals={null} filters={{}} onChange={onChange} />)

    expect(screen.getByRole('button', { name: 'Hiba' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Hiba 0/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Siker 0/ })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Hiba' }))
    expect(onChange).toHaveBeenCalledWith({ status: 'ERROR' })
  })
})
