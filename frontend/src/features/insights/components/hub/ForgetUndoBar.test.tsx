import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ForgetUndoBar } from '@/features/insights/components/hub/ForgetUndoBar'
import { undoSub, undoTitle } from '@/features/insights/logic/hubCopy'

const pending = { key: 'f:1', label: 'Reggeli kávé', computed: false, commit: vi.fn(), startedAt: Date.now() }

describe('ForgetUndoBar', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('renders nothing for pending={null}', () => {
    const { container } = render(<ForgetUndoBar pending={null} onUndo={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the title, sub, undo button and countdown, and calls onUndo on click', () => {
    const onUndo = vi.fn()
    render(<ForgetUndoBar pending={pending} onUndo={onUndo} />)
    expect(screen.getByText(undoTitle(pending.label))).toBeInTheDocument()
    expect(screen.getByText(undoSub(pending.computed))).toBeInTheDocument()
    const status = screen.getByRole('status')
    expect(status).toBeInTheDocument()
    const btn = screen.getByRole('button', { name: /Visszavonom/ })
    expect(btn).toHaveTextContent('5')
    fireEvent.click(btn)
    expect(onUndo).toHaveBeenCalledTimes(1)
  })

  it('counts down from 5 to 3 after 2 seconds', () => {
    render(<ForgetUndoBar pending={pending} onUndo={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Visszavonom/ })).toHaveTextContent('5')
    act(() => { vi.advanceTimersByTime(2000) })
    expect(screen.getByRole('button', { name: /Visszavonom/ })).toHaveTextContent('3')
  })
})
