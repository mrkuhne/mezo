import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { emitToast } from '@/shared/lib/toastBus'
import { ToastProvider, useToast } from '@/shared/ui/ToastProvider'

function ShowButton() {
  const toast = useToast()
  return (
    <button onClick={() => toast.show({ kind: 'success', text: 'Mentve' })}>trigger</button>
  )
}

describe('ToastProvider', () => {
  it('renders a toast emitted through the bus and auto-hides it', () => {
    vi.useFakeTimers()
    render(<ToastProvider>content</ToastProvider>)

    act(() => emitToast({ kind: 'error', text: 'Mentés sikertelen — próbáld újra' }))
    const toast = screen.getByRole('status')
    expect(toast).toHaveTextContent('Mentés sikertelen — próbáld újra')
    expect(toast).toHaveAttribute('data-kind', 'error')

    act(() => vi.advanceTimersByTime(3300))
    expect(screen.queryByRole('status')).toBeNull()
    vi.useRealTimers()
  })

  it('exposes show() via useToast and a newer toast replaces the current one', () => {
    vi.useFakeTimers()
    render(
      <ToastProvider>
        <ShowButton />
      </ToastProvider>,
    )

    fireEvent.click(screen.getByText('trigger'))
    expect(screen.getByRole('status')).toHaveTextContent('Mentve')

    act(() => emitToast({ kind: 'info', text: 'Frissítve' }))
    const toasts = screen.getAllByRole('status')
    expect(toasts).toHaveLength(1)
    expect(toasts[0]).toHaveTextContent('Frissítve')
    vi.useRealTimers()
  })

  it('emitting without a mounted provider is a silent no-op', () => {
    expect(() => emitToast({ kind: 'info', text: 'senki sem hallja' })).not.toThrow()
  })
})
