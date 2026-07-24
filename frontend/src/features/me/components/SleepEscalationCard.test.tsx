import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { SleepEscalationCard } from '@/features/me/components/SleepEscalationCard'

describe('SleepEscalationCard', () => {
  test('short reason renders the short lead and both actions', () => {
    const onDetails = vi.fn(); const onSnooze = vi.fn()
    render(<SleepEscalationCard reason="short" onDetails={onDetails} onSnooze={onSnooze} />)
    expect(screen.getByText(/tartósan kevés az alvásod/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Részletek' }))
    expect(onDetails).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Most nem' }))
    expect(onSnooze).toHaveBeenCalled()
  })
  test('quality reason renders the quality lead', () => {
    render(<SleepEscalationCard reason="quality" onDetails={() => {}} onSnooze={() => {}} />)
    expect(screen.getByText(/tartósan rossz minőségű az alvásod/i)).toBeInTheDocument()
  })
  test('no heavy stats on the card itself (sheet-only)', () => {
    render(<SleepEscalationCard reason="short" onDetails={() => {}} onSnooze={() => {}} />)
    expect(screen.queryByText(/öngyilkos/)).toBeNull()
  })
})
